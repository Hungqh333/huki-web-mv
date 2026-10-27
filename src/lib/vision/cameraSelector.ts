import { linkBandwidth, specNumber, specString, type Component } from '@/lib/components/specs';
import { cameraFromComponent, type ConfigCamera } from './configurationRules';
import { DEFAULT_ENGINE_PARAMS, interfaceBandwidthFor, pxPerDefectFor, type EngineParams } from './engineParams';
import {
  DEFAULT_SAMPLE_EXPOSURE_MS,
  DEFAULT_SENSOR_RESPONSE_MS,
  blurPxFor,
  exposureLimitedFps,
  maxExposureUs,
  strobeLight,
  triggerJitterMs,
  type StrobeVerdict,
  type TriggerSource,
} from './highSpeed';
import { fmt, round, type Check, type CheckStatus } from './types';

/**
 * Bộ chọn camera — trang /chon-camera (chốt 2026-10-27, Q1–Q8; đợt 2 tốc độ cao Q1–Q7).
 *
 * Hai họ camera, hai bộ công thức:
 * - AREA SCAN (bình thường + tốc độ cao): bảng tính tốc độ cao không phụ thuộc camera
 *   (THR-005/006/007, LGT-024), rồi từng camera: pixel phủ vùng nhìn (RES-004), fps THẬT
 *   = min(cảm biến / ROI, giới hạn phơi sáng, cổng giao tiếp) (CAM-001/002), băng thông
 *   (THR-002), shutter + phơi chống nhoè (THR-005 / LGT-008), độ nhạy sáng EMVA (CAM-003).
 *   Ô tốc độ để trống thì chỉ lọc theo pixel.
 * - LINE SCAN: mm/px ngang + số camera ghép (LSC-001), tần số dòng cho pixel vuông
 *   (LSC-002), phơi mỗi dòng có TDI (LSC-003), băng thông (LSC-004), encoder (LSC-005).
 *
 * Camera đặt cạnh dài cảm biến theo cạnh dài vùng nhìn; ống kính coi là vừa khít vùng
 * nhìn (β lý tưởng) — chọn ống thật ở trang Chọn ống kính. Hàm thuần, không đọc database.
 */

export type CameraColorFilter = 'any' | 'mono' | 'color';
export type CameraParams = EngineParams;
export type FpsLimiter = 'sensor' | 'exposure' | 'interface';

/** CAM-001: fps khi cắt ROI tăng theo tỉ lệ số hàng — ước tính lạc quan, phải xem datasheet / công cụ hãng. */
export const ROI_FPS_NOTE_PREFIX = '≈';
/** LSC-003: phơi mỗi dòng dưới mức này (µs) → cần đèn dòng cường độ cao. */
export const LINE_EXPOSURE_BRIGHT_US = 100;
/** LSC-001: nhiều nhất bấy nhiêu camera line scan ghép ngang — hơn nữa coi như sai thiết kế. */
export const LINE_MAX_CAMERAS = 8;
/** Xếp hạng (Q6): dư độ phân giải từ mức này trở lên là "vừa đủ, có biên". */
export const RANK_MARGIN_TARGET = 1.3;
export { DEFAULT_SAMPLE_EXPOSURE_MS, DEFAULT_SENSOR_RESPONSE_MS };

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

/**
 * Q6: đạt trước; trong nhóm đạt, dư ≥ 1,3× gần mức đó nhất, rồi dư < 1,3× lớn nhất; rồi giá.
 * `light` (CAM-003, chỉ khi phải dùng strobe): camera ăn sáng hơn lên trước; chưa khai QE xếp sau.
 */
function rankKey(status: CheckStatus, margin: number | null, price: number | null, extra = 0, light = 0): number[] {
  const m = margin ?? 0;
  const bucket = m >= RANK_MARGIN_TARGET ? 0 : 1;
  const closeness = bucket === 0 ? Math.round(m * 10) : -Math.round(m * 10);
  return [STATUS_RANK[status], extra, light, bucket, closeness, price ?? Number.MAX_SAFE_INTEGER];
}
const byKey = <T extends { rank: number[] }>(a: T, b: T) => {
  for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
  return 0;
};

