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
 '{"camera_type":"area","resolution_mp":5,"resolution_w_px":2592,"resolution_h_px":1944,"sensor_format":"1/1.8","pixel_size_um":2.74,"mount":"C","interface":"GigE","max_fps":22,"color":"mono"}'::jsonb,
 'unverified',
 'Pixel 2,74 µm khá nhỏ — ống kính phải phân giải tốt, đừng ghép với lens phổ thông giá rẻ.',
 'The 2.74 um pixel is small, so the lens must resolve well; do not pair it with a low-cost general lens.',
 10),

('CAM-BASLER-ACA2440-UM', 'camera', 'Basler', 'acA2440-35um',
 '{"camera_type":"area","resolution_mp":5,"resolution_w_px":2448,"resolution_h_px":2048,"sensor_format":"2/3","pixel_size_um":3.45,"mount":"C","interface":"USB3","max_fps":35,"color":"mono"}'::jsonb,
 'unverified',
 'USB3 cho băng thông cao nhưng cáp ngắn (~5 m). Dây chuyền dài nên cân nhắc GigE.',
 'USB3 gives high bandwidth but short cables (~5 m). On a long line consider GigE instead.',
 20),

('CAM-BASLER-A2A5320-GM', 'camera', 'Basler', 'a2A5320-23gmBAS',
 '{"camera_type":"area","resolution_mp":16,"resolution_w_px":5320,"resolution_h_px":3032,"sensor_format":"1","pixel_size_um":2.4,"mount":"C","interface":"5GigE","max_fps":23,"color":"mono"}'::jsonb,
 'unverified',
 'Cảm biến 1 inch: kiểm lại vòng ảnh ống kính, lens 2/3 inch sẽ bị tối bốn góc.',
 'One-inch sensor: re-check the lens image circle, a 2/3-inch lens will vignette.',
 30),

('CAM-HIK-MVCS050-GM', 'camera', 'Hikrobot', 'MV-CS050-10GM',
 '{"camera_type":"area","resolution_mp":5,"resolution_w_px":2448,"resolution_h_px":2048,"sensor_format":"2/3","pixel_size_um":3.45,"mount":"C","interface":"GigE","max_fps":24,"color":"mono"}'::jsonb,
 'unverified',
 'Cấu hình phổ thông, dễ mua và dễ thay thế tại Việt Nam.',
 'A common configuration, easy to source and replace locally.',
 40),

('CAM-HIK-MVCS200-GC', 'camera', 'Hikrobot', 'MV-CS200-10GC',
 '{"camera_type":"area","resolution_mp":20,"resolution_w_px":5472,"resolution_h_px":3648,"sensor_format":"1","pixel_size_um":2.4,"mount":"C","interface":"GigE","max_fps":15,"color":"color"}'::jsonb,
 'unverified',
 '20 MP trên GigE: ở full frame băng thông đã chạm trần, tính lại nhịp ảnh trước khi chốt.',
 '20 MP over GigE: at full frame the bandwidth is already at the limit, re-check the frame rate.',
 50),

('CAM-IRAYPLE-A5031MG', 'camera', 'iRayple', 'A5031MG14',
 '{"camera_type":"area","resolution_mp":3.1,"resolution_w_px":2048,"resolution_h_px":1536,"sensor_format":"1/1.8","pixel_size_um":3.45,"mount":"C","interface":"GigE","max_fps":14,"color":"mono"}'::jsonb,
 'unverified',
 'Lựa chọn tiết kiệm cho bài toán độ phân giải thấp.',
 'A cost-effective option for low-resolution tasks.',
 60),

