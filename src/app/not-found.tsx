import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('errors.notFound');

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="text-5xl font-bold text-slate-300 dark:text-slate-700">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{t('body')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('home')}
        </Link>
        <Link
          href="/cam-nang"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('handbook')}
        </Link>
      </div>
    </section>
  );
}
