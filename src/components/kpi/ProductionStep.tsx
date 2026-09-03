'use client';

import { useTranslations } from 'next-intl';
import type { ProductionInputs } from './KpiCalculator';

const FIELDS: { key: keyof ProductionInputs; unit?: string; step?: string }[] = [
  { key: 'unitsPerHour', unit: 'sp/h' },
  { key: 'shifts' },
  { key: 'secondsPerCheck', unit: 's' },
  { key: 'availableHeadcount' },
  { key: 'annualVolume', unit: 'sp' },
  { key: 'unitValue', unit: 'VND' },
  { key: 'p0', unit: '%', step: '0.1' },
  { key: 'ngSamples' },
];

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function ProductionStep({
  values,
  onChange,
  specUnclear,
  onSpecUnclearChange,
}: {
  values: ProductionInputs;
  onChange: (values: ProductionInputs) => void;
  specUnclear: boolean;
  onSpecUnclearChange: (value: boolean) => void;
}) {
  const t = useTranslations('kpi.step4');

  return (
    <section>
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-sky-600">4.</span>
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label
              htmlFor={field.key}
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {t(`fields.${field.key}`)}
              {field.unit ? <span className="ml-1 text-slate-500 dark:text-slate-400">({field.unit})</span> : null}
            </label>
            <input
              id={field.key}
              type="number"
              inputMode="decimal"
              min={0}
              step={field.step ?? '1'}
              value={values[field.key]}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              className={inputClass}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">{t(`hints.${field.key}`)}</p>
          </div>
        ))}
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
        <input
          type="checkbox"
          checked={specUnclear}
          onChange={(event) => onSpecUnclearChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
        />
        <span>
          <span className="block font-medium">{t('specUnclear.label')}</span>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
            {t('specUnclear.description')}
          </span>
        </span>
      </label>
    </section>
  );
}
