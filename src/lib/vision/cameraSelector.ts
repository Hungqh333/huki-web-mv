import { linkBandwidth, specNumber, specString, type Component } from '@/lib/components/specs';
import { cameraFromComponent, type ConfigCamera } from './configurationRules';
import { DEFAULT_ENGINE_PARAMS, interfaceBandwidthFor, pxPerDefectFor, type EngineParams } from './engineParams';
import { fmt, round, type Check, type CheckStatus } from './types';

/**
 * Bộ chọn camera — trang /chon-camera (chốt 2026-10-27, Q1–Q8).
 *
 * Hai họ camera, hai bộ công thức:
 * - AREA SCAN (bình thường + tốc độ cao, Q2): pixel phủ vùng nhìn (RES-004), số ảnh/giây
 *   (THR-006, có ước tính ROI — CAM-001), băng thông (THR-002), shutter + phơi sáng chống
 *   nhoè (THR-005 / LGT-008). Ô tốc độ để trống thì chỉ lọc theo pixel.
 * - LINE SCAN: mm/px ngang + số camera ghép (LSC-001), tần số dòng cho pixel vuông
 *   (LSC-002), phơi tối đa mỗi dòng (LSC-003), băng thông (LSC-004), encoder (LSC-005).
 *
 * Camera đặt cạnh dài cảm biến theo cạnh dài vùng nhìn; ống kính coi là vừa khít vùng
 * nhìn (β lý tưởng) — chọn ống thật ở trang Chọn ống kính. Hàm thuần, không đọc database.
 */

export type CameraColorFilter = 'any' | 'mono' | 'color';
export type CameraParams = EngineParams;

/** CAM-001: fps khi cắt ROI tăng theo tỉ lệ số hàng — ước tính, phải xem datasheet. */
export const ROI_FPS_NOTE_PREFIX = '≈';
/** LSC-003: phơi mỗi dòng dưới mức này (µs) → cần đèn dòng cường độ cao. */
export const LINE_EXPOSURE_BRIGHT_US = 100;
/** LSC-001: nhiều nhất bấy nhiêu camera line scan ghép ngang — hơn nữa coi như sai thiết kế. */
export const LINE_MAX_CAMERAS = 8;
/** Xếp hạng (Q6): dư độ phân giải từ mức này trở lên là "vừa đủ, có biên". */
export const RANK_MARGIN_TARGET = 1.3;

/** mm/px cần: nhập thẳng, hoặc lỗi nhỏ nhất ÷ px/lỗi theo độ tương phản (RES-001). */
export function targetMmPerPx(
  input: { mmPerPx: number | null; defectMm: number | null; contrast: 'high' | 'medium' | 'low' | 'unknown' },
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): { mmPerPx: number; pxPerDefect: number | null } | null {
  if (input.mmPerPx !== null && input.mmPerPx > 0) return { mmPerPx: input.mmPerPx, pxPerDefect: null };
  if (input.defectMm === null || !(input.defectMm > 0)) return null;
  const n = pxPerDefectFor(params)[input.contrast];
  return { mmPerPx: input.defectMm / n, pxPerDefect: n };
}

const colorOf = (component: Component) => specString(component.spec, 'color');

function colorCheck(component: Component, want: CameraColorFilter): Check | null {
  if (want === 'any') return null;
  const have = colorOf(component);
  if (have === want) return null;
  return { key: 'color', status: have === null ? 'info' : 'fail', formula: `${have ?? '?'} ≠ ${want}`, noteKey: have === null ? 'colorUnknown' : 'colorMismatch' };
}

const STATUS_RANK: Record<CheckStatus, number> = { pass: 0, warn: 1, info: 2, fail: 3 };
const worst = (checks: Check[]): CheckStatus => {
  // 'info' = chưa kiểm được một mục, không phải đạt kém hơn cảnh báo: chỉ lấy khi không có gì xấu hơn.
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return checks.some((c) => c.status === 'pass') || checks.length === 0 ? 'pass' : 'info';
};

/** Q6: đạt trước; trong nhóm đạt, dư ≥ 1,3× gần mức đó nhất, rồi dư < 1,3× lớn nhất; rồi giá. */
function rankKey(status: CheckStatus, margin: number | null, price: number | null, extra = 0): number[] {
  const m = margin ?? 0;
  const bucket = m >= RANK_MARGIN_TARGET ? 0 : 1;
  const closeness = bucket === 0 ? Math.round(m * 10) : -Math.round(m * 10);
  return [STATUS_RANK[status], extra, bucket, closeness, price ?? Number.MAX_SAFE_INTEGER];
}
const byKey = <T extends { rank: number[] }>(a: T, b: T) => {
  for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
  return 0;
};

