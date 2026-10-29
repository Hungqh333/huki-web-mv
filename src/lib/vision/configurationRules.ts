import {
  COLOR_DEFAULT_PIXEL_FORMAT,
  DEFAULT_PIXEL_FORMAT,
  SENSOR_FORMATS,
  cameraLanes,
  linkBandwidth,
  pixelFormatBytes,
  sensorDiagonalMm,
  specNumber,
  specString,
  type Component,
} from '@/lib/components/specs';
import { DEFAULT_CIRCLE_OF_CONFUSION_PX, WAVELENGTH_UM, requiredLpPerMm } from './optics';
import { DEFAULT_ENGINE_PARAMS, interfaceBandwidthFor } from './engineParams';
import { term } from './formulaTerms';
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

/** OPT-005: F cần tới mức này × F#max thì còn chấp nhận được (mờ nhẹ, phải chụp thử). Mặc định — sửa qua admin (engineParams). */
export const DOF_DIFFRACTION_TOLERANCE = DEFAULT_ENGINE_PARAMS.dofDiffractionTolerance;
/** OPT-005: ống kính chưa khai khẩu mở nhất thì coi mở được tới F/1 (ống machine vision nhanh nhất thường F/0.95–1.4). */
export const DOF_FASTEST_PRACTICAL_F = 1;
/** OPT-002: dung sai so vòng ảnh với đường chéo — số danh nghĩa trên datasheet làm tròn. */
export const IMAGE_CIRCLE_TOLERANCE = DEFAULT_ENGINE_PARAMS.imageCircleTolerance;
/** THR-003: dư dưới tỉ lệ này của nhịp là mỏng. Mặc định — sửa qua admin (engineParams). */
export const CYCLE_MIN_MARGIN = DEFAULT_ENGINE_PARAMS.cycleMinMargin;
/** THR-003: giả định khi chưa đo thuật toán thật. */
export const CYCLE_DEFAULTS = {
  // Trigger / IO là MẶC ĐỊNH; THR-003/008 đọc giá trị đang dùng từ analysis.params (2026-10-26).
  triggerMs: DEFAULT_ENGINE_PARAMS.cycleTriggerMs,
  ioMs: DEFAULT_ENGINE_PARAMS.cycleIoMs,
  // Hai số xử lý là MẶC ĐỊNH; THR-003 đọc giá trị đang dùng từ analysis.params (sửa qua admin).
  processMs: DEFAULT_ENGINE_PARAMS.processMs,
  processDeepLearningMs: DEFAULT_ENGINE_PARAMS.processDeepLearningMs,
  /** Camera không khai fps → giả định một ảnh (phơi sáng + đọc) mất chừng này. */
  frameIntervalMs: 100,
} as const;
/** THR-004: RAM đệm = 4 × ảnh × số camera × số ảnh đệm, tối thiểu 16 GB. */
export const IPC_RAM_MIN_GB = DEFAULT_ENGINE_PARAMS.ipcRamMinGb;
export const IPC_BUFFER_DEPTH = DEFAULT_ENGINE_PARAMS.ipcBufferDepth;
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
  /** Số làn CoaXPress (specs.ts `cameraLanes`). Không khai = 1. */
  lanes?: number;
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
  /** sF: mặt trước ống → tiêu điểm trước (mm, có thể âm); chưa khai → 0 (chốt 2026-10-26). */
  frontFocalMm?: number | null;
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
    lanes: cameraLanes(spec),
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
    frontFocalMm: specNumber(spec, 'front_focal_mm'),
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

/** OPT-004: F#max = 2 × pitch ÷ (2,44 × λ) — F# HIỆU DỤNG phía cảm biến. */
export function maxFNumber(pixelSizeUm: number): number {
  return (2 * pixelSizeUm) / (2.44 * WAVELENGTH_UM);
}

/*
 * F# hiệu dụng (chốt 2026-10-17, F2): ống thường ghi F# đo ở vô cực; lấy nét gần
 * thì ảnh lùi ra xa, chùm tia hẹp lại và nhiễu xạ tính theo N × (1 + β). Vùng nhìn
 * lớn (β < 0,1) gần như không đổi; chụp cận β 0,5 thì đĩa Airy to thêm 50%.
 * Đổi giới hạn về số ghi trên vòng khẩu: F#max ÷ (1 + β).
 *
 * Ống telecentric: datasheet ghi sẵn "working F/#" (đã là F# hiệu dụng) → hệ số 1.
 * Chưa biết β (thiếu tiêu cự hoặc WD) → hệ số 1, như trước khi sửa.
 */
