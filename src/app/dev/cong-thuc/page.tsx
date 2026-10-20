import { notFound } from 'next/navigation';
import { FormulaBookView } from '@/components/admin/FormulaBookView';
import { DEFAULT_ENGINE_PARAMS } from '@/lib/vision/engineParams';
import { DEFAULT_ENGINE_TABLES } from '@/lib/vision/engineTables';

/**
 * Xem trước Sổ tay công thức — CHỈ MÁY LOCAL (production trả 404), không đọc database:
 * mọi ngưỡng là giá trị mặc định. Trang thật: /admin/cong-thuc.
 */
export default async function DevFormulaBookPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local, giá trị mặc định (không đọc ngưỡng đã sửa). Trang thật: /admin/cong-thuc.
      </p>
      <FormulaBookView
        loaded={{ params: DEFAULT_ENGINE_PARAMS, overridden: [], rejected: false, stored: {}, tables: DEFAULT_ENGINE_TABLES, tableRejected: [], tableStored: {} }}
      />
    </section>
  );
}
