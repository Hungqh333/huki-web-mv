-- =============================================================================
-- Dự án + Revision — V1a hạng mục 7 (spec V1.1 §11.3)
--
-- Người dùng lưu bảng tóm tắt yêu cầu thành DỰ ÁN, mở lại được sau. Mỗi lần gửi
-- khách một phiên bản thì KHOÁ revision đó và mở revision kế tiếp (A → B → C):
-- báo giá cũ phải tái lập được đúng nội dung lúc gửi, dù sau đó yêu cầu hay giả
-- định trong code đã đổi.
--
-- Quyết định đã duyệt (2026-09-14):
-- A. Revision mới nhất sửa được tới khi KHOÁ; revision đã khoá không sửa được.
-- B. status khai đủ 6 giá trị §11.3; V1a chỉ ghi 'draft'.
-- C. application_type là text + check, không dùng enum Postgres (thêm giá trị
--    vào enum rất khó — xem 20260905000001_component_kinds.sql).
-- D. Chưa gộp selector_history vào đây.
--
-- requirement lưu jsonb, không tách bảng: hợp đồng Requirement (Field<T> lồng
-- nhau, mảng detection[] / measurement[]) còn đổi thường xuyên, và revision là
-- ảnh chụp đọc nguyên khối. Kiểm hợp lệ ở TypeScript khi đọc (parseDraft), theo
-- schema_version.
--
-- assumptions là ẢNH CHỤP lúc lưu, không tính lại khi mở: giả định nằm trong
-- code và sẽ đổi (α nhựa đã đổi 80 → 120), mở lại revision cũ phải ra đúng số cũ.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. projects
-- -----------------------------------------------------------------------------

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  application_type text not null,
  status           text not null default 'draft',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint projects_name_check check (char_length(btrim(name)) between 1 and 200),
  -- Cùng danh sách với APPLICATION_TYPES (src/lib/visionEntry.ts) — test kiểm.
  constraint projects_application_type_check check (application_type in ('AppearanceInspection', 'Measurement', 'OCR', '3D', 'RobotGuidance', 'AIInspection', 'AssemblyInspection', 'Other')),
  -- Cùng danh sách với PROJECT_STATUSES (src/lib/projects/model.ts) — test kiểm.
  constraint projects_status_check check (status in ('draft', 'analysis', 'design', 'testing', 'validated', 'completed'))
);

comment on column public.projects.status is
  'Draft → Analysis → Design → Testing → Validated → Completed (§11.3). V1a chỉ dùng draft.';

create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. project_revisions
-- -----------------------------------------------------------------------------

create table if not exists public.project_revisions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  rev_label      text not null,

  -- Chỉ giá trị người dùng nhập (đúng như bản nháp), không có giá trị giả định.
  requirement    jsonb not null,
  -- Ảnh chụp danh sách Assumption lúc lưu.
  assumptions    jsonb not null default '[]'::jsonb,
  -- Mô tả gốc khách gõ ở trang chủ, nếu có.
  raw_text       text,
  -- Phiên bản hợp đồng Requirement (DRAFT_VERSION) để chuyển đổi khi đọc.
  schema_version integer not null,
  -- Phiên bản bộ luật đã dùng. V1a chưa có rule engine nên để trống (RULE_VERSION là V1b).
  rule_version   text,

  -- null = đang sửa. Có giá trị = đã khoá, không sửa được nữa.
  locked_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint project_revisions_label_check check (rev_label ~ '^[A-Z]{1,2}$'),
  constraint project_revisions_schema_version_check check (schema_version >= 1),
  constraint project_revisions_label_unique unique (project_id, rev_label)
);

create index if not exists project_revisions_project_idx on public.project_revisions (project_id, created_at);

-- Mỗi dự án có đúng MỘT revision đang sửa.
create unique index if not exists project_revisions_one_open_idx
  on public.project_revisions (project_id) where locked_at is null;

drop trigger if exists project_revisions_set_updated_at on public.project_revisions;
create trigger project_revisions_set_updated_at
  before update on public.project_revisions
  for each row execute function public.set_updated_at();

