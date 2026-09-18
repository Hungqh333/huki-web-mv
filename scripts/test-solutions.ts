/**
 * Ba mức giải pháp + xếp hạng mềm — V1c mục C4. Chốt Q1–Q6 ngày 2026-09-18.
 *
 * Bài chuẩn: vật 60 × 50, 1 camera, lỗi 0,2 mm tương phản cao → 0,0667 mm/px, WD 300.
 * Camera 2448 × 2048 × 3,45 µm. Dư độ phân giải theo tiêu cự (β = f ÷ (300 − f)):
 *   dư = 0,0667 × β ÷ 0,00345 → f16 1,09 · f18 1,23 · f20 1,38 · f25 1,76 · f35 2,55
 * → f16 không vào mức nào, f18 Tiết kiệm, f20 + f25 Đề xuất, f35 Hiệu năng cao.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { buildSolutionLevels, RANKING_WEIGHTS, softScores } from '../src/lib/vision/solutionLevels';

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>, extra: Partial<Component> = {}): Component => ({
  id: `c${++id}`,
  code: model.toUpperCase(),
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
  ...extra,
});

const CAMERA_SPEC = {
  camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3',
  mount: 'C', interface: 'GigE', max_fps: 23, color: 'mono', shutter: 'global', trigger_io: 'yes',
};
const lens = (f: number, extra: Partial<Component> = {}, spec: Record<string, unknown> = {}) =>
  make('lens', `f${f}`, { lens_type: 'fixed', focal_length_mm: f, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160, ...spec }, extra);

const catalogOf = (overrides: { f18?: Record<string, unknown> } = {}) => [
  make('camera', 'cam', CAMERA_SPEC, { price_vnd: 10_000_000, lead_time_days: 0 }),
  lens(16, { price_vnd: 1_000_000, lead_time_days: 0 }),
  lens(18, { price_vnd: 3_000_000, lead_time_days: 0 }, overrides.f18),
  lens(20, { price_vnd: 1_000_000, lead_time_days: 0 }),
  lens(25, { price_vnd: 5_000_000, lead_time_days: 0 }),
  lens(35, { price_vnd: 8_000_000, lead_time_days: 0 }),
  make('light', 'dome', { light_type: 'dome', color: 'white', size_mm: 100 }, { price_vnd: 2_000_000 }),
  make('controller', 'pc', { cpu_cores: 8, ram_gb: 32, lan_ports: 4, pcie_slots: 2 }, { price_vnd: 20_000_000 }),
];

const BASE = {
  'object.sizeX': 60, 'object.sizeY': 50, 'object.surface': 'glossy', 'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'detection.0.variability': 'low',
  'production.partsPerMinute': 30, 'system.cameraCount': 1, 'system.workingDistance': 300,
};
const solve = (overrides: Record<string, unknown> = {}, catalog = catalogOf()) => {
  const analysis = analyseRequirement(
    Object.entries({ ...BASE, ...overrides }).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'))
  );
  return buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog);
};
const level = (s: ReturnType<typeof solve>, key: string) => s.levels.find((l) => l.key === key)!;

test('trọng số §8.2 cộng lại bằng 1', () => {
  assert.ok(Math.abs(Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('ba mức chia theo khoảng dư độ phân giải trên mm/px; dư < 1,1 không vào mức nào', () => {
  const s = solve();
  assert.equal(level(s, 'economy').lens?.component.model, 'f18');
  assert.ok(Math.abs(level(s, 'economy').margin! - 1.233) < 0.005);
  assert.ok(['f20', 'f25'].includes(level(s, 'recommended').lens!.component.model));
  assert.equal(level(s, 'highPerformance').lens?.component.model, 'f35');
  const used = s.levels.map((l) => l.lens?.component.model);
  assert.ok(!used.includes('f16'), 'f16 du 1,09 < 1,1');
  // mm/px thực = 0,0667 ÷ dư
  assert.ok(Math.abs(level(s, 'highPerformance').mmPerPx! - 0.2 / 3 / level(s, 'highPerformance').margin!) < 1e-9);
});

test('trong một khoảng, điểm mềm quyết định: f20 rẻ hơn thắng f25 dư hơn', () => {
  const s = solve();
  const rec = level(s, 'recommended');
  assert.equal(rec.lens?.component.model, 'f20');
  const price = rec.score!.parts.find((p) => p.criterion === 'price')!;
  assert.equal(price.value, 1, 'cap re nhat trong cac cap dat');
  const local = rec.score!.parts.find((p) => p.criterion === 'localSupport')!;
  assert.deepEqual([local.value, local.hasData], [0, false], 'chua co du lieu → 0, ghi ro');
});

test('chi phí: giá × số lượng; thiếu giá một món thì không cộng tổng', () => {
  const s = solve();
  // 1 camera: 10 + 1 (f20) + 2 (đèn) + 20 (máy tính) = 33 triệu
  assert.equal(level(s, 'recommended').cost?.total, 33_000_000);
  const two = solve({ 'system.cameraCount': 2, 'object.sizeX': 120 });
  const cost = two.levels.find((l) => l.status === 'ok')!.cost!;
  assert.equal(cost.lines[0].qty, 2, 'camera nhan theo so camera');
  assert.equal(cost.lines.find((l) => l.component.kind === 'controller')!.qty, 1);

  const noPrice = catalogOf().map((c) => (c.kind === 'light' ? { ...c, price_vnd: null } : c));
  const missing = level(solve({}, noPrice), 'recommended').cost!;
  assert.deepEqual([missing.total, missing.missingPrices], [null, 1]);
});

test('Tiết kiệm bị chặn khi cấu hình có MARGINAL (ống lp/mm thấp) — hiện lý do, không hiện phương án', () => {
  const s = solve({}, catalogOf({ f18: { resolution_lp_mm: 100 } }));
  const economy = level(s, 'economy');
  assert.equal(economy.status, 'blocked');
  assert.equal(economy.camera, null, 'khong bay phuong an rui ro');
  assert.deepEqual(economy.blockReasons.map((r) => r.ruleId), ['OPT-003']);
  assert.equal(level(s, 'recommended').status, 'ok', 'muc khac van hien');
});

test('Tiết kiệm dư 1,1–1,2: KHÔNG tự chặn bởi chính hệ số dư OPT-001 (lỗi tìm ra khi chạy thử C9)', () => {
  // f17 ở 300 mm: β = 17 ÷ 283 → 0,00345 ÷ 0,0601 = 0,0574 mm/px → dư 0,0667 ÷ 0,0574 ≈ 1,16.
  // Bảng điểm coi 1,0–1,2 là MARGINAL; trước khi sửa, Tiết kiệm hiện "KHÔNG KHẢ DỤNG — OPT-001 Đạt".
  const catalog = catalogOf().map((c) => (c.model === 'f18' ? lens(17, { price_vnd: 3_000_000, lead_time_days: 0 }) : c));
  const economy = level(solve({}, catalog), 'economy');
  assert.ok(Math.abs(economy.margin! - 1.16) < 0.01, String(economy.margin));
  assert.equal(economy.status, 'ok');
  assert.equal(economy.lens?.component.model, 'f17');
  assert.ok(!economy.risks.some((r) => r.ruleId === 'OPT-001'), 'OPT-001 dat khong phai rui ro');
});

test('bảng Yêu cầu có FAIL → Tiết kiệm bị chặn; mức khác mang FAIL đó trong rủi ro', () => {
  // Δh 2 mm, WD 300, dung sai ±0,05 → phối cảnh 0,26 mm > U 0,01 → OPT-008 FAIL
  const s = solve({ 'object.heightVariation': 2, 'measurement.0.tolerance': 0.05 });
  assert.ok(s.requirementBlockers.some((r) => r.ruleId === 'OPT-008'));
  const economy = level(s, 'economy');
  assert.equal(economy.status, 'blocked');
  assert.ok(economy.blockReasons.some((r) => r.ruleId === 'OPT-008'));
  for (const l of s.levels.filter((x) => x.status === 'ok')) assert.ok(l.risks.some((r) => r.ruleId === 'OPT-008'));
});

test('khoảng không có cặp nào → rỗng, không bịa', () => {
  const onlyF25 = catalogOf().filter((c) => c.kind !== 'lens' || c.model === 'f25');
  const s = solve({}, onlyF25);
  assert.deepEqual(s.levels.map((l) => l.status), ['empty', 'ok', 'empty']);
});

test('điểm mềm: giao ngay 1 điểm, 60 ngày 0 điểm; đã dùng 3 dự án = 1 điểm; thiếu giá 0 điểm', () => {
  const base = { price: null, leadTime: null, used: 0 };
  const [fast, slow, unknown] = softScores([
    { sourcing: { ...base, leadTime: 0, used: 3 }, margin: 2 },
    { sourcing: { ...base, leadTime: 60 }, margin: 1 },
    { sourcing: base, margin: null },
  ]);
  const part = (s: typeof fast, c: string) => s.parts.find((p) => p.criterion === c)!;
  assert.equal(part(fast, 'availability').value, 1);
  assert.equal(part(slow, 'availability').value, 0);
  assert.equal(part(fast, 'priorProjectUse').value, 1);
  assert.equal(part(fast, 'resolutionMargin').value, 1, 'du 2x = diem toi da');
  assert.equal(part(unknown, 'price').hasData, false);
  assert.equal(fast.total, 60, '0,25 + 0,20 + 0,15');
});

test('nhãn khối Phương án đủ vi/en', () => {
  for (const locale of ['vi', 'en']) {
    const s = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8')).designer.requirement.solutions;
    for (const key of ['title', 'mandatory', 'blocked', 'empty', 'cost', 'costMissing', 'score', 'risks', 'whatToRelax']) assert.ok(s[key], `${locale}: ${key}`);
    for (const key of ['economy', 'recommended', 'highPerformance']) assert.ok(s.levels[key], `${locale}: levels.${key}`);
    for (const key of Object.keys(RANKING_WEIGHTS)) assert.ok(s.criteria[key], `${locale}: criteria.${key}`);
  }
});
