import { notFound } from 'next/navigation';
import { MountCheck } from '@/components/lens/MountCheck';
import { FormulaVisibilityProvider } from '@/components/ui/FormulaVisibility';
import { seedCatalog } from '@/lib/devSeedCatalog';
import { DEFAULT_ENGINE_PARAMS } from '@/lib/vision/engineParams';
import { mountCameraOptions, mountLensOptions, readMountParams } from '@/lib/vision/mountCheckOptions';

/**
 * Xem trước Kiểm tra lắp đặt — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập, kho mẫu từ seed.
 * Trang thật /kiem-tra-lap-dat nằm sau cổng Member và đọc kho thật.
 */
export default async function DevMountCheckPage({ searchParams }: PageProps<'/dev/kiem-tra-lap-dat'>) {
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
      <p className="mb-6 -mt-4 text-xs text-slate-500 dark:text-slate-400">{hide ? 'Đang xem như Member: H1, H2, sF ẩn.' : 'Đang xem như admin.'}</p>
      <FormulaVisibilityProvider show={!hide}>
        <MountCheck
          lenses={mountLensOptions(catalog)}
          cameras={mountCameraOptions(catalog)}
          marginWarn={DEFAULT_ENGINE_PARAMS.tubeFocusMarginWarn}
          initial={readMountParams(params)}
        />
      </FormulaVisibilityProvider>
    </section>
  );
}
