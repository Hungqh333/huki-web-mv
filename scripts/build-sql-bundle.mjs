/**
 * Gộp migration + seed thành một file dán được thẳng vào Supabase SQL Editor.
 *
 * Lý do có script này: dự án không chạy Supabase CLI, mọi thay đổi database đều
 * dán tay qua trình duyệt. Ghép file bằng tay thì rất dễ ghép thiếu hoặc ghép
 * nhầm phiên bản cũ — đúng loại lỗi khó nhận ra vì SQL vẫn chạy được.
 *
 *   node scripts/build-sql-bundle.mjs kpi     → CHAY-BUOC-NAY.sql
 *
 * Danh sách bundle nằm ở sql-bundles.mjs; test:db chạy thử đúng nội dung đó.
 * File kết quả nằm ngoài git (.gitignore) vì nó chỉ là bản ghép tạm.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { BUNDLES, renderBundle } from './sql-bundles.mjs';

const name = process.argv[2];
const bundle = BUNDLES[name];
if (!bundle) {
  console.error(`Khong co bo "${name}". Cac bo co san: ${Object.keys(BUNDLES).join(', ')}`);
  process.exit(1);
}

const sql = renderBundle(bundle, (path) => readFileSync(path, 'utf8'));

writeFileSync(bundle.out, sql, 'utf8');
console.log(`Da ghi ${bundle.out} (${sql.split('\n').length} dong)`);
