-- =============================================================================
-- PC Vision — 6 khung, 13 cấu hình đề xuất ban đầu (gói bàn giao 03/11/2026 mục 3).
-- Hùng thêm / sửa tiếp trên trang /cong-cu-may-tinh. Mã do trigger ghép.
-- 2026-11-04: Hùng xác nhận khung A (EBS-I10) dùng RAM + SSD công nghiệp → dòng I (trước là '?').
-- 2026-11-04: lan_ports = TỔNG cổng LAN có sẵn trên máy; Gợi ý để 1 cổng cho mạng nhà máy (ngưỡng
--   pcLanReservedPorts), không cắm camera. Hùng xác nhận mỗi khung A–D có 2 cổng LAN (gói bàn giao ghi 1);
--   khung P (phụ trợ, không thu ảnh) giữ 0 để không bị gợi ý cho camera.
-- 2026-11-07: thêm khung B500 (Tiêu chuẩn, nguồn 500W) theo Hùng — P350 không dùng (tải đỉnh 330W = 94%).
-- Dán lại nhiều lần không sao: khung khớp theo slug, cấu hình khớp theo khung + tên ngắn.
-- =============================================================================

insert into public.pc_frames (
  slug, tier, name_vi, name_en, chassis_pn, cpu, gpu, vram_gb, psu_w, os, ram_line, ssd_line,
  card_slots, lan_ports, peak_load_w, use_for_vi, use_for_en, not_for_vi, not_for_en, note_vi, note_en, sort_order)
values
  ('A', 'A', 'Cơ bản', 'Basic', 'EBS-I10', 'I5-12400', '0', 0, 250, 'W11P', 'I', 'I', 0, 2, 120,
   'Thuật toán cổ điển: đo, đếm, có/không, đọc code', 'Classic algorithms: measuring, counting, presence, code reading',
   'AI · lắp thêm card', 'AI · add-in cards',
   null, null, 10),
  ('B', 'B', 'Tiêu chuẩn', 'Standard', 'RT-661R-Q670-A10-0001', 'I7-14700', '0', 0, 650, 'W11P', 'I', 'I', 3, 2, 330,
   'Cổ điển nhiều camera, ảnh lớn', 'Classic, many cameras, large images',
   'AI tốc độ cao', 'High-speed AI', null, null, 20),
  ('B500', 'B', 'Tiêu chuẩn · nguồn 500W', 'Standard · 500W PSU', 'RT-661R-Q670-A10-0001', 'I7-14700', '0', 0, 500, 'W11P', 'I', 'I', 3, 2, 330,
   'Cổ điển ít camera PoE hoặc camera nguồn ngoài', 'Classic with few PoE cameras or externally powered cameras',
   'AI tốc độ cao', 'High-speed AI',
   'Nguồn 500W: tải đỉnh 330W = 66% nguồn; nhiều camera PoE trong máy sẽ vượt 70% — cấp PoE bằng switch ngoài',
   '500W PSU: 330W peak = 66% of PSU; many in-PC PoE cameras exceed 70% — power them from an external PoE switch', 25),
  ('Ct', 'C', 'AI tiết kiệm', 'AI economy', 'RT-661R-Q670-A10-0001', 'I7-14700', '5070', 12, 1000, 'W11P', 'I', 'I', 2, 2, 570,
   'AI suy luận: phân loại, phân đoạn lỗi, OCR khó', 'AI inference: classification, defect segmentation, hard OCR',
   'Nhiều camera cổ điển chạy song song', 'Many classic cameras in parallel', null, null, 30),
  ('C', 'C', 'AI', 'AI', 'RT-661R-Q670-A10-0001', 'I9-14900', '5070', 12, 1000, 'W11P', 'I', 'I', 2, 2, 570,
   'AI suy luận + cổ điển nhiều camera', 'AI inference + classic with many cameras',
   'Huấn luyện model lớn tại máy', 'Training large models on the machine', null, null, 40),
  ('D', 'D', 'AI cao', 'AI high', 'RT-661R-Q670-A10-0001', 'I9-14900', '5080', 16, 1300, 'W11P', 'I', 'I', 2, 2, 680,
   'AI nặng, ảnh 20MP+, line scan, huấn luyện tại máy', 'Heavy AI, 20MP+ images, line scan, on-machine training',
   null, null, 'Card GPU dày khoảng 2,5 khe, phải đo thực tế', 'GPU card is about 2.5 slots thick, measure on site', 50),
  ('P', 'P', 'Phụ trợ', 'Auxiliary', 'LR-H610M-XA22', 'I5-12400', '0', 0, 450, 'W11P', 'C', 'C', 0, 0, 180,
   'Màn hình HMI cho smart camera', 'HMI display for smart cameras',
   'Thu ảnh, dây chuyền 24/7', 'Image acquisition, 24/7 lines',
   'Linh kiện dòng thường', 'Commercial-grade parts', 60)
on conflict (slug) do nothing;

insert into public.pc_configs (frame_id, short_name, ram_gb, ssd_gb, data_kind, data_gb, data_line, code)
select f.id, v.short_name, v.ram_gb, v.ssd_gb, v.data_kind, v.data_gb, v.data_line, ''
  from (values
    ('A',  'A1',  16,  256,  null, null, null),
    ('B',  'B1',  16,  512,  null, null, null),
    ('B',  'B2',  32,  512,  'D',  1024, 'C'),
    ('B',  'B3',  64,  512,  'D',  2048, 'C'),
    ('B500', 'B1-500', 16, 512,  null, null, null),
    ('B500', 'B2-500', 32, 512,  'D',  1024, 'C'),
    ('B500', 'B3-500', 64, 512,  'D',  2048, 'C'),
    ('Ct', 'Ct1', 32,  1024, null, null, null),
    ('Ct', 'Ct2', 32,  512,  'D',  2048, 'C'),
    ('C',  'C1',  32,  1024, null, null, null),
    ('C',  'C2',  64,  1024, null, null, null),
    ('C',  'C3',  64,  512,  'D',  2048, 'C'),
    ('D',  'D1',  64,  1024, null, null, null),
    ('D',  'D2',  64,  512,  'D',  4096, 'C'),
    ('D',  'D3',  128, 1024, 'D',  2048, 'C'),
    ('P',  'P1',  16,  256,  null, null, null)
  ) as v (frame_slug, short_name, ram_gb, ssd_gb, data_kind, data_gb, data_line)
  join public.pc_frames f on f.slug = v.frame_slug
 where not exists (
   select 1 from public.pc_configs c where c.frame_id = f.id and c.short_name = v.short_name
 );
