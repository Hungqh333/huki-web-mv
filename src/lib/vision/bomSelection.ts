/**
 * Lựa chọn BOM của người dùng (V1c C5) — phần nằm trong bản nháp và gửi lên server.
 *
 * Tách khỏi bom.ts để tầng Yêu cầu (draft.ts) kiểm được bản nháp mà không kéo
 * cả engine chọn thiết bị vào. Danh sách mức phải khớp SOLUTION_LEVELS — test kiểm.
 */
export const BOM_LEVEL_KEYS = ['economy', 'recommended', 'highPerformance'] as const;

export type BomSelection = {
  level: (typeof BOM_LEVEL_KEYS)[number];
  /** Số lượng người dùng sửa, theo khoá dòng. */
  qty: Record<string, number>;
  /** Khoá dòng người dùng bỏ (chỉ dòng removable). */
  removed: string[];
  /** Mã linh kiện phụ kiện tích tay thêm vào. */
  added: string[];
};

/** Số lượng một dòng người dùng được nhập. */
export const BOM_QTY_MAX = 999;

/** Lựa chọn hợp lệ? Dùng cho bản nháp (sessionStorage) và dữ liệu gửi lên server. */
export function isBomSelection(value: unknown): value is BomSelection {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    (BOM_LEVEL_KEYS as readonly unknown[]).includes(s.level) &&
    !!s.qty &&
    typeof s.qty === 'object' &&
    !Array.isArray(s.qty) &&
    Object.values(s.qty as object).every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= BOM_QTY_MAX) &&
    Array.isArray(s.removed) &&
    s.removed.every((k) => typeof k === 'string') &&
    Array.isArray(s.added) &&
    s.added.every((k) => typeof k === 'string')
  );
}

export const emptySelection = (level: BomSelection['level']): BomSelection => ({ level, qty: {}, removed: [], added: [] });
