import { getTranslations } from 'next-intl/server';
import { ArticleForm, type ArticleDraft } from '@/components/admin/ArticleForm';
import { RULE_ID_PATTERN } from '@/lib/knowledge';
import { createClient } from '@/lib/supabase/server';
import { RULES, knowledgeSlugFor } from '@/lib/vision/rules';

/**
 * `?rule=MEC-001` (nút [Viết bài] cạnh một luật chưa có tài liệu — V1c C8) điền
 * sẵn slug rule-mec-001, loại Ghi chú luật, nhóm khả thi, mã luật, danh mục
 * "Ghi chú luật" và mức Member (chốt Q2).
 */
export default async function NewArticlePage({ searchParams }: PageProps<'/admin/bai-viet/moi'>) {
  const t = await getTranslations('admin.articles');
  const { rule } = await searchParams;
  const ruleParam = typeof rule === 'string' ? rule.toUpperCase() : '';
  const ruleDef = RULE_ID_PATTERN.test(ruleParam) ? RULES.find((item) => item.id === ruleParam) : undefined;

  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('id, name_vi, slug').order('sort_order');
  const categories = data ?? [];

  const draft: ArticleDraft = {
    id: null,
    slug: ruleDef ? knowledgeSlugFor(ruleDef.id) : '',
    title_vi: ruleDef ? `${ruleDef.id} — ` : '',
    title_en: ruleDef ? `${ruleDef.id} — ` : '',
    content_vi: '',
    content_en: '',
    category_id: ruleDef ? (categories.find((c) => c.slug === 'rule-notes')?.id ?? null) : null,
    access_tier: ruleDef ? 'member' : 'public',
    cover_image: null,
    published: false,
    media_type: ruleDef ? 'ruleNote' : '',
    dimension: ruleDef?.dimension ?? '',
    related_rules: ruleDef ? [ruleDef.id] : [],
    source_references: [],
    reviewed_by: null,
    reviewed_at: null,
  };

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('newTitle')}</h2>
      <div className="mt-6">
        <ArticleForm categories={categories} draft={draft} />
      </div>
    </section>
  );
}
