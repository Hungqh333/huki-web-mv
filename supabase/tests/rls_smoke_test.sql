-- =============================================================================
-- Kiểm chứng Row Level Security — dán toàn bộ file này vào Supabase SQL Editor.
--
-- Script tự tạo user thử nghiệm + dữ liệu mẫu, giả lập JWT của từng vai trò,
-- assert kết quả, rồi ROLLBACK ở cuối. KHÔNG có gì được ghi vĩnh viễn.
--
-- Chạy thành công = không có dòng ERROR nào; các dòng "PASS:" hiện ở tab Notices.
-- Bất kỳ luật nào sai sẽ dừng script với thông báo "FAIL: ...".
-- =============================================================================

begin;

create or replace function pg_temp.assert_eq(actual bigint, expected bigint, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % — mong đợi %, nhận được %', label, expected, actual;
  end if;
  raise notice 'PASS: % (= %)', label, actual;
end $$;

-- -----------------------------------------------------------------------------
-- Dữ liệu thử nghiệm
-- -----------------------------------------------------------------------------

-- 4 user, mỗi vai trò một người. Trigger on_auth_user_created sẽ tự tạo profile
-- với role mặc định 'registered'.
insert into auth.users (id, aud, role, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'rls-registered@example.test', '{"name":"Test Registered","role":"admin"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'rls-member@example.test', '{"name":"Test Member"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'rls-vip@example.test', '{"name":"Test VIP"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'rls-admin@example.test', '{"name":"Test Admin"}'::jsonb);

-- Kiểm tra ngay: metadata của user 1 khai "role":"admin" nhưng trigger phải bỏ qua.
do $$
declare r public.user_role;
begin
  select role into r from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  if r <> 'registered' then
    raise exception 'FAIL: tự đăng ký với metadata role=admin đã leo thang thành %', r;
  end if;
  raise notice 'PASS: metadata "role" từ client bị bỏ qua, user mới = registered';
end $$;

-- Nâng quyền thủ công (ngữ cảnh không JWT = service_role / SQL editor).
update public.profiles set role = 'member' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
update public.profiles set role = 'vip'    where id = 'aaaaaaaa-0000-4000-8000-000000000003';
update public.profiles set role = 'admin'  where id = 'aaaaaaaa-0000-4000-8000-000000000004';

-- 4 bài viết, mỗi tier một bài + 1 bản nháp.
insert into public.articles (slug, title_vi, title_en, content_vi, content_en, access_tier, published_at)
values
  ('rls-test-public',     'Bài public',     'Public article',     'Nội dung public.',     'Public content.',     'public',     now()),
  ('rls-test-registered', 'Bài registered', 'Registered article', 'Nội dung registered.', 'Registered content.', 'registered', now()),
  ('rls-test-member',     'Bài member',     'Member article',     'Nội dung member.',     'Member content.',     'member',     now()),
  ('rls-test-vip',        'Bài vip',        'VIP article',        'Nội dung vip.',        'VIP content.',        'vip',        now()),
  ('rls-test-draft',      'Bài nháp',       'Draft article',      'Nội dung nháp.',       'Draft content.',      'public',     null);

-- 1 bài toán + 1 luật gợi ý.
insert into public.task_types (id, slug, name_vi, name_en)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'rls-test-task', 'Bài toán test', 'Test task');

insert into public.selector_rules (task_type_id, condition_json, recommended_camera)
values ('bbbbbbbb-0000-4000-8000-000000000001', '{"fov_max_mm": 100}'::jsonb, 'Area scan 5MP');

-- =============================================================================
-- GUEST (chưa đăng nhập)
-- =============================================================================

select set_config('request.jwt.claims', '', true);
set local role anon;

do $$
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%'), 1,
    'Guest chỉ đọc được bài public (bản nháp bị ẩn)');

  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%' and access_tier <> 'public'), 0,
    'Guest không đọc được bài registered/member/vip');

  -- Teaser vẫn hiện đủ 4 bài đã publish, phục vụ marketing.
  perform pg_temp.assert_eq(
    (select count(*) from public.article_previews where slug like 'rls-test-%'), 4,
    'Guest thấy teaser của cả 4 bài đã publish');

  perform pg_temp.assert_eq(
    (select count(*) from public.article_previews where slug like 'rls-test-%' and is_locked), 3,
    'Guest thấy 3 bài ở trạng thái khoá');
