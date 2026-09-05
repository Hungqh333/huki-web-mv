'use client';

import { useTranslations } from 'next-intl';
import type { AppearanceAnalysis, Check, CheckStatus } from '@/lib/vision';

/**
 * Hiển thị kết quả bộ tính toán bài ngoại quan.
 *
 * Giữ đúng cách trình bày đang dùng ở phần "Cách tính": tên bước + công thức đã
 * thay số. Khác ở chỗ mỗi bước giờ có trạng thái rõ ràng, thay vì để kỹ sư tự
 * đoán con số vừa hiện ra là tốt hay xấu.
 */

const STATUS_STYLES: Record<CheckStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  fail: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const BORDER_STYLES: Record<CheckStatus, string> = {
  pass: 'border-emerald-200 dark:border-emerald-900',
  warn: 'border-amber-300 dark:border-amber-800',
  fail: 'border-red-300 dark:border-red-800',
  info: 'border-slate-200 dark:border-slate-800',
};

export function VisionChecks({
  analysis,
  hasCamera,
}: {
  analysis: AppearanceAnalysis;
  hasCamera: boolean;
}) {
  const t = useTranslations('selector.vision');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t('title')}</h3>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[analysis.overall]}`}
        >
          {t(`status.${analysis.overall}`)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('hint')}</p>

      {/*
        Cảnh báo cố định: hiện dù mọi phép kiểm đều đạt. Đủ độ phân giải chỉ nói
        lỗi đủ lớn trong ảnh, không nói nó có nổi khỏi nền hay không — ranh giới
        mà không công thức nào vượt qua được.
      */}
      <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {t('contrastDisclaimer')}
      </p>

      {hasCamera ? null : (
        <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t('needCamera')}
        </p>
      )}

      <div className="mt-4 space-y-5">
        {analysis.sections
          .filter((section) => section.checks.length > 0)
          .map((section) => (
            <section key={section.key}>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t(`sections.${section.key}`)}
              </h4>
              <ul className="mt-2 space-y-2">
                {section.checks.map((check) => (
                  <CheckRow key={`${section.key}-${check.key}`} check={check} />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const t = useTranslations('selector.vision');

  return (
    <li className={`rounded-lg border p-3 ${BORDER_STYLES[check.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t(`checks.${check.key}`)}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[check.status]}`}
        >
          {t(`status.${check.status}`)}
        </span>
      </div>

      <code className="mt-1.5 block overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        {check.formula}
      </code>

      {check.noteKey ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {/* Khoá có dấu chấm là đường dẫn đầy đủ (ví dụ lightingReason.scratch);
              khoá trơn thì nằm trong nhóm notes. */}
          {check.noteKey.includes('.')
            ? t(check.noteKey, check.noteValues ?? {})
            : t(`notes.${check.noteKey}`, check.noteValues ?? {})}
        </p>
      ) : null}
    </li>
  );
}
