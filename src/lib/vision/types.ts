/**
 * Kiểu dùng chung cho bộ tính toán bài Kiểm tra ngoại quan.
 *
 * Toàn bộ module vision là hàm thuần, không biết gì về React hay database —
 * nhờ vậy mỗi công thức test được độc lập. Giao diện chỉ nhận kết quả rồi vẽ.
 */

/**
 * PASS = đạt. WARN = chạy được nhưng có rủi ro phải xử lý. FAIL = không đạt,
 * phải đổi cấu hình. INFO = chỉ là con số tham khảo, không phán xét.
 */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type Check = {
  /** Khoá i18n cho tên bước. */
  key: string;
  status: CheckStatus;
  /**
   * Công thức đã thay số — giữ đúng cách hiển thị đang dùng ở bộ chọn thiết bị:
   * kỹ sư đọc được và tự kiểm chứng lại bằng máy tính bỏ túi.
   */
  formula: string;
  /** Khoá i18n cho câu diễn giải kèm tham số, nếu bước này cần nói thêm. */
  noteKey?: string;
  noteValues?: Record<string, string | number>;
};

/** Camera tối thiểu cần biết gì để kiểm chứng được cấu hình. */
export type CameraLike = {
  widthPx: number;
  heightPx: number;
  pixelSizeUm: number | null;
  sensorFormat: string | null;
  interfaceName: string | null;
};

export const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Định dạng số cho chuỗi công thức — gọn, không phụ thuộc ngôn ngữ. */
export const fmt = (value: number, digits = 3): string => String(round(value, digits));
