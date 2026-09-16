import { INTERFACE_BANDWIDTH } from '@/lib/components/specs';
import { resolveAssumptions } from '@/lib/requirement/assumptions';
import { N_DET_BY_CONTRAST } from '@/lib/requirement/defaults';
import { readField } from '@/lib/requirement/fields';
import type { Assumption, DefectContrast, Requirement } from '@/lib/requirement/types';
import { suggestLighting } from './lighting';
import { perspectiveCheck, perspectiveErrorMm, telecentricCheck, TELECENTRIC_FEASIBLE_MAX_MM, TELECENTRIC_PRACTICAL_MAX_MM } from './optics';
import { stitchCheck, thermalCheck, thermalErrorUm } from './mechanics';
import { GRR_DIVISOR, K_SUBPIXEL, measurementBudget } from './resolution';
import { completeness, toRuleResult, type Evidence, type RuleAssumedInput, type RuleInput, type RuleResult } from './rules';
import { cameraTile, type CameraTile } from './tiling';
import { fmt, round, type Check } from './types';

/**
 * Engine V1b chạy thẳng trên bảng Yêu cầu (spec V1.1 §4–§6).
 *
 * Trình tự: điền giả định (tầng Yêu cầu, hiện trên panel) → độ phân giải hai
 * nhánh → chia camera → quang học → cơ khí/nhiệt → thông lượng → chiếu sáng →
 * thuật toán. Mỗi bước trả `RuleResult`; đánh giá khả thi gom lại ở feasibility.ts.
 *
 * Không import file này từ `vision/index.ts`: nó phụ thuộc tầng Yêu cầu, còn
 * tầng Yêu cầu lại import `vision/resolution` — đi qua index là thành vòng.
 *
 * Luật cần thiết bị cụ thể (tiêu cự, vòng ảnh, nhiễu xạ, DOF, chu kỳ, IPC) chờ
 * V1c chọn thiết bị. Ở V1b chúng không có mặt, nhóm Integration để trống — đánh
 * giá khả thi coi là CHƯA BIẾT, không coi là đạt.
 */

/** THR-005: nhoè cho phép = k_blur × mm/px (spec cho 0,3…1, mặc định 0,5). */
export const K_BLUR = 0.5;
/** LGT-008: thời gian phơi sáng tối đa dưới mức này thì bắt buộc strobe + global shutter. */
export const STROBE_EXPOSURE_LIMIT_US = 50;
/** THR-006: dùng quá tỉ lệ này băng thông giao tiếp là mỏng biên. */
export const INTERFACE_MAX_SHARE = 0.7;
/** THR-001: ảnh đơn sắc 8 bit (Bayer 8 bit cũng 1 byte/px) khi chưa chọn camera. */
export const BYTES_PER_PX = 1;

export type RequirementAnalysis = {
  results: RuleResult[];
  /** Giả định đã áp — cùng danh sách với panel trên trang Yêu cầu. */
  assumptions: Assumption[];
  /** Ô thật ÷ (ô thật + ô giả định) trên các ô engine đã dùng. */
  completeness: number | null;
  /** mm/px mục tiêu — nhánh chặt hơn quyết định (RES-003). */
  governingMmPerPx: number | null;
  /** Ngân sách sai số đo U (mm); null khi bài không đo. */
  uncertaintyBudgetMm: number | null;
  tile: CameraTile | null;
  megapixelsPerCamera: number | null;
};

const CONTRASTS: readonly DefectContrast[] = ['high', 'medium', 'low', 'unknown'];
const isContrast = (value: unknown): value is DefectContrast => CONTRASTS.includes(value as DefectContrast);

