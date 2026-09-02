import { getLocale, getTranslations } from 'next-intl/server';
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

      <h2 className="mt-6 text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      {/*
        Cảnh báo có chủ ý. Sửa mấy con số này ảnh hưởng tới MỌI kết quả tính, kể
        cả những bài toán không liên quan — khác hẳn việc sửa một dòng trong bảng
        loại bài toán.
      */}
      <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {t('globalWarning')}
      </p>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">{t('configSection')}</h3>
        <div className="mt-4">
          <KpiConfigForm rows={configRows} locale={locale} />
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-sm font-semibold">{t('tighteningSection')}</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          {t('tighteningHint')}
        </p>
        <div className="mt-4">
          <KpiTighteningForm rows={tighteningRows} locale={locale} />
        </div>
      </div>
    </section>
  );
}
