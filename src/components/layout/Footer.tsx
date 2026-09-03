import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('footer');
  const tNav = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {tCommon('appName')}
          </p>
          <p className="mt-2 max-w-xs text-sm text-slate-600 dark:text-slate-400">
            {t('description')}
          </p>
        </div>

        <nav className="text-sm">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {t('sections.product')}
          </p>
          <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>
              <Link href="/cong-cu-chon-thiet-bi" className="hover:text-sky-700 dark:hover:text-sky-400">
                {tNav('selector')}
              </Link>
            </li>
            <li>
              <Link href="/cam-nang" className="hover:text-sky-700 dark:hover:text-sky-400">
                {tNav('handbook')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav className="text-sm">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {t('sections.resources')}
          </p>
          <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>
              <Link href="/tai-khoan" className="hover:text-sky-700 dark:hover:text-sky-400">
                {tNav('account')}
              </Link>
            </li>
            <li>
              <Link href="/dang-nhap" className="hover:text-sky-700 dark:hover:text-sky-400">
                {tNav('signIn')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 sm:px-6 dark:border-slate-800 dark:text-slate-400">
        © {new Date().getFullYear()} {tCommon('appName')} — {t('rights')}
      </div>
    </footer>
  );
}