export function effectiveFNumberFactor(beta: number | null, lensType: string | null): number {
  if (lensType === 'telecentric' || beta === null || !(beta > 0)) return 1;
  return 1 + beta;
}

/** F#max trên vòng khẩu ống thường ở độ phóng đại β: 2 × pitch ÷ (2,44 × λ) ÷ (1 + β). */
export function maxRingFNumber(pixelSizeUm: number, beta: number | null, lensType: string | null = null): number {
  return maxFNumber(pixelSizeUm) / effectiveFNumberFactor(beta, lensType);
}

/**
 * OPT-001 telecentric — chốt 2026-10-29 (Q2). Kho thường chỉ ghi MỘT WD danh định (min = max), trong
 * khi ống vẫn nét quanh đó vài mm: trong dải hãng ghi → đạt; lệch ≤ ±tolerance (tỉ lệ) ngoài dải →
 * cảnh báo (đặt đúng WD danh định khi lắp); xa hơn → loại. Dùng chung Chọn ống kính + Thiết kế hệ thống.
 */
export function telecentricWdVerdict(wdMm: number, minMm: number | null, maxMm: number | null, tolerance: number): 'pass' | 'warn' | 'fail' | null {
  if (minMm === null && maxMm === null) return null;
  const lo = minMm ?? maxMm!;
  const hi = maxMm ?? minMm!;
  if (wdMm >= lo - 1e-9 && wdMm <= hi + 1e-9) return 'pass';
  return wdMm >= lo * (1 - tolerance) - 1e-9 && wdMm <= hi * (1 + tolerance) + 1e-9 ? 'warn' : 'fail';
}

/**
 * OPT-004 — chốt 2026-10-29 (Q3): ống thường giữ LOẠI khi F nhỏ nhất > F#max. Telecentric (F# làm
 * việc cố định): vượt nhưng ≤ tolerance × F#max → CẢNH BÁO (giảm tương phản ở chi tiết cỡ pixel,
 * chụp thử), xa hơn → LOẠI.
 */
export function diffractionVerdict(fNumberMin: number, fMax: number, lensType: string | null, tolerance: number): 'pass' | 'warn' | 'fail' {
  if (fNumberMin <= fMax) return 'pass';
  return lensType === 'telecentric' && fNumberMin <= fMax * tolerance + 1e-9 ? 'warn' : 'fail';
}

/**
 * Ngàm ống → ngàm camera (OPT-002). Ống C lên camera CS: thêm vòng đệm 5 mm.
 * Chiều ngược lại (CS lên C) không lấy nét được.
 */
export function mountFit(lensMount: string, cameraMount: string): 'ok' | 'spacer' | 'mismatch' {
  if (lensMount === cameraMount) return 'ok';
  return lensMount === 'C' && cameraMount === 'CS' ? 'spacer' : 'mismatch';
}

/*
 * Độ phóng đại ống thường theo khoảng cách làm việc — chốt 2026-10-26 (Q1–Q6), đối chiếu Edmund
 * Optics, The Imaging Source, Hikrobot, STEMMER, Schneider, Basler. WD đo từ MẶT TRƯỚC ống (như
 * datasheet ghi MOD). Công thức Newton:
 *
 *   β = f ÷ x,   x = khoảng cách vật → tiêu điểm trước = WD − sF
 *
 * sF = mặt trước ống → tiêu điểm trước (Basler ghi "front focal length sF"); ống chưa khai sF → 0
 * ⇒ β = f ÷ WD — đúng công thức nhanh "f = cảm biến × WD ÷ vùng nhìn" của các hãng.
 * Trước 2026-10-26 dùng β = f ÷ (WD − f): coi tiêu điểm trước cách mặt trước đúng f → β lớn hơn
 * thật, vùng nhìn hẹp hơn thật (ống 25 mm ở WD 300 thiếu ~7–12 % so với Hikrobot).
 */
export function entocentricMagnification(focalLengthMm: number, workingDistanceMm: number, frontFocalMm = 0): number | null {
  const x = workingDistanceMm - frontFocalMm;
  if (!(focalLengthMm > 0) || !(x > 0)) return null;
  return focalLengthMm / x;
}

