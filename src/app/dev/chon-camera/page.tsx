import { notFound } from 'next/navigation';
import { CameraSelector } from '@/components/camera/CameraSelector';
import { FormulaVisibilityProvider } from '@/components/ui/FormulaVisibility';
import type { Component } from '@/lib/components/specs';
import { seedCatalog } from '@/lib/devSeedCatalog';

/**
 * Xem trước Bộ chọn camera — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập. Kho mẫu từ
 * seed (ít camera, 3 line scan) + 4 camera line scan MẪU khai ngay dưới đây để thử
 * đủ dải 2k–16k. Trang thật /chon-camera nằm sau cổng Member và đọc kho thật.
 */
const demoLine = (n: number, px: number, pitch: number, khz: number, iface: string, mount: string, extra: Record<string, unknown> = {}): Component => ({
  id: `demo-line-${n}`,
  code: `MAU-LS-${n}`,
  kind: 'camera',
  brand: 'Mẫu',
  model: `Line ${px / 1024}k ${khz} kHz`,
  spec: { camera_type: 'line', line_width_px: px, pixel_size_um: pitch, max_line_rate_khz: khz, interface: iface, mount, color: 'mono', shutter: 'global', trigger_io: 'yes', ...extra },
  price_vnd: null,
  datasheet_url: null,
  source: 'unverified',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: 1000 + n,
});

const DEMO_LINE: Component[] = [
  demoLine(1, 2048, 14, 49, 'GigE', 'M42'),
  demoLine(2, 4096, 7, 48, 'GigE', 'M42'),
  demoLine(3, 8192, 5, 120, 'CXP-12', 'M72', { cxp_lanes: 4 }),
  demoLine(4, 16384, 3.5, 200, 'CXP-12', 'M72', { cxp_lanes: 4 }),
];

export default async function DevCameraSelectorPage({ searchParams }: PageProps<'/dev/chon-camera'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?cong-thuc=an — xem như người không phải admin (bảo vệ công thức, 2026-10-21).
  const hide = (await searchParams)['cong-thuc'] === 'an';
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, kho mẫu từ seed + 4 camera line scan MẪU (không phải kho thật).
      </p>
      <p className="mb-6 -mt-4 text-xs text-slate-500 dark:text-slate-400">
        {hide ? 'Đang xem như Member: công thức ẩn. ' : 'Đang xem như admin: có công thức. '}
        <a href={hide ? '?' : '?cong-thuc=an'} className="text-sky-700 hover:underline dark:text-sky-400">
          {hide ? 'Hiện công thức' : 'Xem như Member (ẩn công thức)'}
        </a>
      </p>
      <FormulaVisibilityProvider show={!hide}>
        <CameraSelector components={[...seedCatalog().filter((c) => c.kind === 'camera'), ...DEMO_LINE]} />
      </FormulaVisibilityProvider>
    </section>
  );
}
