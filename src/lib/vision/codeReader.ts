import { specList, specNumber, specString, type Component } from '@/lib/components/specs';
import { evaluateAreaCamera, type AreaCameraInput, type AreaCandidate } from './cameraSelector';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './engineParams';
import { blurPxFor, maxExposureUs } from './highSpeed';
import { fmt, round, type Check, type CheckStatus } from './types';

/**
 * Bộ chọn đầu đọc mã — trang /chon-doc-ma (chốt 2026-10-27, Q1–Q8). Hàm thuần.
 *
 * - COD-001: px/module theo loại mã → mm/px cần; vùng nhìn = mã + 2 × dung sai vị trí.
 * - COD-002: mã đang chạy — khung theo chiều chạy phải chứa mã đủ lâu cho N lần chụp:
 *   cửa sổ W = vùng nhìn dọc − mã dọc − 2 × dung sai dọc; fps ≥ N × v ÷ W.
 * - COD-003: đầu đọc liền khối — vùng nhìn theo góc nhìn ở khoảng cách đọc; khoảng đọc
 *   hợp lệ = [đủ phủ vùng nhìn ; còn đủ mịn] ∩ dải lấy nét của đầu đọc.
 * - Hướng camera + phần mềm dùng lại đúng bộ kiểm của trang Chọn camera (CAM-001/002).
 */

export type CodeType = 'barcode_1d' | 'datamatrix' | 'qr' | 'dpm';
export const CODE_TYPES: readonly CodeType[] = ['barcode_1d', 'datamatrix', 'qr', 'dpm'];

/** Loại mã → nhóm khai ở `code_types` của đầu đọc. */
const READER_CLASS: Record<CodeType, string> = { barcode_1d: '1D', datamatrix: '2D', qr: '2D', dpm: 'DPM' };

export type CodeReaderInput = {
  codeType: CodeType;
  /** Module nhỏ nhất: vạch hẹp nhất (1D) hoặc một ô (2D), mm. */
  moduleMm: number;
  codeWidthMm: number;
  codeHeightMm: number;
  /** Dung sai vị trí mã trên sản phẩm (±), mm. */
  toleranceXMm: number;
  toleranceYMm: number;
  /** Tốc độ mã chạy qua khi đọc (mm/s); null = đứng yên. */
  speedMmS: number | null;
  /** Chiều chạy dọc theo chiều rộng (x) hay chiều cao (y) của mã. */
  motionAxis: 'x' | 'y';
  /** Vùng nhìn theo chiều chạy do người dùng đặt (mm); null = tự tính (cửa sổ = một chiều dài mã). */
  fovAlongMm: number | null;
  partsPerMinute: number | null;
  /** Số lần chụp tối thiểu khi mã đi qua khung (COD-002). */
  minReads: number;
  /** Khoảng cách đọc mong muốn cho đầu đọc liền khối (mm); null = tự tìm. */
  workingDistanceMm: number | null;
};

export type CodeNeed = {
  pxPerModule: number;
  mmPerPx: number;
  fovWidthMm: number;
  fovHeightMm: number;
  pxW: number;
  pxH: number;
  megapixels: number;
  /** COD-002: cửa sổ mã nằm trọn trong khung theo chiều chạy (mm); null khi đứng yên. */
  readWindowMm: number | null;
  fpsForReads: number | null;
  fpsFromRate: number | null;
  fpsNeeded: number | null;
  blurPx: number;
  exposureMaxUs: number | null;
  strobeRequired: boolean;
};

export function pxPerModuleFor(type: CodeType, params: EngineParams = DEFAULT_ENGINE_PARAMS): number {
  return type === 'barcode_1d' ? params.codePxPerModule1d : type === 'dpm' ? params.codePxPerModuleDpm : params.codePxPerModule2d;
}

