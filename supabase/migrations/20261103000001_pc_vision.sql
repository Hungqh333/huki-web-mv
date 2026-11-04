-- =============================================================================
-- PC Vision — danh mục cấu hình PC công nghiệp (trang /cong-cu-may-tinh)
--
-- Chốt 2026-11-03 (Hùng, gói bàn giao Goi_PC_Vision_03-11-2026 + Q1–Q10 "như đề xuất"):
--   Khung (pc_frames) = phần cố định: chassis, CPU, GPU, nguồn, hệ điều hành, dòng RAM/SSD, năng lực.
--   Cấu hình (pc_configs) = khung + RAM + SSD hệ thống + ổ dữ liệu. Mã vật tư do CSDL tự ghép:
--     <PN chassis>-<CPU>-G<GPU>-P<W>-R<GB><I|C>-S<SSD><I|C>-<ổ dữ liệu>-<HĐH>
--   Q9: trường tạo nên mã KHOÁ sau khi tạo — muốn đổi thì thêm cấu hình mới, cái cũ "Ngừng dùng".
--       Ngoại lệ duy nhất: dòng RAM/SSD của khung đang là '?' được đổi sang I/C (mã có '?' chưa
--       bao giờ được đặt hàng); mã cũ vẫn nằm trong pc_issued_codes, không cấp lại.
--   Mã không bao giờ cấp lại: pc_issued_codes giữ mọi mã đã từng cấp.
--   Không xoá cứng: không có policy DELETE, chỉ đổi trạng thái active / retired.
--   Lịch sử: trigger ghi pc_change_log (ai, lúc nào, JSON trước / sau) — ghi ở CSDL nên không sót.
--
-- Quyền (Q3, Q4): Member trở lên xem; chỉ Admin thêm / sửa; lịch sử và danh sách mã đã cấp chỉ Admin xem.
--
-- Dán lại nhiều lần không sao.
-- =============================================================================

-- ── Khung ──
create table if not exists public.pc_frames (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                 -- A, B, Ct, C, D, P cho seed; khung thêm sau: K<thời điểm>
  tier         text not null,                        -- chữ cấp hiện trong ô vuông màu
  name_vi      text not null,
  name_en      text,
  chassis_pn   text not null,                        -- đúng Part Number của hãng; tự lắp ráp: LR-<main>-<vỏ>
  cpu          text not null,                        -- I9-14900, U7-265, RZ7-7700
  gpu          text not null default '0',            -- 0 = không GPU; 5070, 5060TI, 4070S
  vram_gb      integer not null default 0,
  psu_w        integer not null,
  os           text not null default 'W11P',
  ram_line     text not null,                        -- I công nghiệp / C thường / ? chưa rõ
  ssd_line     text not null,
  card_slots   integer not null default 0,           -- khe trống cho card camera
  lan_ports    integer not null default 0,           -- cổng LAN onboard dành cho camera
  peak_load_w  integer not null,                     -- tải đỉnh ước tính, chưa tính PoE
  use_for_vi   text,
  use_for_en   text,
  not_for_vi   text,
  not_for_en   text,
  note_vi      text,
  note_en      text,
  status       text not null default 'active',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint pc_frames_key unique (chassis_pn, cpu, gpu, vram_gb, psu_w, os, ram_line, ssd_line),
  constraint pc_frames_slug_check check (slug ~ '^[A-Za-z0-9]{1,20}$'),
  constraint pc_frames_tier_check check (tier in ('A', 'B', 'C', 'D', 'P')),
  constraint pc_frames_pn_check check (chassis_pn ~ '^[A-Z0-9][A-Z0-9-]{0,59}$' and chassis_pn !~ '-$'),
  constraint pc_frames_cpu_check check (cpu ~ '^(I[3579]|U[579]|RZ[3579])-\d{3,5}[A-Z]{0,2}$'),
  constraint pc_frames_gpu_check check (gpu ~ '^(0|\d{4}(TI|S)?)$'),
  constraint pc_frames_vram_check check ((gpu = '0') = (vram_gb = 0) and vram_gb between 0 and 99),
  constraint pc_frames_psu_check check (psu_w between 100 and 9999),
  constraint pc_frames_os_check check (os in ('W11P', 'W11L', 'LNX', 'NOS')),
  constraint pc_frames_line_check check (ram_line in ('I', 'C', '?') and ssd_line in ('I', 'C', '?')),
  constraint pc_frames_numbers_check check (
    card_slots between 0 and 12 and lan_ports between 0 and 12 and peak_load_w between 0 and 9999
  ),
  constraint pc_frames_status_check check (status in ('active', 'retired')),
  constraint pc_frames_text_check check (
    length(name_vi) between 1 and 80 and coalesce(length(name_en), 0) <= 80
    and coalesce(length(use_for_vi), 0) <= 300 and coalesce(length(use_for_en), 0) <= 300
    and coalesce(length(not_for_vi), 0) <= 300 and coalesce(length(not_for_en), 0) <= 300
    and coalesce(length(note_vi), 0) <= 300 and coalesce(length(note_en), 0) <= 300
  )
);