-- Revision đã khoá bất biến, kể cả với người sửa tay trong SQL Editor (không đi
-- qua RLS). Nhãn và dự án của revision cũng không đổi được.
create or replace function public.guard_project_revision_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is distinct from old.project_id or new.rev_label is distinct from old.rev_label then
    raise exception 'Không được đổi dự án hoặc nhãn của revision %', old.rev_label
      using errcode = 'integrity_constraint_violation';
  end if;
  if old.locked_at is not null then
    raise exception 'Revision % đã khoá, không sửa được', old.rev_label
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end $$;

drop trigger if exists project_revisions_guard on public.project_revisions;
create trigger project_revisions_guard
  before update on public.project_revisions
  for each row execute function public.guard_project_revision_update();

-- -----------------------------------------------------------------------------
-- 3. Hàm ghi — mỗi thao tác một transaction
--
-- Chạy với quyền NGƯỜI GỌI (security invoker): RLS bên dưới vẫn áp nguyên vẹn,
-- hàm chỉ gom nhiều câu lệnh cho khỏi ghi dở dang (có dự án mà không có Rev A;
-- đã khoá A mà chưa mở B).
-- -----------------------------------------------------------------------------

-- 0 → A … 25 → Z, 26 → AA … 701 → ZZ.
create or replace function public.revision_label(n integer)
returns text
language plpgsql
immutable
as $$
begin
  if n < 0 or n > 701 then
    raise exception 'Số thứ tự revision % ngoài dải A..ZZ', n using errcode = 'numeric_value_out_of_range';
  end if;
  if n < 26 then
    return chr(65 + n);
  end if;
  return chr(64 + n / 26) || chr(65 + n % 26);
end $$;

create or replace function public.create_project(
  p_name text,
  p_application_type text,
  p_requirement jsonb,
  p_assumptions jsonb,
  p_raw_text text,
  p_schema_version integer
)
returns table (new_project_id uuid, new_revision_id uuid, new_rev_label text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
  v_revision uuid;
begin
  insert into public.projects (user_id, name, application_type)
  values (auth.uid(), p_name, p_application_type)
  returning id into v_project;

  insert into public.project_revisions (project_id, rev_label, requirement, assumptions, raw_text, schema_version)
  values (v_project, 'A', p_requirement, coalesce(p_assumptions, '[]'::jsonb), p_raw_text, p_schema_version)
  returning id into v_revision;

  return query select v_project, v_revision, 'A'::text;
end $$;

-- Ghi đè revision ĐANG SỬA, đồng thời cập nhật tên + loại ứng dụng của dự án.
-- Revision đã khoá / không thấy (không phải của mình) → no_data_found, không
-- phân biệt hai trường hợp để khỏi lộ sự tồn tại của dữ liệu người khác.
create or replace function public.save_revision(
  p_revision_id uuid,
  p_name text,
  p_application_type text,
  p_requirement jsonb,
  p_assumptions jsonb,
  p_raw_text text,
  p_schema_version integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
begin
  update public.project_revisions r
     set requirement = p_requirement,
         assumptions = coalesce(p_assumptions, '[]'::jsonb),
         raw_text = p_raw_text,
         schema_version = p_schema_version
   where r.id = p_revision_id and r.locked_at is null
  returning r.project_id into v_project;

  if v_project is null then
    raise exception 'REVISION_NOT_EDITABLE' using errcode = 'no_data_found';
  end if;

  update public.projects p
     set name = p_name, application_type = p_application_type
   where p.id = v_project;

  if not found then
    raise exception 'PROJECT_NOT_EDITABLE' using errcode = 'no_data_found';
  end if;
end $$;

-- Khoá revision đang sửa rồi mở revision kế tiếp, chép nguyên nội dung đã lưu.
create or replace function public.start_next_revision(p_project_id uuid)
returns table (new_revision_id uuid, new_rev_label text, locked_rev_label text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_open public.project_revisions%rowtype;
  v_count integer;
  v_label text;
  v_revision uuid;
begin
  select * into v_open
    from public.project_revisions r
   where r.project_id = p_project_id and r.locked_at is null
   for update;

  if not found then
    raise exception 'NO_OPEN_REVISION' using errcode = 'no_data_found';
  end if;

  update public.project_revisions r set locked_at = now() where r.id = v_open.id;

  select count(*) into v_count from public.project_revisions r where r.project_id = p_project_id;
  v_label := public.revision_label(v_count);

  insert into public.project_revisions
    (project_id, rev_label, requirement, assumptions, raw_text, schema_version, rule_version)
  values
    (p_project_id, v_label, v_open.requirement, v_open.assumptions, v_open.raw_text, v_open.schema_version, v_open.rule_version)
  returning id into v_revision;

  update public.projects p set updated_at = now() where p.id = p_project_id;

  return query select v_revision, v_label, v_open.rev_label;
end $$;

-- =============================================================================
-- 4. ROW LEVEL SECURITY
--
-- Cùng quy ước với selector_history: Member trở lên, chỉ dữ liệu của chính mình;
-- admin đọc được để hỗ trợ. Revision không có policy xoá (chỉ mất theo dự án),
-- và admin cũng không sửa được nội dung revision.
-- =============================================================================

alter table public.projects          enable row level security;
alter table public.project_revisions enable row level security;

-- --- projects ---------------------------------------------------------------

drop policy if exists "projects_select_own_member_plus" on public.projects;
create policy "projects_select_own_member_plus"
  on public.projects for select
  to authenticated
  using ((user_id = auth.uid() and public.is_member_plus()) or public.is_admin());

drop policy if exists "projects_insert_own_member_plus" on public.projects;
create policy "projects_insert_own_member_plus"
  on public.projects for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_member_plus());

drop policy if exists "projects_update_own_member_plus" on public.projects;
create policy "projects_update_own_member_plus"
  on public.projects for update
  to authenticated
  using (user_id = auth.uid() and public.is_member_plus())
  with check (user_id = auth.uid() and public.is_member_plus());

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- --- project_revisions ------------------------------------------------------

drop policy if exists "project_revisions_select_own_member_plus" on public.project_revisions;
create policy "project_revisions_select_own_member_plus"
  on public.project_revisions for select
  to authenticated
  using (
    public.is_admin()
    or (public.is_member_plus() and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid()))
  );

drop policy if exists "project_revisions_insert_own_member_plus" on public.project_revisions;
create policy "project_revisions_insert_own_member_plus"
  on public.project_revisions for insert
  to authenticated
  with check (
    public.is_member_plus() and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid())
  );

