import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';

/**
 * Ba module, mỗi cái một tông màu riêng — kiểu huy hiệu icon tròn nhiều màu
 * trong trang cài đặt Google mà đội dùng làm mẫu tham chiếu. Icon và bảng màu
 * dùng chung ở @/components/ui/Icon để cả app nhất quán.
 */
const MODULES: { key: string; href: string; icon: IconName; tone: BadgeTone }[] = [
  { key: 'selector', href: '/cong-cu-chon-thiet-bi', icon: 'selector', tone: 'violet' },
  { key: 'kpi', href: '/cong-cu-chi-tieu', icon: 'kpi', tone: 'emerald' },
  { key: 'handbook', href: '/cam-nang', icon: 'handbook', tone: 'sky' },
];

export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      {/* Hero */}
      <section className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25">
          Machine Vision · Internal
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">{t('title')}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t('subtitle')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/cam-nang"
            className="inline-flex min-h-11 items-center rounded-lg bg-sky-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
          >
            {t('cta')}
          </Link>
          <Link
            href="/cong-cu-chon-thiet-bi"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('ctaSecondary')}
          </Link>
        </div>
      </section>

      {/* Ba công cụ */}
      <section className="mt-16 sm:mt-20">
        <h2 className="text-xl font-semibold tracking-tight">{t('modulesHeading')}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          {t('modulesSub')}
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => (
            <li key={mod.key}>
              <Link
                href={mod.href}
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <IconBadge name={mod.icon} tone={mod.tone} className="size-12" />
                <h3 className="mt-4 font-semibold">{t(`modules.${mod.key}.title`)}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(`modules.${mod.key}.desc`)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-700 dark:text-sky-400">
                  {t('open')}
                  <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
