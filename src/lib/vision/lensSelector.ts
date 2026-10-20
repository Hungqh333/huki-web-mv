import { SENSOR_FORMATS, sensorDiagonalMm, specNumber, specString, type Component } from '@/lib/components/specs';
import {
  effectiveFNumberFactor,
  entocentricMagnification,
  focalLengthFor,
  lensFromComponent,
  maxRingFNumber,
  mountFit,
  ringFNumberForDepth,
  sensorSizeMm,
  DOF_FASTEST_PRACTICAL_F,
  type ConfigCamera,
  type ConfigLens,
} from './configurationRules';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './engineParams';
import {
  DEFAULT_CIRCLE_OF_CONFUSION_PX,
  TELECENTRIC_FEASIBLE_MAX_MM,
  TELECENTRIC_PRACTICAL_MAX_MM,
  angleOfViewDeg,
  magnificationToFit,
  requiredLpPerMm,
  telecentricFrontDiameterMm,
} from './optics';
import { fmt, round, type Check } from './types';

/**
 * Bộ chọn ống kính (Lens Selector, chốt 2026-10-17).
 *
 * KHÔNG có công thức riêng: mọi phép tính gọi lại hàm của engine (optics.ts,
 * configurationRules.ts) — cùng quy ước với OPT-001…005 của Thiết kế hệ thống,
 * để hai trang không bao giờ ra hai con số khác nhau cho cùng một cặp
 * camera + ống kính.
 *
 * Khác Thiết kế hệ thống ở chỗ: không cần bảng Yêu cầu. Người dùng chỉ nhập vùng
 * nhìn, khoảng cách làm việc, (tuỳ chọn) dải chiều cao và mm/px cần. Không có
 * dung sai đo nên xung đột độ sâu ↔ nhiễu xạ chỉ CẢNH BÁO (như bài phát hiện lỗi,
 * chốt C9 Q3), không loại ống.
 */

/**
 * Ba tab theo họ ống (chốt 2026-10-18, Q2): ống thường công nghiệp (FA, trừ ngàm M12),
 * telecentric, và ống board M12. Tab M12 chỉ lọc theo ngàm — ống quá nhỏ cho cảm
 * biến đã bị phép kiểm vòng ảnh loại, không cần thêm điều kiện cỡ cảm biến.
 */
export type LensKindFilter = 'fixed' | 'telecentric' | 'm12';

export type LensSelectorInput = {
  camera: ConfigCamera;
  fovWidthMm: number;
  fovHeightMm: number;
  /** Telecentric được để trống: khoảng cách lấy theo dải của từng ống. Ống thường bắt buộc. */
  workingDistanceMm: number | null;
  /** Dải chiều cao vật / dao động khoảng cách (mm) — để tính độ sâu trường ảnh. */
  heightVariationMm: number | null;
  /** mm/px cần (tuỳ chọn). Có thì ống cho mm/px thô hơn bị loại. */
  targetMmPerPx: number | null;
  lensKind: LensKindFilter;
};

export type LensParams = Pick<
  EngineParams,
  | 'imageCircleTolerance'
  | 'dofDiffractionTolerance'
  | 'accessoryMacroBetaWarn'
  | 'accessoryLightLossStopsWarn'
  | 'tubeLengthToFocalWarn'
  | 'tubeMaxSegments'
  | 'converterMaxFactor'
>;
type Params = LensParams;

export type LensNeed = {
  sensorLongMm: number;
  sensorShortMm: number;
  /** Đường chéo cảm biến dùng để so vòng ảnh (cỡ danh nghĩa nếu có, không thì tính từ pixel). */
  sensorDiagonalMm: number;
  beta: number;
  betaFormula: string;
  /** Tiêu cự lý tưởng của ống thường ở WD đã nhập (ước lượng thấu kính mỏng); null khi chưa có WD. */
  focalIdealMm: number | null;
  /** Góc nhìn tại WD theo cạnh dài / cạnh ngắn vùng nhìn thật (°); null khi chưa có WD hoặc telecentric. */
  aovLongDeg: number | null;
  aovShortDeg: number | null;
  /** Vùng nhìn thật với β lý tưởng — luôn ≥ vùng nhìn cần trên cả hai trục. */
  fovLongMm: number;
  fovShortMm: number;
  mmPerPx: number | null;
  /** F#max trên vòng khẩu ống thường ở β lý tưởng (nhiễu xạ, F# hiệu dụng). */
  fMaxRing: number | null;
  lpPerMm: number | null;
  /** F cần trên vòng khẩu (ống thường) để đủ độ sâu; null khi không nhập Δh. */
  fNeedDepth: number | null;
  /** Telecentric: đường kính đầu ống cần ≈ 1,3 × cạnh dài vùng nhìn. */
  telecentricFrontMm: number | null;
  telecentricStatus: 'pass' | 'warn' | 'fail' | null;
  /** mm/px với β lý tưởng thô hơn mức cần → camera thiếu pixel, không ống nào cứu được. */
  cameraTooCoarse: boolean;
};

export type LensCheckKey = 'mount' | 'imageCircle' | 'workingDistance' | 'fov' | 'pixel' | 'resolution' | 'diffraction' | 'depth' | 'tube' | 'converter';

export type LensCheck = Check & { key: LensCheckKey };

