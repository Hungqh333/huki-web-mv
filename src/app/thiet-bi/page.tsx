import Link from 'next/link';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser';
import { canUseSelector, getSessionContext, isAdmin } from '@/lib/auth';
import { CATALOG_COLUMNS, parseCodes, type CatalogItem } from '@/lib/catalog/catalog';
import { catalogClientMessages } from '@/lib/catalog/clientMessages';
import { contactMailto } from '@/lib/contact';
import { fetchAllRows } from '@/lib/components/fetchAll';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Danh mục thiết bị (chốt 2026-10-27, Q1–Q8): thiết bị ★ thường dùng, lọc theo thông số,
 * xem đủ thông số, chọn để so sánh / xuất Excel.
 *
 * Member trở lên (Q2), như các trang Chọn — kho có giá và nhà cung cấp. RLS của bảng
 * components chặn ở database; khung khoá dưới đây chỉ để hiện lời mời đăng nhập / liên hệ.
 */
export default async function CatalogPage({ searchParams }: PageProps<'/thiet-bi'>) {
  const t = await getTranslations('catalog');
  const tPc = await getTranslations('pcPlanner');
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && canUseSelector(role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{tPc('locked.title')}</h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">{session ? tPc('locked.bodyRegistered') : tPc('locked.bodyGuest')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link href="/dang-nhap" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                {tPc('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - Danh muc thiet bi')}
              className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              {tPc('locked.contact')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const supabase = await createClient();
  // Đọc hết kho theo trang — Supabase trả tối đa 1.000 dòng mỗi lần (fetchAll.ts).
  const { data } = await fetchAllRows((from, to) =>
    supabase.from('components').select(CATALOG_COLUMNS).eq('is_active', true).order('kind').order('sort_order').order('id').range(from, to)
  );
  const items = (data ?? []) as CatalogItem[];
  const [initialCode] = parseCodes((await searchParams).ma as string | undefined, 1);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
      <div className="mt-8">
        <NextIntlClientProvider messages={await catalogClientMessages()}>
          <CatalogBrowser items={items} admin={isAdmin(role)} initialCode={initialCode ?? null} exportPath="/api/thiet-bi/excel" />
        </NextIntlClientProvider>
      </div>
    </section>
  );
}
