/**
 * `npm run stamp:formulas` — ghi dấu vân tay mới cho Sổ tay công thức.
 *
 * CHỈ chạy SAU KHI đã xem lại các mục sổ tay (src/lib/formulaBook/book.ts) mà
 * test-formula-book.ts báo là file nguồn đã đổi. Chạy mà không xem là tự che mắt.
 */
import { writeFileSync } from 'node:fs';

import { SNAPSHOT_PATH, currentFingerprints, type FormulaSnapshot } from './lib/formula-fingerprint';

const snapshot: FormulaSnapshot = {
  reviewedAt: new Date().toISOString().slice(0, 10),
  files: currentFingerprints(),
};
writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Da ghi ${Object.keys(snapshot.files).length} dau van tay vao ${SNAPSHOT_PATH} (${snapshot.reviewedAt}).`);
