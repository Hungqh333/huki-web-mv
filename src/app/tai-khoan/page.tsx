import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/auth/ProfileForm';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { SupabaseNotConfigured } from '@/components/auth/SupabaseNotConfigured';
import { ThemeToggle } from '@/components/settings/ThemeToggle';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';
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

  const tTheme = await getTranslations('theme');
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
      {/* Đầu trang: huy hiệu icon + email + nút đăng xuất, kiểu trang cài đặt mẫu */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <IconBadge name="user" tone="sky" className="size-12" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
          </div>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 space-y-4">
        <SettingCard iconTone="violet" icon="shield" title={t('roleTitle')} action={<RoleBadge role={role} />}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {canUseSelector(role) ? t('roleSelectorAllowed') : t('roleSelectorBlocked')}
          </p>
        </SettingCard>

        <SettingCard iconTone="emerald" icon="user" title={t('profileTitle')}>
          <ProfileForm name={profile?.name ?? null} company={profile?.company ?? null} />
        </SettingCard>

        <SettingCard iconTone="sky" icon="monitor" title={tTheme('title')}>
          <p className="text-sm text-slate-600 dark:text-slate-400">{tTheme('hint')}</p>
          <div className="mt-3">
            <ThemeToggle />
          </div>
        </SettingCard>

        <SettingCard iconTone="amber" icon="clock" title={t('historyTitle')}>
          {history.length > 0 ? (
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {history.map((row) => (
                <li key={row.id} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span>{row.task_types?.name_vi ?? '—'}</span>
                  <span className="text-slate-500 tabular-nums dark:text-slate-400">
                    {format.dateTime(new Date(row.created_at), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('historyEmpty')}</p>
          )}
        </SettingCard>
      </div>
    </section>
  );
}

/**
 * Thẻ một mục cài đặt: huy hiệu icon bên trái, tiêu đề + hành động ở hàng đầu,
 * nội dung bên dưới. Dựng theo bố cục hàng-thẻ của trang cài đặt mẫu.
 */
function SettingCard({
  icon,
  iconTone,
  title,
  action,
  children,
}: {
  icon: IconName;
  iconTone: BadgeTone;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <IconBadge name={icon} tone={iconTone} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{title}</h2>
            {action}
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
