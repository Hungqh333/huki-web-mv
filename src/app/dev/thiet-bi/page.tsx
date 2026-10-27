import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { catalogClientMessages } from '@/lib/catalog/clientMessages';
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser';
import { parseCodes } from '@/lib/catalog/catalog';
import { devCatalog } from '@/lib/catalog/devCatalog';

/**
 * Xem trước Danh mục thiết bị — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập. Kho từ seed,
 * 3 món đầu mỗi loại ★ MẪU; bấm ★ chỉ đổi trên màn hình (không ghi database). ?vai=member
 * xem như Member (không có nút ★). Trang thật /thiet-bi nằm sau cổng Member, đọc kho thật.
 */
export default async function DevCatalogPage({ searchParams }: PageProps<'/dev/thiet-bi'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const member = params.vai === 'member';
  const [initialCode] = parseCodes(params.ma as string | undefined, 1);
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, kho từ seed (không phải kho thật), ★ là MẪU và không lưu.
      </p>
      <p className="-mt-4 mb-6 text-xs text-slate-500 dark:text-slate-400">
        {member ? 'Đang xem như Member: không có nút ★. ' : 'Đang xem như admin: bấm ★ để đánh dấu. '}
        <a href={member ? '?' : '?vai=member'} className="text-sky-700 hover:underline dark:text-sky-400">
          {member ? 'Xem như admin' : 'Xem như Member'}
        </a>
      </p>
      <NextIntlClientProvider messages={await catalogClientMessages()}>
        <CatalogBrowser items={devCatalog()} admin={!member} persistStar={false} initialCode={initialCode ?? null} exportPath="/api/thiet-bi/excel?dev=1" />
      </NextIntlClientProvider>
    </section>
  );
}
