'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { findContractBlockers } from '@/lib/kpi/calc';
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
  const [copyFailed, setCopyFailed] = useState(false);

  /*
   * Chốt chặn trước khi sinh văn bản.
   *
   * Bốn trường hợp bị chặn đều cho ra con số đúng về mặt tính toán nhưng biến
   * thành cam kết pháp lý thì sai — ví dụ "bỏ sót ≤ 0%" cho bài toán đọc mã, tức
   * cam kết đúng cái điều mà tab bên cạnh vừa tuyên bố là không tồn tại về mặt
   * toán học. Xem findContractBlockers để biết lý do từng trường hợp.
   */
  const blockers = findContractBlockers({
    miss: result.split.miss.max,
    totalBurden: result.adjusted.totalBurden,
    ceiling: result.ceiling,
    specialKpi: result.problem.special_kpi,
    sampleAdequacy: result.sampleAdequacy,
  });

  const draft = useMemo(
    () =>
      blockers.length > 0
        ? ''
        : buildContractDraft({
            locale,
            taskName: locale === 'en' ? result.problem.name_en : result.problem.name_vi,
            miss: result.split.miss.max,
            falseReject: result.split.falseReject,
            recheck: result.split.recheck,
            totalBurden: result.adjusted.totalBurden,
            falseRejectWeek1: result.adjusted.falseRejectWeek1,
            rampUpWeeks: {
              min: result.problem.ramp_up_weeks_min,
              max: result.problem.ramp_up_weeks_max,
            },
            p0: result.p0,
            dataSource: result.problem.data_source,
            generatedAt: new Date().toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN'),
          }),
    [result, locale, blockers.length]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bị chặn khi trang không chạy HTTPS (hay gặp khi truy cập qua
      // IP nội bộ) — phải nói ra, đừng thất bại im lặng.
      setCopied(false);
      setCopyFailed(true);
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

  if (blockers.length > 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">
            {t('blocked.title')}
          </h3>
          <p className="mt-2 text-sm text-red-900/85 dark:text-red-300/90">
            {t('blocked.intro')}
          </p>
        </div>

        <ul className="space-y-3">
          {blockers.map((blocker) => (
            <li
              key={blocker}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-800"
            >
              <p className="text-sm font-medium">{t(`blocked.reasons.${blocker}.title`)}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t(`blocked.reasons.${blocker}.body`)}
              </p>
              <p className="mt-2 text-sm text-sky-800 dark:text-sky-300">
                <span className="font-medium">{t('blocked.whatToDo')} </span>
                {t(`blocked.reasons.${blocker}.action`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

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

      {copyFailed ? (
        <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
          {t('copyFailed')}
        </p>
      ) : null}

      <pre className="max-h-[32rem] overflow-auto rounded-md bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 dark:bg-slate-900 dark:text-slate-200">
        {draft}
      </pre>
    </div>
  );
}
