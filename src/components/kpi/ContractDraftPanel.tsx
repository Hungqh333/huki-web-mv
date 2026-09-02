'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buildContractDraft } from '@/lib/kpi/contract';
import type { KpiComputed } from './KpiResultPanel';

export function ContractDraftPanel({
  result,
  locale,
}: {
  result: KpiComputed;
  locale: 'vi' | 'en';
}) {
  const t = useTranslations('kpi.contract');
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const draft = useMemo(
    () =>
      buildContractDraft({
        locale,
        taskName: locale === 'en' ? result.problem.name_en : result.problem.name_vi,
        miss: result.split.miss.max,
        falseReject: result.split.falseReject,
        recheck: result.split.recheck,
        totalBurden: result.adjusted.totalBurden,
        falseRejectWeek1: {
          min: result.problem.false_reject_week1_min,
          max: result.problem.false_reject_week1_max,
        },
        rampUpWeeks: {
          min: result.problem.ramp_up_weeks_min,
          max: result.problem.ramp_up_weeks_max,
        },
        p0: result.p0,
        dataSource: result.problem.data_source,
        generatedAt: new Date().toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN'),
      }),
    [result, locale]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([draft], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ban-nhap-dieu-khoan-${result.problem.slug}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/*
        Cổng xác nhận. Cố ý bắt người dùng tick trước khi sao chép được: một
        khung văn bản sạch kèm nút "Sao chép" là lời mời dán thẳng vào hợp đồng
        thật, trong khi các con số vẫn đang là ước lượng chưa kiểm chứng.
      */}
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{t('gateTitle')}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900/85 dark:text-amber-300/90">
          <li>{t('gateItem1')}</li>
          <li>{t('gateItem2')}</li>
          <li>{t('gateItem3')}</li>
        </ul>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
          />
          {t('gateAcknowledge')}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!acknowledged}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          {copied ? t('copied') : t('copy')}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!acknowledged}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('download')}
        </button>
      </div>

      <pre className="max-h-[32rem] overflow-auto rounded-md bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 dark:bg-slate-900 dark:text-slate-200">
        {draft}
      </pre>
    </div>
  );
}
