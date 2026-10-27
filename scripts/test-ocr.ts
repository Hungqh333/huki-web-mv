/**
 * Bộ chọn camera OCR / OCV (chốt 2026-10-27, Q5–Q7). Số tính tay ghi cạnh từng assert.
 *
 * Bài chuẩn: ký tự cao 2 mm, nét 0,2 mm, dòng dài 60 mm, 2 dòng, dung sai ±3 / ±2 mm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Component } from '../src/lib/components/specs';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';
import { PRINT_TYPES, ocrNeed, selectOcrCameras, type OcrInput } from '../src/lib/vision/ocr';

const camera = (id: string, spec: Record<string, unknown>): Component => ({
  id,
  code: id,
  kind: 'camera',
  brand: 'T',
  model: id,
  spec: { camera_type: 'area', pixel_size_um: 3.45, interface: 'GigE', shutter: 'global', color: 'mono', ...spec },
  price_vnd: null,
  datasheet_url: null,
  source: 'datasheet',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: 0,
});

const BASE: OcrInput = {
  mode: 'ocr',
  printType: 'laser',
  charHeightMm: 2,
  strokeMm: null,
  textWidthMm: 60,
  lines: 2,
  lineSpacingMm: null,
  toleranceXMm: 3,
  toleranceYMm: 2,
  background: 'plain',
  font: 'fixed',
  speedMmS: null,
  partsPerMinute: null,
  triggerSource: 'photoSensor',
};

test('OCR-001: mm/px theo chiều cao ký tự hoặc độ dày nét (lấy số chặt hơn); vùng nhìn khối chữ', () => {
  // 2 mm ÷ 20 px = 0,1 mm/px; khối 60 × (2 + 1 × 1,5 × 2) = 60 × 5; vùng nhìn 66 × 9
  const n = ocrNeed(BASE);
  assert.deepEqual([n.mmPerPx, n.governedBy, n.blockWidthMm, n.blockHeightMm, n.fovWidthMm, n.fovHeightMm], [0.1, 'height', 60, 5, 66, 9]);
  // Nét 0,2 mm ÷ 3 px = 0,0667 < 0,1 → nét quyết định
  const stroke = ocrNeed({ ...BASE, strokeMm: 0.2 });
  assert.equal(stroke.governedBy, 'stroke');
  assert.ok(Math.abs(stroke.mmPerPx - 0.2 / 3) < 1e-12);
  // Nét dày 0,5 ÷ 3 = 0,167 > 0,1 → vẫn theo chiều cao
  assert.equal(ocrNeed({ ...BASE, strokeMm: 0.5 }).governedBy, 'height');
  // Khoảng cách dòng nhập tay 4 mm → khối cao 2 + 4 = 6
  assert.equal(ocrNeed({ ...BASE, lineSpacingMm: 4 }).blockHeightMm, 6);
  // Ngưỡng admin
  assert.equal(ocrNeed(BASE, { ...DEFAULT_ENGINE_PARAMS, ocrPxPerCharHeight: 25 }).mmPerPx, 0.08);
});

test('OCR-002 / OCR-003: đèn theo kiểu in, truyền thống trước — học sâu khi nền phức tạp / font thay đổi', () => {
  assert.deepEqual(PRINT_TYPES.map((p) => ocrNeed({ ...BASE, printType: p }).light), ['domeOrRing', 'domeOrRing', 'domeOrRing', 'lowAngle']);
  assert.equal(ocrNeed(BASE).algorithm, 'traditional');
  assert.equal(ocrNeed({ ...BASE, printType: 'inkjet' }).algorithm, 'dotJoin');
  assert.equal(ocrNeed({ ...BASE, background: 'complex' }).algorithm, 'deepLearning');
  assert.equal(ocrNeed({ ...BASE, printType: 'inkjet', font: 'varies' }).algorithm, 'deepLearning');
});

test('tốc độ và camera: dùng lại bảng tính + bộ kiểm trang Chọn camera', () => {
  // 500 mm/s, nét quyết định 0,0667 mm/px: t_max = 1 × 0,0667 ÷ 500 = 133 µs; 600 sp/phút → 10 fps
  const n = ocrNeed({ ...BASE, strokeMm: 0.2, speedMmS: 500, partsPerMinute: 600 });
  assert.equal(Math.round(n.speed.exposureMaxUs!), 133);
  assert.equal(n.speed.fpsNeeded, 10);
  assert.equal(n.speed.strobeRequired, false);

  // 2448 × 2048: max(66 ÷ 2448, 9 ÷ 2048) = 0,027 ≤ 0,0667 → đạt; 640 × 480: 66 ÷ 640 = 0,103 > 0,0667 → loại
  const { candidates } = selectOcrCameras(
    [camera('small', { resolution_w_px: 640, resolution_h_px: 480, max_fps: 100 }), camera('big', { resolution_w_px: 2448, resolution_h_px: 2048, max_fps: 23 })],
    { ...BASE, strokeMm: 0.2, partsPerMinute: 600 }
  );
  assert.deepEqual(candidates.map((c) => [c.component.id, c.status]), [['big', 'pass'], ['small', 'fail']]);
});

test('mọi khoá chữ của trang OCR có đủ vi/en', () => {
  for (const locale of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
    const o = m.ocr;
    for (const p of PRINT_TYPES) assert.ok(o.printType[p], `${locale} printType.${p}`);
    for (const k of ['domeOrRing', 'lowAngle']) assert.ok(o.need.light[k], `${locale} light.${k}`);
    for (const k of ['traditional', 'dotJoin', 'deepLearning']) assert.ok(o.need.algo[k], `${locale} algo.${k}`);
    for (const k of ['ocr', 'ocv']) assert.ok(o.mode[k]);
    for (const k of ['ocrPxPerCharHeight', 'ocrPxPerStroke']) assert.ok(m.admin.engine.params[k], `${locale} params.${k}`);
    assert.ok(m.nav.ocr);
  }
});
