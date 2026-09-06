-- =============================================================================
-- Catalog linh kiện — dữ liệu khởi tạo
--
-- ĐỌC KỸ: toàn bộ thông số dưới đây do đội phát triển điền theo hiểu biết chung
-- về dòng sản phẩm, CHƯA đối chiếu datasheet của hãng. Vì vậy mọi dòng đều mang
-- source = 'unverified'. Sau khi kiểm tra với tài liệu hãng thì đổi sang
-- 'datasheet' — giao diện hiện cờ này để không ai lấy thẳng đi báo giá.
--
-- Giá (price_vnd) CỐ Ý để trống: giá thay đổi theo thời điểm và theo nhà phân
-- phối, bịa ra một con số còn tệ hơn không có.
--
-- Idempotent theo cột code: chạy lại sẽ cập nhật, không nhân bản.
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, source, notes_vi, notes_en, sort_order)
values

-- ----------------------------------------------------------------- CAMERA --
('CAM-BASLER-A2A2590-GM', 'camera', 'Basler', 'a2A2590-22gmBAS',
 '{"resolution_mp":5,"resolution_w_px":2592,"resolution_h_px":1944,"sensor_format":"1/1.8","pixel_size_um":2.74,"mount":"C","interface":"GigE","max_fps":22,"color":"mono"}'::jsonb,
 'unverified',
 'Pixel 2,74 µm khá nhỏ — ống kính phải phân giải tốt, đừng ghép với lens phổ thông giá rẻ.',
 'The 2.74 um pixel is small, so the lens must resolve well; do not pair it with a low-cost general lens.',
 10),

('CAM-BASLER-ACA2440-UM', 'camera', 'Basler', 'acA2440-35um',
 '{"resolution_mp":5,"resolution_w_px":2448,"resolution_h_px":2048,"sensor_format":"2/3","pixel_size_um":3.45,"mount":"C","interface":"USB3","max_fps":35,"color":"mono"}'::jsonb,
 'unverified',
 'USB3 cho băng thông cao nhưng cáp ngắn (~5 m). Dây chuyền dài nên cân nhắc GigE.',
 'USB3 gives high bandwidth but short cables (~5 m). On a long line consider GigE instead.',
 20),

('CAM-BASLER-A2A5320-GM', 'camera', 'Basler', 'a2A5320-23gmBAS',
 '{"resolution_mp":16,"resolution_w_px":5320,"resolution_h_px":3032,"sensor_format":"1","pixel_size_um":2.4,"mount":"C","interface":"5GigE","max_fps":23,"color":"mono"}'::jsonb,
 'unverified',
 'Cảm biến 1 inch: kiểm lại vòng ảnh ống kính, lens 2/3 inch sẽ bị tối bốn góc.',
 'One-inch sensor: re-check the lens image circle, a 2/3-inch lens will vignette.',
 30),

('CAM-HIK-MVCS050-GM', 'camera', 'Hikrobot', 'MV-CS050-10GM',
 '{"resolution_mp":5,"resolution_w_px":2448,"resolution_h_px":2048,"sensor_format":"2/3","pixel_size_um":3.45,"mount":"C","interface":"GigE","max_fps":24,"color":"mono"}'::jsonb,
 'unverified',
 'Cấu hình phổ thông, dễ mua và dễ thay thế tại Việt Nam.',
 'A common configuration, easy to source and replace locally.',
 40),

('CAM-HIK-MVCS200-GC', 'camera', 'Hikrobot', 'MV-CS200-10GC',
 '{"resolution_mp":20,"resolution_w_px":5472,"resolution_h_px":3648,"sensor_format":"1","pixel_size_um":2.4,"mount":"C","interface":"GigE","max_fps":15,"color":"color"}'::jsonb,
 'unverified',
 '20 MP trên GigE: ở full frame băng thông đã chạm trần, tính lại nhịp ảnh trước khi chốt.',
 '20 MP over GigE: at full frame the bandwidth is already at the limit, re-check the frame rate.',
 50),

