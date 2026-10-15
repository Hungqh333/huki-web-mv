import { getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { ComponentForm } from '@/components/admin/ComponentForm';

export default async function NewComponentPage() {
  const t = await getTranslations('admin.components');

  return (
    <section>
      <PanelHeader
        standalone
        title={t('newTitle')}
      />
      <div className="mt-6">
        <ComponentForm
          draft={{
            id: null,
            code: '',
            kind: 'camera',
            brand: '',
            model: '',
            spec: {},
            price_vnd: '',
            lead_time_days: '',
            supplier: '',
            used_in_projects: '0',
            datasheet_url: '',
            source: 'unverified',
            notes_vi: '',
            notes_en: '',
            sort_order: 0,
            is_active: true,
          }}
        />
      </div>
    </section>
  );
}
