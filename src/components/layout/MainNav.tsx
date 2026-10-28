'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
 * Menu trên cùng — chốt 2026-10-28 (phương án C): các trang chọn MÓN HÀNG theo loại
 * (Area scan, Line scan, Đọc mã, OCR, Ống kính, Đèn, Máy tính) gom vào mục xổ
 * "Chọn thiết bị"; khi đang ở một trang trong nhóm, SectionNav hiện thanh phụ để đổi
 * trang một lần bấm. Danh mục và Gợi ý cấu hình đứng thẳng trên thanh.
 *
 * Màn hình rộng (lg): thanh ngang, bảng xổ nổi. Hẹp hơn: nút Menu mở danh sách nằm
 * TRONG dòng chảy của header (không nổi) — thanh cuộn ngang sẽ cắt cụt bảng xổ.
 * Chữ do Header (server) dịch sẵn và truyền xuống.
 */

export type NavLink = { href: string; label: string; description?: string };
export type NavSection = { title: string; items: NavLink[] };
export type NavGroup = { label: string; sections: NavSection[] };

/** '/' chỉ khớp đúng trang chủ; trang khác khớp cả trang con (/chon-den/thuc-nghiem). */
export function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function groupContains(group: NavGroup, pathname: string) {
  return group.sections.some((section) => section.items.some((item) => isActivePath(pathname, item.href)));
}

const linkClass = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${
    active
      ? 'font-medium text-sky-700 dark:text-sky-400'
      : 'text-slate-600 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-400'
  }`;

export function MainNav({
  before,
  group,
  after,
  labels,
}: {
  before: NavLink[];
  group: NavGroup;
  after: NavLink[];
  labels: { open: string; close: string; navLabel: string };
}) {
  const pathname = usePathname();
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const inGroup = groupContains(group, pathname);

  /* Bấm ra ngoài hoặc Esc thì đóng bảng xổ (đăng ký ở document vì cú bấm rơi đâu cũng được). */
  useEffect(() => {
    if (!panelOpen && !mobileOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      setPanelOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPanelOpen(false);
      setMobileOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panelOpen, mobileOpen]);

  // Điều hướng phía client không tự đóng menu — đóng ngay khi bấm link.
  const close = () => {
    setPanelOpen(false);
    setMobileOpen(false);
  };

  const renderLink = (item: NavLink) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} onClick={close} className={linkClass(active)}>
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {/* Nút Menu (dưới lg) đứng cùng hàng logo; cụm tài khoản xuống hàng dưới. */}
      <button
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        aria-expanded={mobileOpen}
        aria-controls="main-nav-mobile"
        className="order-1 ml-auto inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 lg:hidden dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {mobileOpen ? '✕' : '☰'}
        </span>
        {mobileOpen ? labels.close : labels.open}
      </button>

      <nav aria-label={labels.navLabel} className="order-3 hidden w-full items-center gap-6 text-sm lg:flex">
        {before.map(renderLink)}
        <div ref={panel} className="relative">
          <button
            type="button"
            onClick={() => setPanelOpen((current) => !current)}
            aria-expanded={panelOpen}
            aria-haspopup="true"
            className={linkClass(inGroup)}
          >
            {group.label}
            {/* Vẽ bằng SVG: ký tự ▼ ở font Be Vietnam Pro hiện lệch hướng. */}
            <svg aria-hidden="true" viewBox="0 0 12 12" className={`size-3 transition-transform ${panelOpen ? 'rotate-180' : ''}`}>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {panelOpen ? (
            // Canh giữa dưới nút: canh trái thì tràn mép phải ở 1024 px.
            <div className="absolute left-1/2 top-full z-30 mt-3 grid -translate-x-1/2 w-[560px] grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {group.sections.map((section) => (
                <div key={section.title} className={section.items.length > 2 ? 'row-span-2' : ''}>
                  <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{section.title}</p>
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={close}
                        className={`block rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${active ? 'bg-sky-50 dark:bg-sky-950/40' : ''}`}
                      >
                        <span className={`block font-medium ${active ? 'text-sky-700 dark:text-sky-400' : 'text-slate-800 dark:text-slate-100'}`}>{item.label}</span>
                        {item.description ? (
                          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {after.map(renderLink)}
      </nav>

      {mobileOpen ? (
        <nav id="main-nav-mobile" aria-label={labels.navLabel} className="order-4 w-full border-t border-slate-200 pt-2 text-sm lg:hidden dark:border-slate-800">
          <MobileList items={before} pathname={pathname} onNavigate={close} />
          <p className="mt-3 px-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.label}</p>
          {group.sections.map((section) => (
            <div key={section.title} className="mt-1">
              <p className="px-2 pt-1 text-xs text-slate-400 dark:text-slate-500">{section.title}</p>
              <MobileList items={section.items} pathname={pathname} onNavigate={close} />
            </div>
          ))}
          {after.length > 0 ? (
            <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
              <MobileList items={after} pathname={pathname} onNavigate={close} />
            </div>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

function MobileList({ items, pathname, onNavigate }: { items: NavLink[]; pathname: string; onNavigate: () => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-2 sm:grid-cols-3">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={`flex min-h-11 items-center rounded-md px-2 ${
                active
                  ? 'bg-sky-50 font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Thanh phụ dưới header — chỉ hiện khi đang ở một trang trong nhóm Chọn thiết bị. */
export function SectionNav({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const bar = useRef<HTMLElement>(null);
  const visible = groupContains(group, pathname);

  // Điện thoại: thanh cuộn ngang — kéo nút đang mở vào giữa (chỉ cuộn ngang, không cuộn trang).
  useEffect(() => {
    const container = bar.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !active) return;
    container.scrollLeft = active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  if (!visible) return null;
  const items = group.sections.flatMap((section) => section.items);
  return (
    <div className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <nav ref={bar} aria-label={group.label} className="relative mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-2 text-sm sm:px-6">
        <span className="mr-1 shrink-0 text-xs text-slate-500 dark:text-slate-400">{group.label}</span>
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 ${
                active
                  ? 'border-sky-300 bg-sky-100 font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-sky-400'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
