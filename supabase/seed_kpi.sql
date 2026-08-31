-- =============================================================================
-- Dữ liệu khởi tạo cho Bộ tính chỉ tiêu Vision.
-- Idempotent — chạy lại nhiều lần không nhân bản.
--
-- ============================ ĐỌC KỸ TRƯỚC KHI DÙNG ==========================
-- Toàn bộ con số dưới đây có data_source = 'estimate': ước lượng theo kinh
-- nghiệm ngành, CHƯA đối chiếu với lịch sử dự án của công ty.
--
-- Chúng là điểm khởi đầu để đàm phán, KHÔNG phải cam kết đã kiểm chứng. Sau mỗi
-- dự án hoàn thành, cập nhật lại số thật qua trang quản trị và đổi data_source
-- thành 'project_history'. Giao diện hiển thị nhãn này để người dùng biết mức
-- độ tin cậy của từng dòng.
-- =============================================================================

insert into public.kpi_problem_types (
  slug, problem_group, level, name_vi, name_en,
  miss_min, miss_max,
  false_reject_week1_min, false_reject_week1_max,
  false_reject_min, false_reject_max,
  recheck_min, recheck_max,
  total_burden_max, ramp_up_weeks_min, ramp_up_weeks_max,
  deep_learning, special_kpi, note_vi, note_en, sort_order
) values

-- ---------------------- A. Kiểm sự hiện diện & định danh ----------------------
('presence-basic', 'presence', 1,
 'Có/không, đếm, sai chiều — tương phản tốt',
 'Presence/absence, counting, orientation — good contrast',
 0, 0.1, 0, 0.5, 0, 0.2, 0, 0, 0.2, 0.5, 1, 'no', null, null, null, 10),

('color-obvious', 'presence', 1,
 'Kiểm màu — khác biệt rõ rệt',
 'Color check — obvious difference',
 0, 0.1, 1, 2, 0, 0.3, 0, 0, 0.3, 0.5, 1, 'no', null, null, null, 20),

('assembly-multipoint', 'presence', 2,
 'Kiểm nhiều điểm trên cụm lắp ráp',
 'Multi-point assembly verification',
 0.1, 0.3, 2, 4, 0.3, 1, 0, 0.5, 1.5, 1, 2, 'no', null, null, null, 30),

('part-classification', 'presence', 3,
 'Phân loại đúng/sai loại chi tiết (>10 biến thể)',
 'Part type classification (>10 variants)',
 0.2, 0.5, 4, 8, 0.5, 1.5, 0.5, 1, 2.5, 2, 3, 'sometimes', null, null, null, 40),

('color-subtle', 'presence', 5,
 'Kiểm màu — sắc độ tinh tế, so mẫu chuẩn',
 'Color check — subtle shade, against reference',
 0.5, 2, 8, 15, 1, 3, 1, 3, 5, 3, 6, 'sometimes', null, null, null, 50),

-- ---------------------------- B. Đo lường & định vị ---------------------------
('metrology-2d-wide', 'metrology', 2,
 'Đo 2D — dung sai ≥ 10× độ phân giải',
 '2D metrology — tolerance ≥ 10× resolution',
 0, 0.1, 1, 2, 0.2, 0.5, 0, 0.3, 0.8, 1, 2, 'no', null,
 'KPI gốc là Gage R&R ≤ 10%. Dung sai < 5× độ phân giải → không nhận bài toán.',
 'Primary KPI is Gage R&R ≤ 10%. Tolerance < 5× resolution → decline the job.', 60),

('metrology-2d-tight', 'metrology', 3,
 'Đo 2D — dung sai 5–10× độ phân giải',
 '2D metrology — tolerance 5–10× resolution',
 0.1, 0.3, 3, 6, 0.5, 1.5, 0.5, 1.5, 3, 2, 4, 'no', null,
 'KPI gốc là Gage R&R ≤ 20%. Vùng guard band chính là vùng xám.',
 'Primary KPI is Gage R&R ≤ 20%. The guard band is the grey zone.', 70),

('metrology-3d', 'metrology', 4,
 'Đo 3D — biên dạng, cao độ, độ phẳng',
 '3D metrology — profile, height, flatness',
 0.1, 0.5, 4, 8, 0.5, 2, 1, 2, 4, 3, 6, 'no', null, null, null, 80),

