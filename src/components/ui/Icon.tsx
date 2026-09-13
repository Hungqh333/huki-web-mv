/**
 * Bộ icon nét mảnh dùng chung, vẽ bằng SVG nội tuyến.
 *
 * Dự án không kéo thư viện icon về (chỉ cần một nhúm, và tránh thêm phụ thuộc
 * cho một app nội bộ). Tất cả dùng currentColor + stroke nên ăn theo màu chữ của
 * huy hiệu bao ngoài, sáng/tối đều đúng. Thêm icon mới: thêm một entry path ở
 * dưới, không sửa gì khác.
 */

export type IconName =
  | 'handbook'
  | 'selector'
  | 'kpi'
  | 'user'
  | 'shield'
  | 'clock'
  | 'users'
  | 'article'
  | 'rules'
  | 'lock'
  | 'sun'
  | 'moon'
  | 'camera'
  | 'monitor'
  | 'ruler'
  | 'search'
  | 'sparkles'
  | 'cube'
  | 'robotArm'
  | 'barcode'
  | 'blocks'
  | 'more';

const PATHS: Record<IconName, React.ReactNode> = {
  handbook: (
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5V5.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5V5.5Z" />
  ),
  selector: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  kpi: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17 19a6 6 0 0 0-2-4.5" />
    </>
  ),
  article: (
    <>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 17h7" />
    </>
  ),
  rules: (
    <>
      <path d="M4 7h10M4 12h16M4 17h7" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="14" cy="17" r="2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />,
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h6.2l1.2 2h4.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  // Tám icon dưới đây cho thẻ ứng dụng ở trang chủ.
  ruler: (
    <>
      <path d="M3 17.5 17.5 3 21 6.5 6.5 21 3 17.5Z" />
      <path d="M7 13.5l2 2M10 10.5l2 2M13 7.5l2 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5l1.8 4.7 4.7 1.8-4.7 1.8L11 16.5l-1.8-4.7L4.5 10l4.7-1.8L11 3.5Z" />
      <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </>
  ),
  robotArm: (
    <>
      <path d="M5 21h8M9 21v-4" />
      <circle cx="9" cy="15" r="2" />
      <path d="M10.5 13.5l4-4" />
      <circle cx="16" cy="8" r="2" />
      <path d="M17.5 6.5 20 4M18 9.5h3" />
    </>
  ),
  barcode: (
    <>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M8 8v8M11 8v8M14 8v8M16.5 8v8" />
    </>
  ),
  blocks: (
    <>
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1" />
      <rect x="8.25" y="3.5" width="7.5" height="7.5" rx="1" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-6'}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Bảng tông màu cho huy hiệu icon — dùng lại nhất quán khắp app. */
export const BADGE_TONE = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

/** Huy hiệu icon tròn nhiều màu, kiểu trang cài đặt dùng làm mẫu tham chiếu. */
export function IconBadge({
  name,
  tone = 'sky',
  className,
}: {
  name: IconName;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${BADGE_TONE[tone]} ${className ?? ''}`}
    >
      <Icon name={name} />
    </span>
  );
}
