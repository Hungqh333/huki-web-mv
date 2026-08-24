-- =============================================================================
-- Dữ liệu tham chiếu + bảng luật gợi ý thiết bị.
-- Chạy sau migration. Idempotent — chạy lại nhiều lần không nhân bản dữ liệu.
--
-- LƯU Ý: bảng luật dưới đây là DỮ LIỆU TẠM để test engine chạy được ngay.
-- Đội kỹ thuật sẽ thay bằng bảng luật đầy đủ. Sửa qua admin UI (Prompt 4),
-- không cần đụng vào code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bài toán MVP (CLAUDE.md mục 4). Thêm bài toán phase 2 = thêm dòng ở đây.
-- input_fields quyết định form hiện những trường nào (catalog trường:
-- src/lib/selector/fields.ts).
-- -----------------------------------------------------------------------------

insert into public.task_types (slug, name_vi, name_en, description_vi, description_en, sort_order, input_fields)
values
  ('alignment',
   'Alignment / Căn chỉnh vị trí',
   'Alignment',
   'Xác định vị trí và góc xoay của vật thể để cơ cấu chấp hành căn chỉnh chính xác.',
   'Locate object position and rotation so the actuator can align precisely.',
   10,
   '["fov_width_mm","fov_height_mm","tolerance_mm","rotation_range_deg","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb),
  ('appearance-inspection',
   'Kiểm tra ngoại quan',
   'Appearance Inspection',
   'Phát hiện lỗi bề mặt: trầy xước, móp, bẩn, thiếu chi tiết, sai màu.',
   'Detect surface defects: scratches, dents, contamination, missing features, colour deviation.',
   20,
   '["fov_width_mm","fov_height_mm","defect_min_size_mm","defect_variability","color_critical","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb),
  ('2d-measurement',
   'Đo lường 2D',
   '2D Measurement',
   'Đo kích thước, khoảng cách, đường kính, góc trên mặt phẳng với dung sai xác định.',
   'Measure dimensions, distances, diameters and angles in a plane against a defined tolerance.',
   30,
   '["fov_width_mm","fov_height_mm","tolerance_mm","measure_type","perspective_free","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb)
on conflict (slug) do update set
  name_vi        = excluded.name_vi,
  name_en        = excluded.name_en,
  description_vi = excluded.description_vi,
  description_en = excluded.description_en,
  sort_order     = excluded.sort_order,
  input_fields   = excluded.input_fields;

-- -----------------------------------------------------------------------------
-- Nhóm nội dung cẩm nang (CLAUDE.md mục 5).
-- -----------------------------------------------------------------------------

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

-- =============================================================================
-- BẢNG LUẬT GỢI Ý THIẾT BỊ
--
-- priority: SỐ NHỎ = ƯU TIÊN CAO. Luật ưu tiên cao thắng ở từng ô kết quả
-- (camera / ánh sáng / lens). Ghi chú thì gom từ mọi luật khớp.
--
-- condition_json: {"all":[{"field","op","value"}]} — rỗng = luật nền luôn khớp.
-- field dùng được cả tham số nhập vào lẫn đại lượng engine tính ra
-- (required_resolution_px, fov_long_mm, px_per_mm, required_sensor_mp).
-- =============================================================================

insert into public.selector_rules
  (code, task_type_id, condition_json, recommended_camera, recommended_lighting,
   recommended_lens, ai_or_rule_based, notes_vi, notes_en, priority)
values

-- ---------------------------------------------------------------- ALIGNMENT --
('ALIGN-BASE',
 (select id from public.task_types where slug = 'alignment'),
 '{}'::jsonb,
 'Area scan đơn sắc, global shutter, ≥ 2 MP',
 'Đèn vòng khuếch tán (diffuse ring)',
 'Ống kính fixed focal, ngàm C',
 'rule_based',
 'Cấu hình nền cho bài toán căn chỉnh. Dùng template matching / geometric pattern matching, không cần deep learning.',
 'Baseline configuration for alignment. Use template or geometric pattern matching; deep learning is unnecessary.',
 100),

('ALIGN-REFLECTIVE',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"surface","op":"in","value":["reflective"]}]}'::jsonb,
 null,
 'Đèn dome khuếch tán toàn phần',
 null,
 'rule_based',
 'Bề mặt phản chiếu dễ tạo điểm loá làm lệch tâm mẫu. Dome cho ánh sáng đều từ mọi hướng, hạn chế loá.',
 'Reflective surfaces create hot spots that shift the matched centre. A dome gives uniform light from all directions.',
 50),

