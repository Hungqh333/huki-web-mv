'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';
import { draftAtRisk } from '@/lib/projects/model';
import { V1A_FULL_SUPPORT } from '@/lib/requirement/fields';
import {
  REQUIREMENT_ROUTE,
  parseDraft,
  requirementHrefFor,
  startDraftFromApp,
  startDraftFromText,
} from '@/lib/requirement/draft';
import { readDraftRaw, writeDraft } from '@/lib/requirement/draftStore';
import {
  APPLICATION_SHORTCUT_ORDER,
  applicationCardEntry,
  freeTextEntry,
  type ApplicationType,
  type VisionEntryPayload,
} from '@/lib/visionEntry';

/**
 * Hai cửa vào Vision Engineer ở trang chủ: ô mô tả bài toán và 8 thẻ ứng dụng.
 * Cả hai mở CÙNG một luồng — bảng tóm tắt yêu cầu (spec §10.1). Bộ chọn thiết bị
 * cũ vào từ menu Thiết bị, không từ trang chủ.
 *
 * Chưa có parser (V1a hạng mục 3). Ô nhập lưu văn bản vào bản nháp
 * (sessionStorage, không qua URL) rồi mở bảng tóm tắt; thẻ truyền loại qua `?app=`.
 * Mở cửa nào cũng THAY bản nháp đang có trong tab, nên hỏi trước nếu bản nháp đó
 * còn nội dung chưa lưu (draftAtRisk).
 * Cả hai vẫn ghi VisionEntryPayload ra console — đúng shape bước sau sẽ nhận.
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
  const router = useRouter();
  const [text, setText] = useState('');
  const payload = freeTextEntry(text);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payload?.rawText) return;
    const next = startDraftFromText(payload.rawText);
    if (draftAtRisk(parseDraft(readDraftRaw()), next.startedFrom) && !window.confirm(t('replaceDraft'))) return;
    submitEntry(payload);
    writeDraft(next);
    router.push(REQUIREMENT_ROUTE);
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

const CARD_CLASS =
  'flex h-full w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40';
const CARD_READY_CLASS =
  'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700';

export function ApplicationCards() {
  const t = useTranslations('home.entry.apps');
  const tEntry = useTranslations('home.entry');

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {APPLICATION_SHORTCUT_ORDER.map((type) => {
        const title = t(`${type}.title`);
        const term = t(`${type}.term`);
        const payload = applicationCardEntry(type);
        // V1 chỉ làm đủ ngoại quan + đo lường; loại khác vẫn vào bảng, chỉ có phần chung.
        const partial = !V1A_FULL_SUPPORT.includes(type);

        return (
          <li key={type}>
            <Link
              href={requirementHrefFor(type)}
              onClick={(event) => {
                const next = startDraftFromApp(type).startedFrom;
                if (draftAtRisk(parseDraft(readDraftRaw()), next) && !window.confirm(tEntry('replaceDraft'))) {
                  event.preventDefault();
                  return;
                }
                submitEntry(payload);
              }}
              className={`${CARD_CLASS} ${CARD_READY_CLASS}`}
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
                {partial ? (
                  <span className="mt-1.5 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {tEntry('partialSupport')}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
