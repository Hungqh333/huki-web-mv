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

-- =============================================================================
-- BÀI VIẾT MẪU (CLAUDE.md mục 5)
--
-- Phân bố cố ý để test gating: 2 bài public, 2 bài member, 1 bài vip.
-- Bài tier member/vip khách vẫn thấy tiêu đề + đoạn mở đầu qua view
-- article_previews, nhưng toàn văn thì RLS chặn ở tầng database.
--
-- Nội dung là dữ liệu tạm để kiểm thử, không phải tài liệu kỹ thuật chính thức.
-- =============================================================================

insert into public.articles
  (slug, title_vi, title_en, content_vi, content_en, category_id, access_tier, published_at)
values

('nguyen-ly-chieu-sang-machine-vision',
 'Nguyên lý chiếu sáng trong machine vision',
 'Lighting principles in machine vision',
 '<p>Chiếu sáng quyết định tới 80% thành công của một ứng dụng machine vision. Một hệ thống có camera đắt tiền nhưng chiếu sáng sai vẫn cho kết quả tệ hơn hệ thống camera phổ thông với ánh sáng được thiết kế đúng.</p><p>Nguyên tắc nền tảng: đừng cố làm cho ảnh <em>đẹp</em>, hãy làm cho đặc trưng cần đo <em>nổi bật</em> so với phần còn lại. Một tấm ảnh tối om nhưng vết xước hiện rõ trắng trên nền đen thì tốt hơn nhiều so với tấm ảnh sáng đều mà vết xước chìm vào bề mặt.</p><p>Ba kiểu chiếu sáng hay dùng nhất: đèn vòng khuếch tán cho bề mặt phẳng ít phản chiếu, đèn dome cho bề mặt cong hoặc bóng, và đèn nền tạo bóng biên khi cần đo kích thước. Đèn nền cho biên sắc nét nhất vì tương phản gần như tuyệt đối giữa vật và nền.</p>',
 '<p>Lighting determines up to 80% of the success of a machine vision application. A system with an expensive camera but poor lighting will still perform worse than a commodity camera with properly designed illumination.</p><p>The fundamental principle: do not try to make the image <em>look nice</em>, make the feature you need to measure <em>stand out</em> from everything else. A dark image where a scratch shows up bright white against black is far more useful than an evenly lit image where the scratch blends into the surface.</p><p>The three most common lighting types: diffuse ring lights for flat, low-reflectivity surfaces; dome lights for curved or glossy surfaces; and backlights for silhouette measurement. A backlight gives the sharpest edge because the contrast between part and background is almost absolute.</p>',
 (select id from public.categories where slug = 'fundamentals'),
 'public',
 now() - interval '20 days'),

('chon-do-phan-giai-camera',
 'Cách chọn độ phân giải camera cho bài toán đo lường',
 'Choosing camera resolution for measurement tasks',
 '<p>Câu hỏi thường gặp nhất khi thiết kế hệ vision: cần camera bao nhiêu megapixel? Câu trả lời không nằm ở megapixel mà ở số pixel phủ lên đặc trưng nhỏ nhất cần phân biệt.</p><p>Công thức khởi điểm: lấy kích thước vùng quan sát chia cho dung sai yêu cầu, rồi nhân với hệ số an toàn 2–3 pixel cho mỗi đặc trưng. Ví dụ vùng quan sát 100 mm, dung sai 0.02 mm, hệ số 3 thì cần 15000 pixel trên trục dài — con số này lớn hơn hầu hết cảm biến area scan phổ thông, dấu hiệu cho thấy phải chia vùng quan sát cho nhiều camera hoặc chuyển sang line scan.</p><p>Lưu ý quan trọng: độ phân giải cảm biến chỉ là điều kiện cần. Nếu ống kính không phân giải nổi tới mức đó, hoặc rung động làm nhoè ảnh, thì thêm pixel cũng vô ích.</p>',
 '<p>The most common question when designing a vision system: how many megapixels do I need? The answer is not about megapixels at all, but about how many pixels cover the smallest feature you must distinguish.</p><p>A starting formula: divide the field of view by the required tolerance, then multiply by a safety factor of 2–3 pixels per feature. For a 100 mm field of view with 0.02 mm tolerance and a factor of 3, you need 15000 pixels along the long axis — larger than most common area scan sensors, which is a signal that you must split the field of view across several cameras or move to a line scan setup.</p><p>An important caveat: sensor resolution is only a necessary condition. If the lens cannot resolve that level of detail, or vibration blurs the image, adding pixels achieves nothing.</p>',
 (select id from public.categories where slug = 'fundamentals'),
 'public',
 now() - interval '14 days'),

