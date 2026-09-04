-- =============================================================================
-- Bộ chọn thiết bị: tách kết quả thành danh mục vật tư (BOM)
--
-- Trước đây một luật chỉ gợi ý được ba cụm: camera, ánh sáng, ống kính. Kỹ sư
-- vẫn phải tự nghĩ ra máy tính/giao tiếp và phụ kiện — hai thứ luôn phải mua
-- kèm, và cũng là chỗ hay bị bỏ sót nhất khi lên báo giá.
--
-- Hai cột mới giữ đúng nguyên tắc CLAUDE.md mục 9: nội dung gợi ý nằm trong
-- bảng luật admin sửa được, không hard-code trong ứng dụng. Engine chỉ TÍNH ra
-- băng thông dữ liệu (data_rate_mbytes_s) rồi để luật quyết định ngưỡng nào
-- dùng GigE, 5GigE hay CoaXPress.
-- =============================================================================

alter table public.selector_rules
  add column if not exists recommended_processing text;

alter table public.selector_rules
  add column if not exists recommended_accessories text;

comment on column public.selector_rules.recommended_processing is
  'Máy tính / giao tiếp / GPU. Viết điều kiện theo data_rate_mbytes_s để chọn GigE (~125 MB/s), 5GigE hay CoaXPress.';

comment on column public.selector_rules.recommended_accessories is
  'Phụ kiện phải mua kèm: kính lọc, cáp, gá đỡ, vỏ bảo vệ theo ip_rating.';
