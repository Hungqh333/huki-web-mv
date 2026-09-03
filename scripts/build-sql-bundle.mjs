/**
 * Gộp migration + seed thành một file dán được thẳng vào Supabase SQL Editor.
 *
 * Lý do có script này: dự án không chạy Supabase CLI, mọi thay đổi database đều
 * dán tay qua trình duyệt. Ghép file bằng tay thì rất dễ ghép thiếu hoặc ghép
 * nhầm phiên bản cũ — đúng loại lỗi khó nhận ra vì SQL vẫn chạy được.
 *
 *   node scripts/build-sql-bundle.mjs kpi     → CHAY-BUOC-NAY.sql
 *
 * File kết quả nằm ngoài git (.gitignore) vì nó chỉ là bản ghép tạm.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const BUNDLES = {
  kpi: {
    out: 'CHAY-BUOC-NAY.sql',
    parts: [
      ['PHAN 1/2: MIGRATION — tao 4 bang cho Bo tinh chi tieu', 'supabase/migrations/20260828000001_kpi_calculator.sql'],
      ['PHAN 2/2: SEED — nap 27 loai bai toan, 16 he so, 8 tham so, 4 muc siet', 'supabase/seed_kpi.sql'],
    ],
  },
};

const name = process.argv[2];
const bundle = BUNDLES[name];
if (!bundle) {
  console.error(`Khong co bo "${name}". Cac bo co san: ${Object.keys(BUNDLES).join(', ')}`);
  process.exit(1);
}

const body = bundle.parts
  .map(([label, path]) => `-- ===== ${label} =====\n${readFileSync(path, 'utf8').trimEnd()}\n`)
  .join('\n');

const header = `-- File nay duoc sinh tu dong boi scripts/build-sql-bundle.mjs — dung sua tay.
-- Nguon: ${bundle.parts.map(([, p]) => p).join(', ')}
-- Chay lai duoc nhieu lan: migration dung "if not exists", seed dung "on conflict do update".

`;

writeFileSync(bundle.out, header + body, 'utf8');
console.log(`Da ghi ${bundle.out} (${(header + body).split('\n').length} dong)`);
