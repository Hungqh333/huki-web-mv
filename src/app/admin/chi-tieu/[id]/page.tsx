import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { KpiAdminNav } from '@/components/admin/KpiAdminNav';
import {
  KpiProblemTypeForm,
  type ProblemTypeDraft,
} from '@/components/admin/KpiProblemTypeForm';
import { createClient } from '@/lib/supabase/server';

export default async function EditProblemTypePage({ params }: PageProps<'/admin/chi-tieu/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('admin.kpi.problemTypes');

  const supabase = await createClient();
  const { data } = await supabase.from('kpi_problem_types').select('*').eq('id', id).maybeSingle();

  if (!data) notFound();

  const row = data as Record<string, unknown>;
  const num = (key: string) => Number(row[key] ?? 0);
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : '');

  const draft: ProblemTypeDraft = {
    id: String(row.id),
    slug: text('slug'),
    problem_group: text('problem_group'),
    level: num('level'),
    name_vi: text('name_vi'),
    name_en: text('name_en'),
    miss_min: num('miss_min'),
    miss_max: num('miss_max'),
    false_reject_week1_min: num('false_reject_week1_min'),
    false_reject_week1_max: num('false_reject_week1_max'),
    false_reject_min: num('false_reject_min'),
    false_reject_max: num('false_reject_max'),
    recheck_min: num('recheck_min'),
    recheck_max: num('recheck_max'),
    total_burden_max: num('total_burden_max'),
    ramp_up_weeks_min: num('ramp_up_weeks_min'),
    ramp_up_weeks_max: num('ramp_up_weeks_max'),
    deep_learning: text('deep_learning'),
    special_kpi: text('special_kpi'),
    note_vi: text('note_vi'),
    note_en: text('note_en'),
    data_source: text('data_source'),
    calibration_note_vi: text('calibration_note_vi'),
    calibration_note_en: text('calibration_note_en'),
    sort_order: num('sort_order'),
    is_active: row.is_active !== false,
  };

  return (
    <section>
      <KpiAdminNav active="problemTypes" />
      <h2 className="mt-6 text-lg font-semibold">{t('editTitle')}</h2>
      <div className="mt-6">
        <KpiProblemTypeForm draft={draft} />
      </div>
    </section>
  );
}