('robot-guidance-2d', 'metrology', 2,
 'Robot guidance 2D — pick & place mặt phẳng',
 '2D robot guidance — planar pick & place',
 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 'no', 'robot_guidance',
 'Không dùng bỏ sót/bắt ảo. KPI: độ lặp lại ±0,05–0,1 mm, tỷ lệ gắp thành công ≥ 99,5%.',
 'Does not use miss/false-reject. KPI: repeatability ±0.05–0.1 mm, pick success ≥ 99.5%.', 90),

('robot-guidance-3d', 'metrology', 6,
 'Robot guidance 3D — bin picking',
 '3D robot guidance — bin picking',
 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 12, 'often', 'robot_guidance',
 'KPI: độ lặp lại ±0,3–1,0 mm, gắp thành công 90–98%, kèm tỷ lệ va chạm và khay không gắp được.',
 'KPI: repeatability ±0.3–1.0 mm, pick success 90–98%, plus collision and unpickable-bin rates.', 100),

-- ----------------------------- C. Đọc mã & ký tự ------------------------------
('barcode-good', 'code', 1,
 'Barcode / DataMatrix in tốt (grade A/B)',
 'Barcode / DataMatrix, good print (grade A/B)',
 0, 0, 0, 0, 0, 0.3, 0, 0.3, 0.3, 0.5, 1, 'no', 'code_reading',
 'Có checksum nên xác suất đọc SAI ≈ 0. Dạng hỏng duy nhất là no-read (≤ 0,3%). Gắn cam kết với grade mã theo ISO/IEC 15415-15416.',
 'Checksum makes misreads ≈ 0. The only failure mode is no-read (≤ 0.3%). Tie the commitment to code grade per ISO/IEC 15415-15416.', 110),

('ocr-print', 'code', 2,
 'OCR bản in rõ nét',
 'OCR on clean printed text',
 0.05, 0.2, 2, 4, 0.3, 1, 0.3, 1, 2, 1, 2, 'sometimes', null, null, null, 120),

('ocv-print-quality', 'code', 4,
 'OCV — kiểm đúng nội dung, chất lượng in',
 'OCV — content and print-quality verification',
 0.2, 0.8, 5, 10, 1, 2, 1, 2, 4, 2, 4, 'sometimes', null, null, null, 130),

('barcode-poor', 'code', 4,
 'Barcode / DMC grade C–D, hoặc DPM khắc',
 'Barcode / DMC grade C–D, or marked DPM',
 0, 0, 0, 0, 1, 3, 0.5, 1.5, 4, 2, 4, 'sometimes', 'code_reading',
 'No-read 1–3%. Yêu cầu khách cấp báo cáo verifier trước khi cam kết.',
 'No-read 1–3%. Require the customer verifier report before committing.', 140),

('ocr-laser-mark', 'code', 5,
 'OCR khắc laser, dập kim loại',
 'OCR on laser-marked or dot-peened metal',
 0.2, 1, 8, 15, 1, 3, 1.5, 3, 6, 3, 6, 'often', null, null, null, 150),

-- -------------------------- D. Kiểm công đoạn quá trình -----------------------
('packaging', 'process', 2,
 'Đóng gói: nắp, seal, mức, tem nhãn',
 'Packaging: cap, seal, fill level, label',
 0.1, 0.3, 2, 4, 0.3, 1, 0, 0.5, 1.5, 1, 2, 'no', null, null, null, 160),

('glue-presence', 'process', 2,
 'Đường keo — có/không, đứt đoạn',
 'Glue bead — presence, breaks',
 0.1, 0.3, 3, 5, 0.5, 1.5, 0.3, 1, 2.5, 1, 2, 'no', null, null, null, 170),

('aoi-pcb', 'process', 3,
 'AOI linh kiện PCB — thiếu, lệch, ngược cực',
 'PCB AOI — missing, misaligned, reversed polarity',
 0.1, 0.5, 8, 15, 1, 3, 1, 2, 5, 2, 4, 'sometimes', null, null, null, 180),