export type LensCandidate = {
  component: Component;
  lens: ConfigLens;
  beta: number | null;
  fovLongMm: number | null;
  fovShortMm: number | null;
  mmPerPx: number | null;
  /** Tỉ lệ diện tích vật / diện tích vùng nhìn — phần pixel thật sự dùng tới. */
  pixelUse: number | null;
  /** F nên đặt cho độ sâu (trên vòng khẩu), null khi không nhập Δh. */
  fSet: number | null;
  checks: LensCheck[];
  status: Check['status'];
  /** Số phép kiểm chưa kiểm được vì ống chưa khai thông số. */
  unknownCount: number;
  /** Phụ kiện giúp ống này đạt (OPT-010 / OPT-011); null = dùng ống trơn. */
  accessory: LensAccessory | null;
};

// ───────────────────────── PHỤ KIỆN — chốt 2026-10-20 (Q1–Q5) ──────────────────────────
/*
 * OPT-010 ống nối (extension tube): đẩy ống ra xa cảm biến → lấy nét được GẦN hơn MOD.
 *   Thấu kính mỏng: ở cùng WD, β = f ÷ (WD − f) KHÔNG đổi — ống nối chỉ cho TỚI được WD đó.
 *   Ống gốc lấy nét được β ∈ [0; β_MOD], β_MOD = f ÷ (MOD − f). Thêm ống e: β ∈ [e/f; e/f + β_MOD].
 *   ⇒ cần e ∈ [f·(β_WD − β_MOD); f·β_WD].
 * OPT-011 bộ nhân ×k (rear converter): F#, vòng ảnh × k; độ phóng đại × k (vùng nhìn ÷ k);
 *   lp/mm của ống ÷ k; MOD KHÔNG đổi (nhóm thấu kính trước giữ nguyên) — không cứu được MOD.
 * Không ghép hai phụ kiện (Q4), không áp cho telecentric — phá tính telecentric (Q5).
 * Ống có phụ kiện luôn ở mức CẢNH BÁO và xếp sau ống đạt trơn (Q1/Q4).
 */

/** Bộ ống nối C-mount phổ biến — gợi ý khi kho chưa có (đánh dấu "chưa có trong kho"). */
export const STANDARD_TUBE_LENGTHS_MM = [0.5, 1, 2, 5, 10, 20, 40] as const;
/** Hệ số bộ nhân phổ biến cho ngàm C — gợi ý khi kho chưa có. */
export const STANDARD_CONVERTER_FACTORS = [1.4, 1.5, 2] as const;
/** Mức chuẩn chỉ gợi ý cho ngàm có bán sẵn ống nối / bộ nhân phổ thông. */
const STANDARD_ACCESSORY_MOUNTS = ['C', 'CS'];
/** Tìm tổ hợp ống nối tối đa bấy nhiêu khúc (cảnh báo từ tubeMaxSegments trở lên). */
const TUBE_SEARCH_MAX_PIECES = 4;

export type TubeAccessory = {
  kind: 'tube';
  mount: string;
  pieces: { lengthMm: number; component: Component | null }[];
  totalMm: number;
  needMinMm: number;
  needMaxMm: number;
  /** Dải WD lấy nét được sau khi lắp ống. */
  wdMinMm: number;
  wdMaxMm: number;
  inStock: boolean;
};

export type ConverterAccessory = {
  kind: 'converter';
  mount: string;
  factor: number;
  needFactor: number;
  reason: 'pixel' | 'imageCircle';
  component: Component | null;
  inStock: boolean;
};

export type LensAccessory = TubeAccessory | ConverterAccessory;

type LensVariant =
  | { kind: 'tube'; accessory: TubeAccessory; checks: LensCheck[] }
  | { kind: 'converter'; factor: number; accessory: ConverterAccessory; checks: LensCheck[] };

/** Dải chiều dài ống nối cần để ống tiêu cự f (MOD đã biết) lấy nét được ở WD. */
export function tubeLengthRange(focalMm: number, modMm: number, wdMm: number): { minMm: number; maxMm: number; betaWd: number; betaMod: number } | null {
  if (!(focalMm > 0) || !(modMm > focalMm) || !(wdMm > focalMm)) return null;
  const betaWd = focalMm / (wdMm - focalMm);
  const betaMod = focalMm / (modMm - focalMm);
  return { minMm: Math.max(0, focalMm * (betaWd - betaMod)), maxMm: focalMm * betaWd, betaWd, betaMod };
}

/** Dải WD lấy nét được khi lắp ống nối tổng `totalMm`: [f(1 + 1/(e/f + β_MOD)); f(1 + f/e)]. */
export function tubeFocusRange(focalMm: number, modMm: number, totalMm: number): { wdMinMm: number; wdMaxMm: number } {
  const betaMod = focalMm / (modMm - focalMm);
  const lo = totalMm / focalMm;
  return { wdMinMm: focalMm * (1 + 1 / (lo + betaMod)), wdMaxMm: lo > 0 ? focalMm * (1 + 1 / lo) : Infinity };
}

/** Tổ hợp ống nối có tổng ∈ [min; max]: ít khúc nhất, rồi ngắn nhất. Một chiều dài dùng lặp được. */
export function chooseTubeStack<T extends { lengthMm: number }>(stock: readonly T[], minMm: number, maxMm: number, maxPieces = TUBE_SEARCH_MAX_PIECES): T[] | null {
  const unique = [...new Map(stock.filter((t) => t.lengthMm > 0).map((t) => [t.lengthMm, t])).values()].sort((a, b) => a.lengthMm - b.lengthMm);
  const total = (pieces: T[]) => pieces.reduce((sum, t) => sum + t.lengthMm, 0);
  let best: T[] | null = null;
  const walk = (start: number, picked: T[]) => {
    const sum = total(picked);
    if (picked.length > 0 && sum >= minMm - EPS && sum <= maxMm + EPS) {
      if (best === null || picked.length < best.length || (picked.length === best.length && sum < total(best))) best = [...picked];
      return;
    }
    if (picked.length >= maxPieces || sum > maxMm) return;
    for (let i = start; i < unique.length; i++) walk(i, [...picked, unique[i]]);
  };
  walk(0, []);
  return best;
}

