'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { PcConfig, PcFrame } from '@/lib/pc/code';
import { pcSpecRow } from '@/lib/pc/specSheet';
import { CheckIcon, CopyIcon, CrossIcon, ICON_BUTTON_BASE, ICON_BUTTON_NEUTRAL } from './icons';

/** Copy bằng document.execCommand('copy') + sự kiện copy: chạy được cả khi Clipboard API bị chặn. */
function copyByEvent(plain: string, html: string): boolean {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData('text/plain', plain);
    e.clipboardData?.setData('text/html', html);
    e.preventDefault();
  };
  document.addEventListener('copy', onCopy);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.removeEventListener('copy', onCopy);
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Ô chữ thường dạng tab: có xuống dòng hoặc ngoặc kép thì bọc ngoặc kép để Excel giữ trong 1 ô. */
const tsvCell = (s: string) => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * Nút "Copy thông số" — một dòng list thiết bị theo form PC gốc (chốt 2026-11-07):
 * Tên vật tư · Loại vật tư (mã đầy đủ) · Maker · Thông số kỹ thuật (tiếng Anh, nhiều dòng trong 1 ô).
 * Ghi cả HTML (Excel / Word giữ đúng 4 ô, xuống dòng trong ô) lẫn chữ thường dạng tab.
 */
export function PcCopyButton({ frame, config }: { frame: PcFrame; config: PcConfig }) {
  const t = useTranslations('pcVision.copy');
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    const row = pcSpecRow(frame, config);
    const cells = [row.name, row.model, row.maker, row.spec];
    const plain = cells.map(tsvCell).join('\t');
    const html =
      '<table><tr>' +
      cells.map((c) => `<td>${c.split('\n').map(escapeHtml).join('<br style="mso-data-placement:same-cell" />')}</td>`).join('') +
      '</tr></table>';
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('no async clipboard');
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      setState('done');
    } catch {
      // Trình duyệt chặn Clipboard API (khung nhúng, http, quyền) → cách cũ qua sự kiện copy, vẫn ghi đủ 2 dạng.
      setState(copyByEvent(plain, html) ? 'done' : 'failed');
    }
  };

  // Chỉ có hình (chốt 2026-11-07); chữ ở title + aria-label. Copy xong: dấu tích xanh ~2 giây.
  const label = t(state === 'done' ? 'done' : state === 'failed' ? 'failed' : 'button');
  return (
    <button
      type="button"
      onClick={copy}
      title={state === 'idle' ? `${label} — ${t('title')}` : label}
      aria-label={label}
      className={`${ICON_BUTTON_BASE} ${
        state === 'done'
          ? 'border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-300'
          : state === 'failed'
            ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-300'
            : ICON_BUTTON_NEUTRAL
      }`}
    >
      {state === 'done' ? <CheckIcon /> : state === 'failed' ? <CrossIcon /> : <CopyIcon />}
    </button>
  );
}
