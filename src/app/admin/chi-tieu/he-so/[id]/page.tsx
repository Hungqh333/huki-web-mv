import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { KpiAdminNav } from '@/components/admin/KpiAdminNav';
import { KpiModifierForm, type ModifierDraft } from '@/components/admin/KpiModifierForm';
import { createClient } from '@/lib/supabase/server';

export default async function EditModifierPage({
  params,
}: PageProps<'/admin/chi-tieu/he-so/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('admin.kpi.modifiers');

  const supabase = await createClient();
  const { data } = await supabase.from('kpi_modifiers').select('*').eq('id', id).maybeSingle();

  if (!data) notFound();

  const row = data as Record<string, unknown>;
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : '');

  const draft: ModifierDraft = {
    id: String(row.id),
    slug: text('slug'),
    name_vi: text('name_vi'),
    name_en: text('name_en'),
    factor_min: Number(row.factor_min ?? 1),
    factor_max: Number(row.factor_max ?? 1),
    direction: text('direction'),
    note_vi: text('note_vi'),
    note_en: text('note_en'),
    data_source: text('data_source'),
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active !== false,
  };

  return (
    <section>
      <KpiAdminNav active="modifiers" />
      <h2 className="mt-6 text-lg font-semibold">{t('editTitle')}</h2>
      <div className="mt-6">
        <KpiModifierForm draft={draft} />
      </div>
    </section>
  );
}