('ALIGN-METAL',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"surface","op":"in","value":["metal"]}]}'::jsonb,
 null,
 'Đèn đồng trục (coaxial)',
 null,
 'rule_based',
 'Kim loại bóng: chiếu đồng trục cho tương phản biên ổn định giữa các lô hàng.',
 'Shiny metal: coaxial lighting keeps edge contrast stable across batches.',
 50),

('ALIGN-TRANSPARENT',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"surface","op":"in","value":["transparent"]}]}'::jsonb,
 null,
 'Đèn nền (backlight) tạo bóng biên',
 null,
 'rule_based',
 'Vật trong suốt gần như không có tương phản khi chiếu trực diện. Backlight biến bài toán thành nhận dạng bóng.',
 'Transparent parts have almost no front-lit contrast. A backlight turns the task into silhouette detection.',
 50),

('ALIGN-TIGHT-TOL',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"tolerance_mm","op":"lt","value":0.05}]}'::jsonb,
 null,
 null,
 'Ống kính telecentric',
 'rule_based',
 'Dung sai dưới 0.05 mm: sai số phối cảnh của ống kính thường đã lớn hơn cả dung sai. Bắt buộc telecentric.',
 'Below 0.05 mm tolerance the perspective error of a standard lens already exceeds the tolerance. Telecentric is mandatory.',
 30),

('ALIGN-HIGH-SPEED',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"throughput_ppm","op":"gt","value":120}]}'::jsonb,
 'Area scan global shutter, ≥ 200 fps, giao tiếp GigE Vision hoặc CoaXPress',
 'Đèn strobe đồng bộ trigger',
 null,
 'rule_based',
 'Trên 120 part/phút: bắt buộc global shutter và strobe để đóng băng chuyển động. Rolling shutter sẽ làm méo hình.',
 'Above 120 parts/min a global shutter plus strobe is required to freeze motion; a rolling shutter will skew the image.',
 40),

('ALIGN-HIGH-RES',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"required_resolution_px","op":"gt","value":5000}]}'::jsonb,
 'Area scan ≥ 12 MP, hoặc chia FOV cho 2 camera',
 null,
 null,
 'rule_based',
 'Độ phân giải cần thiết vượt 5000 px trên một trục. Cân nhắc chia FOV cho nhiều camera — thường rẻ và ổn định hơn một cảm biến siêu lớn.',
 'Required resolution exceeds 5000 px on one axis. Splitting the FOV across several cameras is usually cheaper and more stable than one very large sensor.',
 35),

('ALIGN-VIBRATION',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"environment","op":"in","value":["vibration"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Môi trường rung: dùng giá đỡ cứng vững tách khỏi khung băng tải, khoá vòng focus bằng keo, và trigger theo encoder thay vì theo thời gian.',
 'Vibration present: use a rigid mount decoupled from the conveyor frame, glue-lock the focus ring, and trigger from an encoder rather than on a timer.',
 60),

('ALIGN-FULL-ROTATION',
 (select id from public.task_types where slug = 'alignment'),
 '{"all":[{"field":"rotation_range_deg","op":"gte","value":180}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Góc xoay tự do lớn: dùng geometric pattern matching hỗ trợ xoay 360°, không dùng correlation matching thuần. Thời gian xử lý sẽ tăng đáng kể.',
 'Wide rotation range: use geometric pattern matching with full 360° search rather than plain correlation matching. Expect a significant processing time increase.',
 70),

-- --------------------------------------------------- APPEARANCE INSPECTION --
('APPEAR-BASE',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{}'::jsonb,
 'Area scan đơn sắc, ≥ 5 MP',
 'Đèn vòng khuếch tán góc thấp',
 'Ống kính fixed focal, ngàm C',
 'rule_based',
 'Cấu hình nền cho kiểm tra ngoại quan. Ưu tiên xử lý theo ngưỡng và blob analysis trước khi nghĩ tới deep learning.',
 'Baseline configuration for appearance inspection. Try thresholding and blob analysis before considering deep learning.',
 100),

('APPEAR-REFLECTIVE',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"surface","op":"in","value":["reflective"]}]}'::jsonb,
 null,
 'Đèn dome khuếch tán toàn phần',
 null,
 'rule_based',
 'Bề mặt phản chiếu: điểm loá rất dễ bị nhận nhầm thành lỗi. Dome cho nền sáng đều, giảm báo lỗi giả.',
 'Reflective surface: hot spots are easily mistaken for defects. A dome gives an even background and cuts false rejects.',
 50),

('APPEAR-METAL-DARKFIELD',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"surface","op":"in","value":["metal"]}]}'::jsonb,
 null,
 'Đèn dark field góc thấp',
 null,
 'rule_based',
 'Trầy xước trên kim loại chỉ hiện rõ khi chiếu góc thấp: vết xước tán xạ sáng còn nền phẳng thì tối.',
 'Scratches on metal only show under low-angle light: the scratch scatters light while the flat background stays dark.',
 50),

