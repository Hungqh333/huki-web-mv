import { FEASIBILITY_DIMENSIONS, type FeasibilityDimension, type RuleResult } from './rules';

/**
 * Đánh giá khả thi — spec V1.1 §7. Khả thi là MIN, không phải trung bình: một
 * nhóm FAIL thì cả hệ thống không khả thi, dù sáu nhóm kia đều đẹp.
 *
 * Điểm chỉ là cách HIỂN THỊ marginRatio, không phải chân lý toán học (spec
 * §7.2 bắt ghi rõ câu này trên giao diện):
 *
 *   marginRatio ≥ 1,5 → PASS 95 · 1,2–1,5 → PASS 85 · 1,0–1,2 → MARGINAL 70
 *   0,8–1,0 → FAIL 45 · < 0,8 → FAIL 20 · chưa kết luận được → UNKNOWN 60
 *
 * Quyết định tự chọn khi làm (V1b B7, 2026-09-17):
 * - Nhóm KHÔNG có luật nào chạy (V1b chưa có luật Integration; bài đo không có
 *   nhánh lỗi thì không có luật Algorithm) là "chưa đánh giá": hiện ra, nhưng
 *   không tính vào điểm tổng, yếu tố giới hạn hay kết luận. Tính vào thì mọi dự
 *   án mãi mãi dừng ở 60 điểm vì một nhóm V1b chưa làm — che mất yếu tố thật.
 * - Luật cần chụp mẫu ('requires-sample-test') hoặc thiếu dữ liệu ('unknown')
 *   mà chưa FAIL → UNKNOWN 60. Vì vậy chiếu sáng luôn là UNKNOWN cho tới khi có
 *   mẫu — đúng tinh thần LGT-009.
 * - Nhiều nhóm cùng điểm thấp nhất thì hiện TẤT CẢ làm yếu tố giới hạn, không
 *   tự chọn một.
 */

export type DimensionStatus = 'PASS' | 'MARGINAL' | 'FAIL' | 'UNKNOWN';

export type DimensionScore = {
  dimension: FeasibilityDimension;
  /** false = không có luật nào của nhóm này chạy. */
  evaluated: boolean;
  status: DimensionStatus;
  /** null khi chưa đánh giá. */
  score: number | null;
  /** marginRatio nhỏ nhất trong nhóm. */
  marginRatio: number | null;
  /** Luật đang kéo điểm nhóm xuống mức này. */
  drivingRules: string[];
  /** Luật FAIL trong nhóm. */
  blockers: string[];
};

export type FeasibilityStatus = 'NOT_FEASIBLE' | 'FEASIBLE_WITH_VALIDATION' | 'TECHNICALLY_FEASIBLE' | 'INSUFFICIENT_DATA';

export type Feasibility = {
  status: FeasibilityStatus;
  /** Điểm thấp nhất trong các nhóm đã đánh giá; null khi chưa nhóm nào. */
  overall: number | null;
  limitingFactors: FeasibilityDimension[];
  dimensions: DimensionScore[];
  /** Các luật FAIL — nguồn "điều kiện để chuyển thành khả thi" (spec §7.3). */
  blockers: RuleResult[];
};

const SEVERITY: Record<DimensionStatus, number> = { PASS: 0, MARGINAL: 1, UNKNOWN: 2, FAIL: 3 };
export const UNKNOWN_SCORE = 60;

/** Bảng spec §7.2 cho một kết quả luật. */
export function scoreResult(result: RuleResult): { status: DimensionStatus; score: number } {
  const ratio = result.marginRatio;
  const needsEvidence = result.evidence === 'requires-sample-test' || result.evidence === 'unknown';

  if (result.status === 'fail') {
    return { status: 'FAIL', score: ratio !== null && ratio >= 0.8 ? 45 : 20 };
  }
  if (needsEvidence) return { status: 'UNKNOWN', score: UNKNOWN_SCORE };
  if (result.status === 'warn') return { status: 'MARGINAL', score: 70 };
  if (ratio === null || ratio >= 1.5) return { status: 'PASS', score: 95 };
  if (ratio >= 1.2) return { status: 'PASS', score: 85 };
  if (ratio >= 1) return { status: 'MARGINAL', score: 70 };
  return { status: 'FAIL', score: ratio >= 0.8 ? 45 : 20 };
}

export function assessFeasibility(results: readonly RuleResult[]): Feasibility {
  const dimensions: DimensionScore[] = FEASIBILITY_DIMENSIONS.map((dimension) => {
    const own = results.filter((result) => result.dimension === dimension);
    if (own.length === 0) {
      return { dimension, evaluated: false, status: 'UNKNOWN', score: null, marginRatio: null, drivingRules: [], blockers: [] };
    }

    const scored = own.map((result) => ({ result, ...scoreResult(result) }));
    const score = Math.min(...scored.map((entry) => entry.score));
    const status = scored.reduce<DimensionStatus>(
      (worst, entry) => (SEVERITY[entry.status] > SEVERITY[worst] ? entry.status : worst),
      'PASS'
    );
    const ratios = own.map((result) => result.marginRatio).filter((ratio): ratio is number => ratio !== null);
    const unique = (ids: string[]) => [...new Set(ids)];

    return {
      dimension,
      evaluated: true,
      status,
      score,
      marginRatio: ratios.length > 0 ? Math.min(...ratios) : null,
      drivingRules: unique(scored.filter((entry) => entry.score === score).map((entry) => entry.result.ruleId)),
      blockers: unique(own.filter((result) => result.status === 'fail').map((result) => result.ruleId)),
    };
  });

  const evaluated = dimensions.filter((dimension) => dimension.evaluated);
  if (evaluated.length === 0) {
    return { status: 'INSUFFICIENT_DATA', overall: null, limitingFactors: [], dimensions, blockers: [] };
  }

  const overall = Math.min(...evaluated.map((dimension) => dimension.score!));
  const status: FeasibilityStatus = evaluated.some((dimension) => dimension.status === 'FAIL')
    ? 'NOT_FEASIBLE'
    : evaluated.some((dimension) => dimension.status !== 'PASS')
      ? 'FEASIBLE_WITH_VALIDATION'
      : 'TECHNICALLY_FEASIBLE';

  return {
    status,
    overall,
    limitingFactors: evaluated.filter((dimension) => dimension.score === overall).map((dimension) => dimension.dimension),
    dimensions,
    blockers: results.filter((result) => result.status === 'fail'),
  };
}