('thread-hole-burr', 'process', 4,
 'Ren, lỗ, taro, bavia',
 'Threads, holes, tapping, burrs',
 0.2, 1, 4, 8, 0.5, 2, 1, 2, 4, 2, 5, 'sometimes', null, null, null, 190),

('glue-dimension', 'process', 4,
 'Đường keo — bề rộng, vị trí, thể tích',
 'Glue bead — width, position, volume',
 0.3, 1, 5, 10, 1, 3, 1, 2, 5, 3, 5, 'sometimes', null, null, null, 200),

('solder-joint', 'process', 6,
 'Mối hàn thiếc (solder joint)',
 'Solder joint inspection',
 0.5, 2, 15, 25, 2, 5, 2, 4, 8, 4, 8, 'often', null, null, null, 210),

('laser-weld', 'process', 6,
 'Mối hàn laser / hàn điểm kim loại',
 'Laser weld / spot weld inspection',
 1, 3, 15, 30, 2, 6, 2, 5, 10, 5, 10, 'often', null, null, null, 220),

-- --------------------------- E. Kiểm ngoại quan bề mặt ------------------------
('cosmetic-matte', 'cosmetic', 6,
 'Bề mặt nhám/mờ — có danh mục lỗi + mẫu giới hạn',
 'Matte surface — closed defect list + limit samples',
 0.5, 2, 10, 18, 2, 5, 2, 4, 8, 4, 8, 'often', null, null, null, 230),

('cosmetic-glossy', 'cosmetic', 7,
 'Bề mặt bóng, mạ, sơn',
 'Glossy, plated or painted surface',
 1, 3, 18, 30, 3, 8, 3, 6, 12, 6, 12, 'required', null,
 'Vượt trần thương mại 8%. Đừng bán "thay thế người kiểm" — bán "hỗ trợ người kiểm": vision lọc 80–90% hàng chắc chắn OK, người chỉ kiểm phần còn lại.',
 'Exceeds the 8% commercial ceiling. Do not sell "replace the inspector" — sell "assist the inspector": vision clears 80–90% of certain-OK parts, humans review the rest.', 240),

('web-inspection', 'cosmetic', 7,
 'Web inspection — cuộn liên tục, tốc độ cao',
 'Web inspection — continuous roll, high speed',
 1, 3, 10, 20, 2, 5, 0, 0, 5, 6, 12, 'often', 'web_inspection',
 'Không dừng được băng nên không có tái kiểm — thay bằng đánh dấu vùng lỗi, xử lý ở khâu cắt.',
 'The web cannot be stopped, so there is no recheck station — defect zones are marked and handled at slitting.', 250),

('cosmetic-transparent', 'cosmetic', 7,
 'Bề mặt trong suốt, kính, film',
 'Transparent surface, glass, film',
 2, 5, 25, 40, 4, 10, 4, 8, 15, 8, 14, 'required', null,
 'Vượt trần thương mại. Cân nhắc bán theo mô hình hỗ trợ người kiểm.',
 'Exceeds the commercial ceiling. Consider the assist-the-inspector model.', 260),

('cosmetic-subjective', 'cosmetic', 7,
 'Ngoại quan chủ quan, tiêu chuẩn mơ hồ',
 'Subjective cosmetic inspection, vague criteria',
 2, 5, 20, 35, 5, 12, 5, 10, 18, 8, 16, 'required', null,
 'Không cam kết con số trước ramp-up. Dùng Cơ chế D (cam kết kiến trúc).',
 'Do not commit numbers before ramp-up. Use Mechanism D (architecture commitment).', 270)

on conflict (slug) do update set
  problem_group          = excluded.problem_group,
  level                  = excluded.level,
  name_vi                = excluded.name_vi,
  name_en                = excluded.name_en,
  miss_min               = excluded.miss_min,
  miss_max               = excluded.miss_max,
  false_reject_week1_min = excluded.false_reject_week1_min,
  false_reject_week1_max = excluded.false_reject_week1_max,
  false_reject_min       = excluded.false_reject_min,
  false_reject_max       = excluded.false_reject_max,
  recheck_min            = excluded.recheck_min,
  recheck_max            = excluded.recheck_max,
  total_burden_max       = excluded.total_burden_max,
  ramp_up_weeks_min      = excluded.ramp_up_weeks_min,
  ramp_up_weeks_max      = excluded.ramp_up_weeks_max,
  deep_learning          = excluded.deep_learning,
  special_kpi            = excluded.special_kpi,
  note_vi                = excluded.note_vi,
  note_en                = excluded.note_en,
  sort_order             = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Hệ số điều chỉnh theo điều kiện thực tế
