-- =============================================================================
-- Thông tin mua hàng của linh kiện (V1c — xếp hạng mềm, spec V1.1 §8.2)
--
-- Xếp hạng mềm cần biết món nào CÓ SẴN, mua ở ĐÂU và phòng đã TỪNG DÙNG chưa —
-- trước đây bảng chỉ có giá. Ba cột này cũng là ba cột BOM gửi mua hàng bắt
-- buộc phải có (spec §11.2: lead time, nhà cung cấp).
--
-- Để cột riêng chứ không nhét vào `spec`: đây không phải thông số kỹ thuật và
-- không phụ thuộc loại linh kiện — camera hay cáp đều có thời gian giao hàng.
--
-- Hai tiêu chí còn lại của §8.2 (hỗ trợ tại chỗ, dư địa nâng cấp) CHƯA có cột:
-- chưa có nguồn dữ liệu nào, thêm cột rỗng chỉ mời người điền đoán. Bộ xếp
-- hạng tính chúng bằng 0 và ghi rõ "chưa có dữ liệu".
-- =============================================================================

alter table public.components
  add column if not exists lead_time_days integer;

alter table public.components
  add column if not exists supplier text;

alter table public.components
  add column if not exists used_in_projects integer not null default 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'components_lead_time_valid' and conrelid = 'public.components'::regclass
  ) then
    alter table public.components
      add constraint components_lead_time_valid check (lead_time_days is null or lead_time_days >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'components_used_in_projects_valid' and conrelid = 'public.components'::regclass
  ) then
    alter table public.components
      add constraint components_used_in_projects_valid check (used_in_projects >= 0);
  end if;
end $$;

comment on column public.components.lead_time_days is
  'Số ngày từ lúc đặt tới lúc nhận hàng. Null = chưa biết (xếp hạng coi như kém nhất, không coi như có sẵn).';

comment on column public.components.supplier is
  'Nhà cung cấp / nhà phân phối tại Việt Nam.';

comment on column public.components.used_in_projects is
  'Số dự án của phòng đã dùng thiết bị này. Đã chạy thật ở hiện trường là bằng chứng mạnh hơn datasheet.';
