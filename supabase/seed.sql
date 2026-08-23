-- =============================================================================
-- Dữ liệu tham chiếu tối thiểu: danh mục bài toán + danh mục cẩm nang.
-- Chạy sau migration. Idempotent — chạy lại nhiều lần không nhân bản dữ liệu.
--
-- Bảng luật selector_rules được seed ở bước sau (Prompt 2).
-- Bài viết mẫu được seed ở bước sau (Prompt 3).
-- =============================================================================

-- Bài toán MVP (CLAUDE.md mục 4). Thêm bài toán phase 2 = thêm dòng ở đây.
insert into public.task_types (slug, name_vi, name_en, description_vi, description_en, sort_order)
values
  ('alignment',
   'Alignment / Căn chỉnh vị trí',
   'Alignment',
   'Xác định vị trí và góc xoay của vật thể để cơ cấu chấp hành căn chỉnh chính xác.',
   'Locate object position and rotation so the actuator can align precisely.',
   10),
  ('appearance-inspection',
   'Kiểm tra ngoại quan',
   'Appearance Inspection',
   'Phát hiện lỗi bề mặt: trầy xước, móp, bẩn, thiếu chi tiết, sai màu.',
   'Detect surface defects: scratches, dents, contamination, missing features, colour deviation.',
   20),
  ('2d-measurement',
   'Đo lường 2D',
   '2D Measurement',
   'Đo kích thước, khoảng cách, đường kính, góc trên mặt phẳng với dung sai xác định.',
   'Measure dimensions, distances, diameters and angles in a plane against a defined tolerance.',
   30)
on conflict (slug) do update set
  name_vi        = excluded.name_vi,
  name_en        = excluded.name_en,
  description_vi = excluded.description_vi,
  description_en = excluded.description_en,
  sort_order     = excluded.sort_order;

-- Nhóm nội dung cẩm nang (CLAUDE.md mục 5).
insert into public.categories (slug, name_vi, name_en, sort_order)
values
  ('fundamentals',      'Kiến thức nền',      'Fundamentals',        10),
  ('new-technology',    'Công nghệ mới',      'New Technology',      20),
  ('project-tips',      'Tips dự án thực tế', 'Real Project Tips',   30),
  ('equipment-reviews', 'So sánh thiết bị',   'Equipment Comparison', 40)
on conflict (slug) do update set
  name_vi    = excluded.name_vi,
  name_en    = excluded.name_en,
  sort_order = excluded.sort_order;