export function codeNeed(input: CodeReaderInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): CodeNeed {
  const pxPerModule = pxPerModuleFor(input.codeType, params);
  const mmPerPx = input.moduleMm / pxPerModule;
  let fovWidthMm = input.codeWidthMm + 2 * input.toleranceXMm;
  let fovHeightMm = input.codeHeightMm + 2 * input.toleranceYMm;
  const v = input.speedMmS !== null && input.speedMmS > 0 ? input.speedMmS : null;
  let readWindowMm: number | null = null;
  let fpsForReads: number | null = null;
  if (v !== null) {
    const codeAlong = input.motionAxis === 'x' ? input.codeWidthMm : input.codeHeightMm;
    const tolAlong = input.motionAxis === 'x' ? input.toleranceXMm : input.toleranceYMm;
    const minAlong = codeAlong + 2 * tolAlong;
    // Không đặt vùng nhìn dọc thì lấy cửa sổ bằng một chiều dài mã (khung dài khoảng gấp đôi mã).
    const along = input.fovAlongMm !== null && input.fovAlongMm > minAlong ? input.fovAlongMm : minAlong + codeAlong;
    if (input.motionAxis === 'x') fovWidthMm = along;
    else fovHeightMm = along;
    readWindowMm = along - minAlong;
    fpsForReads = (Math.max(1, input.minReads) * v) / readWindowMm;
  }
  const fpsFromRate = input.partsPerMinute !== null && input.partsPerMinute > 0 ? input.partsPerMinute / 60 : null;
  const fpsNeeded = fpsForReads === null && fpsFromRate === null ? null : Math.max(fpsForReads ?? 0, fpsFromRate ?? 0);
  const pxW = Math.ceil(fovWidthMm / mmPerPx - 1e-9);
  const pxH = Math.ceil(fovHeightMm / mmPerPx - 1e-9);
  const blurPx = blurPxFor(params, false);
  const exposureMaxUs = v !== null ? maxExposureUs(blurPx, mmPerPx, v) : null;
  return {
    pxPerModule,
    mmPerPx,
    fovWidthMm,
    fovHeightMm,
    pxW,
    pxH,
    megapixels: (pxW * pxH) / 1e6,
    readWindowMm,
    fpsForReads,
    fpsFromRate,
    fpsNeeded,
    blurPx,
    exposureMaxUs,
    strobeRequired: exposureMaxUs !== null && exposureMaxUs < params.strobeExposureLimitUs,
  };
}

/** Đầu vào trang Chọn camera tương ứng — hướng camera + phần mềm dùng lại CAM-001/002. */
export function cameraInputFor(input: CodeReaderInput, need: CodeNeed): AreaCameraInput {
  return {
    fovWidthMm: need.fovWidthMm,
    fovHeightMm: need.fovHeightMm,
    targetMmPerPx: need.mmPerPx,
    color: 'any',
    measuring: false,
    speedMmS: input.speedMmS,
    // fps cần (đọc đủ N lần hoặc theo sản lượng) đưa vào dạng "ảnh/phút".
    partsPerMinute: need.fpsNeeded !== null ? need.fpsNeeded * 60 : null,
    imagesPerPart: 1,
    triggerSource: 'encoder',
    sensorResponseMs: null,
    sampleExposureMs: null,
    overlapped: true,
  };
}

export function selectCodeCameras(components: Component[], input: CodeReaderInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): AreaCandidate[] {
  const need = codeNeed(input, params);
  const area = cameraInputFor(input, need);
  return components
    .filter((c) => c.kind === 'camera' && specString(c.spec, 'camera_type') !== 'line')
    .map((c) => evaluateAreaCamera(c, area, params))
    .sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
      return 0;
    });
}

// ════════════════════════════════════════════════════ ĐẦU ĐỌC MÃ LIỀN KHỐI ══

export type ReaderCandidate = {
  component: Component;
  status: CheckStatus;
  pxLong: number | null;
  pxShort: number | null;
  /** Góc nhìn theo cạnh dài / ngắn (°). */
  aovLongDeg: number | null;
  aovShortDeg: number | null;
  /** COD-003: khoảng đọc hợp lệ (mm); null khi không có / thiếu thông số. */
  wdRange: { minMm: number; maxMm: number } | null;
  /** Khoảng đọc dùng để báo số: anh nhập, hoặc đầu dưới của khoảng hợp lệ. */
  wdUsedMm: number | null;
  mmPerPx: number | null;
  margin: number | null;
  fovLongMm: number | null;
  fovShortMm: number | null;
  decodeRateHz: number | null;
  checks: Check[];
  rank: number[];
};

const STATUS_RANK: Record<CheckStatus, number> = { pass: 0, warn: 1, info: 2, fail: 3 };
const worst = (checks: Check[]): CheckStatus =>
  checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : checks.some((c) => c.status === 'pass') || checks.length === 0 ? 'pass' : 'info';
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Góc nhìn theo một trục: datasheet ghi thẳng, hoặc 2·atan(cạnh cảm biến ÷ 2f). */
function aovDeg(given: number | null, px: number, pitchUm: number | null, focalMm: number | null): number | null {
  if (given !== null && given > 0) return given;
  if (pitchUm === null || focalMm === null || !(focalMm > 0) || !(px > 0)) return null;
  return (2 * Math.atan((px * pitchUm) / 1000 / (2 * focalMm)) * 180) / Math.PI;
}

