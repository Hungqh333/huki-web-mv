-- =============================================================================
-- Module "Bộ tính chỉ tiêu Vision"
--
-- Giúp kỹ sư xác định chỉ tiêu chất lượng cam kết được (bỏ sót, bắt ảo, tái
-- kiểm) cho một dự án, quy ra chi phí vận hành, và sinh bản nháp điều khoản.
--
-- Toàn bộ hệ số nằm ở database chứ không hard-code (CLAUDE.md mục 9): những con
-- số này CHẮC CHẮN phải chỉnh sau vài dự án thật — đó mới là lúc công cụ có giá
-- trị. Để trong code thì mỗi lần chỉnh đều phải qua lập trình viên.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Kiểu dữ liệu
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.kpi_problem_group as enum
    ('presence', 'metrology', 'code', 'process', 'cosmetic');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.kpi_deep_learning as enum
    ('no', 'sometimes', 'often', 'required');
exception when duplicate_object then null;
end $$;

-- Một số bài toán không dùng bộ chỉ số bỏ sót/bắt ảo, mà có KPI riêng.
do $$ begin
  create type public.kpi_special as enum
    ('robot_guidance', 'code_reading', 'web_inspection');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.kpi_modifier_direction as enum ('worse', 'better');
exception when duplicate_object then null;
end $$;

-- Nguồn gốc con số. Đây là cột quan trọng nhất về mặt QUẢN TRỊ RỦI RO: dữ liệu
-- khởi tạo là ƯỚC LƯỢNG, chưa đối chiếu với lịch sử dự án của công ty. Giao
-- diện phải hiển thị rõ điều này để không ai dán thẳng vào hợp đồng.
do $$ begin
  create type public.kpi_data_source as enum
    ('estimate', 'project_history', 'vendor_spec');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Loại bài toán và dải chỉ tiêu tương ứng
-- -----------------------------------------------------------------------------

create table if not exists public.kpi_problem_types (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  problem_group             public.kpi_problem_group not null,
  level                     smallint not null check (level between 1 and 7),
  name_vi                   text not null,
  name_en                   text not null,

  -- Bỏ sót: FN / tổng NG thật.
  miss_min                  numeric(6,3) not null,
  miss_max                  numeric(6,3) not null,

  -- Bắt ảo tuần đầu: chỉ để cảnh báo khách, KHÔNG cam kết. Ngưỡng lúc mới chạy
  -- luôn đặt thiên về an toàn nên bắt ảo cao hơn hẳn mức ổn định.
  false_reject_week1_min    numeric(6,3) not null,
  false_reject_week1_max    numeric(6,3) not null,

  -- Bắt ảo cam kết: FP / tổng OK thật, sau ramp-up.
  false_reject_min          numeric(6,3) not null,
  false_reject_max          numeric(6,3) not null,

  -- Tái kiểm: phần chuyển sang người kiểm / tổng sản lượng.
  recheck_min               numeric(6,3) not null,
  recheck_max               numeric(6,3) not null,

  -- Trần tổng tải phụ (bắt ảo + tái kiểm). Hai đại lượng này là hai NHÁNH LOẠI
  -- TRỪ NHAU của cùng một nhóm sản phẩm, nên tổng bị chặn, không cộng dồn tự do.
  total_burden_max          numeric(6,3) not null,

  ramp_up_weeks_min         numeric(4,1) not null,
  ramp_up_weeks_max         numeric(4,1) not null,

  deep_learning             public.kpi_deep_learning not null default 'no',
  special_kpi               public.kpi_special,

  note_vi                   text,
  note_en                   text,

  data_source               public.kpi_data_source not null default 'estimate',
  calibrated_at             timestamptz,
  calibration_note_vi       text,
  calibration_note_en       text,

  sort_order                integer not null default 0,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint kpi_ranges_ordered check (
    miss_min <= miss_max
    and false_reject_week1_min <= false_reject_week1_max
    and false_reject_min <= false_reject_max
    and recheck_min <= recheck_max
    and ramp_up_weeks_min <= ramp_up_weeks_max
  ),

  -- LƯU Ý về ràng buộc này — chỗ dễ hiểu sai nhất của cả module:
  --
  -- Chỉ ràng buộc trên tổng hai giá trị NHỎ NHẤT, không phải hai giá trị lớn
  -- nhất. Hai dải là độc lập theo từng chiều: bắt ảo chạm 5% xảy ra ở cấu hình
  -- ngưỡng hẹp, tái kiểm chạm 4% xảy ra ở cấu hình ngưỡng rộng — không bao giờ
  -- đồng thời. 9/27 loại bài toán có f_max + r_max vượt trần, và điều đó đúng.
  --
  -- Trần total_burden_max ràng buộc KẾT QUẢ TÍNH sau khi chia tải phụ, việc đó
  -- do engine đảm bảo (xem src/lib/kpi/calc.ts), không phải ràng buộc dữ liệu gốc.
  constraint kpi_burden_floor_within_max check (
    false_reject_min + recheck_min <= total_burden_max + 0.001
  )
);

comment on column public.kpi_problem_types.data_source is
  'estimate = ước lượng chưa kiểm chứng. Đổi sang project_history sau khi đối chiếu với dự án thật.';

comment on column public.kpi_problem_types.total_burden_max is
  'Trần của (bắt ảo + tái kiểm). Chỉnh ngưỡng chỉ chuyển hàng giữa hai nhánh, không làm tổng nhỏ đi.';

