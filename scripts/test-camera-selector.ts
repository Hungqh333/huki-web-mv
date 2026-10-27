/**
 * Bộ chọn camera (chốt 2026-10-27, Q1–Q8) — area scan / tốc độ cao và line scan.
 * Số tính tay ghi cạnh từng assert.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Component } from '../src/lib/components/specs';
import {
  areaNeed,
  evaluateAreaCamera,
  evaluateLineCamera,
  lineCameraCount,
  selectAreaCameras,
  selectLineCameras,
  targetMmPerPx,
  type AreaCameraInput,
  type LineCameraInput,
} from '../src/lib/vision/cameraSelector';
import type { Check } from '../src/lib/vision/types';

let id = 0;
const cam = (model: string, spec: Record<string, unknown>, price: number | null = null): Component => ({
  id: `c${++id}`,
  code: model,
  kind: 'camera',
  brand: 'T',
  model,
  spec: { camera_type: 'area', color: 'mono', shutter: 'global', trigger_io: 'yes', interface: 'GigE', ...spec },
  price_vnd: price,
  datasheet_url: null,
  source: 'datasheet',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: id,
});
const area = (w: number, h: number, fps: number | null, extra: Record<string, unknown> = {}) =>
  cam(`A${w}x${h}`, { resolution_w_px: w, resolution_h_px: h, pixel_size_um: 3.45, ...(fps !== null ? { max_fps: fps } : {}), ...extra });
const line = (px: number, pitch: number, khz: number, extra: Record<string, unknown> = {}) =>
  cam(`L${px}`, { camera_type: 'line', line_width_px: px, pixel_size_um: pitch, max_line_rate_khz: khz, ...extra });
const check = (checks: Check[], key: string) => checks.find((c) => c.key === key)!;

const AREA: AreaCameraInput = {
  fovWidthMm: 100,
  fovHeightMm: 80,
  targetMmPerPx: 0.05,
  color: 'any',
  measuring: false,
  speedMmS: null,
  partsPerMinute: null,
  imagesPerPart: 1,
  triggerSource: 'photoSensor',
  sensorResponseMs: null,
  sampleExposureMs: null,
  overlapped: true,
};
const LINE: LineCameraInput = { widthMm: 500, speedMmS: 2000, targetMmPerPx: 0.1, color: 'any', encoderUm: null };

test('mm/px cần: số nhập, hoặc lỗi ÷ px theo tương phản (chưa rõ = thấp)', () => {
  assert.deepEqual(targetMmPerPx({ mmPerPx: 0.04, defectMm: 0.3, contrast: 'high' }), { mmPerPx: 0.04, pxPerDefect: null });
  assert.deepEqual(targetMmPerPx({ mmPerPx: null, defectMm: 0.3, contrast: 'medium' }), { mmPerPx: 0.075, pxPerDefect: 4 });
  assert.equal(targetMmPerPx({ mmPerPx: null, defectMm: 0.3, contrast: 'unknown' })!.pxPerDefect, 5);
  assert.equal(targetMmPerPx({ mmPerPx: null, defectMm: null, contrast: 'high' }), null);
});

test('area: pixel phủ vùng nhìn, xếp camera dư ≥ 1,3× lên trước', () => {
  const need = areaNeed(AREA);
  assert.deepEqual([need.pxLong, need.pxShort, need.megapixels, need.fpsNeeded, need.exposureMaxUs], [2000, 1600, 3.2, null, null]);

  // 2448×2048: max(100/2448, 80/2048) = 0,04085 ≤ 0,05 → dư 1,22×
  const a = evaluateAreaCamera(area(2448, 2048, 23), AREA);
  assert.equal(a.status, 'pass');
  assert.ok(Math.abs(a.mmPerPx! - 100 / 2448) < 1e-12);
  assert.equal(Math.round(a.margin! * 100), 122);
  // 1920×1200: 80/1200 = 0,0667 > 0,05 → loại
  assert.deepEqual([evaluateAreaCamera(area(1920, 1200, 40), AREA).status, check(evaluateAreaCamera(area(1920, 1200, 40), AREA).checks, 'pixels').noteKey], ['fail', 'pixelsShort']);

  // 5472×3648 dư 2,28× (≥ 1,3) đứng trước 2448×2048 dư 1,22×; loại xuống cuối
  const order = selectAreaCameras([area(1920, 1200, 40), area(2448, 2048, 23), area(5472, 3648, 6)], AREA).candidates.map((c) => c.component.model);
  assert.deepEqual(order, ['A5472x3648', 'A2448x2048', 'A1920x1200']);
});

test('area tốc độ cao: fps, ROI, băng thông, shutter, phơi sáng', () => {
  // Dải 100 × 20 mm, 1200 sp/phút × 2 ảnh = 40 fps; camera 23 fps → ROI 490/2048 hàng: cảm biến ≈ 96 fps,
  // nhưng GigE chỉ chở 70 % × 110 MB/s ÷ (2448 × 490) = 64,2 fps → fps thật ROI 64 (giới hạn bởi cổng, CAM-002)
  const strip: AreaCameraInput = { ...AREA, fovHeightMm: 20, partsPerMinute: 1200, imagesPerPart: 2 };
  const roi = evaluateAreaCamera(area(2448, 2048, 23), strip);
  const fps = check(roi.checks, 'fps');
  assert.deepEqual([fps.status, fps.noteKey, fps.noteValues?.rows, fps.noteValues?.roi, roi.fpsLimiter], ['warn', 'fpsWithRoi', 490, 64, 'interface']);
  // Băng thông tính theo ROI: 2448 × 490 × 1 × 40 = 47,98 MB/s ≤ 70 % × 110
  assert.ok(Math.abs(roi.dataRateMBs! - (2448 * 490 * 40) / 1e6) < 1e-9);
  assert.equal(check(roi.checks, 'bandwidth').status, 'pass');

  // 100 fps > 96 × 0,7 và > 96 → loại
  assert.equal(check(evaluateAreaCamera(area(2448, 2048, 23), { ...strip, partsPerMinute: 3000 }).checks, 'fps').noteKey, 'fpsTooLow');
  // Chưa khai fps → chưa kiểm được, không loại (10 ảnh/giây hết khung: 50 MB/s ≤ 77)
  const unknownFps = evaluateAreaCamera(area(2448, 2048, null), { ...strip, partsPerMinute: 300 });
  assert.deepEqual([unknownFps.status, check(unknownFps.checks, 'fps').noteKey], ['pass', 'fpsUnknown']);

  // Vật chạy 1000 mm/s, bài phát hiện lỗi: t_max = 1 × 0,04085 ÷ 1000 = 40,9 µs < 50 → strobe
  const moving = evaluateAreaCamera(area(2448, 2048, 23), { ...AREA, speedMmS: 1000 });
  assert.deepEqual([check(moving.checks, 'exposure').status, check(moving.checks, 'exposure').noteValues?.us], ['warn', 41]);
  // Bài đo: 0,5 px → 20,4 µs
  assert.equal(check(evaluateAreaCamera(area(2448, 2048, 23), { ...AREA, speedMmS: 1000, measuring: true }).checks, 'exposure').noteValues?.us, 20);
  assert.equal(evaluateAreaCamera(area(2448, 2048, 23, { shutter: 'rolling' }), { ...AREA, speedMmS: 1000 }).status, 'fail');
  assert.equal(evaluateAreaCamera(area(2448, 2048, 23, { shutter: 'rolling' }), AREA).status, 'pass', 'dung yen: rolling van dung duoc');

  // Lọc màu
  assert.equal(evaluateAreaCamera(area(2448, 2048, 23, { color: 'color' }), { ...AREA, color: 'mono' }).status, 'fail');
});

test('bảng tính tốc độ cao (Q1): t_max, vật đi giữa 2 ảnh, lệch trigger, hệ số sáng', () => {
  // 2000 mm/s, 600 sp/phút × 2 ảnh = 20 ảnh/s; phát hiện lỗi 1 px: 1 × 0,05 ÷ 2000 = 25 µs
  const need = areaNeed({ ...AREA, speedMmS: 2000, partsPerMinute: 600, imagesPerPart: 2 });
  assert.deepEqual([need.fpsNeeded, need.travelPerFrameMm, need.blurPx, need.exposureMaxUs, need.strobeRequired], [20, 100, 1, 25, true]);
  // Cảm biến 0,5 ms (giả định) + camera phần cứng 0,01 ms → 2000 × 0,51 ÷ 1000 = 1,02 mm = 20,4 px; 1,02 ÷ 80 = 1,3 %
  const trig = need.trigger as Extract<NonNullable<typeof need.trigger>, { shiftMm: number }>;
  assert.deepEqual([trig.sensorAssumed, trig.cameraMs, Math.round(trig.shiftMm * 100), Math.round(trig.px * 10), trig.over], [true, 0.01, 102, 204, false]);
  // Trigger phần mềm: 0,5 + 1 ms → 3 mm = 3,75 % — vẫn dưới 5 %
  const sw = areaNeed({ ...AREA, speedMmS: 2000, triggerSource: 'software' }).trigger as typeof trig;
  assert.equal(sw.shiftMm, 3);
  assert.deepEqual(areaNeed({ ...AREA, speedMmS: 2000, triggerSource: 'encoder' }).trigger, { source: 'encoder' });
  // Ánh sáng: ước tính 1 ms ÷ 25 µs = ×40 > ×10; duty 25 µs × 20 = 0,05 %
  assert.deepEqual([need.light!.assumed, need.light!.boost, need.light!.verdict, Math.round(need.light!.duty! * 1e4)], [true, 40, 'boostTooHigh', 5]);
  // Bài đo: 0,5 px → 12,5 µs; đứng yên → không có trigger / ánh sáng
  assert.equal(areaNeed({ ...AREA, speedMmS: 2000, measuring: true }).exposureMaxUs, 12.5);
  assert.deepEqual([areaNeed(AREA).trigger, areaNeed(AREA).light, areaNeed(AREA).travelPerFrameMm], [null, null, null]);
});

test('CAM-002 fps thật: thời gian phơi và cổng giao tiếp chặn fps datasheet', () => {
  // GigE: 70 % × 110 ÷ (2448 × 2048 × 1) = 15,36 fps < 23 → giới hạn bởi cổng
  const gige = evaluateAreaCamera(area(2448, 2048, 23), { ...AREA, partsPerMinute: 600 });
  assert.deepEqual([Math.round(gige.fpsReal! * 100), gige.fpsLimiter, check(gige.checks, 'fps').status], [1536, 'interface', 'pass']);

  // CXP-12, đứng yên, phơi mẫu 50 ms: chồng phơi → 1 ÷ max(1/23, 0,05) = 20 fps (giới hạn bởi phơi)
  const cxp = area(2448, 2048, 23, { interface: 'CXP-12' });
  const overlapped = evaluateAreaCamera(cxp, { ...AREA, partsPerMinute: 600, sampleExposureMs: 50 });
  assert.deepEqual([Math.round(overlapped.fpsReal! * 100), overlapped.fpsLimiter, check(overlapped.checks, 'fps').status], [2000, 'exposure', 'pass']);
  // Không chồng: 1 ÷ (1/23 + 0,05) = 10,70 fps; cần 10 > 10,70 × 0,7 → ROI cũng không đủ biên → sát
  const serial = evaluateAreaCamera(cxp, { ...AREA, partsPerMinute: 600, sampleExposureMs: 50, overlapped: false });
  assert.deepEqual([Math.round(serial.fpsReal! * 100), check(serial.checks, 'fps').noteKey], [1070, 'fpsTight']);
});

test('CAM-003 độ nhạy: khi phải strobe, camera ăn sáng hơn lên trước; chưa khai QE xếp sau', () => {
  const x = area(2448, 2048, 200, { interface: 'CXP-12', qe_percent: 70, pixel_size_um: 3.45 });
  const y = area(2448, 2048, 200, { interface: 'CXP-12', qe_percent: 60, pixel_size_um: 5, saturation_e: 10000, dark_noise_e: 2.5 });
  const z = area(2448, 2048, 200, { interface: 'CXP-12' });
  // 3000 mm/s: 1 × 0,05 ÷ 3000 = 16,7 µs < 50 → strobe; Y = 0,6 × 25 = 15 µm² > X = 0,7 × 11,9 = 8,33
  const { candidates } = selectAreaCameras([z, x, y], { ...AREA, speedMmS: 3000 });
  assert.deepEqual(candidates.map((c) => c.component.id), [y.id, x.id, z.id]);
  assert.equal(candidates[0].sensitivityRel, 1);
  assert.equal(Math.round(candidates[1].sensitivityRel! * 1000), 555);
  assert.equal(candidates[2].sensitivityRel, null);
  assert.equal(Math.round(candidates[0].dynamicRangeDb! * 10), 720, '20 log(10000 / 2,5) = 72 dB');
  assert.equal(check(candidates[2].checks, 'sensitivity').noteKey, 'sensitivityUnknown');
});

test('line scan: số camera ghép, tần số dòng, phơi, băng thông, encoder', () => {
  // 4096 px: 500/4096 = 0,122 > 0,1 → 2 camera: (250 + 25) ÷ 4096 = 0,0671
  assert.deepEqual(lineCameraCount({ widthMm: 500, linePx: 4096, targetMmPerPx: 0.1 }), { count: 2, tileWidthMm: 275, overlapMm: 25 });

  // 8192 px × 5 µm, 120 kHz, CXP-12 × 4: 1 camera 0,061 mm/px; 2000 ÷ 0,061 = 32,77 kHz; phơi 30,5 µs; 268 MB/s
  const big = evaluateLineCamera(line(8192, 5, 120, { interface: 'CXP-12', cxp_lanes: 4 }), LINE);
  assert.equal(big.cameraCount, 1);
  assert.equal(Math.round(big.lineRateHz!), 32768);
  assert.equal(check(big.checks, 'lineRate').status, 'pass');
  assert.deepEqual([check(big.checks, 'lineExposure').status, check(big.checks, 'lineExposure').noteValues?.us], ['warn', 30.5]);
  assert.equal(check(big.checks, 'bandwidth').status, 'pass');
  assert.equal(check(big.checks, 'encoder').noteKey, 'encoderMissing');
  assert.equal(Math.round(big.beta! * 1e5), 8192, 'beta = 40,96 ÷ 500');
  assert.equal(check(big.checks, 'lineExposure').noteKey, 'lineExposureShortNoTdi', 'goi y TDI / multiline / binning');
  // TDI 64 tầng (Q6): 64 × 30,5 = 1953 µs → đủ
  const tdi = evaluateLineCamera(line(8192, 5, 120, { interface: 'CXP-12', cxp_lanes: 4, tdi_stages: 64 }), LINE);
  assert.deepEqual([tdi.tdiStages, Math.round(tdi.exposureUs!), check(tdi.checks, 'lineExposure').noteKey], [64, 1953, 'lineExposureTdiOk']);

  // 4096 px GigE: 2 camera, 29,8 kHz × 4096 = 122 MB/s > 77 → loại
  const mid = evaluateLineCamera(line(4096, 7, 48), LINE);
  assert.deepEqual([mid.cameraCount, mid.status, check(mid.checks, 'bandwidth').noteKey], [2, 'fail', 'bandwidthOver']);

  // 2048 px GigE: 3 camera, (166,7 + 16,7) ÷ 2048 = 0,0895; 22,3 kHz; 45,8 MB/s
  const small = evaluateLineCamera(line(2048, 14, 49), LINE);
  assert.deepEqual([small.cameraCount, check(small.checks, 'lineWidth').noteKey, check(small.checks, 'bandwidth').status], [3, 'lineMultiCamera', 'pass']);

  // Xếp: 8192 (1 camera) → 2048 (3 camera) → 4096 (loại)
  assert.deepEqual(selectLineCameras([line(4096, 7, 48), line(2048, 14, 49), line(8192, 5, 120, { interface: 'CXP-12', cxp_lanes: 4 })], LINE).map((c) => c.component.model), ['L8192', 'L2048', 'L4096']);

  // 4500 mm/s: cần 50,3 kHz > 49 → pixel dọc 4500 ÷ 49 000 = 0,0918 ≤ 0,1 → pixel chữ nhật, lưu ý
  assert.equal(check(evaluateLineCamera(line(2048, 14, 49), { ...LINE, speedMmS: 4500 }).checks, 'lineRate').noteKey, 'lineRectPixel');
  // 6000 mm/s: pixel dọc 0,1224 > 0,1 → loại
  assert.equal(evaluateLineCamera(line(2048, 14, 49), { ...LINE, speedMmS: 6000 }).status, 'fail');

  // Encoder: một dòng = 2000 ÷ 22 341 = 89,5 µm
  assert.equal(check(evaluateLineCamera(line(2048, 14, 49), { ...LINE, encoderUm: 20 }).checks, 'encoder').status, 'pass');
  assert.equal(check(evaluateLineCamera(line(2048, 14, 49), { ...LINE, encoderUm: 100 }).checks, 'encoder').noteKey, 'encoderCoarse');

  // Quá 8 camera → loại
  assert.equal(check(evaluateLineCamera(line(512, 14, 49), { ...LINE, widthMm: 5000 }).checks, 'lineWidth').noteKey, 'lineTooManyCameras');
  // Tab line chỉ lấy camera line, tab area chỉ lấy area
  assert.equal(selectLineCameras([area(2448, 2048, 23)], LINE).length, 0);
  assert.equal(selectAreaCameras([line(2048, 14, 49)], AREA).candidates.length, 0);
});

test('mọi khoá chữ của trang Chọn camera có đủ vi/en', () => {
  const comps = [area(2448, 2048, 23), area(1920, 1200, 40, { color: 'color', shutter: 'rolling' }), area(2448, 2048, null, { shutter: undefined })];
  const strip: AreaCameraInput = { ...AREA, fovHeightMm: 20, partsPerMinute: 1200, imagesPerPart: 2, speedMmS: 3000, color: 'mono' };
  const checks = [
    ...comps.flatMap((c) => [evaluateAreaCamera(c, strip).checks, evaluateAreaCamera(c, { ...AREA, partsPerMinute: 900 }).checks, evaluateAreaCamera(c, { ...AREA, partsPerMinute: 3000, speedMmS: 100 }).checks]),
    evaluateAreaCamera(area(2448, 2048, 23), { ...strip, partsPerMinute: 3000 }).checks,
    evaluateAreaCamera(cam('blank', {}), AREA).checks,
    ...[LINE, { ...LINE, speedMmS: 4500, encoderUm: 20 }, { ...LINE, speedMmS: 6000, encoderUm: 100 }, { ...LINE, widthMm: 5000 }, { ...LINE, speedMmS: 300 }, { ...LINE, speedMmS: 3200 }].flatMap((input) =>
      [line(8192, 5, 120), line(8192, 5, 120, { tdi_stages: 32 }), line(2048, 14, 49), line(4096, 7, 48), line(512, 14, 49), cam('Lx', { camera_type: 'line', line_width_px: 4096 }), cam('L0', { camera_type: 'line' })].map((c) => evaluateLineCamera(c, input).checks)
    ),
  ].flat();
  const notes = new Set(checks.map((c) => c.noteKey).filter(Boolean));
  for (const key of ['pixelsOk', 'pixelsShort', 'fpsWithRoi', 'fpsTooLow', 'fpsUnknown', 'rollingShutter', 'exposureStrobe', 'colorMismatch', 'lineSingleCamera', 'lineMultiCamera', 'lineTooManyCameras', 'lineRectPixel', 'lineRateTooHigh', 'lineRateUnknown', 'lineExposureShortNoTdi', 'lineExposureTdiOk', 'sensitivityUnknown', 'encoderCoarse', 'encoderOk', 'encoderMissing', 'bandwidthOver', 'lineWidthUnknown']) {
    assert.ok(notes.has(key), `kich ban chua phu ${key}`);
  }
  for (const locale of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const c of checks) {
      assert.ok(m.cameraSelector.checks[c.key], `${locale} checks.${c.key}`);
      if (c.noteKey) assert.ok(m.cameraSelector.notes[c.noteKey], `${locale} notes.${c.noteKey}`);
    }
    assert.ok(m.nav.camera, `${locale} nav.camera`);
  }
});
