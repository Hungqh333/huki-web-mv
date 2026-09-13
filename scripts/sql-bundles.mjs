/**
 * Danh sách file CHAY-BUOC-NAY*.sql và cách ghép, dùng chung cho
 * build-sql-bundle.mjs (ghi file) và verify-db.mjs (chạy thử đúng nội dung đó).
 *
 * Tách ra đây vì test:db trước kia chỉ chạy từng migration riêng lẻ, không chạy
 * chính file người dùng dán. Bundle thiếu migration vẫn qua test — và vỡ trên
 * Supabase.
 */

export const BUNDLES = {
  kpi: {
    out: 'CHAY-BUOC-NAY.sql',
    parts: [
      ['PHAN 1/2: MIGRATION — tao 4 bang cho Bo tinh chi tieu', 'supabase/migrations/20260828000001_kpi_calculator.sql'],
      ['PHAN 2/2: SEED — nap 27 loai bai toan, 16 he so, 8 tham so, 4 muc siet', 'supabase/seed_kpi.sql'],
    ],
  },
  'selector-bom': {
    out: 'CHAY-BUOC-NAY-BOM.sql',
    parts: [
      ['PHAN 1/2: MIGRATION — them cot may tinh + phu kien cho bang luat', 'supabase/migrations/20260904000001_selector_bom.sql'],
      ['PHAN 2/2: SEED — nap lai bang luat kem hai cum moi', 'supabase/seed.sql'],
    ],
  },
  components: {
    out: 'CHAY-BUOC-NAY-LINHKIEN.sql',
    parts: [
      ['PHAN 1/4: MIGRATION — bang catalog linh kien', 'supabase/migrations/20260904000002_components.sql'],
      // Seed dùng kind 'tube', 'cable', 'interface_card'... — thiếu hai migration
      // dưới thì Supabase báo "invalid input value for enum component_kind".
      ['PHAN 2/4: MIGRATION — kind chuyen tu enum sang text, them tube/cap/phan mem', 'supabase/migrations/20260905000001_component_kinds.sql'],
      ['PHAN 3/4: MIGRATION — them loai card giao tiep', 'supabase/migrations/20260905000002_interface_card.sql'],
      ['PHAN 4/4: SEED — nap thiet bi mau cua Basler, Hikrobot, iRayple, HZ, Coolens', 'supabase/seed_components.sql'],
    ],
  },
};

/** `read(path)` nhận đường dẫn tính từ gốc repo, như trong `parts`. */
export function renderBundle(bundle, read) {
  const body = bundle.parts
    .map(([label, path]) => `-- ===== ${label} =====\n${read(path).trimEnd()}\n`)
    .join('\n');

  const header = `-- File nay duoc sinh tu dong boi scripts/build-sql-bundle.mjs — dung sua tay.
-- Nguon: ${bundle.parts.map(([, p]) => p).join(', ')}
-- Chay lai duoc nhieu lan: migration dung "if not exists", seed dung "on conflict do update".

`;

  return header + body;
}
