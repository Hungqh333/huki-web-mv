import { getTranslations } from 'next-intl/server';

/**
 * Hiện khi .env.local chưa có thông tin Supabase — thay vì để trang sập với
 * stack trace khó hiểu.
 */
export async function SupabaseNotConfigured() {
  const t = await getTranslations('auth.notConfigured');

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">{t('title')}</h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{t('description')}</p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-amber-100 p-3 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
        </pre>
      </div>
    </section>
  );
}
