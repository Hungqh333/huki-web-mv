-- =============================================================================
-- Bảng quyền theo vai trò — Admin chỉnh trên Admin → Người dùng (chốt 2026-11-07, Q1–Q6, đợt 2)
--
-- Q1  Mỗi nhóm chức năng có MỨC TỐI THIỂU (registered < member < vip < admin); mức cao có quyền mức thấp.
-- Q2  Chỉ 8 nhóm dưới đây sửa được. Công thức, sửa dữ liệu, trang Quản trị vẫn is_admin(); cẩm nang theo
--     access_tier từng bài — không nằm ở bảng này.
-- Q3  Thấp nhất là 'registered' (không mở cho khách chưa đăng nhập).
-- Q6  Mỗi lần đổi mức ghi vào role_permission_log (ai, lúc nào, mức cũ → mới).
--
-- Mọi chính sách RLS trước dùng is_member_plus() cho dữ liệu công cụ nay dùng has_feature('<nhóm>'),
-- nên đổi mức ở bảng là đổi quyền thật ở database, không chỉ ở giao diện.
-- Bảng dùng chung nhiều nhóm (kho linh kiện) mở khi người xem có MỘT trong các nhóm cần nó.
-- Mặc định = quyền trước đây (7 nhóm Member, PDF VIP) → dán xong không ai đổi quyền.
-- Chạy lại nhiều lần không sao.
-- =============================================================================

-- ── 1. Thứ bậc vai trò ──
create or replace function public.role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role when 'registered' then 1 when 'member' then 2 when 'vip' then 3 when 'admin' then 4 else 0 end;
$$;

-- ── 2. Bảng quyền ──
create table if not exists public.role_permissions (
  feature     text primary key,
  min_role    text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  constraint role_permissions_feature_check check (feature in (
    'visionEngineer', 'equipment', 'catalog', 'kpi', 'oldSelector', 'projects', 'pcVision', 'pdf'
  )),
  constraint role_permissions_min_role_check check (min_role in ('registered', 'member', 'vip', 'admin'))
);

insert into public.role_permissions (feature, min_role) values
  ('visionEngineer', 'member'),
  ('equipment', 'member'),
  ('catalog', 'member'),
  ('kpi', 'member'),
  ('oldSelector', 'member'),
  ('projects', 'member'),
  ('pcVision', 'member'),
  ('pdf', 'vip')
on conflict (feature) do nothing;

-- ── 3. Kiểm tra quyền: người đang đăng nhập có đạt mức tối thiểu của nhóm không ──
-- Nhóm không có trong bảng → coi như chỉ Admin (đóng khi thiếu, không mở nhầm).
create or replace function public.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.role_rank(p.role::text) >= public.role_rank(
              coalesce((select rp.min_role from public.role_permissions rp where rp.feature = p_feature), 'admin'))
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

-- ── 4. Lịch sử đổi mức (Q6) ──
create table if not exists public.role_permission_log (
  id           bigint generated always as identity primary key,
  feature      text not null,
  old_min_role text,
  new_min_role text not null,
  actor_id     uuid,                                   -- null = dán SQL / service_role
  changed_at   timestamptz not null default now()
);
create index if not exists role_permission_log_time_idx on public.role_permission_log (changed_at desc);

