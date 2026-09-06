-- =============================================================================
-- Mở rộng danh mục linh kiện theo đúng trình tự mua hàng thực tế
--
--   Camera → Ống kính (+ tube nếu cần) → Đèn → Cáp camera → Cáp đèn →
--   Bộ điều khiển đèn → Máy tính (kèm Windows/Office/màn hình/bàn phím) →
--   Phần mềm xử lý ảnh → Phụ kiện thêm
--
-- BỎ ENUM, CHUYỂN SANG TEXT + CHECK. Lý do rất thực tế: `alter type ... add
-- value` không dùng được giá trị mới trong CÙNG một transaction. Mà cách nạp
-- SQL của dự án là dán một lượt cả migration lẫn seed vào SQL Editor — tức là
-- một transaction. Giữ enum thì lần dán nào thêm loại mới cũng vỡ, với thông
-- báo lỗi rất khó hiểu. Dùng text + check thì thêm loại chỉ là sửa một ràng
-- buộc, không còn cái bẫy đó.
-- =============================================================================

alter table public.components
  alter column kind type text using kind::text;

drop type if exists public.component_kind;

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
      'controller',
      'software',
      'pc_option',
      'accessory'
    )
  );

comment on column public.components.kind is
  'Loại linh kiện. Danh sách hợp lệ nằm ở ràng buộc components_kind_valid và ở COMPONENT_KINDS trong src/lib/components/specs.ts — hai chỗ phải khớp nhau.';

comment on constraint components_kind_valid on public.components is
  'controller = máy tính công nghiệp. light_controller = bộ điều khiển đèn. Hai thứ khác nhau, đừng nhầm.';
