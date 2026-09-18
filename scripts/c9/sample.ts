/**
 * Chạy thử C9 — dự án MẪU SOẠN S-11 + giá ước tính (V1c mục C9).
 *
 * Hưng giao tự tạo (2026-09-18) vì chưa có dự án thật thứ hai. Đây KHÔNG phải
 * dự án thật: nó chạy trọn luồng để tìm lỗi, không chứng minh công thức đúng với
 * thực tế và không thay tiêu chí "dự án thật" của spec §14.
 *
 * Giá dưới đây là ƯỚC TÍNH THÔ theo nhóm thiết bị, chỉ để Excel có tổng và xếp
 * hạng có tiêu chí giá. KHÔNG nạp lên production, KHÔNG dùng báo giá.
 */
import { readFileSync } from 'node:fs';
import type { Component, ComponentKind } from '../../src/lib/components/specs';

/** Mô tả như khách gửi — đầu vào cho bộ đọc (LLM điểm 1). Thông tin bịa, không mật. */
export const SAMPLE_DESCRIPTION = `Chào anh,
Bên em cần một trạm kiểm tra nắp nhôm phay (hợp kim nhôm, bề mặt kim loại sáng), kích thước nắp 120 x 80 mm.
Yêu cầu 1: đo khoảng cách giữa hai lỗ lắp, danh nghĩa 100 mm, dung sai ±0,1 mm.
Yêu cầu 2: phát hiện vết xước dài từ 0,3 mm trở lên. Vết xước nhìn khá rõ, độ tương phản trung bình, hình dạng lỗi ít thay đổi giữa các mẫu.
Nắp nằm trên đồ gá nên chiều cao chỉ dao động khoảng 0,05 mm.
Dây chuyền chạy 40 sản phẩm/phút, dừng từng bước tại trạm kiểm.
Dự kiến dùng 1 camera, khoảng cách từ camera tới sản phẩm khoảng 400 mm.
Xưởng có điều hoà, nhiệt độ dao động khoảng 5 độ.
Cảm ơn anh.`;

export const SAMPLE_PROJECT_NAME = 'CHẠY THỬ C9 — Nắp nhôm phay (mẫu soạn S-11)';

export const ESTIMATE_SUPPLIER = 'NCC mẫu — giá ước tính chạy thử C9';

/** Giá ước tính thô (VND) theo nhóm — xem chú thích đầu file. */
export function estimatePrice(c: Component): number {
  const spec = c.spec as Record<string, unknown>;
  const num = (key: string) => (typeof spec[key] === 'number' ? (spec[key] as number) : null);
  const str = (key: string) => (typeof spec[key] === 'string' ? (spec[key] as string) : '');
  switch (c.kind) {
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

/** Kho seed thật (supabase/seed_components.sql) + giá / thời gian giao / NCC ước tính. */
export function sampleCatalog(): Component[] {
  const sql = readFileSync('supabase/seed_components.sql', 'utf8');
  const text = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${text},\\s*${text},\\s*${text},\\s*${text},\\s*${text}::jsonb,\\s*${text}`, 'g');
  return [...sql.matchAll(row)].map((m, i) => {
    const component: Component = {
      id: `seed-${i}`,
      code: m[1],
      kind: m[2] as ComponentKind,
      brand: m[3],
      model: m[4],
      spec: JSON.parse(m[5].replace(/''/g, "'")),
      source: m[6] as Component['source'],
      price_vnd: null,
      datasheet_url: null,
      notes_vi: null,
      notes_en: null,
      is_active: true,
      sort_order: i,
    };
    return { ...component, price_vnd: estimatePrice(component), lead_time_days: 14, supplier: ESTIMATE_SUPPLIER, used_in_projects: 0 };
  });
}
