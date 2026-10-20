'use client';

import { useEffect } from 'react';

/**
 * Nút "Mở tất cả / Thu gọn tất cả" của Sổ tay công thức + tự mở phần đang được trỏ tới
 * (mục lục, link #OPT-005). KHÔNG chứa công thức nào — chỉ bật tắt thẻ <details> do
 * máy chủ render, nên nội dung sổ tay vẫn không có trong JavaScript gửi xuống trình duyệt.
 */

const SELECTOR = 'details[data-formula-section]';

function openForHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement) node.open = true;
  }
  target.scrollIntoView({ block: 'start' });
}

export function FormulaBookControls({ expandLabel, collapseLabel }: { expandLabel: string; collapseLabel: string }) {
  useEffect(() => {
    openForHash();
    window.addEventListener('hashchange', openForHash);
    return () => window.removeEventListener('hashchange', openForHash);
  }, []);

  const setAll = (open: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>(SELECTOR).forEach((el) => {
      el.open = open;
    });
  };

  const button =
    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <div className="flex gap-2">
      <button type="button" className={button} onClick={() => setAll(true)}>
        {expandLabel}
      </button>
      <button type="button" className={button} onClick={() => setAll(false)}>
        {collapseLabel}
      </button>
    </div>
  );
}
