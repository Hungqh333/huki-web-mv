'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { ExplainResult } from '@/app/actions/explainSolution';
import type { CheckStatus } from '@/lib/vision/types';
import type { WhyFacts } from '@/lib/vision/whyFacts';

/**
 * Khối "Vì sao chọn?" của một phương án — V1c mục C7 (UI_CONTENT màn 6).
 *
 * Lớp 1 (luôn hiện): dữ kiện engine — số, mã luật, giả định, trọng số.
 * Lớp 2 (nút, chỉ khi server có key AI): đoạn văn Gemini viết lại từ đúng các
 * dữ kiện đó, server đã kiểm số. Không lưu vào revision (chốt Q7) — DesignPanels
 * giữ tạm theo bảng Yêu cầu, bấm lại không tốn thêm lượt gọi.
 */

export type Explainer = {
  cached: (level: WhyFacts['level']) => ExplainResult | undefined;
  run: (level: WhyFacts['level']) => Promise<ExplainResult>;
};

const STATUS_MARK: Record<CheckStatus, { mark: string; className: string }> = {
  pass: { mark: '✓', className: 'text-emerald-700 dark:text-emerald-400' },
  warn: { mark: '⚠', className: 'text-amber-700 dark:text-amber-400' },
  fail: { mark: '✗', className: 'text-red-700 dark:text-red-400' },
  info: { mark: '•', className: 'text-slate-500 dark:text-slate-400' },
};

export function WhyPanel({ facts, explainer, onClose }: { facts: WhyFacts; explainer: Explainer | null; onClose: () => void }) {
  const t = useTranslations('designer.requirement.solutions.why');
  const tv = useTranslations('selector.vision.status');

  return (
    <section
      aria-labelledby={`why-${facts.level}`}
      className="rounded-xl border border-sky-200 bg-sky-50/40 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`why-${facts.level}`} className="text-sm font-semibold">
            {facts.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('source')}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-sky-700 hover:underline dark:text-sky-400">
          {t('hide')}
        </button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {facts.sections.map((section) => (
          <div key={section.id} className={section.id === 'requirement' || section.id === 'limits' ? 'md:col-span-2' : ''}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{section.title}</h4>
            <ul className="mt-1 space-y-1 text-xs">
              {section.rows.map((row, index) => (
                <li key={index} className="break-words">
                  {row.status ? (
                    <span className={`mr-1 ${STATUS_MARK[row.status].className}`} title={tv(row.status)}>
                      {STATUS_MARK[row.status].mark}
                    </span>
                  ) : null}
                  {row.ruleId ? <span className="mr-1.5 font-mono text-slate-500 dark:text-slate-400">{row.ruleId}</span> : null}
                  <span className={row.status ? '' : 'font-medium'}>{row.label}</span>
                  {row.detail ? <span className="ml-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{row.detail}</span> : null}
                  {row.note ? <span className="block text-slate-600 dark:text-slate-400">{row.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {explainer ? <Explanation key={facts.level} level={facts.level} explainer={explainer} /> : null}
    </section>
  );
}

function Explanation({ level, explainer }: { level: WhyFacts['level']; explainer: Explainer }) {
  const t = useTranslations('designer.requirement.solutions.why');
  const [result, setResult] = useState<ExplainResult | undefined>(() => explainer.cached(level));
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setResult(await explainer.run(level));
    });

  return (
    <div className="mt-4 border-t border-sky-200 pt-3 dark:border-sky-900">
      {result?.status === 'ok' ? (
        <div className="space-y-2 text-sm leading-relaxed">
          {result.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="text-xs text-slate-500 dark:text-slate-400">✦ {t('aiNote')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
          >
            {pending ? t('explaining') : result ? t('retry') : `✦ ${t('explain')}`}
          </button>
          {result && !pending ? (
            <p role="status" className="text-xs text-amber-800 dark:text-amber-300">
              {result.status === 'failed' || result.status === 'stray'
                ? t(`errors.${result.status}`, { detail: result.detail ?? '—' })
                : t(`errors.${result.status}`)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
