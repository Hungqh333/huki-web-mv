/**
 * Dữ liệu ƯỚC TÍNH để phần mềm chạy trọn luồng trước khi có kho thiết bị thật
 * (Hưng giao 2026-10-05: "tự tạo dữ liệu, cần phần mềm chạy được trước").
 *
 * MỘT nguồn cho cả `npm run dryrun:c9` (ở máy) và file SQL nạp production
 * (`npm run build:demo-sql`). Mọi thứ ở đây đều gắn nhãn để không ai lấy đi báo giá:
 * - nhà cung cấp = ESTIMATE_SUPPLIER ("GIÁ ƯỚC TÍNH…") → hiện trong BOM, Excel;
 * - source giữ 'unverified' → dấu * "chưa đối chiếu datasheet" trên BOM và PDF;
 * - ống kính bổ sung mang hãng "Generic" và chữ "(mẫu chạy thử)" trong tên.
 *
 * Thông số bổ sung là giá trị điển hình của dòng sản phẩm, CHƯA đối chiếu datasheet.
 * Không thêm thông số không chắc (vd kiểu màn trập) — thiếu thì engine ghi
 * "chưa kiểm được", không đoán.
 *
 * Khi có kho thật: nhập bằng `npm run import:components` — upsert theo mã sẽ ghi đè
 * giá, nhà cung cấp và thông số ở đây.
 */
import type { Component, ComponentKind } from '../../src/lib/components/specs';

export const ESTIMATE_SUPPLIER = 'GIÁ ƯỚC TÍNH — chưa có báo giá (chạy thử)';
export const ESTIMATE_LEAD_DAYS = 14;

/** Thông số bổ sung theo mã kho — đúng các cột khiến phương án mang cờ "chưa kiểm được". */
export const SPEC_PATCHES: Record<string, Record<string, unknown>> = {
  // Ống kính 5 MP 2/3": tên FFxx20 = tiêu cự xx mm, F2.0. lp/mm điển hình của dòng 5 MP.
  'LENS-COOLENS-FF08': { f_number_min: 2, f_number_max: 16, resolution_lp_mm: 160 },
  'LENS-COOLENS-FF12': { f_number_min: 2, f_number_max: 16, resolution_lp_mm: 160 },
  'LENS-COOLENS-FF16': { f_number_min: 2, f_number_max: 16, resolution_lp_mm: 160 },
  'LENS-COOLENS-FF25': { f_number_min: 2, f_number_max: 16, resolution_lp_mm: 160 },
  'LENS-COOLENS-FF35': { f_number_min: 2, f_number_max: 16, resolution_lp_mm: 160 },
  'LENS-COOLENS-FF50': { f_number_min: 2, f_number_max: 16, resolution_lp_mm: 160 },
  // Máy tính: số core và cổng LAN điển hình của cấu hình ghi trong tên.
  'PC-STD-GIGE': { cpu_cores: 6, lan_ports: 2 },
  'PC-HIGH-BANDWIDTH': { cpu_cores: 8, lan_ports: 4 },
  'PC-GPU-DL': { cpu_cores: 8, lan_ports: 2 },
};

/**
 * Ống kính lấp chỗ kho seed còn hở: tiêu cự giữa 16 và 25 mm, và vòng ảnh 1" / 1.1"
 * cho camera 16 MP / 12 MP (seed chỉ có ống 1" ở 35 và 50 mm, không có ống 1.1" nào —
 * camera 12 MP 1.1" bị loại hết vì vòng ảnh, nên mức Đề xuất của S-11 luôn trống).
 */
export const DEMO_LENSES: { code: string; focal: number; circle: string; sortOrder: number }[] = [
  { code: 'LENS-DEMO-F20', focal: 20, circle: '2/3', sortOrder: 87 },
  { code: 'LENS-DEMO-F30', focal: 30, circle: '1', sortOrder: 88 },
  { code: 'LENS-DEMO-F35-11', focal: 35, circle: '1.1', sortOrder: 89 },
];

export function demoLens(entry: (typeof DEMO_LENSES)[number]): Omit<Component, 'id'> {
  return {
    code: entry.code,
    kind: 'lens',
    brand: 'Generic',
    model: `Lens ${entry.focal} mm ${entry.circle}" (mẫu chạy thử)`,
    spec: {
      lens_type: 'fixed',
      focal_length_mm: entry.focal,
      image_circle: entry.circle,
      mount: 'C',
      wd_min_mm: 150,
      wd_max_mm: 5000,
      f_number_min: 2,
      f_number_max: 16,
      resolution_lp_mm: 160,
    },
    price_vnd: null,
    datasheet_url: null,
    source: 'unverified',
    notes_vi: 'Ống kính mẫu để chạy thử phần mềm — không phải sản phẩm cụ thể. Thay bằng ống thật khi nhập kho.',
    notes_en: 'Placeholder lens for trying out the software — not a specific product. Replace with a real lens when loading the catalogue.',
    is_active: true,
    sort_order: entry.sortOrder,
  };
}

/** Giá ước tính thô (VND) theo nhóm thiết bị. */
export function estimatePrice(c: Pick<Component, 'kind' | 'spec'>): number {
  const spec = c.spec as Record<string, unknown>;
  const num = (key: string) => (typeof spec[key] === 'number' ? (spec[key] as number) : null);
  const str = (key: string) => (typeof spec[key] === 'string' ? (spec[key] as string) : '');
  switch (c.kind as ComponentKind) {
    case 'camera': {
      if (str('camera_type') === 'line') return 60_000_000;
      const mp = num('resolution_mp') ?? 5;
      const base = mp <= 5 ? 15_000_000 : mp <= 12.5 ? 30_000_000 : 45_000_000;
      return str('interface').startsWith('CXP') ? Math.round(base * 1.8) : base;
    }
    case 'lens':
      return str('lens_type') === 'telecentric' ? 25_000_000 : (num('focal_length_mm') ?? 16) <= 16 ? 5_000_000 : 7_000_000;
    case 'light':
      return ({ dome: 8_000_000, darkfield: 6_000_000, coaxial: 6_000_000 } as Record<string, number>)[str('light_type')] ?? 4_000_000;
    case 'controller':
      return spec.gpu ? 60_000_000 : str('cpu').includes('i7') ? 35_000_000 : 25_000_000;
    case 'interface_card':
      return 8_000_000;
    case 'light_controller':
      return 5_000_000;
    case 'software':
      return 20_000_000;
    default:
      return 500_000;
  }
}

/** Áp dữ liệu ước tính lên một thiết bị kho (seed) — cùng phép biến đổi với file SQL. */
export function withEstimates<T extends Omit<Component, 'id'>>(component: T): T {
  const spec = { ...component.spec, ...(SPEC_PATCHES[component.code] ?? {}) };
  return {
    ...component,
    spec,
    price_vnd: estimatePrice({ kind: component.kind, spec }),
    lead_time_days: ESTIMATE_LEAD_DAYS,
    supplier: ESTIMATE_SUPPLIER,
  };
}
