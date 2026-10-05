/**
 * Chạy thử C9 — dự án MẪU SOẠN S-11 + giá ước tính (V1c mục C9).
 *
 * Hưng giao tự tạo (2026-09-18) vì chưa có dự án thật thứ hai. Đây KHÔNG phải
 * dự án thật: nó chạy trọn luồng để tìm lỗi, không chứng minh công thức đúng với
 * thực tế và không thay tiêu chí "dự án thật" của spec §14.
 *
 * Giá và thông số bổ sung lấy từ estimates.ts — cùng dữ liệu với file SQL chạy thử
 * (Hưng cho nạp lên production 2026-10-05). Đều gắn nhãn "GIÁ ƯỚC TÍNH".
 */
import { readFileSync } from 'node:fs';
import type { Component, ComponentKind } from '../../src/lib/components/specs';
import { DEMO_LENSES, demoLens, withEstimates } from './estimates';

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

/** Kho seed thật (supabase/seed_components.sql) + dữ liệu ước tính (estimates.ts) — đúng như production sau khi dán SQL chạy thử. */
export function sampleCatalog(): Component[] {
  const sql = readFileSync('supabase/seed_components.sql', 'utf8');
  const text = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${text},\\s*${text},\\s*${text},\\s*${text},\\s*${text}::jsonb,\\s*${text}`, 'g');
  const seed = [...sql.matchAll(row)].map((m, i) => {
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
    return { ...withEstimates(component), used_in_projects: 0 };
  });
  const demo = DEMO_LENSES.map((entry, i): Component => ({ id: `demo-${i}`, ...withEstimates(demoLens(entry)), used_in_projects: 0 }));
  return [...seed, ...demo];
}
