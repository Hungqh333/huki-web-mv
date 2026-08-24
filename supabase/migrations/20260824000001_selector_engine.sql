-- =============================================================================
-- Bổ sung cho module Bộ chọn thiết bị (CLAUDE.md mục 4).
--
-- Mục tiêu kiến trúc: thêm bài toán mới (3D, OCR/OCV, barcode, robot guidance)
-- chỉ bằng cách THÊM DỮ LIỆU, không sửa code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. task_types.input_fields — form nhập liệu do dữ liệu quyết định
--
-- Mảng key của các trường cần hiện cho bài toán đó, theo đúng thứ tự hiển thị.
-- Định nghĩa chi tiết từng trường (kiểu dữ liệu, đơn vị, danh sách lựa chọn,
-- nhãn song ngữ) nằm trong catalog ở src/lib/selector/fields.ts.
--
-- Đánh đổi có chủ ý: thêm bài toán mới dùng lại các trường sẵn có = chỉ cần
-- INSERT một dòng ở đây. Chỉ khi cần một KIỂU trường hoàn toàn mới mới phải
-- thêm vào catalog trong code.
-- -----------------------------------------------------------------------------

alter table public.task_types
  add column if not exists input_fields jsonb not null default '[]'::jsonb;

comment on column public.task_types.input_fields is
  'Mảng key trường nhập liệu, ví dụ ["fov_width_mm","tolerance_mm"]. Key phải có trong catalog src/lib/selector/fields.ts.';

-- -----------------------------------------------------------------------------
-- 2. selector_rules.code — khoá tự nhiên để seed idempotent
--
-- Không có cột này thì chạy lại file seed sẽ nhân bản luật. Đồng thời cho admin
-- một mã dễ đọc để tham chiếu khi trao đổi ("luật ALIGN-REFLECTIVE sai rồi").
-- -----------------------------------------------------------------------------

alter table public.selector_rules
  add column if not exists code text;

-- Chỉ ràng buộc duy nhất trên các dòng có code, luật tạo tay qua admin UI để trống.
create unique index if not exists selector_rules_code_key
  on public.selector_rules (code)
  where code is not null;

comment on column public.selector_rules.code is
  'Mã tuỳ chọn, duy nhất. Dùng cho seed idempotent và để tham chiếu khi trao đổi.';

-- -----------------------------------------------------------------------------
-- 3. Ghi chú định dạng condition_json
--
-- Định dạng được engine hiểu (src/lib/selector/conditions.ts):
--
--   {"all": [ {"field": "...", "op": "...", "value": ...}, ... ]}
--
-- - "all" rỗng hoặc {} = luật nền, luôn khớp.
-- - op: eq, ne, lt, lte, gt, gte, in, nin, exists
-- - field: khoá trường nhập liệu, HOẶC một đại lượng suy ra do engine tính
--   (required_resolution_px, fov_long_mm, px_per_mm...). Nhờ vậy việc chọn cảm
--   biến theo độ phân giải cần thiết vẫn nằm trong bảng luật, admin sửa được,
--   còn phần công thức tính thì ở trong code.
-- -----------------------------------------------------------------------------

comment on column public.selector_rules.condition_json is
  'Định dạng {"all":[{"field","op","value"}]}. op: eq|ne|lt|lte|gt|gte|in|nin|exists. Rỗng = luật nền luôn khớp.';
