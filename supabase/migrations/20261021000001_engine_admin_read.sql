-- =============================================================================
-- Bảng ngưỡng engine + bảng chiếu sáng / giả định: CHỈ ADMIN đọc được
--
-- Chốt 2026-10-21 (Hùng, bảo vệ công thức — đợt 1): trước đây mọi tài khoản đã
-- đăng nhập (kể cả Registered tự đăng ký) đọc được hai bảng này qua REST, tức là
-- đọc được các ngưỡng đã chỉnh. Từ nay:
--   · Admin đọc + ghi (policy *_write_admin "for all" đã có từ trước).
--   · Mọi vai trò khác KHÔNG đọc được.
--   · Máy chủ web đọc bằng khoá service_role (bỏ qua RLS) để tính cho Member/VIP —
--     xem src/lib/engineParamsLoad.ts. Khoá này chỉ nằm ở máy chủ, không tới trình duyệt.
--
-- Chỉ bỏ policy đọc, không đụng dữ liệu. Dán lại nhiều lần không sao.
-- =============================================================================

drop policy if exists "engine_parameters_select_authenticated" on public.engine_parameters;
drop policy if exists "engine_tables_select_authenticated" on public.engine_tables;
