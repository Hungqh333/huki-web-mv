'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { computeAssistModel, computeEscapeLadder } from '@/lib/kpi/calc';
import type { KpiData } from '@/lib/kpi/queries';
import type {
  AdjustedTargets,
  BurdenSplit,
  BurdenStrategy,
  ModifierResult,
  OperationalCost,
  ProblemType,
  RecheckFeasibility,
  SampleAdequacy,
} from '@/lib/kpi/types';
import { KpiTighteningPanel } from './KpiTighteningPanel';
import { ContractDraftPanel } from './ContractDraftPanel';

export type KpiComputed = {
  problem: ProblemType;
  modifierResult: ModifierResult;
  adjusted: AdjustedTargets;
  split: BurdenSplit;
  ceiling: number;
  cost: OperationalCost | null;
  feasibility: RecheckFeasibility | null;
  sampleAdequacy: SampleAdequacy | null;
  p0: number | null;
  production: { unitsPerHour: number | null; shifts: number; secondsPerCheck: number | null };
};

/**
 * Định dạng phần trăm theo đúng ngôn ngữ đang xem.
 *
 * Trước đây luôn dùng 'vi-VN' nên bản tiếng Anh in "0,5%" — người đọc tiếng Anh
 * hiểu dấu phẩy là phân cách hàng nghìn, tức đọc thành 5 lần giá trị thật. Đây
 * là con số đưa vào hợp đồng nên sai kiểu này có hậu quả.
 *
 * maximumFractionDigits 3 thay vì 2: escape của bài toán bỏ sót thấp rơi vào
 * khoảng 0,001–0,006% và bị làm tròn thành "0%" ở 2 chữ số.
 */
const fmtPct = (value: number, locale: 'vi' | 'en') =>
  `${value.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN', { maximumFractionDigits: 3 })}%`;

