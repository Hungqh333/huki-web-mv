-- =============================================================================
-- Ngưỡng phán đoán của engine Vision Engineer, sửa được qua admin.
-- CLAUDE.md §9 + chốt 2026-10-12 (Q1).
--
-- Danh sách khoá, mặc định, giới hạn min/max và ràng buộc chéo nằm trong code:
-- src/lib/vision/engineParams.ts. Bảng chỉ giữ các giá trị ĐÃ SỬA khác mặc định —
-- "khôi phục mặc định" = xoá dòng. Khoá lạ hoặc bộ giá trị vi phạm ràng buộc thì
-- engine bỏ qua cả bảng và chạy bằng mặc định (resolveEngineParams).
--
-- Đọc: mọi tài khoản đã đăng nhập (trang Yêu cầu, lưu dự án, xuất file đều cần).
-- Ghi: chỉ Admin. Chạy lại được nhiều lần.
-- =============================================================================

create table if not exists public.engine_parameters (
  key        text primary key,
  value      numeric not null,
  updated_by text,
  updated_at timestamptz not null default now(),

  constraint engine_parameters_key_check check (key ~ '^[a-zA-Z]+$'),
  constraint engine_parameters_value_check check (value >= 0)
);

comment on table public.engine_parameters is
  'Ngưỡng engine đã sửa khác mặc định. Danh sách khoá + giới hạn: src/lib/vision/engineParams.ts.';

drop trigger if exists engine_parameters_set_updated_at on public.engine_parameters;
create trigger engine_parameters_set_updated_at
  before update on public.engine_parameters
  for each row execute function public.set_updated_at();

alter table public.engine_parameters enable row level security;

drop policy if exists "engine_parameters_select_authenticated" on public.engine_parameters;
create policy "engine_parameters_select_authenticated"
  on public.engine_parameters for select
  to authenticated
  using (true);

drop policy if exists "engine_parameters_write_admin" on public.engine_parameters;
create policy "engine_parameters_write_admin"
  on public.engine_parameters for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.engine_parameters from anon;
grant select, insert, update, delete on public.engine_parameters to authenticated;