('APPEAR-TRANSPARENT',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"surface","op":"in","value":["transparent"]}]}'::jsonb,
 null,
 'Kết hợp đèn nền + dark field',
 null,
 'rule_based',
 'Vật trong suốt: backlight bắt lỗi bên trong (bọt khí, tạp chất), dark field bắt lỗi bề mặt (xước, bám bẩn). Thường phải chụp 2 lần.',
 'Transparent parts: backlight reveals internal defects (bubbles, inclusions) while dark field reveals surface defects. Two exposures are usually required.',
 50),

('APPEAR-COLOR',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"color_critical","op":"eq","value":true}]}'::jsonb,
 'Area scan màu, cảm biến Bayer ≥ 5 MP',
 'Đèn trắng CRI cao (≥ 90), nhiệt màu ổn định',
 null,
 'rule_based',
 'Đánh giá màu: bắt buộc camera màu và nguồn sáng CRI cao. Phải cân bằng trắng theo mẫu chuẩn và che sáng môi trường.',
 'Colour grading requires a colour camera and a high-CRI light source. White-balance against a reference sample and shield from ambient light.',
 45),

('APPEAR-DL-HIGH-VAR',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"defect_variability","op":"eq","value":"high"}]}'::jsonb,
 null,
 null,
 null,
 'deep_learning',
 'Lỗi biến thiên mạnh về hình dạng và vị trí nên không định nghĩa được bằng ngưỡng cố định — đây chính là trường hợp deep learning vượt trội. Cần tối thiểu vài trăm ảnh mẫu mỗi loại lỗi và một quy trình gán nhãn rõ ràng.',
 'Defects vary strongly in shape and location, so no fixed threshold can describe them — this is where deep learning genuinely wins. Budget for at least a few hundred labelled images per defect class and a clear labelling process.',
 20),

('APPEAR-HYBRID-MED-VAR',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"defect_variability","op":"eq","value":"medium"}]}'::jsonb,
 null,
 null,
 null,
 'hybrid',
 'Biến thiên trung bình: dùng rule-based để khoanh vùng và loại nhanh hàng đạt, chỉ đẩy phần nghi ngờ sang mô hình deep learning. Vừa giữ được tốc độ vừa giảm lượng ảnh cần gán nhãn.',
 'Medium variability: use rule-based processing to segment and quickly pass good parts, sending only ambiguous regions to a deep learning model. This keeps throughput up and reduces labelling effort.',
 25),

('APPEAR-LINE-SCAN',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"required_resolution_px","op":"gt","value":6000}]}'::jsonb,
 'Line scan ≥ 8k px kèm encoder đồng bộ',
 null,
 null,
 'rule_based',
 'Độ phân giải cần thiết vượt 6000 px: line scan cho độ phân giải cao trên vật dài mà không cần cảm biến diện tích cực lớn. Bắt buộc có encoder và cơ cấu chuyển động đều.',
 'Required resolution exceeds 6000 px: a line scan camera delivers high resolution across long parts without a very large area sensor. An encoder and constant-velocity motion are mandatory.',
 35),

('APPEAR-DUST',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"environment","op":"in","value":["dust"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Môi trường bụi: dùng vỏ bảo vệ có thổi khí áp dương cho camera và đèn, kèm lịch vệ sinh kính định kỳ. Bụi bám kính là nguyên nhân trôi kết quả phổ biến nhất.',
 'Dusty environment: use a positive-pressure air-purged enclosure for camera and lights, plus a scheduled window-cleaning routine. Dust on the window is the most common cause of drifting results.',
 60),

-- ----------------------------------------------------------- 2D MEASUREMENT --
('MEAS-BASE',
 (select id from public.task_types where slug = '2d-measurement'),
 '{}'::jsonb,
 'Area scan đơn sắc, global shutter',
 'Đèn nền (backlight) chuẩn trực',
 'Ống kính fixed focal, ngàm C',
 'rule_based',
 'Cấu hình nền cho đo lường 2D. Đo kích thước là bài toán hình học thuần tuý — deep learning không phù hợp vì không cho sai số lặp lại ổn định.',
 'Baseline configuration for 2D measurement. Dimensional measurement is purely geometric; deep learning is a poor fit because it does not give repeatable metric error.',
 100),

('MEAS-TELECENTRIC-TOL',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"tolerance_mm","op":"lt","value":0.05}]}'::jsonb,
 null,
 null,
 'Ống kính telecentric',
 'rule_based',
 'Dung sai dưới 0.05 mm: ống kính thường có sai số phối cảnh khiến vật cao thấp khác nhau đo ra kích thước khác nhau. Telecentric là bắt buộc, không phải tuỳ chọn.',
 'Tolerance below 0.05 mm: a standard lens introduces perspective error, so parts at different heights measure differently. Telecentric is mandatory, not optional.',
 20),

