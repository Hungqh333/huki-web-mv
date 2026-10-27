/**
 * Hình minh hoạ Sổ tay công thức (chốt 2026-10-27): mọi hình khai ở book.ts đều có bản
 * vẽ, đủ 32 hình (14 hình đợt 1 + 18 hình phần 2–9), và file hình là server component.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FORMULA_BOOK } from '../src/lib/formulaBook/book';

const SRC = readFileSync(new URL('../src/components/admin/FormulaFigures.tsx', import.meta.url), 'utf8');

test('mỗi hình khai trong sổ tay đều có bản vẽ; đủ 32 hình (đợt 1 + phần 2–9)', () => {
  const used = new Set(FORMULA_BOOK.flatMap((s) => s.entries.map((e) => e.figure).filter(Boolean)));
  for (const key of used) assert.match(SRC, new RegExp(`\\n  ${key}: \\{ render:`), `chua ve hinh ${key}`);
  assert.equal(used.size, 32);
});

test('file hình là server component', () => {
  assert.doesNotMatch(SRC, /^['"]use client['"]/m);
});
