import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { getSessionContext, isAdmin } from '@/lib/auth';

const navItems = [
  { href: '/cam-nang', key: 'handbook' },
  { href: '/cong-cu-chon-thiet-bi', key: 'selector' },
  { href: '/cong-cu-may-tinh', key: 'pc' },
  { href: '/cong-cu-chi-tieu', key: 'kpi' },
] as const;

export async function Header() {
  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  // Chỉ để hiển thị đúng menu. Chặn truy cập thật nằm ở RLS trong database.
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;

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

        <nav className="order-3 -mx-4 flex w-full items-center gap-1 overflow-x-auto px-2 text-sm sm:order-none sm:mx-0 sm:w-auto sm:gap-4 sm:overflow-visible sm:px-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-slate-600 hover:bg-slate-100 hover:text-sky-700 sm:min-h-0 sm:px-0 sm:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400 dark:sm:hover:bg-transparent"
            >
              {t(item.key)}
            </Link>
          ))}
          {isAdmin(role) ? (
            <Link
              href="/admin"
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-slate-600 hover:bg-slate-100 hover:text-sky-700 sm:min-h-0 sm:px-0 sm:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400 dark:sm:hover:bg-transparent"
            >
              {t('admin')}
            </Link>
          ) : null}
        </nav>

        {/*
          flex-wrap là bắt buộc: khi đăng nhập vai admin, cụm này có thêm badge
          vai trò, link Tài khoản và nút Đăng xuất — đo được 375px trên màn hình
          375px, tức tràn ngang nếu không cho xuống dòng.
        */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
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
    </header>
  );
}