end $$;

reset role;

-- =============================================================================
-- REGISTERED — yêu cầu kiểm chứng chính của Prompt 1
-- =============================================================================

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%'), 2,
    'Registered đọc được đúng 2 bài (public + registered)');

  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%' and access_tier in ('member','vip')), 0,
    'Registered KHÔNG đọc được nội dung member/vip');

  perform pg_temp.assert_eq(
    (select count(*) from public.selector_rules), 0,
    'Registered KHÔNG đọc được bảng luật bộ chọn thiết bị');

  perform pg_temp.assert_eq(
    (select count(*) from public.profiles), 1,
    'Registered chỉ thấy profile của chính mình');

  -- Không được ghi lịch sử dùng công cụ.
  begin
    insert into public.selector_history (user_id, task_type_id, input_json, result_json)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            'bbbbbbbb-0000-4000-8000-000000000001', '{}'::jsonb, '{}'::jsonb);
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: Registered ghi được selector_history';
  end if;
  raise notice 'PASS: Registered bị chặn ghi selector_history';

  -- Không được tự nâng quyền.
  blocked := false;
  begin
    update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: Registered tự nâng quyền thành admin được';
  end if;
  raise notice 'PASS: Registered bị chặn tự nâng quyền';

  -- Nhưng vẫn sửa được thông tin cá nhân của mình.
  update public.profiles set company = 'Sora Group'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice 'PASS: Registered sửa được thông tin cá nhân của chính mình';
end $$;

reset role;

-- =============================================================================
-- MEMBER
-- =============================================================================

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%'), 3,
    'Member đọc được public + registered + member');

  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%' and access_tier = 'vip'), 0,
    'Member KHÔNG đọc được bài vip');

  -- Chỉ đếm luật của bài toán test, để không phụ thuộc vào số luật đã seed.
  perform pg_temp.assert_eq(
    (select count(*) from public.selector_rules
     where task_type_id = 'bbbbbbbb-0000-4000-8000-000000000001'), 1,
    'Member đọc được bảng luật bộ chọn thiết bị');

  insert into public.selector_history (user_id, task_type_id, input_json, result_json)
  values ('aaaaaaaa-0000-4000-8000-000000000002',
          'bbbbbbbb-0000-4000-8000-000000000001', '{"fov":50}'::jsonb, '{"camera":"x"}'::jsonb);
  raise notice 'PASS: Member ghi được selector_history';

  -- Không được sửa bảng luật (việc của admin). RLS làm UPDATE khớp 0 dòng.
  -- Luôn giới hạn vào luật của bài toán test: file này chạy trên Supabase production.
  update public.selector_rules set recommended_camera = 'hacked'
  where task_type_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  if found then
    raise exception 'FAIL: Member sửa được selector_rules';
  end if;
  raise notice 'PASS: Member bị chặn sửa selector_rules';

  -- Quản lý nội dung là việc của admin (CLAUDE.md mục 6).
  update public.articles set title_vi = 'hacked' where slug like 'rls-test-%';
  if found then
    raise exception 'FAIL: Member sửa được bài viết';
  end if;
  raise notice 'PASS: Member bị chặn sửa bài viết';

  -- Ghi chú luật nháp (C8, seed_rule_notes.sql) chỉ Admin thấy — chưa duyệt thì không lộ ra.
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where media_type = 'ruleNote' and published_at is null), 0,
    'Member không thấy ghi chú luật đang nháp');

  begin
    insert into public.articles (slug, title_vi, title_en, access_tier, published_at)
    values ('rls-test-member-hack', 'x', 'x', 'public', now());
    raise exception 'FAIL: Member tạo được bài viết';
  exception when insufficient_privilege then
    raise notice 'PASS: Member bị chặn tạo bài viết';
  end;

  -- Không được đổi vai trò của người khác.
  update public.profiles set role = 'admin'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  if found then
    raise exception 'FAIL: Member đổi được role của người khác';
  end if;
  raise notice 'PASS: Member bị chặn đổi role người khác';
end $$;

reset role;

