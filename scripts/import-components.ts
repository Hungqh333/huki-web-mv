/**
 * Chuyển file Excel thiết bị thành SQL để dán vào Supabase.
 *
 *   npm run import:components -- docs/NHAP_THIET_BI.xlsx
 *   npm run import:components -- docs/NHAP_THIET_BI.xlsx --out thiet-bi.sql
 *
 * Kiểm từng dòng trước khi sinh SQL (xem scripts/lib/components-io.ts). Còn một
 * lỗi là không sinh gì: nhập một nửa file rồi dừng khó dọn hơn là sửa file.
 *
 * Lấy file mẫu: npm run import:components:template
 */
import { existsSync, writeFileSync } from 'node:fs';
import { parseWorkbook, toSql } from './lib/components-io';
import { readWorkbook } from './lib/components-workbook';

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--out');

  if (!filePath) {
    console.error('Thiếu đường dẫn file.\n');
    console.error('  npm run import:components -- docs/NHAP_THIET_BI.xlsx\n');
    console.error('Chưa có file mẫu? Chạy: npm run import:components:template');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`Không tìm thấy file: ${filePath}`);
    process.exit(1);
  }

  const outIndex = args.indexOf('--out');
  const target = outIndex !== -1 ? args[outIndex + 1] : filePath.replace(/\.xlsx$/i, '') + '.sql';

  const sheets = await readWorkbook(filePath);
  if (sheets.length === 0) {
    console.error('Không thấy sheet CAMERA / ỐNG KÍNH / ĐÈN / MÁY TÍNH IPC nào trong file.');
    process.exit(1);
  }

  const { components, problems } = parseWorkbook(sheets);

  if (problems.length > 0) {
    console.error(`Tìm thấy ${problems.length} lỗi:\n`);
    for (const p of problems) console.error(`  ${p.sheet} · dòng ${p.row} · cột "${p.column}": ${p.message}`);
    console.error('\nKhông sinh SQL. Sửa file rồi chạy lại.');
    process.exit(1);
  }

  if (components.length === 0) {
    console.error('File chưa có dòng thiết bị nào (dòng ví dụ không tính).');
    process.exit(1);
  }

  writeFileSync(target, toSql(components), 'utf8');

  for (const { sheet } of sheets) {
    const list = components.filter((c) => c.sheet === sheet.name);
    const verified = list.filter((c) => c.source !== 'unverified').length;
    console.log(`  ${sheet.name.padEnd(14)} ${list.length} thiết bị (${verified} đã đối chiếu)`);
  }
  console.log(`\nĐã ghi SQL: ${target}`);
  console.log('Áp dụng: Supabase → SQL Editor → dán nội dung file → Run.');
  console.log('Lần đầu phải chạy CHAY-BUOC-NAY-THIETBI.sql trước (thêm cột giao hàng / nhà cung cấp).');
  console.log('Copy đúng cách trên Windows:');
  console.log(`  Get-Content -Raw -Encoding UTF8 "${target}" | Set-Clipboard`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
