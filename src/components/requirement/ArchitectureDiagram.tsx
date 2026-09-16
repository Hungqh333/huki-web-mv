'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Architecture, ArchitectureNodeId } from '@/lib/vision/architecture';
import type { RuleResult } from '@/lib/vision/rules';
import type { CheckStatus } from '@/lib/vision/types';

/**
 * Sơ đồ hệ thống dạng thẻ nối dọc — spec V1.1 §9, UI_CONTENT màn 6.
 *
 * Không animation, không thư viện vẽ: một cột thẻ và mũi tên. Bấm thẻ thì mở
 * danh sách luật đã quyết định khối đó. Thẻ có cảnh báo mang viền màu, để nhìn
 * lướt là thấy khối nào đang có chuyện.
 */

const BORDER: Record<CheckStatus, string> = {
  fail: 'border-red-400 dark:border-red-700',
  warn: 'border-amber-400 dark:border-amber-700',
  pass: 'border-emerald-400 dark:border-emerald-700',
  info: 'border-slate-200 dark:border-slate-700',
};

const DOT: Record<CheckStatus, string> = {
  fail: 'bg-red-500',
  warn: 'bg-amber-500',
  pass: 'bg-emerald-500',
  info: 'bg-slate-300 dark:bg-slate-600',
};

export function ArchitectureDiagram({
  architecture,
  noteOf,
}: {
  architecture: Architecture;
  noteOf: (result: RuleResult) => string | null;
}) {
  const t = useTranslations('designer.requirement.architecture');
  const tv = useTranslations('selector.vision');
  const [openNode, setOpenNode] = useState<ArchitectureNodeId | null>(null);

  // Nhiều camera thì vẽ số ô camera thật (tối đa 8), quá thì ghi "N ×".
  const count = architecture.cameraCount;
  const cameraBoxes = count !== null && count > 1 && count <= 8 ? count : 0;

  return (
    <div>
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('hint')}</p>

      <ol className="mt-3 flex flex-col items-stretch">
        {architecture.nodes.map((node, index) => {
          const status = node.status ?? 'info';
          const open = openNode === node.id;
          return (
            <li key={node.id} className="flex flex-col items-center">
              {index > 0 ? (
                <span aria-hidden="true" className="my-1 text-slate-400">
                  ↓
                </span>
              ) : null}
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenNode(open ? null : node.id)}
                className={`w-full rounded-xl border-2 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  node.pending ? 'border-dashed border-slate-300 dark:border-slate-700' : BORDER[status]
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  {node.pending ? null : <span aria-hidden="true" className={`size-2 rounded-full ${DOT[status]}`} />}
                  <span className="text-sm font-medium">{t(`nodes.${node.id}`)}</span>
                  {node.results.length > 0 ? (
                    <span className="ml-auto font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {[...new Set(node.results.map((result) => result.ruleId))].join(' · ')}
                    </span>
                  ) : null}
                </span>
                {node.id === 'camera' && cameraBoxes > 0 ? (
                  <span className="mt-1.5 flex flex-wrap gap-1" aria-hidden="true">
                    {Array.from({ length: cameraBoxes }, (_, i) => (
                      <span key={i} className="rounded border border-slate-300 px-1.5 text-[10px] text-slate-500 dark:border-slate-600">
                        CAM {i + 1}
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                  {node.pending
                    ? t('pending')
                    : node.detail
                      ? t(`details.${node.detail.key}`, node.detail.values ?? {})
                      : t('noData')}
                </span>
              </button>

              {open ? (
                <ul className="mt-1 w-full space-y-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  {node.results.length === 0 ? (
                    <li className="text-xs text-slate-500 dark:text-slate-400">{node.pending ? t('pendingDetail') : t('noRules')}</li>
                  ) : (
                    node.results.map((result) => (
                      <li key={`${result.ruleId}-${result.key}`} className="text-xs leading-relaxed">
                        <span className={`mr-1.5 inline-block size-2 rounded-full ${DOT[result.status]}`} aria-hidden="true" />
                        <span className="font-mono text-slate-500 dark:text-slate-400">{result.ruleId}</span>{' '}
                        <span className="font-medium">{tv(`checks.${result.key}`)}</span>
                        {noteOf(result) ? <span className="text-slate-600 dark:text-slate-400"> — {noteOf(result)}</span> : null}
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
