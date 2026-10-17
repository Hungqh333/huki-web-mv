/**
 * Đọc kho theo trang (2026-10-17). Supabase trả tối đa 1.000 dòng mỗi lần; kho thật
 * ~1.760 món làm trang Yêu cầu mất nửa ống kính + toàn bộ đèn → ba mức phương án trống.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fetchAllRows } from '../src/lib/components/fetchAll';

const fakeTable = (total: number) => {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
    return { data, error: null };
  };
  return { page, calls };
};

test('đọc đủ mọi dòng khi vượt một trang, không trùng không sót', async () => {
  const { page, calls } = fakeTable(2500);
  const { data, error } = await fetchAllRows(page, 1000);
  assert.equal(error, null);
  assert.equal(data.length, 2500);
  assert.deepEqual(data, Array.from({ length: 2500 }, (_, i) => i));
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('vừa khít bội số trang: thêm một lần đọc rỗng rồi dừng', async () => {
  const { page, calls } = fakeTable(2000);
  const { data } = await fetchAllRows(page, 1000);
  assert.equal(data.length, 2000);
  assert.equal(calls.length, 3);
});

test('lỗi ở giữa: trả lỗi kèm phần đã đọc, không lặp vô hạn', async () => {
  let n = 0;
  const { data, error } = await fetchAllRows(async () => (++n === 2 ? { data: null, error: { message: 'timeout' } } : { data: [1, 2], error: null }), 2);
  assert.deepEqual([data, error?.message], [[1, 2], 'timeout']);
});

test('mọi chỗ ĐỌC nhiều dòng kho thiết bị đều đi qua fetchAllRows', () => {
  const files = execSync('git ls-files src', { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes(".from('components')")) continue;
    // Ghi / xoá / đọc một dòng theo id thì không cần.
    const reads = text.split(".from('components')").slice(1).filter((tail) => /^\s*\.select\(/.test(tail) && !/\.eq\('id'/.test(tail.slice(0, 300)));
    if (reads.length > 0) assert.ok(text.includes('fetchAllRows'), `${file}: doc kho ma khong qua fetchAllRows`);
  }
});
