'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  saveConfigAction,
  saveTighteningAction,
  type KpiAdminState,
} from '@/app/actions/kpi-admin';

export type ConfigRow = {
  key: string;
  value: number;
  name_vi: string;
  name_en: string;
  note_vi: string | null;
  note_en: string | null;
};

export type TighteningRow = {
  miss_ratio: number;
  burden_k: number;
  label_vi: string;
  label_en: string;
};

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function KpiConfigForm({ rows, locale }: { rows: ConfigRow[]; locale: 'vi' | 'en' }) {
  const t = useTranslations('admin.kpi.parameters');
  const [state, formAction, pending] = useActionState<KpiAdminState, FormData>(saveConfigAction, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <input type="hidden" name="config_key" value={row.key} />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`value_${row.key}`}
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  {locale === 'en' ? row.name_en : row.name_vi}
                </label>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{row.key}</p>
              </div>
              <div className="w-32 shrink-0">
                <input
                  id={`value_${row.key}`}
                  name={`value_${row.key}`}
                  type="number"
                  min={0}
                  step="0.0001"
                  defaultValue={row.value}
                  className={inputClass}
                />
              </div>
            </div>
            {(locale === 'en' ? row.note_en : row.note_vi) ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {locale === 'en' ? row.note_en : row.note_vi}
              </p>
            ) : null}
            {state.fieldErrors?.[`value_${row.key}`] ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors[`value_${row.key}`]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? t('saving') : t('saveConfig')}
      </button>
    </form>
  );
}

export function KpiTighteningForm({
  rows,
  locale,
}: {
  rows: TighteningRow[];
  locale: 'vi' | 'en';
}) {
  const t = useTranslations('admin.kpi.parameters');
  const [state, formAction, pending] = useActionState<KpiAdminState, FormData>(
    saveTighteningAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colScenario')}</th>
              <th scope="col" className="py-2 font-medium">{t('colBurdenK')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.miss_ratio}>
                <td className="py-3 pr-3">
                  <input type="hidden" name="ratio" value={row.miss_ratio} />
                  {locale === 'en' ? row.label_en : row.label_vi}
                </td>
                <td className="py-3">
                  <div className="w-28">
                    <input
                      name={`k_${row.miss_ratio}`}
                      type="number"
                      min={1}
                      step="0.1"
                      defaultValue={row.burden_k}
                      className={inputClass}
                    />
                  </div>
                  {state.fieldErrors?.[`k_${row.miss_ratio}`] ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {state.fieldErrors[`k_${row.miss_ratio}`]}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? t('saving') : t('saveTightening')}
      </button>
    </form>
  );
}
