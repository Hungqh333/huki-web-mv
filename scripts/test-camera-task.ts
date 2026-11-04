/**
 * Ô "Bài toán" của trang Chọn camera (chốt 2026-10-31, Q1–Q5). Số tính tay ghi cạnh từng assert.
 *
 * Mỗi bài toán phải ra đúng mm/px và vùng nhìn của luật gốc (RES-001, RES-002, OCR-001, COD-001,
 * ROB-001), và OCR / đọc mã phải khớp tuyệt đối với trang chuyên sâu (Q2: cùng hàm).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CAMERA_TASKS, TASK_DEFAULT_COLOR, TASK_MEASURING, TASK_SLUG, robotNeed, taskCamera, taskFromSlug, type TaskCommon } from '../src/lib/vision/cameraTask';
import { cameraInputFor, codeNeed } from '../src/lib/vision/codeReader';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';
import { ocrNeed } from '../src/lib/vision/ocr';
import { measurementBudget } from '../src/lib/vision/resolution';

const P = DEFAULT_ENGINE_PARAMS;
const COMMON: TaskCommon = {
  mmPerPxOverride: null,
  color: 'any',
  speedMmS: null,
  partsPerMinute: 60,
  imagesPerPart: 2,
  triggerSource: 'photoSensor',
  sensorResponseMs: null,
  sampleExposureMs: null,
  overlapped: true,
};
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('URL ?bai-toan= đi hai chiều; slug lạ → ngoại quan', () => {
  for (const task of CAMERA_TASKS) assert.equal(taskFromSlug(TASK_SLUG[task]), task);
  assert.equal(taskFromSlug('khong-co'), 'inspection');
  assert.equal(taskFromSlug(null), 'inspection');
  assert.equal(new Set(Object.values(TASK_SLUG)).size, CAMERA_TASKS.length);
});

test('mặc định: đo / OCR / mã chạy mono; đo + robot dùng nhoè bài đo', () => {
  assert.deepEqual(
    CAMERA_TASKS.map((t) => TASK_DEFAULT_COLOR[t]),
    ['any', 'mono', 'mono', 'mono', 'any']
  );
  assert.deepEqual(
    CAMERA_TASKS.map((t) => TASK_MEASURING[t]),
    [false, true, false, false, true]
  );
});

test('ngoại quan = RES-001: lỗi 0,2 mm, tương phản thấp → 0,2 ÷ 5 = 0,04 mm/px', () => {
  const r = taskCamera({ task: 'inspection', fovWidthMm: 100, fovHeightMm: 80, defectMm: 0.2, contrast: 'low' }, COMMON, P)!;
  close(r.camera.targetMmPerPx, 0.04);
  assert.equal(r.detail.task === 'inspection' && r.detail.pxPerDefect, 5);
  assert.equal(r.camera.measuring, false);
  assert.equal(r.camera.fovWidthMm, 100);
  assert.equal(r.camera.imagesPerPart, 2);
  // Thiếu lỗi nhỏ nhất và không ghi đè → chưa tính được.
  assert.equal(taskCamera({ task: 'inspection', fovWidthMm: 100, fovHeightMm: 80, defectMm: null, contrast: 'low' }, COMMON, P), null);
});

test('đo lường = RES-002: ±0,05 → T 0,1 → U 0,01 → 0,03 mm/px (0,6 × t), nhoè bài đo', () => {
  const r = taskCamera({ task: 'measurement', fovWidthMm: 50, fovHeightMm: 40, toleranceMm: 0.05 }, COMMON, P)!;
  close(r.camera.targetMmPerPx, 0.03);
  close(r.camera.targetMmPerPx, measurementBudget(0.05)!.mmPerPx);
  assert.equal(r.camera.measuring, true);
  // Ghi đè: dùng số nhập, vẫn báo số bài toán tính ra.
  const o = taskCamera({ task: 'measurement', fovWidthMm: 50, fovHeightMm: 40, toleranceMm: 0.05 }, { ...COMMON, mmPerPxOverride: 0.02 }, P)!;
  assert.equal(o.camera.targetMmPerPx, 0.02);
  assert.equal(o.overridden, true);
  close(o.derivedMmPerPx!, 0.03);
  // Không dung sai nhưng có mm/px nhập thẳng → vẫn chạy.
  const g = taskCamera({ task: 'measurement', fovWidthMm: 50, fovHeightMm: 40, toleranceMm: null }, { ...COMMON, mmPerPxOverride: 0.05 }, P)!;
  assert.equal(g.camera.targetMmPerPx, 0.05);
  assert.equal(g.derivedMmPerPx, null);
});

test('OCR = OCR-001, khớp tuyệt đối trang /chon-ocr (Q2)', () => {
  // Ký tự 2 mm ÷ 20 = 0,1; nét 0,2 ÷ 3 = 0,0667 → nét quyết định. Khối 60 × (2 + 1 × 3) = 60 × 5; vùng nhìn 66 × 9.
  const ocr = { charHeightMm: 2, strokeMm: 0.2, textWidthMm: 60, lines: 2, lineSpacingMm: null, toleranceXMm: 3, toleranceYMm: 2 };
  const r = taskCamera({ task: 'ocr', ocr }, COMMON, P)!;
  close(r.camera.targetMmPerPx, 0.2 / 3);
  close(r.camera.fovWidthMm, 66);
  close(r.camera.fovHeightMm, 9);
  const page = ocrNeed({ ...ocr, mode: 'ocr', printType: 'laser', background: 'plain', font: 'fixed', speedMmS: null, partsPerMinute: 60, triggerSource: 'photoSensor' }, P);
  assert.equal(r.camera.targetMmPerPx, page.mmPerPx);
  assert.equal(r.camera.fovWidthMm, page.fovWidthMm);
  assert.equal(r.camera.fovHeightMm, page.fovHeightMm);
});

test('đọc mã = COD-001/002, khớp tuyệt đối trang /chon-doc-ma (Q2)', () => {
  // DataMatrix module 0,25 ÷ 3 px = 0,0833 mm/px; mã 10 × 10, dung sai ±2 / ±1 → vùng nhìn 14 × 12.
  const code = { codeType: 'datamatrix' as const, moduleMm: 0.25, codeWidthMm: 10, codeHeightMm: 10, toleranceXMm: 2, toleranceYMm: 1, motionAxis: 'x' as const };
  const r = taskCamera({ task: 'code', code }, COMMON, P)!;
  close(r.camera.targetMmPerPx, 0.25 / 3);
  close(r.camera.fovWidthMm, 14);
  close(r.camera.fovHeightMm, 12);
  // Đứng yên: fps theo sản lượng 60/phút = 1 fps → 60 ảnh/phút, 1 ảnh mỗi lượt.
  assert.equal(r.camera.partsPerMinute, 60);
  assert.equal(r.camera.imagesPerPart, 1);

  // Mã chạy 200 mm/s theo x: cửa sổ = 14 + 10 = 24 → đọc 10 mm; 3 lần → 3 × 200 ÷ 10 = 60 fps.
  const moving = taskCamera({ task: 'code', code }, { ...COMMON, speedMmS: 200 }, P)!;
  const full = { ...code, speedMmS: 200, fovAlongMm: null, partsPerMinute: 60, minReads: P.codeMinReads, workingDistanceMm: null };
  const page = cameraInputFor(full, codeNeed(full, P));
  close(moving.camera.fovWidthMm, 24);
  close(moving.camera.partsPerMinute!, 60 * 60);
  assert.equal(moving.camera.fovWidthMm, page.fovWidthMm);
  assert.equal(moving.camera.targetMmPerPx, page.targetMmPerPx);
  assert.equal(moving.camera.partsPerMinute, page.partsPerMinute);
});

test('robot = ROB-001: ±0,5 → vision ±0,1667 → 0,5 mm/px; vùng 200 × 150 + vật 50 × 40', () => {
  const robot = { accuracyMm: 0.5, areaWidthMm: 200, areaHeightMm: 150, partWidthMm: 50, partHeightMm: 40, needs3d: false };
  const need = robotNeed(robot, P);
  close(need.visionBudgetMm, 0.5 / 3);
  close(need.mmPerPx, 0.5);
  assert.equal(need.fovWidthMm, 250);
  assert.equal(need.fovHeightMm, 190);
  const r = taskCamera({ task: 'robot', robot }, COMMON, P)!;
  close(r.camera.targetMmPerPx, 0.5);
  assert.equal(r.camera.measuring, true);
  // Ngưỡng admin: vision được 1/4, dưới pixel 1/2 → 0,5 ÷ 4 × 2 = 0,25.
  close(robotNeed(robot, { ...P, robotVisionDivisor: 4, robotSubpixel: 2 }).mmPerPx, 0.25);
  assert.equal(robotNeed({ ...robot, needs3d: true }, P).needs3d, true);
});

test('màu và phần tốc độ đi thẳng sang bộ kiểm camera', () => {
  const r = taskCamera({ task: 'measurement', fovWidthMm: 50, fovHeightMm: 40, toleranceMm: 0.1 }, { ...COMMON, color: 'mono', speedMmS: 100, triggerSource: 'encoder' }, P)!;
  assert.equal(r.camera.color, 'mono');
  assert.equal(r.camera.speedMmS, 100);
  assert.equal(r.camera.triggerSource, 'encoder');
  assert.equal(r.camera.partsPerMinute, 60);
});