// ════════════════════════════════════════════════════════════════ AREA SCAN ══

export type AreaCameraInput = {
  fovWidthMm: number;
  fovHeightMm: number;
  targetMmPerPx: number;
  color: CameraColorFilter;
  /** Tốc độ băng tải khi chụp lúc vật chạy (mm/s); null = đứng yên / dừng từng bước. */
  speedMmS: number | null;
  partsPerMinute: number | null;
  imagesPerPart: number;
};

export type AreaNeed = {
  fovLongMm: number;
  fovShortMm: number;
  pxLong: number;
  pxShort: number;
  megapixels: number;
  /** THR-006: ảnh/giây mỗi camera; null khi chưa có sản lượng. */
  fpsNeeded: number | null;
  /** THR-005 tại mm/px cần (µs); camera mịn hơn thì phơi còn ngắn hơn — xem từng dòng. */
  exposureMaxUs: number | null;
  strobeRequired: boolean;
};

export type AreaCandidate = {
  component: Component;
  camera: ConfigCamera;
  status: CheckStatus;
  /** mm/px thực khi vùng nhìn vừa khít cảm biến (trục chặt hơn). */
  mmPerPx: number | null;
  /** mm/px cần ÷ thực — > 1 là dư. */
  margin: number | null;
  fpsNeeded: number | null;
  /** CAM-001: fps ước tính khi cắt ROI đúng số hàng cần (chỉ khi dùng tới). */
  fpsRoi: number | null;
  dataRateMBs: number | null;
  exposureMaxUs: number | null;
  checks: Check[];
  rank: number[];
};

export function areaNeed(input: AreaCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): AreaNeed {
  const fovLongMm = Math.max(input.fovWidthMm, input.fovHeightMm);
  const fovShortMm = Math.min(input.fovWidthMm, input.fovHeightMm);
  const pxLong = Math.ceil(fovLongMm / input.targetMmPerPx - 1e-9);
  const pxShort = Math.ceil(fovShortMm / input.targetMmPerPx - 1e-9);
  const fpsNeeded = input.partsPerMinute !== null && input.partsPerMinute > 0 ? (Math.max(1, input.imagesPerPart) * input.partsPerMinute) / 60 : null;
  const exposureMaxUs = input.speedMmS !== null && input.speedMmS > 0 ? ((params.blurPxAllowed * input.targetMmPerPx) / input.speedMmS) * 1e6 : null;
  return {
    fovLongMm,
    fovShortMm,
    pxLong,
    pxShort,
    megapixels: (pxLong * pxShort) / 1e6,
    fpsNeeded,
    exposureMaxUs,
    strobeRequired: exposureMaxUs !== null && exposureMaxUs < params.strobeExposureLimitUs,
  };
}

