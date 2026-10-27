import { COMPONENT_KINDS, SPEC_FIELDS, SUMMARY_KEYS, type Component, type ComponentKind, type SpecFieldDef } from '@/lib/components/specs';

/**
 * Danh mục thiết bị /thiet-bi (chốt 2026-10-27, Q1–Q8). Hàm thuần dùng chung cho trang
 * (lọc ngay trong trình duyệt — Q3), file Excel và test. Không có công thức thiết bị nào
 * ở đây: chỉ liệt kê, lọc, so sánh thông số đã khai trong kho.
 */

/** Một dòng kho như trang Danh mục nhận (đủ cột mua hàng). */
export type CatalogItem = Pick<
  Component,
  | 'id'
  | 'code'
  | 'kind'
  | 'brand'
  | 'model'
  | 'spec'
  | 'price_vnd'
  | 'datasheet_url'
  | 'source'
  | 'notes_vi'
  | 'notes_en'
  | 'sort_order'
  | 'lead_time_days'
  | 'supplier'
  | 'used_in_projects'
  | 'is_common'
>;

/** Cột đọc từ bảng components cho trang Danh mục và file Excel. */
export const CATALOG_COLUMNS =
  'id, code, kind, brand, model, spec, price_vnd, datasheet_url, source, notes_vi, notes_en, sort_order, lead_time_days, supplier, used_in_projects, is_common';

/** Bộ lọc thông số: chọn giá trị (chip) hoặc khoảng số (từ – đến). */
export type CatalogFilterDef = { key: string; type: 'options' | 'range' };

/** Bộ lọc thông số riêng từng loại (Q3). Loại không có ở đây chỉ lọc theo hãng + tìm chữ. */
export const CATALOG_FILTERS: Partial<Record<ComponentKind, CatalogFilterDef[]>> = {
  camera: [
    { key: 'camera_type', type: 'options' },
    { key: 'color', type: 'options' },
    { key: 'interface', type: 'options' },
    { key: 'sensor_format', type: 'options' },
    { key: 'shutter', type: 'options' },
    { key: 'resolution_mp', type: 'range' },
  ],
  lens: [
    { key: 'lens_type', type: 'options' },
    { key: 'mount', type: 'options' },
    { key: 'image_circle', type: 'options' },
    { key: 'focal_length_mm', type: 'range' },
    { key: 'magnification', type: 'range' },
  ],
  light: [
    { key: 'light_type', type: 'options' },
    { key: 'color', type: 'options' },
    { key: 'size_mm', type: 'range' },
  ],
  code_reader: [
    { key: 'code_types', type: 'options' },
    { key: 'focus', type: 'options' },
  ],
  tube: [{ key: 'mount', type: 'options' }],
  converter: [{ key: 'mount', type: 'options' }],
  cable: [{ key: 'cable_for', type: 'options' }],
  interface_card: [{ key: 'interface', type: 'options' }],
  light_controller: [{ key: 'strobe', type: 'options' }],
  software: [{ key: 'software_type', type: 'options' }],
  accessory: [{ key: 'accessory_type', type: 'options' }],
};

export type CatalogQuery = {
  kind: ComponentKind;
  /** Chỉ thiết bị ★ thường dùng (Q1, mặc định bật). */
  commonOnly: boolean;
  text: string;
  brands: string[];
  /** Giá trị đã chọn của bộ lọc chip, theo khoá spec. */
  options: Record<string, string[]>;
  /** Khoảng số đã nhập, theo khoá spec; null = không chặn. */
  ranges: Record<string, { min: number | null; max: number | null }>;
};

export const emptyQuery = (kind: ComponentKind, commonOnly: boolean): CatalogQuery => ({
  kind,
  commonOnly,
  text: '',
  brands: [],
  options: {},
  ranges: {},
});

/** Giá trị spec dạng danh sách chuỗi (multiselect giữ nguyên; giá trị đơn thành 1 phần tử). */
export function specValues(spec: Record<string, unknown>, key: string): string[] {
  const value = spec[key];
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function specNum(spec: Record<string, unknown>, key: string): number | null {
  const value = spec[key];
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Bỏ dấu + chữ thường để tìm "basler", "a2a" hay "ống" đều khớp. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Lọc trừ một nhóm (để đếm số dòng của từng chip mà không tự loại chính nó). */
type Except = { brands?: boolean; option?: string };

function matches(item: CatalogItem, q: CatalogQuery, except: Except = {}): boolean {
  if (item.kind !== q.kind) return false;
  if (q.commonOnly && !item.is_common) return false;
  const words = fold(q.text).split(/\s+/).filter(Boolean);
  if (words.length) {
    const hay = fold(`${item.brand} ${item.model} ${item.code}`);
    if (!words.every((w) => hay.includes(w))) return false;
  }
  if (!except.brands && q.brands.length && !q.brands.includes(item.brand)) return false;
  for (const [key, chosen] of Object.entries(q.options)) {
    if (key === except.option || !chosen.length) continue;
    const values = specValues(item.spec, key);
    if (!values.some((v) => chosen.includes(v))) return false;
  }
  for (const [key, { min, max }] of Object.entries(q.ranges)) {
    if (min === null && max === null) continue;
    // Thiếu thông số thì không khớp khoảng — không đoán thay người khai.
    const n = specNum(item.spec, key);
    if (n === null) return false;
    if (min !== null && n < min) return false;
    if (max !== null && n > max) return false;
  }
  return true;
}

/** Sắp xếp kho: ★ trước, rồi thứ tự admin đặt, rồi hãng + model. */
export function sortItems(items: CatalogItem[]): CatalogItem[] {
  return [...items].sort(
    (a, b) =>
      Number(Boolean(b.is_common)) - Number(Boolean(a.is_common)) ||
      a.sort_order - b.sort_order ||
      a.brand.localeCompare(b.brand) ||
      a.model.localeCompare(b.model)
  );
}

export function filterItems(items: CatalogItem[], q: CatalogQuery): CatalogItem[] {
  return sortItems(items.filter((item) => matches(item, q)));
}

/** Số dòng mỗi loại trong chế độ đang xem (Thường dùng / Cả kho) — cho tab loại. */
export function kindCounts(items: CatalogItem[], commonOnly: boolean): { kind: ComponentKind; count: number }[] {
  return COMPONENT_KINDS.map((kind) => ({
    kind,
    count: items.filter((i) => i.kind === kind && (!commonOnly || i.is_common)).length,
  })).filter((k) => k.count > 0);
}

export type Facet = { value: string; count: number };

/** Giá trị có trong kho của một bộ lọc chip, kèm số dòng khớp nếu chọn thêm giá trị đó. */
export function optionFacets(items: CatalogItem[], q: CatalogQuery, key: string): Facet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== q.kind || (q.commonOnly && !item.is_common)) continue;
    for (const v of specValues(item.spec, key)) if (!counts.has(v)) counts.set(v, 0);
    if (!matches(item, q, { option: key })) continue;
    for (const v of specValues(item.spec, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const order = SPEC_FIELDS[q.kind]?.find((f) => f.key === key)?.options ?? [];
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const ia = order.indexOf(a.value);
      const ib = order.indexOf(b.value);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
      return a.value.localeCompare(b.value, undefined, { numeric: true });
    });
}

