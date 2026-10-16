/**
 * Bảng tra của engine sửa được qua admin — chốt 2026-10-16 (đợt 2):
 * - Bảng chiếu sáng (LGT-001…004): loại lỗi / bề mặt lấn át → đèn chính, đèn thay
 *   thế, câu lý do vi/en.
 * - Giả định mặc định: giá trị điền vào ô bỏ trống + câu giải thích vi/en.
 *
 * Cùng cách với engineParams.ts: mặc định = đúng bảng trong code (lighting.ts,
 * requirement/defaults.ts), database chỉ giữ dòng ĐÃ SỬA. Dòng lỗi (kiểu đèn lạ,
 * số ngoài giới hạn) bị bỏ riêng dòng đó — các dòng khác vẫn áp.
 *
 * Kiểu đèn chỉ trong 7 kiểu của kho thiết bị (Q2): bước lọc tìm đèn theo đúng khoá
 * light_type, kiểu ngoài kho thì không bao giờ tìm được đèn.
 *
 * Hàm thuần: database đọc ở engineTablesLoad.ts.
 */
import { FIELD_DEFAULTS } from '../requirement/defaults';
import { DEFAULT_LIGHTING_ROWS, LIGHTING_ROW_KEYS, type LightingRowKey } from './lighting';

export const LIGHT_TYPES = ['ring', 'dome', 'backlight', 'bar', 'coaxial', 'darkfield', 'photometric_stereo'] as const;
export type LightType = (typeof LIGHT_TYPES)[number];
const isLightType = (value: unknown): value is LightType => LIGHT_TYPES.includes(value as LightType);

export { LIGHTING_ROW_KEYS, type LightingRowKey };

export type LightingRow = {
  lightType: LightType;
  alternativeType: LightType | null;
  /** null = câu lý do mặc định trong messages (selector.vision.lightingReason.*). */
  reasonVi: string | null;
  reasonEn: string | null;
};

/** Ô giả định mặc định sửa được — khoá dòng → đường dẫn ô + kiểu giá trị. */
export const DEFAULT_ROW_DEFS = [
  { key: 'contrast', path: 'detection.0.contrast', kind: 'choice', options: ['high', 'medium', 'low'] },
  { key: 'heightVariation', path: 'object.heightVariation', kind: 'number', min: 0, max: 100, step: 0.1, unit: 'mm' },
  { key: 'workingDistance', path: 'system.workingDistance', kind: 'number', min: 10, max: 5000, step: 1, unit: 'mm' },
  { key: 'thermalExpansionCoeff', path: 'object.thermalExpansionCoeff', kind: 'number', min: 1, max: 300, step: 0.5, unit: 'µm/(m·K)' },
  { key: 'ambientTempRange', path: 'environment.ambientTempRange', kind: 'number', min: 0, max: 100, step: 0.5, unit: 'K' },
  { key: 'motion', path: 'production.motion', kind: 'choice', options: ['static', 'indexed', 'continuous'] },
] as const;
export type DefaultRowKey = (typeof DEFAULT_ROW_DEFS)[number]['key'];
export type DefaultRow = {
  value: number | string;
  /** null = câu giải thích mặc định trong requirement/defaults.ts. */
  basisVi: string | null;
  basisEn: string | null;
};

export type EngineTables = Readonly<{
  lighting: Readonly<Record<LightingRowKey, LightingRow>>;
  defaults: Readonly<Record<DefaultRowKey, DefaultRow>>;
}>;

export const DEFAULT_ENGINE_TABLES: EngineTables = Object.freeze({
  lighting: Object.freeze(
    Object.fromEntries(
      LIGHTING_ROW_KEYS.map((key) => {
        const row = DEFAULT_LIGHTING_ROWS[key];
        return [key, { lightType: row.lightType as LightType, alternativeType: (row.alternativeType ?? null) as LightType | null, reasonVi: null, reasonEn: null }];
      })
    ) as Record<LightingRowKey, LightingRow>
  ),
  defaults: Object.freeze(
    Object.fromEntries(
      DEFAULT_ROW_DEFS.map((def) => {
        const code = FIELD_DEFAULTS.find((d) => d.path === def.path);
        if (!code) throw new Error(`FIELD_DEFAULTS thiếu ${def.path}`);
        return [def.key, { value: code.value, basisVi: null, basisEn: null }];
      })
    ) as Record<DefaultRowKey, DefaultRow>
  ),
});

