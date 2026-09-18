'use client';

import { createContext, useContext, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { knowledgeStatus, type KnowledgeIndex } from '@/lib/knowledge';

/**
 * "📄 Tài liệu" / "Chưa có tài liệu · [Viết bài]" cạnh một mã luật — V1c C8
 * (spec §12.7). Chỉ mục nạp một lần ở server, phát qua context để khối Phân
 * tích và khối Vì sao chọn? không phải truyền prop qua nhiều tầng.
 * Không có provider (trang /dev, test) thì không hiện gì.
 */

const KnowledgeContext = createContext<KnowledgeIndex | null>(null);

export function KnowledgeProvider({ index, children }: { index: KnowledgeIndex | null; children: ReactNode }) {
  return <KnowledgeContext.Provider value={index}>{children}</KnowledgeContext.Provider>;
}

export function KnowledgeLink({ ruleId }: { ruleId: string }) {
  const index = useContext(KnowledgeContext);
  const t = useTranslations('knowledge');
  if (!index) return null;

  const status = knowledgeStatus(index, ruleId);
  const link = 'text-xs font-medium text-sky-700 hover:underline dark:text-sky-400';
  if (status.kind === 'published') {
    return (
      <Link href={status.href} className={link} title={t('docTitle', { rule: ruleId })}>
        📄 {t('doc')}
      </Link>
    );
  }
  if (status.kind === 'draft') {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        📄 {t('draft')} ·{' '}
        <Link href={status.href} className={link}>
          {t('editDraft')}
        </Link>
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-400 dark:text-slate-500">
      📄 {t('missing')}
      {status.writeHref ? (
        <>
          {' · '}
          <Link href={status.writeHref} className={link}>
            {t('write')}
          </Link>
        </>
      ) : null}
    </span>
  );
}