('bai-hoc-trien-khai-kiem-tra-ngoai-quan',
 'Bài học từ dự án kiểm tra ngoại quan vỏ nhựa',
 'Lessons from a plastic housing inspection project',
 '<p>Dự án chạy ổn định trong phòng lab nhưng tỉ lệ báo lỗi giả tăng vọt sau hai tuần chạy thực tế. Nguyên nhân hoá ra không nằm ở thuật toán mà ở ba thứ rất đời thường.</p><p>Thứ nhất: ánh sáng môi trường. Xưởng có cửa sổ, buổi chiều nắng chiếu xiên vào khu vực kiểm tra làm nền ảnh sáng lên. Giải pháp là che chắn cụm camera, không phải chỉnh ngưỡng.</p><p>Thứ hai: bụi bám kính camera làm ảnh mờ dần theo thời gian. Kết quả trôi từ từ nên không ai nhận ra cho tới khi tỉ lệ lỗi giả vượt ngưỡng chịu được. Từ đó chúng tôi đưa việc vệ sinh kính vào lịch bảo trì tuần.</p><p>Thứ ba: lô nhựa mới có màu lệch nhẹ so với lô cũ. Ngưỡng cố định đặt theo lô đầu không còn đúng. Bài học: luôn lấy mẫu từ nhiều lô khác nhau trước khi chốt ngưỡng, và ưu tiên đặc trưng ít phụ thuộc màu khi có thể.</p>',
 '<p>The project ran reliably in the lab, but the false reject rate rose sharply after two weeks in production. The cause turned out to have nothing to do with the algorithm and everything to do with three very mundane things.</p><p>First: ambient light. The workshop had windows, and afternoon sun fell across the inspection station, brightening the image background. The fix was to shield the camera assembly, not to retune the threshold.</p><p>Second: dust on the camera window gradually blurred the image. Because the results drifted slowly, nobody noticed until the false reject rate crossed the tolerable limit. We added window cleaning to the weekly maintenance schedule from then on.</p><p>Third: a new plastic batch had a slightly different colour from the original. The fixed threshold set from the first batch no longer held. The lesson: always sample from several batches before fixing a threshold, and prefer features that depend as little as possible on colour.</p>',
 (select id from public.categories where slug = 'project-tips'),
 'member',
 now() - interval '9 days'),

('khi-nao-nen-dung-deep-learning',
 'Khi nào nên dùng deep learning, khi nào không',
 'When to use deep learning, and when not to',
 '<p>Deep learning là công cụ mạnh nhưng không phải lúc nào cũng đúng chỗ. Nguyên tắc của chúng tôi: chỉ dùng khi rule-based thực sự không đáp ứng được, không dùng vì nó nghe hiện đại.</p><p>Rule-based phù hợp khi đặc trưng cần tìm mô tả được bằng ngưỡng cố định: kích thước, vị trí, độ tương phản, hình dạng ổn định. Ưu điểm là chạy nhanh, giải thích được vì sao ra kết quả đó, và không cần dữ liệu huấn luyện. Khi có sự cố, kỹ sư truy được ngay bước nào sai.</p><p>Deep learning chỉ thắng rõ khi lỗi biến thiên mạnh về hình dạng, vị trí và màu sắc tới mức không viết nổi luật cố định — ví dụ vết nứt trên bề mặt vân gỗ tự nhiên. Nhưng phải chuẩn bị: vài trăm ảnh có gán nhãn cho mỗi loại lỗi, một quy trình gán nhãn nhất quán, và chấp nhận rằng khi mô hình sai thì rất khó giải thích tại sao.</p><p>Với bài toán đo lường kích thước, deep learning gần như luôn là lựa chọn sai — nó không cho sai số lặp lại ổn định theo đơn vị milimet.</p>',
 '<p>Deep learning is a powerful tool but not always the right one. Our rule: use it only when rule-based processing genuinely cannot meet the requirement, never because it sounds modern.</p><p>Rule-based methods fit when the feature can be described with fixed thresholds: size, position, contrast, stable shape. The advantages are speed, explainability, and no need for training data. When something goes wrong, an engineer can trace exactly which step failed.</p><p>Deep learning clearly wins only when defects vary so much in shape, position and colour that no fixed rule can capture them — a crack across natural wood grain, for example. But be prepared: several hundred labelled images per defect class, a consistent labelling process, and the reality that when the model is wrong it is very hard to explain why.</p><p>For dimensional measurement, deep learning is almost always the wrong choice — it does not deliver repeatable error in millimetres.</p>',
 (select id from public.categories where slug = 'new-technology'),
 'member',
 now() - interval '5 days'),