export function brandFacets(items: CatalogItem[], q: CatalogQuery): Facet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== q.kind || (q.commonOnly && !item.is_common)) continue;
    if (!counts.has(item.brand)) counts.set(item.brand, 0);
    if (matches(item, q, { brands: true })) counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
}

/** Khoảng số có trong kho của một bộ lọc khoảng (gợi ý trong ô nhập). */
export function rangeBounds(items: CatalogItem[], kind: ComponentKind, key: string): { min: number; max: number } | null {
  const values = items.filter((i) => i.kind === kind).map((i) => specNum(i.spec, key)).filter((n): n is number => n !== null);
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

export const specField = (kind: ComponentKind, key: string): SpecFieldDef | undefined => SPEC_FIELDS[kind]?.find((f) => f.key === key);

/** Thông số tóm tắt để nhận ra thiết bị trong danh sách (SUMMARY_KEYS), theo thứ tự khai. */
export function summaryPairs(item: CatalogItem): { key: string; values: string[] }[] {
  return (SUMMARY_KEYS[item.kind] ?? [])
    .map((key) => ({ key, values: specValues(item.spec, key) }))
    .filter((p) => p.values.length);
}

/** Mọi thông số đã khai, theo thứ tự SPEC_FIELDS của loại (khung chi tiết). */
export function specPairs(item: CatalogItem): { field: SpecFieldDef; values: string[] }[] {
  return (SPEC_FIELDS[item.kind] ?? [])
    .map((field) => ({ field, values: specValues(item.spec, field.key) }))
    .filter((p) => p.values.length);
}

/** Số trường của loại chưa khai — khung chi tiết ghi "còn n thông số chưa khai". */
export function missingSpecCount(item: CatalogItem): number {
  return (SPEC_FIELDS[item.kind] ?? []).filter((f) => !specValues(item.spec, f.key).length).length;
}

// -----------------------------------------------------------------------------
// Giỏ "Đã chọn" + So sánh (Q5)
// -----------------------------------------------------------------------------

/** Tối đa số món so cạnh nhau. */
export const COMPARE_MAX = 4;
export const SELECTION_STORAGE_KEY = 'mvh.catalog.selected.v1';

/** Đọc giỏ đã lưu: chỉ giữ mã còn trong kho, bỏ trùng, giữ thứ tự chọn. */
export function sanitizeSelection(raw: unknown, codes: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === 'string' && codes.has(v) && !out.includes(v)) out.push(v);
  return out;
}

export type CompareRow = { key: string; field: SpecFieldDef | null; cells: string[][]; differs: boolean };

/**
 * Bảng so sánh: các món cùng loại (tối đa COMPARE_MAX), mỗi hàng một thông số có ít
 * nhất một món khai; `differs` = các món khai khác nhau (ô trống cũng tính là khác).
 */
export function compareRows(items: CatalogItem[]): CompareRow[] {
  const list = items.slice(0, COMPARE_MAX);
  if (!list.length) return [];
  const kind = list[0].kind;
  return (SPEC_FIELDS[kind] ?? [])
    .map((field) => {
      const cells = list.map((i) => specValues(i.spec, field.key));
      const keys = cells.map((c) => c.join('|'));
      return { key: field.key, field, cells, differs: new Set(keys).size > 1 };
    })
    .filter((row) => row.cells.some((c) => c.length));
}

/** Loại có ít nhất 2 món trong giỏ — mới so được (so cùng loại). */
export function comparableKinds(selected: CatalogItem[]): ComponentKind[] {
  return COMPONENT_KINDS.filter((kind) => selected.filter((i) => i.kind === kind).length >= 2);
}

// -----------------------------------------------------------------------------
// Mã trong đường dẫn ?ma= và file Excel
// -----------------------------------------------------------------------------

const CODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/** "A,B,,A,x y" → ["A","B"] — chỉ nhận mã đúng dạng kho, tối đa `limit` mã. */
export function parseCodes(raw: string | null | undefined, limit = 200): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const code = part.trim().toUpperCase();
    if (CODE_RE.test(code) && !out.includes(code)) out.push(code);
    if (out.length >= limit) break;
  }
  return out;
}
