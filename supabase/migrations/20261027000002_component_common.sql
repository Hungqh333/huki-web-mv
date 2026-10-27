-- =============================================================================
-- Đánh dấu thiết bị "thường dùng" — trang Danh mục thiết bị /thiet-bi
--
-- Chốt 2026-10-27 (Hùng, Q1): admin bấm ★ để đánh dấu; trang Danh mục mở mặc định
-- ở chế độ "Thường dùng", có nút "Xem cả kho". Không suy từ used_in_projects vì cột
-- đó đang gần như toàn 0 — danh sách sẽ trống.
--
-- Quyền giữ nguyên policy của bảng components: Member+ đọc, chỉ Admin ghi.
-- Chỉ thêm cột, không đụng dữ liệu. Dán lại nhiều lần không sao.
-- =============================================================================

alter table public.components
  add column if not exists is_common boolean not null default false;

comment on column public.components.is_common is
  'Thiết bị thường dùng của phòng — admin đánh dấu ★, trang /thiet-bi mặc định chỉ hiện các thiết bị này.';

create index if not exists components_common_idx
  on public.components (kind, sort_order) where is_common;