('CAM-IRAYPLE-A7500MG', 'camera', 'iRayple', 'A7500MG10',
 '{"camera_type":"area","resolution_mp":12,"resolution_w_px":4096,"resolution_h_px":3000,"sensor_format":"1","pixel_size_um":2.74,"mount":"C","interface":"GigE","max_fps":10,"color":"mono"}'::jsonb,
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
 '{"cpu":"Intel i5","ram_gb":16,"interfaces":["GigE","USB3"],"max_cameras":2,"pcie_slots":1}'::jsonb,
 'unverified',
 'Cấu hình nền cho một camera GigE, xử lý theo ngưỡng và blob.',
 'Baseline configuration for a single GigE camera with thresholding and blob analysis.',
 310),

('PC-HIGH-BANDWIDTH', 'controller', 'Generic', 'IPC-i7-32G-5GigE',
 '{"cpu":"Intel i7","ram_gb":32,"interfaces":["GigE","USB3","5GigE","10GigE"],"max_cameras":4,"pcie_slots":2}'::jsonb,
 'unverified',
 'Cho camera băng thông cao; card mạng phải bật jumbo frame.',
 'For high-bandwidth cameras; the NIC must have jumbo frames enabled.',
 320),

('PC-GPU-DL', 'controller', 'Generic', 'IPC-i7-32G-RTX',
 '{"cpu":"Intel i7","ram_gb":32,"gpu":"NVIDIA RTX 8GB","interfaces":["GigE","USB3","5GigE"],"max_cameras":4,"pcie_slots":1}'::jsonb,
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
 '{"cable_for":"camera_data","connector":"RJ45 Cat6","length_m":5}'::jsonb, 'unverified',
 'GigE đi được tới 100 m. Cáp phải có chống nhiễu nếu chạy gần biến tần.',
 'GigE runs up to 100 m. Use shielded cable when routed near a VFD.',
 510),
('CABLE-CAM-GIGE-10', 'cable', 'Generic', 'Cat6 RJ45 10m',
 '{"cable_for":"camera_data","connector":"RJ45 Cat6","length_m":10}'::jsonb, 'unverified', null, null, 520),
('CABLE-CAM-USB3-3', 'cable', 'Generic', 'USB3 Micro-B 3m',
 '{"cable_for":"camera_data","connector":"USB3 Micro-B khoá vít","length_m":3}'::jsonb, 'unverified',
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


-- =============================================================================
-- Camera quét dòng và đèn dòng
--
-- Line scan không phải "một loại camera khác" — nó đổi cả bộ công thức. Cảm
-- biến chỉ có MỘT hàng pixel; độ phân giải dọc đường chạy = tốc độ ÷ tần số
-- dòng. Vì mỗi dòng chỉ được phơi sáng vài trăm micro giây nên đèn dòng cường
-- độ cao là bắt buộc, không phải tuỳ chọn.
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, source, notes_vi, notes_en, sort_order)
values

('CAM-BASLER-RACER-2K', 'camera', 'Basler', 'raL2048-48gm',
 '{"camera_type":"line","line_width_px":2048,"max_line_rate_khz":48,"pixel_size_um":7,"mount":"C","interface":"GigE","color":"mono"}'::jsonb,
 'unverified',
 'Pixel 7 µm khá lớn nên thu được nhiều sáng — điều này quan trọng với line scan hơn là với area scan.',
 'The 7 um pixel collects a lot of light, which matters far more for line scan than for area scan.',
 80),

('CAM-HIK-LINE-4K', 'camera', 'Hikrobot', 'MV-CL042-91GM',
 '{"camera_type":"line","line_width_px":4096,"max_line_rate_khz":45,"pixel_size_um":3.5,"mount":"C","interface":"5GigE","color":"mono"}'::jsonb,
 'unverified',
 '4096 px một hàng: đủ cho khổ rộng, nhưng băng thông liên tục cao nên phải 5GigE.',
 '4096 px per line covers a wide web, but the continuous bandwidth needs 5GigE.',
 90),

