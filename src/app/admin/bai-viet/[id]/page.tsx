import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArticleForm } from '@/components/admin/ArticleForm';
import type { AccessTier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Row = {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  content_vi: string | null;
  content_en: string | null;
  category_id: string | null;
  access_tier: AccessTier;
  cover_image: string | null;
  published_at: string | null;
};

export default async function EditArticlePage({ params }: PageProps<'/admin/bai-viet/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('admin.articles');

  const supabase = await createClient();
  const [{ data: article }, { data: categories }] = await Promise.all([
    supabase
      .from('articles')
      .select(
        'id, slug, title_vi, title_en, content_vi, content_en, category_id, access_tier, cover_image, published_at'
      )
      .eq('id', id)
      .maybeSingle<Row>(),
    supabase.from('categories').select('id, name_vi').order('sort_order'),
  ]);

  if (!article) notFound();

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('editTitle')}</h2>
      <div className="mt-6">
        <ArticleForm
          categories={categories ?? []}
          draft={{
            id: article.id,
            slug: article.slug,
            title_vi: article.title_vi,
            title_en: article.title_en,
            content_vi: article.content_vi ?? '',
            content_en: article.content_en ?? '',
            category_id: article.category_id,
            access_tier: article.access_tier,
            cover_image: article.cover_image,
            published: article.published_at !== null,
          }}
        />
      </div>
    </section>
  );
}
