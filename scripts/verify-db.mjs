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
for (const seed of ['seed.sql', 'seed_kpi.sql', 'seed_components.sql']) {
  ok = (await step(db, seed, read(seed))) && ok;
  ok = (await step(db, `${seed} (lần 2 — phải idempotent)`, read(seed))) && ok;
}

console.log('\nKiểm chứng phân quyền');
ok = (await step(db, 'rls_smoke_test.sql', read('tests', 'rls_smoke_test.sql'))) && ok;

console.log(ok ? '\nTất cả đều qua.' : '\nCÓ LỖI — xem ở trên.');

await db.close();
process.exitCode = ok ? 0 : 1;