/** Câu chữ admin nhập: cắt khoảng trắng, rỗng = null, tối đa 600 ký tự. */
export const TABLE_TEXT_MAX = 600;
const text = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > TABLE_TEXT_MAX) return undefined;
  return trimmed === '' ? null : trimmed;
};

export type TableRowError = { table: 'lighting' | 'defaults'; row: string; code: 'lightType' | 'alternativeType' | 'sameType' | 'outOfRange' | 'choice' | 'text' };

/** Một dòng bảng chiếu sáng từ dữ liệu thô (database / form) → dòng hợp lệ hoặc lỗi. */
export function parseLightingRow(row: string, data: Record<string, unknown>): { ok: LightingRow } | { error: TableRowError } {
  const err = (code: TableRowError['code']) => ({ error: { table: 'lighting' as const, row, code } });
  if (!isLightType(data.lightType)) return err('lightType');
  const alt = data.alternativeType === null || data.alternativeType === undefined || data.alternativeType === '' ? null : data.alternativeType;
  if (alt !== null && !isLightType(alt)) return err('alternativeType');
  if (alt === data.lightType) return err('sameType');
  const reasonVi = text(data.reasonVi);
  const reasonEn = text(data.reasonEn);
  if (reasonVi === undefined || reasonEn === undefined) return err('text');
  return { ok: { lightType: data.lightType, alternativeType: alt, reasonVi, reasonEn } };
}

/** Một dòng giả định mặc định từ dữ liệu thô → dòng hợp lệ hoặc lỗi. */
export function parseDefaultRow(row: string, data: Record<string, unknown>): { ok: DefaultRow } | { error: TableRowError } {
  const err = (code: TableRowError['code']) => ({ error: { table: 'defaults' as const, row, code } });
  const def = DEFAULT_ROW_DEFS.find((d) => d.key === row);
  if (!def) return err('choice');
  let value: number | string;
  if (def.kind === 'number') {
    const n = typeof data.value === 'string' ? Number(data.value.trim().replace(',', '.')) : Number(data.value);
    if (data.value === '' || data.value === null || !Number.isFinite(n) || n < def.min || n > def.max) return err('outOfRange');
    value = n;
  } else {
    if (!(def.options as readonly string[]).includes(data.value as string)) return err('choice');
    value = data.value as string;
  }
  const basisVi = text(data.basisVi);
  const basisEn = text(data.basisEn);
  if (basisVi === undefined || basisEn === undefined) return err('text');
  return { ok: { value, basisVi, basisEn } };
}

const sameLighting = (a: LightingRow, b: LightingRow) =>
  a.lightType === b.lightType && a.alternativeType === b.alternativeType && a.reasonVi === b.reasonVi && a.reasonEn === b.reasonEn;
const sameDefault = (a: DefaultRow, b: DefaultRow) => a.value === b.value && a.basisVi === b.basisVi && a.basisEn === b.basisEn;

export type TableRowInput = { table_key: string; row_key: string; data: unknown };

/**
 * Bảng dùng thật từ các dòng database. Dòng lạ bỏ qua; dòng lỗi bỏ riêng dòng đó
 * (ghi vào `rejected`). Không sửa gì → đúng object mặc định (tham chiếu ổn định).
 */