('LIGHT-HZ-LINE-W', 'light', 'HZ', 'HZ-LN300-W',
 '{"light_type":"bar","color":"white","size_mm":300,"wd_min_mm":30,"wd_max_mm":150}'::jsonb,
 'unverified',
 'Đèn dòng cường độ cao cho line scan. Đèn thanh thường KHÔNG đủ sáng ở vài chục nghìn dòng/giây.',
 'High-intensity line light for line scan. An ordinary bar light is not bright enough at tens of thousands of lines per second.',
 270)

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
-- Vật tư bổ sung, lấy theo đúng file BOM đội kỹ thuật đang dùng
--
-- Ba thứ trước đây bộ chọn không hề biết tới, nhưng danh mục thật luôn có:
--   - Cáp NGUỒN camera, tách riêng khỏi cáp data
--   - Card giao tiếp GigE cắm vào máy tính (nhiều kênh cho nhiều camera)
--   - Cáp phụ trợ quanh máy tính (HDMI, USB nối dài, USB-to-COM)
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, source, notes_vi, notes_en, sort_order)
values

('CABLE-CAM-POWER-10', 'cable', 'Hikrobot', 'MV-ACP-H6p-open-HF-10m',
 '{"cable_for":"camera_power","connector":"Hirose 6 chân","length_m":10}'::jsonb, 'unverified',
 'Camera GigE cần cáp nguồn/IO riêng, không lấy điện qua cáp mạng.',
 'A GigE camera needs a separate power/IO cable; it is not powered over the network cable.',
 540),
('CABLE-CAM-POWER-5', 'cable', 'Hikrobot', 'MV-ACP-H6p-open-HF-5m',
 '{"cable_for":"camera_power","connector":"Hirose 6 chân","length_m":5}'::jsonb, 'unverified', null, null, 550),

('IFCARD-IRAYPLE-4CH', 'interface_card', 'iRayple', 'GE-5G40E',
 '{"interface":"5GigE","channels":4}'::jsonb, 'unverified',
 'Bốn kênh độc lập — mỗi camera một cổng, không chia băng thông qua switch.',
 'Four independent channels: one port per camera, no bandwidth shared through a switch.',
 610),
('IFCARD-ADLINK-4CH', 'interface_card', 'ADLINK', 'PCIe-GIE74V',
 '{"interface":"GigE","channels":4}'::jsonb, 'unverified',
 'Card GigE bốn cổng, có cấp nguồn PoE cho camera.',
 'Four-port GigE card with PoE for the cameras.',
 620),
('IFCARD-ONBOARD-1CH', 'interface_card', 'Onboard', 'Cổng mạng sẵn trên main',
 '{"interface":"GigE","channels":1}'::jsonb, 'unverified',
 'Dùng cổng mạng có sẵn — chỉ đủ cho một camera và phải tách khỏi mạng nhà máy.',
 'Use the onboard port: enough for a single camera only, and it must be isolated from the plant network.',
 630),

('ACC-CABLE-HDMI-10', 'accessory', 'Ugreen', 'Cáp HDMI 10m', '{}'::jsonb, 'unverified', null, null, 960),
('ACC-CABLE-USB-EXT-10', 'accessory', 'Ugreen', 'Cáp USB nối dài 10m', '{}'::jsonb, 'unverified', null, null, 965),
('ACC-USB-COM', 'accessory', 'Ugreen', 'USB to COM 1.5m', '{}'::jsonb, 'unverified', null, null, 970)

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
-- Phụ kiện quang học và cơ khí
--
-- Vì sao thêm: form đã hỏi bề mặt có phản chiếu không, có yêu cầu IP không, có
-- rung không, chụp tĩnh hay quét dòng — rồi không dùng câu trả lời vào đâu cả.
-- Danh mục vật tư sinh ra thiếu đúng những món mà thiếu là hệ chạy không ổn
-- định: kính phân cực cho bề mặt kim loại, kính lọc dải hẹp khi có ánh sáng
-- môi trường, encoder cho line scan.
--
-- pick_mode = 'rule'   -> máy tự thêm vào bảng vật tư khi điều kiện khớp.
-- pick_mode = 'manual' -> chỉ liệt kê cho tích tay (gá, khung, tủ).
--
-- Mã và hãng ở đây là CHỖ ĐIỀN, chưa đối chiếu datasheet (source =
-- 'unverified', chưa có giá). Thay bằng mã thật ở trang Quản trị -> Linh kiện.
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, source, notes_vi, notes_en, sort_order)
values