('CAM-IRAYPLE-A5031MG', 'camera', 'iRayple', 'A5031MG14',
 '{"resolution_mp":3.1,"resolution_w_px":2048,"resolution_h_px":1536,"sensor_format":"1/1.8","pixel_size_um":3.45,"mount":"C","interface":"GigE","max_fps":14,"color":"mono"}'::jsonb,
 'unverified',
 'Lựa chọn tiết kiệm cho bài toán độ phân giải thấp.',
 'A cost-effective option for low-resolution tasks.',
 60),

('CAM-IRAYPLE-A7500MG', 'camera', 'iRayple', 'A7500MG10',
 '{"resolution_mp":12,"resolution_w_px":4096,"resolution_h_px":3000,"sensor_format":"1","pixel_size_um":2.74,"mount":"C","interface":"GigE","max_fps":10,"color":"mono"}'::jsonb,
 'unverified',
 'Nhịp ảnh 10 fps — không hợp dây chuyền nhanh.',
 'Only 10 fps, so not suitable for a fast line.',
 70),

-- ------------------------------------------------------------------- LENS --
('LENS-COOLENS-FF08', 'lens', 'Coolens', 'FF0820-5M',
 '{"lens_type":"fixed","focal_length_mm":8,"image_circle":"2/3","mount":"C","wd_min_mm":100,"wd_max_mm":2000}'::jsonb,
 'unverified',
 'Tiêu cự ngắn: méo hình ở rìa rõ hơn, không dùng cho bài đo lường chính xác.',
 'Short focal length: noticeably more edge distortion, avoid for precision measurement.',
 110),

('LENS-COOLENS-FF12', 'lens', 'Coolens', 'FF1220-5M',
 '{"lens_type":"fixed","focal_length_mm":12,"image_circle":"2/3","mount":"C","wd_min_mm":100,"wd_max_mm":3000}'::jsonb,
 'unverified', null, null, 120),

('LENS-COOLENS-FF16', 'lens', 'Coolens', 'FF1620-5M',
 '{"lens_type":"fixed","focal_length_mm":16,"image_circle":"2/3","mount":"C","wd_min_mm":100,"wd_max_mm":3000}'::jsonb,
 'unverified', null, null, 130),

('LENS-COOLENS-FF25', 'lens', 'Coolens', 'FF2520-5M',
 '{"lens_type":"fixed","focal_length_mm":25,"image_circle":"2/3","mount":"C","wd_min_mm":150,"wd_max_mm":5000}'::jsonb,
 'unverified', null, null, 140),

('LENS-COOLENS-FF35', 'lens', 'Coolens', 'FF3520-5M',
 '{"lens_type":"fixed","focal_length_mm":35,"image_circle":"1","mount":"C","wd_min_mm":200,"wd_max_mm":6000}'::jsonb,
 'unverified', null, null, 150),

('LENS-COOLENS-FF50', 'lens', 'Coolens', 'FF5020-5M',
 '{"lens_type":"fixed","focal_length_mm":50,"image_circle":"1","mount":"C","wd_min_mm":300,"wd_max_mm":8000}'::jsonb,
 'unverified', null, null, 160),

('LENS-COOLENS-TC05', 'lens', 'Coolens', 'TC05-65-110',
 '{"lens_type":"telecentric","magnification":0.5,"image_circle":"2/3","mount":"C","wd_min_mm":110,"wd_max_mm":110}'::jsonb,
 'unverified',
 'Telecentric: khoảng cách làm việc CỐ ĐỊNH, cơ khí phải đặt đúng 110 mm.',
 'Telecentric: the working distance is fixed, the mechanics must sit at exactly 110 mm.',
 170),

('LENS-COOLENS-TC10', 'lens', 'Coolens', 'TC10-32-110',
 '{"lens_type":"telecentric","magnification":1.0,"image_circle":"2/3","mount":"C","wd_min_mm":110,"wd_max_mm":110}'::jsonb,
 'unverified',
 'Độ phóng đại 1x: FOV đúng bằng cỡ cảm biến, chỉ hợp vật thể rất nhỏ.',
 'At 1x the field of view equals the sensor size, so only very small parts fit.',
 180),