('so-sanh-lens-telecentric',
 'So sánh ống kính telecentric của bốn hãng',
 'Comparing telecentric lenses from four vendors',
 '<p>Chúng tôi thử nghiệm ống kính telecentric của bốn hãng trên cùng một bài toán đo đường kính trục kim loại, dung sai 0.01 mm, để xem thông số công bố có phản ánh đúng thực tế không.</p><p>Kết quả tóm tắt: cả bốn đều đạt độ méo công bố trong vùng trung tâm, nhưng khác biệt rõ rệt ở vùng rìa vùng quan sát. Hai hãng giữ được sai số dưới ngưỡng trên toàn bộ trường nhìn; hai hãng còn lại vượt ngưỡng ở khoảng 15% diện tích ngoài rìa — chấp nhận được nếu vật luôn nằm giữa khung, nhưng rủi ro nếu vị trí vật thay đổi.</p><p>Yếu tố ít được chú ý nhưng ảnh hưởng lớn tới chi phí: đường kính thấu kính đầu vào phải lớn hơn vật cần đo. Với vật trên 100 mm, giá ống kính telecentric tăng rất nhanh, tới mức chia vùng quan sát cho hai camera thường rẻ hơn đáng kể.</p><p>Chi tiết số liệu đo, điều kiện thử nghiệm và khuyến nghị theo từng dải kích thước nằm ở phần dưới.</p>',
 '<p>We tested telecentric lenses from four vendors on the same shaft diameter measurement task at 0.01 mm tolerance, to see whether the published specifications hold up in practice.</p><p>Summary: all four met their stated distortion figures in the central region, but differed markedly toward the edge of the field of view. Two vendors held the error below the limit across the whole field; the other two exceeded it over roughly the outer 15% of the area — acceptable if the part is always centred, but risky if part position varies.</p><p>A factor that gets little attention but drives cost heavily: the front lens diameter must exceed the part being measured. Above 100 mm the price of a telecentric lens climbs very steeply, to the point where splitting the field of view across two cameras is often considerably cheaper.</p><p>Detailed measurements, test conditions and recommendations per size range follow below.</p>',
 (select id from public.categories where slug = 'equipment-reviews'),
 'vip',
 now() - interval '2 days')

on conflict (slug) do update set
  title_vi     = excluded.title_vi,
  title_en     = excluded.title_en,
  content_vi   = excluded.content_vi,
  content_en   = excluded.content_en,
  category_id  = excluded.category_id,
  access_tier  = excluded.access_tier,
  published_at = excluded.published_at;

-- =============================================================================
-- BÀI TOÁN PHASE 2 (CLAUDE.md mục 10)
--
-- Thêm bài toán mới chỉ cần INSERT ở đây — không sửa dòng code nào. Các key
-- trong input_fields phải có trong catalog src/lib/selector/fields.ts.
--
-- Bảng luật bên dưới vẫn là DỮ LIỆU TẠM, sửa qua /admin/luat-goi-y.
-- =============================================================================