/** Số stop mất khi F# hiệu dụng nhân `factor`: 2 × log₂(factor). */
export const stopsLost = (factor: number) => 2 * Math.log2(factor);

function tubeChecks(acc: TubeAccessory, focalMm: number, betaWd: number, params: Params): LensCheck[] {
  const pieces = acc.pieces.length > 1 ? `${acc.pieces.map((p) => fmt(p.lengthMm, 1)).join(' + ')} = ` : '';
  const wdMax = Number.isFinite(acc.wdMaxMm) ? fmt(acc.wdMaxMm, 0) : '∞';
  const checks: LensCheck[] = [
    {
      key: 'tube',
      status: 'warn',
      formula: `e ∈ [${fmt(acc.needMinMm, 1)}; ${fmt(acc.needMaxMm, 1)}] mm → ${pieces}${fmt(acc.totalMm, 1)} mm · WD [${fmt(acc.wdMinMm, 0)}; ${wdMax}] mm`,
      noteKey: 'tubeChosen',
      noteValues: { total: round(acc.totalMm, 1), wdMin: Math.round(acc.wdMinMm), wdMax },
    },
  ];
  if (!acc.inStock) checks.push({ key: 'tube', status: 'info', formula: acc.mount, noteKey: 'accessoryNotInStock', noteValues: { mount: acc.mount } });
  if (betaWd >= params.accessoryMacroBetaWarn) {
    checks.push({ key: 'tube', status: 'warn', formula: `β ${fmt(betaWd, 3)} ≥ ${params.accessoryMacroBetaWarn}`, noteKey: 'tubeMacro', noteValues: { beta: round(betaWd, 3), limit: params.accessoryMacroBetaWarn } });
  }
  const stops = stopsLost(1 + betaWd);
  if (stops >= params.accessoryLightLossStopsWarn) {
    checks.push({ key: 'tube', status: 'warn', formula: `2 × log₂(1 + ${fmt(betaWd, 3)}) = ${fmt(stops, 2)} stop`, noteKey: 'accessoryLight', noteValues: { stops: round(stops, 1), limit: params.accessoryLightLossStopsWarn } });
  }
  if (acc.totalMm > params.tubeLengthToFocalWarn * focalMm) {
    checks.push({ key: 'tube', status: 'warn', formula: `${fmt(acc.totalMm, 1)} mm > ${params.tubeLengthToFocalWarn} × ${fmt(focalMm, 1)} mm`, noteKey: 'tubeLong', noteValues: { total: round(acc.totalMm, 1), ratio: params.tubeLengthToFocalWarn } });
  }
  if (acc.pieces.length > params.tubeMaxSegments) {
    checks.push({ key: 'tube', status: 'warn', formula: `${acc.pieces.length} > ${params.tubeMaxSegments}`, noteKey: 'tubeSegments', noteValues: { n: acc.pieces.length, max: params.tubeMaxSegments } });
  }
  return checks;
}

function converterChecks(acc: ConverterAccessory, base: ConfigLens, params: Params): LensCheck[] {
  const k = acc.factor;
  const f = base.focalLengthMm ?? 0;
  const fMin = base.fNumberMin;
  const checks: LensCheck[] = [
    {
      key: 'converter',
      status: 'warn',
      formula:
        `k ≥ ${fmt(acc.needFactor, 2)} → ${fmt(k, 2)}× · f ${fmt(f, 1)} → ${fmt(f * k, 1)} mm` +
        (fMin !== null ? ` · F/${fmt(fMin, 1)} → F/${fmt(fMin * k, 1)}` : ''),
      noteKey: acc.reason === 'pixel' ? 'converterForPixel' : 'converterForCircle',
      noteValues: { k, mod: base.wdMinMm ?? '—' },
    },
  ];
  if (!acc.inStock) checks.push({ key: 'converter', status: 'info', formula: acc.mount, noteKey: 'accessoryNotInStock', noteValues: { mount: acc.mount } });
  const stops = stopsLost(k);
  if (stops >= params.accessoryLightLossStopsWarn) {
    checks.push({ key: 'converter', status: 'warn', formula: `2 × log₂(${fmt(k, 2)}) = ${fmt(stops, 2)} stop`, noteKey: 'accessoryLight', noteValues: { stops: round(stops, 1), limit: params.accessoryLightLossStopsWarn } });
  }
  checks.push({ key: 'converter', status: 'info', formula: '—', noteKey: 'converterFit' });
  return checks;
}

/** Ống sau khi lắp bộ nhân ×k: F#, vòng ảnh × k; lp/mm ÷ k. Tiêu cự gốc giữ để tính β (× k ở evaluateLens). */
function convertLens(base: ConfigLens, k: number): ConfigLens {
  const circle = base.imageCircleMm ?? sensorDiagonalMm(base.imageCircleFormat);
  return {
    ...base,
    fNumberMin: base.fNumberMin !== null ? base.fNumberMin * k : null,
    fNumberMax: base.fNumberMax !== null ? base.fNumberMax * k : null,
    imageCircleMm: circle !== null ? circle * k : null,
    imageCircleFormat: null,
    resolutionLpMm: base.resolutionLpMm !== null ? base.resolutionLpMm / k : null,
  };
}

const EPS = 1e-9;

/** Kích thước cảm biến: từ pixel × pitch; camera nhập tay chưa có pitch thì lấy cỡ danh nghĩa. */
export function cameraSensorMm(camera: ConfigCamera): { longMm: number; shortMm: number; diagonalMm: number } | null {
  return sensorOf(camera);
}