create or replace function public.role_permissions_before_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.role_permissions_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.min_role is distinct from old.min_role then
    insert into public.role_permission_log (feature, old_min_role, new_min_role, actor_id)
    values (new.feature, old.min_role, new.min_role, auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists role_permissions_before_update on public.role_permissions;
create trigger role_permissions_before_update
  before update on public.role_permissions
  for each row execute function public.role_permissions_before_update();

drop trigger if exists role_permissions_log_change on public.role_permissions;
create trigger role_permissions_log_change
  after update on public.role_permissions
  for each row execute function public.role_permissions_log_change();

-- ── 5. Quyền trên chính bảng quyền: ai đăng nhập cũng đọc được mức; chỉ Admin sửa; không thêm, không xoá ──
alter table public.role_permissions enable row level security;
alter table public.role_permission_log enable row level security;

drop policy if exists "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select"
  on public.role_permissions for select
  to authenticated
  using (true);

drop policy if exists "role_permissions_update_admin" on public.role_permissions;
create policy "role_permissions_update_admin"
  on public.role_permissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "role_permission_log_select_admin" on public.role_permission_log;
create policy "role_permission_log_select_admin"
  on public.role_permission_log for select
  to authenticated
  using (public.is_admin());

revoke all on public.role_permissions from anon;
revoke insert, delete, truncate on public.role_permissions from authenticated;
grant select, update on public.role_permissions to authenticated;
revoke all on public.role_permission_log from anon, authenticated;
grant select on public.role_permission_log to authenticated;

grant execute on function public.role_rank(text) to anon, authenticated;
grant execute on function public.has_feature(text) to anon, authenticated;

-- ── 6. Chính sách dữ liệu công cụ: is_member_plus() → has_feature(nhóm) ──

-- Bộ chọn cũ (Gợi ý cấu hình) — luật + lịch sử dùng.
drop policy if exists "selector_rules_select_member_plus" on public.selector_rules;
create policy "selector_rules_select_member_plus"
  on public.selector_rules for select
  to authenticated
  using (public.has_feature('oldSelector') and (is_active or public.is_admin()));

drop policy if exists "selector_history_select_own" on public.selector_history;
create policy "selector_history_select_own"
  on public.selector_history for select
  to authenticated
  using ((user_id = auth.uid() and public.has_feature('oldSelector')) or public.is_admin());

drop policy if exists "selector_history_insert_own_member_plus" on public.selector_history;
create policy "selector_history_insert_own_member_plus"
  on public.selector_history for insert
  to authenticated
  with check (user_id = auth.uid() and public.has_feature('oldSelector'));

-- Chỉ tiêu.
drop policy if exists "kpi_problem_types_select_member_plus" on public.kpi_problem_types;
create policy "kpi_problem_types_select_member_plus"
  on public.kpi_problem_types for select
  to authenticated
  using (public.has_feature('kpi') and (is_active or public.is_admin()));

drop policy if exists "kpi_modifiers_select_member_plus" on public.kpi_modifiers;
create policy "kpi_modifiers_select_member_plus"
  on public.kpi_modifiers for select
  to authenticated
  using (public.has_feature('kpi') and (is_active or public.is_admin()));

drop policy if exists "kpi_config_select_member_plus" on public.kpi_config;
create policy "kpi_config_select_member_plus"
  on public.kpi_config for select
  to authenticated
  using (public.has_feature('kpi'));

drop policy if exists "kpi_tightening_select_member_plus" on public.kpi_tightening_factors;
create policy "kpi_tightening_select_member_plus"
  on public.kpi_tightening_factors for select
  to authenticated
  using (public.has_feature('kpi'));

-- Kho linh kiện: dùng chung cho Danh mục, Chọn thiết bị, Vision Engineer, bộ chọn cũ, Dự án (BOM).
drop policy if exists "components_select_member_plus" on public.components;
create policy "components_select_member_plus"
  on public.components for select
  to authenticated
  using (
    (public.has_feature('catalog') or public.has_feature('equipment') or public.has_feature('visionEngineer')
      or public.has_feature('oldSelector') or public.has_feature('projects'))
    and (is_active or public.is_admin())
  );

-- Dự án.
drop policy if exists "projects_select_own_member_plus" on public.projects;
create policy "projects_select_own_member_plus"
  on public.projects for select
  to authenticated
  using ((user_id = auth.uid() and public.has_feature('projects')) or public.is_admin());

drop policy if exists "projects_insert_own_member_plus" on public.projects;
create policy "projects_insert_own_member_plus"
  on public.projects for insert
  to authenticated
  with check (user_id = auth.uid() and public.has_feature('projects'));

drop policy if exists "projects_update_own_member_plus" on public.projects;
create policy "projects_update_own_member_plus"
  on public.projects for update
  to authenticated
  using (user_id = auth.uid() and public.has_feature('projects'))
  with check (user_id = auth.uid() and public.has_feature('projects'));

drop policy if exists "project_revisions_select_own_member_plus" on public.project_revisions;
create policy "project_revisions_select_own_member_plus"
  on public.project_revisions for select
  to authenticated
  using (
    public.is_admin()
    or (public.has_feature('projects') and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid()))
  );

drop policy if exists "project_revisions_insert_own_member_plus" on public.project_revisions;
create policy "project_revisions_insert_own_member_plus"
  on public.project_revisions for insert
  to authenticated
  with check (
    public.has_feature('projects') and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid())
  );

drop policy if exists "project_revisions_update_open_own" on public.project_revisions;
create policy "project_revisions_update_open_own"
  on public.project_revisions for update
  to authenticated
  using (
    locked_at is null and public.has_feature('projects') and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid())
  )
  with check (
    public.has_feature('projects') and exists (
      select 1 from public.projects p
       where p.id = project_revisions.project_id and p.user_id = auth.uid())
  );

-- Chọn đèn: ảnh mẫu + thực nghiệm (bảng và thư mục ảnh).
drop policy if exists "lighting_samples_read_member" on storage.objects;
create policy "lighting_samples_read_member"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lighting-samples' and public.has_feature('equipment'));

drop policy if exists "lighting_samples_select_member" on public.lighting_samples;
create policy "lighting_samples_select_member"
  on public.lighting_samples for select
  to authenticated
  using (public.has_feature('equipment'));

drop policy if exists "light_experiments_read_member" on storage.objects;
create policy "light_experiments_read_member"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'light-experiments' and public.has_feature('equipment'));

drop policy if exists "light_experiments_select" on public.light_experiments;
create policy "light_experiments_select"
  on public.light_experiments for select
  to authenticated
  using (public.is_admin() or (public.has_feature('equipment') and status = 'published'));

drop policy if exists "light_experiment_items_select" on public.light_experiment_items;
create policy "light_experiment_items_select"
  on public.light_experiment_items for select
  to authenticated
  using (public.has_feature('equipment') and exists (select 1 from public.light_experiments e where e.id = experiment_id));

drop policy if exists "light_experiment_trials_select" on public.light_experiment_trials;
create policy "light_experiment_trials_select"
  on public.light_experiment_trials for select
  to authenticated
  using (public.has_feature('equipment') and exists (select 1 from public.light_experiments e where e.id = experiment_id));

drop policy if exists "light_experiment_images_select" on public.light_experiment_images;
create policy "light_experiment_images_select"
  on public.light_experiment_images for select
  to authenticated
  using (public.has_feature('equipment') and exists (select 1 from public.light_experiments e where e.id = experiment_id));

-- PC Vision.
drop policy if exists "pc_frames_select_member" on public.pc_frames;
create policy "pc_frames_select_member"
  on public.pc_frames for select
  to authenticated
  using (public.has_feature('pcVision'));

drop policy if exists "pc_configs_select_member" on public.pc_configs;
create policy "pc_configs_select_member"
  on public.pc_configs for select
  to authenticated
  using (public.has_feature('pcVision'));
