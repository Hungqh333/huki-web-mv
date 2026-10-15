import type { ReactNode } from 'react';

/**
 * Thanh tiêu đề dùng chung cho mọi khung (chốt 2026-10-15): nền #E4E5F6 / #22274A,
 * tiêu đề đậm, số liệu tóm tắt chữ mờ cạnh tiêu đề, nút thao tác dồn phải, ghi chú
 * (nếu có) chữ nhỏ mờ ở dòng dưới — ghi chú không được là điểm nhấn.
 *
 * Đặt làm phần tử ĐẦU TIÊN trong khung `rounded-2xl border`; thanh tự bo góc trên.
 */
export function PanelHeader({
  title,
  id,
  meta,
  note,
  actions,
  as: Tag = 'h2',
  standalone = false,
}: {
  /** Thanh đứng riêng (không nằm trong khung) — bo đủ bốn góc, có viền. Dùng làm tiêu đề trang admin. */
  standalone?: boolean;
  title: ReactNode;
  /** Gắn cho aria-labelledby của khung. */
  id?: string;
  /** Số liệu tóm tắt, vd. "4/10 thông số đã có". */
  meta?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div
      className={`${standalone ? 'rounded-2xl border' : 'rounded-t-2xl border-b'} border-slate-200 bg-[#E4E5F6] px-4 py-3 sm:px-5 dark:border-slate-800 dark:bg-[#22274A]`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <Tag id={id} className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
            {title}
          </Tag>
          {meta ? <span className={NOTE_CLASS}>{meta}</span> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {note ? <p className={`mt-1 ${NOTE_CLASS}`}>{note}</p> : null}
    </div>
  );
}

/**
 * Khung đủ bộ: viền + thanh tiêu đề + thân. Dùng khi một mục đang là tiêu đề trơn
 * đặt trên nội dung — bọc lại để mục nào cũng có thanh tiêu đề như nhau.
 */
export function Panel({
  children,
  bodyClassName = 'px-4 py-4 sm:px-5',
  className = '',
  ...header
}: Parameters<typeof PanelHeader>[0] & { children?: ReactNode; bodyClassName?: string; className?: string }) {
  return (
    <section
      aria-labelledby={header.id}
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <PanelHeader {...header} />
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  );
}

/** Chữ ghi chú: nhỏ, xám nhạt, không đậm, không màu — dùng cho mọi ghi chú phụ. */
export const NOTE_CLASS = 'text-xs font-normal text-slate-500 dark:text-slate-400';