-- -----------------------------------------------------------------------------

insert into public.kpi_modifiers (slug, name_vi, name_en, factor_min, factor_max, direction, sort_order)
values
  ('glossy',           'Bề mặt bóng / gương',                     'Glossy or mirror surface',              1.5, 3.0, 'worse',  10),
  ('transparent',      'Vật liệu trong suốt',                     'Transparent material',                  2.0, 3.0, 'worse',  20),
  ('curved3d',         'Bề mặt cong 3D, nhiều mặt',               'Curved 3D surface, multiple faces',     1.5, 2.5, 'worse',  30),
  ('tiny-defect',      'Lỗi nhỏ nhất < 3 pixel trong ảnh',        'Smallest defect < 3 px in image',       2.0, 4.0, 'worse',  40),
  ('textured',         'Bề mặt có vân, nhiễu nền',                'Textured surface, background noise',    1.5, 2.5, 'worse',  50),
  ('no-limit-sample',  'Không có mẫu giới hạn vật lý',            'No physical limit samples',             1.5, 3.0, 'worse',  60),
  ('many-variants',    'Nhiều mã / nhiều màu (> 10 biến thể)',    'Many SKUs or colors (> 10 variants)',   1.3, 2.0, 'worse',  70),
  ('tight-space',      'Không gian chật, không tối ưu góc chiếu', 'Tight space, suboptimal lighting angle',1.3, 2.0, 'worse',  80),
  ('ambient-light',    'Ánh sáng môi trường không che chắn',      'Unshielded ambient light',              1.3, 2.0, 'worse',  90),
  ('unstable-material','Vật liệu / NCC đang thay đổi',            'Material or supplier changing',         1.3, 2.0, 'worse', 100),
  ('fast-cycle',       'Chu kỳ < 200 ms',                         'Cycle time < 200 ms',                   1.2, 2.0, 'worse', 110),
  ('free-feed',        'Cấp phôi tự do, không định vị',           'Free-flow feeding, no fixturing',       1.2, 1.5, 'worse', 120),
  ('hard-jig',         'Định vị cứng bằng jig < 0,5 mm',          'Hard fixturing < 0.5 mm',               0.7, 0.7, 'better',130),
  ('limit-sample',     'Có mẫu giới hạn vật lý đã ký duyệt',      'Approved physical limit samples',       0.7, 0.7, 'better',140),
  ('historic-data',    'Có > 10.000 ảnh lịch sử đã gán nhãn',     '> 10,000 labelled historical images',   0.7, 0.7, 'better',150),
  ('single-sku',       'Sản phẩm đơn mã, ổn định 12 tháng',       'Single SKU, stable for 12 months',      0.8, 0.8, 'better',160)
on conflict (slug) do update set
  name_vi    = excluded.name_vi,
  name_en    = excluded.name_en,
  factor_min = excluded.factor_min,
  factor_max = excluded.factor_max,
  direction  = excluded.direction,
  sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Hằng số của mô hình
--
-- Đây là ước lượng theo kinh nghiệm, KHÔNG phải hằng số vật lý. Chỉnh được ở
-- trang quản trị khi có dữ liệu dự án thật.
-- -----------------------------------------------------------------------------

