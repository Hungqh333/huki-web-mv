import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { TierBadge } from '@/components/handbook/TierBadge';
import { getSessionContext } from '@/lib/auth';
import { sanitizeHtml, toTeaser, type ArticleFull, type ArticlePreview } from '@/lib/articles';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { contactMailto } from '@/lib/contact';

export default async function ArticlePage({ params }: PageProps<'/cam-nang/[slug]'>) {
  const { slug } = await params;
  const t = await getTranslations('handbook');
  const tk = await getTranslations('knowledge.article');
  const locale = await getLocale();
  const format = await getFormatter();

  if (!hasSupabaseEnv()) notFound();

  const supabase = await createClient();
  const session = await getSessionContext();

  // Toàn văn đọc từ bảng articles — RLS quyết định có trả về hay không.
  // Không đủ quyền thì truy vấn này trả rỗng, kể cả khi gọi thẳng REST API.
  const { data: article } = await supabase
    .from('articles')
    .select(
      'id, slug, title_vi, title_en, content_vi, content_en, category_id, access_tier, cover_image, published_at, media_type, related_rules, source_references, reviewed_by, reviewed_at'
    )
    .eq('slug', slug)
    .maybeSingle<ArticleFull>();

  if (article) {
    const title = locale === 'en' ? article.title_en : article.title_vi;
    const content = (locale === 'en' ? article.content_en : article.content_vi) ?? '';

    return (
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/cam-nang"
          className="text-sm text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-400"
        >
          ← {t('backToList')}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TierBadge tier={article.access_tier} />
          <span className="text-xs text-slate-400">
            {format.dateTime(new Date(article.published_at), { dateStyle: 'long' })}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>

        {content ? (
          <div
            className="mt-8 space-y-4 text-slate-700 [&_a]:text-sky-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_em]:italic [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h4]:mt-4 [&_h4]:font-semibold [&_h4]:text-slate-900 [&_li]:ml-5 [&_ol]:list-decimal [&_ol_li]:list-decimal [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:text-sm [&_strong]:font-semibold [&_ul_li]:list-disc dark:text-slate-300 dark:[&_a]:text-sky-400 dark:[&_blockquote]:border-slate-700 dark:[&_code]:bg-slate-800 dark:[&_h2]:text-slate-100 dark:[&_h3]:text-slate-100 dark:[&_h4]:text-slate-100 dark:[&_pre]:bg-slate-800"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
          />
        ) : (
          <p className="mt-8 text-slate-500 dark:text-slate-400">{t('noContentInLocale')}</p>
        )}

        {/* Tri thức gắn luật (V1c C8, spec §12.4–12.5): luật liên quan, ai duyệt, nguồn. */}
        {article.related_rules?.length || article.reviewed_by || article.source_references?.length ? (
          <aside className="mt-10 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
            {article.related_rules?.length ? (
              <p>
                <span className="font-semibold">{tk('relatedRules')}: </span>
                <span className="font-mono">{article.related_rules.join(', ')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{tk('relatedRulesNote')}</span>
              </p>
            ) : null}
            {article.reviewed_by && article.reviewed_at ? (
              <p>
                <span className="font-semibold">{tk('reviewed')}: </span>
                {tk('reviewedBy', {
                  name: article.reviewed_by,
                  date: format.dateTime(new Date(article.reviewed_at), { dateStyle: 'long' }),
                })}
              </p>
            ) : null}
            {article.source_references?.length ? (
              <div>
                <p className="font-semibold">{tk('sources')}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600 dark:text-slate-400">
                  {article.source_references.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        ) : null}
      </article>
    );
  }

  // Không đọc được toàn văn: có thể do bài bị khoá, cũng có thể do không tồn tại.
  // Hỏi view teaser để phân biệt hai trường hợp — bài bị khoá vẫn hiện tiêu đề
  // và đoạn mở đầu, phục vụ mục tiêu marketing thay vì trả 404 cụt lủn.
  const { data: preview } = await supabase
    .from('article_previews')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<ArticlePreview>();

  if (!preview) notFound();

  const title = locale === 'en' ? preview.title_en : preview.title_vi;
  const teaser = toTeaser(locale === 'en' ? preview.teaser_en : preview.teaser_vi);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/cam-nang"
        className="text-sm text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-400"
      >
        ← {t('backToList')}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TierBadge tier={preview.access_tier} locked />
        <span className="text-xs text-slate-400">
          {format.dateTime(new Date(preview.published_at), { dateStyle: 'long' })}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>

      <p className="mt-8 leading-relaxed text-slate-700 dark:text-slate-300">{teaser}</p>

      <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
        <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{t('lockedTitle')}</h2>
        <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">
          {session
            ? t('lockedBodySignedIn', { tier: t(`tiers.${preview.access_tier}`) })
            : t('lockedBodyGuest')}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {session ? null : (
            <Link
              href="/dang-nhap"
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              {t('signInCta')}
            </Link>
          )}
          <a
            href={contactMailto('Machine Vision Hub - Yeu cau xem noi dung')}
            className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
          >
            {t('contactCta')}
          </a>
        </div>
      </div>
    </article>
  );
}
