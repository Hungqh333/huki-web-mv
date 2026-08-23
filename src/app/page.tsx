import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('title')}</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
        {t('subtitle')}
      </p>
      <Link
        href="/cam-nang"
        className="mt-8 inline-block rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
      >
        {t('cta')}
      </Link>
    </section>
  );
}
