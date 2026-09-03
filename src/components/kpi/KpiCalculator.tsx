'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  applyModifier,
  computeModifierFactor,
  computeOperationalCost,
  computeRecheckFeasibility,
  computeSampleAdequacy,
  resolveCeiling,
  splitBurden,
} from '@/lib/kpi/calc';
import { parseNumber, parseShifts } from '@/lib/kpi/input';
import type { KpiData } from '@/lib/kpi/queries';
import type { BurdenStrategy, ProblemType } from '@/lib/kpi/types';
import { ProblemTypeStep } from './ProblemTypeStep';
import { ModifierStep } from './ModifierStep';
import { BurdenStep } from './BurdenStep';
import { ProductionStep } from './ProductionStep';
import { KpiResultPanel } from './KpiResultPanel';

export type ProductionInputs = {
  unitsPerHour: string;
  shifts: string;
  secondsPerCheck: string;
  annualVolume: string;
  unitValue: string;
  p0: string;
  ngSamples: string;
  availableHeadcount: string;
};

const EMPTY_PRODUCTION: ProductionInputs = {
  unitsPerHour: '',
  shifts: '1',
  secondsPerCheck: '',
  annualVolume: '',
  unitValue: '',
  p0: '',
  ngSamples: '',
  availableHeadcount: '',
};

export function KpiCalculator({ data, locale }: { data: KpiData; locale: 'vi' | 'en' }) {
  const t = useTranslations('kpi');

  const [problemSlug, setProblemSlug] = useState<string | null>(null);
  const [modifierSlugs, setModifierSlugs] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<BurdenStrategy>('balanced');
  const [customShare, setCustomShare] = useState(50);
  const [specUnclear, setSpecUnclear] = useState(false);
  const [production, setProduction] = useState<ProductionInputs>(EMPTY_PRODUCTION);

  const problem: ProblemType | null = useMemo(
    () => data.problemTypes.find((p) => p.slug === problemSlug) ?? null,
    [data.problemTypes, problemSlug]
  );

  const result = useMemo(() => {
    if (!problem) return null;

    const selectedModifiers = data.modifiers.filter((m) => modifierSlugs.includes(m.slug));
    const modifierResult = computeModifierFactor(selectedModifiers, data.config);
    const adjusted = applyModifier(problem, modifierResult.factor, data.config);
    const split = splitBurden(
      adjusted.totalBurden,
      adjusted.miss,
      strategy,
      customShare,
      data.config
    );

    const ceiling = resolveCeiling(specUnclear, data.config);

    const unitsPerHour = parseNumber(production.unitsPerHour);
    const shifts = parseShifts(production.shifts);
    const secondsPerCheck = parseNumber(production.secondsPerCheck);
    const annualVolume = parseNumber(production.annualVolume);
    const unitValue = parseNumber(production.unitValue);
    const p0 = parseNumber(production.p0);
    const ngSamples = parseNumber(production.ngSamples);
    const availableHeadcount = parseNumber(production.availableHeadcount);

    const cost =
      unitsPerHour !== null && secondsPerCheck !== null && annualVolume !== null && unitValue !== null
        ? computeOperationalCost({
            unitsPerHour,
            shifts,
            secondsPerCheck,
            annualVolume,
            unitValue,
            falseReject: split.falseReject,
            recheck: split.recheck,
          })
        : null;

    const feasibility =
      unitsPerHour !== null && secondsPerCheck !== null && availableHeadcount !== null
        ? computeRecheckFeasibility({
            unitsPerHour,
            shifts,
            secondsPerCheck,
            recheck: split.recheck,
            availableHeadcount,
          })
        : null;

    const sampleAdequacy =
      ngSamples !== null ? computeSampleAdequacy(ngSamples, split.miss.max) : null;

    return {
      problem,
      modifierResult,
      adjusted,
      split,
      ceiling,
      cost,
      feasibility,
      sampleAdequacy,
      p0,
      production: { unitsPerHour, shifts, secondsPerCheck },
    };
  }, [problem, data, modifierSlugs, strategy, customShare, specUnclear, production]);

  // Sang dự án khác thì phải xoá sạch, không để sót hệ số của dự án trước —
  // hệ số cũ nằm im ở bước 2 mà vẫn đang nhân vào kết quả.
  const reset = () => {
    setProblemSlug(null);
    setModifierSlugs([]);
    setStrategy('balanced');
    setCustomShare(50);
    setSpecUnclear(false);
    setProduction(EMPTY_PRODUCTION);
  };

  const stepsDone = [
    problemSlug !== null,
    problemSlug !== null,
    problemSlug !== null,
    parseNumber(production.unitsPerHour) !== null,
  ];
  const progress = Math.round((stepsDone.filter(Boolean).length / stepsDone.length) * 100);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">{t('progress')}</span>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 dark:text-slate-400">{progress}%</span>
            {progress > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="rounded px-2 py-1 text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
              >
                {t('reset')}
              </button>
            ) : null}
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={t('progress')}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-sky-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,4fr)]">
        <div className="min-w-0 space-y-8">
          <ProblemTypeStep
            problemTypes={data.problemTypes}
            selected={problemSlug}
            onSelect={setProblemSlug}
            locale={locale}
          />

          <ModifierStep
            modifiers={data.modifiers}
            selected={modifierSlugs}
            onChange={setModifierSlugs}
            factor={result?.modifierResult ?? null}
            locale={locale}
            onLevelUp={() => {
              // Nâng lên loại CÙNG NHÓM nhưng mức khó cao hơn liền kề.
              // Thiếu điều kiện cùng nhóm thì nút này nhảy sang một bài toán
              // hoàn toàn khác — ví dụ từ OCR sang phân loại chi tiết — và đổi
              // sạch dải chỉ tiêu mà không báo gì.
              if (!problem) return;
              const harder = data.problemTypes
                .filter((p) => p.problem_group === problem.problem_group && p.level > problem.level)
                .sort((a, b) => a.level - b.level)[0];
              if (harder) setProblemSlug(harder.slug);
            }}
          />

          <BurdenStep
            strategy={strategy}
            onStrategyChange={setStrategy}
            customShare={customShare}
            onCustomShareChange={setCustomShare}
          />

          <ProductionStep
            values={production}
            onChange={setProduction}
            specUnclear={specUnclear}
            onSpecUnclearChange={setSpecUnclear}
            locale={locale}
          />
        </div>

        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {result ? (
            <KpiResultPanel
              result={result}
              data={data}
              locale={locale}
              strategy={strategy}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t('emptyState')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
