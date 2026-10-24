/**
 * Bảng tra của engine sửa được qua admin — chốt 2026-10-16 (đợt 2):
 * - Bảng chiếu sáng (LGT-001…004): loại lỗi / bề mặt lấn át → đèn chính, đèn thay
 *   thế, câu lý do vi/en.
 * - Giả định mặc định: giá trị điền vào ô bỏ trống + câu giải thích vi/en.
 * - Trang Chọn đèn bản 2 (chốt 2026-10-22, docs/NHAP_CHON_DEN_V2.md):
 *   · bảng màu 'lightColor': hệ số phản xạ 13 màu × đỏ / lục / lam + 3 mục đích đặc biệt (LGT-010…014)
 *   · bảng kiểu đèn 'lightMatrix': thứ tự xét + ma trận lỗi × bề mặt + bảng theo bài toán (LGT-017…023)
 *   Thứ tự xét luật nằm trong lightColor.ts / lightMatrix.ts.
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
import {
  COLOR_ROW_KEYS,
  DEFAULT_COLOR_TABLE_ROWS,
  REFLECTANCE_LEVELS,
  isLightColor,
  isReflectanceKey,
  type ColorRowKey,
  type ColorTableRow,
} from './lightColor';
import { DEFAULT_MATRIX_ROWS, MATRIX_ROW_KEYS, type MatrixRow, type MatrixRowKey } from './lightMatrix';
import { LIGHT_TYPES_V2, type LightTypeV2 } from './lightOptions';

export const LIGHT_TYPES = ['ring', 'dome', 'backlight', 'bar', 'coaxial', 'darkfield', 'photometric_stereo'] as const;
export type LightType = (typeof LIGHT_TYPES)[number];
const isLightType = (value: unknown): value is LightType => LIGHT_TYPES.includes(value as LightType);

export { COLOR_ROW_KEYS, LIGHTING_ROW_KEYS, MATRIX_ROW_KEYS, type ColorRowKey, type ColorTableRow, type LightingRowKey, type MatrixRowKey };
const isLightTypeV2 = (value: unknown): value is LightTypeV2 => LIGHT_TYPES_V2.includes(value as LightTypeV2);

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
  lightColor: Readonly<Record<ColorRowKey, ColorTableRow>>;
  lightMatrix: Readonly<Record<MatrixRowKey, MatrixRow>>;
}>;

export const ENGINE_TABLE_KEYS = ['lighting', 'defaults', 'lightColor', 'lightMatrix'] as const;
export type EngineTableKey = (typeof ENGINE_TABLE_KEYS)[number];

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
  lightColor: Object.freeze({ ...DEFAULT_COLOR_TABLE_ROWS }),
  lightMatrix: Object.freeze({ ...DEFAULT_MATRIX_ROWS }),
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

export type TableRowError = { table: EngineTableKey; row: string; code: 'lightType' | 'alternativeType' | 'sameType' | 'outOfRange' | 'choice' | 'text' | 'color' };

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

/**
 * Một dòng bảng màu từ dữ liệu thô → dòng hợp lệ hoặc lỗi. `refl_<màu>`: ba hệ số 0 / 1 / 2;
 * dòng đặc biệt: màu đèn chính / thay thế trong 6 màu của kho.
 */
export function parseColorRow(row: string, data: Record<string, unknown>): { ok: ColorTableRow } | { error: TableRowError } {
  const err = (code: TableRowError['code']) => ({ error: { table: 'lightColor' as const, row, code } });
  if (isReflectanceKey(row)) {
    const level = (v: unknown) => {
      const n = typeof v === 'string' ? Number(v) : v;
      return typeof n === 'number' && (REFLECTANCE_LEVELS as readonly number[]).includes(n) ? n : null;
    };
    const r = level(data.r);
    const g = level(data.g);
    const b = level(data.b);
    if (r === null || g === null || b === null) return err('outOfRange');
    return { ok: { r, g, b } };
  }
  if (!isLightColor(data.color)) return err('color');
  const alt = data.alternative === null || data.alternative === undefined || data.alternative === '' ? null : data.alternative;
  if (alt !== null && !isLightColor(alt)) return err('color');
  if (alt === data.color) return err('sameType');
  return { ok: { color: data.color, alternative: alt } };
}

