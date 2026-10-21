import { notFound } from 'next/navigation';
import { LensSelector } from '@/components/lens/LensSelector';
import { FormulaVisibilityProvider } from '@/components/ui/FormulaVisibility';
import { seedCatalog } from '@/lib/devSeedCatalog';

/**
 * Xem trước Bộ chọn ống kính — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập, kho
 * mẫu đọc từ supabase/seed_components.sql (ít ống). Trang thật /chon-ong-kinh
 * nằm sau cổng Member và đọc kho thật.
 */
export default async function DevLensSelectorPage({ searchParams }: PageProps<'/dev/chon-ong-kinh'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?cong-thuc=an — xem như người không phải admin (bảo vệ công thức, 2026-10-21).
  const hide = (await searchParams)['cong-thuc'] === 'an';
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, kho mẫu từ seed (không phải kho thật).
      </p>
      <p className="mb-6 -mt-4 text-xs text-slate-500 dark:text-slate-400">
        {hide ? 'Đang xem như Member: công thức ẩn. ' : 'Đang xem như admin: có công thức. '}
        <a href={hide ? '?' : '?cong-thuc=an'} className="text-sky-700 hover:underline dark:text-sky-400">
          {hide ? 'Hiện công thức' : 'Xem như Member (ẩn công thức)'}
        </a>
      </p>
      <FormulaVisibilityProvider show={!hide}>
        <LensSelector components={seedCatalog().filter((c) => ['camera', 'lens', 'tube', 'converter'].includes(c.kind))} />
      </FormulaVisibilityProvider>
    </section>
  );
}
