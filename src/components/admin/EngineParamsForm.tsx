'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { saveEngineParamsAction, type EngineParamsState } from '@/app/actions/admin';
import { ENGINE_PARAM_GROUPS, ENGINE_PARAMS, SENSITIVE_GROUPS, type EngineParams } from '@/lib/vision/engineParams';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

/**
 * Form ngưỡng engine — V1c, chốt 2026-10-12 (Q1). Mỗi ô ghi mặc định, giới hạn, và
 * người sửa gần nhất; ô khác mặc định có nhãn "đã sửa". Ô để trống = mặc định.
 */
export function EngineParamsForm({
  current,
  stored,
  rejected,
}: {
  current: EngineParams;
  stored: Record<string, { value: number; updatedBy: string | null; updatedAt: string }>;
  rejected: boolean;
}) {
  const t = useTranslations('admin.engine');
  const [state, formAction, pending] = useActionState<EngineParamsState, FormData>(saveEngineParamsAction, {});

  return (
    <form action={formAction} className="space-y-6">
      {rejected ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{t('rejected')}</p>
      ) : null}
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

      {ENGINE_PARAM_GROUPS.map((group) => (
        <fieldset key={group} className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* legend cho trình đọc màn hình; thanh tiêu đề chung để nhìn (2026-10-15). */}
          <legend className="sr-only">{t(`groups.${group}.title`)}</legend>
          <PanelHeader
            as="h3"
            title={t(`groups.${group}.title`)}
            note={
              <>
                {t(`groups.${group}.hint`)}
                {/* Hằng số vật lý / quy ước đo / thông số chuẩn — mở theo chốt 2026-10-16. */}
                {SENSITIVE_GROUPS.includes(group) ? (
                  <span className="mt-1 block font-medium text-red-700 dark:text-red-400">{t('sensitiveWarning')}</span>
                ) : null}
              </>
            }
          />
          <div className="space-y-3 px-4 py-4 sm:px-5">
            {ENGINE_PARAMS.filter((def) => def.group === group).map((def) => {
              const changed = current[def.key] !== def.default;
              const meta = stored[def.key];
              const error = state.fieldErrors?.[def.key];
              return (
                <div key={def.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-start">
                  <div className="min-w-0">
                    <label htmlFor={`param_${def.key}`} className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t(`params.${def.key}`)}
                      {changed ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{t('changed')}</span>
                      ) : null}
                    </label>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {t('range', { def: def.default, min: def.min, max: def.max, unit: 'unit' in def ? def.unit : '' })}
                      {meta?.updatedBy ? ` · ${t('updatedBy', { name: meta.updatedBy })}` : ''}
                    </p>
                    {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
                  </div>
                  <input
                    id={`param_${def.key}`}
                    name={def.key}
                    type="number"
                    inputMode="decimal"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    defaultValue={current[def.key]}
                    aria-invalid={error ? true : undefined}
                    className={inputClass}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p className="text-xs text-slate-500 dark:text-slate-400">{t('versionNote')}</p>
      <button type="submit" disabled={pending} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}