export function evaluateReader(component: Component, input: CodeReaderInput, params: EngineParams = DEFAULT_ENGINE_PARAMS, need: CodeNeed = codeNeed(input, params)): ReaderCandidate {
  const s = component.spec;
  const checks: Check[] = [];
  const w = specNumber(s, 'resolution_w_px') ?? 0;
  const h = specNumber(s, 'resolution_h_px') ?? 0;
  const pitch = specNumber(s, 'pixel_size_um');
  const focal = specNumber(s, 'focal_length_mm');
  const aovW = aovDeg(specNumber(s, 'aov_h_deg'), w, pitch, focal);
  const aovH = aovDeg(specNumber(s, 'aov_v_deg'), h, pitch, focal);
  const longIsW = w >= h;
  const pxLong = w > 0 && h > 0 ? Math.max(w, h) : null;
  const pxShort = w > 0 && h > 0 ? Math.min(w, h) : null;
  const aovLong = longIsW ? aovW : aovH;
  const aovShort = longIsW ? aovH : aovW;
  const decodeRateHz = specNumber(s, 'decode_rate_hz');
  const wdMin = specNumber(s, 'wd_min_mm');
  const wdMax = specNumber(s, 'wd_max_mm');
  const needLong = Math.max(need.fovWidthMm, need.fovHeightMm);
  const needShort = Math.min(need.fovWidthMm, need.fovHeightMm);

  // ─── loại mã ───
  const types = specList(s, 'code_types');
  const want = READER_CLASS[input.codeType];
  if (types.length === 0) checks.push({ key: 'codeType', status: 'info', formula: '—', noteKey: 'codeTypeUnknown' });
  else if (!types.includes(want)) checks.push({ key: 'codeType', status: 'fail', formula: `${want} ∉ ${types.join(', ')}`, noteKey: 'codeTypeMissing', noteValues: { type: want } });

  // ─── COD-003: khoảng đọc = [đủ phủ ; còn đủ mịn] ∩ dải lấy nét ───
  let wdRange: ReaderCandidate['wdRange'] = null;
  let wdUsedMm: number | null = null;
  let mmPerPx: number | null = null;
  let margin: number | null = null;
  let fovLongMm: number | null = null;
  let fovShortMm: number | null = null;
  if (pxLong === null || aovLong === null || aovShort === null) {
    checks.push({ key: 'readingRange', status: 'info', formula: '—', noteKey: 'readerOpticsUnknown' });
  } else {
    const tL = 2 * Math.tan(toRad(aovLong) / 2);
    const tS = 2 * Math.tan(toRad(aovShort) / 2);
    const wdCover = Math.max(needLong / tL, needShort / tS);
    const wdRes = (need.mmPerPx * pxLong) / tL;
    const lo = Math.max(wdCover, wdMin ?? 0);
    const hi = Math.min(wdRes, wdMax ?? Infinity);
    const at = (wd: number) => {
      fovLongMm = wd * tL;
      fovShortMm = wd * tS;
      mmPerPx = Math.max(fovLongMm / pxLong, fovShortMm / pxShort!);
      margin = need.mmPerPx / mmPerPx;
    };
    const values = { cover: Math.round(wdCover), res: Math.round(wdRes), min: wdMin ?? '—', max: wdMax ?? '—' };
    if (input.workingDistanceMm !== null) {
      const wd = input.workingDistanceMm;
      wdUsedMm = wd;
      at(wd);
      const inFocus = (wdMin === null || wd >= wdMin) && (wdMax === null || wd <= wdMax);
      const covers = wd >= wdCover * (1 - 1e-9);
      const fine = wd <= wdRes * (1 + 1e-9);
      const status: CheckStatus = covers && fine && inFocus ? 'pass' : 'fail';
      checks.push({
        key: 'readingRange',
        status,
        formula: `${fmt(wdCover, 0)} ≤ ${fmt(wd, 0)} ≤ ${fmt(wdRes, 0)} mm${wdMin !== null || wdMax !== null ? ` · ${wdMin ?? '—'}–${wdMax ?? '—'} mm` : ''}`,
        noteKey: !covers ? 'wdTooClose' : !fine ? 'wdTooFar' : !inFocus ? 'wdOutOfFocus' : 'wdOk',
        noteValues: { ...values, wd: Math.round(wd), have: round(mmPerPx!, 4) },
      });
    } else if (lo <= hi) {
      wdRange = { minMm: lo, maxMm: hi };
      wdUsedMm = lo;
      at(lo);
      checks.push({
        key: 'readingRange',
        status: 'pass',
        formula: `max(${fmt(wdCover, 0)}, ${wdMin ?? 0}) … min(${fmt(wdRes, 0)}, ${wdMax ?? '∞'}) = ${fmt(lo, 0)}–${fmt(hi, 0)} mm`,
        noteKey: 'wdWindow',
        noteValues: { ...values, lo: Math.round(lo), hi: Number.isFinite(hi) ? Math.round(hi) : '∞' },
      });
    } else {
      checks.push({
        key: 'readingRange',
        status: 'fail',
        formula: `max(${fmt(wdCover, 0)}, ${wdMin ?? 0}) > min(${fmt(wdRes, 0)}, ${wdMax ?? '∞'})`,
        noteKey: wdCover > wdRes ? 'wdNoWindowPixels' : 'wdNoWindowFocus',
        noteValues: values,
      });
    }
  }

  // ─── tốc độ giải mã ≥ fps cần ───
  if (need.fpsNeeded !== null) {
    if (decodeRateHz !== null && decodeRateHz > 0) {
      const keep = 1 - params.cycleMinMargin;
      const status: CheckStatus = need.fpsNeeded <= decodeRateHz * keep ? 'pass' : need.fpsNeeded <= decodeRateHz ? 'warn' : 'fail';
      checks.push({
        key: 'decodeRate',
        status,
        formula: `${fmt(need.fpsNeeded, 1)} ${status === 'fail' ? '>' : '≤'} ${fmt(decodeRateHz, 0)}${status === 'pass' ? ` × ${fmt(keep, 2)}` : ''}`,
        noteKey: status === 'pass' ? 'decodeOk' : status === 'warn' ? 'decodeTight' : 'decodeTooSlow',
        noteValues: { need: round(need.fpsNeeded, 1), max: decodeRateHz, margin: Math.round(params.cycleMinMargin * 100) },
      });
    } else {
      checks.push({ key: 'decodeRate', status: 'info', formula: '—', noteKey: 'decodeUnknown' });
    }
  }

  // ─── mã đang chạy: shutter + phơi chống nhoè ───
  if (input.speedMmS !== null && input.speedMmS > 0) {
    const shutter = specString(s, 'shutter');
    if (shutter === 'rolling') checks.push({ key: 'shutter', status: 'fail', formula: 'rolling shutter', noteKey: 'rollingShutter' });
    if (mmPerPx !== null) {
      const us = maxExposureUs(need.blurPx, mmPerPx, input.speedMmS);
      const strobe = us < params.strobeExposureLimitUs;
      checks.push({ key: 'exposure', status: strobe ? 'warn' : 'pass', formula: `${need.blurPx} × ${fmt(mmPerPx, 4)} ÷ ${fmt(input.speedMmS)} = ${fmt(us, 0)} µs`, noteKey: strobe ? 'readerExposureShort' : 'exposureOk', noteValues: { us: Math.round(us), limit: params.strobeExposureLimitUs } });
    }
  }

  const status = worst(checks);
  const m = margin ?? 0;
  return {
    component,
    status,
    pxLong,
    pxShort,
    aovLongDeg: aovLong,
    aovShortDeg: aovShort,
    wdRange,
    wdUsedMm,
    mmPerPx,
    margin,
    fovLongMm,
    fovShortMm,
    decodeRateHz,
    checks,
    // Đạt trước, rồi khoảng đọc rộng hơn (dễ lắp), rồi giá.
    rank: [STATUS_RANK[status], wdRange ? -Math.round(Math.min(wdRange.maxMm, 1e6) - wdRange.minMm) : 0, -Math.round(m * 10), component.price_vnd ?? Number.MAX_SAFE_INTEGER],
  };
}

export function selectReaders(components: Component[], input: CodeReaderInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): ReaderCandidate[] {
  const need = codeNeed(input, params);
  return components
    .filter((c) => c.kind === 'code_reader')
    .map((c) => evaluateReader(c, input, params, need))
    .sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
      return 0;
    });
}
