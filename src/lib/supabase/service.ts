import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnvOptional } from './env';

/**
 * Client khoá service_role — BỎ QUA RLS. Chỉ dùng ở máy chủ, chỉ để ĐỌC bảng mà
 * người dùng thường không được đọc nhưng engine cần (ngưỡng engine, bảng chiếu sáng —
 * chốt 2026-10-21, bảo vệ công thức đợt 1). Không bao giờ truyền client này hay dữ
 * liệu thô của nó xuống trình duyệt.
 *
 * Chưa điền SUPABASE_SERVICE_ROLE_KEY → null; nơi gọi tự lùi về client của người dùng.
 */
export function createServiceClient(): SupabaseClient | null {
  const env = getSupabaseEnvOptional();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) return null;
  return createSupabaseClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