-- ── Cấu hình ──
create table if not exists public.pc_configs (
  id          uuid primary key default gen_random_uuid(),
  frame_id    uuid not null references public.pc_frames (id),
  short_name  text not null,                         -- B2, Ct1…
  ram_gb      integer not null,
  ssd_gb      integer not null,                      -- 1024 = 1T
  data_kind   text,                                  -- D = SSD, H = HDD, null = không có (D0)
  data_gb     integer,
  data_line   text,
  code        text not null unique,                  -- trigger ghép, không nhận từ client
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint pc_configs_short_name_check check (length(short_name) between 1 and 20),
  constraint pc_configs_ram_check check (ram_gb between 1 and 999),
  -- Dung lượng ổ ghi được bằng mã: 3 chữ số GB (100–999) hoặc số nguyên TB (1–99T).
  constraint pc_configs_ssd_check check (ssd_gb between 100 and 999 or (ssd_gb % 1024 = 0 and ssd_gb / 1024 between 1 and 99)),
  constraint pc_configs_data_check check (
    (data_kind is null and data_gb is null and data_line is null)
    or (data_kind in ('D', 'H') and data_line in ('I', 'C')
        and (data_gb between 100 and 999 or (data_gb % 1024 = 0 and data_gb / 1024 between 1 and 99)))
  ),
  constraint pc_configs_status_check check (status in ('active', 'retired')),
  -- Mã đúng quy tắc (đã gửi hãng AAEON); mã có '?' (khung chưa rõ dòng RAM/SSD) cố ý không qua regex.
  constraint pc_configs_code_check check (
    code ~ '^[A-Z0-9][A-Z0-9-]*-(I[3579]|U[579]|RZ[3579])-\d{3,5}[A-Z]{0,2}-G(0|\d{4}(TI|S)?V\d{1,2})-P\d{3,4}-R\d{1,3}[IC]-S(\d{3}|\d{1,2}T)[IC]-(D0|[DH](\d{3}|\d{1,2}T)[IC])-(W11[PL]|LNX|NOS)$'
    or code ~ '\?'
  )
);

create index if not exists pc_configs_frame_idx on public.pc_configs (frame_id);

-- ── Mọi mã đã từng cấp: không bao giờ cấp lại cho cấu hình khác ──
create table if not exists public.pc_issued_codes (
  code       text primary key,
  config_id  uuid not null references public.pc_configs (id),
  issued_at  timestamptz not null default now()
);

-- ── Lịch sử thay đổi ──
create table if not exists public.pc_change_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      uuid not null,
  action      text not null,
  actor_id    uuid,                                  -- null = dán SQL / service_role
  changed_at  timestamptz not null default now(),
  before      jsonb,
  after       jsonb
);

create index if not exists pc_change_log_row_idx on public.pc_change_log (row_id, changed_at desc);
create index if not exists pc_change_log_time_idx on public.pc_change_log (changed_at desc);

comment on table public.pc_frames is
  'PC Vision — khung PC (phần cố định của mã). Member+ xem, Admin ghi, không xoá. Trang /cong-cu-may-tinh.';
comment on table public.pc_configs is
  'PC Vision — cấu hình = khung + RAM + SSD + ổ dữ liệu. Mã do trigger ghép, trường tạo mã khoá sau khi tạo.';
comment on table public.pc_issued_codes is 'Mọi mã PC đã từng cấp — chống cấp lại cho cấu hình khác. Chỉ Admin xem.';
comment on table public.pc_change_log is 'Lịch sử sửa khung / cấu hình PC (trigger). Chỉ Admin xem.';

-- ── Ghép mã ──

/** 512 → '512', 1024 → '1T'. */
create or replace function public.pc_size_token(gb integer)
returns text
language sql
immutable
as $$
  select case when gb >= 1024 and gb % 1024 = 0 then (gb / 1024)::text || 'T' else gb::text end
$$;

create or replace function public.pc_compose_code(f public.pc_frames, c public.pc_configs)
returns text
language sql
stable
as $$
  select concat_ws('-',
    f.chassis_pn,
    f.cpu,
    'G' || case when f.gpu = '0' then '0' else f.gpu || 'V' || f.vram_gb end,
    'P' || f.psu_w,
    'R' || c.ram_gb || f.ram_line,
    'S' || public.pc_size_token(c.ssd_gb) || f.ssd_line,
    case when c.data_kind is null then 'D0' else c.data_kind || public.pc_size_token(c.data_gb) || c.data_line end,
    f.os)
