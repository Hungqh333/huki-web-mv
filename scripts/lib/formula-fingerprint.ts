/**
 * Dấu vân tay các file engine mà Sổ tay công thức mô tả (chốt 2026-10-20).
 *
 * Vì sao: test-formula-book.ts đã bắt luật / ngưỡng MỚI chưa ghi vào sổ, nhưng không
 * bắt được chuyện SỬA công thức của luật cũ (đổi hệ số, đổi điều kiện). Dấu vân tay
 * khoá nội dung code của từng file nguồn: file đổi mà sổ tay chưa được xem lại thì test
 * đỏ, kèm danh sách mục cần xem. Xem xong chạy `npm run stamp:formulas` để ghi dấu mới.
 *
 * Chỉ băm CODE: bỏ chú thích, khoảng trắng đầu/cuối dòng, dòng trống — sửa lời giải
 * thích không làm đỏ test, sửa phép tính thì có.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { FORMULA_BOOK } from '../../src/lib/formulaBook/book';

export const SNAPSHOT_PATH = 'src/lib/formulaBook/snapshot.json';

export type FormulaSnapshot = {
  /** Ngày sổ tay được đối chiếu với code lần cuối (YYYY-MM-DD). */
  reviewedAt: string;
  files: Record<string, string>;
};

/** File (tính từ src/lib) → các mục sổ tay lấy nó làm nguồn. */
export function sourceFiles(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of FORMULA_BOOK.flatMap((section) => section.entries)) {
    for (const part of entry.source.split('·')) {
      const file = part.split(':')[0].trim();
      map.set(file, [...(map.get(file) ?? []), entry.id]);
    }
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Nội dung code đã bỏ chú thích và khoảng trắng thừa. */
export function codeOnly(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1').trim())
    .filter(Boolean)
    .join('\n');
}

export function fingerprint(file: string): string {
  return createHash('sha256').update(codeOnly(readFileSync(`src/lib/${file}`, 'utf8'))).digest('hex').slice(0, 16);
}

export function currentFingerprints(): Record<string, string> {
  return Object.fromEntries([...sourceFiles().keys()].map((file) => [file, fingerprint(file)]));
}