/**
 * CAM-003 (Q5): độ nhạy tương đối = QE × diện tích pixel (µm²). Cùng vùng nhìn và cùng F#,
 * pixel to hơn nhận nhiều photon hơn; QE cao cần ít sáng hơn (EMVA 1288). Dải động = 20·log(bão hoà ÷ nhiễu tối).
 */
export function cameraSensitivity(component: Component): { sensitivity: number | null; dynamicRangeDb: number | null } {
  const qe = specNumber(component.spec, 'qe_percent');
  const pitch = specNumber(component.spec, 'pixel_size_um');
  const sat = specNumber(component.spec, 'saturation_e');
  const dark = specNumber(component.spec, 'dark_noise_e');
  return {
    sensitivity: qe !== null && qe > 0 && pitch !== null && pitch > 0 ? (qe / 100) * pitch * pitch : null,
    dynamicRangeDb: sat !== null && dark !== null && sat > 0 && dark > 0 ? 20 * Math.log10(sat / dark) : null,
  };
}

// ════════════════════════════════════════════════════════════════ AREA SCAN ══

export type AreaCameraInput = {
  fovWidthMm: number;
  fovHeightMm: number;
  targetMmPerPx: number;
  color: CameraColorFilter;
  /** Q4: bài đo dùng nhoè chặt hơn bài phát hiện lỗi. */
  measuring: boolean;
  /** Tốc độ băng tải khi chụp lúc vật chạy (mm/s); null = đứng yên / dừng từng bước. */
  speedMmS: number | null;
  partsPerMinute: number | null;
  imagesPerPart: number;
  triggerSource: TriggerSource;
  /** Đáp ứng cảm biến quang (ms); null = giả định DEFAULT_SENSOR_RESPONSE_MS. */
  sensorResponseMs: number | null;
  /** Phơi lúc chụp mẫu ra ảnh tốt (ms); null = ước tính DEFAULT_SAMPLE_EXPOSURE_MS. */
  sampleExposureMs: number | null;
  /** CAM-002 (Q2): camera đọc chồng phơi (overlapped) — mặc định có. */
  overlapped: boolean;
};

/** Bảng tính tốc độ cao (Q1) — số không phụ thuộc camera. */
export type AreaNeed = {
  fovLongMm: number;
  fovShortMm: number;
  pxLong: number;
  pxShort: number;
  megapixels: number;
  /** THR-006: ảnh/giây mỗi camera; null khi chưa có sản lượng. */
  fpsNeeded: number | null;
  /** Vật đi được giữa hai ảnh liên tiếp = v ÷ fps (mm). */
  travelPerFrameMm: number | null;
  blurPx: number;
  /** THR-005 tại mm/px cần (µs); camera mịn hơn thì phơi còn ngắn hơn — xem từng dòng. */
  exposureMaxUs: number | null;
  strobeRequired: boolean;
  /** THR-007: null khi vật không chạy. */
  trigger:
    | null
    | { source: 'encoder' }
    | { source: 'photoSensor' | 'software'; sensorMs: number; sensorAssumed: boolean; cameraMs: number; totalMs: number; shiftMm: number; px: number; share: number; over: boolean };
  /** LGT-024: null khi vật không chạy. */
  light: null | { sampleMs: number; assumed: boolean; boost: number; duty: number | null; verdict: StrobeVerdict };
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
  /** CAM-002: fps thật hết khung = min(cảm biến, phơi sáng, cổng). */
  fpsReal: number | null;
  /** CAM-001: fps thật khi cắt ROI đúng số hàng cần (chỉ khi phải dùng tới). */
  fpsRoi: number | null;
  fpsLimiter: FpsLimiter | null;
  dataRateMBs: number | null;
  exposureMaxUs: number | null;
  /** CAM-003: QE × pixel² và tỉ lệ so với camera nhạy nhất trong danh sách. */
  sensitivity: number | null;
  sensitivityRel: number | null;
  dynamicRangeDb: number | null;
  checks: Check[];
  rank: number[];
};

