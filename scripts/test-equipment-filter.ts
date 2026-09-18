/**
 * Lọc cứng thiết bị — V1c mục C3 (spec V1.1 §8.1). Chốt Q1–Q7 ngày 2026-09-17.
 *
 * Bài chuẩn: vật 60 × 50 mm, 1 camera, lỗi 0,2 mm tương phản cao → 0,0667 mm/px
 * → cần 900 × 750 px; WD 300, 30 sản phẩm/phút, bề mặt bóng → gợi ý dome / backlight.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { cameraRequirementChecks, filterEquipment, lightChecks } from '../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>, source: Component['source'] = 'datasheet'): Component => ({
  id: `c${++id}`,
  code: model.toUpperCase(),
  kind,
  brand: 'Test',
  model,
  spec,
  price_vnd: null,
  datasheet_url: null,
  source,
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: id,
});

const camera = (model: string, extra: Record<string, unknown> = {}, source: Component['source'] = 'datasheet') =>
  make('camera', model, {
    camera_type: 'area',
    resolution_w_px: 2448,
    resolution_h_px: 2048,
    pixel_size_um: 3.45,
    sensor_format: '2/3',
    mount: 'C',
    interface: 'GigE',
    max_fps: 23,
    color: 'mono',
    shutter: 'global',
    trigger_io: 'yes',
    ...extra,
  }, source);

const lens = (model: string, extra: Record<string, unknown> = {}) =>
  make('lens', model, { lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160, ...extra });

const BASE = {
  'object.sizeX': 60,
  'object.sizeY': 50,
  'object.surface': 'glossy',
  'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2,
  'detection.0.contrast': 'high',
  'detection.0.variability': 'low',
  'production.partsPerMinute': 30,
  'system.cameraCount': 1,
  'system.workingDistance': 300,
};

const analysisOf = (overrides: Record<string, unknown> = {}) =>
  analyseRequirement(
    Object.entries({ ...BASE, ...overrides }).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'))
  );

const reasonsOf = (results: ReturnType<typeof cameraRequirementChecks>) => results.filter((r) => r.status === 'fail').map((r) => `${r.ruleId}:${r.noteKey}`);

test('phân tích yêu cầu xuất số pixel mỗi trục và loại đèn gợi ý cho bộ lọc', () => {
  const analysis = analysisOf();
  assert.deepEqual(analysis.pixelsPerCamera, { nx: 900, ny: 750 });
  assert.deepEqual(analysis.lighting, { ruleId: 'LGT-001', types: ['dome', 'backlight'] });
});

test('camera: thiếu pixel bị loại, được xoay 90°; line scan bị loại (V1c chưa hỗ trợ)', () => {
  const analysis = analysisOf();
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysis, camera('ok'))), []);
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysis, camera('small', { resolution_w_px: 1280, resolution_h_px: 720 }))), ['RES-004:cameraPixelsShort'], '720 < 750');
  // 760 × 1000: chỉ đạt khi xoay (1000 ≥ 900, 760 ≥ 750)
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysis, camera('portrait', { resolution_w_px: 760, resolution_h_px: 1000 }))), []);
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysis, camera('line', { camera_type: 'line', line_width_px: 4096 }))), ['RES-004:lineScanNotSupported']);
});

test('camera: cần màu mà đơn sắc; chạy liên tục mà rolling; cần trigger mà không có chân → loại', () => {
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysisOf({ 'object.colorInspection': true }), camera('mono'))), ['LGT-006:cameraNeedsColor']);
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysisOf({ 'object.colorInspection': true }), camera('color', { color: 'color' }))), []);

  const moving = analysisOf({ 'production.motion': 'continuous', 'production.conveyorSpeed': 100 });
  assert.deepEqual(reasonsOf(cameraRequirementChecks(moving, camera('rolling', { shutter: 'rolling' }))), ['THR-005:cameraRollingShutter']);
  assert.deepEqual(reasonsOf(cameraRequirementChecks(moving, camera('notrig', { trigger_io: 'no' }))), ['LGT-008:cameraNoTrigger']);
  // Đứng yên từng bước: rolling shutter và không trigger đều dùng được.
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysisOf(), camera('rolling', { shutter: 'rolling', trigger_io: 'no' }))), []);
  // Chạy liên tục mà chưa khai → chưa kiểm được, không loại.
  const unknown = cameraRequirementChecks(moving, camera('blank', { shutter: undefined, trigger_io: undefined }));
  assert.deepEqual(reasonsOf(unknown), []);
  assert.deepEqual(unknown.filter((r) => r.evidence === 'unknown').map((r) => r.noteKey).sort(), ['cameraShutterUnknown', 'cameraTriggerUnknown']);
});

test('camera: băng thông tính theo pixel THẬT của camera — 20 MP × 2 ảnh/s qua GigE vượt 70%', () => {
  const analysis = analysisOf({ 'production.partsPerMinute': 120 });
  // 5472 × 3648 × 1 byte = 19,96 MB × 2/s = 39,9 MB/s ≤ 77 MB/s → đạt
  assert.deepEqual(reasonsOf(cameraRequirementChecks(analysis, camera('20mp', { resolution_w_px: 5472, resolution_h_px: 3648 }))), []);
  // 300 sp/phút = 5/s → 99,8 MB/s > 77 → loại
  const fast = analysisOf({ 'production.partsPerMinute': 300 });
  assert.deepEqual(reasonsOf(cameraRequirementChecks(fast, camera('20mp', { resolution_w_px: 5472, resolution_h_px: 3648 }))), ['THR-002:cameraInterfaceSlow']);
  assert.deepEqual(reasonsOf(cameraRequirementChecks(fast, camera('20mp-5g', { resolution_w_px: 5472, resolution_h_px: 3648, interface: '5GigE' }))), []);
});

test('camera: IP thấp và nhiệt độ thấp chỉ gắn cờ, không loại', () => {
  const results = cameraRequirementChecks(analysisOf({ 'environment.ipRequirement': 'ip65', 'environment.conditions': ['highTemp'] }), camera('ip30', { ip_rating: 'IP30', temp_max_c: 45 }));
  assert.deepEqual(reasonsOf(results), []);
  assert.deepEqual(results.filter((r) => r.status === 'warn').map((r) => r.noteKey).sort(), ['cameraNeedsHousing', 'cameraTempLow']);
  const ip67 = cameraRequirementChecks(analysisOf({ 'environment.ipRequirement': 'ip65' }), camera('ip67', { ip_rating: 'IP67' }));
  assert.equal(ip67.some((r) => r.noteKey === 'cameraNeedsHousing'), false);
});

test('đèn: đúng loại gợi ý, đủ cỡ (vòm theo đường chéo, nền theo cạnh dài), chạy xung khi cần', () => {
  const analysis = analysisOf();
  const fails = (spec: Record<string, unknown>, a = analysis) => lightChecks(a, make('light', 'l', spec)).filter((r) => r.status === 'fail').map((r) => r.noteKey);
  assert.deepEqual(fails({ light_type: 'ring', color: 'white', size_mm: 200 }), ['lightWrongType']);
  // Đường chéo 60 × 50 = 78,1 mm
  assert.deepEqual(fails({ light_type: 'dome', color: 'white', size_mm: 100 }), []);
  assert.deepEqual(fails({ light_type: 'dome', color: 'white', size_mm: 70 }), ['lightTooSmall']);
  // Đèn nền: cạnh dài 60
  assert.deepEqual(fails({ light_type: 'backlight', color: 'white', size_mm: 70 }), []);
  const unknown = lightChecks(analysis, make('light', 'l', { light_type: 'dome', color: 'white' }));
  assert.equal(unknown[0].evidence, 'unknown');

  // 0,0667 mm/px × 0,5 ÷ 1000 mm/s = 33 µs < 50 µs → LGT-008 → đèn phải chạy xung
  const strobe = analysisOf({ 'production.motion': 'continuous', 'production.conveyorSpeed': 1000 });
  assert.ok(strobe.results.some((r) => r.ruleId === 'LGT-008'));
  assert.deepEqual(fails({ light_type: 'dome', color: 'white', size_mm: 100, strobe: 'no' }, strobe), ['lightNoStrobe']);
});

test('lọc cả catalog: camera đạt xếp nhỏ trước, mỗi camera có ống khớp nhất và ống bị loại kèm lý do', () => {
  const catalog = [
    camera('20mp', { resolution_w_px: 5472, resolution_h_px: 3648, pixel_size_um: 2.4, sensor_format: '1' }),
    camera('5mp'),
    camera('vga', { resolution_w_px: 640, resolution_h_px: 480 }),
    lens('f25'),
    lens('f35', { focal_length_mm: 35 }),
    lens('f50', { focal_length_mm: 50 }),
    lens('cs', { mount: 'CS' }),
    make('light', 'dome100', { light_type: 'dome', color: 'white', size_mm: 100 }),
    make('light', 'ring', { light_type: 'ring', color: 'white', size_mm: 100 }),
    make('controller', 'pc-ok', { cpu_cores: 8, ram_gb: 32, lan_ports: 2, pcie_slots: 2 }),
    make('controller', 'pc-small', { cpu_cores: 2, ram_gb: 8, lan_ports: 1 }),
    { ...camera('off'), is_active: false },
  ];
  const filter = filterEquipment(analysisOf(), catalog);
  assert.equal(filter.ready, true);
  assert.deepEqual(filter.cameras.accepted.map((c) => c.component.model), ['5mp', '20mp']);
  assert.deepEqual(filter.cameras.excluded.map((c) => c.component.model), ['vga']);

  const five = filter.cameras.accepted[0];
  // f 37 mm là lý tưởng: 25 và 35 đạt (35 sát hơn), 50 hụt vùng nhìn, CS lệch ngàm
  assert.deepEqual(five.lenses.accepted.map((l) => l.component.model).sort(), ['f25', 'f35']);
  assert.equal(five.lenses.best?.component.model, 'f35');
  const excluded = Object.fromEntries(five.lenses.excluded.map((l) => [l.component.model, l.reasons.map((r) => r.noteKey)]));
  assert.deepEqual(excluded, { f50: ['lensFovTooSmall'], cs: ['mountMismatch'] });

  assert.deepEqual(filter.lights.accepted.map((l) => l.component.model), ['dome100']);
  assert.deepEqual(filter.lights.wantedTypes, ['dome', 'backlight']);
  assert.equal(filter.pcs.referenceCamera?.model, '5mp', 'may tinh tinh theo camera dat nho nhat');
  assert.deepEqual(filter.pcs.accepted.map((p) => p.component.model), ['pc-ok']);
  assert.deepEqual(
    filter.pcs.excluded[0].reasons.map((r) => r.noteKey).sort(),
    ['ipcCoresShort', 'ipcLanShort', 'ipcRamShort']
  );
});

test('thiết bị chưa kiểm chứng và thiếu thông số: vẫn đạt, mang cờ (Q4, Q6)', () => {
  const catalog = [
    camera('old', { shutter: undefined, trigger_io: undefined }, 'unverified'),
    make('lens', 'old-lens', { lens_type: 'fixed', focal_length_mm: 25, image_circle: '2/3', mount: 'C' }, 'unverified'),
  ];
  const filter = filterEquipment(analysisOf(), catalog);
  const cam = filter.cameras.accepted[0];
  assert.equal(cam.unverified, true);
  const lensCandidate = cam.lenses.accepted[0];
  assert.equal(lensCandidate.unverified, true);
  assert.deepEqual([...new Set(lensCandidate.unchecked.map((r) => r.ruleId))].sort(), ['OPT-003', 'OPT-004']);
});

test('chưa đủ dữ liệu (chưa có số camera) → chưa lọc; catalog rỗng không lỗi', () => {
  const analysis = analysisOf({ 'system.cameraCount': null });
  assert.equal(filterEquipment(analysis, [camera('x')]).ready, false);
  const empty = filterEquipment(analysisOf(), []);
  assert.deepEqual([empty.cameras.accepted.length, empty.lights.accepted.length, empty.pcs.referenceCamera], [0, 0, null]);
});

test('GT-002 trên seed thật: 20 MP của dự án không có trong seed nhưng bộ lọc vẫn chạy trọn catalog seed', () => {
  // Đọc seed như trang /dev/yeu-cau để chắc hai nơi không lệch nhau về cú pháp.
  const sql = readFileSync('supabase/seed_components.sql', 'utf8');
  const text = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${text},\\s*${text},\\s*${text},\\s*${text},\\s*${text}::jsonb,\\s*${text}`, 'g');
  const seed = [...sql.matchAll(row)].map((m) =>
    make(m[2] as ComponentKind, m[4], JSON.parse(m[5].replace(/''/g, "'")), m[6] as Component['source'])
  ).map((c, index) => ({ ...c, sort_order: index }));
  assert.ok(seed.length >= 70, `doc duoc ${seed.length} dong seed`);
  const filter = filterEquipment(analysisOf(), seed);
  assert.ok(filter.cameras.accepted.length + filter.cameras.excluded.length >= 10);
  assert.ok(filter.cameras.accepted.every((c) => c.reasons.length === 0));
});

test('mọi câu diễn giải của bộ lọc có đủ vi/en', () => {
  const moving = analysisOf({ 'production.motion': 'continuous', 'production.conveyorSpeed': 1000, 'object.colorInspection': true, 'environment.ipRequirement': 'ip67', 'environment.conditions': ['highTemp'], 'production.partsPerMinute': 600 });
  const results = [
    ...cameraRequirementChecks(analysisOf(), camera('line', { camera_type: 'line' })),
    ...cameraRequirementChecks(analysisOf(), camera('small', { resolution_w_px: 640, resolution_h_px: 480 })),
    ...cameraRequirementChecks(moving, camera('bad', { shutter: 'rolling', trigger_io: 'no', ip_rating: 'IP30', temp_max_c: 40, resolution_w_px: 5472, resolution_h_px: 3648 })),
    ...cameraRequirementChecks(moving, camera('blank', { shutter: undefined, trigger_io: undefined })),
    ...lightChecks(analysisOf(), make('light', 'r', { light_type: 'ring' })),
    ...lightChecks(analysisOf(), make('light', 'd', { light_type: 'dome', size_mm: 10 })),
    ...lightChecks(moving, make('light', 'd2', { light_type: 'dome' })),
    ...lightChecks(moving, make('light', 'd3', { light_type: 'dome', size_mm: 500, strobe: 'no' })),
  ];
  const noteKeys = new Set(results.map((r) => r.noteKey).filter(Boolean));
  for (const key of ['lineScanNotSupported', 'cameraPixelsShort', 'cameraNeedsColor', 'cameraRollingShutter', 'cameraNoTrigger', 'cameraInterfaceSlow', 'cameraNeedsHousing', 'cameraTempLow', 'cameraShutterUnknown', 'cameraTriggerUnknown', 'cameraTempUnknown', 'lightWrongType', 'lightTooSmall', 'lightSizeUnknown', 'lightStrobeUnknown', 'lightNoStrobe']) {
    assert.ok(noteKeys.has(key), `kich ban chua phu ${key}`);
  }
  for (const locale of ['vi', 'en']) {
    const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const result of results) {
      assert.ok(messages.selector.vision.checks[result.key], `${locale}: checks.${result.key}`);
      if (result.noteKey) assert.ok(messages.selector.vision.notes[result.noteKey], `${locale}: notes.${result.noteKey}`);
    }
    const equipment = messages.designer.requirement.equipment;
    for (const key of ['title', 'subtitle', 'noCatalog', 'notReady', 'counts', 'excludedTitle', 'unverified', 'unchecked', 'bestLens', 'noLens']) {
      assert.ok(equipment[key], `${locale}: equipment.${key}`);
    }
  }
});
