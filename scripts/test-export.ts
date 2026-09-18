/**
 * Xuất BOM Excel + mô hình Concept Report — V1c mục C6. Chốt Q1–Q7 ngày 2026-09-18.
 * Phần dựng PDF ở test-export-pdf.mts (react-pdf chỉ chạy ESM).
 *
 * Dựng bằng câu chữ THẬT (messages vi/en) qua createTranslator của next-intl,
 * để bắt cả khoá thiếu lẫn tham số ICU sai — lỗi mà nhìn code không thấy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { createTranslator } from 'next-intl';

import type { Component, ComponentKind } from '../src/lib/components/specs';
import { buildBomWorkbook } from '../src/lib/export/bomWorkbook';
import { buildConceptDocument, type Translate } from '../src/lib/export/conceptDocument';
import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { RULESET_VERSION, bomForRequirement } from '../src/lib/vision/bom';
import { emptySelection } from '../src/lib/vision/bomSelection';

const messages = (locale: string) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', `${locale}.json`), 'utf8'));
const missing: string[] = [];
const translator = (locale: 'vi' | 'en'): Translate => {
  const t = createTranslator({
    locale,
    messages: messages(locale),
    onError: (error) => missing.push(`${locale}: ${error.message}`),
    getMessageFallback: ({ key }) => `!!${key}`,
  });
  return (key, values) => t(key as never, values as never);
};

let id = 0;
const make = (kind: ComponentKind, model: string, spec: Record<string, unknown>, extra: Partial<Component> = {}): Component => ({
  id: `c${++id}`, code: model.toUpperCase(), kind, brand: 'Hãng', model, spec, price_vnd: 1_000_000, datasheet_url: null,
  source: 'datasheet', notes_vi: null, notes_en: null, is_active: true, sort_order: id, lead_time_days: 7, supplier: 'Nhà phân phối Việt', ...extra,
});
const CATALOG: Component[] = [
  make('camera', 'cam', {
    camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3',
    mount: 'C', interface: 'GigE', max_fps: 23, color: 'mono', shutter: 'global', trigger_io: 'yes',
  }, { price_vnd: 10_000_000, source: 'unverified' }),
  make('lens', 'f20', { lens_type: 'fixed', focal_length_mm: 20, image_circle: '2/3', mount: 'C', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160 }),
  make('light', 'dome', { light_type: 'dome', color: 'white', size_mm: 100 }),
  make('controller', 'pc', { cpu_cores: 8, ram_gb: 32, lan_ports: 4, pcie_slots: 2 }, { price_vnd: 20_000_000 }),
  make('cable', 'gige', { cable_for: 'camera_data', connector: 'RJ45', length_m: 5 }),
];
const requirement = Object.entries({
  'object.sizeX': 60, 'object.sizeY': 50, 'object.surface': 'glossy', 'object.heightVariation': 0.5,
  'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'detection.0.variability': 'low',
  'measurement.0.tolerance': 0.5, 'production.partsPerMinute': 30, 'system.cameraCount': 1, 'system.workingDistance': 300,
}).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'));
const bom = bomForRequirement(requirement, CATALOG, emptySelection('recommended'));

const docOf = (locale: 'vi' | 'en', overrides: { bom?: typeof bom; rule_version?: string | null } = {}) =>
  buildConceptDocument({
    projectName: 'Kiểm tra nắp nhựa',
    revision: {
      rev_label: 'B',
      requirement,
      bom: 'bom' in overrides ? overrides.bom! : bom,
      rule_version: 'rule_version' in overrides ? overrides.rule_version! : RULESET_VERSION,
      locked_at: '2026-09-18T03:00:00Z',
      updated_at: '2026-09-18T02:00:00Z',
    },
    author: 'ky.su@example.test',
    now: new Date('2026-09-18T04:00:00Z'),
    formatDate: (date) => date.toISOString().slice(0, 16),
    t: translator(locale),
  });

test('mô hình tài liệu: đủ phần theo spec §11.1, BOM lấy nguyên ảnh chụp', () => {
  assert.ok(bom, 'du lieu test phai dung duoc BOM');
  const doc = docOf('vi');
  assert.equal(doc.applicationLabel, 'Kiểm tra ngoại quan');
  assert.ok(doc.requirement.some((r) => r.label === 'Lỗi nhỏ nhất' && !r.assumed));
  assert.ok(doc.requirement.some((r) => r.assumed), 'o gia dinh duoc danh dau');
  assert.ok(doc.assumptions.length > 0);
  assert.ok(doc.analysis.length > 0 && doc.analysis.every((g) => g.rows.length > 0));
  assert.equal(doc.bom?.lines.length, bom!.lines.length);
  assert.equal(doc.bom?.lines.find((l) => l.code === 'CAM')?.unverified, true);
  assert.equal(doc.hasUnverified, true);
  assert.ok(doc.architecture.find((n) => n.node === 'Camera')?.equipment?.includes('Hãng cam'), 'kien truc gan thiet bi tu BOM');
  assert.ok(doc.validationPlan.some((v) => v.includes('LGT-001')), 'chieu sang be mat bong can chup mau');
  assert.ok(doc.validationPlan.some((v) => v.includes('Hãng cam')), 'thiet bi chua kiem chung → doi chieu datasheet');
  assert.equal(doc.exclusions.length, 4);
  assert.equal(doc.rulesetChanged, false);
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('phiên bản luật lúc lưu khác bây giờ → ghi rõ; revision chưa chọn phương án → không có BOM', () => {
  assert.equal(docOf('vi', { rule_version: 'v1c-2026.01.01' }).rulesetChanged, true);
  assert.equal(docOf('vi', { rule_version: null }).rulesetChanged, false, 'revision cu hon C5 chua co phien ban');
  const noBom = docOf('en', { bom: null });
  assert.equal(noBom.bom, null);
  assert.ok(noBom.assumptions.length > 0, 'khong co BOM thi tinh lai gia dinh');
});

test('Excel: đúng cột §11.2, thành tiền và tổng là công thức, dòng chưa kiểm chứng có *, sheet Giả định & Loại trừ', async () => {
  const buffer = await buildBomWorkbook(docOf('vi'), translator('vi'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const header = (ws.getRow(6).values as unknown[]).slice(1);
  assert.deepEqual(header, ['Nhóm', 'Mã hàng', 'Mô tả', 'SL', 'Đơn giá (₫)', 'Thành tiền (₫)', 'Giao hàng', 'Nhà cung cấp', 'Luật biện luận']);

  const camera = ws.getRow(7);
  assert.equal(camera.getCell(2).value, 'CAM');
  assert.match(String(camera.getCell(3).value), /Hãng cam \*/);
  assert.deepEqual((camera.getCell(6).value as { formula: string }).formula, 'D7*E7');
  assert.equal(camera.getCell(8).value, 'Nhà phân phối Việt');

  const lines = bom!.lines.length;
  const total = ws.getRow(7 + lines + 1).getCell(6).value as { formula: string; result: number };
  assert.equal(total.formula, `SUM(F7:F${6 + lines})`);
  // Có dòng cần báo giá (vật chuẩn) → tổng chưa đủ: không ghi kết quả giả, kèm ghi chú thiếu giá.
  assert.equal(bom!.total, null);
  assert.equal(total.result, undefined);
  assert.match(String(ws.getRow(7 + lines + 1).getCell(7).value), /Thiếu giá 1 dòng/);

  const notes = wb.worksheets[1];
  assert.equal(notes.name, 'Giả định & Loại trừ');
  const text = notes.getSheetValues().flat().join(' ');
  assert.match(text, /Đào tạo vận hành/);
  assert.deepEqual(missing, []);
});
