import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { deleteArticleAction } from '@/app/actions/admin';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { TierBadge } from '@/components/handbook/TierBadge';
import type { AccessTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Row = {
  id: string;
  slug: string;
  title_vi: string;
  access_tier: AccessTier;
  published_at: string | null;
  updated_at: string;
};

export default async function AdminArticlesPage({ searchParams }: PageProps<'/admin/bai-viet'>) {
  const t = await getTranslations('admin.articles');
  const format = await getFormatter();
  const { saved, deleted } = await searchParams;

  const supabase = await createClient();
  // Admin đọc được cả bản nháp (policy articles_select_by_tier có nhánh is_admin).
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title_vi, access_tier, published_at, updated_at')
    .order('updated_at', { ascending: false });

  const articles = (data ?? []) as Row[];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/bai-viet/moi"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('new')}
        </Link>
      </div>

      {saved ? <Flash tone="ok" text={t('saved')} /> : null}
      {deleted ? <Flash tone="ok" text={t('deleted')} /> : null}
      {error ? <Flash tone="error" text={error.message} /> : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colTitle')}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colTier')}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colStatus')}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colUpdated')}</th>
              <th scope="col" className="py-2 font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {articles.map((article) => (
              <tr key={article.id}>
                <td className="py-3 pr-4">
                  <Link
                    href={`/admin/bai-viet/${article.id}`}
                    className="font-medium hover:text-sky-700 dark:hover:text-sky-400"
                  >
                    {article.title_vi}
                  </Link>
                  <span className="block text-xs text-slate-400">{article.slug}</span>
                </td>
                <td className="py-3 pr-4">
                  <TierBadge tier={article.access_tier} />
                </td>
                <td className="py-3 pr-4">
                  {article.published_at ? (
                    <span className="text-emerald-700 dark:text-emerald-400">{t('published')}</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">{t('draft')}</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                  {format.dateTime(new Date(article.updated_at), { dateStyle: 'short' })}
                </td>
                <td className="py-3">
                  <DeleteButton action={deleteArticleAction} id={article.id} itemName={article.title_vi} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {articles.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
        ) : null}
      </div>
    </section>
  );
}

function Flash({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  return (
    <p
      className={
        tone === 'ok'
          ? 'mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
      }
    >
      {text}
    </p>
  );
}
