import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { DEFAULT_ENGINE_PARAMS, resolveEngineParams, type EngineParamKey, type EngineParams } from '@/lib/vision/engineParams';
import { DEFAULT_ENGINE_TABLES, resolveEngineTables, type EngineTables, type TableRowError } from '@/lib/vision/engineTables';

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Reader = Pick<Supabase, 'from'>;

export type LoadedEngineParams = {
  params: EngineParams;
  /** Khoá đang khác mặc định. */
  overridden: EngineParamKey[];
  /** Bảng có giá trị nhưng bộ giá trị vi phạm giới hạn → đang chạy bằng mặc định. */
  rejected: boolean;
  /** Giá trị đang lưu trong bảng (cho form admin) và người sửa gần nhất. */
  stored: Record<string, { value: number; updatedBy: string | null; updatedAt: string }>;
  /** Bảng chiếu sáng + giả định mặc định (engine_tables, 2026-10-16). */
  tables: EngineTables;
  /** Dòng bảng lỗi bị bỏ (đang dùng mặc định cho dòng đó). */
  tableRejected: TableRowError[];
  /** Người sửa gần nhất từng dòng bảng — khoá `${table}.${row}`. */
  tableStored: Record<string, { updatedBy: string | null; updatedAt: string }>;
  /**
   * Máy chủ chưa có khoá service_role: hai bảng chỉ admin đọc được (2026-10-21), nên
   * Member/VIP đang tính bằng ngưỡng MẶC ĐỊNH. Trang admin hiện cảnh báo.
   */
  serviceKeyMissing: boolean;
};

/** Bảng engine_tables (migration 20261016000001). Chưa có bảng / lỗi → mặc định. */
async function loadTables(supabase: Reader): Promise<Pick<LoadedEngineParams, 'tables' | 'tableRejected' | 'tableStored'>> {
  const fallback = { tables: DEFAULT_ENGINE_TABLES, tableRejected: [], tableStored: {} };
  try {
    const { data, error } = await supabase.from('engine_tables').select('table_key, row_key, data, updated_by, updated_at');
    if (error) {
      console.warn('[engine-tables]', error.code, error.message);
      return fallback;
    }
    const rows = (data ?? []) as { table_key: string; row_key: string; data: unknown; updated_by: string | null; updated_at: string }[];
    const resolved = resolveEngineTables(rows);
    if (resolved.rejected.length > 0) console.warn('[engine-tables] dong loi bi bo:', resolved.rejected.map((r) => `${r.table}.${r.row}`).join(', '));
    return {
      tables: resolved.tables,
      tableRejected: resolved.rejected,
      tableStored: Object.fromEntries(rows.map((row) => [`${row.table_key}.${row.row_key}`, { updatedBy: row.updated_by, updatedAt: row.updated_at }])),
    };
  } catch (error) {
    console.warn('[engine-tables]', error instanceof Error ? error.name : 'Error');
    return fallback;
  }
}

/**
 * Ngưỡng engine đang dùng (bảng engine_parameters, migration 20261012000001).
 * Bảng chưa có (chưa dán SQL), lỗi mạng hay không đọc được → MẶC ĐỊNH, ghi log —
 * trang vẫn chạy, chỉ là chưa áp ngưỡng đã sửa.
 */
export async function loadEngineParams(userClient: Supabase): Promise<LoadedEngineParams> {
  // Hai bảng chỉ admin đọc được (migration 20261021000001) → máy chủ đọc bằng khoá service_role
  // để Member/VIP cũng tính bằng ngưỡng đã chỉnh. Chưa có khoá → client người dùng (admin vẫn đọc được).
  const service = createServiceClient();
  if (!service) console.warn('[engine-params] thieu SUPABASE_SERVICE_ROLE_KEY — nguoi khong phai admin dang dung nguong mac dinh');
  const supabase: Reader = service ?? userClient;
  const serviceKeyMissing = service === null;
  const tables = await loadTables(supabase);
  const fallback: LoadedEngineParams = { params: DEFAULT_ENGINE_PARAMS, overridden: [], rejected: false, stored: {}, ...tables, serviceKeyMissing };
  try {
    const { data, error } = await supabase.from('engine_parameters').select('key, value, updated_by, updated_at');
    if (error) {
      console.warn('[engine-params]', error.code, error.message);
      return fallback;
    }
    const rows = (data ?? []) as { key: string; value: number | string; updated_by: string | null; updated_at: string }[];
    const resolved = resolveEngineParams(rows);
    if (resolved.rejected) console.warn('[engine-params] bo gia tri vi pham gioi han — dung mac dinh');
    return {
      ...resolved,
      ...tables,
      serviceKeyMissing,
      stored: Object.fromEntries(rows.map((row) => [row.key, { value: Number(row.value), updatedBy: row.updated_by, updatedAt: row.updated_at }])),
    };
  } catch (error) {
    console.warn('[engine-params]', error instanceof Error ? error.name : 'Error');
    return fallback;
  }
}