-- =============================================================================
-- VIP
-- =============================================================================

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%'), 4,
    'VIP đọc được tất cả bài đã publish, kể cả tier vip');

  perform pg_temp.assert_eq(
    (select count(*) from public.article_previews where slug like 'rls-test-%' and is_locked), 0,
    'VIP không thấy bài nào bị khoá');

  perform pg_temp.assert_eq(
    (select count(*) from public.selector_history), 0,
    'VIP không đọc được lịch sử của người khác');
end $$;

reset role;

-- =============================================================================
-- ADMIN
-- =============================================================================

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug like 'rls-test-%'), 5,
    'Admin đọc được tất cả, kể cả bản nháp');

  perform pg_temp.assert_eq(
    (select count(*) from public.profiles where email like 'rls-%@example.test'), 4,
    'Admin xem được toàn bộ profile');

  -- Admin gán được role cho người khác.
  update public.profiles set role = 'vip'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  perform pg_temp.assert_eq(
    (select count(*) from public.profiles
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' and role = 'vip'), 1,
    'Admin gán được role member/vip cho user khác');

  -- Chỉ sửa luật của bài toán test. Trước đây câu này không có WHERE: trên Supabase
  -- production nó ghi đè camera của TOÀN BỘ bảng luật thật, chỉ an toàn nhờ lệnh
  -- rollback cuối file — chạy lẻ câu này hay file bị cắt giữa chừng là hỏng dữ liệu.
  update public.selector_rules set recommended_camera = 'Area scan 12MP'
  where task_type_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  perform pg_temp.assert_eq(
    (select count(*) from public.selector_rules
     where task_type_id = 'bbbbbbbb-0000-4000-8000-000000000001' and recommended_camera = 'Area scan 12MP'), 1,
    'Admin sửa được selector_rules (chỉ luật của bài toán test)');

  -- Ghi chú luật (V1c C8): nháp thì được, đăng khi chưa có người + ngày duyệt thì không.
  insert into public.articles (slug, title_vi, title_en, access_tier, media_type, related_rules)
  values ('rls-test-rule-note', 'x', 'x', 'member', 'ruleNote', '{MEC-001}');
  begin
    update public.articles set published_at = now() where slug = 'rls-test-rule-note';
    raise exception 'FAIL: đăng được ghi chú luật chưa ai duyệt';
  exception when check_violation then
    raise notice 'PASS: ghi chú luật chưa duyệt không đăng được';
  end;
  update public.articles set published_at = now(), reviewed_by = 'Admin RLS', reviewed_at = current_date
  where slug = 'rls-test-rule-note';
  perform pg_temp.assert_eq(
    (select count(*) from public.articles where slug = 'rls-test-rule-note' and published_at is not null), 1,
    'Ghi chú luật đã duyệt thì đăng được');
  delete from public.articles where slug = 'rls-test-rule-note';
end $$;

reset role;

-- =============================================================================
-- DỰ ÁN + REVISION (V1a mục 7)
-- =============================================================================

-- Khối ADMIN ở trên đã nâng user 1 lên vip; trả về registered cho phần này.
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set role = 'registered' where id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
begin
  if public.revision_label(0) <> 'A' or public.revision_label(25) <> 'Z'
     or public.revision_label(26) <> 'AA' or public.revision_label(701) <> 'ZZ' then
    raise exception 'FAIL: revision_label sai: % % % %',
      public.revision_label(0), public.revision_label(25), public.revision_label(26), public.revision_label(701);
  end if;
  raise notice 'PASS: nhãn revision A..Z rồi AA..ZZ';
end $$;

-- --- MEMBER: tạo, lưu, khoá, mở revision kế tiếp -----------------------------

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  created  record;
  next_rev record;
  v_project uuid;
  v_rev_a   uuid;
begin
  select * into created from public.create_project(
    'Dự án RLS', 'Measurement', '{"id":"draft","applicationType":"Measurement"}'::jsonb, '[]'::jsonb, 'mô tả gốc', 2);
  v_project := created.new_project_id;
  v_rev_a := created.new_revision_id;

  if created.new_rev_label <> 'A' then
    raise exception 'FAIL: revision đầu tiên phải là A, nhận %', created.new_rev_label;
  end if;
  perform pg_temp.assert_eq(
    (select count(*) from public.projects where id = v_project and status = 'draft'), 1,
    'Member tạo được dự án của mình, trạng thái draft');
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions where project_id = v_project and rev_label = 'A' and locked_at is null), 1,
    'Dự án mới có Rev A đang sửa');

  perform public.save_revision(v_rev_a, 'Dự án RLS (đã sửa)', 'AppearanceInspection',
    '{"id":"draft","applicationType":"AppearanceInspection"}'::jsonb, '[]'::jsonb, null, 2,
    '{"version":1,"level":"recommended"}'::jsonb, 'v1c-test');
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions
      where id = v_rev_a and bom ->> 'level' = 'recommended' and rule_version = 'v1c-test'), 1,
    'Lưu revision ghi được BOM + phiên bản bộ luật (V1c C5)');
  perform pg_temp.assert_eq(
    (select count(*) from public.projects
      where id = v_project and name = 'Dự án RLS (đã sửa)' and application_type = 'AppearanceInspection'), 1,
    'Lưu revision cập nhật cả tên và loại ứng dụng của dự án');

  select * into next_rev from public.start_next_revision(v_project);
  if next_rev.new_rev_label <> 'B' or next_rev.locked_rev_label <> 'A' then
    raise exception 'FAIL: tạo revision mới phải khoá A và mở B, nhận khoá % / mở %',
      next_rev.locked_rev_label, next_rev.new_rev_label;
  end if;
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions where project_id = v_project and locked_at is null), 1,
    'Luôn chỉ có một revision đang sửa');
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions
      where project_id = v_project and rev_label = 'B' and requirement ->> 'applicationType' = 'AppearanceInspection'), 1,
    'Rev B chép nội dung đã lưu của Rev A');
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions
      where project_id = v_project and rev_label = 'B' and bom ->> 'level' = 'recommended' and rule_version = 'v1c-test'), 1,
    'Rev B chép cả BOM và phiên bản bộ luật của Rev A');

  -- RLS lọc revision đã khoá: UPDATE khớp 0 dòng, không lỗi.
  update public.project_revisions set requirement = '{}'::jsonb, bom = '{}'::jsonb where id = v_rev_a;
  if found then
    raise exception 'FAIL: Member sửa được revision đã khoá';
  end if;
  raise notice 'PASS: Member không sửa được revision đã khoá';

  begin
    perform public.save_revision(v_rev_a, 'x', 'Measurement', '{}'::jsonb, '[]'::jsonb, null, 2);
    raise exception 'FAIL: save_revision ghi được vào revision đã khoá';
  exception when no_data_found then
    raise notice 'PASS: save_revision từ chối revision đã khoá';
  end;

  begin
    insert into public.project_revisions (project_id, rev_label, requirement, schema_version)
    values (v_project, 'C', '{}'::jsonb, 2);
    raise exception 'FAIL: tạo được revision đang sửa thứ hai';
  exception when unique_violation then
    raise notice 'PASS: Một dự án không có hai revision cùng đang sửa';
  end;

  begin
    update public.project_revisions set rev_label = 'Z' where project_id = v_project and locked_at is null;
    raise exception 'FAIL: đổi được nhãn revision';
  exception when integrity_constraint_violation then
    raise notice 'PASS: Không đổi được nhãn revision';
  end;

  -- Không có quyền DELETE trên bảng này (migration thu hồi tường minh).
  begin
    delete from public.project_revisions where project_id = v_project;
    raise exception 'FAIL: Member xoá lẻ được revision';
  exception when insufficient_privilege then
    raise notice 'PASS: Không xoá lẻ được revision';
  end;

  begin
    insert into public.projects (user_id, name, application_type)
    values ('aaaaaaaa-0000-4000-8000-000000000003', 'Dự án giả mạo', 'Other');
    raise exception 'FAIL: Member tạo được dự án đứng tên người khác';
  exception when insufficient_privilege then
    raise notice 'PASS: Không tạo được dự án đứng tên người khác';
  end;

  perform set_config('rls_test.project_id', v_project::text, true);