/** Tiêu cự cho độ phóng đại β ở khoảng cách WD: f = β × (WD − sF). */
export function focalLengthFor(beta: number, workingDistanceMm: number, frontFocalMm = 0): number {
  return beta * (workingDistanceMm - frontFocalMm);
}

/** Khoảng cách làm việc để ống f cho độ phóng đại β: WD = f ÷ β + sF. */
export function workingDistanceFor(focalLengthMm: number, beta: number, frontFocalMm = 0): number {
  return focalLengthMm / beta + frontFocalMm;
}

/** sF suy từ một cặp số trên datasheet (WD và β ở WD đó): sF = WD − f ÷ β. */
export function frontFocalFromDatasheet(focalLengthMm: number, workingDistanceMm: number, beta: number): number | null {
  if (!(focalLengthMm > 0) || !(workingDistanceMm > 0) || !(beta > 0)) return null;
  return workingDistanceMm - focalLengthMm / beta;
}

/** F cần để độ sâu trường ảnh đạt DOF: F = DOF × β² ÷ (2 × c × (1 + β)). */
export function fNumberForDepth(depthMm: number, circleOfConfusionMm: number, beta: number): number | null {
  if (!(depthMm > 0) || !(circleOfConfusionMm > 0) || !(beta > 0)) return null;
  return (depthMm * beta ** 2) / (2 * circleOfConfusionMm * (1 + beta));
}

/**
 * F cần trên vòng khẩu để đạt độ sâu DOF. Ống thường: công thức trên (F ghi ở vô cực,
 * (1 + β) đã nằm trong công thức). Telecentric ghi F# làm việc N × (1 + β), nên
 * F làm việc cần = DOF × β² ÷ (2 × c) — chốt F2 2026-10-17, cùng quy ước OPT-004.
 */
export function ringFNumberForDepth(depthMm: number, circleOfConfusionMm: number, beta: number, lensType: string | null): number | null {
  const nominal = fNumberForDepth(depthMm, circleOfConfusionMm, beta);
  if (nominal === null) return null;
  return lensType === 'telecentric' ? nominal * (1 + beta) : nominal;
}

