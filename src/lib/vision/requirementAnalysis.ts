import { resolveAssumptions } from '@/lib/requirement/assumptions';
import { fieldsFor, readField } from '@/lib/requirement/fields';
import type { Assumption, DefectContrast, Requirement } from '@/lib/requirement/types';
import { lightingRuleId, suggestLighting } from './lighting';
import { DEFAULT_ENGINE_TABLES, type EngineTables } from './engineTables';
import { DEFAULT_ENGINE_PARAMS, type EngineParams, interfaceBandwidthFor, pxPerDefectFor } from './engineParams';
import { perspectiveCheck, perspectiveErrorMm, telecentricCheck } from './optics';
import { stitchCheck, thermalCheck, thermalErrorUm } from './mechanics';
import { GRR_DIVISOR, K_SUBPIXEL, measurementBudget } from './resolution';
import { completeness, toRuleResult, type Evidence, type RuleAssumedInput, type RuleInput, type RuleResult } from './rules';
import { cameraTile, type CameraTile } from './tiling';
import { fmt, round, type Check } from './types';
import { term } from './formulaTerms';

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
 * Luật cần thiết bị cụ thể (tiêu cự, vòng ảnh, nhiễu xạ, DOF, chu kỳ, IPC) chạy
 * ở tầng Cấu hình — configurationRules.ts, với từng bộ camera + ống kính + IPC.
 * Ở đây chúng không có mặt, nhóm Integration để trống — đánh giá khả thi coi là
 * CHƯA BIẾT, không coi là đạt.
 */

/** THR-005: nhoè cho phép = k_blur × mm/px (spec cho 0,3…1, mặc định 0,5). Mặc định — sửa qua admin (engineParams). */
export const K_BLUR = DEFAULT_ENGINE_PARAMS.blurPxAllowed;
/** LGT-008: thời gian phơi sáng tối đa dưới mức này thì bắt buộc strobe + global shutter. Mặc định — sửa qua admin. */
export const STROBE_EXPOSURE_LIMIT_US = DEFAULT_ENGINE_PARAMS.strobeExposureLimitUs;
/** THR-002: dùng quá tỉ lệ này băng thông giao tiếp là mỏng biên. */
export const INTERFACE_MAX_SHARE = DEFAULT_ENGINE_PARAMS.interfaceMaxShare;
/** THR-001: ảnh đơn sắc 8 bit (Bayer 8 bit cũng 1 byte/px) khi chưa chọn camera. */
export const BYTES_PER_PX = 1;
/** Tên chuẩn giao tiếp — danh từ riêng, giống nhau mọi ngôn ngữ. */
export const RESULT_INTERFACE_LABEL: Readonly<Record<string, string>> = {
  digitalIO: 'Digital I/O',
  ethernetIP: 'EtherNet/IP',
  profinet: 'PROFINET',
  modbus: 'Modbus TCP',
  tcp: 'TCP/IP socket',
};

