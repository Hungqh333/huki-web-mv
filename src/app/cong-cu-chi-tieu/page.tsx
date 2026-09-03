import Link from 'next/link';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { KpiCalculator } from '@/components/kpi/KpiCalculator';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { getKpiData } from '@/lib/kpi/queries';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { contactMailto } from '@/lib/contact';

export default async function KpiToolPage() {
  const t = await getTranslations('kpi');
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi';

  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && canUseSelector(role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">
            {t('locked.title')}
          </h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">
            {session ? t('locked.bodyRegistered') : t('locked.bodyGuest')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link
                href="/dang-nhap"
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                {t('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - Bo tinh chi tieu')}
              className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              {t('locked.contact')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const data = await getKpiData();

  // Namespace 'kpi' bị loại khỏi provider ở layout gốc vì nó chứa hướng dẫn đàm
  // phán nội bộ. Chỉ nạp cho client tại đây — tức là chỉ khi người dùng đã qua
  // được cổng Member+ ở trên.
  const messages = await getMessages();

  if (data.problemTypes.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('noData')}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-8">
        <NextIntlClientProvider messages={{ kpi: messages.kpi }}>
          <KpiCalculator data={data} locale={locale} />
        </NextIntlClientProvider>
      </div>
    </section>
  );
}
