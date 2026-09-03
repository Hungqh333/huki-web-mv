'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { KpiProblemGroup, ProblemType } from '@/lib/kpi/types';

const GROUP_ORDER: KpiProblemGroup[] = ['presence', 'metrology', 'code', 'process', 'cosmetic'];

/** Màu badge theo độ khó: 1–2 xanh lá, 3–4 vàng, 5–6 cam, 7 đỏ. */
function levelStyle(level: number): string {
  if (level <= 2) return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300';
  if (level <= 4) return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300';
  if (level <= 6) return 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300';
  return 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300';
}

export function ProblemTypeStep({
  problemTypes,
  selected,
  onSelect,
  locale,
}: {
  problemTypes: ProblemType[];
  selected: string | null;
  onSelect: (slug: string) => void;
  locale: 'vi' | 'en';
}) {
  const t = useTranslations('kpi.step1');
  const tGroup = useTranslations('kpi.groups');
  const tDl = useTranslations('kpi.deepLearning');
  const [helperOpen, setHelperOpen] = useState(false);

  const name = (p: ProblemType) => (locale === 'en' ? p.name_en : p.name_vi);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 text-sky-600">1.</span>
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={() => setHelperOpen((open) => !open)}
          className="text-sm text-sky-700 hover:underline dark:text-sky-400"
        >
          {t('helperTrigger')}
        </button>
      </div>

      {helperOpen ? (
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/30">
          <p className="font-medium text-sky-900 dark:text-sky-200">{t('helperTitle')}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sky-900/85 dark:text-sky-300/90">
            <li>{t('helperQ1')}</li>
            <li>{t('helperQ2')}</li>
            <li>{t('helperQ3')}</li>
          </ol>
          <p className="mt-3 text-sky-900/85 dark:text-sky-300/90">{t('helperAnswer')}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {GROUP_ORDER.map((group) => {
          const items = problemTypes.filter((p) => p.problem_group === group);
          if (items.length === 0) return null;

          return (
            <details
              key={group}
              open={items.some((p) => p.slug === selected)}
              className="rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                {tGroup(group)}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({items.length})</span>
              </summary>

              <ul className="border-t border-slate-200 dark:border-slate-800">
                {items.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.slug)}
                      aria-pressed={selected === item.slug}
                      className={`flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm transition ${
                        selected === item.slug
                          ? 'bg-sky-50 dark:bg-sky-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span
                        className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-semibold ${levelStyle(item.level)}`}
                      >
                        {t('level')} {item.level}
                      </span>
                      <span className="flex-1">{name(item)}</span>
                      {item.deep_learning !== 'no' ? (
                        <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                          {tDl(item.deep_learning)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
