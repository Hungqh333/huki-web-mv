import type { Component } from '@/lib/components/specs';
import { cameraFromComponent, evaluateConfiguration, pcFromComponent } from './configurationRules';
import { interfaceCardsFor, type Candidate, type CameraCandidate, type EquipmentFilter } from './equipmentFilter';
import { scoreResult } from './feasibility';
import type { RequirementAnalysis } from './requirementAnalysis';
import type { RuleResult } from './rules';

/**
 * Xếp hạng mềm + ba mức giải pháp — V1c mục C4 (spec V1.1 §8.2, §8.3; UI_CONTENT màn 5).
 *
 * Chạy SAU lọc cứng (equipmentFilter.ts): chỉ xếp hạng thứ đã đạt, không bao giờ
 * cho điểm thiết bị vi phạm ràng buộc.
 *
 * Chốt 2026-09-18 (Q1–Q6 khi mở C4):
 * - Ba mức chia theo KHOẢNG dư độ phân giải (mm/px cần ÷ mm/px thực, OPT-001):
 *   Tiết kiệm 1,1–1,3 · Đề xuất 1,3–1,8 · Hiệu năng cao ≥ 1,8. Trong khoảng lấy
 *   cặp camera + ống điểm cao nhất; khoảng rỗng thì nói rỗng, không bịa.
 * - Tiết kiệm bị chặn khi cấu hình có FAIL/MARGINAL hoặc bảng Yêu cầu có FAIL.
 * - Điểm 0–1 từng tiêu chí, trọng số §8.2 là hằng trong code, hiện kèm chi tiết.
 * - Đèn: một đèn điểm cao nhất cho cả ba mức. Máy tính: tính lại theo camera
 *   của từng mức. Phần mềm: C5.
 * - Chi phí: giá × số lượng; thiếu giá món nào thì không cộng tổng.
 */

export const SOLUTION_LEVELS = [
  { key: 'economy', min: 1.1, max: 1.3 },
  { key: 'recommended', min: 1.3, max: 1.8 },
  { key: 'highPerformance', min: 1.8, max: Infinity },
] as const;
export type SolutionLevelKey = (typeof SOLUTION_LEVELS)[number]['key'];

/** Spec §8.2. Sửa qua admin để sau (chốt Q4). */
export const RANKING_WEIGHTS = {
  resolutionMargin: 0.25,
  availability: 0.2,
  price: 0.2,
  priorProjectUse: 0.15,
  localSupport: 0.1,
  roadmap: 0.1,
} as const;
export type RankingCriterion = keyof typeof RANKING_WEIGHTS;

/** Dư độ phân giải đạt điểm tối đa ở mức này. */
export const MARGIN_FULL_SCORE = 2;
/** Giao hàng lâu từ mức này trở lên = 0 điểm. */
export const LEAD_TIME_ZERO_DAYS = 60;
/** Đã dùng ở chừng này dự án trở lên = điểm tối đa. */
export const PRIOR_USE_FULL = 3;

export type ScorePart = {
  criterion: RankingCriterion;
  weight: number;
  /** 0–1. */
  value: number;
  /** false = chưa có dữ liệu, tính 0 (hiện rõ trên giao diện). */
  hasData: boolean;
};

export type SoftScore = { total: number; parts: ScorePart[] };

export type CostLine = { component: Component; qty: number; unitPrice: number | null };
export type Cost = { lines: CostLine[]; total: number | null; missingPrices: number };

export type SolutionLevel = {
  key: SolutionLevelKey;
  min: number;
  max: number;
  /** ok = có cấu hình · blocked = Tiết kiệm bị chặn · empty = kho không có cặp nào trong khoảng. */
  status: 'ok' | 'blocked' | 'empty';
  camera: CameraCandidate | null;
  lens: Candidate | null;
  light: Candidate | null;
  pc: Candidate | null;
  margin: number | null;
  /** mm/px thực của cặp đã chọn. */
  mmPerPx: number | null;
  score: SoftScore | null;
  cost: Cost | null;
  /** FAIL/MARGINAL/chưa kiểm được của cấu hình + FAIL của bảng Yêu cầu. */
  risks: RuleResult[];
  /** Lý do chặn (chỉ mức Tiết kiệm). */
  blockReasons: RuleResult[];
};