export type RequirementAnalysis = {
  results: RuleResult[];
  /** Ngưỡng phán đoán đã dùng (sửa qua admin) — các tầng sau (Cấu hình, phương án, BOM) đọc từ đây. */
  params: EngineParams;
  /** Bảng chiếu sáng + giả định mặc định đã dùng (engineTables). */
  tables: EngineTables;
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
  /** Số pixel cần trên mỗi trục vùng nhìn một camera (RES-004, đã tính nghiêng) — bộ lọc camera (C3). */
  pixelsPerCamera: { nx: number; ny: number } | null;
  /** Loại đèn engine gợi ý (LGT-001..004) và luật đã gợi ý — bộ lọc đèn (C3). */
  lighting: { ruleId: string; types: string[] } | null;
  /** Cho sơ đồ kiến trúc (architecture.ts). */
  fovWidthMm: number | null;
  fovHeightMm: number | null;
  cameraCount: number | null;
  dataRateTotalMBs: number | null;
  interfaceName: string | null;
  /* Các số tầng Cấu hình (configurationRules.ts) cần — đã qua giả định. */
  workingDistanceMm: number | null;
  heightVariationMm: number | null;
  /** Độ; null = nhìn vuông góc. */
  cameraTiltDeg: number | null;
  /** Độ sâu vùng nhìn một camera sinh ra do nghiêng (OPT-009), mm; 0 khi không nghiêng. */
  tiltDepthMm: number;
  partsPerMinute: number | null;
  /** Phơi sáng tối đa để không nhoè (THR-005), µs; null khi sản phẩm không chạy liên tục. */
  exposureMaxUs: number | null;
  /** Số ảnh mỗi sản phẩm (ô thật hoặc giả định 1). */
  imagesPerPart: number;
  /** THR-006: số ảnh/giây mỗi camera cần = ảnh/sản phẩm × ppm ÷ 60; null khi chưa có sản lượng. */
  framesPerSecondNeeded: number | null;
  /** Tốc độ băng tải khi sản phẩm chạy liên tục (mm/s), null nếu không — THR-008. */
  conveyorSpeedMmS: number | null;
  /** Camera → điểm gạt (mm) và thời gian cơ cấu gạt (ms) — THR-008. */
  rejectDistanceMm: number | null;
  rejectActuationMs: number | null;
  /** AI-002 đã bật: biến động lỗi lớn, ứng viên học sâu. */
  usesDeepLearning: boolean;
  /**
   * Mọi ô có giá trị (sau giả định), tách thật / giả định — để luật tầng Cấu
   * hình ghi inputsUsed / inputsAssumed mà không phải chạy lại giả định.
   */
  fieldInputs: Record<string, { value: unknown; assumptionId?: string }>;
};

const CONTRASTS: readonly DefectContrast[] = ['high', 'medium', 'low', 'unknown'];
const isContrast = (value: unknown): value is DefectContrast => CONTRASTS.includes(value as DefectContrast);

