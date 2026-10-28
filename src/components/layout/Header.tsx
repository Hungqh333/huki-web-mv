import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MainNav, SectionNav, type NavGroup } from './MainNav';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { canUseSelector, getSessionContext, isAdmin } from '@/lib/auth';

/*
 * Menu — chốt 2026-10-28 (phương án C, thay menu phẳng 2026-10-27 đã dài 12–14 mục):
 *   Vision Engineer · Cẩm nang · Chỉ tiêu · Danh mục · Gợi ý cấu hình · Chọn thiết bị ▾
 *   · Dự án · Quản trị
 * "Chọn thiết bị" là nhóm các trang chọn MÓN HÀNG theo loại (đi vào BOM); "Gợi ý cấu
 * hình" là bộ chọn theo bài toán /cong-cu-chon-thiet-bi (ra cả bộ camera + đèn + ống).
 * Thêm trang chọn mới: thêm vào equipmentSections, thanh phụ tự có.
 *
 * Ranh giới Công cụ (ra CON SỐ, đứng trước) / Thiết bị (ra MÓN HÀNG, đứng sau) vẫn giữ.
 * Máy tính (PC) là món hàng nên nằm nhóm Chọn thiết bị, dù route là /cong-cu-may-tinh.
 *
 * "Dự án" (V1a mục 7) đứng cuối theo spec và chỉ hiện cho Member trở lên — người
 * khác không lưu được dự án (RLS chặn), hiện ra chỉ để bấm vào bị đẩy đi.
 */
const navBefore = [
  { href: '/', key: 'visionEngineer' },
  { href: '/cam-nang', key: 'knowledge' },
  { href: '/cong-cu-chi-tieu', key: 'kpi' },
  { href: '/thiet-bi', key: 'catalog' },
  { href: '/cong-cu-chon-thiet-bi', key: 'selectorVision' },
] as const;

const equipmentSections = [
  {
    key: 'camera',
    items: [
      { href: '/chon-camera', key: 'camera' },
      { href: '/chon-line-scan', key: 'lineScan' },
      { href: '/chon-doc-ma', key: 'codeReader' },
      { href: '/chon-ocr', key: 'ocr' },
    ],
  },
  {
    key: 'optics',
    items: [
      { href: '/chon-ong-kinh', key: 'lens' },
      { href: '/chon-den', key: 'light' },
    ],
  },
  { key: 'computing', items: [{ href: '/cong-cu-may-tinh', key: 'pc' }] },
] as const;

export async function Header() {
  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  // Chỉ để hiển thị đúng menu. Chặn truy cập thật nằm ở RLS trong database.
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;

  const equipment: NavGroup = {
    label: t('equipment'),
    sections: equipmentSections.map((section) => ({
      title: t(`equipmentGroups.${section.key}`),
      items: section.items.map((item) => ({ href: item.href, label: t(item.key), description: t(`desc.${item.key}`) })),
    })),
  };
  const after = [
    ...(canUseSelector(role) ? [{ href: '/du-an', label: t('projects') }] : []),
    ...(isAdmin(role) ? [{ href: '/admin', label: t('admin') }] : []),
  ];

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-sky-600 text-sm font-bold text-white">
            MV
          </span>
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {tCommon('appName')}
          </span>
        </Link>

        {/* 6–8 mục vẫn không vừa chung hàng với logo + cụm tài khoản admin → thanh menu
            đứng riêng hàng dưới (lg); hẹp hơn thì nút Menu. */}
        <MainNav
          before={navBefore.map((item) => ({ href: item.href, label: t(item.key) }))}
          group={equipment}
          after={after}
          labels={{ open: t('menuOpen'), close: t('menuClose'), navLabel: t('navLabel') }}
        />

        {/*
          flex-wrap là bắt buộc: khi đăng nhập vai admin, cụm này có thêm badge
          vai trò, link Tài khoản và nút Đăng xuất — đo được 375px trên màn hình
          375px, tức tràn ngang nếu không cho xuống dòng.
        */}
        <div className="order-2 ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 lg:order-1">
          <LanguageSwitcher />

          {session ? (
            <>
              {role ? <RoleBadge role={role} /> : null}
              <Link
                href="/tai-khoan"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-slate-700 hover:bg-slate-100 sm:min-h-0 sm:py-1.5 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('account')}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/dang-nhap"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-slate-700 hover:bg-slate-100 sm:min-h-0 sm:py-1.5 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('signIn')}
              </Link>
              <Link
                href="/dang-ky"
                className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700 sm:min-h-0 sm:py-1.5"
              >
                {t('signUp')}
              </Link>
            </>
          )}
        </div>
      </div>
      <SectionNav group={equipment} />
    </header>
  );
}
