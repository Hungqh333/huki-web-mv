/**
 * Biểu tượng nhỏ cho nút PC Vision (chốt 2026-11-07: nút Copy / Sửa dùng hình, không chữ).
 * Nét theo màu chữ (currentColor), 16px; chữ của nút đặt ở title + aria-label.
 */

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'size-4',
};

export function CopyIcon() {
  return (
    <svg {...BASE}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...BASE}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg {...BASE}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg {...BASE}>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

/** Nút vuông chỉ có hình; `label` là chữ hiện khi rê chuột và cho trình đọc màn hình. */
export const ICON_BUTTON_BASE = 'inline-flex size-7 shrink-0 items-center justify-center rounded border';
export const ICON_BUTTON_NEUTRAL =
  'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800';
export const ICON_BUTTON = `${ICON_BUTTON_BASE} ${ICON_BUTTON_NEUTRAL}`;
