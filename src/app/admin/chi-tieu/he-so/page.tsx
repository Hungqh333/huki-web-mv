import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { deleteModifierAction } from '@/app/actions/kpi-admin';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { DataSourceBadge, KpiAdminNav } from '@/components/admin/KpiAdminNav';
import { createClient } from '@/lib/supabase/server';

type Row = {
  id: string;
  slug: string;
  name_vi: string;
  factor_min: number;
  factor_max: number;
  direction: string;
  data_source: string;
  is_active: boolean;
};

export default async function AdminKpiModifiersPage({
  searchParams,
}: PageProps<'/admin/chi-tieu/he-so'>) {
  const t = await getTranslations('admin.kpi.modifiers');
  const { saved, deleted } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kpi_modifiers')
    .select('id, slug, name_vi, factor_min, factor_max, direction, data_source, is_active')
    .order('sort_order');

  const rows = (data ?? []) as unknown as Row[];

  return (
    <section>
      <KpiAdminNav active="modifiers" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/chi-tieu/he-so/moi"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('new')}
        </Link>
      </div>

      {saved ? <Flash text={t('saved')} /> : null}
      {deleted ? <Flash text={t('deleted')} /> : null}
      {error ? <Flash text={error.message} tone="error" /> : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colName')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colFactor')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colDirection')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colSource')}</th>
              <th scope="col" className="py-2 font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className={row.is_active ? '' : 'opacity-50'}>
                <td className="py-3 pr-3">
                  <Link
                    href={`/admin/chi-tieu/he-so/${row.id}`}
                    className="font-medium hover:text-sky-700 dark:hover:text-sky-400"
                  >
                    {row.name_vi}
                  </Link>
                  <span className="block font-mono text-xs text-slate-400">{row.slug}</span>
                </td>
                <td className="py-3 pr-3 tabular-nums">
                  ×{row.factor_min === row.factor_max
                    ? row.factor_min
                    : `${row.factor_min}–${row.factor_max}`}
                </td>
                <td className="py-3 pr-3 text-xs">
                  {row.direction === 'worse' ? t('worse') : t('better')}
                </td>
                <td className="py-3 pr-3">
                  <DataSourceBadge source={row.data_source} />
                </td>
                <td className="py-3">
                  <DeleteButton action={deleteModifierAction} id={row.id} itemName={row.name_vi} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
        ) : null}
      </div>
    </section>
  );
}

function Flash({ text, tone = 'ok' }: { text: string; tone?: 'ok' | 'error' }) {
  return (
    <p
      className={
        tone === 'ok'
          ? 'mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
      }
    >
      {text}
    </p>
  );
}
