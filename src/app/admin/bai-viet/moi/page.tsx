import { getTranslations } from 'next-intl/server';
import { ArticleForm } from '@/components/admin/ArticleForm';
import { createClient } from '@/lib/supabase/server';

export default async function NewArticlePage() {
  const t = await getTranslations('admin.articles');

  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('id, name_vi').order('sort_order');

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('newTitle')}</h2>
      <div className="mt-6">
        <ArticleForm
          categories={data ?? []}
          draft={{
            id: null,
            slug: '',
            title_vi: '',
            title_en: '',
            content_vi: '',
            content_en: '',
            category_id: null,
            access_tier: 'public',
            cover_image: null,
            published: false,
          }}
        />
      </div>
    </section>
  );
}
