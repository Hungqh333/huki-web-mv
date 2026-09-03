'use client';

import { useTranslations } from 'next-intl';
import { digitsOnly } from '@/lib/kpi/input';
import type { ProductionInputs } from './KpiCalculator';

/**
 * `grouped` = ô nhập số lớn, cho phép gõ dấu phân cách nghìn.
 *
 * Lý do phải có: người Việt gõ giá trị sản phẩm là "50.000". Với <input
 * type="number"> thì trình duyệt hiểu dấu chấm là dấu thập phân, Number("50.000")
 * ra 50 — sai đúng một nghìn lần, và chi phí phế hàng năm hiện ra bé xíu mà
 * không có gì báo là đã hiểu nhầm. Hai ô này là số nguyên (đồng, sản phẩm) nên
 * bỏ hết ký tự không phải chữ số là an toàn, rồi hiện lại số đã nhóm ngay dưới ô
 * để người nhập tự đối chiếu.
 */
const FIELDS: {
  key: keyof ProductionInputs;
  unit?: string;
  step?: string;
  min?: number;
  grouped?: boolean;
}[] = [
  { key: 'unitsPerHour', unit: 'sp/h' },
  { key: 'shifts', min: 1 },
  { key: 'secondsPerCheck', unit: 's' },
  { key: 'availableHeadcount' },
  { key: 'annualVolume', unit: 'sp', grouped: true },
  { key: 'unitValue', unit: 'VND', grouped: true },
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
  locale,
}: {
  values: ProductionInputs;
  onChange: (values: ProductionInputs) => void;
  specUnclear: boolean;
  onSpecUnclearChange: (value: boolean) => void;
  locale: 'vi' | 'en';
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
        {FIELDS.map((field) => {
          const raw = values[field.key];
          const grouped = field.grouped && raw !== '';

          return (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={field.key}
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                {t(`fields.${field.key}`)}
                {field.unit ? (
                  <span className="ml-1 text-slate-500 dark:text-slate-400">({field.unit})</span>
                ) : null}
              </label>

              {field.grouped ? (
                <input
                  id={field.key}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={raw}
                  onChange={(event) =>
                    onChange({ ...values, [field.key]: digitsOnly(event.target.value) })
                  }
                  className={inputClass}
                />
              ) : (
                <input
                  id={field.key}
                  type="number"
                  inputMode="decimal"
                  min={field.min ?? 0}
                  step={field.step ?? '1'}
                  value={raw}
                  onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
                  className={inputClass}
                />
              )}

              {grouped ? (
                <p className="text-xs font-medium text-slate-700 tabular-nums dark:text-slate-300">
                  = {Number(raw).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                  {field.unit ? ` ${field.unit}` : ''}
                </p>
              ) : null}

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(`hints.${field.key}`)}
              </p>
            </div>
          );
        })}
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