export function evaluateAreaCamera(component: Component, input: AreaCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): AreaCandidate {
  const camera = cameraFromComponent(component);
  const need = areaNeed(input, params);
  const checks: Check[] = [];
  const colour = colorCheck(component, input.color);
  if (colour) checks.push(colour);

  // ─── RES-004: pixel phủ vùng nhìn ───
  const sensorLong = Math.max(camera.widthPx, camera.heightPx);
  const sensorShort = Math.min(camera.widthPx, camera.heightPx);
  let mmPerPx: number | null = null;
  let margin: number | null = null;
  if (sensorLong > 0 && sensorShort > 0) {
    mmPerPx = Math.max(need.fovLongMm / sensorLong, need.fovShortMm / sensorShort);
    margin = input.targetMmPerPx / mmPerPx;
    const ok = mmPerPx <= input.targetMmPerPx * (1 + 1e-9);
    checks.push({
      key: 'pixels',
      status: ok ? 'pass' : 'fail',
      formula: `max(${fmt(need.fovLongMm, 1)} ÷ ${sensorLong}, ${fmt(need.fovShortMm, 1)} ÷ ${sensorShort}) = ${fmt(mmPerPx, 4)} mm/px ${ok ? '≤' : '>'} ${fmt(input.targetMmPerPx, 4)}`,
      noteKey: ok ? 'pixelsOk' : 'pixelsShort',
      noteValues: { have: round(mmPerPx, 4), need: round(input.targetMmPerPx, 4), px: `${need.pxLong} × ${need.pxShort}`, margin: round(margin, 2) },
    });
  } else {
    checks.push({ key: 'pixels', status: 'info', formula: '—', noteKey: 'pixelsUnknown' });
  }

  // ─── THR-006 + CAM-001: số ảnh/giây, có ROI ───
  let fpsRoi: number | null = null;
  let rowsUsed = sensorShort;
  if (need.fpsNeeded !== null) {
    const fps = need.fpsNeeded;
    if (camera.maxFps !== null && camera.maxFps > 0) {
      const usable = camera.maxFps * (1 - params.cycleMinMargin);
      if (fps <= usable) {
        checks.push({ key: 'fps', status: 'pass', formula: `${fmt(fps, 2)} ≤ ${fmt(usable, 1)} (${fmt(camera.maxFps, 1)} × ${fmt(1 - params.cycleMinMargin, 2)})`, noteKey: 'fpsOk', noteValues: { need: round(fps, 2), max: camera.maxFps } });
      } else {
        // Số hàng thật sự cần theo trục ngắn ở mm/px của camera này; cắt ROI thì đọc ít hàng hơn → nhanh hơn.
        const rowsNeeded = mmPerPx !== null ? Math.min(sensorShort, Math.ceil(need.fovShortMm / mmPerPx - 1e-9)) : sensorShort;
        fpsRoi = rowsNeeded > 0 && rowsNeeded < sensorShort ? (camera.maxFps * sensorShort) / rowsNeeded : null;
        if (fpsRoi !== null && fps <= fpsRoi * (1 - params.cycleMinMargin)) {
          rowsUsed = rowsNeeded;
          checks.push({
            key: 'fps',
            status: 'warn',
            formula: `${fmt(fps, 2)} > ${fmt(usable, 1)} · ROI ${rowsNeeded}/${sensorShort}: ${ROI_FPS_NOTE_PREFIX} ${fmt(camera.maxFps, 1)} × ${sensorShort} ÷ ${rowsNeeded} = ${fmt(fpsRoi, 0)} fps`,
            noteKey: 'fpsWithRoi',
            noteValues: { need: round(fps, 2), max: camera.maxFps, roi: Math.round(fpsRoi), rows: rowsNeeded },
          });
        } else {
          const fail = fps > camera.maxFps && (fpsRoi === null || fps > fpsRoi);
          checks.push({
            key: 'fps',
            status: fail ? 'fail' : 'warn',
            formula: `${fmt(fps, 2)} ${fps > camera.maxFps ? '>' : '≤'} ${fmt(camera.maxFps, 1)} fps`,
            noteKey: fail ? 'fpsTooLow' : 'fpsTight',
            noteValues: { need: round(fps, 2), max: camera.maxFps, margin: Math.round(params.cycleMinMargin * 100) },
          });
        }
      }
    } else {
      checks.push({ key: 'fps', status: 'info', formula: '—', noteKey: 'fpsUnknown' });
    }
  }

  // ─── THR-002: băng thông (ROI nếu đã phải dùng) ───
  let dataRateMBs: number | null = null;
  if (need.fpsNeeded !== null && sensorLong > 0) {
    dataRateMBs = (sensorLong * rowsUsed * camera.bytesPerPx * need.fpsNeeded) / 1e6;
    const capacity = linkBandwidth(interfaceBandwidthFor(params), camera.interfaceName, camera.lanes);
    if (capacity !== undefined) {
      const ok = dataRateMBs <= capacity * params.interfaceMaxShare;
      checks.push({
        key: 'bandwidth',
        status: ok ? 'pass' : 'fail',
        formula: `${sensorLong} × ${rowsUsed} × ${camera.bytesPerPx} × ${fmt(need.fpsNeeded, 2)} = ${fmt(dataRateMBs, 1)} MB/s ${ok ? '≤' : '>'} ${Math.round(params.interfaceMaxShare * 100)}% × ${capacity}`,
        noteKey: ok ? undefined : 'bandwidthOver',
        noteValues: { rate: round(dataRateMBs, 1), capacity, name: camera.interfaceName ?? '—' },
      });
    }
  }

  // ─── THR-005 / LGT-008: vật chạy khi chụp ───
  let exposureMaxUs: number | null = null;
  if (input.speedMmS !== null && input.speedMmS > 0) {
    const shutter = specString(component.spec, 'shutter');
    if (shutter === 'rolling') checks.push({ key: 'shutter', status: 'fail', formula: 'rolling shutter', noteKey: 'rollingShutter' });
    else if (shutter === null) checks.push({ key: 'shutter', status: 'info', formula: '—', noteKey: 'shutterUnknown' });
    if (mmPerPx !== null) {
      exposureMaxUs = ((params.blurPxAllowed * mmPerPx) / input.speedMmS) * 1e6;
      const strobe = exposureMaxUs < params.strobeExposureLimitUs;
      checks.push({
        key: 'exposure',
        status: strobe ? 'warn' : 'pass',
        formula: `${params.blurPxAllowed} × ${fmt(mmPerPx, 4)} ÷ ${fmt(input.speedMmS)} = ${fmt(exposureMaxUs, 0)} µs`,
        noteKey: strobe ? 'exposureStrobe' : 'exposureOk',
        noteValues: { us: Math.round(exposureMaxUs), limit: params.strobeExposureLimitUs },
      });
    }
  }

  const status = worst(checks);
  return {
    component,
    camera,
    status,
    mmPerPx,
    margin,
    fpsNeeded: need.fpsNeeded,
    fpsRoi: checks.some((c) => c.noteKey === 'fpsWithRoi') ? fpsRoi : null,
    dataRateMBs,
    exposureMaxUs,
    checks,
    rank: rankKey(status, margin, component.price_vnd),
  };
}

