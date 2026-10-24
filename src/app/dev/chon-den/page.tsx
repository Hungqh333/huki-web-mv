import { notFound } from 'next/navigation';
import { LightSelector } from '@/components/light/LightSelector';
import { selectLightsDevAction } from '@/app/actions/lights';

/**
 * Xem trước Bộ chọn đèn — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập, kho mẫu đọc từ
 * supabase/seed_components.sql, bảng luật mặc định. Trang thật /chon-den nằm sau cổng
 * Member và đọc kho thật.
 */
export default async function DevLightSelectorPage({ searchParams }: PageProps<'/dev/chon-den'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?cong-thuc=an — xem như người không phải admin (bảo vệ công thức, 2026-10-21).
  const hide = (await searchParams)['cong-thuc'] === 'an';
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, kho mẫu từ seed (không phải kho thật), bảng luật mặc định.
      </p>
      <p className="mb-6 -mt-4 text-xs text-slate-500 dark:text-slate-400">
        {hide ? 'Đang xem như Member: công thức ẩn. ' : 'Đang xem như admin: có công thức. '}
        <a href={hide ? '?' : '?cong-thuc=an'} className="text-sky-700 hover:underline dark:text-sky-400">
          {hide ? 'Hiện công thức' : 'Xem như Member (ẩn công thức)'}
        </a>
      </p>
      <LightSelector run={selectLightsDevAction.bind(null, !hide)} />
    </section>
  );
}
