-- =============================================================================
-- Bảng của trang Chọn đèn sửa qua admin — thêm table_key 'lightColor', 'lightMatrix' vào engine_tables
--
-- Chốt 2026-10-22 (Hùng, trang Chọn đèn bản 2 — docs/NHAP_CHON_DEN_V2.md), sửa ở /admin/bang-chieu-sang:
--   · 'lightColor'  — hệ số phản xạ 13 màu × đỏ / lục / lam + 3 mục đích đặc biệt (LGT-010…014)
--   · 'lightMatrix' — kiểu đèn: thứ tự xét, ma trận lỗi × bề mặt, bảng theo bài toán (LGT-017…023)
-- Danh sách dòng + giới hạn: src/lib/vision/lightColor.ts, lightMatrix.ts, engineTables.ts.
--
-- Chỉ nới danh sách bảng hợp lệ, không đụng dữ liệu, không đổi quyền (vẫn chỉ admin
-- đọc/ghi — migration 20261021000001). Dán lại nhiều lần không sao.
-- =============================================================================

alter table public.engine_tables
  drop constraint if exists engine_tables_table_check;

alter table public.engine_tables
  add constraint engine_tables_table_check check (table_key in ('lighting', 'defaults', 'lightColor', 'lightMatrix'));