insert into public.task_types (slug, name_vi, name_en, description_vi, description_en, sort_order, input_fields)
values
  ('3d-measurement',
   'Đo lường 3D',
   '3D Measurement',
   'Đo cao độ, độ phẳng, thể tích, biên dạng bề mặt theo trục Z.',
   'Measure height, flatness, volume and surface profile along the Z axis.',
   40,
   '["fov_width_mm","fov_height_mm","height_range_mm","z_resolution_mm","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb),

  ('ocr-ocv',
   'Đọc và kiểm tra chữ (OCR/OCV)',
   'OCR / OCV',
   'Đọc chữ in, số lô, hạn sử dụng; hoặc kiểm tra chữ in có đúng và rõ không.',
   'Read printed text, lot codes and expiry dates, or verify that printing is correct and legible.',
   50,
   '["fov_width_mm","fov_height_mm","character_height_mm","print_contrast","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb),

  ('barcode-reading',
   'Đọc mã vạch / mã 2D',
   'Barcode Reading',
   'Đọc mã vạch 1D, Data Matrix, QR, kể cả mã DPM khắc trực tiếp lên vật.',
   'Read 1D barcodes, Data Matrix, QR codes, including DPM marks made directly on the part.',
   60,
   '["fov_width_mm","fov_height_mm","code_type","module_size_mm","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb),

  ('robot-guidance',
   'Dẫn hướng robot',
   'Robot Guidance',
   'Cung cấp toạ độ cho robot gắp, đặt, lắp ráp — từ 2D mặt phẳng tới bin picking.',
   'Provide coordinates for a robot to pick, place and assemble — from 2D planar to bin picking.',
   70,
   '["fov_width_mm","fov_height_mm","guidance_mode","pick_accuracy_mm","height_range_mm","working_distance_mm","throughput_ppm","surface","environment","ip_rating"]'::jsonb)

on conflict (slug) do update set
  name_vi        = excluded.name_vi,
  name_en        = excluded.name_en,
  description_vi = excluded.description_vi,
  description_en = excluded.description_en,
  sort_order     = excluded.sort_order,
  input_fields   = excluded.input_fields;

insert into public.selector_rules
  (code, task_type_id, condition_json, recommended_camera, recommended_lighting,
   recommended_lens, ai_or_rule_based, notes_vi, notes_en, priority)
values

-- ------------------------------------------------------------- ĐO LƯỜNG 3D --
('3D-BASE',
 (select id from public.task_types where slug = '3d-measurement'),
 '{}'::jsonb,
 'Cảm biến 3D laser triangulation (profile sensor)',
 'Laser vạch tích hợp trong cảm biến',
 'Ống kính đi kèm cảm biến',
 'rule_based',
 'Cấu hình nền cho đo 3D. Laser triangulation cho tỉ lệ giá/độ chính xác tốt nhất ở dải mm. Cần cơ cấu quét đều hoặc băng tải kèm encoder.',
 'Baseline for 3D measurement. Laser triangulation gives the best accuracy-per-cost in the millimetre range. Requires constant-velocity scanning or a conveyor with an encoder.',
 100),

('3D-HIGH-Z-RES',
 (select id from public.task_types where slug = '3d-measurement'),
 '{"all":[{"field":"z_resolution_mm","op":"lt","value":0.001}]}'::jsonb,
 'Cảm biến confocal chromatic hoặc giao thoa kế (interferometer)',
 null,
 null,
 'rule_based',
 'Độ phân giải Z dưới 1 micron vượt khả năng của laser triangulation. Phải dùng confocal chromatic hoặc giao thoa kế — đắt hơn nhiều và tốc độ chậm hơn hẳn, cần xác nhận lại yêu cầu có thật sự cần tới mức này không.',
 'Z resolution below 1 micron is beyond laser triangulation. Chromatic confocal or interferometry is required — far more expensive and much slower, so confirm the requirement genuinely needs this level.',
 20),

('3D-STRUCTURED-LIGHT',
 (select id from public.task_types where slug = '3d-measurement'),
 '{"all":[{"field":"z_resolution_mm","op":"gte","value":0.01},{"field":"throughput_ppm","op":"lt","value":30}]}'::jsonb,
 'Cảm biến 3D structured light (chụp toàn khung, không cần quét)',
 'Máy chiếu vân sáng tích hợp',
 null,
 'rule_based',
 'Nhịp chậm và không cần độ phân giải Z quá cao: structured light chụp cả vùng trong một lần, không cần cơ cấu quét — lắp đặt đơn giản hơn nhiều so với laser triangulation.',
 'Slow takt and moderate Z resolution: structured light captures the whole area in one shot with no scanning mechanism, which is far simpler to install than laser triangulation.',
 40),

('3D-SHINY',
 (select id from public.task_types where slug = '3d-measurement'),
 '{"all":[{"field":"surface","op":"in","value":["reflective","metal"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Bề mặt bóng gây phản xạ nhiều lần, sinh điểm 3D ảo. Cân nhắc phủ bột chống loá khi hiệu chuẩn, dùng cảm biến có chế độ HDR, hoặc nghiêng góc laser để tránh phản xạ gương trực tiếp về cảm biến.',
 'Shiny surfaces cause multiple reflections and produce phantom 3D points. Consider anti-glare powder during calibration, a sensor with HDR mode, or tilting the laser to avoid specular reflection straight back into the sensor.',
 55),

('3D-TRANSPARENT',
 (select id from public.task_types where slug = '3d-measurement'),
 '{"all":[{"field":"surface","op":"in","value":["transparent"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Vật trong suốt là ca khó nhất của đo 3D quang học: tia đi xuyên qua thay vì phản xạ. Thường phải chuyển sang phương pháp tiếp xúc, cảm biến sóng siêu âm, hoặc phủ lớp tạm thời. Cần thử nghiệm với mẫu thật trước khi cam kết.',
 'Transparent parts are the hardest case for optical 3D: the beam passes through instead of reflecting. Contact probing, ultrasonic sensing or a temporary coating are the usual answers. Trial with real samples before committing.',
 25),

('3D-LARGE-RANGE',
 (select id from public.task_types where slug = '3d-measurement'),
 '{"all":[{"field":"height_range_mm","op":"gt","value":200}]}'::jsonb,
 'Cảm biến ToF hoặc stereo vision',
 null,
 null,
 'rule_based',
 'Dải cao độ trên 200 mm vượt vùng làm việc của hầu hết cảm biến triangulation. ToF hoặc stereo phù hợp hơn, đổi lại độ chính xác giảm — kiểm tra lại xem dung sai có còn đạt không.',
 'A height range above 200 mm exceeds the working volume of most triangulation sensors. ToF or stereo is more suitable, at the cost of accuracy — re-check that the tolerance is still met.',
 45),

-- ----------------------------------------------------------------- OCR/OCV --
('OCR-BASE',
 (select id from public.task_types where slug = 'ocr-ocv'),
 '{}'::jsonb,
 'Area scan đơn sắc, global shutter',
 'Đèn vòng khuếch tán góc thấp',
 'Ống kính fixed focal, ngàm C',
 'rule_based',
 'Cấu hình nền cho OCR. Chiều cao ký tự cần tối thiểu khoảng 20 pixel thì nhận dạng mới ổn định — đây là ràng buộc chặt hơn nhiều so với các bài toán khác, đã tính vào phần độ phân giải cần thiết.',
 'Baseline for OCR. Character height needs roughly 20 pixels minimum for reliable recognition — a much tighter constraint than other tasks, already accounted for in the required resolution.',
 100),

('OCR-LOW-CONTRAST',
 (select id from public.task_types where slug = 'ocr-ocv'),
 '{"all":[{"field":"print_contrast","op":"eq","value":"low"}]}'::jsonb,
 null,
 'Chiếu góc thấp nhiều hướng, hoặc đèn đồng trục tuỳ vật liệu',
 null,
 'hybrid',
 'Tương phản thấp là nguyên nhân số một làm OCR thất bại. Ưu tiên cải thiện ánh sáng trước khi nghĩ tới thuật toán — thử vài phương án chiếu sáng trên mẫu thật. Nếu vẫn không đạt thì dùng OCR deep learning cho phần ký tự khó, giữ rule-based cho phần còn lại.',
 'Low contrast is the number one cause of OCR failure. Fix the lighting before reaching for a better algorithm — trial several lighting options on real samples. If it still fails, use deep learning OCR for the difficult characters and keep rule-based for the rest.',
 25),

('OCR-METAL-MARKING',
 (select id from public.task_types where slug = 'ocr-ocv'),
 '{"all":[{"field":"surface","op":"in","value":["metal"]}]}'::jsonb,
 null,
 'Đèn dark field góc thấp nhiều hướng',
 null,
 'rule_based',
 'Chữ khắc trên kim loại không có tương phản màu, chỉ có tương phản hình học. Chiếu góc thấp làm nét khắc đổ bóng, tạo ra tương phản mà cảm biến đọc được.',
 'Text engraved in metal has no colour contrast, only geometric contrast. Low-angle lighting makes the engraved strokes cast shadows, creating contrast the sensor can read.',
 45),

('OCR-DL-HARD',
 (select id from public.task_types where slug = 'ocr-ocv'),
 '{"all":[{"field":"print_contrast","op":"eq","value":"low"},{"field":"surface","op":"in","value":["metal","reflective","multicolor"]}]}'::jsonb,
 null,
 null,
 null,
 'deep_learning',
 'Tương phản thấp trên nền phức tạp: ngưỡng cố định không tách nổi ký tự khỏi nền. Đây là ca deep learning OCR thật sự vượt trội. Cần vài trăm ảnh mẫu có gán nhãn, phủ đủ các biến thể chiếu sáng và mài mòn thực tế.',
 'Low contrast on a complex background: no fixed threshold can separate the characters. This is a case where deep learning OCR genuinely wins. Budget for several hundred labelled images covering real lighting and wear variation.',
 20),

('OCR-HIGH-SPEED',
 (select id from public.task_types where slug = 'ocr-ocv'),
 '{"all":[{"field":"throughput_ppm","op":"gt","value":100}]}'::jsonb,
 'Area scan global shutter kèm trigger phần cứng',
 'Đèn strobe đồng bộ trigger',
 null,
 'rule_based',
 'Trên 100 part/phút: nhoè chuyển động làm nét chữ dày lên và dính vào nhau, OCR sai ngay. Bắt buộc strobe và trigger phần cứng.',
 'Above 100 parts/min motion blur thickens the strokes until characters merge and OCR fails. A strobe and hardware triggering are mandatory.',
 40),

-- ----------------------------------------------------------- ĐỌC MÃ VẠCH --
('CODE-BASE',
 (select id from public.task_types where slug = 'barcode-reading'),
 '{}'::jsonb,
 'Area scan đơn sắc, hoặc đầu đọc mã công nghiệp chuyên dụng',
 'Đèn vòng khuếch tán',
 'Ống kính fixed focal, ngàm C',
 'rule_based',
 'Cấu hình nền cho đọc mã. Cân nhắc đầu đọc chuyên dụng trước khi tự dựng từ camera rời — thuật toán giải mã đã tối ưu sẵn và thường rẻ hơn tổng chi phí tự làm.',
 'Baseline for code reading. Consider a dedicated industrial reader before building from a separate camera — the decoding algorithms are already optimised and it is usually cheaper than the total cost of building your own.',
 100),

('CODE-DPM',
 (select id from public.task_types where slug = 'barcode-reading'),
 '{"all":[{"field":"code_type","op":"eq","value":"dpm"}]}'::jsonb,
 'Đầu đọc chuyên dụng cho DPM',
 'Đèn nhiều góc chiếu chuyển được (dark field + đồng trục)',
 null,
 'rule_based',
 'Mã DPM khắc trực tiếp lên vật chỉ có tương phản hình học, và thay đổi theo vật liệu lẫn cách khắc. Cần khoảng 5-6 pixel cho mỗi ô module thay vì 2-3, và cần đèn chuyển được nhiều góc chiếu để thử ra phương án đọc ổn định.',
 'DPM marks made directly on the part have only geometric contrast, which varies with material and marking method. Budget 5-6 pixels per module instead of 2-3, and use a light that can switch between angles to find a stable read.',
 20),

('CODE-2D',
 (select id from public.task_types where slug = 'barcode-reading'),
 '{"all":[{"field":"code_type","op":"in","value":["datamatrix","qr"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Mã 2D chịu hư hỏng tốt hơn mã 1D nhờ sửa lỗi Reed-Solomon — đọc được cả khi mất một phần. Đổi lại cần nhiều pixel hơn trên cùng diện tích.',
 'A 2D code tolerates damage better than 1D thanks to Reed-Solomon error correction and still reads when partly obscured. In exchange it needs more pixels over the same area.',
 50),

('CODE-SMALL-MODULE',
 (select id from public.task_types where slug = 'barcode-reading'),
 '{"all":[{"field":"module_size_mm","op":"lt","value":0.15}]}'::jsonb,
 'Cảm biến độ phân giải cao, hoặc thu hẹp FOV',
 null,
 null,
 'rule_based',
 'Ô module dưới 0.15 mm: hoặc tăng độ phân giải cảm biến, hoặc thu hẹp vùng quan sát. Thu hẹp FOV thường rẻ hơn nhiều — nhưng phải đảm bảo vị trí mã trên vật đủ ổn định để luôn nằm trong khung.',
 'Modules below 0.15 mm mean either a higher resolution sensor or a smaller field of view. Narrowing the FOV is usually far cheaper — but the code position on the part must be repeatable enough to always stay in frame.',
 30),

('CODE-SHINY',
 (select id from public.task_types where slug = 'barcode-reading'),
 '{"all":[{"field":"surface","op":"in","value":["reflective","metal"]}]}'::jsonb,
 null,
 'Đèn dome hoặc dark field, tránh chiếu trực diện',
 null,
 'rule_based',
 'Bề mặt bóng: điểm loá che mất một phần mã là nguyên nhân đọc lỗi phổ biến nhất. Dome cho ánh sáng đều; nếu mã khắc chìm thì dark field cho tương phản tốt hơn.',
 'Shiny surfaces: a hot spot covering part of the code is the most common read failure. A dome gives even light; for engraved codes, dark field gives better contrast.',
 45),

('CODE-HIGH-SPEED',
 (select id from public.task_types where slug = 'barcode-reading'),
 '{"all":[{"field":"throughput_ppm","op":"gt","value":150}]}'::jsonb,
 'Đầu đọc có trigger phần cứng, hoặc camera global shutter tốc độ cao',
 'Đèn strobe đồng bộ trigger',
 null,
 'rule_based',
 'Trên 150 part/phút: cần trigger phần cứng và strobe. Nên đặt thêm cơ cấu loại hàng cho trường hợp đọc không ra, thay vì dừng cả dây chuyền.',
 'Above 150 parts/min hardware triggering and a strobe are required. Add a reject mechanism for no-reads rather than stopping the whole line.',
 40),

-- -------------------------------------------------------- DẪN HƯỚNG ROBOT --
('ROBOT-BASE',
 (select id from public.task_types where slug = 'robot-guidance'),
 '{}'::jsonb,
 'Area scan đơn sắc, global shutter',
 'Đèn vòng khuếch tán',
 'Ống kính fixed focal, ngàm C',
 'rule_based',
 'Cấu hình nền cho dẫn hướng robot. Lưu ý quan trọng: sai số cuối cùng là tổng của sai số thị giác VÀ sai số lặp lại của robot — chọn camera chính xác hơn robot là lãng phí.',
 'Baseline for robot guidance. Important: the final error is the sum of vision error AND robot repeatability — specifying a camera more accurate than the robot is wasted money.',
 100),

('ROBOT-2D-PLANE',
 (select id from public.task_types where slug = 'robot-guidance'),
 '{"all":[{"field":"guidance_mode","op":"eq","value":"plane_2d"}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Dẫn hướng 2D trên mặt phẳng là ca đơn giản nhất: một camera cố định phía trên là đủ. Bắt buộc hiệu chuẩn hand-eye để quy đổi toạ độ ảnh sang toạ độ robot.',
 'Planar 2D guidance is the simplest case: a single fixed overhead camera is enough. Hand-eye calibration is mandatory to convert image coordinates into robot coordinates.',
 50),

('ROBOT-3D-POSE',
 (select id from public.task_types where slug = 'robot-guidance'),
 '{"all":[{"field":"guidance_mode","op":"eq","value":"pose_3d"}]}'::jsonb,
 'Cảm biến 3D structured light hoặc stereo vision',
 'Máy chiếu vân sáng tích hợp',
 null,
 'rule_based',
 'Cần cả góc nghiêng nên một camera 2D là không đủ. Hiệu chuẩn hand-eye 3D phức tạp hơn hẳn 2D — hãy tính thời gian cho phần này khi lập kế hoạch dự án.',
 'Tilt is required, so a single 2D camera is not enough. 3D hand-eye calibration is considerably more involved than the 2D case — budget project time for it.',
 40),

('ROBOT-BIN-PICKING',
 (select id from public.task_types where slug = 'robot-guidance'),
 '{"all":[{"field":"guidance_mode","op":"eq","value":"bin_picking"}]}'::jsonb,
 'Cảm biến 3D độ phân giải cao chuyên cho bin picking',
 null,
 null,
 'hybrid',
 'Bin picking là bài toán khó nhất nhóm này. Vật chồng lộn xộn cần phân tách từng vật khỏi đám — deep learning làm tốt phần này, nhưng tính toán đường gắp không va chạm vẫn là hình học thuần tuý. Phải thử nghiệm với khay thật, đừng cam kết tỉ lệ gắp thành công trước khi có thử nghiệm.',
 'Bin picking is the hardest case here. Jumbled parts must be segmented from the pile — deep learning does this well — but collision-free grasp planning remains pure geometry. Trial with a real bin, and do not commit to a pick success rate before testing.',
 20),

('ROBOT-TIGHT-ACCURACY',
 (select id from public.task_types where slug = 'robot-guidance'),
 '{"all":[{"field":"pick_accuracy_mm","op":"lt","value":0.1}]}'::jsonb,
 null,
 null,
 'Ống kính telecentric',
 'rule_based',
 'Độ chính xác dưới 0.1 mm: kiểm tra độ lặp lại của chính con robot trước đã, nhiều robot công nghiệp phổ thông không đạt tới mức này. Cân nhắc camera gắn trên tay robot để hiệu chỉnh ở cự ly gần ngay trước khi gắp.',
 'Below 0.1 mm accuracy: check the robot repeatability first, as many general-purpose industrial robots do not reach this level. Consider a camera mounted on the robot arm for close-range correction just before the pick.',
 25),

('ROBOT-VIBRATION',
 (select id from public.task_types where slug = 'robot-guidance'),
 '{"all":[{"field":"environment","op":"in","value":["vibration"]}]}'::jsonb,
 null,
 null,
 null,
 'rule_based',
 'Môi trường rung làm trôi hiệu chuẩn hand-eye theo thời gian. Đặt lịch kiểm tra lại hiệu chuẩn định kỳ, và gắn một chi tiết chuẩn cố định trong khung hình để phát hiện sớm khi hệ bị lệch.',
 'Vibration causes the hand-eye calibration to drift over time. Schedule periodic recalibration checks, and keep a fixed reference feature in the frame to detect drift early.',
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


-- =============================================================================
-- Hai cụm BOM mới: máy tính/giao tiếp và phụ kiện
--
-- Tách riêng bằng UPDATE thay vì thêm hai cột vào 55 dòng VALUES ở trên — vừa
-- gọn, vừa idempotent, vừa dễ đọc xem luật nào phụ trách cụm nào.
--
-- Nguyên tắc như các cụm cũ: luật nền điền cấu hình mặc định, luật cụ thể hơn
-- (priority nhỏ hơn) chỉ điền ô nào nó thực sự quyết định.
-- =============================================================================

-- Luật nền của bốn bài toán chính: cấu hình máy tính và phụ kiện tối thiểu.
update public.selector_rules set
  recommended_processing  = 'GigE Vision, PC công nghiệp i5, 16 GB RAM, không cần GPU',
  recommended_accessories = 'Cáp GigE có khoá, gá camera 3 trục, nguồn 24 V cho đèn'
where code = 'APPEAR-BASE';

update public.selector_rules set
  recommended_processing  = 'GigE Vision, PC công nghiệp i5, 16 GB RAM',
  recommended_accessories = 'Cáp GigE có khoá, gá camera cứng vững, chuẩn hiệu chuẩn (calibration target)'
where code = 'MEAS-BASE';

update public.selector_rules set
  recommended_processing  = 'GigE Vision, PC công nghiệp i5, 16 GB RAM',
  recommended_accessories = 'Cáp GigE có khoá, gá camera, tấm hiệu chuẩn toạ độ'
where code = 'ALIGN-BASE';

-- Băng thông cao thì GigE (~125 MB/s) không tải nổi. Ngưỡng để trong luật chứ
-- không hard-code trong code — engine chỉ tính ra data_rate_mbytes_s.
insert into public.selector_rules
  (code, task_type_id, condition_json, recommended_camera, recommended_lighting,
   recommended_lens, ai_or_rule_based, notes_vi, notes_en, priority)
values
('BOM-BANDWIDTH-5GIGE',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"data_rate_mbytes_s","op":"gt","value":110}]}'::jsonb,
 null, null, null,
 'rule_based',
 'Băng thông vượt ~110 MB/s: GigE (125 MB/s lý thuyết) không còn dư địa an toàn. Phải lên 5GigE hoặc CoaXPress, và card mạng phải hỗ trợ jumbo frame.',
 'Data rate above ~110 MB/s leaves no safety margin on GigE (125 MB/s theoretical). Move to 5GigE or CoaXPress, and the NIC must support jumbo frames.',
 25),

('BOM-DUST-ENCLOSURE',
 (select id from public.task_types where slug = 'appearance-inspection'),
 '{"all":[{"field":"ip_rating","op":"in","value":["ip65","ip67"]}]}'::jsonb,
 null, null, null,
 'rule_based',
 'Yêu cầu IP65 trở lên: camera công nghiệp thường chỉ IP40, phải có vỏ bảo vệ kèm cửa sổ kính và khí nén thổi sạch.',
 'IP65 or above: industrial cameras are typically only IP40, so an enclosure with a glass window and an air purge is required.',
 25)
on conflict (code) where code is not null do update set
  condition_json = excluded.condition_json,
  notes_vi       = excluded.notes_vi,
  notes_en       = excluded.notes_en,
  priority       = excluded.priority;

update public.selector_rules set
  recommended_processing = 'Giao tiếp 5GigE hoặc CoaXPress; card mạng hỗ trợ jumbo frame'
where code = 'BOM-BANDWIDTH-5GIGE';

update public.selector_rules set
  recommended_accessories = 'Vỏ bảo vệ IP65 có cửa sổ kính, bộ thổi khí nén làm sạch cửa sổ'
where code = 'BOM-DUST-ENCLOSURE';

-- Deep learning thì cần GPU — gắn vào chính luật đã quyết định hướng đó.
update public.selector_rules set
  recommended_processing = 'PC có GPU rời (>= 8 GB VRAM) cho suy luận deep learning'
where code = 'APPEAR-DL-HIGH-VAR';

-- Bề mặt phản chiếu hay dùng kính lọc phân cực chéo để cắt loá.
update public.selector_rules set
  recommended_accessories = 'Kính lọc phân cực chéo (trên đèn và trên ống kính) để cắt điểm loá'
where code = 'APPEAR-REFLECTIVE';


-- =============================================================================
-- Bài Kiểm tra ngoại quan: bổ sung tham số cho bộ tính toán quang học/thời gian
--
-- Tách riêng bằng UPDATE thay vì sửa mảng ở khối insert phía trên, để thấy rõ
-- những trường nào mới thêm và vì sao. Nhóm "system" đều có mặc định hợp lý nên
-- kỹ sư bỏ qua được — không bắt điền mười ô mới cho một phép tính nhanh.
-- =============================================================================

update public.task_types set input_fields = '[
  "fov_width_mm","fov_height_mm","defect_min_size_mm","px_per_defect","defect_type",
  "defect_variability","color_critical","surface","height_tolerance_mm",
  "working_distance_mm","throughput_ppm","line_speed_mms","n_view","duty_percent","total_length_mm",
  "environment","ip_rating",
  "pixel_format","f_number","blur_px","overlap_percent","exposure_ms","process_ms"
]'::jsonb
where slug = 'appearance-inspection';