export function analyseRequirement(
  draft: Requirement,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
  tables: EngineTables = DEFAULT_ENGINE_TABLES
): RequirementAnalysis {
  const { requirement: req, assumptions } = resolveAssumptions(draft, params, tables);
  const pxPerDefect = pxPerDefectFor(params);
  const bandwidthTable = interfaceBandwidthFor(params);
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
    const n = pxPerDefect[contrast];
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
  /* OPT-009: camera nghiêng θ thì trên vật, một pixel theo chiều nghiêng dài ra
     1/cos θ. Chưa biết nghiêng theo cạnh nào → tính cho CẠNH DÀI của vùng nhìn
     (cạnh cần nhiều pixel hơn — phía xấu). Nghiêng một chiều nên chỉ nhân một
     trục, không bình phương. */
  const tilt = num('system.cameraTiltDeg');
  const tiltCos = tilt !== null && tilt > 0 ? Math.cos((tilt * Math.PI) / 180) : 1;
  const sizePaths = ['object.sizeX', 'object.sizeY', 'system.cameraCount'];
  let tile: CameraTile | null = null;
  let megapixels: number | null = null;
  let pixels: { nx: number; ny: number } | null = null;
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
      tile = cameraTile({
        fovWidthMm: fovW,
        fovHeightMm: fovH,
        cameraCount,
        mmPerPx: governing,
        overlapRatio: params.tileOverlapRatio,
        overlapMinPx: params.tileOverlapMinPx,
      });
      if (tile) {
        if (cameraCount > 1) {
          push(
            'RES-005',
            {
              key: 'cameraTiling',
              status: 'info',
              formula:
                `${term('grid')} ${tile.grid.cols}×${tile.grid.rows} · ${term('perCamera')} ${fmt(tile.widthMm, 1)} × ${fmt(tile.heightMm, 1)} mm ` +
                `(${term('overlap')} ${fmt(tile.overlapXMm, 1)} / ${fmt(tile.overlapYMm, 1)} mm)`,
            },
            'calculated',
            sizePaths
          );
        }
        const tiltOnWidth = tile.widthMm >= tile.heightMm;
        const pitchX = governing * (tiltOnWidth ? tiltCos : 1);
        const pitchY = governing * (tiltOnWidth ? 1 : tiltCos);
        const nx = Math.ceil(tile.widthMm / pitchX);
        const ny = Math.ceil(tile.heightMm / pitchY);
        megapixels = (nx * ny) / 1e6;
        pixels = { nx, ny };
        const tiltPart = (onThisAxis: boolean) => (tiltCos < 1 && onThisAxis ? ` × cos ${fmt(tilt!, 1)}°` : '');
        push(
          'RES-004',
          {
            key: 'megapixelsPerCamera',
            status: 'info',
            formula: `${fmt(tile.widthMm, 1)} ÷ (${fmt(governing, 5)}${tiltPart(tiltOnWidth)}) = ${nx} px × ${fmt(tile.heightMm, 1)} ÷ (${fmt(governing, 5)}${tiltPart(!tiltOnWidth)}) = ${ny} px → ${fmt(megapixels, 2)} MP/camera`,
          },
          'calculated',
          [...sizePaths, 'detection.0.minSize', 'measurement.0.tolerance', ...(tiltCos < 1 ? ['system.cameraTiltDeg'] : [])]
        );
      }
    }
  }

  // ─── OPT-009: camera nghiêng ───
  let tiltDepth = 0;
  if (tilt !== null && tilt > 0) {
    const along = tile ? Math.max(tile.widthMm, tile.heightMm) : fovW !== null && fovH !== null ? Math.max(fovW, fovH) : null;
    const sin = Math.sin((tilt * Math.PI) / 180);
    tiltDepth = along !== null ? along * sin : 0;
    const factor = 1 / tiltCos;
    // Phát hiện lỗi: đã bù vào số pixel ở RES-004, chỉ ghi nhận. Đo lường: tỉ lệ
    // mm/px đổi dọc theo ảnh — phải hiệu chuẩn phối cảnh, không đo thẳng được.
    push(
      'OPT-009',
      {
        key: 'cameraTilt',
        status: U !== null ? 'warn' : 'info',
        formula:
          `1 ÷ cos ${fmt(tilt, 1)}° = ${fmt(factor, 3)}` +
          (along !== null ? ` · ${fmt(along, 1)} mm × sin ${fmt(tilt, 1)}° = ${fmt(tiltDepth, 1)} mm` : ''),
        noteKey: U !== null ? 'cameraTiltMeasurement' : 'cameraTiltDetection',
        noteValues: { factor: round(factor, 3), depth: round(tiltDepth, 1) },
      },
      'calculated',
      ['system.cameraTiltDeg', ...sizePaths]
    );
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
    warnShare: params.errorWarnShare,
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
    practicalMaxMm: params.telecentricPracticalMaxMm,
    feasibleMaxMm: params.telecentricFeasibleMaxMm,
    frontDiameterFactor: params.telecentricFrontDiameterFactor,
    overlapRatio: params.tileOverlapRatio,
  });
  if (telecentric && tile) {
    const size = Math.max(tile.widthMm, tile.heightMm);
    const limit = telecentric.status === 'fail' ? params.telecentricFeasibleMaxMm : params.telecentricPracticalMaxMm;
    push('OPT-007', telecentric, 'rule-of-thumb', opticsPaths, limit / size);
  }

  // ─── MEC-001 / MEC-003: nhiệt, ghép ảnh ───
  const alpha = num('object.thermalExpansionCoeff');
  const span = num('measurement.0.spanLength');
  const deltaT = num('environment.ambientTempRange');
  const thermalPaths = ['object.thermalExpansionCoeff', 'object.material', 'measurement.0.spanLength', 'environment.ambientTempRange', 'measurement.0.tolerance'];
  const thermal = thermalCheck({ alphaUmPerMK: alpha, lengthMm: span, deltaTK: deltaT, uncertaintyBudgetMm: U, warnShare: params.errorWarnShare });
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
    warnShare: params.errorWarnShare,
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
  const continuous = raw('production.motion') === 'continuous' && speed !== null && speed > 0;
  const kBlur = params.blurPxAllowed;
  const exposureMaxUs = continuous && governing !== null ? ((kBlur * governing) / speed!) * 1e6 : null;
  if (exposureMaxUs !== null) {
    push(
      'THR-005',
      { key: 'exposureForBlur', status: 'info', formula: `${kBlur} × ${fmt(governing!, 5)} mm/px ÷ ${fmt(speed!)} mm/s = ${fmt(exposureMaxUs, 0)} µs` },
      'calculated',
      ['production.motion', 'production.conveyorSpeed']
    );
    if (exposureMaxUs < params.strobeExposureLimitUs) {
      push(
        'LGT-008',
        {
          key: 'strobeRequired',
          status: 'warn',
          formula: `${fmt(exposureMaxUs, 0)} µs < ${params.strobeExposureLimitUs} µs`,
          noteKey: 'strobeRequired',
          noteValues: { us: Math.round(exposureMaxUs) },
        },
        'rule-of-thumb',
        ['production.motion', 'production.conveyorSpeed']
      );
    }
  }

  // ─── THR-006: số ảnh/giây mỗi camera cần (so với fps camera ở bộ lọc thiết bị) ───
  const ppm = num('production.partsPerMinute') ?? (num('production.taktTime') ? 60 / num('production.taktTime')! : null);
  const imagesPerPart = Math.max(1, num('production.imagesPerPart') ?? 1);
  const fpsNeeded = ppm !== null && ppm > 0 ? (imagesPerPart * ppm) / 60 : null;
  const ratePaths = ['production.partsPerMinute', 'production.taktTime', 'production.imagesPerPart'];
  if (fpsNeeded !== null) {
    push(
      'THR-006',
      {
        key: 'frameRateNeeded',
        status: 'info',
        formula: `${imagesPerPart} × ${fmt(ppm!, 1)} ÷ 60 = ${fmt(fpsNeeded, 2)} ${term('framesPerSecond')}`,
        noteKey: 'frameRateNeeded',
        noteValues: { fps: round(fpsNeeded, 2), n: imagesPerPart },
      },
      'calculated',
      ratePaths
    );
  }

  // ─── THR-007: lệch vị trí chụp do sai lệch thời điểm trigger ───
  if (continuous) {
    const source = raw('production.triggerSource');
    const paths = ['production.motion', 'production.conveyorSpeed', 'production.triggerSource', 'production.triggerJitterMs'];
    const jitterMs = num('production.triggerJitterMs');
    if (source === 'encoder') {
      push('THR-007', { key: 'triggerShift', status: 'pass', formula: 'encoder', noteKey: 'triggerEncoder' }, 'rule-of-thumb', paths);
    } else if (jitterMs !== null) {
      const shiftMm = (speed! * jitterMs) / 1000;
      const shortSide = tile ? Math.min(tile.widthMm, tile.heightMm) : fovW !== null && fovH !== null ? Math.min(fovW, fovH) : null;
      const share = shortSide ? shiftMm / shortSide : null;
      const px = governing !== null ? shiftMm / governing : null;
      const over = share !== null && share > params.triggerShiftMaxShare;
      push(
        'THR-007',
        {
          key: 'triggerShift',
          status: over ? 'warn' : 'pass',
          formula:
            `${fmt(speed!)} mm/s × ${fmt(jitterMs, 3)} ms = ±${fmt(shiftMm, 3)} mm` +
            (px !== null ? ` = ${fmt(px, 1)} px` : '') +
            (share !== null ? ` · ${fmt(share * 100, 1)}% ${over ? '>' : '≤'} ${fmt(params.triggerShiftMaxShare * 100, 1)}%` : ''),
          noteKey: over ? 'triggerShiftHigh' : 'triggerShiftOk',
          noteValues: { shift: round(shiftMm, 3), margin: round(2 * shiftMm, 2), px: px !== null ? round(px, 1) : '—' },
        },
        'calculated',
        paths,
        share !== null && share > 0 ? params.triggerShiftMaxShare / share : null
      );
    }
  }

  // ─── LGT-024: đèn có đủ sáng ở thời gian phơi ngắn không ───
  if (exposureMaxUs !== null) {
    const sampleMs = num('production.sampleExposureMs');
    const sampleField = readField(req, 'production.sampleExposureMs');
    const stated = sampleField?.confidence === 'stated';
    if (sampleMs !== null && sampleMs > 0) {
      const boost = (sampleMs * 1000) / exposureMaxUs;
      const duty = fpsNeeded !== null ? exposureMaxUs * 1e-6 * fpsNeeded : null;
      const paths = ['production.sampleExposureMs', 'production.conveyorSpeed', ...ratePaths];
      // Duty rất nhỏ (xung µs, vài ảnh/giây) làm tròn ra "0" — ghi "< 0.01" cho khỏi hiểu nhầm là không chớp.
      const dutyText = duty === null ? '—' : duty * 100 < 0.01 ? '< 0.01' : fmt(duty * 100, 2);
      const values = { boost: round(boost, 1), us: Math.round(exposureMaxUs), duty: dutyText, maxBoost: params.strobeBoostMax, maxDuty: round(params.strobeMaxDuty * 100, 1) };
      const formula =
        `${fmt(sampleMs * 1000, 0)} µs ÷ ${fmt(exposureMaxUs, 0)} µs = ×${fmt(boost, 1)}` +
        (duty !== null ? ` · duty ${fmt(exposureMaxUs, 0)} µs × ${fmt(fpsNeeded!, 2)} ${term('framesPerSecond')} = ${dutyText}%` : '');
      let check: Check;
      let margin: number | null = null;
      if (boost <= 1) {
        check = { key: 'lightBudget', status: 'pass', formula, noteKey: 'lightContinuousOk', noteValues: values };
        margin = 1 / boost;
      } else if (duty !== null && duty > params.strobeMaxDuty) {
        check = { key: 'lightBudget', status: 'fail', formula, noteKey: 'lightDutyTooHigh', noteValues: values };
        margin = params.strobeMaxDuty / duty;
      } else if (boost > params.strobeBoostMax) {
        // Số phơi lúc chụp mẫu là số THẬT → kết luận được; còn ước tính thì chỉ cảnh báo.
        check = { key: 'lightBudget', status: stated ? 'fail' : 'warn', formula, noteKey: 'lightBoostTooHigh', noteValues: values };
        margin = params.strobeBoostMax / boost;
      } else {
        check = { key: 'lightBudget', status: 'warn', formula, noteKey: 'lightNeedsOverdrive', noteValues: values };
        margin = params.strobeBoostMax / boost;
      }
      push('LGT-024', check, stated ? 'rule-of-thumb' : 'requires-sample-test', paths, margin);
    }
  }

  // ─── THR-001 / THR-002: băng thông, giao tiếp tối thiểu ───
  let dataRateTotal: number | null = null;
  let interfaceName: string | null = null;
  if (fpsNeeded !== null && megapixels !== null && cameraCount !== null) {
    const fps = fpsNeeded;
    const perCamera = megapixels * BYTES_PER_PX * fps;
    const total = perCamera * cameraCount;
    dataRateTotal = total;
    const throughputPaths = [...ratePaths, ...sizePaths];
    push(
      'THR-001',
      {
        key: 'dataRate',
        status: 'info',
        formula: `${fmt(megapixels, 2)} MP × ${BYTES_PER_PX} byte × ${fmt(fps, 2)} ${term('framesPerSecond')} = ${fmt(perCamera, 1)} MB/s/camera · ×${cameraCount} = ${fmt(total, 1)} MB/s`,
        noteKey: 'dataRateAssumesMono8',
      },
      'calculated',
      throughputPaths
    );
    const maxShare = params.interfaceMaxShare;
    const choice = Object.entries(bandwidthTable)
      .sort((a, b) => a[1] - b[1])
      .find(([, capacity]) => capacity * maxShare >= perCamera);
    interfaceName = choice ? choice[0] : null;
    push(
      'THR-002',
      choice
        ? {
            key: 'interfaceSuggestion',
            status: 'info',
            formula: `${choice[0]}: ${fmt(perCamera, 1)} ÷ ${choice[1]} MB/s = ${Math.round((perCamera / choice[1]) * 100)}% ≤ ${Math.round(maxShare * 100)}%`,
          }
        : { key: 'interfaceSuggestion', status: 'fail', formula: `${fmt(perCamera, 1)} MB/s/camera`, noteKey: 'interfaceTooSlow' },
      'calculated',
      throughputPaths,
      choice ? (choice[1] * maxShare) / perCamera : null
    );
  }

  // ─── LGT: chiếu sáng — luôn cần chụp mẫu để xác nhận ───
  const surface = raw('object.surface');
  const defectType = req.detection[0]?.defectType.value ?? null;
  const surfaceKey = surface === 'glossy' || surface === 'metallic' ? 'reflective' : surface === 'transparent' ? 'transparent' : null;
  const lighting = suggestLighting({ defectType, surface: surfaceKey }, tables.lighting);
  let lightingOut: RequirementAnalysis['lighting'] = null;
  if (lighting) {
    const ruleId = lightingRuleId(surfaceKey, lighting);
    lightingOut = { ruleId, types: lighting.alternativeType ? [lighting.lightType, lighting.alternativeType] : [lighting.lightType] };
    push(
      ruleId,
      {
        key: 'lightingSuggestion',
        status: 'warn',
        formula: lighting.alternativeType ? `${lighting.lightType} / ${lighting.alternativeType}` : lighting.lightType,
        // Câu lý do admin nhập (bảng chiếu sáng) đi qua khoá 'custom' — messages chỉ chèn lại nguyên văn.
        ...(lighting.customReason
          ? { noteKey: 'lightingReason.custom', noteValues: { textVi: lighting.customReason.vi, textEn: lighting.customReason.en } }
          : { noteKey: `lightingReason.${lighting.reasonKey}` }),
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

  /* ─── INT-001: giao tiếp trả kết quả (chốt 2026-10-12: chỉ hiển thị) ───
     Chưa chọn thì KHÔNG đẩy kết quả nào: nhóm Tích hợp hiện "chưa đánh giá" và điểm khả
     thi không tụt — thiếu giao tiếp ở giai đoạn concept không phải rủi ro kỹ thuật. Đã
     chọn thì ghi nhận, kèm nhắc THR-003 đang giả định IO bao nhiêu ms. */
  const resultInterface = raw('integration.resultInterface');
  const interfaces = Array.isArray(resultInterface) ? resultInterface.filter((v): v is string => typeof v === 'string') : [];
  if (interfaces.length > 0) {
    push(
      'INT-001',
      {
        key: 'resultInterface',
        status: 'info',
        formula: interfaces.map((v) => RESULT_INTERFACE_LABEL[v] ?? v).join(' · '),
        noteKey: 'intResultInterface',
        noteValues: { ioMs: params.cycleIoMs },
      },
      'rule-of-thumb',
      ['integration.resultInterface']
    );
  }

  return {
    results,
    params,
    tables,
    assumptions,
    completeness: completeness(results),
    governingMmPerPx: governing,
    uncertaintyBudgetMm: U,
    tile,
    megapixelsPerCamera: megapixels,
    pixelsPerCamera: pixels,
    lighting: lightingOut,
    fovWidthMm: fovW,
    fovHeightMm: fovH,
    cameraCount,
    dataRateTotalMBs: dataRateTotal,
    interfaceName,
    workingDistanceMm: workingDistance,
    heightVariationMm: heightVariation,
    cameraTiltDeg: tilt !== null && tilt > 0 ? tilt : null,
    tiltDepthMm: tiltDepth,
    partsPerMinute: ppm,
    exposureMaxUs,
    imagesPerPart,
    framesPerSecondNeeded: fpsNeeded,
    conveyorSpeedMmS: continuous ? speed : null,
    rejectDistanceMm: continuous ? num('production.rejectDistance') : null,
    rejectActuationMs: continuous ? num('production.rejectActuationMs') : null,
    usesDeepLearning: results.some((result) => result.ruleId === 'AI-002'),
    fieldInputs: Object.fromEntries(
      fieldsFor(req.applicationType).flatMap((def) => {
        const { inputsUsed, inputsAssumed } = inputs([def.path]);
        return [...inputsUsed, ...inputsAssumed].map((input) => [input.path, input]);
      })
    ),
  };
}
