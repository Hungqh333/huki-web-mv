'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { REQUIREMENT_ROUTE, parseDraft } from '@/lib/requirement/draft';
import { readDraftRaw, writeDraft } from '@/lib/requirement/draftStore';
import { draftFingerprint } from '@/lib/projects/model';

/**
 * Mở một revision trên bảng tóm tắt: nạp vào bản nháp của tab rồi chuyển trang.
 *
 * Bản nháp đang mở có nội dung chưa lưu (chưa gắn dự án, hoặc khác lần lưu gần
 * nhất) thì hỏi trước — mở revision sẽ thay nó.
 */
export function OpenRevisionButton({ draftJson, label }: { draftJson: string; label: string }) {
  const t = useTranslations('projects.detail');
  const router = useRouter();

  const open = () => {
    const next = parseDraft(draftJson);
    if (!next) return;

    const current = parseDraft(readDraftRaw());
    const unsaved =
      current?.requirement &&
      current.startedFrom !== next.startedFrom &&
      (!current.project || draftFingerprint(current) !== current.project.savedFingerprint);
    if (unsaved && !window.confirm(t('replaceDraft'))) return;

    writeDraft(next);
    router.push(REQUIREMENT_ROUTE);
  };

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-sky-500 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}