export function resolveEngineTables(rows: readonly TableRowInput[]): { tables: EngineTables; overridden: string[]; rejected: TableRowError[] } {
  const lighting: Record<string, LightingRow> = { ...DEFAULT_ENGINE_TABLES.lighting };
  const defaults: Record<string, DefaultRow> = { ...DEFAULT_ENGINE_TABLES.defaults };
  const overridden: string[] = [];
  const rejected: TableRowError[] = [];
  for (const row of rows) {
    const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {};
    if (row.table_key === 'lighting' && (LIGHTING_ROW_KEYS as readonly string[]).includes(row.row_key)) {
      const parsed = parseLightingRow(row.row_key, data);
      if ('error' in parsed) rejected.push(parsed.error);
      else if (!sameLighting(parsed.ok, lighting[row.row_key])) {
        lighting[row.row_key] = parsed.ok;
        overridden.push(`lighting.${row.row_key}`);
      }
    } else if (row.table_key === 'defaults' && DEFAULT_ROW_DEFS.some((d) => d.key === row.row_key)) {
      const parsed = parseDefaultRow(row.row_key, data);
      if ('error' in parsed) rejected.push(parsed.error);
      else if (!sameDefault(parsed.ok, defaults[row.row_key])) {
        defaults[row.row_key] = parsed.ok;
        overridden.push(`defaults.${row.row_key}`);
      }
    }
  }
  if (overridden.length === 0) return { tables: DEFAULT_ENGINE_TABLES, overridden, rejected };
  return {
    tables: Object.freeze({ lighting: Object.freeze(lighting as EngineTables['lighting']), defaults: Object.freeze(defaults as EngineTables['defaults']) }),
    overridden,
    rejected,
  };
}

/** Dấu vân tay các dòng đã sửa — gắn vào phiên bản bộ luật (rulesetVersionFor). null = không sửa gì. */
export function engineTablesFingerprint(tables: EngineTables): string | null {
  const parts: string[] = [];
  for (const key of LIGHTING_ROW_KEYS) {
    if (!sameLighting(tables.lighting[key], DEFAULT_ENGINE_TABLES.lighting[key])) parts.push(`l.${key}=${JSON.stringify(tables.lighting[key])}`);
  }
  for (const def of DEFAULT_ROW_DEFS) {
    if (!sameDefault(tables.defaults[def.key], DEFAULT_ENGINE_TABLES.defaults[def.key])) parts.push(`d.${def.key}=${JSON.stringify(tables.defaults[def.key])}`);
  }
  if (parts.length === 0) return null;
  let hash = 2166136261;
  for (const ch of parts.join('|')) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(36);
}

/**
 * Form admin → các dòng cần ghi (khác mặc định) và cần xoá (bằng mặc định) + lỗi.
 * `read(row, field)` trả chuỗi ô form, null nếu không có.
 */
export function parseTableForm(
  table: 'lighting' | 'defaults',
  read: (row: string, field: string) => string | null
): { errors: TableRowError[]; upserts: { row: string; data: LightingRow | DefaultRow }[]; deletes: string[] } {
  const errors: TableRowError[] = [];
  const upserts: { row: string; data: LightingRow | DefaultRow }[] = [];
  const deletes: string[] = [];
  if (table === 'lighting') {
    for (const key of LIGHTING_ROW_KEYS) {
      const parsed = parseLightingRow(key, {
        lightType: read(key, 'lightType'),
        alternativeType: read(key, 'alternativeType'),
        reasonVi: read(key, 'reasonVi') ?? '',
        reasonEn: read(key, 'reasonEn') ?? '',
      });
      if ('error' in parsed) errors.push(parsed.error);
      else if (sameLighting(parsed.ok, DEFAULT_ENGINE_TABLES.lighting[key])) deletes.push(key);
      else upserts.push({ row: key, data: parsed.ok });
    }
  } else {
    for (const def of DEFAULT_ROW_DEFS) {
      const raw = read(def.key, 'value');
      const parsed = parseDefaultRow(def.key, {
        value: raw === null || raw.trim() === '' ? DEFAULT_ENGINE_TABLES.defaults[def.key].value : raw,
        basisVi: read(def.key, 'basisVi') ?? '',
        basisEn: read(def.key, 'basisEn') ?? '',
      });
      if ('error' in parsed) errors.push(parsed.error);
      else if (sameDefault(parsed.ok, DEFAULT_ENGINE_TABLES.defaults[def.key])) deletes.push(def.key);
      else upserts.push({ row: def.key, data: parsed.ok });
    }
  }
  return { errors, upserts, deletes };
}
