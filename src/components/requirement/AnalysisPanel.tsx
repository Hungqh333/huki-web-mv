'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Requirement } from '@/lib/requirement/types';
import { assessFeasibility, type DimensionStatus, type FeasibilityStatus } from '@/lib/vision/feasibility';
import { analyseRequirement } from '@/lib/vision/requirementAnalysis';
import { FEASIBILITY_DIMENSIONS, type RuleResult } from '@/lib/vision/rules';
import type { CheckStatus } from '@/lib/vision/types';

/**
 * Phân tích kỹ thuật dưới bảng Yêu cầu — V1b B8 (spec V1.1 §7, §10.3, §10.4).
 *
 * Chạy engine ngay trên trình duyệt mỗi khi bảng đổi: toàn bộ là hàm thuần, không
 * gọi server, không gọi AI. Thứ tự đọc từ trên xuống là thứ tự kỹ sư cần:
 * kết luận → yếu tố giới hạn → điều kiện để khả thi → cảnh báo → chi tiết.
 *
 * Mã luật hiện ra ở đây (khác V1a): giờ luật đã chạy thật, kỹ sư cần mã để đối
 * chiếu công thức và bài cẩm nang.
 */

const CHECK_STYLES: Record<CheckStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  fail: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const FEASIBILITY_STYLES: Record<FeasibilityStatus, string> = {
  NOT_FEASIBLE: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  FEASIBLE_WITH_VALIDATION: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  TECHNICALLY_FEASIBLE: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  INSUFFICIENT_DATA: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

const BAR_STYLES: Record<DimensionStatus, string> = {
  PASS: 'bg-emerald-500',
  MARGINAL: 'bg-amber-500',
  UNKNOWN: 'bg-slate-400',
  FAIL: 'bg-red-500',
};

const DIMENSION_TEXT: Record<DimensionStatus, string> = {
  PASS: 'text-emerald-700 dark:text-emerald-400',
  MARGINAL: 'text-amber-700 dark:text-amber-400',
  UNKNOWN: 'text-slate-500 dark:text-slate-400',
  FAIL: 'text-red-700 dark:text-red-400',
};

export function AnalysisPanel({
  requirement,
  onFocusField,
}: {
  requirement: Requirement;
  onFocusField: (path: string) => void;
}) {
  const t = useTranslations('designer.requirement.analysis');
  const tv = useTranslations('selector.vision');

  const analysis = useMemo(() => analyseRequirement(requirement), [requirement]);
  const feasibility = useMemo(() => assessFeasibility(analysis.results), [analysis]);

  const noteOf = (result: RuleResult) =>
    result.noteKey
      ? result.noteKey.includes('.')
        ? tv(result.noteKey, result.noteValues ?? {})
        : tv(`notes.${result.noteKey}`, result.noteValues ?? {})
      : null;

  const warnings = analysis.results
    .filter((result) => result.status === 'warn' || result.status === 'fail')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1));

  const heading = (
    <div className="border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
      <h2 id="analysis-title" className="text-sm font-semibold">
        {t('title')}
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
    </div>
  );

  if (analysis.results.length === 0) {
    return (
      <section aria-labelledby="analysis-title" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {heading}
        <p className="px-4 py-4 text-sm text-slate-600 sm:px-5 dark:text-slate-400">{t('empty')}</p>
      </section>
    );
  }

  const percent = analysis.completeness === null ? null : Math.round(analysis.completeness * 100);

  return (
    <section aria-labelledby="analysis-title" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {heading}

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {/* Kết luận — luôn kèm câu "ước tính kỹ thuật" (spec §7.3). */}
        <div className={`rounded-xl border px-4 py-3 ${FEASIBILITY_STYLES[feasibility.status]}`}>
          <p className="text-base font-semibold">{t(`status.${feasibility.status}`)}</p>
          {feasibility.overall !== null ? (
            <p className="mt-1 text-sm">
              {t('overall', { score: feasibility.overall })}
              {feasibility.limitingFactors.length > 0 ? (
                <>
                  {' · '}
                  <strong>
                    {t('limiting', {
                      factors: feasibility.limitingFactors.map((dimension) => t(`dimensions.${dimension}`)).join(', '),
                    })}
                  </strong>
                </>
              ) : null}
            </p>
          ) : null}
          {percent !== null ? <p className="mt-1 text-xs opacity-80">{t('completeness', { percent })}</p> : null}
          <p className="mt-2 text-xs font-medium">{t('disclaimer')}</p>
        </div>

        {/* Điều kiện để chuyển thành khả thi — lấy từ ghi chú của chính các luật FAIL. */}
        {feasibility.blockers.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">{t('toFeasible')}</h3>
            <ul className="mt-2 space-y-2">
              {feasibility.blockers.map((result) => (
                <li key={`${result.ruleId}-${result.key}`} className="rounded-lg border border-red-200 px-3 py-2 text-sm dark:border-red-900">
                  <span className="mr-2 font-mono text-xs text-red-700 dark:text-red-400">{result.ruleId}</span>
                  {noteOf(result) ?? tv(`checks.${result.key}`)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Bảy nhóm khả thi — khả thi là MIN, nên nhóm thấp nhất là thứ cần nhìn. */}
        <div>
          <h3 className="text-sm font-semibold">{t('dimensionsTitle')}</h3>
          <ul className="mt-2 space-y-1.5">
            {FEASIBILITY_DIMENSIONS.map((name) => {
              const dimension = feasibility.dimensions.find((d) => d.dimension === name)!;
              return (
                <li key={name} className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_12rem]">
                  <span className="truncate">{t(`dimensions.${name}`)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                    {dimension.score !== null ? (
                      <span className={`block h-full ${BAR_STYLES[dimension.status]}`} style={{ width: `${dimension.score}%` }} />
                    ) : null}
                  </span>
                  <span className={`text-right text-xs ${dimension.evaluated ? DIMENSION_TEXT[dimension.status] : 'text-slate-400'}`}>
                    {dimension.evaluated ? (
                      <>
                        <span className="tabular-nums">{dimension.score}</span> · {t(`dimensionStatus.${dimension.status}`)}
                        {dimension.drivingRules.length > 0 && dimension.status !== 'PASS' ? (
                          <span className="ml-1 hidden font-mono sm:inline">{dimension.drivingRules.join(', ')}</span>
                        ) : null}
                      </>
                    ) : (
                      t('notEvaluated')
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('scoreNote')}</p>
        </div>

        {/* Cảnh báo — không che giấu bất định (spec §10.4). */}
        {warnings.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">{t('warningsTitle', { count: warnings.length })}</h3>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {warnings.map((result) => (
                <ResultRow key={`w-${result.ruleId}-${result.key}`} result={result} note={noteOf(result)} onFocusField={onFocusField} />
              ))}
            </ul>
          </div>
        ) : null}

        {/* Toàn bộ phép tính, gập theo nhóm — kỹ sư mở ra để tự kiểm chứng số. */}
        <details>
          <summary className="cursor-pointer text-sm text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
            {t('allResults', { count: analysis.results.length })}
          </summary>
          <div className="mt-3 space-y-3">
            {FEASIBILITY_DIMENSIONS.map((name) => {
              const own = analysis.results.filter((result) => result.dimension === name);
              if (own.length === 0) return null;
              return (
                <div key={name}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`dimensions.${name}`)}</h4>
                  <ul className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {own.map((result) => (
                      <ResultRow key={`${result.ruleId}-${result.key}`} result={result} note={noteOf(result)} onFocusField={onFocusField} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </section>
  );
}

function ResultRow({
  result,
  note,
  onFocusField,
}: {
  result: RuleResult;
  note: string | null;
  onFocusField: (path: string) => void;
}) {
  const t = useTranslations('designer.requirement.analysis');
  const tv = useTranslations('selector.vision');
  const needsCameraCount = result.noteKey === 'cameraCountMissing';

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{result.ruleId}</span>
        <span className="text-sm">{tv(`checks.${result.key}`)}</span>
        {result.status === 'info' ? null : (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CHECK_STYLES[result.status]}`}>
            {tv(`status.${result.status}`)}
          </span>
        )}
        {result.evidence === 'requires-sample-test' ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">{t('needsSample')}</span>
        ) : null}
      </div>
      {result.formula && result.formula !== '—' ? (
        <code className="mt-1 block overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {result.formula}
        </code>
      ) : null}
      {note ? <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{note}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {result.inputsAssumed.length > 0 ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">{t('assumedInputs', { count: result.inputsAssumed.length })}</span>
        ) : null}
        {needsCameraCount ? (
          <button
            type="button"
            onClick={() => onFocusField('system.cameraCount')}
            className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            {t('enterCameraCount')}
          </button>
        ) : null}
      </div>
    </li>
  );
}
