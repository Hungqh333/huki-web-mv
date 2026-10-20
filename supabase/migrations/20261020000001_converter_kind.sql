-- =============================================================================
-- Thêm loại linh kiện "converter" — bộ nhân tiêu cự (rear converter / extender)
--
-- Chốt 2026-10-20 (Hưng, Q3): trang Chọn ống kính thử thêm ống nối hoặc bộ nhân
-- cho ống bị loại vì MOD / vùng nhìn / vòng ảnh. Ống nối đã có loại 'tube'; bộ nhân
-- chưa có chỗ trong kho. Thông số nằm trong spec jsonb (factor, mount, max_format)
-- — xem SPEC_FIELDS.converter trong src/lib/components/specs.ts.
--
-- Chỉ đổi danh sách loại hợp lệ, không đụng dữ liệu. Dán lại nhiều lần không sao.
-- =============================================================================

alter table public.components
  drop constraint if exists components_kind_valid;

alter table public.components
  add constraint components_kind_valid check (
    kind in (
      'camera',
      'lens',
      'tube',
      'converter',
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
  'controller = máy tính công nghiệp. light_controller = bộ điều khiển đèn. interface_card = card mạng/frame grabber cắm vào máy tính. converter = bộ nhân tiêu cự lắp sau ống kính. Danh sách phải khớp COMPONENT_KINDS trong src/lib/components/specs.ts.';
