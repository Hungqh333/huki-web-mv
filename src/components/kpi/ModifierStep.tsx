'use client';

import { useTranslations } from 'next-intl';
import type { Modifier, ModifierResult } from '@/lib/kpi/types';

export function ModifierStep({
  modifiers,
  selected,
  onChange,
  factor,
  locale,
  onLevelUp,
}: {
  modifiers: Modifier[];
  selected: string[];
  onChange: (slugs: string[]) => void;
  factor: ModifierResult | null;
  locale: 'vi' | 'en';
  onLevelUp: () => void;
}) {
  const t = useTranslations('kpi.step2');

  const name = (m: Modifier) => (locale === 'en' ? m.name_en : m.name_vi);
  const worse = modifiers.filter((m) => m.direction === 'worse');
  const better = modifiers.filter((m) => m.direction === 'better');

  const toggle = (slug: string) => {
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  };

  const column = (items: Modifier[], title: string) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.slug}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(item.slug)}
                onChange={() => toggle(item.slug)}
                className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
              />
              <span>
                {name(item)}
                <span className="ml-1.5 text-xs text-slate-400">
                  ×{item.factor_min === item.factor_max
                    ? item.factor_min
                    : `${item.factor_min}–${item.factor_max}`}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section>
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-sky-600">2.</span>
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{t('currentFactor')}</span>
          <span className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400">
            ×{(factor?.factor ?? 1).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
          </span>
        </div>
        {factor?.capped ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('capped')}</p>
        ) : null}
      </div>

      {factor?.shouldLevelUp ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-amber-900 dark:text-amber-300">{t('levelUpWarning')}</p>
          <button
            type="button"
            onClick={onLevelUp}
            className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            {t('levelUpApply')}
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {column(worse, t('worse'))}
        {column(better, t('better'))}
      </div>
    </section>
  );
}
