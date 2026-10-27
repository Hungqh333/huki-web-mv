/**
 * Danh mục thiết bị /thiet-bi (chốt 2026-10-27, Q1–Q8): lọc, đếm chip, giỏ đã chọn,
 * so sánh, mã trong đường dẫn và file Excel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import {
  brandFacets,
  compareRows,
  comparableKinds,
  emptyQuery,
  filterItems,
  kindCounts,
  optionFacets,
  parseCodes,
  sanitizeSelection,
  type CatalogItem,
} from '../src/lib/catalog/catalog';
import { buildCatalogWorkbook, type CatalogLabels } from '../src/lib/export/catalogWorkbook';

let n = 0;
const item = (kind: CatalogItem['kind'], brand: string, model: string, spec: Record<string, unknown>, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  id: `id-${++n}`,
  code: `${kind.toUpperCase().replace(/_/g, '-')}-${n}`,
  kind,
  brand,
  model,
  spec,
  price_vnd: null,
  datasheet_url: null,
  source: 'datasheet',
  notes_vi: null,
  notes_en: null,
  sort_order: n,
  lead_time_days: null,
  supplier: null,
  used_in_projects: 0,
  is_common: false,
  ...extra,
});

const ITEMS: CatalogItem[] = [
  item('camera', 'Basler', 'a2A2590-22gm', { camera_type: 'area', resolution_mp: 5, interface: 'GigE', color: 'mono' }, { is_common: true, price_vnd: 12_500_000 }),
  item('camera', 'Basler', 'a2A1920-51gc', { camera_type: 'area', resolution_mp: 2.3, interface: 'GigE', color: 'color' }),
  item('camera', 'iRayple', 'A5201MU150', { camera_type: 'area', resolution_mp: 20, interface: 'USB3', color: 'mono' }, { is_common: true }),
  item('camera', 'iRayple', 'L4K', { camera_type: 'line', line_width_px: 4096, interface: 'CXP-12', color: 'mono' }),
  item('lens', 'Computar', 'M2518', { lens_type: 'fixed', focal_length_mm: 25, mount: 'C', image_circle: '2/3"' }, { is_common: true }),
  item('code_reader', 'Mẫu', 'Đầu đọc ống kính', { code_types: ['1D', '2D'] }),
];

test('lọc: chế độ Thường dùng chỉ hiện ★; tìm chữ không dấu, nhiều từ', () => {
  assert.deepEqual(filterItems(ITEMS, emptyQuery('camera', true)).map((i) => i.model), ['a2A2590-22gm', 'A5201MU150']);
  assert.equal(filterItems(ITEMS, emptyQuery('camera', false)).length, 4);
  assert.deepEqual(filterItems(ITEMS, { ...emptyQuery('camera', false), text: 'basler 1920' }).map((i) => i.model), ['a2A1920-51gc']);
  assert.equal(filterItems(ITEMS, { ...emptyQuery('code_reader', false), text: 'dau doc ong' }).length, 1);
});

test('lọc chip + khoảng; thiếu thông số thì không khớp khoảng', () => {
  const q = { ...emptyQuery('camera', false), options: { color: ['mono'] }, ranges: { resolution_mp: { min: 4, max: null } } };
  // L4K (line scan) không khai resolution_mp → không khớp khoảng.
  assert.deepEqual(filterItems(ITEMS, q).map((i) => i.model), ['a2A2590-22gm', 'A5201MU150']);
  const multi = { ...emptyQuery('code_reader', false), options: { code_types: ['2D'] } };
  assert.equal(filterItems(ITEMS, multi).length, 1);
});

test('★ đứng trước trong danh sách cả kho', () => {
  const list = filterItems(ITEMS, emptyQuery('camera', false));
  assert.equal(list[0].is_common, true);
  assert.equal(list[1].is_common, true);
});

test('đếm chip không tự loại chính nhóm của nó; đếm hãng', () => {
  const q = { ...emptyQuery('camera', false), options: { color: ['mono'] } };
  assert.deepEqual(optionFacets(ITEMS, q, 'color'), [
    { value: 'mono', count: 3 },
    { value: 'color', count: 1 },
  ]);
  assert.deepEqual(brandFacets(ITEMS, q), [
    { value: 'Basler', count: 1 },
    { value: 'iRayple', count: 2 },
  ]);
  assert.deepEqual(kindCounts(ITEMS, true), [
    { kind: 'camera', count: 2 },
    { kind: 'lens', count: 1 },
  ]);
});

test('giỏ đã chọn: bỏ mã lạ / trùng / không phải chuỗi, giữ thứ tự', () => {
  const codes = new Set(ITEMS.map((i) => i.code));
  const [a, b] = [ITEMS[1].code, ITEMS[0].code];
  assert.deepEqual(sanitizeSelection([a, 'XYZ-1', b, a, 3], codes), [a, b]);
  assert.deepEqual(sanitizeSelection('khong-phai-mang', codes), []);
});

test('so sánh: chỉ hàng có khai, đánh dấu hàng khác nhau, so được khi ≥ 2 món cùng loại', () => {
  const rows = compareRows([ITEMS[0], ITEMS[1]]);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(byKey.interface.differs, false);
  assert.equal(byKey.color.differs, true);
  assert.equal(byKey.resolution_mp.differs, true);
  assert.equal(byKey.line_width_px, undefined);
  assert.deepEqual(comparableKinds([ITEMS[0], ITEMS[1], ITEMS[4]]), ['camera']);
});

test('mã trong đường dẫn: chỉ nhận mã đúng dạng, bỏ trùng, có giới hạn', () => {
  assert.deepEqual(parseCodes('cam-1, CAM-1,,x y,LENS-2'), ['CAM-1', 'LENS-2']);
  assert.deepEqual(parseCodes('A,B,C', 2), ['A', 'B']);
  assert.deepEqual(parseCodes(null), []);
});

test('file Excel: sheet danh sách + một sheet mỗi loại, giá để số, thiếu giá để trống', async () => {
  const labels: CatalogLabels = {
    kind: (k) => (k === 'camera' ? 'Camera' : k === 'lens' ? 'Ống kính' : k),
    spec: (k) => k,
    value: (_k, v) => v,
    source: (s) => s,
    text: (k) => k,
  };
  const buffer = await buildCatalogWorkbook([ITEMS[0], ITEMS[2], ITEMS[4]], labels, new Date('2026-10-27'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['sheetList', 'Camera', 'Ống kính']
  );
  const list = wb.getWorksheet('sheetList')!;
  assert.equal(list.getRow(4).getCell(6).value, 12_500_000);
  assert.equal(list.getRow(5).getCell(6).value, null);
  const cam = wb.getWorksheet('Camera')!;
  assert.equal(cam.rowCount, 3);
});