export function selectAreaCameras(components: Component[], input: AreaCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): { need: AreaNeed; candidates: AreaCandidate[] } {
  const cameras = components.filter((c) => c.kind === 'camera' && specString(c.spec, 'camera_type') !== 'line');
  return { need: areaNeed(input, params), candidates: cameras.map((c) => evaluateAreaCamera(c, input, params)).sort(byKey) };
}

// ════════════════════════════════════════════════════════════════ LINE SCAN ══

export type LineCameraInput = {
  /** Bề rộng cần quét, vuông góc chiều chạy (mm). */
  widthMm: number;
  speedMmS: number;
  targetMmPerPx: number;
  color: CameraColorFilter;
  /** µm mỗi xung encoder; null = chưa có encoder. */
  encoderUm: number | null;
};

export type LineCandidate = {
  component: Component;
  camera: ConfigCamera;
  status: CheckStatus;
  /** LSC-001: số camera ghép ngang; null khi quá LINE_MAX_CAMERAS hoặc thiếu thông số. */
  cameraCount: number | null;
  /** Bề rộng một camera phủ, đã cộng chồng lấn (mm). */
  tileWidthMm: number | null;
  /** mm/px ngang thực. */
  mmPerPx: number | null;
  margin: number | null;
  /** LSC-002: số dòng/giây để pixel vuông. */
  lineRateHz: number | null;
  maxLineRateHz: number | null;
  /** LSC-003: phơi tối đa mỗi dòng (µs). */
  exposureUs: number | null;
  dataRateMBs: number | null;
  /** Chiều dài cảm biến (mm) và β cần (Q5) — để chọn ống kính. */
  sensorLengthMm: number | null;
  beta: number | null;
  checks: Check[];
  rank: number[];
};

/** LSC-001: số camera nhỏ nhất để mỗi camera đạt mm/px cần, chồng lấn như RES-005. */
export function lineCameraCount(input: { widthMm: number; linePx: number; targetMmPerPx: number }, params: EngineParams = DEFAULT_ENGINE_PARAMS) {
  for (let n = 1; n <= LINE_MAX_CAMERAS; n++) {
    const base = input.widthMm / n;
    const overlap = n > 1 ? Math.max(params.tileOverlapRatio * base, params.tileOverlapMinPx * input.targetMmPerPx) : 0;
    const tile = base + overlap;
    if (tile / input.linePx <= input.targetMmPerPx * (1 + 1e-9)) return { count: n, tileWidthMm: tile, overlapMm: overlap };
  }
  return null;
}

