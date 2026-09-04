import { getTranslations } from 'next-intl/server';
import { RuleForm } from '@/components/admin/RuleForm';
import { DERIVED_FIELD_KEYS } from '@/lib/selector/derivedKeys';
import { FIELD_CATALOG } from '@/lib/selector/fields';
import { createClient } from '@/lib/supabase/server';

export default async function NewRulePage() {
  const t = await getTranslations('admin.rules');

  const supabase = await createClient();
  const { data: taskTypes } = await supabase
    .from('task_types')
    .select('id, name_vi')
    .order('sort_order');

  const knownFields = [...Object.keys(FIELD_CATALOG), ...DERIVED_FIELD_KEYS];

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('newTitle')}</h2>
      <div className="mt-6">
        <RuleForm
          taskTypes={taskTypes ?? []}
          knownFields={knownFields}
          draft={{
            id: null,
            code: '',
            task_type_id: taskTypes?.[0]?.id ?? '',
            condition_json: '{\n  "all": []\n}',
            recommended_camera: '',
            recommended_lighting: '',
            recommended_lens: '',
            recommended_processing: '',
            recommended_accessories: '',
            ai_or_rule_based: 'rule_based',
            notes_vi: '',
            notes_en: '',
            priority: 100,
            is_active: true,
          }}
        />
      </div>
    </section>
  );
}
