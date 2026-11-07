-- =============================================================================
-- PC Vision — thông số cho list thiết bị theo form PC gốc (4_Pc_goc.xlsx), chốt 2026-11-07
--
-- Nút "Copy thông số" ghép: Tên vật tư (PC) · Loại vật tư (mã đầy đủ) · Maker · Thông số kỹ thuật.
-- Số (W nguồn, GB RAM/SSD, CPU, GPU, HĐH) luôn lấy từ mã để không lệch; phần chữ cố định của
-- từng khung (vỏ, kiểu nguồn, kiểu + hãng RAM / SSD, hãng ổ dữ liệu, model GPU, cổng I/O, maker)
-- lưu ở cột `spec` dưới đây. Không thuộc phần khoá của mã → Admin sửa được trong "Sửa khung";
-- trigger lịch sử pc_log_change tự ghi mọi lần sửa. RLS giữ nguyên (Member+ đọc, Admin ghi).
--
-- Khoá dùng: maker, chassis, mainboard, psu, cpuSuffix, memory, memoryBrand, ssd, ssdBrand,
--            dataBrand, gpu, io — tất cả là chữ, có thể vắng.
-- Chạy lại nhiều lần không sao.
-- =============================================================================

alter table public.pc_frames add column if not exists spec jsonb not null default '{}'::jsonb;

alter table public.pc_frames drop constraint if exists pc_frames_spec_check;
alter table public.pc_frames add constraint pc_frames_spec_check check (
  jsonb_typeof(spec) = 'object' and length(spec::text) <= 4000
);
