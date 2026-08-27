'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { SelectorResult } from '@/lib/selector/types';

const APPROACH_STYLES: Record<string, string> = {
  rule_based: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  hybrid: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  deep_learning: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300',
};

export function SelectorResultPanel({
  result,
  historySaved,
  historyId,
  canExport,
}: {
  result: SelectorResult;
  historySaved?: boolean;
  historyId?: string;
  canExport: boolean;
}) {
  const t = useTranslations('selector.result');
  const tApproach = useTranslations('selector.approach');
  const locale = useLocale();
  const pickNote = (note: { vi: string; en: string }) => (locale === 'en' ? note.en : note.vi);

  const rows = [
    { label: t('camera'), value: result.camera },
    { label: t('lighting'), value: result.lighting },
    { label: t('lens'), value: result.lens },
  ];

  return (
    <section aria-live="polite" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            APPROACH_STYLES[result.approach] ?? APPROACH_STYLES.rule_based
          }`}
        >
          {tApproach(result.approach)}
        </span>
      </div>

      {result.noRuleMatched ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('noRuleMatched')}
        </p>
      ) : null}

      <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">{row.label}</dt>
            <dd className="text-sm sm:col-span-2">
              {row.value ?? <span className="text-slate-400">{t('notSpecified')}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {result.approachReason ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{t('approachReason')}</h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {pickNote(result.approachReason)}
          </p>
        </div>
      ) : null}

      {result.derived.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{t('calculations')}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('calculationsHint')}</p>
          <ul className="mt-3 space-y-2">
            {result.derived.map((metric) => (
              <li key={metric.key} className="text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t(`metrics.${metric.key}`)}
                </span>
                <code className="mt-0.5 block overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {metric.formula}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.notes.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{t('notes')}</h3>
          <ul className="mt-3 space-y-3">
            {result.notes.map((note, index) => (
              <li key={`${note.ruleCode ?? 'note'}-${index}`} className="text-sm">
                <p className="text-slate-700 dark:text-slate-300">{pickNote(note)}</p>
                {note.ruleCode ? (
                  <p className="mt-0.5 text-xs text-slate-400">{note.ruleCode}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {canExport && historyId ? (
          <a
            href={`/api/bao-cao/${historyId}`}
            // Route trả Content-Disposition: attachment nên trình duyệt tải về
            // thay vì mở tab mới rồi bỏ trống.
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            {t('exportPdf')}
          </a>
        ) : (
          <button
            type="button"
            disabled
            title={canExport ? t('exportNeedsHistory') : t('exportVipOnly')}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-500 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-400"
          >
            {t('exportPdf')}
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
              VIP
            </span>
          </button>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {historySaved === false ? t('historyNotSaved') : t('historySaved')}
        </p>
      </div>
    </section>
  );
}