create index if not exists kpi_problem_types_group_idx on public.kpi_problem_types (problem_group, sort_order);

drop trigger if exists kpi_problem_types_set_updated_at on public.kpi_problem_types;
create trigger kpi_problem_types_set_updated_at
  before update on public.kpi_problem_types
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Hệ số điều chỉnh theo điều kiện thực tế
-- -----------------------------------------------------------------------------

create table if not exists public.kpi_modifiers (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name_vi      text not null,
  name_en      text not null,
  factor_min   numeric(5,2) not null check (factor_min > 0),
  factor_max   numeric(5,2) not null check (factor_max > 0),
  direction    public.kpi_modifier_direction not null,
  note_vi      text,
  note_en      text,
  data_source  public.kpi_data_source not null default 'estimate',
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint kpi_modifier_range_ordered check (factor_min <= factor_max)
);

drop trigger if exists kpi_modifiers_set_updated_at on public.kpi_modifiers;
create trigger kpi_modifiers_set_updated_at
  before update on public.kpi_modifiers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Hằng số của mô hình
--
-- Những con số này là ước lượng có cơ sở kinh nghiệm chứ không phải hằng số vật
-- lý. Ví dụ recheck_exponent hiện để 1,0: tái kiểm tăng ĐÚNG BẰNG hệ số điều
-- kiện, không giảm nhẹ. Mũ nhỏ hơn 1 từng được thử nhưng cho ra mâu thuẫn —
-- mức tái kiểm hiển thị thấp hơn mức mà phép chia tải thực sự tính ra. Để ở đây
-- thì đội kỹ thuật chỉnh được khi có dữ liệu thật.
-- -----------------------------------------------------------------------------

create table if not exists public.kpi_config (
  key         text primary key,
  value       numeric(10,4) not null,
  name_vi     text not null,
  name_en     text not null,
  note_vi     text,
  note_en     text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists kpi_config_set_updated_at on public.kpi_config;
create trigger kpi_config_set_updated_at
  before update on public.kpi_config
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Hệ số khi khách đòi siết bỏ sót
-- -----------------------------------------------------------------------------

create table if not exists public.kpi_tightening_factors (
  id          uuid primary key default gen_random_uuid(),
  miss_ratio  numeric(6,2) not null unique,  -- siết bỏ sót bao nhiêu lần
  burden_k    numeric(6,2) not null,          -- tổng tải phụ nhân lên bấy nhiêu
  label_vi    text not null,
  label_en    text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- 6. ROW LEVEL SECURITY
--
-- Đây là dữ liệu thương mại nhạy cảm: nó nói lên công ty CAM KẾT ĐƯỢC tới đâu.
-- Đối thủ hoặc khách hàng biết được sẽ bất lợi khi đàm phán. Vì vậy chỉ Member
-- trở lên đọc được, giống bảng luật gợi ý thiết bị. Ghi thì chỉ admin.
-- =============================================================================

alter table public.kpi_problem_types      enable row level security;
alter table public.kpi_modifiers          enable row level security;
alter table public.kpi_config             enable row level security;
alter table public.kpi_tightening_factors enable row level security;

drop policy if exists "kpi_problem_types_select_member_plus" on public.kpi_problem_types;
create policy "kpi_problem_types_select_member_plus"
  on public.kpi_problem_types for select to authenticated
  using (public.is_member_plus() and (is_active or public.is_admin()));

drop policy if exists "kpi_problem_types_write_admin" on public.kpi_problem_types;
create policy "kpi_problem_types_write_admin"
  on public.kpi_problem_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kpi_modifiers_select_member_plus" on public.kpi_modifiers;
create policy "kpi_modifiers_select_member_plus"
  on public.kpi_modifiers for select to authenticated
  using (public.is_member_plus() and (is_active or public.is_admin()));

drop policy if exists "kpi_modifiers_write_admin" on public.kpi_modifiers;
create policy "kpi_modifiers_write_admin"
  on public.kpi_modifiers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kpi_config_select_member_plus" on public.kpi_config;
create policy "kpi_config_select_member_plus"
  on public.kpi_config for select to authenticated
  using (public.is_member_plus());

drop policy if exists "kpi_config_write_admin" on public.kpi_config;
create policy "kpi_config_write_admin"
  on public.kpi_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kpi_tightening_select_member_plus" on public.kpi_tightening_factors;
create policy "kpi_tightening_select_member_plus"
  on public.kpi_tightening_factors for select to authenticated
  using (public.is_member_plus());

drop policy if exists "kpi_tightening_write_admin" on public.kpi_tightening_factors;
create policy "kpi_tightening_write_admin"
  on public.kpi_tightening_factors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 7. Quyền cấp phát — thu hồi tường minh với khách vãng lai
-- =============================================================================

revoke all on public.kpi_problem_types      from anon;
revoke all on public.kpi_modifiers          from anon;
revoke all on public.kpi_config             from anon;
revoke all on public.kpi_tightening_factors from anon;

grant select, insert, update, delete on public.kpi_problem_types      to authenticated;
grant select, insert, update, delete on public.kpi_modifiers          to authenticated;
grant select, insert, update, delete on public.kpi_config             to authenticated;
grant select, insert, update, delete on public.kpi_tightening_factors to authenticated;
