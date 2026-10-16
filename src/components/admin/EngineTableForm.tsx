'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { saveDefaultsTableAction, saveLightingTableAction, type EngineTableState } from '@/app/actions/admin';
import { FIELD_DEFAULTS } from '@/lib/requirement/defaults';
import { DEFAULT_LIGHTING_ROWS } from '@/lib/vision/lighting';
import {
  DEFAULT_ENGINE_TABLES,
  DEFAULT_ROW_DEFS,
  LIGHT_TYPES,
  LIGHTING_ROW_KEYS,
  TABLE_TEXT_MAX,
  type EngineTables,
} from '@/lib/vision/engineTables';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';

/**
 * Form bảng chiếu sáng / giả định mặc định (chốt 2026-10-16, đợt 2). Mỗi dòng là
 * một khung; ô câu chữ để trống = dùng câu mặc định (hiện làm chữ mờ trong ô).
 * Ô form tên `${dòng}__${trường}` — saveEngineTable đọc đúng tên này.
 */
export function EngineTableForm({
  table,
  current,
  stored,
  rejected,
  defaultReasons = {},
}: {
  /** Câu lý do chiếu sáng mặc định theo dòng, đủ vi/en (trang server lấy từ messages của cả hai ngôn ngữ). */
  defaultReasons?: Partial<Record<string, { vi: string; en: string }>>;
  table: 'lighting' | 'defaults';
  current: EngineTables;
  stored: Record<string, { updatedBy: string | null; updatedAt: string }>;
  /** Dòng đang lưu bị bỏ vì không hợp lệ. */
  rejected: string[];
}) {
  const t = useTranslations('admin.tables');
  const tReason = useTranslations('selector.vision.lightingReason');
  const tOptions = useTranslations('designer.requirement.options');
  const [state, formAction, pending] = useActionState<EngineTableState, FormData>(
    table === 'lighting' ? saveLightingTableAction : saveDefaultsTableAction,
    {}
  );

  const meta = (row: string) => {
    const info = stored[`${table}.${row}`];
    return info?.updatedBy ? t('updatedBy', { name: info.updatedBy }) : null;
  };
  const rowError = (row: string) => state.fieldErrors?.[row];

  const rowFrame = (row: string, title: string, changed: boolean, body: React.ReactNode) => (
    <fieldset key={row} className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <legend className="sr-only">{title}</legend>
      <PanelHeader
        as="h3"
        title={
          <>
            {title}
            {changed ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                {t('changed')}
              </span>
            ) : null}
          </>
        }
        meta={meta(row)}
        note={
          rejected.includes(row) ? <span className="text-amber-700 dark:text-amber-400">{t('rowRejected')}</span> : undefined
        }
      />
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {body}
        {rowError(row) ? <p className="text-xs text-red-600 dark:text-red-400">{rowError(row)}</p> : null}
      </div>
    </fieldset>
  );

  const textPair = (row: string, fields: [string, string], values: [string | null, string | null], defaults: [string, string]) => (
    <div className="grid gap-3 md:grid-cols-2">
      {(['vi', 'en'] as const).map((lang, i) => (
        <label key={lang} className="block">
          <span className={labelClass}>{t(`text.${lang}`)}</span>
          <textarea
            name={`${row}__${fields[i]}`}
            defaultValue={values[i] ?? ''}
            placeholder={defaults[i]}
            maxLength={TABLE_TEXT_MAX}
            rows={3}
            className={inputClass}
          />
        </label>
      ))}
    </div>
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      {table === 'lighting'
        ? LIGHTING_ROW_KEYS.map((row) => {
            const value = current.lighting[row];
            const base = DEFAULT_ENGINE_TABLES.lighting[row];
            const changed = JSON.stringify(value) !== JSON.stringify(base);
            const fallback = tReason(DEFAULT_LIGHTING_ROWS[row].reasonKey as never);
            const defaultReason = defaultReasons[row] ?? { vi: fallback, en: fallback };
            return rowFrame(
              row,
              t(`lighting.rows.${row}`),
              changed,
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{t('lighting.lightType')}</span>
                    <select name={`${row}__lightType`} defaultValue={value.lightType} className={inputClass}>
                      {LIGHT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`lightTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>{t('lighting.alternativeType')}</span>
                    <select name={`${row}__alternativeType`} defaultValue={value.alternativeType ?? ''} className={inputClass}>
                      <option value="">{t('lighting.none')}</option>
                      {LIGHT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`lightTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('defaultIs', {
                    value: base.alternativeType
                      ? `${t(`lightTypes.${base.lightType}`)} / ${t(`lightTypes.${base.alternativeType}`)}`
                      : t(`lightTypes.${base.lightType}`),
                  })}
                </p>
                {textPair(row, ['reasonVi', 'reasonEn'], [value.reasonVi, value.reasonEn], [defaultReason.vi, defaultReason.en])}
              </>
            );
          })
        : DEFAULT_ROW_DEFS.map((def) => {
            const value = current.defaults[def.key];
            const base = DEFAULT_ENGINE_TABLES.defaults[def.key];
            const changed = JSON.stringify(value) !== JSON.stringify(base);
            const basis = FIELD_DEFAULTS.find((d) => d.path === def.path)!.basis;
            const optionLabel = (option: string) =>
              def.key === 'contrast' ? tOptions(`contrast.${option}` as never) : tOptions(`motion.${option}` as never);
            return rowFrame(
              def.key,
              t(`defaults.rows.${def.key}`),
              changed,
              <>
                <label className="block sm:max-w-xs">
                  <span className={labelClass}>
                    {t('defaults.value')}
                    {'unit' in def ? ` (${def.unit})` : ''}
                  </span>
                  {def.kind === 'number' ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      name={`${def.key}__value`}
                      defaultValue={String(value.value)}
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      className={`${inputClass} tabular-nums`}
                    />
                  ) : (
                    <select name={`${def.key}__value`} defaultValue={String(value.value)} className={inputClass}>
                      {def.options.map((option) => (
                        <option key={option} value={option}>
                          {optionLabel(option)}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('defaultIs', { value: def.kind === 'number' ? `${base.value} ${'unit' in def ? def.unit : ''}` : optionLabel(String(base.value)) })}
                  {def.kind === 'number' ? ` · ${t('range', { min: def.min, max: def.max })}` : ''}
                </p>
                {textPair(def.key, ['basisVi', 'basisEn'], [value.basisVi, value.basisEn], [basis.vi, basis.en])}
              </>
            );
          })}

      <p className="text-xs text-slate-500 dark:text-slate-400">{t('versionNote')}</p>
      <button type="submit" disabled={pending} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}
