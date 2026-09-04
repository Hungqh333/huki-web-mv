import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { TierBadge } from '@/components/handbook/TierBadge';
import { getSessionContext } from '@/lib/auth';
import { toTeaser, type ArticlePreview, type Category } from '@/lib/articles';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export default async function HandbookPage({ searchParams }: PageProps<'/cam-nang'>) {
  const t = await getTranslations('handbook');
  const locale = await getLocale();
  const format = await getFormatter();
  const { category: categoryFilter } = await searchParams;

  if (!hasSupabaseEnv()) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">{t('notConfigured')}</p>
      </section>
    );
  }

  const supabase = await createClient();
  const session = await getSessionContext();

  // article_previews chỉ trả tiêu đề + teaser đã cắt, không bao giờ trả toàn văn.
  // Nhờ vậy bài bị khoá vẫn hiện được để làm marketing (CLAUDE.md mục 5) mà
  // không phải nới RLS của bảng articles.
  const [{ data: previewData, error: previewError }, { data: categoryData }] = await Promise.all([
    supabase.from('article_previews').select('*').order('published_at', { ascending: false }),
    supabase.from('categories').select('id, slug, name_vi, name_en').order('sort_order'),
  ]);

  // Ném lỗi để error boundary bắt. Nuốt lỗi ở đây sẽ hiện "chưa có bài viết
  // nào" — người dùng tưởng cẩm nang trống trong khi thực ra là hỏng kết nối.
  if (previewError) throw new Error(`Không tải được danh sách bài viết: ${previewError.message}`);

  const categories = (categoryData ?? []) as Category[];
  const allPreviews = (previewData ?? []) as ArticlePreview[];

  const activeCategory =
    typeof categoryFilter === 'string'
      ? categories.find((c) => c.slug === categoryFilter)
      : undefined;

  const previews = activeCategory
    ? allPreviews.filter((a) => a.category_id === activeCategory.id)
    : allPreviews;

  const categoryName = (c: Category) => (locale === 'en' ? c.name_en : c.name_vi);
  const title = (a: ArticlePreview) => (locale === 'en' ? a.title_en : a.title_vi);
  const teaser = (a: ArticlePreview) => toTeaser(locale === 'en' ? a.teaser_en : a.teaser_vi);
  const categoryOf = (a: ArticlePreview) => categories.find((c) => c.id === a.category_id);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <nav aria-label={t('filterLabel')} className="mt-8 flex flex-wrap gap-2">
        <FilterChip href="/cam-nang" active={!activeCategory} label={t('allCategories')} />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            href={`/cam-nang?category=${category.slug}`}
            active={activeCategory?.id === category.id}
            label={categoryName(category)}
          />
        ))}
      </nav>

      {previews.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t('empty')}
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {previews.map((article) => {
            const category = categoryOf(article);
            return (
              <li
                key={article.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <TierBadge tier={article.access_tier} locked={article.is_locked} />
                  {category ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {categoryName(category)}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-slate-400">
                    {format.dateTime(new Date(article.published_at), { dateStyle: 'medium' })}
                  </span>
                </div>

                <h2 className="mt-3 text-lg font-semibold">
                  <Link href={`/cam-nang/${article.slug}`} className="hover:text-sky-700 dark:hover:text-sky-400">
                    {title(article)}
                  </Link>
                </h2>

                <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">
                  {teaser(article)}
                </p>

                <div className="mt-4">
                  {article.is_locked ? (
                    <Link
                      href={session ? '/cam-nang/' + article.slug : '/dang-nhap'}
                      className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
                    >
                      {session ? t('lockedCtaSignedIn') : t('lockedCtaGuest')} →
                    </Link>
                  ) : (
                    <Link
                      href={`/cam-nang/${article.slug}`}
                      className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
                    >
                      {t('readMore')} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-sky-600 px-3 py-1.5 text-sm font-medium text-white'
          : 'rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-sky-500 dark:border-slate-700 dark:text-slate-300'
      }
    >
      {label}
    </Link>
  );
}
