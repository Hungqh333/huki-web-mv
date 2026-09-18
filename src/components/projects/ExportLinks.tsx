'use client';

import { useTranslations } from 'next-intl';

/**
 * Nút xuất BOM Excel / Concept Report PDF của một revision ĐÃ LƯU (V1c C6).
 *
 * Link thường tới route API, không gọi fetch: trình duyệt tự tải file, cookie
 * phiên đăng nhập đi kèm, và route đọc lại revision từ database theo quyền.
 * Còn thay đổi chưa lưu thì khoá nút — file phải khớp thứ đang lưu.
 */
export function ExportLinks({
  projectId,
  revisionId,
  canPdf,
  unsaved,
  hasBom,
}: {
  projectId: string;
  revisionId: string;
  /** VIP trở lên (chốt Q5). */
  canPdf: boolean;
  unsaved: boolean;
  hasBom: boolean;
}) {
  const t = useTranslations('export.ui');
  const base = `/api/du-an/${projectId}/${revisionId}`;
  const link = 'rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
  const off = 'rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-800';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('title')}:</span>
      {unsaved ? (
        <span className="text-xs text-amber-700 dark:text-amber-400">{t('saveFirst')}</span>
      ) : (
        <>
          <a href={`${base}/bom`} download className={link}>
            {t('excel')}
          </a>
          {canPdf ? (
            <a href={`${base}/bao-cao`} download className={link}>
              {t('pdf')}
            </a>
          ) : (
            <span className={off} title={t('pdfVip')}>
              {t('pdf')}
            </span>
          )}
          {!hasBom ? <span className="text-xs text-slate-500 dark:text-slate-400">{t('noBomHint')}</span> : null}
        </>
      )}
    </div>
  );
}