('MEAS-TELECENTRIC-PERSP',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"perspective_free","op":"eq","value":true}]}'::jsonb,
 null,
 null,
 'Ống kính telecentric',
 'rule_based',
 'Yêu cầu không sai số phối cảnh: chỉ telecentric mới cho tia chính song song, nhờ đó kích thước đo được không đổi theo khoảng cách làm việc.',
 'Perspective-free requirement: only a telecentric lens gives parallel chief rays, so the measured size does not change with working distance.',
 20),

('MEAS-ANGLE',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"measure_type","op":"eq","value":"angle"}]}'::jsonb,
 null,
 null,
 'Ống kính telecentric',
 'rule_based',
 'Đo góc rất nhạy với méo hình: méo phối cảnh chỉ 1% cũng làm sai số góc vượt ngưỡng ở hầu hết ứng dụng.',
 'Angle measurement is highly sensitive to distortion: even 1% perspective distortion pushes angular error past the limit in most applications.',
 25),

('MEAS-SILHOUETTE',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"measure_type","op":"in","value":["dimension","diameter"]}]}'::jsonb,
 null,
 'Đèn nền telecentric chuẩn trực',
 null,
 'rule_based',
 'Đo kích thước và đường kính: backlight chuẩn trực cho biên sắc nét nhất, biên ổn định thì thuật toán sub-pixel mới đạt độ lặp lại tốt.',
 'Dimension and diameter measurement: a collimated backlight gives the sharpest edge, and a stable edge is what lets sub-pixel algorithms reach good repeatability.',
 40),

('MEAS-REFLECTIVE',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"surface","op":"in","value":["reflective","metal"]}]}'::jsonb,
 null,
 'Đèn nền chuẩn trực, bổ sung khuếch tán mặt trước nếu cần đọc chi tiết bề mặt',
 null,
 'rule_based',
 'Bề mặt phản chiếu: luôn ưu tiên đo theo bóng biên (backlight). Chiếu trực diện lên kim loại bóng cho biên trôi theo từng lô hàng.',
 'Reflective surface: always prefer silhouette measurement with a backlight. Front lighting on shiny metal gives edges that drift between batches.',
 55),

('MEAS-HIGH-RES',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"required_resolution_px","op":"gt","value":5000}]}'::jsonb,
 'Area scan ≥ 20 MP, hoặc chia FOV cho nhiều camera',
 null,
 null,
 'rule_based',
 'Độ phân giải cần thiết vượt 5000 px trên một trục. Lưu ý ống kính telecentric cỡ lớn tăng giá rất nhanh theo đường kính — chia FOV thường rẻ hơn nhiều.',
 'Required resolution exceeds 5000 px on one axis. Note that large telecentric lenses get expensive very quickly with diameter — splitting the FOV is often far cheaper.',
 30),

('MEAS-HIGH-SPEED',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"throughput_ppm","op":"gt","value":60}]}'::jsonb,
 'Area scan global shutter kèm trigger phần cứng',
 'Đèn strobe đồng bộ trigger',
 null,
 'rule_based',
 'Trên 60 part/phút: bắt buộc trigger phần cứng và strobe. Nhoè chuyển động dù nhỏ cũng làm biên nở ra, gây sai số đo có hệ thống.',
 'Above 60 parts/min hardware triggering and a strobe are required. Even slight motion blur widens the edge and produces a systematic measurement bias.',
 45),

('MEAS-VIBRATION',
 (select id from public.task_types where slug = '2d-measurement'),
 '{"all":[{"field":"environment","op":"in","value":["vibration"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Môi trường rung: đặt cụm camera và đèn trên cùng một tấm đế cứng, dừng hẳn vật trước khi chụp nếu có thể. Rung là nguyên nhân số một làm độ lặp lại không đạt.',
 'Vibration present: mount camera and light on a single rigid plate and bring the part to a full stop before exposure where possible. Vibration is the number one cause of failing repeatability.',
 60)

on conflict (code) where code is not null do update set
  task_type_id         = excluded.task_type_id,
  condition_json       = excluded.condition_json,
  recommended_camera   = excluded.recommended_camera,
  recommended_lighting = excluded.recommended_lighting,
  recommended_lens     = excluded.recommended_lens,
  ai_or_rule_based     = excluded.ai_or_rule_based,
  notes_vi             = excluded.notes_vi,
  notes_en             = excluded.notes_en,
  priority             = excluded.priority,
  is_active            = true;
