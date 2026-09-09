'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Mục menu xổ xuống.
 *
 * Dùng cho "Bộ chọn thiết bị": bên dưới nó có hai công cụ khác nhau — chọn
 * thiết bị vision theo từng bài toán, và cấu hình máy tính dùng chung cho cả
 * dự án. Để hai thứ này thành hai mục ngang hàng trên menu thì đọc như hai
 * phần rời nhau, trong khi thực tế người dùng đi từ cái trước sang cái sau.
 *
 * CHỈ dùng từ breakpoint sm trở lên. Thanh menu trên điện thoại cuộn ngang
 * (overflow-x-auto), mà overflow theo một trục thì trục còn lại cũng thành
 * auto — panel xổ xuống sẽ bị cắt cụt. Trên mobile Header render hai mục
 * phẳng thay vì gọi component này.
 */

export type NavDropdownItem = {
  href: string;
  label: string;
  description?: string;
};

export function NavDropdown({
  label,
  items,
  className,
}: {
  label: string;
  items: NavDropdownItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  /* Bấm ra ngoài hoặc bấm Esc thì đóng. Đăng ký ở document vì cú bấm có thể
     rơi vào bất cứ đâu trên trang, không riêng gì phần menu. */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && wrapper.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapper} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-slate-600 hover:bg-slate-100 hover:text-sky-700 sm:min-h-0 sm:px-0 sm:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400 dark:sm:hover:bg-transparent"
      >
        {label}
        <span
          aria-hidden="true"
          className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              // Đóng ngay khi bấm: điều hướng phía client không tự làm việc đó.
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="block font-medium text-slate-800 dark:text-slate-100">
                {item.label}
              </span>
              {item.description ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.description}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