-- ------------------------------------------------------------------ LIGHT --
('LIGHT-HZ-RING-W', 'light', 'HZ', 'HZ-RL9070-W',
 '{"light_type":"ring","color":"white","size_mm":90,"wd_min_mm":50,"wd_max_mm":200}'::jsonb,
 'unverified',
 'Đèn vòng khuếch tán: mặc định tốt cho bề mặt phẳng, ít phản chiếu.',
 'Diffuse ring light: a good default for flat, low-reflectivity surfaces.',
 210),

('LIGHT-HZ-DOME-W', 'light', 'HZ', 'HZ-DM150-W',
 '{"light_type":"dome","color":"white","size_mm":150,"wd_min_mm":30,"wd_max_mm":120}'::jsonb,
 'unverified',
 'Dome cho nền sáng đều trên bề mặt bóng hoặc cong — đổi lại cần khoảng cách gần.',
 'A dome gives even illumination on glossy or curved surfaces, at the cost of a short working distance.',
 220),

('LIGHT-HZ-BACKLIGHT-W', 'light', 'HZ', 'HZ-BL100100-W',
 '{"light_type":"backlight","color":"white","size_mm":100,"wd_min_mm":20,"wd_max_mm":500}'::jsonb,
 'unverified',
 'Đèn nền cho biên sắc nét nhất — lựa chọn mặc định khi đo kích thước.',
 'A backlight gives the sharpest edge, the default choice for dimensional measurement.',
 230),

('LIGHT-HZ-BAR-W', 'light', 'HZ', 'HZ-BR30020-W',
 '{"light_type":"bar","color":"white","size_mm":300,"wd_min_mm":50,"wd_max_mm":400}'::jsonb,
 'unverified', null, null, 240),

('LIGHT-HZ-COAX-W', 'light', 'HZ', 'HZ-CX5050-W',
 '{"light_type":"coaxial","color":"white","size_mm":50,"wd_min_mm":40,"wd_max_mm":200}'::jsonb,
 'unverified',
 'Đồng trục: soi bề mặt gương, chữ khắc chìm trên kim loại.',
 'Coaxial: for mirror-like surfaces and engraved marks on metal.',
 250),

('LIGHT-HZ-DARKFIELD-W', 'light', 'HZ', 'HZ-DF12010-W',
 '{"light_type":"darkfield","color":"white","size_mm":120,"wd_min_mm":10,"wd_max_mm":40}'::jsonb,
 'unverified',
 'Góc chiếu rất thấp: làm nổi vết xước và cạnh, nền tối hẳn.',
 'A very low angle highlights scratches and edges against a dark background.',
 260),

-- ------------------------------------------------------------- CONTROLLER --
('PC-STD-GIGE', 'controller', 'Generic', 'IPC-i5-16G',
 '{"cpu":"Intel i5","ram_gb":16,"interfaces":["GigE","USB3"]}'::jsonb,
 'unverified',
 'Cấu hình nền cho một camera GigE, xử lý theo ngưỡng và blob.',
 'Baseline configuration for a single GigE camera with thresholding and blob analysis.',
 310),

('PC-HIGH-BANDWIDTH', 'controller', 'Generic', 'IPC-i7-32G-5GigE',
 '{"cpu":"Intel i7","ram_gb":32,"interfaces":["GigE","USB3","5GigE","10GigE"]}'::jsonb,
 'unverified',
 'Cho camera băng thông cao; card mạng phải bật jumbo frame.',
 'For high-bandwidth cameras; the NIC must have jumbo frames enabled.',
 320),

