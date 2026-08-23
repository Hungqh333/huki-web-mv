/**
 * Mutation test cho bộ kiểm chứng RLS.
 *
 *   npm run test:db:mutate
 *
 * Câu hỏi cần trả lời: "bộ test RLS có thực sự phát hiện được lỗ hổng không, hay
 * chỉ chạy suông rồi báo pass?"
 *
 * Cách làm: cố tình phá từng luật bảo mật một, rồi chạy lại rls_smoke_test.sql.
 * Mọi mutation ĐỀU PHẢI bị bắt. Dòng "BỎ SÓT" nghĩa là bộ test có điểm mù —
 * cần bổ sung assert cho luật đó.
 *
 * Chạy lại script này mỗi khi sửa policy trong migration.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_DIR = join(ROOT, 'supabase');
const read = (...parts) => readFileSync(join(SUPABASE_DIR, ...parts), 'utf8');

const AUTH_STUB = read('tests', 'auth_stub.sql');
const TEST = read('tests', 'rls_smoke_test.sql');
const MIGRATIONS = readdirSync(join(SUPABASE_DIR, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => read('migrations', f).replace(/create extension if not exists pgcrypto;/g, ''));

const MUTATIONS = [
  {
    name: 'Bỏ gating tier trên articles (ai cũng đọc được tất cả)',
    sql: `drop policy "articles_select_by_tier" on public.articles;
          create policy "articles_select_by_tier" on public.articles for select
            to anon, authenticated using (true);`,
  },
  {
    name: 'Bỏ trigger chặn tự nâng quyền',
    sql: `drop trigger profiles_enforce_role_change on public.profiles;`,
  },
  {
    name: 'Cho Registered ghi được selector_history',
    sql: `drop policy "selector_history_insert_own_member_plus" on public.selector_history;
          create policy "selector_history_insert_own_member_plus" on public.selector_history
            for insert to authenticated with check (user_id = auth.uid());`,
  },
  {
    name: 'Cho mọi authenticated đọc selector_rules',
    sql: `drop policy "selector_rules_select_member_plus" on public.selector_rules;
          create policy "selector_rules_select_member_plus" on public.selector_rules
            for select to authenticated using (true);`,
  },
  {
    name: 'handle_new_user tin role gửi lên từ client',
    sql: `create or replace function public.handle_new_user()
          returns trigger language plpgsql security definer set search_path = public as $fn$
          begin
            insert into public.profiles (id, email, name, company, role)
            values (new.id, coalesce(new.email,''), null, null,
                    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'registered'))
            on conflict (id) do nothing;
            return new;
          end $fn$;`,
  },
  {
    name: 'View teaser trả về toàn văn content',
    sql: `drop view public.article_previews;
          create view public.article_previews with (security_invoker = on) as
            select a.id, a.slug, a.title_vi, a.title_en, a.category_id, a.access_tier,
                   a.cover_image, a.author_id, a.published_at,
                   false as is_locked, a.content_vi as teaser_vi, a.content_en as teaser_en
            from public.articles a where a.published_at is not null;
          grant select on public.article_previews to anon, authenticated;`,
  },
];

let caught = 0;

for (const mutation of MUTATIONS) {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  for (const migration of MIGRATIONS) await db.exec(migration);

  try {
    await db.exec(mutation.sql);
  } catch (err) {
    console.log(`  ?       ${mutation.name}`);
    console.log(`          không áp dụng được mutation: ${err.message.split('\n')[0]}`);
    await db.close();
    continue;
  }

  let detail = null;
  try {
    await db.exec(TEST);
  } catch (err) {
    detail = err.message.split('\n')[0];
  }

  if (detail) {
    caught++;
    console.log(`  bắt được  ${mutation.name}`);
    console.log(`            -> ${detail}`);
  } else {
    console.log(`  BỎ SÓT    ${mutation.name}`);
  }

  await db.close();
}

console.log(`\n${caught}/${MUTATIONS.length} lỗ hổng cố ý bị bộ test phát hiện.`);

// Đặt exitCode thay vì gọi process.exit(): PGlite chạy trên WASM còn handle chưa
// đóng hẳn, gọi process.exit() ngay sẽ làm libuv abort và trả về exit code rác.
process.exitCode = caught === MUTATIONS.length ? 0 : 1;
