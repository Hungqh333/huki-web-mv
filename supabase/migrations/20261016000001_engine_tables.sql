-- =============================================================================
-- Bảng tra của engine Vision Engineer sửa được qua admin — chốt 2026-10-16 (đợt 2):
--   table_key = 'lighting' : bảng chiếu sáng (loại lỗi / bề mặt → đèn chính, đèn
--                            thay thế, câu lý do vi/en)
--   table_key = 'defaults' : giả định mặc định (giá trị + câu giải thích vi/en)
--
-- Danh sách dòng, giá trị hợp lệ và mặc định nằm trong code:
-- src/lib/vision/engineTables.ts. Bảng chỉ giữ dòng ĐÃ SỬA khác mặc định —
-- "khôi phục mặc định" = xoá dòng. Dòng lỗi (kiểu đèn lạ, số ngoài giới hạn) thì
-- engine bỏ riêng dòng đó, dùng mặc định cho dòng đó (resolveEngineTables).
--
-- Quyền giống engine_parameters: đọc = mọi tài khoản đã đăng nhập; ghi = Admin.
-- Chạy lại được nhiều lần.
-- =============================================================================

create table if not exists public.engine_tables (
  table_key  text not null,
  row_key    text not null,
  data       jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now(),

  primary key (table_key, row_key),
  constraint engine_tables_table_check check (table_key in ('lighting', 'defaults')),
  constraint engine_tables_row_check check (row_key ~ '^[a-zA-Z_]+$'),
  constraint engine_tables_data_check check (jsonb_typeof(data) = 'object')
);

comment on table public.engine_tables is
  'Bảng chiếu sáng + giả định mặc định đã sửa khác mặc định. Danh sách dòng + giới hạn: src/lib/vision/engineTables.ts.';

drop trigger if exists engine_tables_set_updated_at on public.engine_tables;
create trigger engine_tables_set_updated_at
  before update on public.engine_tables
  for each row execute function public.set_updated_at();

alter table public.engine_tables enable row level security;

drop policy if exists "engine_tables_select_authenticated" on public.engine_tables;
create policy "engine_tables_select_authenticated"
  on public.engine_tables for select
  to authenticated
  using (true);

drop policy if exists "engine_tables_write_admin" on public.engine_tables;
create policy "engine_tables_write_admin"
  on public.engine_tables for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.engine_tables from anon;
grant select, insert, update, delete on public.engine_tables to authenticated;
