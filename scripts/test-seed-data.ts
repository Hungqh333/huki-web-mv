/**
 * Kiểm tra tính nhất quán giữa DỮ LIỆU trong seed và CATALOG trong code.
 *
 * Kiến trúc cho phép thêm bài toán mới chỉ bằng cách thêm dữ liệu — đổi lại,
 * gõ sai một tên trường sẽ không gây lỗi ở đâu cả: form lặng lẽ bỏ qua trường
 * đó, hoặc luật không bao giờ khớp. Không có test này thì lỗi chỉ lộ ra khi có
 * người dùng thật thắc mắc sao kết quả trống.
 *
 * Chạy trên Postgres in-process nên đọc đúng dữ liệu sau khi seed đã chạy,
 * thay vì cố dò bằng regex trên file SQL.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

import { validateCondition } from '../src/lib/selector/conditions';
import { DERIVED_FIELD_KEYS } from '../src/lib/selector/derivedKeys';
import { FIELD_CATALOG } from '../src/lib/selector/fields';

const SUPABASE_DIR = join(process.cwd(), 'supabase');
const read = (...parts: string[]) => readFileSync(join(SUPABASE_DIR, ...parts), 'utf8');
const strip = (sql: string) => sql.replace(/create extension if not exists pgcrypto;/g, '');

type TaskRow = { slug: string; input_fields: unknown };
type RuleRow = { code: string | null; slug: string; condition_json: unknown };

const KNOWN_FIELDS = new Set<string>([...Object.keys(FIELD_CATALOG), ...DERIVED_FIELD_KEYS]);

// tsx biên dịch .ts sang CJS nên không dùng được top-level await — dựng database
// trong hook before thay vì ở phạm vi module.
let db: PGlite;
let tasks: TaskRow[] = [];
let rules: RuleRow[] = [];

before(async () => {
  db = await PGlite.create();
  await db.exec(read('tests', 'auth_stub.sql'));

  const migrations = readdirSync(join(SUPABASE_DIR, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrations) {
    await db.exec(strip(read('migrations', file)));
  }
  await db.exec(read('seed.sql'));

  tasks = (await db.query<TaskRow>('select slug, input_fields from public.task_types order by slug'))
    .rows;
  rules = (
    await db.query<RuleRow>(
      `select r.code, t.slug, r.condition_json
       from public.selector_rules r
       join public.task_types t on t.id = r.task_type_id
       order by r.code`
    )
  ).rows;
});

after(async () => {
  await db?.close();
});

test('seed có đủ các bài toán, mỗi bài đều khai báo trường nhập liệu', () => {
  assert.ok(tasks.length >= 7, `chi co ${tasks.length} bai toan`);
  for (const task of tasks) {
    assert.ok(Array.isArray(task.input_fields), `${task.slug}: input_fields khong phai mang`);
    assert.ok((task.input_fields as unknown[]).length > 0, `${task.slug}: input_fields rong`);
  }
});

test('mọi key trong input_fields đều có trong catalog', () => {
  for (const task of tasks) {
    for (const key of task.input_fields as string[]) {
      assert.ok(
        FIELD_CATALOG[key],
        `${task.slug}: truong "${key}" khong co trong FIELD_CATALOG — form se bo qua truong nay`
      );
    }
  }
});

test('mỗi bài toán đều có ít nhất một trường bắt buộc', () => {
  for (const task of tasks) {
    const hasRequired = (task.input_fields as string[]).some((key) => FIELD_CATALOG[key]?.required);
    assert.ok(hasRequired, `${task.slug}: khong co truong bat buoc nao`);
  }
});

test('mọi condition_json đều đúng định dạng', () => {
  for (const rule of rules) {
    const problems = validateCondition(rule.condition_json);
    assert.equal(problems.length, 0, `${rule.code}: ${problems.join(' ')}`);
  }
});

test('mọi field trong điều kiện đều là field engine hiểu được', () => {
  for (const rule of rules) {
    const condition = rule.condition_json as { all?: { field: string }[] } | null;
    for (const predicate of condition?.all ?? []) {
      assert.ok(
        KNOWN_FIELDS.has(predicate.field),
        `${rule.code}: dieu kien dung "${predicate.field}" — khong co trong catalog, luat nay se KHONG BAO GIO khop`
      );
    }
  }
});

test('điều kiện chỉ dùng field thuộc chính bài toán đó, hoặc field engine tính ra', () => {
  const fieldsOf = new Map(tasks.map((t) => [t.slug, new Set(t.input_fields as string[])]));

  for (const rule of rules) {
    const condition = rule.condition_json as { all?: { field: string }[] } | null;
    for (const predicate of condition?.all ?? []) {
      if ((DERIVED_FIELD_KEYS as readonly string[]).includes(predicate.field)) continue;
      assert.ok(
        fieldsOf.get(rule.slug)?.has(predicate.field),
        `${rule.code}: dung "${predicate.field}" nhung bai toan "${rule.slug}" khong co truong do`
      );
    }
  }
});

test('mỗi bài toán đều có luật nền để không bao giờ trả kết quả trống', () => {
  const withBaseline = new Set(
    rules
      .filter((rule) => {
        const condition = rule.condition_json as { all?: unknown[] } | null;
        return !condition?.all || condition.all.length === 0;
      })
      .map((rule) => rule.slug)
  );

  for (const task of tasks) {
    assert.ok(withBaseline.has(task.slug), `${task.slug}: thieu luat nen (condition_json rong)`);
  }
});

