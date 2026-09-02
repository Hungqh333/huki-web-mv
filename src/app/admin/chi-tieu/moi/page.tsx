import { getTranslations } from 'next-intl/server';
import { KpiAdminNav } from '@/components/admin/KpiAdminNav';
import { KpiProblemTypeForm } from '@/components/admin/KpiProblemTypeForm';

export default async function NewProblemTypePage() {
  const t = await getTranslations('admin.kpi.problemTypes');

  return (
    <section>
      <KpiAdminNav active="problemTypes" />
      <h2 className="mt-6 text-lg font-semibold">{t('newTitle')}</h2>
      <div className="mt-6">
        <KpiProblemTypeForm
          draft={{
            id: null,
            slug: '',
            problem_group: 'presence',
            level: 1,
            name_vi: '',
            name_en: '',
            miss_min: 0,
            miss_max: 0.1,
            false_reject_week1_min: 0,
            false_reject_week1_max: 1,
            false_reject_min: 0,
            false_reject_max: 0.5,
            recheck_min: 0,
            recheck_max: 0.5,
            total_burden_max: 1,
            ramp_up_weeks_min: 1,
            ramp_up_weeks_max: 2,
            deep_learning: 'no',
            special_kpi: '',
            note_vi: '',
            note_en: '',
            data_source: 'estimate',
            calibration_note_vi: '',
            calibration_note_en: '',
            sort_order: 0,
            is_active: true,
          }}
        />
      </div>
    </section>
  );
}
