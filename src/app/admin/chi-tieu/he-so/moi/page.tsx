import { getTranslations } from 'next-intl/server';
import { KpiAdminNav } from '@/components/admin/KpiAdminNav';
import { KpiModifierForm } from '@/components/admin/KpiModifierForm';

export default async function NewModifierPage() {
  const t = await getTranslations('admin.kpi.modifiers');

  return (
    <section>
      <KpiAdminNav active="modifiers" />
      <h2 className="mt-6 text-lg font-semibold">{t('newTitle')}</h2>
      <div className="mt-6">
        <KpiModifierForm
          draft={{
            id: null,
            slug: '',
            name_vi: '',
            name_en: '',
            factor_min: 1.5,
            factor_max: 2,
            direction: 'worse',
            note_vi: '',
            note_en: '',
            data_source: 'estimate',
            sort_order: 0,
            is_active: true,
          }}
        />
      </div>
    </section>
  );
}
