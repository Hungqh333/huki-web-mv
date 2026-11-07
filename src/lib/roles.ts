/**
 * Vai trò và quy tắc quyền thuần (không đụng máy chủ) — tách khỏi auth.ts (2026-11-07) để test
 * (tsx) và bảng quyền src/lib/permissions.ts kiểm được; auth.ts xuất lại y nguyên.
 */

export type UserRole = 'registered' | 'member' | 'vip' | 'admin';
export type AccessTier = 'public' | 'registered' | 'member' | 'vip';

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