export type Solutions = {
  levels: SolutionLevel[];
  /** FAIL ở bảng Yêu cầu — áp cho mọi mức. */
  requirementBlockers: RuleResult[];
  /** Số cặp đạt nhưng chưa tính được dư độ phân giải (thiếu tiêu cự / pitch) — không vào mức nào. */
  unplacedPairs: number;
};

type Sourcing = { price: number | null; leadTime: number | null; used: number };

const sourcing = (components: Component[]): Sourcing => ({
  price: components.every((c) => c.price_vnd != null) ? components.reduce((sum, c) => sum + Number(c.price_vnd), 0) : null,
  leadTime: components.every((c) => c.lead_time_days != null) ? Math.max(...components.map((c) => c.lead_time_days!)) : null,
  // Cặp chỉ "đã dùng" bằng món ít kinh nghiệm hơn.
  used: Math.min(...components.map((c) => c.used_in_projects ?? 0)),
});

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Điểm mềm cho một nhóm ứng viên cùng loại. Giá chuẩn hoá TRONG nhóm (rẻ nhất 1,
 * đắt nhất 0), nên phải tính cả nhóm một lượt.
 */
export function softScores(items: { sourcing: Sourcing; margin: number | null }[]): SoftScore[] {
  const prices = items.map((i) => i.sourcing.price).filter((p): p is number => p !== null);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return items.map(({ sourcing: s, margin }) => {
    const parts: ScorePart[] = [
      {
        criterion: 'resolutionMargin',
        weight: RANKING_WEIGHTS.resolutionMargin,
        value: margin === null ? 0 : clamp01((margin - 1) / (MARGIN_FULL_SCORE - 1)),
        hasData: margin !== null,
      },
      {
        criterion: 'availability',
        weight: RANKING_WEIGHTS.availability,
        value: s.leadTime === null ? 0 : clamp01(1 - s.leadTime / LEAD_TIME_ZERO_DAYS),
        hasData: s.leadTime !== null,
      },
      {
        criterion: 'price',
        weight: RANKING_WEIGHTS.price,
        value: s.price === null ? 0 : max === min ? 1 : (max - s.price) / (max - min),
        hasData: s.price !== null,
      },
      {
        criterion: 'priorProjectUse',
        weight: RANKING_WEIGHTS.priorProjectUse,
        value: clamp01(s.used / PRIOR_USE_FULL),
        hasData: true,
      },
      { criterion: 'localSupport', weight: RANKING_WEIGHTS.localSupport, value: 0, hasData: false },
      { criterion: 'roadmap', weight: RANKING_WEIGHTS.roadmap, value: 0, hasData: false },
    ];
    return { total: Math.round(parts.reduce((sum, p) => sum + p.weight * p.value, 0) * 100), parts };
  });
}

/** Ứng viên điểm cao nhất; hoà thì giữ thứ tự catalog. */
function best<T>(items: T[], scores: SoftScore[]): { item: T; score: SoftScore } | null {
  let pick: { item: T; score: SoftScore } | null = null;
  items.forEach((item, index) => {
    if (!pick || scores[index].total > pick.score.total) pick = { item, score: scores[index] };
  });
  return pick;
}

/**
 * Rủi ro của một cấu hình: FAIL / MARGINAL theo bảng điểm spec §7.2.
 *
 * Trừ OPT-001 ĐẠT: hệ số dư của nó (mm/px cần ÷ thực) chính là thứ xếp cặp vào
 * mức. Bảng điểm coi dư 1,0–1,2 là MARGINAL, nên mọi cặp Tiết kiệm (1,1–1,3) dư
 * dưới 1,2 từng tự chặn chính nó — màn hình hiện "KHÔNG KHẢ DỤNG — OPT-001 Đạt".
 * Phát hiện khi chạy thử C9 (S-11), chốt sửa 2026-09-18. OPT-001 KHÔNG ĐẠT vẫn là rủi ro.
 */
const isMarginalOrFail = (result: RuleResult) => {
  if (result.ruleId === 'OPT-001' && result.status === 'pass') return false;
  const status = scoreResult(result).status;
  return status === 'FAIL' || status === 'MARGINAL';
};

