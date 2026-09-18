import {
  COLOR_DEFAULT_PIXEL_FORMAT,
  DEFAULT_PIXEL_FORMAT,
  INTERFACE_BANDWIDTH,
  SENSOR_FORMATS,
  pixelFormatBytes,
  sensorDiagonalMm,
  specNumber,
  specString,
  type Component,
} from '@/lib/components/specs';
import { DEFAULT_CIRCLE_OF_CONFUSION_PX, WAVELENGTH_UM, requiredLpPerMm } from './optics';
import type { RequirementAnalysis } from './requirementAnalysis';
import { toRuleResult, type Evidence, type RuleAssumedInput, type RuleInput, type RuleResult } from './rules';
import { fmt, round, type Check } from './types';

/**
 * Tầng Cấu hình (V1c mục C2, spec V1.1 §4.2–§4.3): luật chỉ chạy được khi đã
 * có MỘT bộ thiết bị cụ thể — camera + ống kính (+ máy tính).
 *
 * Vì sao tách khỏi requirementAnalysis.ts: tiêu cự, nhiễu xạ, độ sâu trường ảnh
 * đều cần pixel pitch của camera và thông số ống kính. Ở bảng Yêu cầu chưa có
 * thiết bị nên không tính được; đoán một camera "điển hình" để tính là tạo số
 * giả. Bộ lọc thiết bị (C3) gọi hàm này cho từng ứng viên; FAIL = loại kèm lý
 * do, MARGINAL = chặn mức Tiết kiệm (C4).
 *
 * Thiếu thông số (thiết bị cũ chưa khai) thì KHÔNG loại (chốt Q4 khi mở V1c):
 * luật trả status 'info' với evidence 'unknown' — "chưa kiểm được".
 *
 * Hàm thuần, không đụng database. Ngưỡng chốt 2026-09-17 là hằng có tên.
 *
 * marginRatio CHỈ cho phép kiểm có biên thật: vùng nhìn / mm/px (OPT-001), độ
 * sâu trường ảnh (OPT-005), thời gian chu kỳ (THR-003). Phép kiểm đạt / không
 * đạt (ngàm, vòng ảnh, lp/mm, F nhỏ nhất, khe / core / RAM / cổng) để null:
 * feasibility.ts chấm tỉ lệ 1,0–1,2 là MARGINAL, nên một ống vòng ảnh vừa khít
 * cảm biến hay máy vừa đủ cổng LAN sẽ bị coi là rủi ro và chặn nhầm mức Tiết
 * kiệm (C4) — phát hiện khi viết test-solutions.ts.
 */

/** OPT-005: F cần tới mức này × F#max thì còn chấp nhận được (mờ nhẹ, phải chụp thử). */
export const DOF_DIFFRACTION_TOLERANCE = 1.5;
/** OPT-005: ống kính chưa khai khẩu mở nhất thì coi mở được tới F/1 (ống machine vision nhanh nhất thường F/0.95–1.4). */
export const DOF_FASTEST_PRACTICAL_F = 1;
/** OPT-002: dung sai so vòng ảnh với đường chéo — số danh nghĩa trên datasheet làm tròn. */
export const IMAGE_CIRCLE_TOLERANCE = 0.02;
/** THR-003: dư dưới tỉ lệ này của nhịp là mỏng. */
export const CYCLE_MIN_MARGIN = 0.3;
/** THR-003: giả định khi chưa đo thuật toán thật. */
export const CYCLE_DEFAULTS = {
  triggerMs: 1,
  ioMs: 10,
  processMs: 300,
  processDeepLearningMs: 800,
  /** Camera không khai fps → giả định một ảnh (phơi sáng + đọc) mất chừng này. */
  frameIntervalMs: 100,
} as const;
/** THR-004: RAM đệm = 4 × ảnh × số camera × số ảnh đệm, tối thiểu 16 GB. */
export const IPC_RAM_MIN_GB = 16;
export const IPC_BUFFER_DEPTH = 10;
/** Chuẩn giao tiếp chạy trên cổng mạng thường — cắm thẳng vào LAN bo mạch được. */
const ETHERNET_INTERFACES = ['GigE', '5GigE', '10GigE'];