-- --------------------------------------------------------------- PHÂN CỰC --
-- Hai dòng dưới đây LUÔN đi cùng nhau. Chỉ mua kính trên ống kính thì không
-- cắt được loá, vì ánh sáng chiếu tới vẫn chưa bị phân cực.
('ACC-POL-LENS-C', 'accessory', 'Generic', 'Kính lọc phân cực ống kính C-mount',
 '{"pick_mode":"rule","accessory_type":"polarizer_lens","accessory_for":"lens","qty_basis":"per_camera"}'::jsonb,
 'unverified',
 'Bắt buộc đi CẶP với tấm phân cực trước đèn. Mua một mình thì không cắt được loá.',
 'Must be bought as a PAIR with the light-side polarizing film. On its own it removes no glare.',
 1010),
('ACC-POL-LIGHT', 'accessory', 'Generic', 'Tấm phân cực che trước đèn',
 '{"pick_mode":"rule","accessory_type":"polarizer_light","accessory_for":"light","qty_basis":"per_light"}'::jsonb,
 'unverified',
 'Cắt theo cỡ mặt đèn. Xoay lệch 90 độ so với kính trên ống kính để triệt loá.',
 'Cut to the light face. Rotate 90 degrees against the lens filter to kill the specular glare.',
 1020),

-- --------------------------------------------------------- LỌC DẢI HẸP --
-- Cách rẻ nhất để hệ khỏi trôi theo đèn trần và nắng qua cửa sổ.
('ACC-BP-630', 'accessory', 'Generic', 'Kính lọc dải hẹp 630nm (đỏ)',
 '{"pick_mode":"rule","accessory_type":"bandpass_filter","accessory_for":"lens","qty_basis":"per_camera","wavelength_nm":630}'::jsonb,
 'unverified',
 'Chỉ cho qua ánh sáng đèn đỏ, cắt gần hết ánh sáng môi trường.',
 'Passes only the red light, blocking most of the ambient light.',
 1030),
('ACC-BP-470', 'accessory', 'Generic', 'Kính lọc dải hẹp 470nm (xanh dương)',
 '{"pick_mode":"rule","accessory_type":"bandpass_filter","accessory_for":"lens","qty_basis":"per_camera","wavelength_nm":470}'::jsonb,
 'unverified', null, null, 1040),
('ACC-BP-525', 'accessory', 'Generic', 'Kính lọc dải hẹp 525nm (xanh lá)',
 '{"pick_mode":"rule","accessory_type":"bandpass_filter","accessory_for":"lens","qty_basis":"per_camera","wavelength_nm":525}'::jsonb,
 'unverified', null, null, 1050),
('ACC-BP-850', 'accessory', 'Generic', 'Kính lọc dải hẹp 850nm (hồng ngoại)',
 '{"pick_mode":"rule","accessory_type":"bandpass_filter","accessory_for":"lens","qty_basis":"per_camera","wavelength_nm":850}'::jsonb,
 'unverified',
 'Hồng ngoại gần như miễn nhiễm với ánh sáng nhà xưởng, nhưng mất hết thông tin màu.',
 'Near-IR is almost immune to factory lighting, at the cost of all colour information.',
 1060),

