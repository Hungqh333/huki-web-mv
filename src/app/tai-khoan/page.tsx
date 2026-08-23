import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/auth/ProfileForm';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { SupabaseNotConfigured } from '@/components/auth/SupabaseNotConfigured';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

type HistoryRow = {
  id: string;
  created_at: string;
  task_types: { name_vi: string; name_en: string } | null;
};

export default async function AccountPage() {
  const t = await getTranslations('auth.account');

  if (!hasSupabaseEnv()) return <SupabaseNotConfigured />;

  const session = await getSessionContext();
  if (!session) redirect('/dang-nhap');

  const { user, profile } = session;
  const role = profile?.role ?? 'registered';

  // RLS chỉ trả về lịch sử của chính user này, và chỉ khi user là Member trở lên.
  const supabase = await createClient();
  const { data } = await supabase
    .from('selector_history')
    .select('id, created_at, task_types(name_vi, name_en)')
    .order('created_at', { ascending: false })
    .limit(10);
  const history = (data ?? []) as unknown as HistoryRow[];

  const format = await getFormatter();

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold">{t('roleTitle')}</h2>
            <RoleBadge role={role} />
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {canUseSelector(role) ? t('roleSelectorAllowed') : t('roleSelectorBlocked')}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{t('profileTitle')}</h2>
          <div className="mt-4">
            <ProfileForm name={profile?.name ?? null} company={profile?.company ?? null} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{t('historyTitle')}</h2>
          {history.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {history.map((row) => (
                <li key={row.id} className="flex justify-between gap-4 py-2">
                  <span>{row.task_types?.name_vi ?? '—'}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {format.dateTime(new Date(row.created_at), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('historyEmpty')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
