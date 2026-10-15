import { getLocale, getTranslations } from 'next-intl/server';
import { Panel, PanelHeader } from '@/components/ui/PanelHeader';
import { KpiAdminNav } from '@/components/admin/KpiAdminNav';
import {
  KpiConfigForm,
  KpiTighteningForm,
  type ConfigRow,
  type TighteningRow,
} from '@/components/admin/KpiParametersForm';
import { createClient } from '@/lib/supabase/server';

export default async function AdminKpiParametersPage() {
  const t = await getTranslations('admin.kpi.parameters');
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi';

  const supabase = await createClient();
  const [config, tightening] = await Promise.all([
    supabase.from('kpi_config').select('key, value, name_vi, name_en, note_vi, note_en').order('key'),
    supabase
      .from('kpi_tightening_factors')
      .select('miss_ratio, burden_k, label_vi, label_en')
      .order('sort_order'),
  ]);

  const configRows = ((config.data ?? []) as unknown as Record<string, unknown>[]).map(
    (row) => ({ ...row, value: Number(row.value) }) as ConfigRow
  );

  const tighteningRows = ((tightening.data ?? []) as unknown as Record<string, unknown>[]).map(
    (row) =>
      ({
        ...row,
        miss_ratio: Number(row.miss_ratio),
        burden_k: Number(row.burden_k),
      }) as TighteningRow
  );

  return (
    <section>
      <KpiAdminNav active="parameters" />

      <div className="mt-6">
      <PanelHeader
        standalone
        title={t('title')}
        note={t('subtitle')}
      />
      </div>

      {/*
        Cảnh báo có chủ ý. Sửa mấy con số này ảnh hưởng tới MỌI kết quả tính, kể
        cả những bài toán không liên quan — khác hẳn việc sửa một dòng trong bảng
        loại bài toán.
      */}
      <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {t('globalWarning')}
      </p>

      <Panel id="kpi-config-title" as="h3" title={t('configSection')} className="mt-8">
        <KpiConfigForm rows={configRows} locale={locale} />
      </Panel>

      <Panel id="kpi-tightening-title" as="h3" title={t('tighteningSection')} note={t('tighteningHint')} className="mt-8">
        <KpiTighteningForm rows={tighteningRows} locale={locale} />
      </Panel>
    </section>
  );
}
