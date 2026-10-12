import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { DEFAULT_ENGINE_PARAMS, resolveEngineParams, type EngineParamKey, type EngineParams } from '@/lib/vision/engineParams';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type LoadedEngineParams = {
  params: EngineParams;
  /** Khoá đang khác mặc định. */
  overridden: EngineParamKey[];
  /** Bảng có giá trị nhưng bộ giá trị vi phạm giới hạn → đang chạy bằng mặc định. */
  rejected: boolean;
  /** Giá trị đang lưu trong bảng (cho form admin) và người sửa gần nhất. */
  stored: Record<string, { value: number; updatedBy: string | null; updatedAt: string }>;
};

/**
 * Ngưỡng engine đang dùng (bảng engine_parameters, migration 20261012000001).
 * Bảng chưa có (chưa dán SQL), lỗi mạng hay không đọc được → MẶC ĐỊNH, ghi log —
 * trang vẫn chạy, chỉ là chưa áp ngưỡng đã sửa.
 */
export async function loadEngineParams(supabase: Supabase): Promise<LoadedEngineParams> {
  const fallback: LoadedEngineParams = { params: DEFAULT_ENGINE_PARAMS, overridden: [], rejected: false, stored: {} };
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
      stored: Object.fromEntries(rows.map((row) => [row.key, { value: Number(row.value), updatedBy: row.updated_by, updatedAt: row.updated_at }])),
    };
  } catch (error) {
    console.warn('[engine-params]', error instanceof Error ? error.name : 'Error');
    return fallback;
  }
}
