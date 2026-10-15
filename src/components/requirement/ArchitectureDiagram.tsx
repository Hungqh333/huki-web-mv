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

  const rulesOf = (id: ArchitectureNodeId) => {
    const node = architecture.nodes.find((n) => n.id === id);
    if (!node) return null;
    return (
      <ul className="w-full space-y-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
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
    );
  };

  return (
    <div>
      {/* Màn rộng: 2 hàng × 4 khối, đọc trái → phải theo chiều tín hiệu (2026-10-15). */}
      <ol className="flex flex-col items-stretch lg:grid lg:grid-cols-4 lg:gap-x-8 lg:gap-y-4">
        {architecture.nodes.map((node, index) => {
          const status = node.status ?? 'info';
          const open = openNode === node.id;
          return (
            <li key={node.id} className="relative flex flex-col items-center lg:h-full lg:items-stretch">
              {index > 0 ? (
                <span aria-hidden="true" className="my-1 text-slate-400 lg:hidden">
                  ↓
                </span>
              ) : null}
              {index % 4 !== 0 ? (
                <span aria-hidden="true" className="absolute top-4 -left-6 hidden text-slate-400 lg:block">
                  →
                </span>
              ) : null}
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenNode(open ? null : node.id)}
                /* Khối cùng hàng cao bằng nhau (lg:flex-1); tên thiết bị đẩy xuống đáy (mt-auto). */
                className={`flex w-full flex-col rounded-xl border-2 px-3 py-2 text-left transition hover:bg-slate-50 lg:flex-1 dark:hover:bg-slate-800/60 ${
                  node.pending ? 'border-dashed border-slate-300 dark:border-slate-700' : BORDER[status]
                } ${open ? 'ring-2 ring-sky-400/60' : ''}`}
              >
                <span className="flex items-center gap-2">
                  {node.pending ? null : <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[status]}`} />}
                  <span className="text-sm font-medium">{t(`nodes.${node.id}`)}</span>
                  {/* Số luật thay cho dãy mã — dãy mã xuống dòng làm khối cao lệch nhau. */}
                  {node.results.length > 0 ? (
                    <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {t('ruleCount', { count: new Set(node.results.map((result) => result.ruleId)).size })}
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
                {/* Khối chờ (PLC chưa chọn giao tiếp) vẫn có câu riêng thì hiện câu đó. Khối đã có
                    thiết bị thật mà không có câu chi tiết thì thôi, không ghi "chưa đủ dữ liệu". */}
                {node.detail || node.pending || node.equipment.length === 0 ? (
                  <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                    {node.detail
                      ? t(`details.${node.detail.key}`, node.detail.values ?? {})
                      : node.pending
                        ? t('pending')
                        : t('noData')}
                  </span>
                ) : null}
                {node.equipment.length > 0 ? (
                  <span className="mt-auto block pt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {node.equipment.map((e) => `${e.qty} × ${[e.brand, e.model].filter(Boolean).join(' ')}`).join(' · ')}
                  </span>
                ) : null}
              </button>

              {/* Màn hẹp: mở ngay dưới khối. Màn rộng: mở ở dải dưới lưới, không chen vào lưới. */}
              {open ? <div className="mt-1 w-full lg:hidden">{rulesOf(node.id)}</div> : null}
            </li>
          );
        })}
      </ol>
      {openNode ? (
        <div className="mt-4 hidden lg:block">
          <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t(`nodes.${openNode}`)}</p>
          {rulesOf(openNode)}
        </div>
      ) : null}
    </div>
  );
}