export function KpiResultPanel({
  result,
  data,
  locale,
  strategy,
}: {
  result: KpiComputed;
  data: KpiData;
  locale: 'vi' | 'en';
  strategy: BurdenStrategy;
}) {
  const t = useTranslations('kpi.result');
  const [tab, setTab] = useState<'targets' | 'tightening' | 'contract'>('targets');

  const pct = (value: number) => fmtPct(value, locale);
  const { problem, adjusted, split, ceiling } = result;
  const overCeiling = adjusted.totalBurden > ceiling;
  const burdenBarWidth = Math.min(100, (adjusted.totalBurden / Math.max(ceiling * 1.6, 1)) * 100);
  const ceilingMarker = Math.min(100, (ceiling / Math.max(ceiling * 1.6, 1)) * 100);

  const note = locale === 'en' ? problem.note_en : problem.note_vi;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <div role="tablist" className="flex border-b border-slate-200 dark:border-slate-800">
        {(['targets', 'tightening', 'contract'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            role="tab"
            id={`kpi-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="kpi-tabpanel"
            className={`flex-1 px-2 py-2.5 text-xs font-medium leading-tight transition sm:px-3 sm:text-sm ${
              tab === key
                ? 'border-b-2 border-sky-600 text-sky-700 dark:text-sky-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <div
        id="kpi-tabpanel"
        role="tabpanel"
        aria-labelledby={`kpi-tab-${tab}`}
        aria-live="polite"
        className="p-5"
      >
        {tab === 'targets' ? (
          <div className="space-y-6">
            {problem.data_source === 'estimate' ? (
              <p className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {t('estimateNotice')}
              </p>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold">{t('committed')}</h3>
              <dl className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                <Row label={t('miss')} value={`≤ ${pct(split.miss.max)}`} />
                <Row label={t('falseReject')} value={`≤ ${pct(split.falseReject)}`} />
                <Row label={t('recheck')} value={`≤ ${pct(split.recheck)}`} />
              </dl>

              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{t('totalBurden')}</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      overCeiling ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {pct(adjusted.totalBurden)}
                  </span>
                </div>
                <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${overCeiling ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${burdenBarWidth}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-700"
                    style={{ left: `${ceilingMarker}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('ceilingMarker', { value: pct(ceiling) })}
                </p>
              </div>

              <dl className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
                <Row
                  label={t('week1')}
                  value={`${pct(adjusted.falseRejectWeek1.min)} – ${pct(adjusted.falseRejectWeek1.max)}`}
                  hint={t('week1Hint')}
                />
                <Row
                  label={t('rampUp')}
                  value={t('weeks', {
                    min: problem.ramp_up_weeks_min,
                    max: problem.ramp_up_weeks_max,
                  })}
                />
              </dl>
            </div>

            <Warnings result={result} strategy={strategy} note={note} />

            {overCeiling ? <AssistModel result={result} data={data} pct={pct} /> : null}

            {result.cost ? (
              <div>
                <h3 className="text-sm font-semibold">{t('cost')}</h3>
                <dl className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                  <Row
                    label={t('headcount')}
                    value={t('people', { count: result.cost.headcount })}
                  />
                  <Row
                    label={t('annualScrap')}
                    value={result.cost.annualScrapCost.toLocaleString(
                      locale === 'en' ? 'en-US' : 'vi-VN',
                      { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }
                    )}
                  />
                </dl>
              </div>
            ) : null}

            {result.p0 !== null ? (
              <div>
                <h3 className="text-sm font-semibold">{t('escapeLadder')}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('escapeHint')}
                </p>
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="py-1.5 font-medium">{t('inputNg')}</th>
                      <th scope="col" className="py-1.5 font-medium">{t('escapeTarget')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {computeEscapeLadder(split.miss.max, result.p0).map((row) => (
                      <tr key={row.pRange}>
                        <td className="py-1.5">{row.pRange}</td>
                        <td className="py-1.5 tabular-nums">
                          ≤ {pct(row.escapeTarget)}
                          {row.status === 'suspended' ? (
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                              {t('suspended')}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'tightening' ? (
          <KpiTighteningPanel result={result} data={data} locale={locale} />
        ) : null}

        {tab === 'contract' ? (
          <ContractDraftPanel result={result} locale={locale} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Mô hình "hỗ trợ người kiểm" — lối thoát khi tổng tải phụ vượt trần.
 *
 * Trước đây computeAssistModel được viết đầy đủ và có test nhưng KHÔNG được gọi
 * ở đâu cả, nên khi vượt trần người dùng chỉ nhận một câu chữ chung chung. Con
 * số "trước 20 người, sau 3 người" mới là thứ cứu được cuộc đàm phán.
 */
function AssistModel({
  result,
  data,
  pct,
}: {
  result: KpiComputed;
  data: KpiData;
  pct: (value: number) => string;
}) {
  const t = useTranslations('kpi.assist');

  const { unitsPerHour, shifts, secondsPerCheck } = result.production;
  if (unitsPerHour === null || secondsPerCheck === null) {
    return (
      <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
        <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-200">{t('title')}</h3>
        <p className="mt-2 text-sm text-sky-900/85 dark:text-sky-300/90">{t('body')}</p>
        <p className="mt-2 text-xs text-sky-900/70 dark:text-sky-300/70">{t('needInputs')}</p>
      </div>
    );
  }

  const assist = computeAssistModel(unitsPerHour, secondsPerCheck, shifts, data.config);

  return (
    <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
      <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-200">{t('title')}</h3>
      <p className="mt-2 text-sm text-sky-900/85 dark:text-sky-300/90">{t('body')}</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-sky-900/80 dark:text-sky-300/80">{t('autoClear')}</dt>
          <dd className="font-medium tabular-nums text-sky-900 dark:text-sky-200">
            {pct(assist.autoClearShare)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-sky-900/80 dark:text-sky-300/80">{t('headcountBefore')}</dt>
          <dd className="font-medium tabular-nums text-sky-900 dark:text-sky-200">
            {t('people', { count: assist.headcountBefore })}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-sky-900/80 dark:text-sky-300/80">{t('headcountAfter')}</dt>
          <dd className="font-medium tabular-nums text-sky-900 dark:text-sky-200">
            {t('people', { count: assist.headcountAfter })}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-sky-900/70 dark:text-sky-300/70">{t('pitch')}</p>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <dt className="text-sm text-slate-600 dark:text-slate-400">
        {label}
        {hint ? <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({hint})</span> : null}
      </dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Warnings({
  result,
  strategy,
  note,
}: {
  result: KpiComputed;
  strategy: BurdenStrategy;
  note: string | null;
}) {
  const t = useTranslations('kpi.warnings');
  const items: { tone: 'red' | 'amber' | 'blue'; text: string }[] = [];

  if (result.adjusted.totalBurden > result.ceiling) {
    items.push({ tone: 'red', text: t('overCeiling') });
  }

  if (result.modifierResult.shouldLevelUp) {
    items.push({ tone: 'amber', text: t('levelUp') });
  }

  if (result.problem.level >= 6 && strategy === 'no-recheck') {
    items.push({ tone: 'amber', text: t('hardWithoutRecheck') });
  }

  if (result.sampleAdequacy && !result.sampleAdequacy.isAdequate) {
    items.push({
      tone: 'amber',
      text: t('notEnoughSamples', {
        provable: result.sampleAdequacy.provableMiss,
        required: Number.isFinite(result.sampleAdequacy.requiredSamples)
          ? result.sampleAdequacy.requiredSamples
          : '∞',
      }),
    });
  }

  if (result.feasibility && !result.feasibility.isFeasible) {
    items.push({
      tone: 'amber',
      text: t('recheckNotFeasible', {
        required: result.feasibility.requiredHeadcount,
        available: result.feasibility.availableHeadcount,
        maxRecheck: result.feasibility.maxFeasibleRecheck,
        forced: result.feasibility.forcedToFalseReject,
      }),
    });
  }

  if (note) items.push({ tone: 'blue', text: note });

  if (items.length === 0) return null;

  const styles = {
    red: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
    amber:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    blue: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      {items.map((item, index) => (
        <p key={index} className={`rounded-md border px-3 py-2 text-sm ${styles[item.tone]}`}>
          {item.text}
        </p>
      ))}
    </div>
  );
}
