-- =============================================================================
-- BOM trong revision dự án (V1c mục C5, spec V1.1 §11.2–§11.3)
--
-- Revision là ẢNH CHỤP: yêu cầu + giả định + BOM tại thời điểm lưu. BOM lưu
-- kèm giá / thời gian giao / nhà cung cấp LÚC LƯU, để báo giá cũ tái lập được
-- khi giá trong kho đã đổi. Khoá revision thì BOM cũng khoá (trigger
-- guard_project_revision_update chặn mọi cột).
--
-- Nội dung `bom` do SERVER dựng lại từ kho thiết bị (src/lib/vision/bom.ts),
-- trình duyệt chỉ gửi lựa chọn (mức giải pháp, số lượng, dòng bỏ / thêm).
--
-- `rule_version` có từ migration dự án nhưng để trống; từ giờ ghi phiên bản bộ
-- luật đã dùng (RULESET_VERSION) — spec §11.3 "lưu kèm ruleVersion".
--
-- Tương thích ngược: hai tham số mới đứng CUỐI và có mặc định null, nên code
-- cũ (chưa deploy bản C5) gọi 7 tham số vẫn chạy. Nhờ vậy dán file này TRƯỚC
-- khi push là an toàn. Phải drop hàm cũ trước: create or replace với danh sách
-- tham số khác sẽ tạo HÀM THỨ HAI cùng tên, và lời gọi 7 tham số thành mơ hồ.
-- =============================================================================

alter table public.project_revisions
  add column if not exists bom jsonb;

comment on column public.project_revisions.bom is
  'Ảnh chụp BOM lúc lưu (src/lib/vision/bom.ts, BomSnapshot). null = chưa chọn phương án.';

drop function if exists public.create_project(text, text, jsonb, jsonb, text, integer);
drop function if exists public.save_revision(uuid, text, text, jsonb, jsonb, text, integer);

create or replace function public.create_project(
  p_name text,
  p_application_type text,
  p_requirement jsonb,
  p_assumptions jsonb,
  p_raw_text text,
  p_schema_version integer,
  p_bom jsonb default null,
  p_rule_version text default null
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

  insert into public.project_revisions (project_id, rev_label, requirement, assumptions, raw_text, schema_version, bom, rule_version)
  values (v_project, 'A', p_requirement, coalesce(p_assumptions, '[]'::jsonb), p_raw_text, p_schema_version, p_bom, p_rule_version)
  returning id into v_revision;

  return query select v_project, v_revision, 'A'::text;
end $$;

create or replace function public.save_revision(
  p_revision_id uuid,
  p_name text,
  p_application_type text,
  p_requirement jsonb,
  p_assumptions jsonb,
  p_raw_text text,
  p_schema_version integer,
  p_bom jsonb default null,
  p_rule_version text default null
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
         schema_version = p_schema_version,
         bom = p_bom,
         rule_version = p_rule_version
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

-- Revision mới chép nguyên BOM của revision vừa khoá — khách đổi yêu cầu thì
-- sửa trên bản chép, bản cũ giữ nguyên để so sánh Rev A / Rev B.
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
    (project_id, rev_label, requirement, assumptions, raw_text, schema_version, rule_version, bom)
  values
    (p_project_id, v_label, v_open.requirement, v_open.assumptions, v_open.raw_text, v_open.schema_version, v_open.rule_version, v_open.bom)
  returning id into v_revision;

  update public.projects p set updated_at = now() where p.id = p_project_id;

  return query select v_revision, v_label, v_open.rev_label;
end $$;

revoke all on function public.create_project(text, text, jsonb, jsonb, text, integer, jsonb, text)        from public, anon;
revoke all on function public.save_revision(uuid, text, text, jsonb, jsonb, text, integer, jsonb, text)  from public, anon;
revoke all on function public.start_next_revision(uuid)                                                  from public, anon;

grant execute on function public.create_project(text, text, jsonb, jsonb, text, integer, jsonb, text)     to authenticated;
grant execute on function public.save_revision(uuid, text, text, jsonb, jsonb, text, integer, jsonb, text) to authenticated;
grant execute on function public.start_next_revision(uuid)                                               to authenticated;
