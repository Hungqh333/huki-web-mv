import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { deleteProblemTypeAction } from '@/app/actions/kpi-admin';
import { DataSourceBadge, KpiAdminNav } from '@/components/admin/KpiAdminNav';
import { createClient } from '@/lib/supabase/server';

type Row = {
  id: string;
  slug: string;
  problem_group: string;
  level: number;
  name_vi: string;
  miss_max: number;
  false_reject_max: number;
  recheck_max: number;
  total_burden_max: number;
  data_source: string;
  is_active: boolean;
};

export default async function AdminKpiProblemTypesPage({
  searchParams,
}: PageProps<'/admin/chi-tieu'>) {
  const t = await getTranslations('admin.kpi.problemTypes');
  const tGroup = await getTranslations('kpi.groups');
  const { saved, deleted } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kpi_problem_types')
    .select(
      'id, slug, problem_group, level, name_vi, miss_max, false_reject_max, recheck_max, total_burden_max, data_source, is_active'
    )
    .order('sort_order');

  const rows = (data ?? []) as unknown as Row[];
  const estimateCount = rows.filter((r) => r.data_source === 'estimate').length;

  return (
    <section>
      <KpiAdminNav active="problemTypes" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/chi-tieu/moi"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('new')}
        </Link>
      </div>

      {estimateCount > 0 ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('estimateCount', { count: estimateCount, total: rows.length })}
        </p>
      ) : null}

      {saved ? <Flash text={t('saved')} /> : null}
      {deleted ? <Flash text={t('deleted')} /> : null}
      {error ? <Flash text={error.message} tone="error" /> : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colName')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colGroup')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colLevel')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colMiss')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colBurden')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colSource')}</th>
              <th scope="col" className="py-2 font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className={row.is_active ? '' : 'opacity-50'}>
                <td className="py-3 pr-3">
                  <Link
                    href={`/admin/chi-tieu/${row.id}`}
                    className="font-medium hover:text-sky-700 dark:hover:text-sky-400"
                  >
                    {row.name_vi}
                  </Link>
                  <span className="block font-mono text-xs text-slate-400">{row.slug}</span>
                </td>
                <td className="py-3 pr-3 text-xs text-slate-600 dark:text-slate-400">
                  {tGroup(row.problem_group)}
                </td>
                <td className="py-3 pr-3 tabular-nums">{row.level}</td>
                <td className="py-3 pr-3 tabular-nums">≤ {row.miss_max}%</td>
                <td className="py-3 pr-3 tabular-nums">≤ {row.total_burden_max}%</td>
                <td className="py-3 pr-3">
                  <DataSourceBadge source={row.data_source} />
                </td>
                <td className="py-3">
                  <form action={deleteProblemTypeAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      {t('delete')}
                    </button>
                  </form>
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