export function analyseRequirement(draft: Requirement): RequirementAnalysis {
  const { requirement: req, assumptions } = resolveAssumptions(draft);
  const results: RuleResult[] = [];

  const num = (path: string): number | null => {
    const value = readField(req, path)?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const raw = (path: string): unknown => readField(req, path)?.value ?? null;

  /** Tách ô thật / ô giả định cho danh sách input của một luật. */
  const inputs = (paths: string[]): { inputsUsed: RuleInput[]; inputsAssumed: RuleAssumedInput[] } => {
    const inputsUsed: RuleInput[] = [];
    const inputsAssumed: RuleAssumedInput[] = [];
    for (const path of paths) {
      const field = readField(req, path);
      if (!field || field.value === null) continue;
      if ((field.confidence === 'assumed' || field.confidence === 'inferred') && field.assumptionId) {
        inputsAssumed.push({ path, value: field.value, assumptionId: field.assumptionId });
      } else {
        inputsUsed.push({ path, value: field.value });
      }
    }
    return { inputsUsed, inputsAssumed };
  };
  const push = (ruleId: string, check: Check, evidence: Evidence, paths: string[], marginRatio: number | null = null) =>
    results.push(toRuleResult(ruleId, check, { evidence, marginRatio, ...inputs(paths) }));

  const fovW = num('object.sizeX');
  const fovH = num('object.sizeY');

  // ─── RES-001 / RES-006: nhánh phát hiện lỗi ───
  let detectionMmPerPx: number | null = null;
  req.detection.forEach((item, index) => {
    const base = `detection.${index}`;
    const minSize = item.minSize.value;
    if (minSize === null || !(minSize > 0)) return;
    const contrast = isContrast(item.contrast.value) ? item.contrast.value : 'unknown';
    const n = N_DET_BY_CONTRAST[contrast];
    const mmPerPx = minSize / n;
    detectionMmPerPx = detectionMmPerPx === null ? mmPerPx : Math.min(detectionMmPerPx, mmPerPx);
    push(
      'RES-001',
      {
        key: 'detectionBudget',
        status: 'info',
        formula: `${fmt(minSize)} mm ÷ ${n} px = ${fmt(mmPerPx, 5)} mm/px`,
        noteKey: 'pxPerDefectByContrast',
        noteValues: { contrast, n },
      },
      'rule-of-thumb',
      [`${base}.minSize`, `${base}.contrast`]
    );
    // Độ tương phản người dùng chưa nêu (kể cả khi đang giả định "thấp") → phải chụp mẫu.
    if (item.contrast.confidence !== 'stated' || contrast === 'unknown') {
      push(
        'RES-006',
        { key: 'contrastValidation', status: 'warn', formula: `N = ${n} px`, noteKey: 'contrastUnknownAssumedLow', noteValues: { n } },
        'requires-sample-test',
        [`${base}.contrast`]
      );
    }
  });

  // ─── RES-002: nhánh đo lường ───
  const tolerances = req.measurement.map((item) => item.tolerance.value).filter((t): t is number => t !== null && t > 0);
  const budget = tolerances.length > 0 ? measurementBudget(Math.min(...tolerances)) : null;
  if (budget) {
    push(
      'RES-002',
      {
        key: 'measurementBudget',
        status: 'info',
        formula:
          `T = 2 × ±${fmt(budget.toleranceMm, 4)} = ${fmt(budget.totalToleranceMm, 4)} mm · ` +
          `U = ${fmt(budget.totalToleranceMm, 4)} ÷ ${GRR_DIVISOR} = ${fmt(budget.uncertaintyBudgetMm, 5)} mm · ` +
          `${fmt(budget.uncertaintyBudgetMm, 5)} × ${K_SUBPIXEL} = ${fmt(budget.mmPerPx, 5)} mm/px`,
      },
      'calculated',
      ['measurement.0.tolerance']
    );
  }
  const U = budget?.uncertaintyBudgetMm ?? null;

  // ─── RES-003: nhánh quyết định ───
  const detMm: number | null = detectionMmPerPx;
  const measMm = budget?.mmPerPx ?? null;
  const governing = detMm === null ? measMm : measMm === null ? detMm : Math.min(detMm, measMm);
  if (detMm !== null && measMm !== null) {
    const byMeasurement = measMm < detMm;
    push(
      'RES-003',
      {
        key: 'governingResolution',
        status: 'info',
        formula: `min(${fmt(detMm, 5)}, ${fmt(measMm, 5)}) = ${fmt(governing!, 5)} mm/px`,
        noteKey: byMeasurement ? 'governedByMeasurement' : 'governedByDetection',
        noteValues: { ratio: round(byMeasurement ? detMm / measMm : measMm / detMm, 2) },
      },
      'calculated',
      ['detection.0.minSize', 'detection.0.contrast', 'measurement.0.tolerance']
    );
  }

  // ─── RES-005 / RES-004: chia camera, số pixel ───
  const cameraCount = num('system.cameraCount');
  const sizePaths = ['object.sizeX', 'object.sizeY', 'system.cameraCount'];
  let tile: CameraTile | null = null;
  let megapixels: number | null = null;
  if (fovW !== null && fovH !== null && governing !== null) {
    if (cameraCount === null) {
      // Không tự đoán số camera (chốt 2026-09-16) — chỉ cho biết nếu dùng 1 camera.
      const single = (Math.ceil(fovW / governing) * Math.ceil(fovH / governing)) / 1e6;
      push(
        'RES-005',
        { key: 'cameraTiling', status: 'warn', formula: '—', noteKey: 'cameraCountMissing', noteValues: { mp: round(single, 1) } },
        'unknown',
        sizePaths
      );
    } else if (cameraCount >= 1) {
      tile = cameraTile({ fovWidthMm: fovW, fovHeightMm: fovH, cameraCount, mmPerPx: governing });
      if (tile) {
        if (cameraCount > 1) {
          push(
            'RES-005',
            {
              key: 'cameraTiling',
              status: 'info',
              formula:
                `lưới ${tile.grid.cols}×${tile.grid.rows} · mỗi camera ${fmt(tile.widthMm, 1)} × ${fmt(tile.heightMm, 1)} mm ` +
                `(chồng lấn ${fmt(tile.overlapXMm, 1)} / ${fmt(tile.overlapYMm, 1)} mm)`,
            },
            'calculated',
            sizePaths
          );
        }
        const nx = Math.ceil(tile.widthMm / governing);
        const ny = Math.ceil(tile.heightMm / governing);
        megapixels = (nx * ny) / 1e6;
        push(
          'RES-004',
          {
            key: 'megapixelsPerCamera',
            status: 'info',
            formula: `${fmt(tile.widthMm, 1)} ÷ ${fmt(governing, 5)} = ${nx} px × ${fmt(tile.heightMm, 1)} ÷ ${fmt(governing, 5)} = ${ny} px → ${fmt(megapixels, 2)} MP/camera`,
          },
          'calculated',
          [...sizePaths, 'detection.0.minSize', 'measurement.0.tolerance']
        );
      }
    }
  }

  // ─── OPT-008 / OPT-006 / OPT-007: phối cảnh và telecentric ───
  const heightVariation = num('object.heightVariation');
  const workingDistance = num('system.workingDistance');
  const perspectiveFree = raw('measurement.0.perspectiveFree') === true;
  const perspective = perspectiveCheck({
    heightVariationMm: heightVariation,
    workingDistanceMm: workingDistance,
    tile,
    uncertaintyBudgetMm: U,
    perspectiveFree,
  });
  const opticsPaths = ['object.heightVariation', 'system.workingDistance', 'measurement.0.tolerance', ...sizePaths];
  if (perspective && tile && U !== null && heightVariation !== null && workingDistance !== null) {
    const error = perspectiveErrorMm({ heightVariationMm: heightVariation, workingDistanceMm: workingDistance, offAxisMm: tile.halfDiagonalMm });
    push(
      perspectiveFree ? 'OPT-006' : 'OPT-008',
      perspective,
      'calculated',
      perspectiveFree ? [...opticsPaths, 'measurement.0.perspectiveFree'] : opticsPaths,
      perspectiveFree || !error ? null : U / error
    );
  }
  const telecentric = telecentricCheck({
    needed: perspective?.status === 'fail' || perspectiveFree,
    tile,
    fovWidthMm: fovW ?? 0,
    fovHeightMm: fovH ?? 0,
    uncertaintyBudgetMm: U,
    workingDistanceMm: workingDistance,
  });
  if (telecentric && tile) {
    const size = Math.max(tile.widthMm, tile.heightMm);
    const limit = telecentric.status === 'fail' ? TELECENTRIC_FEASIBLE_MAX_MM : TELECENTRIC_PRACTICAL_MAX_MM;
    push('OPT-007', telecentric, 'rule-of-thumb', opticsPaths, limit / size);
  }

  // ─── MEC-001 / MEC-003: nhiệt, ghép ảnh ───
  const alpha = num('object.thermalExpansionCoeff');
  const span = num('measurement.0.spanLength');
  const deltaT = num('environment.ambientTempRange');
  const thermalPaths = ['object.thermalExpansionCoeff', 'object.material', 'measurement.0.spanLength', 'environment.ambientTempRange', 'measurement.0.tolerance'];
  const thermal = thermalCheck({ alphaUmPerMK: alpha, lengthMm: span, deltaTK: deltaT, uncertaintyBudgetMm: U });
  const thermalMm =
    alpha !== null && span !== null && deltaT !== null ? (thermalErrorUm({ alphaUmPerMK: alpha, lengthMm: span, deltaTK: deltaT }) ?? 0) / 1000 : null;
  if (thermal && U !== null) push('MEC-001', thermal, 'calculated', thermalPaths, thermalMm ? U / thermalMm : null);

  const stitch = stitchCheck({
    tile,
    crossesCameraSeam: raw('measurement.0.crossesCameraSeam') === true,
    spanLengthMm: span,
    mmPerPx: governing,
    thermalErrorMm: thermalMm,
    uncertaintyBudgetMm: U,
  });
  if (stitch && U !== null) {
    const total = Number(stitch.noteValues?.total ?? 0);
    push(
      'MEC-003',
      stitch,
      'rule-of-thumb',
      [...thermalPaths, 'measurement.0.crossesCameraSeam', ...sizePaths],
      stitch.status === 'pass' || !total ? null : U / total
    );
  }

  const conditions = raw('environment.conditions');
  const hasCondition = (condition: string) => Array.isArray(conditions) && conditions.includes(condition);
  if (hasCondition('vibration')) {
    push('MEC-002', { key: 'vibration', status: 'warn', formula: '—', noteKey: 'vibrationRigidMount' }, 'rule-of-thumb', ['environment.conditions']);
  }
  if (hasCondition('dust') || hasCondition('oil')) {
    push('ENV-001', { key: 'envDust', status: 'warn', formula: '—', noteKey: 'envDustOil' }, 'rule-of-thumb', ['environment.conditions']);
  }
  if (hasCondition('highTemp')) {
    push('ENV-002', { key: 'envHighTemp', status: 'warn', formula: '—', noteKey: 'envHighTemp' }, 'rule-of-thumb', ['environment.conditions']);
  }

  // ─── THR-005 / LGT-008: nhoè chuyển động → phơi sáng → strobe ───
  const speed = num('production.conveyorSpeed');
  if (raw('production.motion') === 'continuous' && speed !== null && speed > 0 && governing !== null) {
    const exposureUs = ((K_BLUR * governing) / speed) * 1e6;
    push(
      'THR-005',
      { key: 'exposureForBlur', status: 'info', formula: `${K_BLUR} × ${fmt(governing, 5)} mm/px ÷ ${fmt(speed)} mm/s = ${fmt(exposureUs, 0)} µs` },
      'calculated',
      ['production.motion', 'production.conveyorSpeed']
    );
    if (exposureUs < STROBE_EXPOSURE_LIMIT_US) {
      push(
        'LGT-008',
        { key: 'strobeRequired', status: 'warn', formula: `${fmt(exposureUs, 0)} µs < ${STROBE_EXPOSURE_LIMIT_US} µs`, noteKey: 'strobeRequired', noteValues: { us: Math.round(exposureUs) } },
        'rule-of-thumb',
        ['production.motion', 'production.conveyorSpeed']
      );
    }
  }

  // ─── THR-001 / THR-002: băng thông, giao tiếp tối thiểu ───
  const ppm = num('production.partsPerMinute') ?? (num('production.taktTime') ? 60 / num('production.taktTime')! : null);
  if (ppm !== null && ppm > 0 && megapixels !== null && cameraCount !== null) {
    const fps = ppm / 60;
    const perCamera = megapixels * BYTES_PER_PX * fps;
    const total = perCamera * cameraCount;
    const throughputPaths = ['production.partsPerMinute', 'production.taktTime', ...sizePaths];
    push(
      'THR-001',
      {
        key: 'dataRate',
        status: 'info',
        formula: `${fmt(megapixels, 2)} MP × ${BYTES_PER_PX} byte × ${fmt(fps, 2)} ảnh/s = ${fmt(perCamera, 1)} MB/s/camera · ×${cameraCount} = ${fmt(total, 1)} MB/s`,
        noteKey: 'dataRateAssumesMono8',
      },
      'calculated',
      throughputPaths
    );
    const choice = Object.entries(INTERFACE_BANDWIDTH)
      .sort((a, b) => a[1] - b[1])
      .find(([, capacity]) => capacity * INTERFACE_MAX_SHARE >= perCamera);
    push(
      'THR-002',
      choice
        ? {
            key: 'interfaceSuggestion',
            status: 'info',
            formula: `${choice[0]}: ${fmt(perCamera, 1)} ÷ ${choice[1]} MB/s = ${Math.round((perCamera / choice[1]) * 100)}% ≤ ${INTERFACE_MAX_SHARE * 100}%`,
          }
        : { key: 'interfaceSuggestion', status: 'fail', formula: `${fmt(perCamera, 1)} MB/s/camera`, noteKey: 'interfaceTooSlow' },
      'calculated',
      throughputPaths,
      choice ? (choice[1] * INTERFACE_MAX_SHARE) / perCamera : null
    );
  }

  // ─── LGT: chiếu sáng — luôn cần chụp mẫu để xác nhận ───
  const surface = raw('object.surface');
  const defectType = req.detection[0]?.defectType.value ?? null;
  const surfaceKey = surface === 'glossy' || surface === 'metallic' ? 'reflective' : surface === 'transparent' ? 'transparent' : null;
  const lighting = suggestLighting({ defectType, surface: surfaceKey });
  if (lighting) {
    const ruleId =
      surfaceKey === 'reflective'
        ? 'LGT-001'
        : surfaceKey === 'transparent' || lighting.reasonKey === 'transparent'
          ? 'LGT-004'
          : lighting.reasonKey === 'profile_hole_burr'
            ? 'LGT-003'
            : lighting.reasonKey === 'scratch' || lighting.reasonKey === 'shallow_dent'
              ? 'LGT-002'
              : 'LGT-001';
    push(
      ruleId,
      {
        key: 'lightingSuggestion',
        status: 'warn',
        formula: lighting.alternativeType ? `${lighting.lightType} / ${lighting.alternativeType}` : lighting.lightType,
        noteKey: `lightingReason.${lighting.reasonKey}`,
      },
      'requires-sample-test',
      ['object.surface', 'detection.0.defectType']
    );
  }
  if (surface === 'black') {
    push('LGT-005', { key: 'blackSurface', status: 'warn', formula: '—', noteKey: 'blackSurfaceLight' }, 'requires-sample-test', ['object.surface']);
  }
  if (raw('object.colorInspection') === true) {
    push('LGT-006', { key: 'colorLighting', status: 'warn', formula: '—', noteKey: 'colorNeedsCri' }, 'requires-sample-test', ['object.colorInspection']);
  }
  if (hasCondition('variableLight')) {
    push('LGT-007', { key: 'ambientLight', status: 'warn', formula: '—', noteKey: 'variableLightStrobe' }, 'rule-of-thumb', ['environment.conditions']);
  }

  // ─── AI-001 / AI-002: truyền thống hay học sâu ───
  if (req.detection.length > 0) {
    const variability = req.detection[0].variability.value;
    const paths = ['detection.0.variability'];
    if (variability === 'high') {
      push('AI-002', { key: 'algorithmChoice', status: 'warn', formula: '—', noteKey: 'dlCandidate' }, 'requires-sample-test', paths);
    } else if (variability === 'low' || variability === 'medium') {
      push('AI-001', { key: 'algorithmChoice', status: 'pass', formula: '—', noteKey: 'traditionalVision' }, 'rule-of-thumb', paths);
    } else {
      push('AI-001', { key: 'algorithmChoice', status: 'warn', formula: '—', noteKey: 'variabilityUnknown' }, 'unknown', paths);
    }
  }

  return {
    results,
    assumptions,
    completeness: completeness(results),
    governingMmPerPx: governing,
    uncertaintyBudgetMm: U,
    tile,
    megapixelsPerCamera: megapixels,
  };
}
