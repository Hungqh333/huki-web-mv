'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Menu bên trái của khu quản trị.
 *
 * Phải là client component vì cần biết đường dẫn hiện tại: trước đây bốn mục
 * trông y hệt nhau ở mọi trang, mở /admin/chi-tieu vẫn không có gì cho biết
 * mình đang ở mục nào — trên điện thoại menu còn cuộn ngang nên mục đang xem
 * có thể nằm ngoài màn hình.
 */
export function AdminNav({
  items,
  label,
}: {
  items: { href: string; label: string }[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
    >
      {items.map((item) => {
        // Trang con (/admin/chi-tieu/he-so) vẫn phải sáng mục cha.
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
                : 'inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