function sensorOf(camera: ConfigCamera) {
  const measured = sensorSizeMm(camera);
  if (measured) return measured;
  const nominal = camera.sensorFormat ? SENSOR_FORMATS[camera.sensorFormat] : undefined;
  if (!nominal) return null;
  const long = Math.max(nominal.widthMm, nominal.heightMm);
  const short = camera.cameraType === 'line' ? 0 : Math.min(nominal.widthMm, nominal.heightMm);
  return { longMm: long, shortMm: short, diagonalMm: Math.hypot(long, short) };
}

/** Đường chéo cảm biến để so vòng ảnh — đúng quy ước OPT-002. */
function cameraDiagonal(camera: ConfigCamera, measuredDiagonal: number): number {
  return (camera.sensorFormat && SENSOR_FORMATS[camera.sensorFormat] ? sensorDiagonalMm(camera.sensorFormat) : null) ?? measuredDiagonal;
}

export function lensNeed(input: LensSelectorInput): LensNeed | null {
  const { camera, workingDistanceMm: wd } = input;
  if (!(input.fovWidthMm > 0) || !(input.fovHeightMm > 0)) return null;
  if (wd !== null && !(wd > 0)) return null;
  if (wd === null && input.lensKind !== 'telecentric') return null;
  const sensor = sensorOf(camera);
  if (!sensor) return null;
  const line = camera.cameraType === 'line';
  const fit = magnificationToFit({
    sensorWidthMm: sensor.longMm,
    sensorHeightMm: sensor.shortMm,
    fovWidthMm: input.fovWidthMm,
    fovHeightMm: input.fovHeightMm,
    lineScan: line,
  });
  if (!fit) return null;
  const beta = fit.beta;
  const pitch = camera.pixelSizeUm;
  const mmPerPx = pitch !== null ? pitch / 1000 / beta : null;
  const c = pitch !== null ? (DEFAULT_CIRCLE_OF_CONFUSION_PX * pitch) / 1000 : null;
  const fovLong = Math.max(input.fovWidthMm, input.fovHeightMm);

  const tele = input.lensKind === 'telecentric';
  const front = tele ? telecentricFrontDiameterMm(line ? input.fovWidthMm : fovLong) : null;
  const teleSide = line ? input.fovWidthMm : fovLong;
  const actualLong = sensor.longMm / beta;
  const actualShort = sensor.shortMm / beta;
  // Telecentric nhìn song song — góc nhìn ≈ 0, không hiện.
  const aov = (fov: number) => (wd === null || tele ? null : angleOfViewDeg(fov, wd));
  const aovLong = aov(actualLong);
  const aovShort = line ? null : aov(actualShort);

  return {
    sensorLongMm: round(sensor.longMm, 3),
    sensorShortMm: round(sensor.shortMm, 3),
    sensorDiagonalMm: round(cameraDiagonal(camera, sensor.diagonalMm), 3),
    beta: round(beta, 5),
    betaFormula: fit.formula,
    focalIdealMm: wd !== null && !tele ? round(focalLengthFor(beta, wd), 2) : null,
    aovLongDeg: aovLong !== null ? round(aovLong, 2) : null,
    aovShortDeg: aovShort !== null ? round(aovShort, 2) : null,
    fovLongMm: round(actualLong, 1),
    fovShortMm: round(actualShort, 1),
    mmPerPx: mmPerPx !== null ? round(mmPerPx, 5) : null,
    fMaxRing: pitch !== null ? round(maxRingFNumber(pitch, beta, tele ? 'telecentric' : null), 2) : null,
    lpPerMm: pitch !== null ? requiredLpPerMm(pitch) : null,
    fNeedDepth:
      input.heightVariationMm !== null && input.heightVariationMm > 0 && c !== null
        ? round(ringFNumberForDepth(input.heightVariationMm, c, beta, tele ? 'telecentric' : 'fixed')!, 2)
        : null,
    telecentricFrontMm: front,
    telecentricStatus:
      front === null ? null : teleSide <= TELECENTRIC_PRACTICAL_MAX_MM ? 'pass' : teleSide <= TELECENTRIC_FEASIBLE_MAX_MM ? 'warn' : 'fail',
    cameraTooCoarse: mmPerPx !== null && input.targetMmPerPx !== null && mmPerPx > input.targetMmPerPx * (1 + EPS),
  };
}

const matchesKind = (lens: ConfigLens, kind: LensKindFilter) => {
  if (kind === 'telecentric') return lens.lensType === 'telecentric';
  if (lens.lensType === 'telecentric') return false;
  return kind === 'm12' ? lens.mount === 'M12' : lens.mount !== 'M12';
};