/** Một dòng bảng kiểu đèn (trang Chọn đèn) — 10 kiểu của bản 2. */
export function parseMatrixRow(row: string, data: Record<string, unknown>): { ok: MatrixRow } | { error: TableRowError } {
  const err = (code: TableRowError['code']) => ({ error: { table: 'lightMatrix' as const, row, code } });
  if (!isLightTypeV2(data.lightType)) return err('lightType');
  const alt = data.alternativeType === null || data.alternativeType === undefined || data.alternativeType === '' ? null : data.alternativeType;
  if (alt !== null && !isLightTypeV2(alt)) return err('alternativeType');
  if (alt === data.lightType) return err('sameType');
  return { ok: { lightType: data.lightType, alternativeType: alt } };
}

const sameColor = (a: ColorTableRow, b: ColorTableRow) => JSON.stringify(a) === JSON.stringify(b);
const sameMatrix = (a: MatrixRow, b: MatrixRow) => a.lightType === b.lightType && a.alternativeType === b.alternativeType;
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
  const lightColor: Record<string, ColorTableRow> = { ...DEFAULT_ENGINE_TABLES.lightColor };
  const lightMatrix: Record<string, MatrixRow> = { ...DEFAULT_ENGINE_TABLES.lightMatrix };
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
    } else if (row.table_key === 'lightColor' && (COLOR_ROW_KEYS as readonly string[]).includes(row.row_key)) {
      const parsed = parseColorRow(row.row_key, data);
      if ('error' in parsed) rejected.push(parsed.error);
      else if (!sameColor(parsed.ok, lightColor[row.row_key])) {
        lightColor[row.row_key] = parsed.ok;
        overridden.push(`lightColor.${row.row_key}`);
      }
    } else if (row.table_key === 'lightMatrix' && (MATRIX_ROW_KEYS as readonly string[]).includes(row.row_key)) {
      const parsed = parseMatrixRow(row.row_key, data);
      if ('error' in parsed) rejected.push(parsed.error);
      else if (!sameMatrix(parsed.ok, lightMatrix[row.row_key])) {
        lightMatrix[row.row_key] = parsed.ok;
        overridden.push(`lightMatrix.${row.row_key}`);
      }
    }
  }
  if (overridden.length === 0) return { tables: DEFAULT_ENGINE_TABLES, overridden, rejected };
  return {
    tables: Object.freeze({
      lighting: Object.freeze(lighting as EngineTables['lighting']),
      defaults: Object.freeze(defaults as EngineTables['defaults']),
      lightColor: Object.freeze(lightColor as EngineTables['lightColor']),
      lightMatrix: Object.freeze(lightMatrix as EngineTables['lightMatrix']),
    }),
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
  for (const key of COLOR_ROW_KEYS) {
    if (!sameColor(tables.lightColor[key], DEFAULT_ENGINE_TABLES.lightColor[key])) parts.push(`c.${key}=${JSON.stringify(tables.lightColor[key])}`);
  }
  for (const key of MATRIX_ROW_KEYS) {
    if (!sameMatrix(tables.lightMatrix[key], DEFAULT_ENGINE_TABLES.lightMatrix[key])) parts.push(`m.${key}=${JSON.stringify(tables.lightMatrix[key])}`);
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
  table: EngineTableKey,
  read: (row: string, field: string) => string | null
): { errors: TableRowError[]; upserts: { row: string; data: LightingRow | DefaultRow | ColorTableRow | MatrixRow }[]; deletes: string[] } {
  const errors: TableRowError[] = [];
  const upserts: { row: string; data: LightingRow | DefaultRow | ColorTableRow | MatrixRow }[] = [];
  const deletes: string[] = [];
  if (table === 'lightColor') {
    for (const key of COLOR_ROW_KEYS) {
      const parsed = parseColorRow(
        key,
        isReflectanceKey(key) ? { r: read(key, 'r'), g: read(key, 'g'), b: read(key, 'b') } : { color: read(key, 'color'), alternative: read(key, 'alternative') }
      );
      if ('error' in parsed) errors.push(parsed.error);
      else if (sameColor(parsed.ok, DEFAULT_ENGINE_TABLES.lightColor[key])) deletes.push(key);
      else upserts.push({ row: key, data: parsed.ok });
    }
  } else if (table === 'lightMatrix') {
    for (const key of MATRIX_ROW_KEYS) {
      const parsed = parseMatrixRow(key, { lightType: read(key, 'lightType'), alternativeType: read(key, 'alternativeType') });
      if ('error' in parsed) errors.push(parsed.error);
      else if (sameMatrix(parsed.ok, DEFAULT_ENGINE_TABLES.lightMatrix[key])) deletes.push(key);
      else upserts.push({ row: key, data: parsed.ok });
    }
  } else if (table === 'lighting') {
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