end $$;

reset role;

-- --- REGISTERED --------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.projects), 0,
    'Registered không thấy dự án nào');

  begin
    perform public.create_project('Dự án của registered', 'Other', '{}'::jsonb, '[]'::jsonb, null, 2);
    raise exception 'FAIL: Registered tạo được dự án';
  exception when insufficient_privilege then
    raise notice 'PASS: Registered bị chặn tạo dự án';
  end;

  -- Ghi thẳng vào bảng, không qua hàm: policy của projects phải tự chặn, không
  -- được trông vào việc insert revision bên trong create_project thất bại theo.
  begin
    insert into public.projects (user_id, name, application_type)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'Dự án của registered', 'Other');
    raise exception 'FAIL: Registered ghi thẳng được vào projects';
  exception when insufficient_privilege then
    raise notice 'PASS: Registered bị chặn ghi thẳng vào projects';
  end;
end $$;

reset role;

-- --- VIP: không chạm được dự án của Member -----------------------------------

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_project uuid := current_setting('rls_test.project_id')::uuid;
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.projects where id = v_project), 0,
    'VIP không thấy dự án của Member');
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions where project_id = v_project), 0,
    'VIP không thấy revision của Member');

  update public.projects set name = 'hacked' where id = v_project;
  if found then
    raise exception 'FAIL: VIP sửa được dự án của Member';
  end if;
  raise notice 'PASS: VIP bị chặn sửa dự án của Member';

  begin
    perform public.start_next_revision(v_project);
    raise exception 'FAIL: VIP khoá được revision của Member';
  exception when no_data_found then
    raise notice 'PASS: VIP không tạo được revision trên dự án của Member';
  end;

  begin
    insert into public.project_revisions (project_id, rev_label, requirement, schema_version, locked_at)
    values (v_project, 'Q', '{}'::jsonb, 2, now());
    raise exception 'FAIL: VIP chèn được revision vào dự án của Member';
  exception when insufficient_privilege then
    raise notice 'PASS: VIP bị chặn chèn revision vào dự án của Member';
  end;

  delete from public.projects where id = v_project;
  if found then
    raise exception 'FAIL: VIP xoá được dự án của Member';
  end if;
  raise notice 'PASS: VIP bị chặn xoá dự án của Member';