/** Một ống trong kho trên camera + bài toán đã nhập. */
export function evaluateLens(
  input: LensSelectorInput,
  need: LensNeed,
  component: Component,
  params: Params = DEFAULT_ENGINE_PARAMS,
  variant: LensVariant | null = null
): LensCandidate {
  const baseLens = lensFromComponent(component);
  const lens = variant?.kind === 'converter' ? convertLens(baseLens, variant.factor) : baseLens;
  const { camera, workingDistanceMm: wd } = input;
  const pitch = camera.pixelSizeUm;
  const line = camera.cameraType === 'line';
  const checks: LensCheck[] = [];
  let unknownCount = 0;
  const unknown = (key: LensCheckKey, formula: string, noteKey: string, noteValues?: Check['noteValues']) => {
    unknownCount++;
    checks.push({ key, status: 'info', formula, noteKey, noteValues });
  };

  // ── Ngàm (OPT-002) ──
  if (lens.mount === null || camera.mount === null) unknown('mount', '—', 'mountUnknown');
  else {
    const fitMount = mountFit(lens.mount, camera.mount);
    checks.push({
      key: 'mount',
      status: fitMount === 'ok' ? 'pass' : fitMount === 'spacer' ? 'warn' : 'fail',
      formula: `${lens.mount} → ${camera.mount}`,
      noteKey: fitMount === 'spacer' ? 'mountCsSpacer' : fitMount === 'mismatch' ? 'mountMismatch' : undefined,
      noteValues: { lens: lens.mount, camera: camera.mount },
    });
  }

  // ── Vòng ảnh (OPT-002) ──
  const lensDiag = lens.imageCircleMm ?? sensorDiagonalMm(lens.imageCircleFormat);
  if (lensDiag === null) unknown('imageCircle', '—', 'imageCircleUnknown');
  else {
    const covers = lensDiag >= need.sensorDiagonalMm * (1 - params.imageCircleTolerance);
    checks.push({
      key: 'imageCircle',
      status: covers ? 'pass' : 'fail',
      formula: `Ø ${fmt(lensDiag, 2)} mm ${covers ? '≥' : '<'} ${fmt(need.sensorDiagonalMm, 2)} mm`,
      noteKey: covers ? undefined : 'imageCircleTooSmall',
    });
  }

  // ── Khoảng cách làm việc + độ phóng đại thật (OPT-001) ──
  let beta: number | null = null;
  const fixedMagnification = lens.lensType === 'telecentric' || (lens.focalLengthMm === null && lens.magnification !== null);
  if (fixedMagnification) {
    beta = lens.magnification;
    if (lens.wdMinMm === null && lens.wdMaxMm === null) unknown('workingDistance', wd === null ? '—' : `WD ${fmt(wd)} mm`, 'wdRangeUnknown');
    else if (wd === null) {
      // Chưa chốt khoảng cách: không phải lỗi — khoảng cách lấy theo ống, chỉ hiện dải để bố trí cơ khí.
      const min = lens.wdMinMm ?? lens.wdMaxMm!;
      const max = lens.wdMaxMm ?? lens.wdMinMm!;
      checks.push({ key: 'workingDistance', status: 'info', formula: `WD [${fmt(min)}; ${fmt(max)}] mm`, noteKey: 'wdFromLens', noteValues: { min, max } });
    } else {
      const min = lens.wdMinMm ?? lens.wdMaxMm!;
      const max = lens.wdMaxMm ?? lens.wdMinMm!;
      // Telecentric chỉ nét quanh WD danh định — ngoài dải hãng ghi là không dùng được.
      const ok = wd >= min - EPS && wd <= max + EPS;
      checks.push({
        key: 'workingDistance',
        status: ok ? 'pass' : 'fail',
        formula: `WD ${fmt(wd)} mm ${ok ? '∈' : '∉'} [${fmt(min)}; ${fmt(max)}] mm`,
        noteKey: ok ? undefined : 'wdOutOfRange',
        noteValues: { min, max },
      });
    }
  } else if (lens.focalLengthMm !== null && wd === null) {
    unknown('workingDistance', '—', 'wdMissing');
  } else if (lens.focalLengthMm !== null && wd !== null) {
    beta = entocentricMagnification(lens.focalLengthMm, wd);
    // Bộ nhân ×k: độ phóng đại cả hệ = k × β của ống gốc ở cùng WD (OPT-011).
    if (beta !== null && variant?.kind === 'converter') beta *= variant.factor;
    if (beta === null) {
      checks.push({ key: 'workingDistance', status: 'fail', formula: `WD ${fmt(wd)} mm ≤ f ${fmt(lens.focalLengthMm, 1)} mm`, noteKey: 'wdBelowFocal' });
    } else if (variant?.kind === 'tube') {
      // Ống nối: WD nằm trong dải lấy nét mới (OPT-010) — MOD gốc không còn là giới hạn.
      const acc = variant.accessory;
      checks.push({
        key: 'workingDistance',
        status: 'pass',
        formula: `WD ${fmt(wd)} mm ∈ [${fmt(acc.wdMinMm, 0)}; ${Number.isFinite(acc.wdMaxMm) ? fmt(acc.wdMaxMm, 0) : '∞'}] mm`,
        noteKey: 'wdWithTube',
        noteValues: { total: round(acc.totalMm, 1) },
      });
    } else if (lens.wdMinMm !== null) {
      const ok = wd >= lens.wdMinMm - EPS;
      checks.push({
        key: 'workingDistance',
        status: ok ? 'pass' : 'fail',
        formula: `WD ${fmt(wd)} mm ${ok ? '≥' : '<'} MOD ${fmt(lens.wdMinMm)} mm`,
        noteKey: ok ? undefined : 'wdBelowMod',
        noteValues: { mod: lens.wdMinMm },
      });
    } else unknown('workingDistance', `WD ${fmt(wd)} mm`, 'modUnknown');
  } else unknown('fov', '—', 'focalUnknown');

  let fovLong: number | null = null;
  let fovShort: number | null = null;
  let mmPerPx: number | null = null;
  let pixelUse: number | null = null;
  if (beta !== null && beta > 0) {
    fovLong = need.sensorLongMm / beta;
    fovShort = need.sensorShortMm / beta;
    const needLong = line ? input.fovWidthMm : Math.max(input.fovWidthMm, input.fovHeightMm);
    const needShort = Math.min(input.fovWidthMm, input.fovHeightMm);
    const covers = fovLong >= needLong * (1 - EPS) && (line || fovShort >= needShort * (1 - EPS));
    const optic = fixedMagnification
      ? `β ${fmt(beta, 4)}×`
      : `β = ${variant?.kind === 'converter' ? `${fmt(variant.factor, 2)} × ` : ''}${fmt(lens.focalLengthMm!, 1)} ÷ (${fmt(wd!)} − ${fmt(lens.focalLengthMm!, 1)}) = ${fmt(beta, 4)}`;
    checks.push({
      key: 'fov',
      status: covers ? 'pass' : 'fail',
      formula: line
        ? `${optic} · ${fmt(fovLong, 1)} mm ${covers ? '≥' : '<'} ${fmt(needLong, 1)} mm`
        : `${optic} · ${fmt(fovLong, 1)} × ${fmt(fovShort, 1)} mm ${covers ? '⊇' : '⊉'} ${fmt(needLong, 1)} × ${fmt(needShort, 1)} mm`,
      noteKey: covers ? undefined : 'fovTooSmall',
    });
    if (covers && !line) pixelUse = (needLong * needShort) / (fovLong * fovShort);
    if (covers && line) pixelUse = needLong / fovLong;

    if (pitch !== null) {
      mmPerPx = pitch / 1000 / beta;
      if (input.targetMmPerPx !== null) {
        const ok = mmPerPx <= input.targetMmPerPx * (1 + EPS);
        checks.push({
          key: 'pixel',
          status: ok ? 'pass' : 'fail',
          formula: `${fmt(pitch / 1000, 5)} ÷ ${fmt(beta, 4)} = ${fmt(mmPerPx, 4)} mm/px ${ok ? '≤' : '>'} ${fmt(input.targetMmPerPx, 4)}`,
          noteKey: ok ? undefined : 'pixelTooCoarse',
        });
      }
    }
  }

  // ── Độ phân giải ống (OPT-003) ──
  if (need.lpPerMm !== null) {
    if (lens.resolutionLpMm !== null) {
      const ok = lens.resolutionLpMm >= need.lpPerMm;
      checks.push({
        key: 'resolution',
        status: ok ? 'pass' : 'warn',
        formula: `${fmt(lens.resolutionLpMm)} lp/mm ${ok ? '≥' : '<'} ${fmt(need.lpPerMm, 1)} lp/mm`,
        noteKey: ok ? undefined : 'lensLpTooLow',
      });
    } else if (pitch !== null && pitch < 3) {
      checks.push({ key: 'resolution', status: 'warn', formula: `${fmt(need.lpPerMm, 1)} lp/mm`, noteKey: 'lpUnknownSmallPixel' });
    } else unknown('resolution', `${fmt(need.lpPerMm, 1)} lp/mm`, 'lpUnknown');
  }

  // ── Nhiễu xạ (OPT-004), F# hiệu dụng ──
  let fMaxRing: number | null = null;
  if (pitch !== null) {
    fMaxRing = maxRingFNumber(pitch, beta, lens.lensType);
    const factor = effectiveFNumberFactor(beta, lens.lensType);
    const base = factor === 1 ? `F#max ${fmt(fMaxRing, 2)}` : `F#max ${fmt(fMaxRing * factor, 2)} ÷ (1 + ${fmt(beta!, 4)}) = ${fmt(fMaxRing, 2)}`;
    if (lens.fNumberMin !== null) {
      const ok = lens.fNumberMin <= fMaxRing;
      checks.push({
        key: 'diffraction',
        status: ok ? 'pass' : 'fail',
        formula: `${base} · F/${fmt(lens.fNumberMin, 1)} ${ok ? '≤' : '>'} F/${fmt(fMaxRing, 2)}`,
        noteKey: ok ? undefined : 'diffractionLensTooSlow',
        noteValues: { fMin: lens.fNumberMin, fMax: round(fMaxRing, 1) },
      });
    } else unknown('diffraction', base, 'apertureUnknown', { fMax: round(fMaxRing, 1) });
  }

  // ── Độ sâu trường ảnh ↔ nhiễu xạ (OPT-005) ──
  let fSet: number | null = null;
  if (input.heightVariationMm !== null && input.heightVariationMm > 0 && beta !== null && pitch !== null && fMaxRing !== null) {
    const c = (DEFAULT_CIRCLE_OF_CONFUSION_PX * pitch) / 1000;
    const fNeed = ringFNumberForDepth(input.heightVariationMm, c, beta, lens.lensType)!;
    const ratio = fNeed / fMaxRing;
    fSet = round(Math.max(fNeed, lens.fNumberMin ?? DOF_FASTEST_PRACTICAL_F), 1);
    const formula = `Δh ${fmt(input.heightVariationMm, 2)} mm → F/${fmt(fNeed, 1)} vs F#max F/${fmt(fMaxRing, 1)}`;
    const values = { f: fSet, fMax: round(fMaxRing, 1), ratio: round(ratio, 1), fLens: lens.fNumberMax ?? '—' };
    if (ratio > params.dofDiffractionTolerance) {
      checks.push({ key: 'depth', status: 'warn', formula, noteKey: 'dofConflict', noteValues: values });
    } else if (lens.fNumberMax !== null && fNeed > lens.fNumberMax) {
      checks.push({ key: 'depth', status: 'fail', formula, noteKey: 'dofBeyondLensAperture', noteValues: values });
    } else if (ratio > 1) {
      checks.push({ key: 'depth', status: 'warn', formula, noteKey: 'dofTradeoff', noteValues: values });
    } else {
      checks.push({ key: 'depth', status: 'pass', formula, noteKey: 'dofSetAperture', noteValues: values });
    }
  }

  if (variant) checks.push(...variant.checks);

  const judged = checks.filter((c) => c.status !== 'info').map((c) => c.status);
  // Ống chưa khai đủ để biết vùng nhìn thì không được xếp "đạt" chỉ nhờ ngàm khớp.
  if (beta === null && !judged.includes('fail')) judged.length = 0;
  return {
    component,
    lens,
    beta: beta !== null ? round(beta, 5) : null,
    fovLongMm: fovLong !== null ? round(fovLong, 1) : null,
    fovShortMm: fovShort !== null ? round(fovShort, 1) : null,
    mmPerPx: mmPerPx !== null ? round(mmPerPx, 5) : null,
    pixelUse: pixelUse !== null ? round(pixelUse, 3) : null,
    fSet,
    checks,
    status: judged.length === 0 ? 'info' : judged.includes('fail') ? 'fail' : judged.includes('warn') || variant ? 'warn' : 'pass',
    unknownCount,
    accessory: variant?.accessory ?? null,
  };
}

