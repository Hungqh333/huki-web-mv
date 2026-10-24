import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Nút / link có mũi tên dùng chung toàn site (2026-10-24, Hùng: "nút dạng mũi tên hơi xấu").
 * Thay ký tự → ← ↗ gõ trong chữ bằng icon SVG: cùng nét, cùng cỡ, mũi tên nhích theo hướng đi
 * khi rê chuột. Không có hook — dùng được cả trong trang máy chủ lẫn component client.
 *
 *   primary  nút chính, nền xanh            soft  nút phụ, nền xanh nhạt, viền
 *   text     link chữ trong đoạn / cuối thẻ  back  "quay lại" dạng viên thuốc
 *
 * `external` mở tab mới, icon ô vuông có mũi tên chéo. Link trong trang (#…) và link ngoài dùng
 * thẻ <a>; còn lại dùng next/link.
 */

export type ActionVariant = 'primary' | 'soft' | 'text' | 'back';

const BASE: Record<ActionVariant, string> = {
  primary:
    'inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600',
  soft: 'inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-700 dark:hover:bg-sky-950',
  text: 'inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 transition hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300',
  back: 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300',
};

/** Ô tròn nhỏ quanh mũi tên của nút primary / soft — làm mũi tên thành một "nút" rõ ràng. */
const BUBBLE: Record<ActionVariant, string> = {
  primary: 'inline-flex size-5 items-center justify-center rounded-full bg-white/20',
  soft: 'inline-flex size-5 items-center justify-center rounded-full bg-sky-600 text-white dark:bg-sky-500',
  text: 'inline-flex',
  back: 'inline-flex',
};

function Arrow({ variant, kind }: { variant: ActionVariant; kind: 'next' | 'back' | 'external' }) {
  const move = kind === 'back' ? 'group-hover:-translate-x-0.5' : kind === 'external' ? 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5' : 'group-hover:translate-x-0.5';
  const size = variant === 'primary' || variant === 'soft' ? 'size-3.5' : 'size-4';
  return (
    <span className={`${BUBBLE[variant]} shrink-0`}>
      <Icon name={kind === 'back' ? 'arrowLeft' : kind === 'external' ? 'external' : 'arrowRight'} className={`${size} transition-transform ${move}`} />
    </span>
  );
}

export function ActionLink({
  href,
  children,
  variant = 'soft',
  external = false,
  download,
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: ActionVariant;
  /** Mở tab mới (trang ngoài). */
  external?: boolean;
  /** Link tải file — không có mũi tên đi tiếp. */
  download?: boolean;
  className?: string;
}) {
  const kind = variant === 'back' ? 'back' : external ? 'external' : 'next';
  const body = (
    <>
      {kind === 'back' ? <Arrow variant={variant} kind="back" /> : null}
      <span>{children}</span>
      {kind !== 'back' && !download ? <Arrow variant={variant} kind={kind} /> : null}
    </>
  );
  const cls = `group ${BASE[variant]} ${className}`;
  if (external || download || href.startsWith('#')) {
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

/** Chữ + mũi tên cuối một thẻ đã là link (không lồng link trong link). Thẻ cha cần class `group`. */
export function ActionCue({ children }: { children: ReactNode }) {
  return (
    <span className={BASE.text}>
      {children}
      <Arrow variant="text" kind="next" />
    </span>
  );
}

/** Icon "mở tab mới" đặt sau chữ của một link sẵn có (danh sách tài liệu tham khảo, datasheet). */
export function ExternalMark() {
  return <Icon name="external" className="ml-1 inline size-3.5 -translate-y-px align-middle" />;
}
