'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';
import {
  APPLICATION_SHORTCUT_ORDER,
  applicationCardEntry,
  freeTextEntry,
  type ApplicationType,
  type VisionEntryPayload,
} from '@/lib/visionEntry';

/**
 * Hai cửa vào Vision Engineer ở trang chủ: ô mô tả bài toán và 8 thẻ ứng dụng.
 *
 * Chưa nối backend (parser là V1a hạng mục 3). Tạm thời cả hai chỉ ghi
 * VisionEntryPayload ra console — đúng shape bước sau sẽ nhận.
 */
function submitEntry(payload: VisionEntryPayload) {
  console.log('[VisionEntry]', payload);
}

// Cùng class với ô nhập trong Field.tsx và nút chính của trang chủ cũ.
const TEXTAREA_CLASS =
  'block w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-11 items-center rounded-lg bg-sky-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60';

export function ProblemInput() {
  const t = useTranslations('home.entry');
  const [text, setText] = useState('');
  const payload = freeTextEntry(text);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (payload) submitEntry(payload);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <label
        htmlFor="vision-problem"
        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {t('problemLabel')}
      </label>
      <textarea
        id="vision-problem"
        name="vision-problem"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('problemPlaceholder')}
        className={`mt-2 ${TEXTAREA_CLASS}`}
      />
      <div className="mt-4 flex justify-center">
        <button type="submit" disabled={!payload} className={PRIMARY_BUTTON_CLASS}>
          {t('analyze')}
        </button>
      </div>
    </form>
  );
}

const APP_ICON: Record<ApplicationType, { icon: IconName; tone: BadgeTone }> = {
  Measurement: { icon: 'ruler', tone: 'sky' },
  AppearanceInspection: { icon: 'search', tone: 'violet' },
  AIInspection: { icon: 'sparkles', tone: 'emerald' },
  '3D': { icon: 'cube', tone: 'amber' },
  RobotGuidance: { icon: 'robotArm', tone: 'sky' },
  OCR: { icon: 'barcode', tone: 'violet' },
  AssemblyInspection: { icon: 'blocks', tone: 'emerald' },
  Other: { icon: 'more', tone: 'slate' },
};

export function ApplicationCards() {
  const t = useTranslations('home.entry.apps');

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {APPLICATION_SHORTCUT_ORDER.map((type) => {
        const title = t(`${type}.title`);
        const term = t(`${type}.term`);
        return (
          <li key={type}>
            <button
              type="button"
              onClick={() => submitEntry(applicationCardEntry(type))}
              className="flex h-full w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <IconBadge name={APP_ICON[type].icon} tone={APP_ICON[type].tone} className="size-10" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {title}
                </span>
                {/* Tiếng Việt chính, thuật ngữ English dòng nhỏ (spec §0.2). Bản en trùng thì ẩn. */}
                {term !== title ? (
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{term}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