type AccessoryStock = {
  tubes: { lengthMm: number; mount: string | null; component: Component | null }[];
  converters: { factor: number; mount: string | null; maxFormat: string | null; component: Component | null }[];
};

function accessoryStock(catalog: readonly Component[]): AccessoryStock {
  return {
    tubes: catalog
      .filter((c) => c.kind === 'tube')
      .map((c) => ({ lengthMm: specNumber(c.spec, 'length_mm') ?? 0, mount: specString(c.spec, 'mount'), component: c }))
      .filter((t) => t.lengthMm > 0),
    converters: catalog
      .filter((c) => c.kind === 'converter')
      .map((c) => ({ factor: specNumber(c.spec, 'factor') ?? 0, mount: specString(c.spec, 'mount'), maxFormat: specString(c.spec, 'max_format'), component: c }))
      .filter((c) => c.factor > 1),
  };
}

/**
 * Ống bị LOẠI: thử ống nối (chỉ khi loại DUY NHẤT vì MOD) hoặc bộ nhân (chỉ khi loại vì
 * pixel thô / vòng ảnh nhỏ). Chạy lại toàn bộ phép kiểm với phụ kiện; còn LOẠI thì bỏ.
 */
function tryAccessory(input: LensSelectorInput, need: LensNeed, component: Component, base: LensCandidate, params: Params, stock: AccessoryStock): LensCandidate | null {
  const lens = base.lens;
  const wd = input.workingDistanceMm;
  const f = lens.focalLengthMm;
  if (base.status !== 'fail' || lens.lensType === 'telecentric' || f === null || wd === null || lens.mount === null) return null;
  const mount = lens.mount;
  const fails = base.checks.filter((c) => c.status === 'fail').map((c) => c.noteKey);

  // ── OPT-010: ống nối ──
  if (fails.length > 0 && fails.every((key) => key === 'wdBelowMod') && lens.wdMinMm !== null) {
    const range = tubeLengthRange(f, lens.wdMinMm, wd);
    if (!range) return null;
    let pieces = chooseTubeStack(stock.tubes.filter((t) => t.mount === mount), range.minMm, range.maxMm);
    let inStock = true;
    if (!pieces) {
      if (!STANDARD_ACCESSORY_MOUNTS.includes(mount)) return null;
      pieces = chooseTubeStack(STANDARD_TUBE_LENGTHS_MM.map((lengthMm) => ({ lengthMm, mount, component: null })), range.minMm, range.maxMm);
      inStock = false;
    }
    if (!pieces) return null;
    const totalMm = pieces.reduce((sum, p) => sum + p.lengthMm, 0);
    const focus = tubeFocusRange(f, lens.wdMinMm, totalMm);
    const accessory: TubeAccessory = {
      kind: 'tube',
      mount,
      pieces: pieces.map((p) => ({ lengthMm: p.lengthMm, component: p.component })),
      totalMm,
      needMinMm: range.minMm,
      needMaxMm: range.maxMm,
      wdMinMm: focus.wdMinMm,
      wdMaxMm: focus.wdMaxMm,
      inStock,
    };
    const result = evaluateLens(input, need, component, params, { kind: 'tube', accessory, checks: tubeChecks(accessory, f, range.betaWd, params) });
    return result.status === 'fail' ? null : result;
  }

  // ── OPT-011: bộ nhân ──
  if (fails.length > 0 && fails.every((key) => key === 'pixelTooCoarse' || key === 'imageCircleTooSmall')) {
    const needs: { factor: number; reason: ConverterAccessory['reason'] }[] = [];
    if (fails.includes('pixelTooCoarse') && base.mmPerPx !== null && input.targetMmPerPx !== null) {
      needs.push({ factor: base.mmPerPx / input.targetMmPerPx, reason: 'pixel' });
    }
    if (fails.includes('imageCircleTooSmall')) {
      const circle = lens.imageCircleMm ?? sensorDiagonalMm(lens.imageCircleFormat);
      if (circle === null || !(circle > 0)) return null;
      needs.push({ factor: (need.sensorDiagonalMm * (1 - params.imageCircleTolerance)) / circle, reason: 'imageCircle' });
    }
    if (needs.length === 0) return null;
    const driving = needs.reduce((a, b) => (b.factor > a.factor ? b : a));
    if (driving.factor > params.converterMaxFactor + EPS) return null;
    const sensorDiag = need.sensorDiagonalMm;
    const fitsFormat = (format: string | null) => format === null || (sensorDiagonalMm(format) ?? Infinity) >= sensorDiag * (1 - params.imageCircleTolerance);
    const usable = stock.converters
      .filter((c) => c.mount === mount && c.factor >= driving.factor - EPS && c.factor <= params.converterMaxFactor + EPS && fitsFormat(c.maxFormat))
      .sort((a, b) => a.factor - b.factor);
    let pick: { factor: number; component: Component | null } | null = usable[0] ?? null;
    let inStock = pick !== null;
    if (!pick && STANDARD_ACCESSORY_MOUNTS.includes(mount)) {
      const factor = STANDARD_CONVERTER_FACTORS.find((k) => k >= driving.factor - EPS && k <= params.converterMaxFactor + EPS);
      pick = factor !== undefined ? { factor, component: null } : null;
      inStock = false;
    }
    if (!pick) return null;
    const accessory: ConverterAccessory = { kind: 'converter', mount, factor: pick.factor, needFactor: driving.factor, reason: driving.reason, component: pick.component, inStock };
    const result = evaluateLens(input, need, component, params, { kind: 'converter', factor: pick.factor, accessory, checks: converterChecks(accessory, lens, params) });
    return result.status === 'fail' ? null : result;
  }
  return null;
}

