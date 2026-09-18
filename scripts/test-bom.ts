/**
 * Danh mục vật tư — V1c mục C5. Chốt Q1–Q7 ngày 2026-09-18.
 *
 * Cùng bài chuẩn với test-solutions.ts (vật 60 × 50, 0,0667 mm/px, WD 300,
 * bề mặt bóng): mức Đề xuất = camera 5 MP + ống f20.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Component, ComponentKind } from '../src/lib/components/specs';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { parseDraft, startDraftFromApp } from '../src/lib/requirement/draft';
import { draftFingerprint, revisionToDraft } from '../src/lib/projects/model';
import { BOM_EXCLUSIONS, BOM_PLACEHOLDERS, RULESET_VERSION, bomForRequirement, buildBom } from '../src/lib/vision/bom';
import { BOM_LEVEL_KEYS, emptySelection, isBomSelection } from '../src/lib/vision/bomSelection';
import { filterEquipment } from '../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { SOLUTION_LEVELS, buildSolutionLevels } from '../src/lib/vision/solutionLevels';

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>, extra: Partial<Component> = {}): Component => ({
  id: `c${++id}`,
  code: model.toUpperCase(),
  kind,
  brand: 'T',
  model,
  spec,
  price_vnd: 1_000_000,
  datasheet_url: null,
  source: 'datasheet',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: id,
  lead_time_days: 7,
  ...extra,
});

const CATALOG: Component[] = [
  make('camera', 'cam', {
    camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3',
    mount: 'C', interface: 'GigE', max_fps: 23, color: 'mono', shutter: 'global', trigger_io: 'yes',
  }, { price_vnd: 10_000_000 }),
  make('lens', 'f20', { lens_type: 'fixed', focal_length_mm: 20, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160 }),
  make('light', 'dome', { light_type: 'dome', color: 'white', size_mm: 100 }, { price_vnd: 2_000_000 }),
  make('controller', 'pc', { cpu_cores: 8, ram_gb: 32, lan_ports: 4, pcie_slots: 2 }, { price_vnd: 20_000_000 }),
  make('cable', 'gige-5m', { cable_for: 'camera_data', connector: 'RJ45', length_m: 5 }, { price_vnd: 300_000 }),
  make('cable', 'power-5m', { cable_for: 'camera_power', connector: 'Hirose 6', length_m: 5 }, { price_vnd: 200_000 }),
  make('cable', 'light-3m', { cable_for: 'light', connector: 'M8', length_m: 3 }, { price_vnd: 100_000 }),
  make('light_controller', 'ctrl-2ch', { channels: 2, strobe: 'yes' }, { price_vnd: 3_000_000 }),
  make('software', 'halcon', { software_type: 'library', license: 'runtime' }, { price_vnd: 15_000_000 }),
  make('accessory', 'pol-lens', { pick_mode: 'rule', accessory_type: 'polarizer_lens', qty_basis: 'per_camera' }, { price_vnd: 500_000 }),
  make('accessory', 'pol-light', { pick_mode: 'rule', accessory_type: 'polarizer_light', qty_basis: 'per_light' }, { price_vnd: 400_000 }),
  make('accessory', 'lock-ring', { pick_mode: 'rule', accessory_type: 'lock_ring', qty_basis: 'per_camera' }, { price_vnd: 50_000 }),
  make('accessory', 'bracket-std', { pick_mode: 'manual', accessory_type: 'bracket' }, { price_vnd: 800_000 }),
];

const BASE = {
  'object.sizeX': 60, 'object.sizeY': 50, 'object.surface': 'glossy', 'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'detection.0.variability': 'low',
  'production.partsPerMinute': 30, 'system.cameraCount': 1, 'system.workingDistance': 300,
};
const requirementOf = (overrides: Record<string, unknown> = {}) =>
  Object.entries({ ...BASE, ...overrides }).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'));
const bomOf = (overrides: Record<string, unknown> = {}, selection = emptySelection('recommended'), catalog = CATALOG) => {
  const analysis = analyseRequirement(requirementOf(overrides));
  return buildBom(analysis, buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog), catalog, selection);
};
const line = (bom: NonNullable<ReturnType<typeof bomOf>>, key: string) => bom.lines.find((l) => l.key === key);

test('danh sách mức của lựa chọn BOM khớp SOLUTION_LEVELS', () => {
  assert.deepEqual([...BOM_LEVEL_KEYS], SOLUTION_LEVELS.map((l) => l.key));
});

test('BOM đủ các dòng mua hàng hay thiếu, mỗi dòng có mã luật', () => {
  const bom = bomOf()!;
  const keys = bom.lines.map((l) => l.key);
  for (const key of ['camera', 'lens', 'light', 'cable:data', 'cable:power', 'cable:light', 'lightController', 'pc', 'software', 'accessory:POL-LENS', 'accessory:POL-LIGHT']) {
    assert.ok(keys.includes(key), `thieu dong ${key}`);
  }
  assert.equal(line(bom, 'lens')?.model, 'f20');
  assert.deepEqual(line(bom, 'camera')?.ruleIds, ['RES-004']);
  assert.deepEqual(line(bom, 'accessory:POL-LENS')?.ruleIds, ['LGT-001'], 'be mat bong → kinh phan cuc');
  assert.ok(bom.lines.filter((l) => l.code !== null).every((l) => l.ruleIds.length > 0), 'dong tu sinh nao cung co luat');
  assert.equal(bom.rulesetVersion, RULESET_VERSION);
  assert.deepEqual(bom.exclusions, [...BOM_EXCLUSIONS]);
  assert.equal(line(bom, 'accessory:LOCK-RING'), undefined, 'khong rung → khong vong khoa');
});

test('số lượng nhân theo camera / đèn; bộ điều khiển đèn theo số kênh; máy tính 1', () => {
  // 2 camera → vật 120 × 50 chia 2
  const bom = bomOf({ 'system.cameraCount': 2, 'object.sizeX': 120 })!;
  for (const key of ['camera', 'lens', 'light', 'cable:data', 'cable:power', 'accessory:POL-LENS', 'accessory:POL-LIGHT']) {
    assert.equal(line(bom, key)?.qty, 2, key);
  }
  assert.equal(line(bom, 'lightController')?.qty, 1, '2 den / 2 kenh');
  assert.equal(line(bom, 'pc')?.qty, 1);
  // Nhiều camera → vật chuẩn để ghép toạ độ (RES-005)
  assert.deepEqual(line(bom, 'placeholder:calibrationTarget')?.ruleIds, ['RES-005']);
});

test('dòng "cần báo giá": vật chuẩn khi đo, gá khi rung — không có mã hàng, bỏ được', () => {
  const measuring = bomOf({ 'measurement.0.tolerance': 0.5, 'environment.conditions': ['vibration'] })!;
  const target = line(measuring, 'placeholder:calibrationTarget')!;
  assert.deepEqual([target.code, target.placeholder, target.removable], [null, 'calibrationTarget', true]);
  assert.deepEqual(target.ruleIds, ['RES-002', 'MEC-003']);
  assert.equal(line(measuring, 'placeholder:cameraBracket')?.ruleIds[0], 'MEC-002');
  assert.ok(line(measuring, 'accessory:LOCK-RING'), 'rung → vong khoa net');
  assert.equal(line(bomOf()!, 'placeholder:calibrationTarget'), undefined, '1 camera, khong do → khong can');
  assert.deepEqual([...BOM_PLACEHOLDERS].sort(), ['calibrationTarget', 'cameraBracket']);
});

test('lựa chọn người dùng: sửa số lượng, bỏ phụ kiện, thêm phụ kiện tích tay — thiết bị chính không bỏ được', () => {
  const bom = bomOf({}, { level: 'recommended', qty: { 'cable:data': 3 }, removed: ['accessory:POL-LIGHT', 'camera'], added: ['BRACKET-STD', 'KHONG-CO'] })!;
  assert.deepEqual([line(bom, 'cable:data')?.qty, line(bom, 'cable:data')?.suggestedQty], [3, 1]);
  assert.equal(line(bom, 'accessory:POL-LIGHT'), undefined);
  assert.ok(line(bom, 'camera'), 'camera khong removable');
  const added = line(bom, 'accessory:BRACKET-STD')!;
  assert.deepEqual([added.manual, added.removable, added.ruleIds], [true, true, []]);
  assert.equal(bom.lines.some((l) => l.code === 'KHONG-CO'), false, 'ma khong co trong kho thi bo qua');
});

test('tổng tiền = Σ giá × SL; dòng cần báo giá hoặc thiếu giá thì không cộng tổng', () => {
  const noPlaceholder = bomOf()!;
  const expected = noPlaceholder.lines.reduce((sum, l) => sum + l.unitPrice! * l.qty, 0);
  assert.equal(noPlaceholder.total, expected);
  assert.equal(noPlaceholder.missingPrices, 0);
  const withTarget = bomOf({ 'measurement.0.tolerance': 0.5 })!;
  assert.deepEqual([withTarget.total, withTarget.missingPrices], [null, 1]);
});

test('mức bị chặn / rỗng → không dựng BOM', () => {
  assert.equal(bomOf({}, emptySelection('economy')), null, 'kho chi co f20 → Tiet kiem rong');
});

test('khối Giả định & Loại trừ lấy đúng ô đang giả định; ghi trạng thái khả thi', () => {
  const bom = bomOf()!;
  const paths = bom.assumptions.map((a) => a.path);
  assert.ok(paths.includes('object.thermalExpansionCoeff') || paths.length > 0);
  assert.ok(!paths.includes('object.sizeX'), 'o da nhap khong phai gia dinh');
  assert.equal(bom.feasibility, 'FEASIBLE_WITH_VALIDATION', 'chieu sang be mat bong can chup mau');
});

test('server dựng lại cùng một BOM từ bảng Yêu cầu + lựa chọn', () => {
  const selection = { level: 'recommended' as const, qty: { camera: 2 }, removed: [], added: [] };
  assert.deepEqual(bomForRequirement(requirementOf(), CATALOG, selection), bomOf({}, selection));
});

test('lựa chọn BOM trong bản nháp: hợp lệ thì giữ, hỏng thì bỏ; đổi BOM = chưa lưu', () => {
  assert.equal(isBomSelection(emptySelection('recommended')), true);
  assert.equal(isBomSelection({ level: 'luxury', qty: {}, removed: [], added: [] }), false);
  assert.equal(isBomSelection({ level: 'economy', qty: { camera: 0 }, removed: [], added: [] }), false, 'SL >= 1');
  assert.equal(isBomSelection({ level: 'economy', qty: { camera: 2.5 }, removed: [], added: [] }), false, 'SL nguyen');

  const draft = { ...startDraftFromApp('AppearanceInspection'), bom: emptySelection('highPerformance') };
  assert.deepEqual(parseDraft(JSON.stringify(draft))?.bom, draft.bom);
  assert.equal(parseDraft(JSON.stringify({ ...draft, bom: { level: 'x' } }))?.bom, undefined);

  const withoutBom = { ...draft, bom: undefined };
  assert.notEqual(draftFingerprint(draft), draftFingerprint(withoutBom));
});

test('mở lại revision: khôi phục lựa chọn BOM từ ảnh chụp; revision cũ chưa có BOM vẫn mở được', () => {
  const snapshot = bomOf()!;
  const row = { id: 'r1', rev_label: 'A', requirement: requirementOf(), raw_text: null, schema_version: 2, locked_at: null };
  const reopened = revisionToDraft({ id: 'p1', name: 'P' }, { ...row, bom: snapshot });
  assert.deepEqual(reopened?.bom, snapshot.selection);
  assert.equal(reopened?.project?.savedFingerprint, draftFingerprint(reopened!), 'vua mo = da luu');
  assert.equal(revisionToDraft({ id: 'p1', name: 'P' }, row)?.bom, undefined);
});

test('nhãn khối BOM đủ vi/en', () => {
  for (const locale of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8')).designer.requirement;
    for (const key of ['title', 'unavailable', 'needsQuote', 'total', 'totalMissing', 'assumptionsTitle', 'exclusionsTitle', 'feasibilityAt']) {
      assert.ok(m.bom[key], `${locale}: bom.${key}`);
    }
    for (const key of BOM_EXCLUSIONS) assert.ok(m.bom.exclusions[key], `${locale}: exclusions.${key}`);
    for (const key of BOM_PLACEHOLDERS) assert.ok(m.bom.placeholders[key], `${locale}: placeholders.${key}`);
    for (const key of ['vision', 'lighting', 'cabling', 'computing', 'software', 'accessory', 'mechanical']) assert.ok(m.bom.categories[key], `${locale}: categories.${key}`);
    assert.ok(m.solutions.select && m.solutions.selected);
  }
});
