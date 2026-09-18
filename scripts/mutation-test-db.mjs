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
    name: 'Cho mọi authenticated ghi bai viet (quan ly noi dung khong con gioi han o admin)',
    sql: `drop policy "articles_write_admin" on public.articles;
          create policy "articles_write_admin" on public.articles for all
            to authenticated using (true) with check (true);`,
  },
  {
    name: 'Cho moi authenticated doi role nguoi khac',
    sql: `drop trigger profiles_enforce_role_change on public.profiles;
          drop policy "profiles_update_own" on public.profiles;
          create policy "profiles_update_own" on public.profiles for update
            to authenticated using (true) with check (true);`,
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
  {
    name: 'Du an: moi authenticated doc duoc projects',
    sql: `drop policy "projects_select_own_member_plus" on public.projects;
          create policy "projects_select_own_member_plus" on public.projects for select
            to authenticated using (true);`,
  },
  {
    name: 'Du an: Registered tao duoc du an',
    sql: `drop policy "projects_insert_own_member_plus" on public.projects;
          create policy "projects_insert_own_member_plus" on public.projects for insert
            to authenticated with check (user_id = auth.uid());`,
  },
  {
    name: 'Du an: tao duoc du an dung ten nguoi khac',
    sql: `drop policy "projects_insert_own_member_plus" on public.projects;
          create policy "projects_insert_own_member_plus" on public.projects for insert
            to authenticated with check (public.is_member_plus());`,
  },
  {
    name: 'Du an: sua duoc du an cua nguoi khac',
    sql: `drop policy "projects_update_own_member_plus" on public.projects;
          create policy "projects_update_own_member_plus" on public.projects for update
            to authenticated using (true) with check (true);`,
  },
  // Không có mutation "xoá được dự án của người khác": DELETE chỉ chạm được dòng
  // mà policy ĐỌC cho thấy, và người duy nhất thấy dự án của người khác là admin —
  // đúng người policy xoá cho phép. Nới policy xoá thành using (true) vì vậy không
  // đổi hành vi (mutation tương đương). Lỗ hổng thật nằm ở policy đọc, đã có
  // mutation riêng ở trên.
  {
    name: 'Revision: doc duoc revision cua nguoi khac',
    sql: `drop policy "project_revisions_select_own_member_plus" on public.project_revisions;
          create policy "project_revisions_select_own_member_plus" on public.project_revisions for select
            to authenticated using (true);`,
  },
  {
    name: 'Revision: chen duoc revision vao du an nguoi khac',
    sql: `drop policy "project_revisions_insert_own_member_plus" on public.project_revisions;
          create policy "project_revisions_insert_own_member_plus" on public.project_revisions for insert
            to authenticated with check (true);`,
  },
  {
    name: 'Revision: RLS khong loc revision da khoa khi sua',
    sql: `drop policy "project_revisions_update_open_own" on public.project_revisions;
          create policy "project_revisions_update_open_own" on public.project_revisions for update
            to authenticated
            using (public.is_member_plus() and exists (select 1 from public.projects p
                   where p.id = project_revisions.project_id and p.user_id = auth.uid()))
            with check (true);`,
  },
  {
    name: 'Revision: bo index mot revision dang sua',
    sql: `drop index public.project_revisions_one_open_idx;`,
  },
  {
    name: 'Revision: bo trigger bao ve revision da khoa / nhan',
    sql: `drop trigger project_revisions_guard on public.project_revisions;`,
  },
  {
    name: 'Revision: cho xoa le revision',
    sql: `grant delete on public.project_revisions to authenticated;
          create policy "project_revisions_delete_any" on public.project_revisions for delete
            to authenticated using (true);`,
  },
  {
    name: 'Revision: start_next_revision chay quyen chu ham (bo qua RLS)',
    sql: `alter function public.start_next_revision(uuid) security definer;`,
  },
  {
    name: 'Ghi chu luat: bo rang buoc phai duyet truoc khi dang',
    sql: `alter table public.articles drop constraint articles_rule_note_reviewed_check;`,
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