export function evaluateLineCamera(component: Component, input: LineCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): LineCandidate {
  const camera = cameraFromComponent(component);
  const checks: Check[] = [];
  const colour = colorCheck(component, input.color);
  if (colour) checks.push(colour);

  const px = camera.widthPx;
  const maxKhz = specNumber(component.spec, 'max_line_rate_khz');
  const maxLineRateHz = maxKhz !== null && maxKhz > 0 ? maxKhz * 1000 : null;
  const sensorLengthMm = px > 0 && camera.pixelSizeUm !== null ? (px * camera.pixelSizeUm) / 1000 : null;
  const base: Omit<LineCandidate, 'status' | 'checks' | 'rank'> = {
    component,
    camera,
    cameraCount: null,
    tileWidthMm: null,
    mmPerPx: null,
    margin: null,
    lineRateHz: null,
    maxLineRateHz,
    exposureUs: null,
    dataRateMBs: null,
    sensorLengthMm,
    beta: null,
  };

  if (!(px > 0)) {
    checks.push({ key: 'lineWidth', status: 'info', formula: '—', noteKey: 'lineWidthUnknown' });
    const status = worst(checks);
    return { ...base, status, checks, rank: rankKey(status, null, component.price_vnd, LINE_MAX_CAMERAS + 1) };
  }

  // ─── LSC-001: mm/px ngang, số camera ghép ───
  const fit = lineCameraCount({ widthMm: input.widthMm, linePx: px, targetMmPerPx: input.targetMmPerPx }, params);
  if (!fit) {
    checks.push({
      key: 'lineWidth',
      status: 'fail',
      formula: `${fmt(input.widthMm, 1)} ÷ ${LINE_MAX_CAMERAS} ÷ ${px} > ${fmt(input.targetMmPerPx, 4)}`,
      noteKey: 'lineTooManyCameras',
      noteValues: { max: LINE_MAX_CAMERAS },
    });
    const status = worst(checks);
    return { ...base, status, checks, rank: rankKey(status, null, component.price_vnd, LINE_MAX_CAMERAS + 1) };
  }
  const mmPerPx = fit.tileWidthMm / px;
  const margin = input.targetMmPerPx / mmPerPx;
  checks.push({
    key: 'lineWidth',
    status: fit.count > 1 ? 'warn' : 'pass',
    formula:
      fit.count > 1
        ? `(${fmt(input.widthMm, 1)} ÷ ${fit.count} + ${fmt(fit.overlapMm, 1)}) ÷ ${px} = ${fmt(mmPerPx, 4)} mm/px ≤ ${fmt(input.targetMmPerPx, 4)}`
        : `${fmt(input.widthMm, 1)} ÷ ${px} = ${fmt(mmPerPx, 4)} mm/px ≤ ${fmt(input.targetMmPerPx, 4)}`,
    noteKey: fit.count > 1 ? 'lineMultiCamera' : 'lineSingleCamera',
    noteValues: { n: fit.count, overlap: round(fit.overlapMm, 1), have: round(mmPerPx, 4) },
  });

  // ─── LSC-002: tần số dòng cho pixel vuông ───
  const lineRateHz = input.speedMmS / mmPerPx;
  if (maxLineRateHz !== null) {
    const usable = maxLineRateHz * (1 - params.cycleMinMargin);
    if (lineRateHz <= usable) {
      checks.push({ key: 'lineRate', status: 'pass', formula: `${fmt(input.speedMmS)} ÷ ${fmt(mmPerPx, 4)} = ${fmt(lineRateHz / 1000, 2)} kHz ≤ ${fmt(usable / 1000, 2)} kHz`, noteKey: 'lineRateOk', noteValues: { khz: round(lineRateHz / 1000, 2), max: maxKhz! } });
    } else if (lineRateHz <= maxLineRateHz) {
      checks.push({ key: 'lineRate', status: 'warn', formula: `${fmt(lineRateHz / 1000, 2)} kHz > ${fmt(usable / 1000, 2)} kHz (${fmt(maxKhz!, 1)} × ${fmt(1 - params.cycleMinMargin, 2)})`, noteKey: 'lineRateTight', noteValues: { khz: round(lineRateHz / 1000, 2), max: maxKhz!, margin: Math.round(params.cycleMinMargin * 100) } });
    } else {
      // Không đủ nhanh cho pixel vuông: chạy ở tần số tối đa thì pixel dọc chiều chạy dài ra.
      const alongMm = input.speedMmS / maxLineRateHz;
      const rectOk = alongMm <= input.targetMmPerPx * (1 + 1e-9);
      checks.push({
        key: 'lineRate',
        status: rectOk ? 'warn' : 'fail',
        formula: `${fmt(lineRateHz / 1000, 2)} kHz > ${fmt(maxKhz!, 1)} kHz · ${fmt(input.speedMmS)} ÷ ${fmt(maxLineRateHz, 0)} = ${fmt(alongMm, 4)} mm ${rectOk ? '≤' : '>'} ${fmt(input.targetMmPerPx, 4)}`,
        noteKey: rectOk ? 'lineRectPixel' : 'lineRateTooHigh',
        noteValues: { khz: round(lineRateHz / 1000, 2), max: maxKhz!, along: round(alongMm, 4) },
      });
    }
  } else {
    checks.push({ key: 'lineRate', status: 'info', formula: `${fmt(input.speedMmS)} ÷ ${fmt(mmPerPx, 4)} = ${fmt(lineRateHz / 1000, 2)} kHz`, noteKey: 'lineRateUnknown' });
  }
  // Tần số thực chạy = tần số cần, hoặc tối đa của camera nếu không với tới.
  const runHz = maxLineRateHz !== null ? Math.min(lineRateHz, maxLineRateHz) : lineRateHz;

  // ─── LSC-003: phơi tối đa mỗi dòng ───
  const exposureUs = 1e6 / runHz;
  checks.push({
    key: 'lineExposure',
    status: exposureUs < LINE_EXPOSURE_BRIGHT_US ? 'warn' : 'pass',
    formula: `1 000 000 ÷ ${fmt(runHz, 0)} = ${fmt(exposureUs, 1)} µs`,
    noteKey: exposureUs < LINE_EXPOSURE_BRIGHT_US ? 'lineExposureShort' : 'lineExposureOk',
    noteValues: { us: round(exposureUs, 1), limit: LINE_EXPOSURE_BRIGHT_US },
  });

  // ─── LSC-004: băng thông mỗi camera ───
  const dataRateMBs = (px * runHz * camera.bytesPerPx) / 1e6;
  const capacity = linkBandwidth(interfaceBandwidthFor(params), camera.interfaceName, camera.lanes);
  if (capacity !== undefined) {
    const ok = dataRateMBs <= capacity * params.interfaceMaxShare;
    checks.push({
      key: 'bandwidth',
      status: ok ? 'pass' : 'fail',
      formula: `${px} × ${fmt(runHz, 0)} × ${camera.bytesPerPx} = ${fmt(dataRateMBs, 1)} MB/s ${ok ? '≤' : '>'} ${Math.round(params.interfaceMaxShare * 100)}% × ${capacity}`,
      noteKey: ok ? undefined : 'bandwidthOver',
      noteValues: { rate: round(dataRateMBs, 1), capacity, name: camera.interfaceName ?? '—' },
    });
  }

  // ─── LSC-005: encoder ───
  const alongUm = (input.speedMmS / runHz) * 1000;
  if (input.encoderUm !== null) {
    const fine = input.encoderUm <= alongUm * (1 + 1e-9);
    checks.push({ key: 'encoder', status: fine ? 'pass' : 'warn', formula: `${fmt(input.encoderUm)} µm ${fine ? '≤' : '>'} ${fmt(alongUm, 1)} µm`, noteKey: fine ? 'encoderOk' : 'encoderCoarse', noteValues: { um: input.encoderUm, need: round(alongUm, 1) } });
  } else {
    checks.push({ key: 'encoder', status: 'info', formula: '—', noteKey: 'encoderMissing' });
  }

  const status = worst(checks);
  return {
    ...base,
    status,
    cameraCount: fit.count,
    tileWidthMm: fit.tileWidthMm,
    mmPerPx,
    margin,
    lineRateHz,
    exposureUs,
    dataRateMBs,
    beta: sensorLengthMm !== null ? sensorLengthMm / fit.tileWidthMm : null,
    checks,
    rank: rankKey(status, margin, component.price_vnd, fit.count),
  };
}

export function selectLineCameras(components: Component[], input: LineCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): LineCandidate[] {
  return components
    .filter((c) => c.kind === 'camera' && specString(c.spec, 'camera_type') === 'line')
    .map((c) => evaluateLineCamera(c, input, params))
    .sort(byKey);
}
