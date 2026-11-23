import { notFound } from 'next/navigation';
import { ObliqueView } from '@/components/lens/ObliqueView';
import { seedCatalog } from '@/lib/devSeedCatalog';
import { mountCameraOptions, mountLensOptions } from '@/lib/vision/mountCheckOptions';

/**
 * Xem trước Camera nghiêng — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập, kho mẫu từ seed.
 * Trang thật /camera-nghieng nằm sau cổng Member và đọc kho thật.
 */
export default async function DevObliquePage({ searchParams }: PageProps<'/dev/camera-nghieng'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  // ?cong-thuc=an — xem như người không phải admin.
  const hide = params['cong-thuc'] === 'an';
  const catalog = seedCatalog();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, kho mẫu từ seed (không phải kho thật).
      </p>
      <ObliqueView lenses={mountLensOptions(catalog)} cameras={mountCameraOptions(catalog)} admin={!hide} />
    </section>
  );
}
