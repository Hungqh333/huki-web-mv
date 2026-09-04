import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RuleForm } from '@/components/admin/RuleForm';
import { DERIVED_FIELD_KEYS } from '@/lib/selector/derivedKeys';
import { FIELD_CATALOG } from '@/lib/selector/fields';
import type { SolutionApproach } from '@/lib/selector/types';
import { createClient } from '@/lib/supabase/server';

type Row = {
  id: string;
  code: string | null;
  task_type_id: string;
  condition_json: unknown;
  recommended_camera: string | null;
  recommended_processing: string | null;
  recommended_accessories: string | null;
  recommended_lighting: string | null;
  recommended_lens: string | null;
  ai_or_rule_based: SolutionApproach;
  notes_vi: string | null;
  notes_en: string | null;
  priority: number;
  is_active: boolean;
};

export default async function EditRulePage({ params }: PageProps<'/admin/luat-goi-y/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('admin.rules');

  const supabase = await createClient();
  const [{ data: rule }, { data: taskTypes }] = await Promise.all([
    supabase
      .from('selector_rules')
      .select(
        'id, code, task_type_id, condition_json, recommended_camera, recommended_lighting, recommended_lens, recommended_processing, recommended_accessories, ai_or_rule_based, notes_vi, notes_en, priority, is_active'
      )
      .eq('id', id)
      .maybeSingle<Row>(),
    supabase.from('task_types').select('id, name_vi').order('sort_order'),
  ]);

  if (!rule) notFound();

  const knownFields = [...Object.keys(FIELD_CATALOG), ...DERIVED_FIELD_KEYS];

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('editTitle')}</h2>
      <div className="mt-6">
        <RuleForm
          taskTypes={taskTypes ?? []}
          knownFields={knownFields}
          draft={{
            id: rule.id,
            code: rule.code ?? '',
            task_type_id: rule.task_type_id,
            condition_json: JSON.stringify(rule.condition_json ?? {}, null, 2),
            recommended_camera: rule.recommended_camera ?? '',
            recommended_processing: rule.recommended_processing ?? '',
            recommended_accessories: rule.recommended_accessories ?? '',
            recommended_lighting: rule.recommended_lighting ?? '',
            recommended_lens: rule.recommended_lens ?? '',
            ai_or_rule_based: rule.ai_or_rule_based,
            notes_vi: rule.notes_vi ?? '',
            notes_en: rule.notes_en ?? '',
            priority: rule.priority,
            is_active: rule.is_active,
          }}
        />
      </div>
    </section>
  );
}