/** Kích thước cảm biến thật (mm) từ số pixel × pitch; null khi thiếu pitch. */
export function sensorSizeMm(camera: ConfigCamera): { longMm: number; shortMm: number; diagonalMm: number } | null {
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
  /**
   * Dừng ngay khi đã có FAIL (2026-10-17): bước lọc chỉ cần biết cặp bị loại, không
   * cần chạy nốt các luật sau. Cặp không FAIL vẫn chạy đủ — kết quả giống hệt.
   * Kho thật 376 camera × 1.115 ống kính: không dừng sớm thì lọc mất 1–8 giây.
   */
  stopOnFail?: boolean;
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
          ? entocentricMagnification(lens.focalLengthMm, wd, lens.frontFocalMm ?? 0)
          : null;
    const optic = lens.lensType === 'telecentric' ? `${fmt(lens.magnification ?? 0, 3)}×` : `f ${fmt(lens.focalLengthMm ?? 0, 1)} mm`;
    const teleWd =
      lens.lensType === 'telecentric' && wd !== null ? telecentricWdVerdict(wd, lens.wdMinMm, lens.wdMaxMm, analysis.params.telecentricWdTolerance) : null;

    if (lens.lensType !== 'telecentric' && lens.wdMinMm !== null && wd !== null && wd < lens.wdMinMm) {
      push(
        'OPT-001',
        { key: 'lensFov', status: 'fail', formula: `WD ${fmt(wd)} mm < ${fmt(lens.wdMinMm)} mm`, noteKey: 'lensBelowMinFocus', noteValues: { wd, wdMin: lens.wdMinMm } },
        'calculated',
        paths,
        eq
      );
    } else if (teleWd === 'fail' && wd !== null) {
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
          : `β = ${fmt(lens.focalLengthMm!, 1)} ÷ (${fmt(wd!)} − ${fmt(lens.frontFocalMm ?? 0, 1)}) = ${fmt(beta, 4)}`;
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
      // Telecentric lệch WD danh định trong dung sai (Q2): đạt vùng nhìn vẫn hạ xuống cảnh báo.
      if (teleWd === 'warn' && check.status === 'pass') {
        check = {
          ...check,
          status: 'warn',
          formula: `WD ${fmt(wd!)} mm ∉ [${fmt(lens.wdMinMm ?? lens.wdMaxMm ?? 0)}; ${fmt(lens.wdMaxMm ?? lens.wdMinMm ?? 0)}] mm (±${fmt(analysis.params.telecentricWdTolerance * 100, 1)} %) · ${formula}`,
          noteKey: 'telecentricWdNear',
          noteValues: { wd: wd!, wdMin: lens.wdMinMm ?? lens.wdMaxMm ?? '—', wdMax: lens.wdMaxMm ?? lens.wdMinMm ?? '—' },
        };
      }
      push('OPT-001', check, 'calculated', paths, eq, margin);
    }
  }

  if (input.stopOnFail && results.some((r) => r.status === 'fail')) return results;

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
      const covers = lensDiag >= cameraDiag * (1 - analysis.params.imageCircleTolerance);
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
      const fit = mountFit(lens.mount, camera.mount);
      if (fit === 'spacer') {
        if (status === 'pass') {
          status = 'warn';
          noteKey = 'mountCsSpacer';
        }
      } else if (fit === 'mismatch') {
        status = 'fail';
        noteKey = 'mountMismatch';
        noteValues = { lens: lens.mount, camera: camera.mount };
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

  if (input.stopOnFail && results.some((r) => r.status === 'fail')) return results;

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

  if (input.stopOnFail && results.some((r) => r.status === 'fail')) return results;

  // ─── OPT-004: giới hạn nhiễu xạ ───
  const fFactor = effectiveFNumberFactor(beta, lens?.lensType ?? null);
  const fMax = pitch !== null ? maxFNumber(pitch) / fFactor : null;
  if (lens && fMax !== null) {
    const eq = { 'camera.pixel_size_um': pitch, 'lens.f_number_min': lens.fNumberMin };
    const base =
      fFactor === 1
        ? `F#max = 2 × ${fmt(pitch!, 2)} ÷ (2,44 × ${WAVELENGTH_UM}) = ${fmt(fMax, 2)}`
        : `F#max = 2 × ${fmt(pitch!, 2)} ÷ (2,44 × ${WAVELENGTH_UM}) ÷ (1 + ${fmt(beta!, 4)}) = ${fmt(fMax, 2)}`;
    if (lens.fNumberMin !== null) {
      const tolerance = analysis.params.telecentricDiffractionTolerance;
      const verdict = diffractionVerdict(lens.fNumberMin, fMax, lens.lensType, tolerance);
      push(
        'OPT-004',
        {
          key: 'diffractionLimit',
          status: verdict,
          formula:
            `${base} · F/${fmt(lens.fNumberMin, 1)} ${verdict === 'pass' ? '≤' : '>'} F/${fmt(fMax, 2)}` +
            (verdict === 'warn' ? ` · ≤ ${fmt(tolerance, 1)} × F/${fmt(fMax, 2)}` : ''),
          noteKey: verdict === 'pass' ? undefined : verdict === 'warn' ? 'diffractionTeleWarn' : 'diffractionLensTooSlow',
          noteValues: { fMin: lens.fNumberMin, fMax: round(fMax, 1), ratio: round(lens.fNumberMin / fMax, 2), limit: tolerance },
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

  if (input.stopOnFail && results.some((r) => r.status === 'fail')) return results;

  // ─── OPT-005: độ sâu trường ảnh ↔ nhiễu xạ ───
  const heightVariation = analysis.heightVariationMm;
  if (lens && beta !== null && fMax !== null && pitch !== null && heightVariation !== null) {
    const depth = heightVariation + analysis.tiltDepthMm;
    const c = (DEFAULT_CIRCLE_OF_CONFUSION_PX * pitch) / 1000;
    const fNeed = ringFNumberForDepth(depth, c, beta, lens.lensType);
    if (fNeed !== null) {
      const eq = { 'camera.pixel_size_um': pitch, 'lens.f_number_min': lens.fNumberMin, 'lens.f_number_max': lens.fNumberMax };
      const paths = ['object.heightVariation', 'system.workingDistance', 'system.cameraTiltDeg'];
      const ratio = fNeed / fMax;
      const setF = Math.max(fNeed, lens.fNumberMin ?? 0);
      const depthText = analysis.tiltDepthMm > 0 ? `(${fmt(heightVariation, 2)} + ${fmt(analysis.tiltDepthMm, 1)}) mm` : `${fmt(depth, 2)} mm`;
      const formula =
        lens.lensType === 'telecentric'
          ? `F = ${depthText} × ${fmt(beta, 4)}² ÷ (2 × ${fmt(c, 5)}) = F/${fmt(fNeed, 1)} vs F#max F/${fmt(fMax, 1)}`
          : `F = ${depthText} × ${fmt(beta, 4)}² ÷ (2 × ${fmt(c, 5)} × (1 + ${fmt(beta, 4)})) = F/${fmt(fNeed, 1)} vs F#max F/${fmt(fMax, 1)}`;
      const values = { f: round(setF, 1), dof: round(depth, 2), fMax: round(fMax, 1), ratio: round(ratio, 1), fLens: lens.fNumberMax ?? '—' };

      let check: Check;
      let margin: number | null = null;
      // Thứ tự: xung đột với nhiễu xạ trước — không ống nào giải được; rồi mới tới giới hạn khẩu của ống này.
      if (ratio > analysis.params.dofDiffractionTolerance) {
        // Độ sâu do nghiêng lớn hơn Δh → gợi ý Scheimpflug.
        const tiltDominates = analysis.tiltDepthMm > heightVariation;
        if (analysis.uncertaintyBudgetMm === null) {
          /* Bài chỉ phát hiện lỗi (không có dung sai đo): mờ ở phần xa mặt nét chưa chắc
             làm mất lỗi — GT-002 thật cần ~F/78 theo công thức mà vẫn chạy đạt. Cảnh báo
             (MARGINAL: chặn mức Tiết kiệm, hiện trong rủi ro), không loại ống. Chốt C9 Q3. */
          check = {
            key: 'depthOfFieldConflict',
            status: 'warn',
            formula,
            noteKey: tiltDominates ? 'dofConflictTiltDetection' : 'dofConflictDetection',
            noteValues: values,
          };
        } else {
          check = { key: 'depthOfFieldConflict', status: 'fail', formula, noteKey: tiltDominates ? 'dofConflictTilt' : 'dofConflict', noteValues: values };
          margin = fMax / fNeed;
        }
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

  if (input.stopOnFail && results.some((r) => r.status === 'fail')) return results;

  // ─── THR-003: thông lượng — khâu chậm nhất so với nhịp (chốt 2026-10-26 Q5) ───
  /* Chụp, truyền, xử lý chạy GỐI nhau (ảnh sau chụp trong lúc ảnh trước đang xử lý), nên
     nhịp chỉ bị chặn bởi khâu chậm nhất, mỗi khâu nhân số ảnh/sản phẩm. Thời gian nối
     tiếp từ lúc chụp tới lúc có kết quả là ĐỘ TRỄ — kiểm riêng ở THR-008. */
  const ppm = analysis.partsPerMinute;
  const p = analysis.params;
  const n = analysis.imagesPerPart;
  const frameMs = camera.maxFps && camera.maxFps > 0 ? 1000 / camera.maxFps : CYCLE_DEFAULTS.frameIntervalMs;
  const frameMb = (camera.widthPx * camera.heightPx * camera.bytesPerPx) / 1e6;
  const bandwidth = linkBandwidth(interfaceBandwidthFor(p), camera.interfaceName, camera.lanes);
  const transferMs = bandwidth ? (frameMb / bandwidth) * 1000 : 0;
  const measured = input.processMsPerImage ?? null;
  const processMs = measured ?? (analysis.usesDeepLearning ? p.processDeepLearningMs : p.processMs);
  const star = (assumed: boolean) => (assumed ? '*' : '');
  if (ppm !== null && ppm > 0 && camera.cameraType === 'area') {
    const takt = 60000 / ppm;
    const bottleneck = n * Math.max(frameMs, transferMs, processMs);
    const margin = (takt - bottleneck) / takt;
    const status: Check['status'] = margin < 0 ? 'fail' : margin < p.cycleMinMargin ? 'warn' : 'pass';
    push(
      'THR-003',
      {
        key: 'cycleTimeBudget',
        status,
        formula:
          `${n} × max(${fmt(frameMs, 1)}${star(!camera.maxFps)}, ${fmt(transferMs, 1)}, ${fmt(processMs, 0)}${star(measured === null)}) ` +
          `= ${fmt(bottleneck, 0)} ms vs ${term('takt')} ${fmt(takt, 0)} ms`,
        noteKey: status === 'fail' ? 'cycleOver' : status === 'warn' ? 'cycleTight' : 'cycleWithin',
        noteValues: {
          margin: Math.round(margin * 100),
          process: Math.round(processMs),
          total: Math.round(bottleneck),
          takt: Math.round(takt),
          min: Math.round(p.cycleMinMargin * 100),
        },
      },
      measured === null ? 'rule-of-thumb' : 'calculated',
      ['production.partsPerMinute', 'production.imagesPerPart', 'detection.0.variability'],
      { 'camera.max_fps': camera.maxFps, 'camera.interface': camera.interfaceName, 'process_ms_per_image': measured },
      status === 'pass' ? takt / bottleneck : null
    );
  }

  // ─── THR-008: độ trễ từ lúc chụp tới khi cơ cấu gạt tác động ≤ thời gian sản phẩm tới điểm gạt ───
  const v = analysis.conveyorSpeedMmS;
  if (v !== null && v > 0 && camera.cameraType === 'area') {
    const rejectPaths = ['production.rejectDistance', 'production.rejectActuationMs', 'production.conveyorSpeed', 'production.imagesPerPart'];
    const distance = analysis.rejectDistanceMm;
    if (distance === null || !(distance > 0)) {
      push('THR-008', { key: 'rejectLatency', status: 'info', formula: '—', noteKey: 'rejectDistanceUnknown' }, 'unknown', rejectPaths, {});
    } else {
      const actuation = analysis.rejectActuationMs ?? 0;
      const worstProcess = n * processMs * p.processWorstFactor;
      const latency = p.cycleTriggerMs + n * frameMs + transferMs + worstProcess + p.cycleIoMs + actuation;
      const budget = (distance / v) * 1000;
      const margin = (budget - latency) / budget;
      const status: Check['status'] = margin < 0 ? 'fail' : margin < p.cycleMinMargin ? 'warn' : 'pass';
      push(
        'THR-008',
        {
          key: 'rejectLatency',
          status,
          formula:
            `${p.cycleTriggerMs} + ${n} × ${fmt(frameMs, 1)}${star(!camera.maxFps)} + ${fmt(transferMs, 1)} + ${n} × ${fmt(processMs, 0)}${star(measured === null)} × ${p.processWorstFactor} + ${p.cycleIoMs} + ${fmt(actuation, 0)} ` +
            `= ${fmt(latency, 0)} ms vs ${fmt(distance)} mm ÷ ${fmt(v)} mm/s = ${fmt(budget, 0)} ms`,
          noteKey: status === 'fail' ? 'rejectTooLate' : status === 'warn' ? 'rejectTight' : 'rejectWithin',
          noteValues: { latency: Math.round(latency), budget: Math.round(budget), margin: Math.round(margin * 100), min: Math.round(p.cycleMinMargin * 100) },
        },
        measured === null ? 'rule-of-thumb' : 'calculated',
        rejectPaths,
        { 'camera.max_fps': camera.maxFps, 'process_ms_per_image': measured },
        status === 'fail' ? null : budget / latency
      );
    }
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
          formula: `${pc.cpuCores} core · ${term('min')} ${n} + 2 = ${min} · ${term('recommended')} 2 × ${n} + 2 = ${rec}`,
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
      const ramMin = analysis.params.ipcRamMinGb;
      const depth = analysis.params.ipcBufferDepth;
      const need = Math.max(ramMin, Math.ceil((4 * frameMb * n * depth) / 1024));
      const ok = pc.ramGb >= need;
      push(
        'THR-004',
        {
          key: 'ipcRam',
          status: ok ? 'pass' : 'fail',
          formula: `${pc.ramGb} GB ${ok ? '≥' : '<'} max(${ramMin}, 4 × ${fmt(frameMb, 1)} MB × ${n} × ${depth}) = ${need} GB`,
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
          { key: 'ipcLan', status: ok ? 'pass' : 'fail', formula: `${pc.lanPorts} ${ok ? '≥' : '<'} ${n} + 1 = ${need} ${term('ports')}`, noteKey: ok ? undefined : 'ipcLanShort', noteValues: { need, n, have: pc.lanPorts } },
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