end $$;

reset role;

-- --- ADMIN: đọc được, không sửa được nội dung revision ------------------------

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_project uuid := current_setting('rls_test.project_id')::uuid;
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.projects where id = v_project), 1,
    'Admin xem được dự án của người khác');
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions where project_id = v_project), 2,
    'Admin xem được revision của người khác');

  update public.project_revisions set raw_text = 'admin sửa' where project_id = v_project;
  if found then
    raise exception 'FAIL: Admin sửa được nội dung revision';
  end if;
  raise notice 'PASS: Admin cũng không sửa được nội dung revision';

  -- Admin THẤY được dự án của người khác nên đây mới là phép thử thật của policy
  -- sửa — những người khác đã bị chặn ngay từ policy đọc.
  update public.projects set name = 'admin sửa' where id = v_project;
  if found then
    raise exception 'FAIL: Admin sửa được dự án của người khác';
  end if;
  raise notice 'PASS: Admin không sửa được dự án của người khác';
end $$;

reset role;

-- --- Ngoài RLS (SQL Editor): trigger vẫn giữ revision đã khoá -----------------

select set_config('request.jwt.claims', '', true);

do $$
declare
  v_project uuid := current_setting('rls_test.project_id')::uuid;
begin
  begin
    update public.project_revisions set raw_text = 'sửa tay' where project_id = v_project and rev_label = 'A';
    raise exception 'FAIL: sửa tay được revision đã khoá';
  exception when integrity_constraint_violation then
    raise notice 'PASS: Trigger chặn sửa revision đã khoá kể cả ngoài RLS';
  end;
end $$;

-- --- MEMBER xoá dự án của mình → revision mất theo ----------------------------

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_project uuid := current_setting('rls_test.project_id')::uuid;
begin
  delete from public.projects where id = v_project;
  if not found then
    raise exception 'FAIL: Member không xoá được dự án của mình';
  end if;
  raise notice 'PASS: Member xoá được dự án của mình';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  perform pg_temp.assert_eq(
    (select count(*) from public.project_revisions
      where project_id = current_setting('rls_test.project_id')::uuid), 0,
    'Xoá dự án xoá luôn các revision');
end $$;

do $$ begin raise notice '=== TẤT CẢ KIỂM TRA RLS ĐÃ QUA ==='; end $$;

-- Không ghi gì vào database.
rollback;
