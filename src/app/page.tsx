import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Ba icon nét mảnh cho ba module. Dùng SVG nội tuyến vì dự án không có thư viện
 * icon, và ba cái là đủ nên không cần kéo cả gói về. currentColor để icon ăn màu
 * theo huy hiệu bao ngoài, sáng/tối đều đúng.
 */
const ICONS = {
  handbook: (
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5V5.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5V5.5Z" />
  ),
  selector: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  kpi: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
} as const;

/**
 * Mỗi module một tông màu riêng, kiểu huy hiệu icon tròn nhiều màu trong trang
 * cài đặt Google mà đội dùng làm mẫu tham chiếu. Giữ nền nhạt để chữ vẫn tương
 * phản tốt ở cả hai chế độ.
 */
const MODULES = [
  {
    key: 'selector',
    href: '/cong-cu-chon-thiet-bi',
    badge:
      'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  },
  {
    key: 'kpi',
    href: '/cong-cu-chi-tieu',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    key: 'handbook',
    href: '/cam-nang',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
] as const;

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
                <span
                  className={`inline-flex size-12 items-center justify-center rounded-xl ${mod.badge}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-6"
                    aria-hidden="true"
                  >
                    {ICONS[mod.key]}
                  </svg>
                </span>
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
