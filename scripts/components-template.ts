/**
 * Sinh file Excel mẫu để nhập thiết bị (camera, ống kính, đèn, máy tính).
 *
 *   npm run import:components:template
 *   npm run import:components:template -- --out duong-dan.xlsx
 *
 * Không ghi đè file đã có: file mẫu thường đã được điền dở.
 */
import { existsSync } from 'node:fs';
import { buildTemplate } from './lib/components-workbook';

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const target = outIndex !== -1 ? args[outIndex + 1] : 'docs/NHAP_THIET_BI.xlsx';

  if (existsSync(target)) {
    console.error(`Đã có file ${target} — không ghi đè để khỏi mất dữ liệu đã điền.`);
    console.error('Muốn sinh bản mới thì thêm --out ten-khac.xlsx');
    process.exit(1);
  }

  const workbook = await buildTemplate();
  await workbook.xlsx.writeFile(target);
  console.log(`Đã tạo ${target}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
