/**
 * Bộ chọn đầu đọc mã (chốt 2026-10-27, Q1–Q8). Số tính tay ghi cạnh từng assert.
 *
 * Bài chuẩn: DataMatrix ô 0,25 mm (3 px/ô → 0,0833 mm/px), mã 4 × 4 mm, dung sai ±5 mm
 * → vùng nhìn 14 × 14 mm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Component } from '../src/lib/components/specs';
import { COMPONENT_KINDS, SPEC_FIELDS } from '../src/lib/components/specs';
import { codeNeed, evaluateReader, pxPerModuleFor, selectCodeCameras, selectReaders, type CodeReaderInput } from '../src/lib/vision/codeReader';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';
import type { Check } from '../src/lib/vision/types';

let id = 0;
const device = (kind: Component['kind'], model: string, spec: Record<string, unknown>): Component => ({
  id: `d${++id}`,
  code: model,
  kind,
  brand: 'T',
  model,
  spec,
  price_vnd: null,
  datasheet_url: null,
  source: 'datasheet',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: id,
});
const reader = (spec: Record<string, unknown>) =>
  device('code_reader', `R${id}`, { resolution_w_px: 1280, resolution_h_px: 1024, aov_h_deg: 30, aov_v_deg: 24, wd_min_mm: 60, wd_max_mm: 250, decode_rate_hz: 60, code_types: ['1D', '2D'], shutter: 'global', ...spec });
const camera = (spec: Record<string, unknown> = {}) =>
  device('camera', `C${id}`, { camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, max_fps: 23, interface: 'GigE', shutter: 'global', color: 'mono', ...spec });
const check = (checks: Check[], key: string) => checks.find((c) => c.key === key)!;

const BASE: CodeReaderInput = {
  codeType: 'datamatrix',
  moduleMm: 0.25,
  codeWidthMm: 4,
  codeHeightMm: 4,
  toleranceXMm: 5,
  toleranceYMm: 5,
  speedMmS: null,
  motionAxis: 'x',
  fovAlongMm: null,
  partsPerMinute: null,
  minReads: 3,
  workingDistanceMm: null,
};

test('COD-001: px/module theo loại mã, mm/px, vùng nhìn = mã + 2 × dung sai', () => {
  assert.deepEqual(['barcode_1d', 'datamatrix', 'qr', 'dpm'].map((t) => pxPerModuleFor(t as CodeReaderInput['codeType'])), [2, 3, 3, 5]);
  const need = codeNeed(BASE);
  assert.ok(Math.abs(need.mmPerPx - 0.25 / 3) < 1e-12);
  assert.deepEqual([need.fovWidthMm, need.fovHeightMm, need.pxW, need.pxH, need.fpsNeeded, need.exposureMaxUs], [14, 14, 168, 168, null, null]);
  // Ngưỡng admin đổi được
  assert.equal(codeNeed(BASE, { ...DEFAULT_ENGINE_PARAMS, codePxPerModule2d: 4 }).mmPerPx, 0.0625);
});

test('COD-002: mã chạy qua — cửa sổ, fps cho N lần chụp, phơi chống nhoè', () => {
  // Tự tính: dọc = 4 + 10 + 4 = 18 mm → cửa sổ 4 mm → 3 × 500 ÷ 4 = 375 lần/s
  const auto = codeNeed({ ...BASE, speedMmS: 500 });
  assert.deepEqual([auto.fovWidthMm, auto.fovHeightMm, auto.readWindowMm, auto.fpsForReads], [18, 14, 4, 375]);
  // Đặt dọc 60 mm → cửa sổ 46 → 3 × 500 ÷ 46 = 32,6; t_max = 1 × 0,0833 ÷ 500 = 166,7 µs
  const set = codeNeed({ ...BASE, speedMmS: 500, fovAlongMm: 60, partsPerMinute: 600 });
  assert.equal(set.readWindowMm, 46);
  assert.equal(Math.round(set.fpsForReads! * 10), 326);
  assert.equal(set.fpsNeeded, set.fpsForReads, 'lon hon 600 ÷ 60 = 10');
  assert.equal(Math.round(set.exposureMaxUs! * 10), 1667);
  // Chạy theo chiều cao: vùng nhìn cao giãn ra
  assert.deepEqual([codeNeed({ ...BASE, speedMmS: 500, motionAxis: 'y' }).fovWidthMm, codeNeed({ ...BASE, speedMmS: 500, motionAxis: 'y' }).fovHeightMm], [14, 18]);
  // Đứng yên: chỉ sản lượng
  assert.equal(codeNeed({ ...BASE, partsPerMinute: 600 }).fpsNeeded, 10);
});

test('COD-003: đầu đọc liền khối — khoảng đọc [phủ ; mịn] ∩ dải lấy nét', () => {
  // 2tan15° = 0,5359 · 2tan12° = 0,4251 → phủ ≥ 14 ÷ 0,4251 = 32,9 mm; mịn ≤ 0,0833 × 1280 ÷ 0,5359 = 199 mm
  const r = evaluateReader(reader({}), BASE);
  assert.equal(r.status, 'pass');
  assert.deepEqual([Math.round(r.wdRange!.minMm), Math.round(r.wdRange!.maxMm), check(r.checks, 'readingRange').noteKey], [60, 199, 'wdWindow']);
  // Tại 60 mm: vùng nhìn 32,2 × 25,5 → 0,0251 mm/px
  assert.equal(Math.round(r.mmPerPx! * 1e4), 251);

  assert.equal(check(evaluateReader(reader({}), { ...BASE, workingDistanceMm: 300 }).checks, 'readingRange').noteKey, 'wdTooFar');
  assert.equal(check(evaluateReader(reader({}), { ...BASE, workingDistanceMm: 30 }).checks, 'readingRange').noteKey, 'wdTooClose');
  assert.equal(check(evaluateReader(reader({}), { ...BASE, workingDistanceMm: 120 }).checks, 'readingRange').noteKey, 'wdOk');
  // Ô 0,05 mm: mịn chỉ tới 39,8 mm < dải lấy nét từ 60 → ngoài dải lấy nét
  assert.equal(check(evaluateReader(reader({}), { ...BASE, moduleMm: 0.05 }).checks, 'readingRange').noteKey, 'wdNoWindowFocus');
  // Vùng 100 × 100 với ô 0,05: phủ cần 235 mm > mịn 39,8 → thiếu pixel
  assert.equal(check(evaluateReader(reader({}), { ...BASE, moduleMm: 0.05, codeWidthMm: 100, codeHeightMm: 100, toleranceXMm: 0, toleranceYMm: 0 }).checks, 'readingRange').noteKey, 'wdNoWindowPixels');

  // Loại mã: DPM mà đầu đọc chỉ khai 1D, 2D → loại
  assert.equal(evaluateReader(reader({}), { ...BASE, codeType: 'dpm' }).status, 'fail');
  // Góc nhìn suy từ tiêu cự: 2 · atan(2448 × 3,45 µm ÷ 32 mm) = 29,57°
  const focal = evaluateReader(reader({ aov_h_deg: undefined, aov_v_deg: undefined, resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, focal_length_mm: 16 }), BASE);
  assert.equal(Math.round(focal.aovLongDeg! * 100), 2957);
  // Thiếu thông số quang → chưa kiểm được, không loại
  assert.equal(check(evaluateReader(reader({ aov_h_deg: undefined, aov_v_deg: undefined }), BASE).checks, 'readingRange').noteKey, 'readerOpticsUnknown');

  // Tốc độ giải mã: cửa sổ 46 → 32,6 ≤ 60 × 0,7 → đạt; cửa sổ 16 → 93,75 > 60 → loại
  assert.equal(check(evaluateReader(reader({}), { ...BASE, speedMmS: 500, fovAlongMm: 60 }).checks, 'decodeRate').status, 'pass');
  assert.equal(check(evaluateReader(reader({}), { ...BASE, speedMmS: 500, fovAlongMm: 30 }).checks, 'decodeRate').noteKey, 'decodeTooSlow');
  assert.equal(evaluateReader(reader({ shutter: 'rolling' }), { ...BASE, speedMmS: 500, fovAlongMm: 60 }).status, 'fail');

  // Lọc đúng loại linh kiện
  assert.equal(selectReaders([camera(), reader({})], BASE).length, 1);
});

test('hướng camera + phần mềm: dùng lại bộ kiểm trang Chọn camera với fps cần của đọc mã', () => {
  const input = { ...BASE, speedMmS: 500, fovAlongMm: 60 };
  const [c] = selectCodeCameras([camera(), reader({})], input);
  assert.equal(c.component.kind, 'camera');
  assert.ok(Math.abs(c.fpsNeeded! - codeNeed(input).fpsNeeded!) < 1e-9);
  assert.ok(c.checks.some((k) => k.key === 'fps'));
});

test('loại code_reader khớp SQL; mọi khoá chữ có đủ vi/en', () => {
  assert.ok(COMPONENT_KINDS.includes('code_reader'));
  const sql = readFileSync(new URL('../supabase/migrations/20261027000001_code_reader_kind.sql', import.meta.url), 'utf8');
  for (const kind of COMPONENT_KINDS) assert.ok(sql.includes(`'${kind}'`), `SQL thieu ${kind}`);

  const inputs: CodeReaderInput[] = [BASE, { ...BASE, codeType: 'dpm' }, { ...BASE, workingDistanceMm: 300 }, { ...BASE, workingDistanceMm: 30 }, { ...BASE, workingDistanceMm: 120 }, { ...BASE, workingDistanceMm: 61 }, { ...BASE, moduleMm: 0.05 }, { ...BASE, moduleMm: 0.05, codeWidthMm: 100, codeHeightMm: 100 }, { ...BASE, speedMmS: 500, fovAlongMm: 60 }, { ...BASE, speedMmS: 500, fovAlongMm: 30 }, { ...BASE, speedMmS: 500, fovAlongMm: 48 }, { ...BASE, speedMmS: 5000, fovAlongMm: 60 }];
  const readers = [reader({}), reader({ shutter: 'rolling', code_types: [] }), reader({ aov_h_deg: undefined, aov_v_deg: undefined, decode_rate_hz: undefined }), reader({ wd_max_mm: 1000 })];
  const checks = inputs.flatMap((input) => readers.flatMap((r) => evaluateReader(r, input).checks));
  const notes = new Set(checks.map((c) => c.noteKey).filter(Boolean));
  for (const key of ['codeTypeMissing', 'codeTypeUnknown', 'readerOpticsUnknown', 'wdWindow', 'wdOk', 'wdTooFar', 'wdTooClose', 'wdNoWindowPixels', 'wdNoWindowFocus', 'decodeOk', 'decodeTooSlow', 'decodeUnknown', 'rollingShutter', 'exposureOk', 'readerExposureShort']) {
    assert.ok(notes.has(key), `kich ban chua phu ${key}`);
  }
  for (const locale of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const c of checks) {
      assert.ok(m.codeReader.checks[c.key], `${locale} checks.${c.key}`);
      if (c.noteKey) assert.ok(m.codeReader.notes[c.noteKey], `${locale} notes.${c.noteKey}`);
    }
    assert.ok(m.nav.codeReader && m.admin.components.kinds.code_reader, `${locale} nav / kind`);
    for (const f of SPEC_FIELDS.code_reader) assert.ok(m.admin.components.spec[f.key], `${locale} spec.${f.key}`);
    for (const v of ['fixed', 'liquid', 'auto']) assert.ok(m.codeReader.focus[v], `${locale} focus.${v}`);
  }
});
