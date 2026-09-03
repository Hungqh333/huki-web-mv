-- =============================================================================
-- Machine Vision Hub — Schema khởi tạo
-- Tương ứng CLAUDE.md mục 2 (vai trò người dùng) và mục 7 (data model).
--
-- Nguyên tắc: phân quyền được thực thi ở tầng database bằng Row Level Security.
-- Giao diện chỉ phản ánh lại luật này cho đẹp, KHÔNG phải là lớp bảo vệ.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Kiểu dữ liệu
-- -----------------------------------------------------------------------------

-- Vai trò người dùng. 'guest' không nằm ở đây: khách chưa đăng nhập đơn giản là
-- không có dòng nào trong profiles.
do $$ begin
  create type public.user_role as enum ('registered', 'member', 'vip', 'admin');
exception when duplicate_object then null;
end $$;

-- Mức truy cập gắn trên từng bài viết / tính năng.
do $$ begin
  create type public.access_tier as enum ('public', 'registered', 'member', 'vip');
exception when duplicate_object then null;
end $$;

-- Hướng giải quyết bài toán mà bảng luật gợi ý (CLAUDE.md mục 4).
do $$ begin
  create type public.solution_approach as enum ('rule_based', 'deep_learning', 'hybrid');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Hàm tiện ích chung
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Thứ hạng của một access_tier. Dùng để so sánh "quyền của tôi >= yêu cầu của bài".
create or replace function public.tier_rank(t public.access_tier)
returns integer
language sql
immutable
as $$
  select case t
    when 'public'     then 0
    when 'registered' then 1
    when 'member'     then 2
    when 'vip'        then 3
  end;
$$;

-- Mức truy cập cao nhất mà một vai trò được phép đọc (ma trận ở CLAUDE.md mục 2).
create or replace function public.role_max_tier(r public.user_role)
returns integer
language sql
immutable
as $$
  select case r
    when 'registered' then 1  -- public + registered
    when 'member'     then 2  -- + member
    when 'vip'        then 3  -- tất cả
    when 'admin'      then 3  -- tất cả
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Bảng profiles — mở rộng auth.users của Supabase
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text,
  company    text,
  role       public.user_role not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'Mặc định luôn là registered. Chỉ admin mới đổi được (xem trigger enforce_profile_role_change).';

create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Hàm đọc quyền của người dùng hiện tại
--
-- Bắt buộc SECURITY DEFINER: các policy của những bảng khác cần đọc profiles,
-- nếu đọc trực tiếp qua RLS sẽ gây đệ quy vô hạn trên chính bảng profiles.
-- `set search_path = public` để chống tấn công chiếm quyền qua search_path.
-- -----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Khách chưa đăng nhập -> không có profile -> 0 (chỉ đọc được tier 'public').
create or replace function public.current_max_tier()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.role_max_tier((select p.role from public.profiles p where p.id = auth.uid())), 0);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false);
$$;