// ------------------------------------------------------------ thiết bị --

export type ConfigCamera = {
  cameraType: 'area' | 'line';
  widthPx: number;
  /** Line scan: 1. */
  heightPx: number;
  pixelSizeUm: number | null;
  sensorFormat: string | null;
  mount: string | null;
  interfaceName: string | null;
  maxFps: number | null;
  bytesPerPx: number;
};

export type ConfigLens = {
  lensType: 'fixed' | 'telecentric' | 'macro';
  focalLengthMm: number | null;
  magnification: number | null;
  imageCircleMm: number | null;
  imageCircleFormat: string | null;
  mount: string | null;
  fNumberMin: number | null;
  fNumberMax: number | null;
  resolutionLpMm: number | null;
  wdMinMm: number | null;
  wdMaxMm: number | null;
};

export type ConfigPc = {
  cpuCores: number | null;
  ramGb: number | null;
  pcieSlots: number | null;
  lanPorts: number | null;
  gpu: string | null;
};

export function cameraFromComponent(component: Component): ConfigCamera {
  const spec = component.spec;
  const line = specString(spec, 'camera_type') === 'line';
  const format = specString(spec, 'pixel_format');
  return {
    cameraType: line ? 'line' : 'area',
    widthPx: (line ? specNumber(spec, 'line_width_px') : specNumber(spec, 'resolution_w_px')) ?? 0,
    heightPx: line ? 1 : (specNumber(spec, 'resolution_h_px') ?? 0),
    pixelSizeUm: specNumber(spec, 'pixel_size_um'),
    sensorFormat: specString(spec, 'sensor_format'),
    mount: specString(spec, 'mount'),
    interfaceName: specString(spec, 'interface'),
    maxFps: specNumber(spec, 'max_fps'),
    // Không khai định dạng thì suy từ màu, như bộ chọn cũ (specs.ts).
    bytesPerPx:
      pixelFormatBytes(format ?? (specString(spec, 'color') === 'color' ? COLOR_DEFAULT_PIXEL_FORMAT : DEFAULT_PIXEL_FORMAT)) ?? 1,
  };
}

export function lensFromComponent(component: Component): ConfigLens {
  const spec = component.spec;
  const type = specString(spec, 'lens_type');
  return {
    lensType: type === 'telecentric' || type === 'macro' ? type : 'fixed',
    focalLengthMm: specNumber(spec, 'focal_length_mm'),
    magnification: specNumber(spec, 'magnification'),
    imageCircleMm: specNumber(spec, 'image_circle_mm'),
    imageCircleFormat: specString(spec, 'image_circle'),
    mount: specString(spec, 'mount'),
    fNumberMin: specNumber(spec, 'f_number_min'),
    fNumberMax: specNumber(spec, 'f_number_max'),
    resolutionLpMm: specNumber(spec, 'resolution_lp_mm'),
    wdMinMm: specNumber(spec, 'wd_min_mm'),
    wdMaxMm: specNumber(spec, 'wd_max_mm'),
  };
}

export function pcFromComponent(component: Component): ConfigPc {
  const spec = component.spec;
  return {
    cpuCores: specNumber(spec, 'cpu_cores'),
    ramGb: specNumber(spec, 'ram_gb'),
    pcieSlots: specNumber(spec, 'pcie_slots'),
    lanPorts: specNumber(spec, 'lan_ports'),
    gpu: specString(spec, 'gpu'),
  };
}

// ------------------------------------------------------------ công thức --

/** OPT-004: F#max = 2 × pitch ÷ (2,44 × λ). */
export function maxFNumber(pixelSizeUm: number): number {
  return (2 * pixelSizeUm) / (2.44 * WAVELENGTH_UM);
}

/** Độ phóng đại của ống thường ở khoảng cách làm việc: β = f ÷ (WD − f). */
export function entocentricMagnification(focalLengthMm: number, workingDistanceMm: number): number | null {
  if (!(focalLengthMm > 0) || !(workingDistanceMm > focalLengthMm)) return null;
  return focalLengthMm / (workingDistanceMm - focalLengthMm);
}