export function areaNeed(input: AreaCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): AreaNeed {
  const fovLongMm = Math.max(input.fovWidthMm, input.fovHeightMm);
  const fovShortMm = Math.min(input.fovWidthMm, input.fovHeightMm);
  const pxLong = Math.ceil(fovLongMm / input.targetMmPerPx - 1e-9);
  const pxShort = Math.ceil(fovShortMm / input.targetMmPerPx - 1e-9);
  const fpsNeeded = input.partsPerMinute !== null && input.partsPerMinute > 0 ? (Math.max(1, input.imagesPerPart) * input.partsPerMinute) / 60 : null;
  const v = input.speedMmS !== null && input.speedMmS > 0 ? input.speedMmS : null;
  const blurPx = blurPxFor(params, input.measuring);
  const exposureMaxUs = v !== null ? maxExposureUs(blurPx, input.targetMmPerPx, v) : null;

  let trigger: AreaNeed['trigger'] = null;
  let light: AreaNeed['light'] = null;
  if (v !== null) {
    const sensorMs = input.sensorResponseMs ?? DEFAULT_SENSOR_RESPONSE_MS;
    const jitter = triggerJitterMs(input.triggerSource, sensorMs, params);
    if (input.triggerSource === 'encoder' || jitter === null) trigger = { source: 'encoder' };
    else {
      const shiftMm = (v * jitter.totalMs) / 1000;
      const share = shiftMm / fovShortMm;
      trigger = {
        source: input.triggerSource,
        sensorMs,
        sensorAssumed: input.sensorResponseMs === null,
        cameraMs: jitter.cameraMs,
        totalMs: jitter.totalMs,
        shiftMm,
        px: shiftMm / input.targetMmPerPx,
        share,
        over: share > params.triggerShiftMaxShare,
      };
    }
    const sampleMs = input.sampleExposureMs ?? DEFAULT_SAMPLE_EXPOSURE_MS;
    light = { sampleMs, assumed: input.sampleExposureMs === null, ...strobeLight({ sampleExposureMs: sampleMs, exposureMaxUs: exposureMaxUs!, fps: fpsNeeded, params }) };
  }

  return {
    fovLongMm,
    fovShortMm,
    pxLong,
    pxShort,
    megapixels: (pxLong * pxShort) / 1e6,
    fpsNeeded,
    travelPerFrameMm: v !== null && fpsNeeded !== null ? v / fpsNeeded : null,
    blurPx,
    exposureMaxUs,
    strobeRequired: exposureMaxUs !== null && exposureMaxUs < params.strobeExposureLimitUs,
    trigger,
    light,
  };
}

