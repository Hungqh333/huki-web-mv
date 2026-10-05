/**
 * Sinh CHAY-BUOC-NAY-DU-LIEU-CHAY-THU.sql (gitignore) — dữ liệu chạy thử cho production.
 * Nội dung và lý do: scripts/c9/demoSql.ts.
 *
 *   npm run build:demo-sql
 */
import { writeFileSync } from 'node:fs';
import { renderDemoSql } from './c9/demoSql';
import { sampleCatalog } from './c9/sample';

const OUT = 'CHAY-BUOC-NAY-DU-LIEU-CHAY-THU.sql';
// Thiết bị seed (bỏ 3 ống kính mẫu — phần insert riêng lo).
const seed = sampleCatalog().filter((c) => !c.id.startsWith('demo-'));
writeFileSync(OUT, renderDemoSql(seed));
console.log(`Đã ghi ${OUT}`);
