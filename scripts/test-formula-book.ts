/**
 * Sổ tay công thức (/admin/cong-thuc, chốt 2026-10-20) phải khớp engine.
 *
 * Thêm luật vào RULES hay ngưỡng vào ENGINE_PARAMS mà quên ghi vào
 * src/lib/formulaBook/book.ts thì test này đỏ — sổ tay không được lặng lẽ lệch code.
 * Và sổ tay chỉ được render ở máy chủ: không file 'use client' nào được import nó.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { FORMULA_BOOK, documentedParams, documentedRules } from '../src/lib/formulaBook/book';
import { ENGINE_PARAMS } from '../src/lib/vision/engineParams';
import { RULES } from '../src/lib/vision/rules';
import { SNAPSHOT_PATH, currentFingerprints, sourceFiles, type FormulaSnapshot } from './lib/formula-fingerprint';

test('mọi mã luật engine đều có mục trong sổ tay', () => {
  const documented = documentedRules();
  const missing = RULES.map((r) => r.id).filter((id) => !documented.has(id));
  assert.deepEqual(missing, [], `thieu trong so tay: ${missing.join(', ')}`);
  const unknown = [...documented].filter((id) => !RULES.some((r) => r.id === id));
  assert.deepEqual(unknown, [], `so tay ghi ma luat khong ton tai: ${unknown.join(', ')}`);
});

test('mọi ngưỡng admin đều xuất hiện trong sổ tay', () => {
  const documented = documentedParams();
  const missing = ENGINE_PARAMS.map((p) => p.key).filter((key) => !documented.has(key));
  assert.deepEqual(missing, [], `nguong chua ghi vao so tay: ${missing.join(', ')}`);
});

test('mã mục không trùng; mục nào cũng có công thức và nguồn', () => {
  const ids = FORMULA_BOOK.flatMap((s) => s.entries.map((e) => e.id));
  assert.equal(new Set(ids).size, ids.length, 'trung ma muc');
  for (const section of FORMULA_BOOK) {
    for (const entry of section.entries) {
      assert.ok(entry.formula.length > 0, `${entry.id}: thieu cong thuc`);
      assert.ok(entry.source.includes(':'), `${entry.id}: thieu nguon file : ham`);
      assert.ok(entry.usedIn.length > 0, `${entry.id}: thieu trang dung`);
    }
  }
});

test('hàm ghi ở cột nguồn có thật trong file', () => {
  for (const entry of FORMULA_BOOK.flatMap((s) => s.entries)) {
    for (const part of entry.source.split('·')) {
      const [file, names = ''] = part.split(':').map((x) => x.trim());
      const text = readFileSync(`src/lib/${file}`, 'utf8');
      for (const name of names.split(',').map((x) => x.trim()).filter(Boolean)) {
        // Tên dạng mã luật (RES-001, AI-001 / AI-002) là mốc chú thích trong file.
        const token = name.split(' ')[0];
        assert.ok(text.includes(token), `${entry.id}: ${file} khong co "${token}"`);
      }
    }
  }
});

test('sổ tay chỉ render ở máy chủ — không file client nào import', () => {
  const files = execSync('git ls-files src', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f));
  // File chưa track (đang làm) cũng phải kiểm.
  const untracked = execSync('git ls-files --others --exclude-standard src', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f));
  const offenders = [...new Set([...files, ...untracked])].filter((file) => {
    const text = readFileSync(file, 'utf8');
    return /^['"]use client['"]/m.test(text) && text.includes('formulaBook');
  });
  assert.deepEqual(offenders, []);
  for (const file of ['src/app/admin/cong-thuc/page.tsx', 'src/components/admin/FormulaBookView.tsx', 'src/app/dev/cong-thuc/page.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /^['"]use client['"]/m, file);
  }
});

test('code nguồn chưa đổi kể từ lần đối chiếu sổ tay gần nhất (dấu vân tay)', () => {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as FormulaSnapshot;
  const now = currentFingerprints();
  const usedBy = sourceFiles();
  const changed = Object.keys(now)
    .filter((file) => snapshot.files[file] !== now[file])
    .map((file) => `${file} (muc: ${usedBy.get(file)!.join(', ')})`);
  assert.deepEqual(
    changed,
    [],
    'Cong thuc trong cac file tren da doi. Xem lai cac muc tuong ung trong src/lib/formulaBook/book.ts, ' +
      'sua cho khop, roi chay: npm run stamp:formulas'
  );
});
