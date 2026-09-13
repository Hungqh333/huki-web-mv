import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ApplicationCards, ProblemInput } from '@/components/home/VisionEntry';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';

/**
 * Trang chủ Vision Engineer (spec V1.1 §10.1).
 *
 * Trang chủ cũ (ba module) giữ nguyên ở /home-old. Ba công cụ cũ không mất
 * đường vào — chúng thành dải "Công cụ hỗ trợ" ở cuối trang, secondary so với
 * Vision Engineer theo §0.2.
 */
const TOOLS: { key: string; href: string; icon: IconName; tone: BadgeTone }[] = [
  { key: 'visionDesigner', href: '/cong-cu-chon-thiet-bi', icon: 'selector', tone: 'violet' },
  { key: 'engineeringTools', href: '/cong-cu-chi-tieu', icon: 'kpi', tone: 'emerald' },
  { key: 'knowledgeBase', href: '/cam-nang', icon: 'handbook', tone: 'sky' },
];

export default async function HomePage() {
  const t = await getTranslations('home.entry');

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-400">
          {t('eyebrow')}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{t('title')}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          {t('subtitle')}
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-3xl">
        <ProblemInput />
      </section>

      <section className="mx-auto mt-14 max-w-5xl">
        <h2 className="text-center text-sm font-medium text-slate-600 dark:text-slate-400">
          {t('appsHeading')}
        </h2>
        <div className="mt-4">
          <ApplicationCards />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('toolsHeading')}
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {TOOLS.map((tool) => (
            <li key={tool.key}>
              <Link
                href={tool.href}
                className="group flex h-full items-start gap-3 rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <IconBadge name={tool.icon} tone={tool.tone} className="size-9" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-400">
                    {t(`tools.${tool.key}.title`)}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {t(`tools.${tool.key}.desc`)}
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
