import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LightSelector } from '@/components/light/LightSelector';
import { selectLightsAction } from '@/app/actions/lights';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { contactMailto } from '@/lib/contact';
import { hasSupabaseEnv } from '@/lib/supabase/env';

/**
 * Bộ chọn đèn — chốt 2026-10-22. Member trở lên, cùng mức Chọn ống kính.
 *
 * Trang KHÔNG gửi kho hay bảng luật xuống trình duyệt: LightSelector gọi server action
 * selectLightsAction cho mỗi lần đổi ô nhập (Q1, bảo vệ công thức). Action tự kiểm vai
 * trò; khung khoá dưới đây chỉ để mời đăng nhập / liên hệ thay vì một trang trống.
 */
export default async function LightSelectorPage() {
  const t = await getTranslations('lightSelector');
  const tPc = await getTranslations('pcPlanner');
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && canUseSelector(role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{tPc('locked.title')}</h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">
            {session ? tPc('locked.bodyRegistered') : tPc('locked.bodyGuest')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link href="/dang-nhap" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                {tPc('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - Chon den')}
              className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              {tPc('locked.contact')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{t('why')}</p>
      <div className="mt-8">
        <LightSelector run={selectLightsAction} />
      </div>
    </section>
  );
}
