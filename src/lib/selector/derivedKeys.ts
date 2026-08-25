/**
 * Các đại lượng engine tính ra và đưa vào ngữ cảnh đánh giá luật (xem derive.ts).
 *
 * Luật trong database viết điều kiện được trên cả tham số người dùng nhập lẫn
 * những khoá này — nhờ vậy ngưỡng chọn cảm biến vẫn nằm trong bảng luật do admin
 * sửa, còn công thức tính thì ở trong code.
 */
export const DERIVED_FIELD_KEYS = [
  'fov_long_mm',
  'fov_short_mm',
  'required_resolution_px',
  'px_per_mm',
  'required_sensor_mp',
  'safety_factor',
] as const;
