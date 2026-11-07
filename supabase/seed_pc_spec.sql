-- =============================================================================
-- PC Vision — thông số cho list thiết bị, điền sẵn từ form PC gốc (4_Pc_goc.xlsx), chốt 2026-11-07
-- Chỉ điền khung còn trống (spec = '{}') → không đè chữ Admin đã sửa; dán lại nhiều lần không sao.
-- Theo danh mục khi form lệch (chốt Q3): nguồn lấy W theo mã, RAM 2 thanh cùng lô,
-- SSD dòng I = 2.5" SATA Kingston Industrial, ổ dữ liệu SSD hãng Western Digital.
-- Mỗi lệnh update một dòng JSON (trang xem trước /dev/pc-vision đọc lại chính file này).
-- =============================================================================

update public.pc_frames set spec = '{"maker":"AAEON","chassis":"4U 19\" Rackmount chassis, L450 × W427 × H177 mm","psu":"ATX, 90–264 VAC, Full Range","cpuSuffix":"& Cooler","memory":"DDR5 U-DIMM","memoryBrand":"Kingston Industrial","ssd":"2.5\" SSD, SATA","ssdBrand":"Kingston Industrial","dataBrand":"Western Digital","io":"2 × DP, 2 × HDMI, 2 × GbE LAN ports, 1 × COM, 4 × USB 3.1 ports,\nPCIe [x16] × 1, PCIe [x1] × 1, PCIe [x4] × 1\nPCIe [x16] × 1 (4 Lanes), PCI Slot × 3"}'::jsonb
 where slug in ('B', 'B500') and spec = '{}'::jsonb;

update public.pc_frames set spec = '{"maker":"AAEON","chassis":"4U 19\" Rackmount chassis, L450 × W427 × H177 mm","psu":"ATX, 90–264 VAC, Full Range","cpuSuffix":"& Cooler","memory":"DDR5 U-DIMM","memoryBrand":"Kingston Industrial","ssd":"2.5\" SSD, SATA","ssdBrand":"Kingston Industrial","dataBrand":"Western Digital","gpu":"Graphic card, RTX 5070 Twin Edge -OC, PCIe Gen 5 ×16, 6144 CUDA cores, 12GB GDDR7, TGP 250W, 12VHPWR, L241.5 × H120.1 × W40.6 mm, dual slot. -ZOTAC ZT-B50700H-10P","io":"2 × DP, 2 × HDMI, 2 × GbE LAN ports, 1 × COM, 4 × USB 3.1 ports,\nPCIe [x16] × 1, PCIe [x1] × 1, PCIe [x4] × 1\nPCIe [x16] × 1 (4 Lanes), PCI Slot × 3"}'::jsonb
 where slug in ('Ct', 'C') and spec = '{}'::jsonb;

update public.pc_frames set spec = '{"maker":"AAEON","chassis":"4U 19\" Rackmount chassis, L450 × W427 × H177 mm","psu":"ATX, 90–264 VAC, Full Range","cpuSuffix":"& Cooler","memory":"DDR5 U-DIMM","memoryBrand":"Kingston Industrial","ssd":"2.5\" SSD, SATA","ssdBrand":"Kingston Industrial","dataBrand":"Western Digital","gpu":"PRIME-RTX5080-O16G","io":"2 × DP, 2 × HDMI, 2 × GbE LAN ports, 1 × COM, 4 × USB 3.1 ports,\nPCIe [x16] × 1, PCIe [x1] × 1, PCIe [x4] × 1\nPCIe [x16] × 1 (4 Lanes), PCI Slot × 3"}'::jsonb
 where slug in ('D') and spec = '{}'::jsonb;

update public.pc_frames set spec = '{"maker":"ASUS","chassis":"EBS-I10","mainboard":"H610I-EM-A","psu":"PSU FLEX, GOLD","cpuSuffix":"6C, 12T, up to 4.4GHz, Cache 18MB","memory":"SO-DDR4 3200","memoryBrand":"Kingston Industrial","ssd":"SSD M.2 2280 NVMe","ssdBrand":"Kingston Industrial"}'::jsonb
 where slug in ('A') and spec = '{}'::jsonb;

update public.pc_frames set spec = '{"maker":"ASUS","chassis":"Xigmatek XA-22","mainboard":"Asus Prime H610M-K D4","psu":"KENOO ESPORT E450 (Fan 12cm)","cpuSuffix":"Tray (up to 4.40GHz, 6 cores 12 threads, 18MB cache, Socket 1700, Alder Lake)","memory":"UDIMM 3200MHz","memoryBrand":"Merlin","ssd":"SSD M.2 2280 NVMe PCIe Gen3x4","ssdBrand":"Micron (MTFDHBL256TDD)"}'::jsonb
 where slug in ('P') and spec = '{}'::jsonb;