/** Thứ tự: đạt trơn → cảnh báo → đạt nhờ phụ kiện → chưa kiểm được → loại. */
const rank = (c: LensCandidate) => (c.status === 'pass' ? 0 : c.status === 'warn' ? (c.accessory ? 2 : 1) : c.status === 'info' ? 3 : 4);

/**
 * Lọc + xếp hạng cả kho ống kính. Xếp: đạt → cảnh báo → đạt nhờ phụ kiện → chưa kiểm được → loại;
 * trong cùng nhóm, ống dùng nhiều pixel nhất (vùng nhìn sát vật nhất) lên trước,
 * rồi ống ít thông số chưa khai hơn.
 */
export function selectLenses(
  input: LensSelectorInput,
  catalog: readonly Component[],
  params: Params = DEFAULT_ENGINE_PARAMS
): { need: LensNeed | null; candidates: LensCandidate[] } {
  const need = lensNeed(input);
  if (!need) return { need: null, candidates: [] };
  const stock = accessoryStock(catalog);
  const candidates = catalog
    .filter((component) => component.kind === 'lens')
    .map((component) => ({ component, lens: lensFromComponent(component) }))
    .filter(({ lens }) => matchesKind(lens, input.lensKind))
    .map(({ component }) => {
      const base = evaluateLens(input, need, component, params);
      return tryAccessory(input, need, component, base, params, stock) ?? base;
    })
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.pixelUse ?? -1) - (a.pixelUse ?? -1) ||
        a.unknownCount - b.unknownCount ||
        a.component.id.localeCompare(b.component.id)
    );
  return { need, candidates };
}

