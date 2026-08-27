/**
 * Test cho công cụ nhập bảng luật từ Excel.
 *
 * Hai thứ phải đúng: bắt được dòng sai TRƯỚC khi sinh SQL, và SQL sinh ra phải
 * chạy được thật trên Postgres. Cái thứ hai kiểm bằng cách chạy thẳng lên
 * database in-process, vì lỗi thoát chuỗi (dấu nháy trong ghi chú tiếng Việt)
 * chỉ lộ ra khi Postgres thực sự phân tích câu lệnh.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

import { parseRules, toSql, type RawRow, type TaskContext } from './lib/rules-io';

const SUPABASE_DIR = join(process.cwd(), 'supabase');
const read = (...parts: string[]) => readFileSync(join(SUPABASE_DIR, ...parts), 'utf8');
const strip = (sql: string) => sql.replace(/create extension if not exists pgcrypto;/g, '');

const TASKS: TaskContext = new Map([
  ['2d-measurement', new Set(['fov_width_mm', 'tolerance_mm', 'surface', 'measure_type'])],
  ['appearance-inspection', new Set(['fov_width_mm', 'defect_variability', 'surface'])],
]);

let row = 1;
function makeRow(overrides: Partial<RawRow>): RawRow {
  row += 1;
  return {
    __row: row,
    code: `R-${row}`,
    task_slug: '2d-measurement',
    priority: '50',
    condition_json: '',
    recommended_camera: 'Area scan',
    recommended_lighting: '',
    recommended_lens: '',
    ai_or_rule_based: 'rule_based',
    notes_vi: 'Ghi chú',
    notes_en: 'Note',
    is_active: 'TRUE',
    ...overrides,
  };
}

const problemsFor = (overrides: Partial<RawRow>) =>
  parseRules([makeRow(overrides)], TASKS).problems;

test('dòng hợp lệ thì không báo lỗi', () => {
  assert.deepEqual(problemsFor({}), []);
});

test('điều kiện để trống được hiểu là luật nền', () => {
  const { rules, problems } = parseRules([makeRow({ condition_json: '' })], TASKS);
  assert.deepEqual(problems, []);
  assert.deepEqual(rules[0].condition_json, {});
});

test('bắt mã trùng trong cùng file', () => {
  const { problems } = parseRules(
    [makeRow({ code: 'TRUNG' }), makeRow({ code: 'TRUNG' })],
    TASKS
  );
  assert.ok(problems.some((p) => p.column === 'code' && /Trùng/.test(p.message)));
});

test('bắt bài toán không tồn tại', () => {
  const problems = problemsFor({ task_slug: 'khong-co-that' });
  assert.ok(problems.some((p) => p.column === 'task_slug'));
});

test('bắt JSON sai cú pháp', () => {
  const problems = problemsFor({ condition_json: '{"all":[' });
  assert.ok(problems.some((p) => /JSON sai/.test(p.message)));
});

test('bắt toán tử không hợp lệ', () => {
  const problems = problemsFor({
    condition_json: '{"all":[{"field":"tolerance_mm","op":"nho-hon","value":1}]}',
  });
  assert.ok(problems.some((p) => p.column === 'condition_json'));
});

test('bắt trường không có trong catalog', () => {
  const problems = problemsFor({
    condition_json: '{"all":[{"field":"khong_ton_tai","op":"eq","value":1}]}',
  });
  assert.ok(problems.some((p) => /không bao giờ khớp/.test(p.message)));
});

test('bắt trường có thật nhưng không thuộc bài toán đó', () => {
  // defect_variability la truong cua bai kiem tra ngoai quan, khong phai bai do luong.
  const problems = problemsFor({
    task_slug: '2d-measurement',
    condition_json: '{"all":[{"field":"defect_variability","op":"eq","value":"high"}]}',
  });
  assert.ok(problems.some((p) => /không có trường/.test(p.message)));
});

test('cho phép trường hệ thống tự tính ở bất kỳ bài toán nào', () => {
  const problems = problemsFor({
    condition_json: '{"all":[{"field":"required_resolution_px","op":"gt","value":5000}]}',
  });
  assert.deepEqual(problems, []);
});

test('bắt priority không phải số nguyên không âm', () => {
  assert.ok(problemsFor({ priority: '-1' }).some((p) => p.column === 'priority'));
  assert.ok(problemsFor({ priority: 'cao' }).some((p) => p.column === 'priority'));
});

test('bắt hướng giải quyết không hợp lệ', () => {
  assert.ok(problemsFor({ ai_or_rule_based: 'magic' }).some((p) => p.column === 'ai_or_rule_based'));
});

test('is_active nhận nhiều cách viết, mặc định là bật', () => {
  const value = (text: string) => parseRules([makeRow({ is_active: text })], TASKS).rules[0].is_active;
  assert.equal(value(''), true);
  assert.equal(value('TRUE'), true);
  assert.equal(value('FALSE'), false);
  assert.equal(value('false'), false);
  assert.equal(value('0'), false);
  assert.equal(value('không'), false);
});

// --- SQL sinh ra phải chạy được thật -----------------------------------------

let db: PGlite;

before(async () => {
  db = await PGlite.create();
  await db.exec(read('tests', 'auth_stub.sql'));
  for (const file of readdirSync(join(SUPABASE_DIR, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(strip(read('migrations', file)));
  }
  await db.exec(read('seed.sql'));
});

after(async () => {
  await db?.close();
});

test('SQL sinh ra chạy được, kể cả khi ghi chú có dấu nháy đơn', async () => {
  const { rules, problems } = parseRules(
    [
      makeRow({
        code: 'TEST-QUOTE',
        notes_vi: "Ống kính 'telecentric' — lưu ý dấu nháy đơn trong ghi chú",
        notes_en: "It's a quote test",
        condition_json: '{"all":[{"field":"tolerance_mm","op":"lt","value":0.05}]}',
      }),
    ],
    TASKS
  );
  assert.deepEqual(problems, []);

  await db.exec(toSql(rules));

  const saved = await db.query<{ notes_vi: string; priority: number }>(
    "select notes_vi, priority from public.selector_rules where code = 'TEST-QUOTE'"
  );
  assert.equal(saved.rows.length, 1);
  assert.ok(saved.rows[0].notes_vi.includes("'telecentric'"), 'dau nhay don bi mat');
});

test('chạy lại cùng SQL thì cập nhật, không nhân bản', async () => {
  const build = (camera: string) =>
    toSql(parseRules([makeRow({ code: 'TEST-IDEMPOTENT', recommended_camera: camera })], TASKS).rules);

  await db.exec(build('Camera lần 1'));
  await db.exec(build('Camera lần 2'));

  const saved = await db.query<{ recommended_camera: string }>(
    "select recommended_camera from public.selector_rules where code = 'TEST-IDEMPOTENT'"
  );
  assert.equal(saved.rows.length, 1, 'phai chi co dung 1 dong');
  assert.equal(saved.rows[0].recommended_camera, 'Camera lần 2');
});
