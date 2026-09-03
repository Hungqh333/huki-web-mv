'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { computeTighteningScenario, computeTwoStage } from '@/lib/kpi/calc';
import type { KpiData } from '@/lib/kpi/queries';
import type { KpiComputed } from './KpiResultPanel';



export function KpiTighteningPanel({
  result,
  data,
  locale,
}: {
  result: KpiComputed;
  data: KpiData;
  locale: 'vi' | 'en';
}) {
  const t = useTranslations('kpi.tightening');
  const pct = (value: number) =>
    `${value.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 3 })}%`;
  const [scenario, setScenario] = useState<'zero' | number>('zero');

  const computed = computeTighteningScenario(
    { miss: result.split.miss, totalBurden: result.adjusted.totalBurden },
    scenario,
    data.tighteningFactors,
    result.ceiling
  );

  // Kiểm hai tầng: dùng chính chỉ tiêu đang tính cho cả hai tầng, để cho thấy
  // độ lớn của hiệu ứng. Con số thật phụ thuộc hai hệ cụ thể sẽ dùng.
  const twoStage = computeTwoStage(
    { miss: result.split.miss.max, falseReject: result.split.falseReject },
    { miss: result.split.miss.max, falseReject: result.split.falseReject }
  );

  const label = (ratio: number) => {
    const factor = data.tighteningFactors.find((f) => f.miss_ratio === ratio);
    if (!factor) return `${ratio}×`;
    return locale === 'en' ? factor.label_en : factor.label_vi;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="tightening"
            checked={scenario === 'zero'}
            onChange={() => setScenario('zero')}
            className="size-4 border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
          />
          {t('zeroMiss')}
        </label>

        {data.tighteningFactors.map((factor) => (
          <label key={factor.miss_ratio} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="tightening"
              checked={scenario === factor.miss_ratio}
              onChange={() => setScenario(factor.miss_ratio)}
              className="size-4 border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
            />
            {label(factor.miss_ratio)}
          </label>
        ))}
      </div>

      {computed.impossible ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-medium text-red-900 dark:text-red-300">{t('impossible')}</p>
          <p className="mt-2 text-sm text-red-900/85 dark:text-red-300/90">
            {t('impossibleExplain')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-400">{t('newMiss')}</dt>
              <dd className="font-medium tabular-nums">≤ {pct(computed.newMiss?.max ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-400">{t('newBurden')}</dt>
              <dd
                className={`font-medium tabular-nums ${
                  computed.exceedsCeiling ? 'text-red-600 dark:text-red-400' : ''
                }`}
              >
                {pct(computed.newTotalBurden ?? 0)}
              </dd>
            </div>
          </dl>

          {computed.exceedsCeiling ? (
            <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {t('newBurdenOverCeiling', { ceiling: pct(result.ceiling) })}
            </p>
          ) : null}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold">{t('alternatives')}</h4>
        <ul className="mt-3 space-y-3">
          {computed.alternatives.map((key) => (
            <li key={key} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-sm font-medium">{t(`alt.${key}.title`)}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t(`alt.${key}.body`)}
              </p>

              {key === 'two-stage' ? (
                <div className="mt-3 space-y-2">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600 dark:text-slate-400">{t('twoStageMiss')}</dt>
                      <dd className="font-medium tabular-nums">{pct(twoStage.miss)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600 dark:text-slate-400">{t('twoStageFr')}</dt>
                      <dd className="font-medium tabular-nums">{pct(twoStage.falseReject)}</dd>
                    </div>
                  </dl>

                  {/*
                    Cảnh báo bắt buộc. Phép nhân m1 × m2 chỉ đúng khi hai hệ độc
                    lập thật. Cùng camera cùng ánh sáng chỉ khác thuật toán thì
                    chúng sai ở cùng những mẫu, con số trên sẽ đẹp hơn thực tế
                    rất nhiều — đây là cái bẫy nguy hiểm nhất của phương án này.
                  */}
                  <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    {t('twoStageWarning')}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
