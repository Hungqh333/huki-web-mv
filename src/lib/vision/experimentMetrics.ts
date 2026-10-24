/**
 * Chỉ số đánh giá một phương án đèn trong thực nghiệm của phòng Vision (chốt 2026-10-24 Q10).
 * Theo mục IV "Đánh giá và kết luận" của báo cáo test (vd MC1626-01 Lenmount):
 *
 *   EXP-001  tỉ lệ bỏ sót  = FN / (TP + TN + FP + FN)   — hàng lỗi bị xếp thành OK
 *   EXP-002  tỉ lệ hao phí = FP / (TP + TN + FP + FN)   — hàng OK bị xếp thành NG
 *
 * Tiêu chí của báo cáo: bỏ sót < 1 %, hao phí < 5 %. Web chỉ tính lại từ bốn số admin nhập,
 * không chấm Đạt / Không đạt thay kỹ sư — kết quả của phương án vẫn do kỹ sư ghi.
 */

export const LEAKAGE_LIMIT = 0.01;
export const OVERKILL_LIMIT = 0.05;

export type ConfusionCounts = { tp: number | null; tn: number | null; fp: number | null; fn: number | null };

export type TrialRates = {
  total: number;
  /** EXP-001, 0…1. */
  leakage: number;
  /** EXP-002, 0…1. */
  overkill: number;
  leakageOk: boolean;
  overkillOk: boolean;
};

/** Đủ bốn số và tổng > 0 mới tính; thiếu một số → null (không đoán). */
export function trialRates({ tp, tn, fp, fn }: ConfusionCounts): TrialRates | null {
  if (tp === null || tn === null || fp === null || fn === null) return null;
  const total = tp + tn + fp + fn;
  if (total <= 0) return null;
  const leakage = fn / total;
  const overkill = fp / total;
  return { total, leakage, overkill, leakageOk: leakage < LEAKAGE_LIMIT, overkillOk: overkill < OVERKILL_LIMIT };
}
