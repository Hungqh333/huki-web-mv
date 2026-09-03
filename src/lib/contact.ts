/**
 * Địa chỉ liên hệ hiện trên các nút "Liên hệ để được tư vấn".
 *
 * Trước đây địa chỉ này nằm cứng ở ba trang khác nhau. Người phụ trách đổi chỗ
 * làm hoặc đổi mail là ba nút cùng gửi vào hòm thư chết, mà không ai biết cho
 * tới khi khách phàn nàn. Đổi bằng biến môi trường trên Vercel là xong, không
 * cần deploy lại code.
 *
 * Giá trị dự phòng giữ nguyên hành vi cũ nếu chưa khai báo biến.
 */
const FALLBACK_EMAIL = 'hungnv@soragroup.vn';

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || FALLBACK_EMAIL;

/** Dựng link mailto kèm tiêu đề đã mã hoá đúng. */
export function contactMailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
