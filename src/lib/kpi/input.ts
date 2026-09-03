/**
 * Đọc số từ ô nhập của bộ tính chỉ tiêu.
 *
 * Tách ra khỏi component để còn viết được test: hai lỗi dưới đây đều không gây
 * lỗi gì cả, chỉ làm kết quả sai lặng lẽ, nên phải có test canh.
 */

/**
 * Bỏ mọi ký tự không phải chữ số.
 *
 * Dùng cho ô sản lượng năm và giá trị một sản phẩm. Người Việt gõ "50.000" là
 * năm mươi nghìn, nhưng <input type="number"> hiểu dấu chấm là dấu thập phân và
 * Number("50.000") ra 50 — sai đúng một nghìn lần. Hai ô này đều là số nguyên
 * (đồng, sản phẩm) nên bỏ hết dấu phân cách là an toàn.
 */
export const digitsOnly = (text: string): string => text.replace(/\D/g, '');

/** Ô trống trả null để phân biệt với số 0 người dùng cố ý nhập. */
export const parseNumber = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};

/**
 * Số ca luôn ≥ 1.
 *
 * Số ca 0 làm mọi công thức nhân ra 0 người và 0 đồng, tức bảng chi phí hiện ra
 * như dự án không tốn gì — con số nguy hiểm nhất trong cả module vì trông vẫn
 * hợp lệ.
 */
export const parseShifts = (text: string): number => Math.max(1, parseNumber(text) ?? 1);
