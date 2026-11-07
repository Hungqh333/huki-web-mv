import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

import type { UserRole } from '@/lib/roles';

export type { AccessTier, UserRole } from '@/lib/roles';
export { ROLE_MAX_TIER, TIER_RANK, canUseSelector, canViewTier, hasAdvancedFeatures, isAdmin, maxTierFor } from '@/lib/roles';

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
