import 'server-only';

import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { FEATURE_DEFAULTS, FEATURE_KEYS, isFeatureLevel, roleAtLeast, type FeatureKey, type FeatureLevel } from '@/lib/permissions';
import type { UserRole } from '@/lib/roles';

/**
 * Mức tối thiểu của 8 nhóm chức năng, đọc từ bảng role_permissions (Admin sửa ở Admin → Người dùng,
 * chốt 2026-11-07 đợt 2). Đọc một lần mỗi lượt tải trang (React cache).
 *
 * Đây là lớp hiển thị / chặn sớm ở máy chủ; lớp quyết định là RLS trong database — các chính sách
 * dữ liệu công cụ gọi has_feature('<nhóm>') trên CHÍNH bảng này, nên hai lớp luôn cùng một nguồn.
 * Chưa dán SQL (bảng chưa có) hoặc đọc lỗi → dùng mức mặc định = quyền trước đây.
 */
export const loadFeatureLevels = cache(async (): Promise<Record<FeatureKey, FeatureLevel>> => {
  const levels: Record<FeatureKey, FeatureLevel> = { ...FEATURE_DEFAULTS };
  if (!hasSupabaseEnv()) return levels;
  const supabase = await createClient();
  const { data, error } = await supabase.from('role_permissions').select('feature, min_role');
  if (error || !data) return levels;
  for (const row of data as { feature: string; min_role: string }[]) {
    if ((FEATURE_KEYS as readonly string[]).includes(row.feature) && isFeatureLevel(row.min_role)) {
      levels[row.feature as FeatureKey] = row.min_role;
    }
  }
  return levels;
});

/** Người có vai trò `role` có được dùng nhóm `feature` không. Khách chưa đăng nhập: không. */
export async function canUseFeature(role: UserRole | null | undefined, feature: FeatureKey): Promise<boolean> {
  if (!role) return false;
  const levels = await loadFeatureLevels();
  return roleAtLeast(role, levels[feature]);
}

/**
 * Chữ cho khung "Cần quyền … trở lên" của trang công cụ: tên mức tối thiểu đang đặt của nhóm và
 * tên mức hiện tại của người xem — để đổi mức ở bảng quyền thì chữ trên trang đổi theo.
 */
export async function lockedTextValues(feature: FeatureKey, role: UserRole | null | undefined): Promise<{ level: string; current: string }> {
  const [levels, tRoles] = await Promise.all([loadFeatureLevels(), getTranslations('roles')]);
  return { level: tRoles(levels[feature]), current: role ? tRoles(role) : '' };
}
