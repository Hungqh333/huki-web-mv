-- =============================================================================
-- Thêm loại linh kiện "code_reader" — đầu đọc mã liền khối (smart code reader)
--
-- Chốt 2026-10-27 (Hùng, Q1): trang Chọn đầu đọc mã lọc cả camera trong kho lẫn
-- đầu đọc liền khối (camera + ống + đèn + giải mã trong một hộp, kiểu Cognex
-- DataMan, Keyence SR, Hikrobot ID, iRayple ID). Thông số nằm trong spec jsonb —
-- xem SPEC_FIELDS.code_reader trong src/lib/components/specs.ts.
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
      'accessory',
      'code_reader'
    )
  );

comment on constraint components_kind_valid on public.components is
  'controller = máy tính công nghiệp. light_controller = bộ điều khiển đèn. interface_card = card mạng/frame grabber cắm vào máy tính. converter = bộ nhân tiêu cự lắp sau ống kính. code_reader = đầu đọc mã liền khối. Danh sách phải khớp COMPONENT_KINDS trong src/lib/components/specs.ts.';