('PC-GPU-DL', 'controller', 'Generic', 'IPC-i7-32G-RTX',
 '{"cpu":"Intel i7","ram_gb":32,"gpu":"NVIDIA RTX 8GB","interfaces":["GigE","USB3","5GigE"]}'::jsonb,
 'unverified',
 'Có GPU rời — chỉ cần khi bài toán thật sự phải dùng deep learning.',
 'Has a discrete GPU, needed only when the task genuinely requires deep learning.',
 330)

on conflict (code) do update set
  kind       = excluded.kind,
  brand      = excluded.brand,
  model      = excluded.model,
  spec       = excluded.spec,
  source     = excluded.source,
  notes_vi   = excluded.notes_vi,
  notes_en   = excluded.notes_en,
  sort_order = excluded.sort_order,
  is_active  = true;


-- =============================================================================
-- Các cụm còn lại của danh mục vật tư, theo đúng trình tự mua hàng:
--   ... → Tube → Cáp camera → Cáp đèn → Bộ điều khiển đèn →
--   Máy tính (kèm Windows/Office/màn hình/bàn phím) → Phần mềm → Phụ kiện
--
-- Vẫn nguyên tắc cũ: mọi dòng 'unverified', giá để trống.
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, source, notes_vi, notes_en, sort_order)
values

-- ------------------------------------------------------------------- TUBE --
('TUBE-C-5', 'tube', 'Generic', 'C-Mount 5mm',
 '{"length_mm":5,"mount":"C"}'::jsonb, 'unverified',
 'Vòng nối dài 5 mm: kéo khoảng cách làm việc gần lại một chút, đổi lại mất vô cực.',
 'A 5 mm extension tube shortens the working distance slightly, at the cost of infinity focus.',
 410),
('TUBE-C-10', 'tube', 'Generic', 'C-Mount 10mm',
 '{"length_mm":10,"mount":"C"}'::jsonb, 'unverified', null, null, 420),
('TUBE-C-20', 'tube', 'Generic', 'C-Mount 20mm',
 '{"length_mm":20,"mount":"C"}'::jsonb, 'unverified',
 'Tube càng dài thì độ phóng đại càng lớn nhưng ánh sáng tới cảm biến càng yếu.',
 'A longer tube gives more magnification but less light reaching the sensor.',
 430),

-- -------------------------------------------------------------- CÁP CAMERA --
('CABLE-CAM-GIGE-5', 'cable', 'Generic', 'Cat6 RJ45 5m',
 '{"cable_for":"camera","connector":"RJ45 Cat6","length_m":5}'::jsonb, 'unverified',
 'GigE đi được tới 100 m. Cáp phải có chống nhiễu nếu chạy gần biến tần.',
 'GigE runs up to 100 m. Use shielded cable when routed near a VFD.',
 510),
('CABLE-CAM-GIGE-10', 'cable', 'Generic', 'Cat6 RJ45 10m',
 '{"cable_for":"camera","connector":"RJ45 Cat6","length_m":10}'::jsonb, 'unverified', null, null, 520),
('CABLE-CAM-USB3-3', 'cable', 'Generic', 'USB3 Micro-B 3m',
 '{"cable_for":"camera","connector":"USB3 Micro-B khoá vít","length_m":3}'::jsonb, 'unverified',
 'USB3 thực tế chỉ ổn định tới ~5 m. Dài hơn phải dùng cáp quang active.',
 'USB3 is only reliable to about 5 m; beyond that an active optical cable is needed.',
 530),

-- ----------------------------------------------------------------- CÁP ĐÈN --
('CABLE-LIGHT-2', 'cable', 'Generic', 'Cáp đèn 2m',
 '{"cable_for":"light","connector":"Hirose 4 chân","length_m":2}'::jsonb, 'unverified',
 'Cáp đèn nối từ đèn về bộ điều khiển, không nối thẳng vào camera.',
 'The light cable runs from the light to its controller, not to the camera.',
 610),
('CABLE-LIGHT-5', 'cable', 'Generic', 'Cáp đèn 5m',
 '{"cable_for":"light","connector":"Hirose 4 chân","length_m":5}'::jsonb, 'unverified', null, null, 620),