-- Bài ngoại quan: thêm câu hỏi kiểu chụp và ba tham số đi kèm.
-- capture_mode đặt ĐẦU danh sách vì nó quyết định những ô còn lại có hiện không.
update public.task_types set input_fields = '[
  "capture_mode",
  "fov_width_mm","fov_height_mm","defect_min_size_mm","px_per_defect","defect_type",
  "defect_variability","color_critical","surface","height_tolerance_mm",
  "working_distance_mm","throughput_ppm","line_speed_mms","n_view","duty_percent","total_length_mm",
  "settle_time_ms","trigger_jitter_ms","encoder_resolution_um",
  "environment","ip_rating",
  "pixel_format","f_number","blur_px","overlap_percent","exposure_ms","process_ms"
]'::jsonb
where slug = 'appearance-inspection';


-- Bài ngoại quan: thêm nhánh ĐO LƯỜNG theo dung sai (GAP 1 trong
-- docs/HIEN_TRANG_VA_KHOANG_TRONG.md). Trường tuỳ chọn: để trống thì bộ tính
-- chỉ chạy nhánh phát hiện lỗi như trước. Đặt ngay sau dung sai chiều cao để
-- hai câu hỏi về độ chính xác nằm cạnh nhau.
update public.task_types set input_fields = '[
  "capture_mode",
  "fov_width_mm","fov_height_mm","defect_min_size_mm","px_per_defect","defect_type",
  "defect_variability","color_critical","surface","height_tolerance_mm","measurement_tolerance_mm",
  "working_distance_mm","throughput_ppm","line_speed_mms","n_view","duty_percent","total_length_mm",
  "settle_time_ms","trigger_jitter_ms","encoder_resolution_um",
  "environment","ip_rating",
  "pixel_format","f_number","blur_px","overlap_percent","exposure_ms","process_ms"
]'::jsonb
where slug = 'appearance-inspection';
