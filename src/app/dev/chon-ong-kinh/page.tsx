import { notFound } from 'next/navigation';
import { LensSelector } from '@/components/lens/LensSelector';
import { seedCatalog } from '@/lib/devSeedCatalog';

/**
 * Xem trước Bộ chọn ống kính — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập, kho
 * mẫu đọc từ supabase/seed_components.sql (ít ống). Trang thật /chon-ong-kinh
 * nằm sau cổng Member và đọc kho thật.
 */
export default function DevLensSelectorPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, kho mẫu từ seed (không phải kho thật).
      </p>
      <LensSelector components={seedCatalog().filter((c) => ['camera', 'lens', 'tube', 'converter'].includes(c.kind))} />
    </section>
  );
}