-- ------------------------------------------------------------ VỎ BẢO VỆ IP --
('ACC-HOUSING-IP65', 'accessory', 'Generic', 'Vỏ bảo vệ camera IP65',
 '{"pick_mode":"rule","accessory_type":"ip_housing","accessory_for":"camera","qty_basis":"per_camera"}'::jsonb,
 'unverified',
 'Nhớ tính thêm nhiệt: camera trong vỏ kín nóng hơn, nhiễu ảnh tăng theo.',
 'Budget for heat as well: a camera inside a sealed housing runs hotter and gets noisier.',
 1070),

-- ------------------------------------------------------- ENCODER & TRIGGER --
('ACC-ENCODER-1000PPR', 'accessory', 'Generic', 'Encoder quay 1000 xung/vòng',
 '{"pick_mode":"rule","accessory_type":"encoder","accessory_for":"system","qty_basis":"per_system"}'::jsonb,
 'unverified',
 'Line scan không có encoder thì độ phân giải dọc trôi theo tốc độ băng tải.',
 'Without an encoder, line-scan vertical resolution drifts with conveyor speed.',
 1080),
('ACC-CABLE-ENCODER', 'accessory', 'Generic', 'Cáp encoder 5m',
 '{"pick_mode":"rule","accessory_type":"encoder_cable","accessory_for":"system","qty_basis":"per_system"}'::jsonb,
 'unverified', null, null, 1090),
('ACC-TRIGGER-SENSOR', 'accessory', 'Generic', 'Cảm biến quang điện báo vật tới',
 '{"pick_mode":"rule","accessory_type":"trigger_sensor","accessory_for":"system","qty_basis":"per_system"}'::jsonb,
 'unverified',
 'Chụp lúc vật đang chạy thì phải có tín hiệu báo vật đã tới.',
 'Capturing a moving part needs something to say the part has arrived.',
 1100),

-- --------------------------------------------------------- CHỐNG RUNG, NGÀM --
('ACC-LOCK-RING', 'accessory', 'Generic', 'Vòng khoá nét và khẩu ống kính',
 '{"pick_mode":"rule","accessory_type":"lock_ring","accessory_for":"lens","qty_basis":"per_camera"}'::jsonb,
 'unverified',
 'Rẻ nhất trong danh mục, nhưng thiếu nó là mất nét sau vài tuần rung.',
 'The cheapest line item here, and the one whose absence loses focus after a few weeks of vibration.',
 1110),
('ACC-MOUNT-C-F', 'accessory', 'Generic', 'Adapter ngàm C sang F',
 '{"pick_mode":"rule","accessory_type":"mount_adapter","accessory_for":"camera","qty_basis":"per_camera"}'::jsonb,
 'unverified',
 'Cần khi camera ngàm F (cảm biến lớn, line scan) mà ống kính ngàm C.',
 'Needed when the camera has an F mount (large sensor, line scan) but the lens is C mount.',
 1120),

-- ------------------------------------------------------------------ TÍCH TAY --
-- Không có công thức nào quyết định thay được, chỉ liệt kê.
('ACC-BRACKET-CAM', 'accessory', 'Generic', 'Gá camera + tay đỡ',
 '{"pick_mode":"manual","accessory_type":"bracket","accessory_for":"camera"}'::jsonb,
 'unverified', null, null, 1200),
('ACC-BRACKET-LIGHT', 'accessory', 'Generic', 'Gá đèn + tay đỡ',
 '{"pick_mode":"manual","accessory_type":"bracket","accessory_for":"light"}'::jsonb,
 'unverified', null, null, 1210),
('ACC-DIFFUSER', 'accessory', 'Generic', 'Tấm khuếch tán cho đèn thanh/vòng',
 '{"pick_mode":"manual","accessory_type":"diffuser","accessory_for":"light"}'::jsonb,
 'unverified',
 'Làm mềm ánh sáng, đổi lại mất khoảng một nửa cường độ.',
 'Softens the light, at the cost of roughly half the intensity.',
 1220),