$$;

-- Cấu hình: khoá trường tạo mã, ghép mã, chặn mã đã cấp cho cấu hình khác.
create or replace function public.pc_configs_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.pc_frames;
begin
  if tg_op = 'UPDATE' and (
    new.frame_id is distinct from old.frame_id or new.ram_gb is distinct from old.ram_gb
    or new.ssd_gb is distinct from old.ssd_gb or new.data_kind is distinct from old.data_kind
    or new.data_gb is distinct from old.data_gb or new.data_line is distinct from old.data_line
  ) then
    raise exception 'pc_config_locked: trường tạo mã đã khoá — thêm cấu hình mới và chuyển cấu hình này sang Ngừng dùng'
      using errcode = '55000';
  end if;

  select * into f from public.pc_frames where id = new.frame_id;
  if not found then
    raise exception 'pc_frame_missing' using errcode = '23503';
  end if;
  new.code := public.pc_compose_code(f, new);

  if exists (select 1 from public.pc_issued_codes i where i.code = new.code and i.config_id <> new.id) then
    raise exception 'pc_code_issued: mã % đã cấp cho cấu hình khác', new.code using errcode = '23505';
  end if;
  return new;
end $$;

create or replace function public.pc_configs_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pc_issued_codes (code, config_id) values (new.code, new.id)
  on conflict (code) do nothing;
  return null;
end $$;

-- Khung: khoá phần cố định của mã; dòng RAM/SSD chỉ được đổi khi đang là '?'.
create or replace function public.pc_frames_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chassis_pn is distinct from old.chassis_pn or new.cpu is distinct from old.cpu
     or new.gpu is distinct from old.gpu or new.vram_gb is distinct from old.vram_gb
     or new.psu_w is distinct from old.psu_w or new.os is distinct from old.os
     or (new.ram_line is distinct from old.ram_line and old.ram_line <> '?')
     or (new.ssd_line is distinct from old.ssd_line and old.ssd_line <> '?') then
    raise exception 'pc_frame_locked: phần cố định của khung đã khoá — thêm khung mới' using errcode = '55000';
  end if;
  return new;
end $$;

-- Khung vừa đổi dòng '?' → I/C: ghép lại mã các cấu hình (trigger cấu hình tự tính).
create or replace function public.pc_frames_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ram_line is distinct from old.ram_line or new.ssd_line is distinct from old.ssd_line then
    update public.pc_configs set code = code where frame_id = new.id;
  end if;
  return null;
end $$;

