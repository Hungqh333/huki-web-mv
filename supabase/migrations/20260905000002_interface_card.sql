-- =============================================================================
-- Thêm loại "card giao tiếp" và tách cáp camera thành data / nguồn
--
-- Học từ chính file BOM đội kỹ thuật đang dùng (Bom list vision.xlsx): danh mục
-- thật liệt kê RIÊNG "Cable data cam" và "Cable Power", và có hẳn một dòng
-- "GigE Interface Card GE-5G40E, 4 channel". Trước đây bộ chọn gộp cáp camera
-- làm một và không hề biết tới card giao tiếp — hai chỗ thiếu khiến báo giá
-- sinh ra bị hụt so với thực tế.
-- =============================================================================

alter table public.components
  drop constraint if exists components_kind_valid;

alter table public.components
  add constraint components_kind_valid check (
    kind in (
      'camera',
      'lens',
      'tube',
      'light',
      'cable',
      'light_controller',
      'interface_card',
      'controller',
      'software',
      'pc_option',
      'accessory'
    )
  );

comment on constraint components_kind_valid on public.components is
  'controller = máy tính công nghiệp. light_controller = bộ điều khiển đèn. interface_card = card mạng/frame grabber cắm vào máy tính. Ba thứ khác nhau.';
