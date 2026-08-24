-- =============================================================================
-- Sửa phần chữ tiếng Việt bị hỏng encoding khi dán migration vào SQL Editor.
--
-- Chỉ cần chạy nếu bạn đã dán migration bằng clipboard bị băm UTF-8 (xem cảnh
-- báo ở README mục 2). Phần này thuần hiển thị: comment mô tả cột/bảng và một
-- câu thông báo lỗi. Cấu trúc bảng, policy, trigger KHÔNG bị ảnh hưởng vì toàn
-- bộ tên bảng/cột/enum đều là ASCII.
--
-- Idempotent, chạy lại bao nhiêu lần cũng được.
-- =============================================================================

comment on column public.profiles.role is
  'Mặc định luôn là registered. Chỉ admin mới đổi được (xem trigger enforce_profile_role_change).';

comment on table public.task_types is
  'Thêm bài toán mới (3D, OCR/OCV, barcode, robot guidance) = thêm dòng ở đây, không sửa code.';

comment on column public.selector_rules.priority is
  'Số nhỏ = ưu tiên cao. Thứ tự ưu tiên nghiệp vụ: ổn định > chính xác > tốc độ > bảo trì > triển khai > chi phí.';

comment on column public.articles.published_at is
  'NULL = bản nháp, chỉ admin xem được.';

comment on view public.article_previews is
  'Chỉ teaser đã cắt ngắn. Toàn văn luôn phải đọc từ bảng articles (có RLS).';

-- Thông báo lỗi khi user cố tự nâng quyền.
create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Chỉ admin mới được thay đổi role.' using errcode = '42501';
  end if;
  return new;
end;
$$;
