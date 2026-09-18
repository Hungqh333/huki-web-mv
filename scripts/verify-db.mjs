/**
 * Chạy migration + seed + bộ test RLS trên một Postgres thật chạy in-process
 * (PGlite, WebAssembly). Không cần Docker, không cần cài Postgres, không đụng
 * tới database Supabase thật.
 *
 *   npm run test:db
 *
 * Dùng để bắt lỗi cú pháp và lỗi logic phân quyền TRƯỚC khi dán SQL lên
 * Supabase Dashboard.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BUNDLES, renderBundle } from './sql-bundles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_DIR = join(ROOT, 'supabase');

const read = (...parts) => readFileSync(join(SUPABASE_DIR, ...parts), 'utf8');

/**
 * pgcrypto không có sẵn trong PGlite. gen_random_uuid() là hàm lõi từ
 * PostgreSQL 13 nên bỏ dòng create extension đi vẫn chạy đúng. Đây là khác biệt
 * DUY NHẤT giữa SQL chạy ở đây và SQL chạy trên Supabase.
 */
const stripPgcrypto = (sql) => sql.replace(/create extension if not exists pgcrypto;/g, '');

async function step(db, label, sql) {
  try {
    await db.exec(sql);
    console.log(`  ok    ${label}`);
    return true;
  } catch (err) {
    console.error(`  LỖI  ${label}`);
    console.error(`        ${err.message.split('\n')[0]}`);
    if (err.position) {
      const pos = Number(err.position);
      console.error(`        ...${sql.slice(Math.max(0, pos - 120), pos + 120).trim()}...`);
    }
    return false;
  }
}

const migrations = readdirSync(join(SUPABASE_DIR, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();

const db = await PGlite.create();
const version = (await db.query('select version()')).rows[0].version.split(',')[0];
console.log(`${version}\n`);

let ok = true;

console.log('Dựng stub schema auth của Supabase');
ok = (await step(db, 'auth_stub.sql', read('tests', 'auth_stub.sql'))) && ok;

console.log('\nÁp dụng migration');
for (const file of migrations) {
  ok = (await step(db, file, stripPgcrypto(read('migrations', file)))) && ok;
}

/*
 * Áp lại toàn bộ migration lần thứ hai.
 *
 * Dự án không chạy Supabase CLI — mọi thay đổi database đều dán tay vào SQL
 * Editor, nên dán trùng một file là chuyện bình thường chứ không phải tai nạn
 * hiếm. Migration phải chịu được điều đó, nếu không người dán chỉ nhận về
 * "type ... already exists" và không biết database đang ở trạng thái nào.
 */
console.log('\nÁp lại migration lần hai (phải idempotent)');
for (const file of migrations) {
  ok = (await step(db, `${file} (lần 2)`, stripPgcrypto(read('migrations', file)))) && ok;
}

console.log('\nNạp dữ liệu tham chiếu');
for (const seed of ['seed.sql', 'seed_kpi.sql', 'seed_components.sql', 'seed_rule_notes.sql']) {
  ok = (await step(db, seed, read(seed))) && ok;
  ok = (await step(db, `${seed} (lần 2 — phải idempotent)`, read(seed))) && ok;
}

console.log('\nKiểm chứng phân quyền');
ok = (await step(db, 'rls_smoke_test.sql', read('tests', 'rls_smoke_test.sql'))) && ok;

await db.close();

/*
 * Chạy thử CHÍNH file CHAY-BUOC-NAY*.sql người dùng dán.
 *
 * Phần trên áp mọi migration rồi mới nạp seed, nên bundle ghép thiếu migration
 * vẫn qua — seed_components.sql cần 'tube' mà bundle cũ không có migration đổi
 * enum sang text, và vỡ trên Supabase. Ở đây mỗi bundle chạy trên database mới
 * chỉ có các migration CŨ HƠN migration đầu tiên của nó, đúng như database thật
 * lúc người dùng dán, rồi dán lần hai để chắc chạy lại được.
 */
console.log('\nChạy thử từng file CHAY-BUOC-NAY (database chỉ có migration cũ hơn)');
for (const bundle of Object.values(BUNDLES)) {
  const first = bundle.parts.map(([, path]) => path).find((path) => path.includes('/migrations/'));
  const older = migrations.filter((file) => `supabase/migrations/${file}` < first);
  const sql = stripPgcrypto(renderBundle(bundle, (path) => readFileSync(join(ROOT, path), 'utf8')));

  const fresh = await PGlite.create();
  let ready = await step(fresh, `${bundle.out}: auth_stub + ${older.length} migration cũ hơn`, [
    read('tests', 'auth_stub.sql'),
    ...older.map((file) => stripPgcrypto(read('migrations', file))),
  ].join('\n'));
  ready = ready && (await step(fresh, bundle.out, sql));
  ready = ready && (await step(fresh, `${bundle.out} (lần 2)`, sql));
  ok = ready && ok;
  await fresh.close();
}

console.log(ok ? '\nTất cả đều qua.' : '\nCÓ LỖI — xem ở trên.');

process.exitCode = ok ? 0 : 1;
