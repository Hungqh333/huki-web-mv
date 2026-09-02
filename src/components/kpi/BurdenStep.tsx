'use client';

import { useTranslations } from 'next-intl';
import type { BurdenStrategy } from '@/lib/kpi/types';

const STRATEGIES: BurdenStrategy[] = ['no-recheck', 'minimize-scrap', 'balanced', 'custom'];

const KEY: Record<BurdenStrategy, string> = {
  'no-recheck': 'noRecheck',
  'minimize-scrap': 'minimizeScrap',
  balanced: 'balanced',
  custom: 'custom',
};

export function BurdenStep({
  strategy,
  onStrategyChange,
  customShare,
  onCustomShareChange,
}: {
  strategy: BurdenStrategy;
  onStrategyChange: (strategy: BurdenStrategy) => void;
  customShare: number;
  onCustomShareChange: (share: number) => void;
}) {
  const t = useTranslations('kpi.step3');

  return (
    <section>
      <h2 className="text-lg font-semibold">
        <span className="mr-2 text-sky-600">3.</span>
        {t('title')}
      </h2>

      {/*
        Câu này là ý niệm cốt lõi của cả module — đặt ngay dưới tiêu đề, trước
        các lựa chọn, để người dùng hiểu họ đang chọn cái gì.
      */}
      <p className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
        {t('coreIdea')}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {STRATEGIES.map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-lg border p-4 transition ${
              strategy === option
                ? 'border-sky-500 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/40'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
            }`}
          >
            <span className="flex items-start gap-2">
              <input
                type="radio"
                name="burden-strategy"
                checked={strategy === option}
                onChange={() => onStrategyChange(option)}
                className="mt-1 size-4 shrink-0 border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
              />
              <span>
                <span className="block text-sm font-medium">{t(`${KEY[option]}.label`)}</span>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                  {t(`${KEY[option]}.description`)}
                </span>
              </span>
            </span>
          </label>
        ))}
      </div>

      {strategy === 'custom' ? (
        <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <label htmlFor="custom-share" className="flex justify-between text-sm">
            <span>{t('customLabel')}</span>
            <span className="font-medium tabular-nums">{customShare}%</span>
          </label>
          <input
            id="custom-share"
            type="range"
            min={0}
            max={100}
            step={5}
            value={customShare}
            onChange={(event) => onCustomShareChange(Number(event.target.value))}
            className="mt-3 w-full accent-sky-600"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t('customAllScrap')}</span>
            <span>{t('customAllRecheck')}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
