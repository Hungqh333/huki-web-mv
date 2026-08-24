'use client';

import { useTranslations } from 'next-intl';
import type { FieldDef } from '@/lib/selector/fields';
import type { InputValue } from '@/lib/selector/types';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

type Props = {
  def: FieldDef;
  error?: 'required' | 'invalid';
  defaultValue?: InputValue;
};

export function SelectorField({ def, error, defaultValue }: Props) {
  const t = useTranslations('selector.fields');
  const tOption = useTranslations('selector.options');
  const tError = useTranslations('selector.fieldErrors');

  const label = t(def.labelKey);
  const describedBy = error ? `${def.key}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={def.key} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        {def.unit ? <span className="ml-1 text-slate-400">({def.unit})</span> : null}
        {def.required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>

      {def.kind === 'number' ? (
        <input
          id={def.key}
          name={def.key}
          type="number"
          inputMode="decimal"
          min={def.min}
          max={def.max}
          step={def.step}
          required={def.required}
          aria-describedby={describedBy}
          defaultValue={typeof defaultValue === 'number' ? defaultValue : ''}
          className={inputClass}
        />
      ) : null}

      {def.kind === 'select' ? (
        <select
          id={def.key}
          name={def.key}
          required={def.required}
          aria-describedby={describedBy}
          defaultValue={typeof defaultValue === 'string' ? defaultValue : ''}
          className={inputClass}
        >
          <option value="">—</option>
          {def.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {tOption(option.labelKey)}
            </option>
          ))}
        </select>
      ) : null}

      {def.kind === 'multiselect' ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {def.options?.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={def.key}
                value={option.value}
                defaultChecked={Array.isArray(defaultValue) && defaultValue.includes(option.value)}
                className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
              />
              {tOption(option.labelKey)}
            </label>
          ))}
        </div>
      ) : null}

      {def.kind === 'boolean' ? (
        <label className="flex items-center gap-2 pt-1 text-sm">
          <input
            id={def.key}
            type="checkbox"
            name={def.key}
            defaultChecked={defaultValue === true}
            className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
          />
          {t(`${def.labelKey}Hint`)}
        </label>
      ) : null}

      {error ? (
        <p id={describedBy} className="text-xs text-red-600 dark:text-red-400">
          {tError(error)}
        </p>
      ) : null}
    </div>
  );
}
