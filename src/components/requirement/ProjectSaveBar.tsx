'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { saveProjectAction, startNextRevisionAction, type ProjectActionResult } from '@/app/actions/projects';
import { parseDraft, type RequirementDraft } from '@/lib/requirement/draft';
import { readDraftRaw, subscribeDraft, writeDraft } from '@/lib/requirement/draftStore';
import { PROJECTS_ROUTE, PROJECT_NAME_MAX, draftFingerprint } from '@/lib/projects/model';
import { ExportLinks } from '@/components/projects/ExportLinks';

/**
 * Thanh "Lưu dự án" trên bước Yêu cầu (V1a hạng mục 7).
 *
 * Đọc cùng kho bản nháp với bảng tóm tắt (sessionStorage), nên sửa trên bảng là
 * thanh này biết ngay có thay đổi chưa lưu. Ba trạng thái:
 * - chưa gắn dự án  → nhập tên, "Lưu thành dự án" (tạo Rev A)
 * - revision đang sửa → "Lưu Rev X", "Tạo revision mới" (khoá X, mở revision kế)
 * - revision đã khoá  → chỉ xem
 */

// Cùng class với ô nhập trong Field.tsx.
const INPUT_CLASS =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

type Message = { tone: 'ok' | 'error'; text: string };

export function ProjectSaveBar({ canExportPdf = false }: { canExportPdf?: boolean }) {
  const t = useTranslations('projects.save');
  const raw = useSyncExternalStore(subscribeDraft, readDraftRaw, () => null);
  const draft = useMemo(() => parseDraft(raw), [raw]);
  const link = draft?.project ?? null;

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);
  const [confirmNext, setConfirmNext] = useState(false);
  // Ô tên gắn với dự án đang mở: đổi dự án (hoặc vừa tạo) thì lấy lại tên từ liên kết.
  const linkKey = link?.id ?? 'new';
  const [typedName, setTypedName] = useState<{ key: string; value: string } | null>(null);
  const name = typedName?.key === linkKey ? typedName.value : (link?.name ?? '');

  if (!draft?.requirement) return null;

  const dirty = link ? draftFingerprint(draft) !== link.savedFingerprint || name.trim() !== link.name : true;
  const nameMissing = name.trim() === '';

  const run = (kind: 'save' | 'next') => {
    const sent: RequirementDraft = draft;
    setMessage(null);
    startTransition(async () => {
      const input = { draftJson: JSON.stringify(sent), name };
      const result: ProjectActionResult =
        kind === 'save' ? await saveProjectAction(input) : await startNextRevisionAction(input);

      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error });
        return;
      }

      /* Người dùng có thể sửa tiếp trong lúc chờ: gắn liên kết vào bản nháp MỚI
         NHẤT, nhưng dấu vân tay là của nội dung ĐÃ GỬI — phần sửa thêm vẫn hiện
         "chưa lưu". Bản nháp đã bị thay bằng bài toán khác thì không gắn. */
      const latest = parseDraft(readDraftRaw()) ?? sent;
      if (latest.startedFrom === sent.startedFrom) {
        writeDraft({
          ...latest,
          project: { ...result.project, locked: false, savedFingerprint: draftFingerprint(sent) },
        });
      }
      setTypedName({ key: result.project.id, value: result.project.name });
      setConfirmNext(false);
      setMessage({
        tone: 'ok',
        text:
          kind === 'next'
            ? t('revisionCreated', { locked: result.lockedLabel ?? '', label: result.project.revLabel })
            : link
              ? t('saved', { label: result.project.revLabel })
              : t('created', { label: result.project.revLabel }),
      });
    });
  };

  const status = link ? (link.locked ? t('lockedNote', { label: link.revLabel }) : dirty ? t('unsaved') : t('upToDate')) : t('hint');

  return (
    <section
      aria-labelledby="project-save-title"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="project-save-title" className="text-sm font-semibold">
            {link ? t('linked', { name: link.name, label: link.revLabel }) : t('title')}
          </h2>
          <p
            className={`mt-1 text-xs ${
              link && !link.locked && dirty ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {status}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {link ? (
            <Link href={`${PROJECTS_ROUTE}/${link.id}`} className="text-sky-700 hover:underline dark:text-sky-400">
              {t('openProject')}
            </Link>
          ) : null}
          <Link href={PROJECTS_ROUTE} className="text-sky-700 hover:underline dark:text-sky-400">
            {t('allProjects')}
          </Link>
        </div>
      </div>

      {link?.locked ? null : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block w-full min-w-0 text-xs text-slate-600 sm:w-80 dark:text-slate-400">
            <span className="mb-1 block">{t('nameLabel')}</span>
            <input
              type="text"
              value={name}
              maxLength={PROJECT_NAME_MAX}
              onChange={(event) => setTypedName({ key: linkKey, value: event.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <button
            type="button"
            disabled={pending || nameMissing || (link !== null && !dirty)}
            onClick={() => run('save')}
            className="inline-flex min-h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t('saving') : link ? t('save', { label: link.revLabel }) : t('create')}
          </button>

          {link ? (
            confirmNext ? (
              <>
                <button
                  type="button"
                  disabled={pending || nameMissing}
                  onClick={() => run('next')}
                  className="inline-flex min-h-10 items-center rounded-lg bg-amber-600 px-4 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('confirmNewRevision', { label: link.revLabel })}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmNext(false)}
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t('cancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmNext(true)}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('newRevision')}
              </button>
            )
          ) : null}
        </div>
      )}

      {confirmNext && link && !link.locked ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('confirmHint', { label: link.revLabel })}</p>
      ) : null}

      {link ? (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <ExportLinks projectId={link.id} revisionId={link.revisionId} canPdf={canExportPdf} unsaved={dirty} hasBom={Boolean(draft?.bom)} />
        </div>
      ) : null}

      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-sm ${
            message.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
