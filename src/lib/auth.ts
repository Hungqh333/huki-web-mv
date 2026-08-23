import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export type UserRole = 'registered' | 'member' | 'vip' | 'admin';
export type AccessTier = 'public' | 'registered' | 'member' | 'vip';

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type SessionContext = {
  user: User;
  profile: Profile | null;
};

/**
 * CẢNH BÁO: những hằng số và hàm dưới đây chỉ dùng để hiển thị giao diện cho
 * đúng (ẩn/hiện nút, gắn badge "khoá"). Chúng KHÔNG phải là lớp bảo vệ.
 * Nguồn sự thật duy nhất là RLS trong database — xem
 * supabase/migrations/20260823000001_init_schema.sql mục 11.
 */
export const TIER_RANK: Record<AccessTier, number> = {
  public: 0,
  registered: 1,
  member: 2,
  vip: 3,
};

export const ROLE_MAX_TIER: Record<UserRole, number> = {
  registered: 1,
  member: 2,
  vip: 3,
  admin: 3,
};

/** Quyền đọc cao nhất của người xem. Khách chưa đăng nhập = 0 (chỉ tier public). */
export function maxTierFor(role: UserRole | null | undefined): number {
  return role ? ROLE_MAX_TIER[role] : 0;
}

export function canViewTier(role: UserRole | null | undefined, tier: AccessTier): boolean {
  return TIER_RANK[tier] <= maxTierFor(role);
}

/** Member trở lên mới được dùng bộ chọn thiết bị (CLAUDE.md mục 2). */
export function canUseSelector(role: UserRole | null | undefined): boolean {
  return role === 'member' || role === 'vip' || role === 'admin';
}

/** VIP trở lên mới có tính năng nâng cao (xuất báo cáo, so sánh nhiều phương án). */
export function hasAdvancedFeatures(role: UserRole | null | undefined): boolean {
  return role === 'vip' || role === 'admin';
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

/** Trả về null khi chưa đăng nhập hoặc chưa cấu hình Supabase. */
export async function getSessionContext(): Promise<SessionContext | null> {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // RLS chỉ cho phép đọc đúng dòng của chính mình.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, company, role, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  return { user, profile: profile ?? null };
}

/** Vai trò hiện tại, hoặc null nếu là khách. */
export async function getCurrentRole(): Promise<UserRole | null> {
  const session = await getSessionContext();
  return session?.profile?.role ?? null;
}
