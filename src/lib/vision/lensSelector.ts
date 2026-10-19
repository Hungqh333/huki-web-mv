import { SENSOR_FORMATS, sensorDiagonalMm, type Component } from '@/lib/components/specs';
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

type Params = Pick<EngineParams, 'imageCircleTolerance' | 'dofDiffractionTolerance'>;

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

export type LensCheckKey = 'mount' | 'imageCircle' | 'workingDistance' | 'fov' | 'pixel' | 'resolution' | 'diffraction' | 'depth';

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
};

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
export function evaluateLens(input: LensSelectorInput, need: LensNeed, component: Component, params: Params = DEFAULT_ENGINE_PARAMS): LensCandidate {
  const lens = lensFromComponent(component);
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
    if (beta === null) {
      checks.push({ key: 'workingDistance', status: 'fail', formula: `WD ${fmt(wd)} mm ≤ f ${fmt(lens.focalLengthMm, 1)} mm`, noteKey: 'wdBelowFocal' });
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
    const optic = fixedMagnification ? `β ${fmt(beta, 4)}×` : `β = ${fmt(lens.focalLengthMm!, 1)} ÷ (${fmt(wd!)} − ${fmt(lens.focalLengthMm!, 1)}) = ${fmt(beta, 4)}`;
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
    status: judged.length === 0 ? 'info' : judged.includes('fail') ? 'fail' : judged.includes('warn') ? 'warn' : 'pass',
    unknownCount,
  };
}

const STATUS_ORDER: Record<Check['status'], number> = { pass: 0, warn: 1, info: 2, fail: 3 };

/**
 * Lọc + xếp hạng cả kho ống kính. Xếp: đạt → cảnh báo → chưa kiểm được → loại;
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
  const candidates = catalog
    .filter((component) => component.kind === 'lens')
    .map((component) => ({ component, lens: lensFromComponent(component) }))
    .filter(({ lens }) => matchesKind(lens, input.lensKind))
    .map(({ component }) => evaluateLens(input, need, component, params))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
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
