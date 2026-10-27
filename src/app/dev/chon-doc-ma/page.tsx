import { notFound } from 'next/navigation';
import { CodeReaderSelector } from '@/components/code/CodeReaderSelector';
import { FormulaVisibilityProvider } from '@/components/ui/FormulaVisibility';
import type { Component } from '@/lib/components/specs';
import { seedCatalog } from '@/lib/devSeedCatalog';

/**
 * Xem trước Bộ chọn đầu đọc mã — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập. Camera từ
 * seed + 3 đầu đọc mã MẪU khai ngay dưới đây (kho chưa có loại code_reader). Trang thật
 * /chon-doc-ma nằm sau cổng Member và đọc kho thật.
 */
const demoReader = (n: number, model: string, spec: Record<string, unknown>): Component => ({
  id: `demo-reader-${n}`,
  code: `MAU-DR-${n}`,
  kind: 'code_reader',
  brand: 'Mẫu',
  model,
  spec: { shutter: 'global', color: 'mono', ...spec },
  price_vnd: null,
  datasheet_url: null,
  source: 'unverified',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: 2000 + n,
});

const DEMO_READERS: Component[] = [
  demoReader(1, 'Đầu đọc 1.3 MP ống cố định', { resolution_w_px: 1280, resolution_h_px: 1024, aov_h_deg: 30, aov_v_deg: 24, wd_min_mm: 60, wd_max_mm: 250, focus: 'fixed', decode_rate_hz: 60, code_types: ['1D', '2D'] }),
  demoReader(2, 'Đầu đọc 2.3 MP liquid lens', { resolution_w_px: 1920, resolution_h_px: 1200, aov_h_deg: 24, aov_v_deg: 15, wd_min_mm: 50, wd_max_mm: 1200, focus: 'liquid', decode_rate_hz: 45, code_types: ['1D', '2D', 'DPM'] }),
  demoReader(3, 'Đầu đọc 5 MP tốc độ cao', { resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, focal_length_mm: 16, wd_min_mm: 150, wd_max_mm: 800, focus: 'auto', decode_rate_hz: 30, code_types: ['1D', '2D', 'DPM'] }),
];

export default async function DevCodeReaderPage({ searchParams }: PageProps<'/dev/chon-doc-ma'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  // ?cong-thuc=an — xem như người không phải admin (bảo vệ công thức, 2026-10-21).
  const hide = (await searchParams)['cong-thuc'] === 'an';
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, camera từ seed + 3 đầu đọc mã MẪU (không phải kho thật).
      </p>
      <p className="mb-6 -mt-4 text-xs text-slate-500 dark:text-slate-400">
        {hide ? 'Đang xem như Member: công thức ẩn. ' : 'Đang xem như admin: có công thức. '}
        <a href={hide ? '?' : '?cong-thuc=an'} className="text-sky-700 hover:underline dark:text-sky-400">
          {hide ? 'Hiện công thức' : 'Xem như Member (ẩn công thức)'}
        </a>
      </p>
      <FormulaVisibilityProvider show={!hide}>
        <CodeReaderSelector components={[...seedCatalog().filter((c) => c.kind === 'camera'), ...DEMO_READERS]} />
      </FormulaVisibilityProvider>
    </section>
  );
}