-- ------------------------------------------------------- ĐIỀU KHIỂN ĐÈN --
('LCTRL-HZ-1CH', 'light_controller', 'HZ', 'HZ-PS1CH-24V',
 '{"channels":1,"strobe":"no","max_current_a":2}'::jsonb, 'unverified',
 'Chỉ cấp nguồn liên tục, không đánh xung. Đủ cho băng tải chậm.',
 'Continuous power only, no strobe. Fine for a slow conveyor.',
 710),
('LCTRL-HZ-2CH-STROBE', 'light_controller', 'HZ', 'HZ-ST2CH-24V',
 '{"channels":2,"strobe":"yes","max_current_a":4}'::jsonb, 'unverified',
 'Có đánh xung: bắt buộc khi thời gian phơi sáng phải xuống dưới 1 ms.',
 'Supports strobing, which is mandatory when exposure must drop below 1 ms.',
 720),
('LCTRL-HZ-4CH-STROBE', 'light_controller', 'HZ', 'HZ-ST4CH-24V',
 '{"channels":4,"strobe":"yes","max_current_a":8}'::jsonb, 'unverified',
 'Bốn kênh — dùng cho photometric stereo bốn hướng chiếu.',
 'Four channels, for four-direction photometric stereo.',
 730),

-- ------------------------------------------------------------ PHẦN MỀM --
('SW-HALCON', 'software', 'MVTec', 'HALCON Runtime',
 '{"software_type":"library","license":"Runtime theo máy"}'::jsonb, 'unverified',
 'Thư viện mạnh và đầy đủ nhất, đổi lại giá cao và phải lập trình.',
 'The most complete library, but expensive and requires programming.',
 810),
('SW-VISIONPRO', 'software', 'Cognex', 'VisionPro',
 '{"software_type":"platform","license":"Theo máy, kèm khoá cứng"}'::jsonb, 'unverified',
 'Có giao diện dựng luồng, kỹ sư không chuyên lập trình vẫn làm được.',
 'Has a visual pipeline builder, usable by engineers who do not program.',
 820),
('SW-OPENCV', 'software', 'Open source', 'OpenCV',
 '{"software_type":"free","license":"Apache 2.0"}'::jsonb, 'unverified',
 'Miễn phí nhưng phải tự viết toàn bộ, và không có hỗ trợ khi ra hiện trường.',
 'Free, but everything must be written in-house and there is no field support.',
 830),

-- --------------------------------------------------- HÀNG ĐI KÈM MÁY TÍNH --
('PCOPT-WIN11-PRO', 'pc_option', 'Microsoft', 'Windows 11 Pro OEM',
 '{"option_type":"os"}'::jsonb, 'unverified',
 'Bản quyền hệ điều hành — hay bị quên khi lên báo giá.',
 'The OS licence, one of the most frequently forgotten line items.',
 910),
('PCOPT-OFFICE', 'pc_option', 'Microsoft', 'Office LTSC Standard',
 '{"option_type":"office"}'::jsonb, 'unverified',
 'Chỉ cần khi máy phải xuất báo cáo Excel ngay tại chỗ.',
 'Only needed when the station must produce Excel reports locally.',
 920),
('PCOPT-MONITOR-24', 'pc_option', 'Generic', 'Màn hình 24 inch FHD',
 '{"option_type":"monitor"}'::jsonb, 'unverified', null, null, 930),
('PCOPT-KEYBOARD', 'pc_option', 'Generic', 'Bàn phím + chuột công nghiệp',
 '{"option_type":"keyboard"}'::jsonb, 'unverified', null, null, 940)

on conflict (code) do update set
  kind       = excluded.kind,
  brand      = excluded.brand,
  model      = excluded.model,
  spec       = excluded.spec,
  source     = excluded.source,
  notes_vi   = excluded.notes_vi,
  notes_en   = excluded.notes_en,
  sort_order = excluded.sort_order,
  is_active  = true;