export function evaluateAreaCamera(component: Component, input: AreaCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS, need: AreaNeed = areaNeed(input, params)): AreaCandidate {
  const camera = cameraFromComponent(component);
  const checks: Check[] = [];
  const colour = colorCheck(component, input.color);
  if (colour) checks.push(colour);
  const moving = input.speedMmS !== null && input.speedMmS > 0;

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

  // ─── THR-005 / LGT-008: phơi chống nhoè với mm/px THẬT của camera này ───
  let exposureMaxUsCam: number | null = null;
  if (moving) {
    const shutter = specString(component.spec, 'shutter');
    if (shutter === 'rolling') checks.push({ key: 'shutter', status: 'fail', formula: 'rolling shutter', noteKey: 'rollingShutter' });
    else if (shutter === null) checks.push({ key: 'shutter', status: 'info', formula: '—', noteKey: 'shutterUnknown' });
    if (mmPerPx !== null) {
      exposureMaxUsCam = maxExposureUs(need.blurPx, mmPerPx, input.speedMmS!);
      const strobe = exposureMaxUsCam < params.strobeExposureLimitUs;
      checks.push({
        key: 'exposure',
        status: strobe ? 'warn' : 'pass',
        formula: `${need.blurPx} × ${fmt(mmPerPx, 4)} ÷ ${fmt(input.speedMmS!)} = ${fmt(exposureMaxUsCam, 0)} µs`,
        noteKey: strobe ? 'exposureStrobe' : 'exposureOk',
        noteValues: { us: Math.round(exposureMaxUsCam), limit: params.strobeExposureLimitUs },
      });
    }
  }

  // ─── CAM-002 + CAM-001 + THR-006: fps thật (cảm biến / phơi / cổng), ROI nếu cần ───
  // Thời gian phơi đang dùng: vật chạy → t_max của camera này; đứng yên → phơi lúc chụp mẫu nếu đã nhập.
  const exposureUs = moving ? exposureMaxUsCam : input.sampleExposureMs !== null ? input.sampleExposureMs * 1000 : null;
  const capacity = linkBandwidth(interfaceBandwidthFor(params), camera.interfaceName, camera.lanes);
  const realFps = (sensorFps: number, rows: number): { fps: number; limiter: FpsLimiter } => {
    const withExposure = exposureLimitedFps(sensorFps, exposureUs, input.overlapped);
    const iface = capacity !== undefined && sensorLong > 0 && rows > 0 ? (capacity * params.interfaceMaxShare * 1e6) / (sensorLong * rows * camera.bytesPerPx) : Infinity;
    const fps = Math.min(sensorFps, withExposure, iface);
    return { fps, limiter: fps === iface && iface < withExposure ? 'interface' : withExposure < sensorFps ? 'exposure' : 'sensor' };
  };
  let fpsReal: number | null = null;
  let fpsRoi: number | null = null;
  let fpsLimiter: FpsLimiter | null = null;
  let rowsUsed = sensorShort;
  if (camera.maxFps !== null && camera.maxFps > 0 && sensorShort > 0) {
    const full = realFps(camera.maxFps, sensorShort);
    fpsReal = full.fps;
    fpsLimiter = full.limiter;
    if (need.fpsNeeded !== null) {
      const fps = need.fpsNeeded;
      const keep = 1 - params.cycleMinMargin;
      const values = { need: round(fps, 2), max: camera.maxFps, real: round(full.fps, 1), margin: Math.round(params.cycleMinMargin * 100) };
      if (fps <= full.fps * keep) {
        checks.push({ key: 'fps', status: 'pass', formula: `${fmt(fps, 2)} ≤ ${fmt(full.fps, 1)} × ${fmt(keep, 2)}`, noteKey: 'fpsOk', noteValues: values });
      } else {
        // Số hàng thật sự cần theo trục ngắn ở mm/px của camera này; cắt ROI thì đọc ít hàng hơn → nhanh hơn.
        const rowsNeeded = mmPerPx !== null ? Math.min(sensorShort, Math.ceil(need.fovShortMm / mmPerPx - 1e-9)) : sensorShort;
        const roi = rowsNeeded > 0 && rowsNeeded < sensorShort ? realFps((camera.maxFps * sensorShort) / rowsNeeded, rowsNeeded) : null;
        if (roi !== null && fps <= roi.fps * keep) {
          rowsUsed = rowsNeeded;
          fpsRoi = roi.fps;
          fpsLimiter = roi.limiter;
          checks.push({
            key: 'fps',
            status: 'warn',
            formula: `${fmt(fps, 2)} > ${fmt(full.fps, 1)} × ${fmt(keep, 2)} · ROI ${rowsNeeded}/${sensorShort}: ${ROI_FPS_NOTE_PREFIX} ${fmt(roi.fps, 0)} fps`,
            noteKey: 'fpsWithRoi',
            noteValues: { ...values, roi: Math.round(roi.fps), rows: rowsNeeded },
          });
        } else {
          const best = Math.max(full.fps, roi?.fps ?? 0);
          const fail = fps > best;
          checks.push({
            key: 'fps',
            status: fail ? 'fail' : 'warn',
            formula: `${fmt(fps, 2)} ${fail ? '>' : '≤'} ${fmt(best, 1)} fps`,
            noteKey: fail ? 'fpsTooLow' : 'fpsTight',
            noteValues: { ...values, real: round(best, 1) },
          });
        }
      }
    }
  } else if (need.fpsNeeded !== null) {
    checks.push({ key: 'fps', status: 'info', formula: '—', noteKey: 'fpsUnknown' });
  }

  // ─── THR-002: băng thông (ROI nếu đã phải dùng) ───
  let dataRateMBs: number | null = null;
  if (need.fpsNeeded !== null && sensorLong > 0) {
    dataRateMBs = (sensorLong * rowsUsed * camera.bytesPerPx * need.fpsNeeded) / 1e6;
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

  // ─── CAM-003: độ nhạy sáng (chỉ hiển thị + xếp hạng khi phải strobe) ───
  const { sensitivity, dynamicRangeDb } = cameraSensitivity(component);
  if (need.strobeRequired) {
    checks.push(
      sensitivity !== null
        ? { key: 'sensitivity', status: 'info', formula: `QE × pixel² = ${fmt(sensitivity, 2)} µm²`, noteKey: 'sensitivityKnown', noteValues: { value: round(sensitivity, 2) } }
        : { key: 'sensitivity', status: 'info', formula: '—', noteKey: 'sensitivityUnknown' }
    );
  }

  const status = worst(checks);
  const light = need.strobeRequired ? (sensitivity === null ? 1e9 : -Math.round(sensitivity * 100)) : 0;
  return {
    component,
    camera,
    status,
    mmPerPx,
    margin,
    fpsNeeded: need.fpsNeeded,
    fpsReal,
    fpsRoi,
    fpsLimiter,
    dataRateMBs,
    exposureMaxUs: exposureMaxUsCam,
    sensitivity,
    sensitivityRel: null,
    dynamicRangeDb,
    checks,
    rank: rankKey(status, margin, component.price_vnd, 0, light),
  };
}

export function selectAreaCameras(components: Component[], input: AreaCameraInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): { need: AreaNeed; candidates: AreaCandidate[] } {
  const need = areaNeed(input, params);
  const cameras = components.filter((c) => c.kind === 'camera' && specString(c.spec, 'camera_type') !== 'line');
  const candidates = cameras.map((c) => evaluateAreaCamera(c, input, params, need));
  const best = Math.max(0, ...candidates.map((c) => c.sensitivity ?? 0));
  for (const c of candidates) c.sensitivityRel = c.sensitivity !== null && best > 0 ? c.sensitivity / best : null;
  return { need, candidates: candidates.sort(byKey) };
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
  /** LSC-003: phơi hiệu dụng mỗi dòng (µs), đã nhân số tầng TDI. */
  exposureUs: number | null;
  tdiStages: number | null;
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
  const tdi = specNumber(component.spec, 'tdi_stages');
  const tdiStages = tdi !== null && tdi > 1 ? Math.round(tdi) : null;
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
    tdiStages,
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

  // ─── LSC-003: phơi mỗi dòng — TDI cộng dồn nhiều tầng (Q6, Teledyne Linea HS) ───
  const stages = tdiStages ?? 1;
  const exposureUs = (stages * 1e6) / runHz;
  const short = exposureUs < LINE_EXPOSURE_BRIGHT_US;
  checks.push({
    key: 'lineExposure',
    status: short ? 'warn' : 'pass',
    formula: tdiStages ? `${tdiStages} × 1 000 000 ÷ ${fmt(runHz, 0)} = ${fmt(exposureUs, 1)} µs` : `1 000 000 ÷ ${fmt(runHz, 0)} = ${fmt(exposureUs, 1)} µs`,
    noteKey: short ? (tdiStages ? 'lineExposureShort' : 'lineExposureShortNoTdi') : tdiStages ? 'lineExposureTdiOk' : 'lineExposureOk',
    noteValues: { us: round(exposureUs, 1), limit: LINE_EXPOSURE_BRIGHT_US, stages },
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
