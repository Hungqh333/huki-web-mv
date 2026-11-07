'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { FEATURE_KEYS, isFeatureLevel, type FeatureKey } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';

export type FeatureLevelResult = { ok: true } | { ok: false; error: 'notAdmin' | 'invalid' | 'notPasted' | 'failed' };

/**
 * Admin đổi mức tối thiểu của một nhóm chức năng (chốt 2026-11-07 đợt 2).
 * RLS role_permissions_update_admin là chốt chặn thứ hai; trigger ghi lịch sử (ai, lúc nào, cũ → mới).
 * Có hiệu lực ngay ở database (has_feature) cho mọi người dùng.
 */
export async function updateFeatureLevelAction(feature: string, level: string): Promise<FeatureLevelResult> {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return { ok: false, error: 'notAdmin' };
  if (!(FEATURE_KEYS as readonly string[]).includes(feature) || !isFeatureLevel(level)) return { ok: false, error: 'invalid' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permissions')
    .update({ min_role: level })
    .eq('feature', feature as FeatureKey)
    .select('feature');
  if (error) {
    // 42P01: chưa dán SQL bảng quyền.
    if (error.code === '42P01' || /role_permissions/.test(error.message)) return { ok: false, error: 'notPasted' };
    console.error('[updateFeatureLevel]', error.code, error.message);
    return { ok: false, error: 'failed' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'notPasted' };
  // Mức mới đổi menu, trang công cụ, nút PDF… ở mọi trang.
  revalidatePath('/', 'layout');
  return { ok: true };
}