export function buildSolutionLevels(analysis: RequirementAnalysis, filter: EquipmentFilter, catalog: readonly Component[]): Solutions {
  const requirementBlockers = analysis.results.filter((r) => r.status === 'fail');
  const n = Math.max(1, analysis.cameraCount ?? 1);

  // Mọi cặp camera + ống đã qua lọc cứng.
  const pairs = filter.cameras.accepted.flatMap((camera) =>
    camera.lenses.accepted.map((lens) => {
      const fit = lens.results.find((r) => r.ruleId === 'OPT-001');
      const margin = fit?.status === 'pass' ? fit.marginRatio : null;
      return { camera, lens, margin, sourcing: sourcing([camera.component, lens.component]) };
    })
  );
  const placed = pairs.filter((p) => p.margin !== null);
  const pairScores = softScores(placed);

  // Đèn: một đèn cho cả ba mức (chốt Q5).
  const lights = filter.lights.accepted;
  const light = best(lights, softScores(lights.map((l) => ({ sourcing: sourcing([l.component]), margin: null }))))?.item ?? null;

  const controllers = catalog.filter((c) => c.is_active && c.kind === 'controller');

  const levels = SOLUTION_LEVELS.map((level): SolutionLevel => {
    const inRange = placed.map((p, i) => ({ p, score: pairScores[i] })).filter(({ p }) => p.margin! >= level.min && p.margin! < level.max);
    const empty: SolutionLevel = {
      ...level,
      status: 'empty',
      camera: null,
      lens: null,
      light,
      pc: null,
      margin: null,
      mmPerPx: null,
      score: null,
      cost: null,
      risks: [],
      blockReasons: [],
    };
    if (inRange.length === 0) return empty;

    const chosen = inRange.reduce((a, b) => (b.score.total > a.score.total ? b : a));
    const { camera, lens, margin } = chosen.p;

    // Máy tính theo camera của mức này (chốt Q5).
    const config = cameraFromComponent(camera.component);
    const pcCandidates = controllers.map((component) => {
      const results = evaluateConfiguration({
        analysis,
        camera: config,
        pc: pcFromComponent(component),
        interfaceCards: interfaceCardsFor(config.interfaceName, n),
      }).filter((r) => r.ruleId === 'THR-004');
      return {
        component,
        results,
        reasons: results.filter((r) => r.status === 'fail'),
        warnings: results.filter((r) => r.status === 'warn'),
        unchecked: results.filter((r) => r.evidence === 'unknown'),
        unverified: component.source === 'unverified',
      } satisfies Candidate;
    });
    const okPcs = pcCandidates.filter((c) => c.reasons.length === 0);
    const pc = best(okPcs, softScores(okPcs.map((c) => ({ sourcing: sourcing([c.component]), margin: null }))))?.item ?? null;

    const configResults = [...camera.results, ...lens.results, ...(pc?.results ?? [])];
    const risks = [...configResults.filter((r) => isMarginalOrFail(r) || r.evidence === 'unknown'), ...requirementBlockers];

    const lines: CostLine[] = [
      { component: camera.component, qty: n, unitPrice: camera.component.price_vnd },
      { component: lens.component, qty: n, unitPrice: lens.component.price_vnd },
      ...(light ? [{ component: light.component, qty: n, unitPrice: light.component.price_vnd }] : []),
      ...(pc ? [{ component: pc.component, qty: 1, unitPrice: pc.component.price_vnd }] : []),
    ];
    const missingPrices = lines.filter((l) => l.unitPrice == null).length;
    const cost: Cost = {
      lines,
      missingPrices,
      total: missingPrices === 0 ? lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.qty, 0) : null,
    };

    // OPT-001 so với mục tiêu = mm/px cần × cos θ (camera nghiêng) → mm/px thực = mục tiêu ÷ dư.
    const tiltCos = analysis.cameraTiltDeg ? Math.cos((analysis.cameraTiltDeg * Math.PI) / 180) : 1;
    const mmPerPx = analysis.governingMmPerPx !== null && margin ? (analysis.governingMmPerPx * tiltCos) / margin : null;

    const result: SolutionLevel = {
      ...level,
      status: 'ok',
      camera,
      lens,
      light,
      pc,
      margin,
      mmPerPx,
      score: chosen.score,
      cost,
      risks,
      blockReasons: [],
    };

    // Tiết kiệm: chặn khi có FAIL/MARGINAL — hiện lý do thay vì phương án rủi ro (spec §8.3).
    if (level.key === 'economy') {
      const blockReasons = [...configResults.filter(isMarginalOrFail), ...requirementBlockers];
      if (blockReasons.length > 0) return { ...empty, status: 'blocked', blockReasons };
    }
    return result;
  });

  return { levels, requirementBlockers, unplacedPairs: pairs.length - placed.length };
}