/** Tiêu cự cho độ phóng đại β ở khoảng cách WD: f = WD × β ÷ (1 + β). */
export function focalLengthFor(beta: number, workingDistanceMm: number): number {
  return (workingDistanceMm * beta) / (1 + beta);
}

/** F cần để độ sâu trường ảnh đạt DOF: F = DOF × β² ÷ (2 × c × (1 + β)). */
export function fNumberForDepth(depthMm: number, circleOfConfusionMm: number, beta: number): number | null {
  if (!(depthMm > 0) || !(circleOfConfusionMm > 0) || !(beta > 0)) return null;
  return (depthMm * beta ** 2) / (2 * circleOfConfusionMm * (1 + beta));
}

/** Kích thước cảm biến thật (mm) từ số pixel × pitch; null khi thiếu pitch. */
function sensorSizeMm(camera: ConfigCamera): { longMm: number; shortMm: number; diagonalMm: number } | null {
  if (camera.pixelSizeUm === null || !(camera.widthPx > 0)) return null;
  const a = (camera.widthPx * camera.pixelSizeUm) / 1000;
  const b = camera.cameraType === 'line' ? 0 : (camera.heightPx * camera.pixelSizeUm) / 1000;
  return { longMm: Math.max(a, b), shortMm: Math.min(a, b), diagonalMm: Math.hypot(a, b) };
}

// ----------------------------------------------------------------- luật --

export type ConfigurationInput = {
  analysis: RequirementAnalysis;
  camera: ConfigCamera;
  lens?: ConfigLens | null;
  pc?: ConfigPc | null;
  /** Số card giao tiếp cắm vào máy (C3/C5 tính); 0 = camera cắm thẳng cổng bo mạch. */
  interfaceCards?: number;
  /** Thời gian xử lý đo thật (ms/ảnh). Không có thì giả định theo CYCLE_DEFAULTS. */
  processMsPerImage?: number | null;
};