-- Chỉ revision ĐANG SỬA của dự án mình. Revision đã khoá bị lọc ra (0 dòng).
drop policy if exists "project_revisions_update_open_own" on public.project_revisions;
create policy "project_revisions_update_open_own"
  on public.project_revisions for update
  to authenticated
  using (
    locked_at is null and public.is_member_plus() and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid())
  )
  with check (
    public.is_member_plus() and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 5. Quyền cấp phát (RLS ở trên mới là lớp quyết định)
-- -----------------------------------------------------------------------------

revoke all on public.projects          from anon;
revoke all on public.project_revisions from anon;

grant select, insert, update, delete on public.projects          to authenticated;
grant select, insert, update         on public.project_revisions to authenticated;

-- Supabase mặc định cấp mọi quyền trên bảng mới cho authenticated. Revision không
-- được xoá lẻ (chỉ mất theo dự án): thu hồi DELETE tường minh thay vì chỉ dựa vào
-- việc thiếu policy — nhờ vậy Supabase và PGlite (test:db) cho cùng một kết quả.
revoke delete on public.project_revisions from authenticated;

revoke all on function public.create_project(text, text, jsonb, jsonb, text, integer)              from public, anon;
revoke all on function public.save_revision(uuid, text, text, jsonb, jsonb, text, integer)        from public, anon;
revoke all on function public.start_next_revision(uuid)                                            from public, anon;

grant execute on function public.revision_label(integer)                                           to authenticated;
grant execute on function public.create_project(text, text, jsonb, jsonb, text, integer)           to authenticated;
grant execute on function public.save_revision(uuid, text, text, jsonb, jsonb, text, integer)     to authenticated;
grant execute on function public.start_next_revision(uuid)                                         to authenticated;