insert into public.kpi_config (key, value, name_vi, name_en, note_vi, note_en) values
  ('commercial_ceiling', 8,
   'Trần thương mại của tổng tải phụ (%)',
   'Commercial ceiling for total burden (%)',
   'Vượt mức này thì dự án gần như chắc chắn không nghiệm thu được vì chi phí vận hành, dù kỹ thuật đúng.',
   'Above this level a project almost certainly fails acceptance on operating cost, even when technically correct.'),

  ('modifier_cap', 5.0,
   'Trần hệ số nhân dồn',
   'Cap on the compounded modifier',
   'Nhân dồn nhiều hệ số sẽ ra con số vô lý. Chặn ở đây.',
   'Compounding many modifiers produces implausible numbers. Capped here.'),

  ('level_up_threshold', 3.0,
   'Ngưỡng đề xuất nâng mức độ khó',
   'Threshold to suggest a difficulty level up',
   'Hệ số vượt mức này nghĩa là bài toán đã khác hẳn loại ban đầu — nên chọn lại loại khó hơn thay vì nhân hệ số.',
   'Above this the problem is effectively a different class — pick a harder type rather than multiplying.'),

  ('recheck_exponent', 1.0,
   'Số mũ áp hệ số lên tái kiểm',
   'Exponent applied to recheck',
   'Để 1,0 = tái kiểm giãn cùng nhịp với bắt ảo. Vùng xám là phần chồng lấn giữa phân bố điểm của hàng OK và NG; điều kiện xấu đi làm nhóm này PHÌNH TO, không co lại — nên không có cơ sở thống kê để nó tăng chậm hơn. Quan sát "tái kiểm tăng chậm hơn" trong thực tế đến từ trần nhân lực, và trần đó đã được kiểm riêng bằng phép tính số người.',
   'Keep at 1.0 so recheck scales in step with false reject. The grey zone is the overlap between OK and NG score distributions; worse conditions make that population GROW, not shrink, so there is no statistical basis for it to grow more slowly. The real-world observation that recheck grows more slowly comes from the manpower ceiling, which is checked separately by the headcount calculation.'),

  ('commercial_ceiling_unclear_spec', 10,
   'Trần thương mại khi tiêu chuẩn chưa rõ ràng (%)',
   'Commercial ceiling when the spec is unclear (%)',
   'Áp dụng khi khách chưa có danh mục lỗi đóng, chưa có mẫu giới hạn, hoặc tiêu chuẩn còn mang tính chủ quan. Nới trần vì hai bên đều biết còn phải hiệu chỉnh sau ramp-up.',
   'Applies when the customer has no closed defect list, no limit samples, or the criteria remain subjective. The ceiling is relaxed because both sides accept that tuning continues after ramp-up.'),

  ('no_recheck_miss_multiplier', 1.5,
   'Hệ số tăng bỏ sót khi bỏ trạm tái kiểm',
   'Miss multiplier when the recheck station is removed',
   'Bỏ vùng xám là mất vùng đệm an toàn, bỏ sót tăng lên.',
   'Removing the grey zone removes the safety buffer, so misses increase.'),

  ('minimize_scrap_false_reject_share', 0.15,
   'Tỷ lệ tải phụ đi vào bắt ảo khi ưu tiên giữ hàng',
   'Share of burden going to false reject when minimising scrap',
   'Phần còn lại chuyển sang tái kiểm.',
   'The remainder goes to recheck.'),

  ('assist_model_auto_clear_share', 85,
   'Tỷ lệ hàng vision tự thông qua ở mô hình hỗ trợ người kiểm (%)',
   'Share auto-cleared by vision in the assist model (%)',
   'Dùng khi tổng tải phụ vượt trần thương mại: vision lọc phần chắc chắn OK, người kiểm phần còn lại.',
   'Used when burden exceeds the commercial ceiling: vision clears the certain-OK parts, humans review the rest.')

on conflict (key) do update set
  value   = excluded.value,
  name_vi = excluded.name_vi,
  name_en = excluded.name_en,
  note_vi = excluded.note_vi,
  note_en = excluded.note_en;

-- -----------------------------------------------------------------------------
-- Hệ số khi khách đòi siết bỏ sót
-- -----------------------------------------------------------------------------

insert into public.kpi_tightening_factors (miss_ratio, burden_k, label_vi, label_en, sort_order) values
  (2,  1.6, 'Giảm bỏ sót một nửa', 'Halve the miss rate',    10),
  (5,  3.0, 'Giảm bỏ sót 5 lần',   'Reduce miss rate 5×',    20),
  (10, 5.0, 'Giảm bỏ sót 10 lần',  'Reduce miss rate 10×',   30),
  (20, 8.0, 'Giảm bỏ sót 20 lần',  'Reduce miss rate 20×',   40)
on conflict (miss_ratio) do update set
  burden_k   = excluded.burden_k,
  label_vi   = excluded.label_vi,
  label_en   = excluded.label_en,
  sort_order = excluded.sort_order;