// ------------------------------------------------- BIẾT 2 TRONG 3 (2026-10-18, Q1) --

/**
 * Ba chế độ nhập: biết hai trong ba đại lượng (tiêu cự, khoảng cách làm việc, vùng
 * nhìn) thì tính đại lượng còn lại — rồi mọi chế độ quy về cùng một cặp (vùng nhìn,
 * WD) để chạy `selectLenses`, nên danh sách ống luôn theo một bộ luật.
 *
 *   'fov-wd'    β = trục giới hạn (magnificationToFit) → f = WD × β ÷ (1 + β)
 *   'focal-wd'  β = f ÷ (WD − f)                       → vùng nhìn = cảm biến ÷ β
 *   'focal-fov' β = trục giới hạn                      → WD = f × (1 + 1/β)
 *
 * 'focal-wd' trả vùng nhìn thật của ống đó (cạnh dài theo bề rộng): ống có đúng
 * tiêu cự đã nhập sẽ phủ khít 100% và đứng đầu danh sách.
 */
export type GeometryMode = 'fov-wd' | 'focal-wd' | 'focal-fov';

export type SolvedGeometry = {
  fovWidthMm: number;
  fovHeightMm: number;
  workingDistanceMm: number;
  focalLengthMm: number;
  beta: number;
};

export function solveGeometry(input: {
  mode: GeometryMode;
  camera: ConfigCamera;
  focalLengthMm: number | null;
  workingDistanceMm: number | null;
  fovWidthMm: number | null;
  fovHeightMm: number | null;
}): SolvedGeometry | null {
  const sensor = sensorOf(input.camera);
  if (!sensor) return null;
  const line = input.camera.cameraType === 'line';
  const { focalLengthMm: f, workingDistanceMm: wd, fovWidthMm: fw } = input;
  // Line scan: chiều dài do vật chạy qua — không nhập thì lấy bằng bề rộng (không giới hạn trục này).
  const fh = input.fovHeightMm ?? (line ? fw : null);

  const fit = () =>
    fw !== null && fh !== null && fw > 0 && fh > 0
      ? magnificationToFit({ sensorWidthMm: sensor.longMm, sensorHeightMm: sensor.shortMm, fovWidthMm: fw, fovHeightMm: fh, lineScan: line })
      : null;

  if (input.mode === 'fov-wd') {
    const m = fit();
    if (!m || wd === null || !(wd > 0)) return null;
    return { fovWidthMm: fw!, fovHeightMm: fh!, workingDistanceMm: wd, focalLengthMm: focalLengthFor(m.beta, wd), beta: m.beta };
  }
  if (input.mode === 'focal-wd') {
    if (f === null || wd === null) return null;
    const beta = entocentricMagnification(f, wd);
    if (beta === null) return null;
    const long = sensor.longMm / beta;
    return { fovWidthMm: long, fovHeightMm: line ? long : sensor.shortMm / beta, workingDistanceMm: wd, focalLengthMm: f, beta };
  }
  const m = fit();
  if (!m || f === null || !(f > 0)) return null;
  return { fovWidthMm: fw!, fovHeightMm: fh!, workingDistanceMm: f * (1 + 1 / m.beta), focalLengthMm: f, beta: m.beta };
}