-- Lịch sử: một dòng cho mỗi thay đổi thật (bỏ cập nhật không đổi gì).
create or replace function public.pc_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pc_change_log (table_name, row_id, action, actor_id, before, after)
    values (tg_table_name, new.id, 'insert', auth.uid(), null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
      insert into public.pc_change_log (table_name, row_id, action, actor_id, before, after)
      values (tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    end if;
  else
    insert into public.pc_change_log (table_name, row_id, action, actor_id, before, after)
    values (tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old), null);
  end if;
  return null;
end $$;

drop trigger if exists pc_frames_set_updated_at on public.pc_frames;
create trigger pc_frames_set_updated_at
  before update on public.pc_frames
  for each row execute function public.set_updated_at();

drop trigger if exists pc_frames_lock on public.pc_frames;
create trigger pc_frames_lock
  before update on public.pc_frames
  for each row execute function public.pc_frames_before_update();

drop trigger if exists pc_frames_recode on public.pc_frames;
create trigger pc_frames_recode
  after update on public.pc_frames
  for each row execute function public.pc_frames_after_update();

drop trigger if exists pc_frames_log on public.pc_frames;
create trigger pc_frames_log
  after insert or update or delete on public.pc_frames
  for each row execute function public.pc_log_change();

drop trigger if exists pc_configs_set_updated_at on public.pc_configs;
create trigger pc_configs_set_updated_at
  before update on public.pc_configs
  for each row execute function public.set_updated_at();

drop trigger if exists pc_configs_code on public.pc_configs;
create trigger pc_configs_code
  before insert or update on public.pc_configs
  for each row execute function public.pc_configs_before_write();

drop trigger if exists pc_configs_issue on public.pc_configs;
create trigger pc_configs_issue
  after insert or update of code on public.pc_configs
  for each row execute function public.pc_configs_after_write();

drop trigger if exists pc_configs_log on public.pc_configs;
create trigger pc_configs_log
  after insert or update or delete on public.pc_configs
  for each row execute function public.pc_log_change();

-- ── Thêm cấu hình (kèm khung mới nếu chưa có) trong MỘT giao dịch ──
-- security invoker: RLS của người gọi vẫn áp — Member gọi thì bị chặn ở insert.
create or replace function public.pc_add_config(frame jsonb, config jsonb)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  frame_id uuid;
  new_code text;
begin
  if not public.is_admin() then
    raise exception 'pc_admin_only' using errcode = '42501';
  end if;

  select f.id into frame_id
    from public.pc_frames f
   where f.chassis_pn = frame->>'chassis_pn' and f.cpu = frame->>'cpu' and f.gpu = frame->>'gpu'
     and f.vram_gb = (frame->>'vram_gb')::integer and f.psu_w = (frame->>'psu_w')::integer
     and f.os = frame->>'os' and f.ram_line = frame->>'ram_line' and f.ssd_line = frame->>'ssd_line';

  if frame_id is null then
    if coalesce(frame->>'name_vi', '') = '' then
      raise exception 'pc_frame_new_required' using errcode = '23502';
    end if;
    insert into public.pc_frames (
      slug, tier, name_vi, name_en, chassis_pn, cpu, gpu, vram_gb, psu_w, os, ram_line, ssd_line,
      card_slots, lan_ports, peak_load_w, use_for_vi, use_for_en, not_for_vi, not_for_en, sort_order)
    values (
      'K' || to_char(clock_timestamp(), 'YYMMDDHH24MISS'),
      frame->>'tier', frame->>'name_vi', nullif(frame->>'name_en', ''),
      frame->>'chassis_pn', frame->>'cpu', frame->>'gpu', (frame->>'vram_gb')::integer, (frame->>'psu_w')::integer,
      frame->>'os', frame->>'ram_line', frame->>'ssd_line',
      (frame->>'card_slots')::integer, (frame->>'lan_ports')::integer, (frame->>'peak_load_w')::integer,
      nullif(frame->>'use_for_vi', ''), nullif(frame->>'use_for_en', ''),
      nullif(frame->>'not_for_vi', ''), nullif(frame->>'not_for_en', ''),
      coalesce((select max(sort_order) from public.pc_frames), 0) + 10)
    returning id into frame_id;
  end if;

  insert into public.pc_configs (frame_id, short_name, ram_gb, ssd_gb, data_kind, data_gb, data_line, code)
  values (
    frame_id, config->>'short_name', (config->>'ram_gb')::integer, (config->>'ssd_gb')::integer,
    nullif(config->>'data_kind', ''), (config->>'data_gb')::integer, nullif(config->>'data_line', ''),
    '')  -- trigger ghép mã
  returning code into new_code;

  return new_code;
end $$;

-- ── RLS ──
alter table public.pc_frames enable row level security;
alter table public.pc_configs enable row level security;
alter table public.pc_issued_codes enable row level security;
alter table public.pc_change_log enable row level security;

drop policy if exists "pc_frames_select_member" on public.pc_frames;
create policy "pc_frames_select_member"
  on public.pc_frames for select
  to authenticated
  using (public.is_member_plus());

drop policy if exists "pc_frames_insert_admin" on public.pc_frames;
create policy "pc_frames_insert_admin"
  on public.pc_frames for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "pc_frames_update_admin" on public.pc_frames;
create policy "pc_frames_update_admin"
  on public.pc_frames for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pc_configs_select_member" on public.pc_configs;
create policy "pc_configs_select_member"
  on public.pc_configs for select
  to authenticated
  using (public.is_member_plus());

drop policy if exists "pc_configs_insert_admin" on public.pc_configs;
create policy "pc_configs_insert_admin"
  on public.pc_configs for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "pc_configs_update_admin" on public.pc_configs;
create policy "pc_configs_update_admin"
  on public.pc_configs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Mã đã cấp và lịch sử: chỉ Admin đọc; chỉ trigger (security definer) ghi.
drop policy if exists "pc_issued_codes_select_admin" on public.pc_issued_codes;
create policy "pc_issued_codes_select_admin"
  on public.pc_issued_codes for select
  to authenticated
  using (public.is_admin());

drop policy if exists "pc_change_log_select_admin" on public.pc_change_log;
create policy "pc_change_log_select_admin"
  on public.pc_change_log for select
  to authenticated
  using (public.is_admin());

-- Không có policy DELETE nào: không xoá cứng, kể cả Admin.
revoke all on public.pc_frames, public.pc_configs, public.pc_issued_codes, public.pc_change_log from anon;
revoke delete, truncate on public.pc_frames, public.pc_configs, public.pc_issued_codes, public.pc_change_log from authenticated;
grant select, insert, update on public.pc_frames, public.pc_configs to authenticated;
grant select on public.pc_issued_codes, public.pc_change_log to authenticated;
revoke all on function public.pc_add_config(jsonb, jsonb) from anon;
grant execute on function public.pc_add_config(jsonb, jsonb) to authenticated;
