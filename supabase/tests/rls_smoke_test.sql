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
    (select count(*) from public.articles), 1,
    'Guest chỉ đọc được bài public (bản nháp bị ẩn)');

  perform pg_temp.assert_eq(
    (select count(*) from public.articles where access_tier <> 'public'), 0,
    'Guest không đọc được bài registered/member/vip');

  -- Teaser vẫn hiện đủ 4 bài đã publish, phục vụ marketing.
  perform pg_temp.assert_eq(
    (select count(*) from public.article_previews), 4,
    'Guest thấy teaser của cả 4 bài đã publish');

  perform pg_temp.assert_eq(
    (select count(*) from public.article_previews where is_locked), 3,
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
    (select count(*) from public.articles), 2,
    'Registered đọc được đúng 2 bài (public + registered)');

  perform pg_temp.assert_eq(
    (select count(*) from public.articles where access_tier in ('member','vip')), 0,
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
    (select count(*) from public.articles), 3,
    'Member đọc được public + registered + member');

  perform pg_temp.assert_eq(
    (select count(*) from public.articles where access_tier = 'vip'), 0,
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
  update public.selector_rules set recommended_camera = 'hacked';
  if found then
    raise exception 'FAIL: Member sửa được selector_rules';
  end if;
  raise notice 'PASS: Member bị chặn sửa selector_rules';
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
    (select count(*) from public.articles), 4,
    'VIP đọc được tất cả bài đã publish, kể cả tier vip');

  perform pg_temp.assert_eq(
    (select count(*) from public.article_previews where is_locked), 0,
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

  update public.selector_rules set recommended_camera = 'Area scan 12MP';
  raise notice 'PASS: Admin sửa được selector_rules';
end $$;

reset role;

do $$ begin raise notice '=== TẤT CẢ KIỂM TRA RLS ĐÃ QUA ==='; end $$;

-- Không ghi gì vào database.
rollback;