export function evaluateConfiguration(input: ConfigurationInput): RuleResult[] {
  const { analysis, camera, lens = null, pc = null } = input;
  const results: RuleResult[] = [];

  /** Ô bảng Yêu cầu (tách thật / giả định) + thông số thiết bị. */
  const push = (ruleId: string, check: Check, evidence: Evidence, paths: string[], equipment: Record<string, unknown>, marginRatio: number | null = null) => {
    const inputsUsed: RuleInput[] = [];
    const inputsAssumed: RuleAssumedInput[] = [];
    for (const path of paths) {
      const field = analysis.fieldInputs[path];
      if (!field) continue;
      if (field.assumptionId) inputsAssumed.push({ path, value: field.value, assumptionId: field.assumptionId });
      else inputsUsed.push({ path, value: field.value });
    }
    for (const [path, value] of Object.entries(equipment)) {
      if (value !== null && value !== undefined) inputsUsed.push({ path, value });
    }
    results.push(toRuleResult(ruleId, check, { evidence, marginRatio, inputsUsed, inputsAssumed }));
  };

  const pitch = camera.pixelSizeUm;
  const sensor = sensorSizeMm(camera);
  const wd = analysis.workingDistanceMm;
  const tile = analysis.tile;
  const tiltCos = analysis.cameraTiltDeg ? Math.cos((analysis.cameraTiltDeg * Math.PI) / 180) : 1;
  const sizePaths = ['object.sizeX', 'object.sizeY', 'system.cameraCount'];

  // ─── OPT-001: vùng nhìn thực của cặp camera + ống kính ───
  let beta: number | null = null;
  if (lens) {
    const eq = {
      'camera.pixel_size_um': pitch,
      'lens.focal_length_mm': lens.focalLengthMm,
      'lens.magnification': lens.magnification,
      'lens.wd_min_mm': lens.wdMinMm,
      'lens.wd_max_mm': lens.wdMaxMm,
    };
    const paths = ['system.workingDistance', ...sizePaths, 'system.cameraTiltDeg', 'detection.0.minSize', 'measurement.0.tolerance'];
    beta =
      lens.lensType === 'telecentric'
        ? lens.magnification
        : lens.focalLengthMm !== null && wd !== null
          ? entocentricMagnification(lens.focalLengthMm, wd)
          : null;
    const optic = lens.lensType === 'telecentric' ? `${fmt(lens.magnification ?? 0, 3)}×` : `f ${fmt(lens.focalLengthMm ?? 0, 1)} mm`;

    if (lens.lensType !== 'telecentric' && lens.wdMinMm !== null && wd !== null && wd < lens.wdMinMm) {
      push(
        'OPT-001',
        { key: 'lensFov', status: 'fail', formula: `WD ${fmt(wd)} mm < ${fmt(lens.wdMinMm)} mm`, noteKey: 'lensBelowMinFocus', noteValues: { wd, wdMin: lens.wdMinMm } },
        'calculated',
        paths,
        eq
      );
    } else if (
      lens.lensType === 'telecentric' &&
      wd !== null &&
      ((lens.wdMinMm !== null && wd < lens.wdMinMm) || (lens.wdMaxMm !== null && wd > lens.wdMaxMm))
    ) {
      push(
        'OPT-001',
        {
          key: 'lensFov',
          status: 'fail',
          formula: `WD ${fmt(wd)} mm ∉ [${fmt(lens.wdMinMm ?? 0)}; ${fmt(lens.wdMaxMm ?? lens.wdMinMm ?? 0)}] mm`,
          noteKey: 'telecentricWdMismatch',
          noteValues: { wd, wdMin: lens.wdMinMm ?? '—', wdMax: lens.wdMaxMm ?? '—' },
        },
        'calculated',
        paths,
        eq
      );
    } else if (beta === null || !sensor || !tile || analysis.governingMmPerPx === null || pitch === null) {
      push('OPT-001', { key: 'lensFov', status: 'info', formula: optic, noteKey: 'lensFovUnknown' }, 'unknown', paths, eq);
    } else {
      const tileLong = Math.max(tile.widthMm, tile.heightMm);
      const tileShort = Math.min(tile.widthMm, tile.heightMm);
      // Line scan chỉ phủ theo hàng pixel; chiều kia do vật chạy qua.
      const betaCover = camera.cameraType === 'line' ? sensor.longMm / tileLong : Math.min(sensor.longMm / tileLong, sensor.shortMm / tileShort);
      // Nghiêng: cạnh dài cần pixel mịn hơn cos θ (cùng quy ước RES-004).
      const target = analysis.governingMmPerPx * tiltCos;
      const betaResolve = pitch / 1000 / target;
      const fovLong = sensor.longMm / beta;
      const fovShort = sensor.shortMm / beta;
      const actual = pitch / 1000 / beta;
      const fIdeal = wd !== null && lens.lensType !== 'telecentric' ? round(focalLengthFor(betaCover, wd), 1) : null;
      const betaText =
        lens.lensType === 'telecentric'
          ? `β = ${fmt(beta, 4)}`
          : `β = ${fmt(lens.focalLengthMm!, 1)} ÷ (${fmt(wd!)} − ${fmt(lens.focalLengthMm!, 1)}) = ${fmt(beta, 4)}`;
      const formula =
        `${betaText} · FOV ${fmt(fovLong, 1)} × ${fmt(fovShort, 1)} mm vs ${fmt(tileLong, 1)} × ${fmt(tileShort, 1)} mm · ` +
        `${fmt(pitch / 1000, 5)} ÷ ${fmt(beta, 4)} = ${fmt(actual, 5)} mm/px vs ${fmt(target, 5)} mm/px`;

      let check: Check;
      let margin: number | null = null;
      if (betaResolve > betaCover) {
        check = { key: 'lensFov', status: 'fail', formula, noteKey: 'cameraTooFewPixels', noteValues: { target: round(target, 5) } };
      } else if (beta > betaCover * (1 + 1e-9)) {
        check = { key: 'lensFov', status: 'fail', formula, noteKey: 'lensFovTooSmall', noteValues: { optic, fIdeal: fIdeal ?? '—' } };
      } else if (actual > target * (1 + 1e-9)) {
        check = { key: 'lensFov', status: 'fail', formula, noteKey: 'lensTooCoarse', noteValues: { actual: round(actual, 5), target: round(target, 5), fIdeal: fIdeal ?? '—' } };
        margin = target / actual;
      } else {
        check = { key: 'lensFov', status: 'pass', formula, noteKey: fIdeal !== null ? 'lensFovIdeal' : undefined, noteValues: { fIdeal: fIdeal ?? '—' } };
        margin = target / actual;
      }
      push('OPT-001', check, 'calculated', paths, eq, margin);
    }
  }

  // ─── OPT-002: vòng ảnh + ngàm ───
  if (lens) {
    const eq = {
      'camera.sensor_format': camera.sensorFormat,
      'camera.mount': camera.mount,
      'lens.image_circle_mm': lens.imageCircleMm,
      'lens.image_circle': lens.imageCircleFormat,
      'lens.mount': lens.mount,
    };
    // Camera: cỡ danh nghĩa nếu có (cùng quy ước datasheet ống kính), không thì tính từ pixel.
    const cameraDiag = (camera.sensorFormat && SENSOR_FORMATS[camera.sensorFormat] ? sensorDiagonalMm(camera.sensorFormat) : null) ?? sensor?.diagonalMm ?? null;
    const lensDiag = lens.imageCircleMm ?? sensorDiagonalMm(lens.imageCircleFormat);
    const parts: string[] = [];
    let status: Check['status'] = 'pass';
    let noteKey: string | undefined;
    let noteValues: Record<string, string | number> | undefined;
    let unknown = false;

    if (cameraDiag === null || lensDiag === null) {
      unknown = true;
      noteKey = 'lensCircleUnknown';
    } else {
      const covers = lensDiag >= cameraDiag * (1 - IMAGE_CIRCLE_TOLERANCE);
      parts.push(`Ø ${fmt(lensDiag, 2)} mm ${covers ? '≥' : '<'} ${fmt(cameraDiag, 2)} mm`);
      if (!covers) {
        status = 'fail';
        noteKey = 'imageCircleTooSmall';
      }
    }

    if (camera.mount === null || lens.mount === null) {
      unknown = true;
      noteKey ??= 'lensCircleUnknown';
    } else {
      parts.push(`${lens.mount} → ${camera.mount}`);
      if (lens.mount !== camera.mount) {
        // Ống C lên camera CS: thêm vòng đệm 5 mm. Chiều ngược lại (CS lên C) không lấy nét được.
        if (lens.mount === 'C' && camera.mount === 'CS') {
          if (status === 'pass') {
            status = 'warn';
            noteKey = 'mountCsSpacer';
          }
        } else {
          status = 'fail';
          noteKey = 'mountMismatch';
          noteValues = { lens: lens.mount, camera: camera.mount };
        }
      }
    }

    const evidence: Evidence = unknown && status === 'pass' ? 'unknown' : 'calculated';
    push(
      'OPT-002',
      { key: 'lensMount', status: unknown && status === 'pass' ? 'info' : status, formula: parts.join(' · ') || '—', noteKey, noteValues },
      evidence,
      [],
      eq,
      // Phép kiểm đạt / không đạt: không có "biên" (xem BINARY_NOTE ở đầu file).
      null
    );
  }

  // ─── OPT-003: độ phân giải ống kính ───
  if (lens && pitch !== null) {
    const need = requiredLpPerMm(pitch)!;
    const eq = { 'camera.pixel_size_um': pitch, 'lens.resolution_lp_mm': lens.resolutionLpMm };
    if (lens.resolutionLpMm !== null) {
      const ok = lens.resolutionLpMm >= need;
      push(
        'OPT-003',
        {
          key: 'lensResolvingPower',
          status: ok ? 'pass' : 'warn',
          formula: `${fmt(lens.resolutionLpMm)} lp/mm ${ok ? '≥' : '<'} 1000 ÷ (2 × ${fmt(pitch, 2)}) = ${fmt(need, 1)} lp/mm`,
          noteKey: ok ? undefined : 'lensLpTooLow',
          noteValues: { lens: lens.resolutionLpMm, need },
        },
        'calculated',
        [],
        eq,
        null
      );
    } else {
      const small = pitch < 3;
      push(
        'OPT-003',
        {
          key: 'lensResolvingPower',
          status: small ? 'warn' : 'info',
          formula: `1000 ÷ (2 × ${fmt(pitch, 2)}) = ${fmt(need, 1)} lp/mm`,
          noteKey: small ? 'lensLpUnknownSmallPixel' : 'lensLpUnknown',
          noteValues: { pitch, need },
        },
        small ? 'rule-of-thumb' : 'unknown',
        [],
        eq
      );
    }
  }

  // ─── OPT-004: giới hạn nhiễu xạ ───
  const fMax = pitch !== null ? maxFNumber(pitch) : null;
  if (lens && fMax !== null) {
    const eq = { 'camera.pixel_size_um': pitch, 'lens.f_number_min': lens.fNumberMin };
    const base = `F#max = 2 × ${fmt(pitch!, 2)} ÷ (2,44 × ${WAVELENGTH_UM}) = ${fmt(fMax, 2)}`;
    if (lens.fNumberMin !== null) {
      const ok = lens.fNumberMin <= fMax;
      push(
        'OPT-004',
        {
          key: 'diffractionLimit',
          status: ok ? 'pass' : 'fail',
          formula: `${base} · F/${fmt(lens.fNumberMin, 1)} ${ok ? '≤' : '>'} F/${fmt(fMax, 2)}`,
          noteKey: ok ? undefined : 'diffractionLensTooSlow',
          noteValues: { fMin: lens.fNumberMin, fMax: round(fMax, 1) },
        },
        'calculated',
        [],
        eq,
        null
      );
    } else {
      push(
        'OPT-004',
        { key: 'diffractionLimit', status: 'info', formula: base, noteKey: 'diffractionUnknown', noteValues: { fMax: round(fMax, 1) } },
        'unknown',
        [],
        eq
      );
    }
  }

  // ─── OPT-005: độ sâu trường ảnh ↔ nhiễu xạ ───
  const heightVariation = analysis.heightVariationMm;
  if (lens && beta !== null && fMax !== null && pitch !== null && heightVariation !== null) {
    const depth = heightVariation + analysis.tiltDepthMm;
    const c = (DEFAULT_CIRCLE_OF_CONFUSION_PX * pitch) / 1000;
    const fNeed = fNumberForDepth(depth, c, beta);
    if (fNeed !== null) {
      const eq = { 'camera.pixel_size_um': pitch, 'lens.f_number_min': lens.fNumberMin, 'lens.f_number_max': lens.fNumberMax };
      const paths = ['object.heightVariation', 'system.workingDistance', 'system.cameraTiltDeg'];
      const ratio = fNeed / fMax;
      const setF = Math.max(fNeed, lens.fNumberMin ?? 0);
      const depthText = analysis.tiltDepthMm > 0 ? `(${fmt(heightVariation, 2)} + ${fmt(analysis.tiltDepthMm, 1)}) mm` : `${fmt(depth, 2)} mm`;
      const formula = `F = ${depthText} × ${fmt(beta, 4)}² ÷ (2 × ${fmt(c, 5)} × (1 + ${fmt(beta, 4)})) = F/${fmt(fNeed, 1)} vs F#max F/${fmt(fMax, 1)}`;
      const values = { f: round(setF, 1), dof: round(depth, 2), fMax: round(fMax, 1), ratio: round(ratio, 1), fLens: lens.fNumberMax ?? '—' };

      let check: Check;
      let margin: number | null = null;
      // Thứ tự: xung đột với nhiễu xạ trước — không ống nào giải được; rồi mới tới giới hạn khẩu của ống này.
      if (ratio > DOF_DIFFRACTION_TOLERANCE) {
        // Độ sâu do nghiêng lớn hơn Δh → gợi ý Scheimpflug.
        const tiltDominates = analysis.tiltDepthMm > heightVariation;
        check = { key: 'depthOfFieldConflict', status: 'fail', formula, noteKey: tiltDominates ? 'dofConflictTilt' : 'dofConflict', noteValues: values };
        margin = fMax / fNeed;
      } else if (lens.fNumberMax !== null && fNeed > lens.fNumberMax) {
        check = { key: 'depthOfFieldConflict', status: 'fail', formula, noteKey: 'dofBeyondLensAperture', noteValues: values };
      } else if (ratio <= 1) {
        // Đạt nhưng F cần sát F#max (dư < 1,2 — MARGINAL theo feasibility.ts): nói rõ là sát, không nói "đủ".
        // F cần nhỏ hơn khẩu mở nhất của ống (chưa khai thì coi F/1): nói "khẩu nào cũng đủ" chứ
        // không in "F/0.3" — con số không tồn tại trên ống kính thật (phát hiện ở C7).
        const anyAperture = fNeed < (lens.fNumberMin ?? DOF_FASTEST_PRACTICAL_F);
        const noteKey = fMax / fNeed < 1.2 ? 'dofSetApertureTight' : anyAperture ? 'dofAnyAperture' : 'dofSetAperture';
        check = { key: 'depthOfFieldConflict', status: 'pass', formula, noteKey, noteValues: values };
        margin = fMax / fNeed;
      } else {
        check = { key: 'depthOfFieldConflict', status: 'warn', formula, noteKey: 'dofDiffractionTradeoff', noteValues: values };
      }
      push('OPT-005', check, 'calculated', paths, eq, margin);
    }
  }

  // ─── THR-003: ngân sách thời gian chu kỳ ───
  const ppm = analysis.partsPerMinute;
  if (ppm !== null && ppm > 0 && camera.cameraType === 'area') {
    const takt = 60000 / ppm;
    const frameMs = camera.maxFps && camera.maxFps > 0 ? 1000 / camera.maxFps : CYCLE_DEFAULTS.frameIntervalMs;
    const frameMb = (camera.widthPx * camera.heightPx * camera.bytesPerPx) / 1e6;
    const bandwidth = camera.interfaceName ? INTERFACE_BANDWIDTH[camera.interfaceName] : undefined;
    const transferMs = bandwidth ? (frameMb / bandwidth) * 1000 : 0;
    const measured = input.processMsPerImage ?? null;
    const processMs = measured ?? (analysis.usesDeepLearning ? CYCLE_DEFAULTS.processDeepLearningMs : CYCLE_DEFAULTS.processMs);
    const total = CYCLE_DEFAULTS.triggerMs + frameMs + transferMs + processMs + CYCLE_DEFAULTS.ioMs;
    const margin = (takt - total) / takt;
    const status: Check['status'] = margin < 0 ? 'fail' : margin < CYCLE_MIN_MARGIN ? 'warn' : 'pass';
    push(
      'THR-003',
      {
        key: 'cycleTimeBudget',
        status,
        formula:
          `${CYCLE_DEFAULTS.triggerMs} + ${fmt(frameMs, 1)}${camera.maxFps ? '' : '*'} + ${fmt(transferMs, 1)} + ${fmt(processMs, 0)}${measured === null ? '*' : ''} + ${CYCLE_DEFAULTS.ioMs} ` +
          `= ${fmt(total, 0)} ms vs nhịp ${fmt(takt, 0)} ms`,
        noteKey: status === 'fail' ? 'cycleOver' : status === 'warn' ? 'cycleTight' : 'cycleWithin',
        noteValues: { margin: Math.round(margin * 100), process: Math.round(processMs), total: Math.round(total), takt: Math.round(takt) },
      },
      measured === null ? 'rule-of-thumb' : 'calculated',
      ['production.partsPerMinute', 'detection.0.variability'],
      { 'camera.max_fps': camera.maxFps, 'camera.interface': camera.interfaceName, 'process_ms_per_image': measured },
      status === 'pass' ? takt / total : null
    );
  }

  // ─── THR-004: cỡ máy tính ───
  if (pc) {
    const n = Math.max(1, analysis.cameraCount ?? 1);
    const cards = input.interfaceCards ?? 0;
    const frameMb = (camera.widthPx * camera.heightPx * camera.bytesPerPx) / 1e6;
    const eq = (key: string, value: unknown) => ({ [`pc.${key}`]: value, 'system.camera_count': n });
    const paths = ['system.cameraCount'];
    const unknownKeys: string[] = [];

    const slotsNeed = cards + (analysis.usesDeepLearning ? 1 : 0);
    if (slotsNeed > 0) {
      if (pc.pcieSlots === null) unknownKeys.push('pcie_slots');
      else {
        const ok = pc.pcieSlots >= slotsNeed;
        push(
          'THR-004',
          { key: 'ipcPcie', status: ok ? 'pass' : 'fail', formula: `${pc.pcieSlots} ${ok ? '≥' : '<'} ${cards} card${analysis.usesDeepLearning ? ' + 1 GPU' : ''}`, noteKey: ok ? undefined : 'ipcPcieShort', noteValues: { need: slotsNeed, have: pc.pcieSlots } },
          'calculated',
          paths,
          eq('pcie_slots', pc.pcieSlots),
          null
        );
      }
    }

    if (pc.cpuCores === null) unknownKeys.push('cpu_cores');
    else {
      const min = n + 2;
      const rec = 2 * n + 2;
      const status: Check['status'] = pc.cpuCores < min ? 'fail' : pc.cpuCores < rec ? 'warn' : 'pass';
      push(
        'THR-004',
        {
          key: 'ipcCores',
          status,
          formula: `${pc.cpuCores} core · tối thiểu ${n} + 2 = ${min} · khuyên dùng 2 × ${n} + 2 = ${rec}`,
          noteKey: status === 'fail' ? 'ipcCoresShort' : status === 'warn' ? 'ipcCoresTight' : undefined,
          noteValues: { min, rec, n, have: pc.cpuCores },
        },
        'rule-of-thumb',
        paths,
        eq('cpu_cores', pc.cpuCores),
        null
      );
    }

    if (pc.ramGb === null) unknownKeys.push('ram_gb');
    else {
      const need = Math.max(IPC_RAM_MIN_GB, Math.ceil((4 * frameMb * n * IPC_BUFFER_DEPTH) / 1024));
      const ok = pc.ramGb >= need;
      push(
        'THR-004',
        {
          key: 'ipcRam',
          status: ok ? 'pass' : 'fail',
          formula: `${pc.ramGb} GB ${ok ? '≥' : '<'} max(${IPC_RAM_MIN_GB}, 4 × ${fmt(frameMb, 1)} MB × ${n} × ${IPC_BUFFER_DEPTH}) = ${need} GB`,
          noteKey: ok ? undefined : 'ipcRamShort',
          noteValues: { need, have: pc.ramGb },
        },
        'rule-of-thumb',
        paths,
        eq('ram_gb', pc.ramGb),
        null
      );
    }

    if (cards === 0 && camera.interfaceName !== null && ETHERNET_INTERFACES.includes(camera.interfaceName)) {
      if (pc.lanPorts === null) unknownKeys.push('lan_ports');
      else {
        const need = n + 1;
        const ok = pc.lanPorts >= need;
        push(
          'THR-004',
          { key: 'ipcLan', status: ok ? 'pass' : 'fail', formula: `${pc.lanPorts} ${ok ? '≥' : '<'} ${n} + 1 = ${need} cổng`, noteKey: ok ? undefined : 'ipcLanShort', noteValues: { need, n, have: pc.lanPorts } },
          'calculated',
          paths,
          eq('lan_ports', pc.lanPorts),
          null
        );
      }
    }

    if (analysis.usesDeepLearning && pc.gpu === null) {
      push('THR-004', { key: 'ipcGpu', status: 'warn', formula: '—', noteKey: 'ipcGpuMissing' }, 'rule-of-thumb', ['detection.0.variability'], eq('gpu', null));
    }

    if (unknownKeys.length > 0) {
      push(
        'THR-004',
        { key: 'ipcUnknown', status: 'info', formula: unknownKeys.join(', '), noteKey: 'ipcSpecsIncomplete' },
        'unknown',
        paths,
        { 'pc.missing': unknownKeys.join(', ') }
      );
    }
  }

  return results;
}

/** Luật FAIL — lý do loại cấu hình (C3). */
export const blockingResults = (results: readonly RuleResult[]) => results.filter((result) => result.status === 'fail');

/** Luật "chưa kiểm được" vì thiết bị thiếu thông số — gắn cờ, không loại (chốt Q4). */
export const uncheckedResults = (results: readonly RuleResult[]) => results.filter((result) => result.evidence === 'unknown');
