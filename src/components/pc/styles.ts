/**
 * Kiểu chữ dùng chung cho 4 tab PC Vision (chốt 2026-11-04): bảng 13px, tiêu đề cột 12px;
 * thông tin phụ mờ hơn ghi chú chung của web một bậc; mã: phần khung xám đậm nét vừa,
 * phần RAM–SSD–ổ dữ liệu in đậm. Không viên màu cho thông tin phụ — màu chỉ để báo
 * trạng thái thật (Đạt / Lưu ý / Không hợp, cảnh báo dòng RAM/SSD, màu ô bảng fps).
 */

/** Thông tin phụ: thông số khung, "Dùng cho…", số thứ tự, đơn vị, dòng ✓ của thẻ Gợi ý. */
export const PC_INFO_CLASS = 'text-xs font-normal text-slate-400 dark:text-slate-500';

/** Phần khung của mã (PN-CPU-G-P) và đuôi hệ điều hành. */
export const PC_CODE_HEAD_CLASS = 'font-medium text-slate-600 dark:text-slate-300';

/** Phần RAM–SSD–ổ dữ liệu của mã. */
export const PC_CODE_MID_CLASS = 'font-bold text-slate-900 dark:text-white';