('ACC-PSU-24V', 'accessory', 'Generic', 'Nguồn 24V DC 5A',
 '{"pick_mode":"manual","accessory_type":"power_supply","accessory_for":"light"}'::jsonb,
 'unverified',
 'Dùng khi đèn bật thường xuyên, không qua bộ điều khiển.',
 'For lights that stay on continuously, without a controller.',
 1230),
('ACC-XYZ-STAGE', 'accessory', 'Generic', 'Bàn trượt XYZ chỉnh vị trí camera',
 '{"pick_mode":"manual","accessory_type":"other","accessory_for":"camera"}'::jsonb,
 'unverified', null, null, 1240),
('ACC-FRAME-ALU', 'accessory', 'Generic', 'Khung nhôm định hình',
 '{"pick_mode":"manual","accessory_type":"other","accessory_for":"system"}'::jsonb,
 'unverified', null, null, 1250)

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
-- Ví dụ CoaXPress-12 và Camera Link, lấy từ trang hãng / nhà phân phối
--
-- Thêm để bộ chọn có thiết bị thật cho hai chuẩn vừa có trong
-- INTERFACE_BANDWIDTH. Thông số chép từ trang ghi ở datasheet_url (tháng
-- 9/2026) nhưng CHƯA đối chiếu datasheet PDF, nên vẫn là 'unverified' — đội kỹ
-- thuật cập nhật sau.
--
-- Hai giới hạn của engine hiện tại, ghi rõ để không ai hiểu nhầm:
--   * INTERFACE_BANDWIDTH['CXP-12'] là băng thông MỖI LANE. Camera chạy 4 lane
--     (boA5120-150cm) bị tính như 1 lane, tức băng thông bị đánh giá thấp 4 lần.
--     `cxp_links` chỉ để tham khảo, engine chưa đọc.
--   * Camera Link phải khai đúng cấu hình đang chạy; xem ghi chú dòng Vision Datum.
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, source, datasheet_url, notes_vi, notes_en, sort_order)
values

('CAM-BASLER-BOA4112-68CC', 'camera', 'Basler', 'boA4112-68cc',
 '{"camera_type":"area","resolution_mp":12.3,"resolution_w_px":4096,"resolution_h_px":3000,"sensor_format":"1.1","pixel_size_um":3.45,"mount":"C","interface":"CXP-12","cxp_links":1,"max_fps":69,"color":"color"}'::jsonb,
 'unverified', 'https://docs.baslerweb.com/boa4112-68cc',
 'Sony IMX253, màn trập toàn cục. Cảm biến đủ 4112 × 3008, mặc định xuất 4096 × 3000. 69 fps là ở 8 bit. Mặt trước đa năng (C / F / M42) — mặc định ghi C, kiểm lại bản đặt hàng. Giao nhận không kèm kính lọc hồng ngoại.',
 'Sony IMX253 global shutter. Full sensor 4112 x 3008, default output 4096 x 3000. 69 fps at 8 bit. Universal front (C / F / M42) — entered as C, check the ordered variant. Shipped without IR-cut filter.',
 95),

('CAM-BASLER-BOA5120-150CM', 'camera', 'Basler', 'boA5120-150cm',
 '{"camera_type":"area","resolution_mp":26.2,"resolution_w_px":5120,"resolution_h_px":5120,"sensor_format":"1.1","pixel_size_um":2.5,"mount":"C","interface":"CXP-12","cxp_links":4,"max_fps":150,"color":"mono"}'::jsonb,
 'unverified', 'https://docs.baslerweb.com/boa5120-150cm',
 'Gpixel GMAX0505, 25 MP vuông. 150 fps CHỈ đạt ở 4 × CXP-12, Mono8 — cần grabber 4 cổng dành riêng cho một camera. Engine đang tính 1 lane nên sẽ báo thiếu băng thông sớm hơn thực tế. Pixel 2,5 µm: ống kính phải đủ độ phân giải quang học.',
 'Gpixel GMAX0505, 25 MP square. 150 fps ONLY at 4 x CXP-12, Mono8 — needs a 4-port grabber for this one camera. The engine counts one lane, so it flags bandwidth earlier than reality. 2.5 um pixels need a lens that resolves them.',
 96),

