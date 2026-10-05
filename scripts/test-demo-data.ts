/**
 * Dữ liệu chạy thử (scripts/c9/demoSql.ts) — chạy CHÍNH file SQL sẽ dán lên
 * production trên PGlite có đủ migration + seed, dán hai lần, rồi kiểm:
 * kho có giá + thông số, 15 bài đã đăng, dự án mẫu mở lại được trong ứng dụng,
 * và dữ liệu thật (nhà cung cấp thật, bài đã duyệt) không bị đè.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

import { DEMO_OWNER_EMAIL, DEMO_REVIEWER, renderDemoSql } from './c9/demoSql';
import { ESTIMATE_SUPPLIER } from './c9/estimates';
import { SAMPLE_PROJECT_NAME, sampleCatalog } from './c9/sample';
import { revisionToDraft } from '../src/lib/projects/model';
import { isBomSelection } from '../src/lib/vision/bomSelection';

const dir = join(process.cwd(), 'supabase');
const read = (...parts: string[]) => readFileSync(join(dir, ...parts), 'utf8').replace(/create extension if not exists pgcrypto;/g, '');
const SQL = renderDemoSql(sampleCatalog().filter((c) => !c.id.startsWith('demo-')));

async function database() {
  const db = await PGlite.create();
  await db.exec(read('tests', 'auth_stub.sql'));
  for (const file of readdirSync(join(dir, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) await db.exec(read('migrations', file));
  for (const seed of ['seed.sql', 'seed_components.sql', 'seed_rule_notes.sql']) await db.exec(read(seed));
  await db.exec(`insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values ('bbbbbbbb-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', '${DEMO_OWNER_EMAIL}', '{"name":"Hung"}'::jsonb);
    update public.profiles set role = 'admin' where email = '${DEMO_OWNER_EMAIL}';`);
  return db;
}
const one = async <T>(db: PGlite, sql: string) => (await db.query<T>(sql)).rows[0];

test('dán 2 lần: kho có giá + thông số, 15 bài đăng, đúng 1 dự án mẫu có BOM', async () => {
  const db = await database();
  // Dữ liệu "thật" có sẵn trước khi dán: phải giữ nguyên.
  await db.exec(`update public.components set price_vnd = 9999, supplier = 'NPP thật', spec = spec || '{"cpu_cores": 12}'::jsonb where code = 'PC-STD-GIGE';`);
  await db.exec(SQL);
  await db.exec(SQL);

  const priced = await one<{ n: number }>(db, `select count(*)::int n from public.components where supplier = '${ESTIMATE_SUPPLIER}' and price_vnd > 0`);
  assert.ok(priced.n >= 70, `chi ${priced.n} thiet bi co gia uoc tinh`);
  const lens = await one<{ spec: Record<string, unknown> }>(db, `select spec from public.components where code = 'LENS-COOLENS-FF25'`);
  assert.deepEqual([lens.spec.f_number_min, lens.spec.f_number_max, lens.spec.resolution_lp_mm, lens.spec.focal_length_mm], [2, 16, 160, 25], 'them khoa, giu khoa cu');
  const demo = await one<{ n: number }>(db, `select count(*)::int n from public.components where code like 'LENS-DEMO-%'`);
  assert.equal(demo.n, 3);

  const real = await one<{ price_vnd: number; supplier: string; spec: Record<string, unknown> }>(db, `select price_vnd, supplier, spec from public.components where code = 'PC-STD-GIGE'`);
  assert.deepEqual([Number(real.price_vnd), real.supplier, real.spec.cpu_cores], [9999, 'NPP thật', 12], 'khong de du lieu that');

  const notes = await one<{ n: number }>(db, `select count(*)::int n from public.articles where media_type = 'ruleNote' and published_at is not null and reviewed_by = '${DEMO_REVIEWER}'`);
  assert.equal(notes.n, 15);

  const projects = await db.query<{ id: string; name: string; application_type: string; status: string; created_at: string; updated_at: string; user_id: string }>(
    `select p.* from public.projects p join public.profiles u on u.id = p.user_id where u.email = '${DEMO_OWNER_EMAIL}'`
  );
  assert.equal(projects.rows.length, 1, 'dan lai khong nhan ban du an');
  assert.equal(projects.rows[0].name, SAMPLE_PROJECT_NAME);
  await db.close();
});

test('dự án mẫu mở lại được bằng đúng đường của ứng dụng, giữ lựa chọn phương án', async () => {
  const db = await database();
  await db.exec(SQL);
  const project = await one<Record<string, unknown>>(db, `select * from public.projects limit 1`);
  const revision = await one<Record<string, unknown>>(db, `select * from public.project_revisions where project_id = '${project.id}'`);
  assert.equal(revision.rev_label, 'A');
  const draft = revisionToDraft(project as never, revision as never);
  assert.ok(draft?.requirement, 'revisionToDraft doc duoc');
  assert.ok(isBomSelection(draft.bom), 'lua chon phuong an duoc khoi phuc');
  assert.equal(draft.bom!.level, 'recommended');
  const bom = revision.bom as { lines: unknown[]; level: string };
  assert.ok(bom.lines.length >= 10, `BOM chi co ${bom.lines.length} dong`);
  await db.close();
});

test('email khác: dự án mẫu gán cho admin cũ nhất', async () => {
  const db = await database();
  await db.exec(`update public.profiles set email = 'admin-khac@example.test' where email = '${DEMO_OWNER_EMAIL}';`);
  await db.exec(SQL);
  const owner = await one<{ email: string }>(db, `select u.email from public.projects p join public.profiles u on u.id = p.user_id`);
  assert.equal(owner?.email, 'admin-khac@example.test');
  await db.close();
});

test('không có tài khoản admin: bỏ qua dự án mẫu, phần kho + bài viết vẫn chạy', async () => {
  const db = await database();
  await db.exec(`delete from auth.users where email = '${DEMO_OWNER_EMAIL}';`);
  await db.exec(SQL);
  assert.equal((await one<{ n: number }>(db, `select count(*)::int n from public.projects`)).n, 0);
  assert.equal((await one<{ n: number }>(db, `select count(*)::int n from public.articles where media_type = 'ruleNote' and published_at is not null`)).n, 15);
  await db.close();
});