-- Member trở lên = được dùng bộ chọn thiết bị (CLAUDE.md mục 2).
create or replace function public.is_member_plus()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('member', 'vip', 'admin') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. Tự động tạo profile khi có user mới
--
-- QUAN TRỌNG VỀ BẢO MẬT: role KHÔNG bao giờ được đọc từ raw_user_meta_data.
-- Metadata do client gửi lên khi đăng ký, nếu tin nó thì bất kỳ ai cũng có thể
-- tự đăng ký thành admin. Role luôn lấy giá trị mặc định 'registered'.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, company)
  values (
    new.id,
    -- auth.users.email có thể NULL (đăng nhập bằng SĐT/OAuth thiếu email).
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'company'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Giữ profiles.email đồng bộ khi user đổi email trong auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- 6. Chặn tự nâng quyền
--
-- RLS cho phép user sửa dòng profile của chính mình (để đổi tên/công ty), nhưng
-- Postgres không có RLS ở mức cột. Trigger này đảm bảo cột role chỉ đổi được bởi
-- admin, hoặc bởi ngữ cảnh không có JWT (service_role / SQL editor) — dùng khi
-- seed tài khoản admin đầu tiên.
-- -----------------------------------------------------------------------------

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Chỉ admin mới được thay đổi role.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_change on public.profiles;
create trigger profiles_enforce_role_change
  before update on public.profiles
  for each row execute function public.enforce_profile_role_change();

-- -----------------------------------------------------------------------------
-- 7. task_types — danh mục bài toán
-- -----------------------------------------------------------------------------

create table if not exists public.task_types (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_vi        text not null,
  name_en        text not null,
  description_vi text,
  description_en text,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.task_types is
  'Thêm bài toán mới (3D, OCR/OCV, barcode, robot guidance) = thêm dòng ở đây, không sửa code.';

drop trigger if exists task_types_set_updated_at on public.task_types;
create trigger task_types_set_updated_at
  before update on public.task_types
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. selector_rules — bảng luật gợi ý thiết bị
-- -----------------------------------------------------------------------------

create table if not exists public.selector_rules (
  id                   uuid primary key default gen_random_uuid(),
  task_type_id         uuid not null references public.task_types (id) on delete cascade,
  condition_json       jsonb not null default '{}'::jsonb,
  recommended_camera   text,
  recommended_lighting text,
  recommended_lens     text,
  ai_or_rule_based     public.solution_approach not null default 'rule_based',
  notes_vi             text,
  notes_en             text,
  priority             integer not null default 100,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.selector_rules.priority is
  'Số nhỏ = ưu tiên cao. Thứ tự ưu tiên nghiệp vụ: ổn định > chính xác > tốc độ > bảo trì > triển khai > chi phí.';

create index if not exists selector_rules_task_type_idx on public.selector_rules (task_type_id, priority);
create index if not exists selector_rules_condition_idx on public.selector_rules using gin (condition_json);

drop trigger if exists selector_rules_set_updated_at on public.selector_rules;
create trigger selector_rules_set_updated_at
  before update on public.selector_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. selector_history — lịch sử chạy công cụ
-- -----------------------------------------------------------------------------

create table if not exists public.selector_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  task_type_id uuid references public.task_types (id) on delete set null,
  input_json   jsonb not null,
  result_json  jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists selector_history_user_idx on public.selector_history (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 10. categories + articles — cẩm nang
-- -----------------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_vi    text not null,
  name_en    text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title_vi     text not null,
  title_en     text not null,
  content_vi   text,
  content_en   text,
  category_id  uuid references public.categories (id) on delete set null,
  access_tier  public.access_tier not null default 'public',
  cover_image  text,
  author_id    uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.articles.published_at is
  'NULL = bản nháp, chỉ admin xem được.';

create index if not exists articles_published_idx on public.articles (published_at desc);
create index if not exists articles_category_idx on public.articles (category_id);
create index if not exists articles_tier_idx on public.articles (access_tier);

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 11. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.task_types       enable row level security;
alter table public.selector_rules   enable row level security;
alter table public.selector_history enable row level security;
alter table public.categories       enable row level security;
alter table public.articles         enable row level security;

-- --- profiles ---------------------------------------------------------------
-- Chỉ xem được profile của chính mình; admin xem được tất cả.

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- Sửa được dòng của mình (tên, công ty). Cột role bị trigger ở mục 6 chặn.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Không có policy INSERT/DELETE: profile do trigger on_auth_user_created tạo và
-- bị xoá theo cascade khi auth.users bị xoá.

-- --- task_types -------------------------------------------------------------
-- Đọc công khai: trang giới thiệu bộ chọn thiết bị (dành cho Guest/Registered)
-- cần liệt kê tên các bài toán để làm marketing. Bản thân tên bài toán không
-- phải thông tin nhạy cảm — dữ liệu nhạy cảm nằm ở selector_rules.

drop policy if exists "task_types_select_all" on public.task_types;
create policy "task_types_select_all"
  on public.task_types for select
  to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "task_types_write_admin" on public.task_types;
create policy "task_types_write_admin"
  on public.task_types for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- selector_rules ---------------------------------------------------------
-- Chỉ Member trở lên được đọc. Chỉ admin được ghi (CLAUDE.md mục 6).

drop policy if exists "selector_rules_select_member_plus" on public.selector_rules;
create policy "selector_rules_select_member_plus"
  on public.selector_rules for select
  to authenticated
  using (public.is_member_plus() and (is_active or public.is_admin()));

drop policy if exists "selector_rules_write_admin" on public.selector_rules;
create policy "selector_rules_write_admin"
  on public.selector_rules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- selector_history -------------------------------------------------------
-- Chỉ Member trở lên được ghi, và chỉ đọc được lịch sử của chính mình.

drop policy if exists "selector_history_select_own" on public.selector_history;
create policy "selector_history_select_own"
  on public.selector_history for select
  to authenticated
  using ((user_id = auth.uid() and public.is_member_plus()) or public.is_admin());

drop policy if exists "selector_history_insert_own_member_plus" on public.selector_history;
create policy "selector_history_insert_own_member_plus"
  on public.selector_history for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_member_plus());

drop policy if exists "selector_history_delete_own" on public.selector_history;
create policy "selector_history_delete_own"
  on public.selector_history for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- --- categories -------------------------------------------------------------

drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all"
  on public.categories for select
  to anon, authenticated
  using (true);

drop policy if exists "categories_write_admin" on public.categories;
create policy "categories_write_admin"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- articles ---------------------------------------------------------------
-- Đây là chốt chặn thật của việc gating nội dung: chỉ trả về TOÀN VĂN bài viết
-- khi tier của bài <= quyền của người đọc. Bài bị khoá không lộ content dù gọi
-- thẳng REST API. Phần teaser cho marketing đi qua view article_previews ở dưới.

drop policy if exists "articles_select_by_tier" on public.articles;
create policy "articles_select_by_tier"
  on public.articles for select
  to anon, authenticated
  using (
    (published_at is not null and published_at <= now()
     and public.tier_rank(access_tier) <= public.current_max_tier())
    or public.is_admin()
  );

drop policy if exists "articles_write_admin" on public.articles;
create policy "articles_write_admin"
  on public.articles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 12. View teaser cho trang danh sách cẩm nang
--
-- CLAUDE.md mục 5 yêu cầu bài bị khoá vẫn hiện tiêu đề + đoạn mở đầu để làm
-- marketing. View này chạy với quyền của owner (security_invoker = off) nên đi
-- vòng qua RLS của articles — vì vậy nó CHỈ để lộ đúng các cột không nhạy cảm
-- và một đoạn teaser đã cắt ngắn, không bao giờ trả về toàn văn content.
-- -----------------------------------------------------------------------------

create or replace view public.article_previews
with (security_invoker = off) as
select
  a.id,
  a.slug,
  a.title_vi,
  a.title_en,
  a.category_id,
  a.access_tier,
  a.cover_image,
  a.author_id,
  a.published_at,
  public.tier_rank(a.access_tier) > public.current_max_tier() as is_locked,
  left(regexp_replace(coalesce(a.content_vi, ''), '<[^>]*>', ' ', 'g'), 300) as teaser_vi,
  left(regexp_replace(coalesce(a.content_en, ''), '<[^>]*>', ' ', 'g'), 300) as teaser_en
from public.articles a
where a.published_at is not null
  and a.published_at <= now();

comment on view public.article_previews is
  'Chỉ teaser đã cắt ngắn. Toàn văn luôn phải đọc từ bảng articles (có RLS).';

-- =============================================================================
-- 13. Quyền cấp phát (RLS ở trên mới là lớp quyết định)
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Supabase cấu hình default privileges cấp quyền rộng cho anon/authenticated trên
-- mọi bảng mới trong schema public. RLS ở trên đã chặn, nhưng thu hồi tường minh
-- để khách vãng lai không chạm được vào các bảng nhạy cảm kể cả khi một policy
-- nào đó bị sửa sai sau này (phòng thủ nhiều lớp).
revoke all on public.profiles         from anon;
revoke all on public.selector_rules   from anon;
revoke all on public.selector_history from anon;

grant select                         on public.profiles         to authenticated;
grant update                         on public.profiles         to authenticated;
grant select                         on public.task_types       to anon, authenticated;
grant insert, update, delete         on public.task_types       to authenticated;
grant select, insert, update, delete on public.selector_rules   to authenticated;
grant select, insert, delete         on public.selector_history to authenticated;
grant select                         on public.categories       to anon, authenticated;
grant insert, update, delete         on public.categories       to authenticated;
grant select, insert, update, delete on public.articles         to authenticated;
grant select                         on public.articles         to anon;
grant select                         on public.article_previews to anon, authenticated;

grant execute on function public.tier_rank(public.access_tier)      to anon, authenticated;
grant execute on function public.role_max_tier(public.user_role)    to anon, authenticated;
grant execute on function public.current_user_role()                to anon, authenticated;
grant execute on function public.current_max_tier()                 to anon, authenticated;
grant execute on function public.is_admin()                         to anon, authenticated;
grant execute on function public.is_member_plus()                   to anon, authenticated;