('CAM-HIK-MVCH120-90Y1M', 'camera', 'Hikrobot', 'MV-CH120-90Y1M-NN',
 '{"camera_type":"area","resolution_mp":12.6,"resolution_w_px":4096,"resolution_h_px":3072,"sensor_format":"1.1","pixel_size_um":3.4,"mount":"C","interface":"CXP-12","cxp_links":1,"max_fps":93.9,"color":"mono"}'::jsonb,
 'unverified', 'https://www.annolution.com/en/shop/hikrobotarea-scan-camera-12mp-area-scan-camera-gmax3412-1-link-cxp-12-c-mount-without-fan-without-heat-sink-mono-8179',
 'Gpixel GMAX3412, 1 link CXP-12 (micro-BNC), 93,9 fps ở Mono8. Bản -NN không quạt, không tản nhiệt — phải tự lo tản nhiệt khi lắp. Nguồn là trang nhà phân phối, chưa phải trang Hikrobot.',
 'Gpixel GMAX3412, 1-link CXP-12 (micro-BNC), 93.9 fps at Mono8. The -NN variant has no fan and no heat sink — plan cooling at mounting. Source is a distributor page, not Hikrobot itself.',
 97),

('CAM-VD-MARS4096-L120CM', 'camera', 'Vision Datum', 'Mars4096G-L120cm',
 '{"camera_type":"line","line_width_px":4096,"max_line_rate_khz":120,"pixel_size_um":7,"mount":"M42","interface":"CameraLink-Full","color":"mono"}'::jsonb,
 'unverified', 'https://shop.visiondatum.com/products/j-4k-cameralink-cmos-line-scan-camera',
 'Line scan 4K Camera Link, pixel 7 µm, 120 kHz, ngàm M42 × 1 (FBL 12 mm). CẤU HÌNH CAMERA LINK CHƯA XÁC NHẬN: trang hãng không ghi Base/Medium/Full. Ở 120 kHz × 4096 px × 8 bit ≈ 491 MB/s nên ít nhất phải Medium (510); tạm ghi Full — kiểm lại datasheet trước khi dùng.',
 '4K Camera Link line scan, 7 um pixel, 120 kHz, M42 x 1 mount (12 mm FBL). CAMERA LINK CONFIGURATION NOT CONFIRMED: the vendor page does not state Base/Medium/Full. At 120 kHz x 4096 px x 8 bit ~ 491 MB/s it needs at least Medium (510); entered as Full — check the datasheet before use.',
 98),

('IFCARD-EURESYS-CXP12-4CH', 'interface_card', 'Euresys', 'Coaxlink Quad CXP-12',
 '{"interface":"CXP-12","channels":4}'::jsonb,
 'unverified', 'https://www.euresys.com/en/products/frame-grabber/coaxlink-quad-cxp-12/',
 'Grabber 4 kết nối CXP-12 (micro-BNC / HD-BNC), tổng 5000 MB/s, PCIe 3.0 x8 — cần khe x8. 4 cổng dùng được cho 4 camera 1 link, 2 camera 2 link, hoặc 1 camera 4 link.',
 'Frame grabber with four CXP-12 connections (micro-BNC / HD-BNC), 5000 MB/s total, PCIe 3.0 x8 — needs an x8 slot. Ports serve four 1-link cameras, two 2-link cameras, or one 4-link camera.',
 630)

on conflict (code) do update set
  kind          = excluded.kind,
  brand         = excluded.brand,
  model         = excluded.model,
  spec          = excluded.spec,
  source        = excluded.source,
  datasheet_url = excluded.datasheet_url,
  notes_vi      = excluded.notes_vi,
  notes_en      = excluded.notes_en,
  sort_order    = excluded.sort_order,
  is_active     = true;
