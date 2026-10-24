/**
 * Khớp ảnh mẫu chiếu sáng với bài toán người dùng nhập ở trang Chọn đèn (chốt 2026-10-23 Q2).
 * Không phải công thức thiết bị — chỉ xếp ảnh để người xem thấy ảnh giống bài toán nhất trước.
 *
 *   1. Ảnh TRÙNG "cần thấy gì" (cùng bài toán nếu ảnh có ghi bài toán) — xếp theo số nhãn trùng
 *      trong vật liệu, bề mặt, hình dạng, kiểu đèn (đèn gợi ý / thay thế); ghi "khớp k/n".
 *   2. Không có ảnh trùng: ảnh CÙNG vật liệu và bề mặt — "ảnh tham khảo chung".
 */

export type SampleLabels = {
  task: string | null;
  feature: string | null;
  material: string | null;
  finish: string | null;
  shape: string | null;
  lightType: string;
};

export type SampleQuery = {
  task: string | null;
  feature: string | null;
  material: string | null;
  finish: string | null;
  shape: string | null;
  /** Đèn gợi ý trước, đèn thay thế sau. */
  lightTypes: string[];
};

export type SampleMatch = { kind: 'exact' | 'general'; score: number; total: number };

/** Ảnh tối đa hiện một lần. */
export const SAMPLE_LIMIT = 9;

function labelScore(s: SampleLabels, q: SampleQuery): { score: number; total: number } {
  let score = 0;
  let total = 0;
  for (const key of ['material', 'finish', 'shape'] as const) {
    if (q[key] === null) continue;
    total++;
    if (s[key] === q[key]) score++;
  }
  if (q.lightTypes.length > 0) {
    total++;
    if (q.lightTypes.includes(s.lightType)) score++;
  }
  return { score, total };
}

export function matchSample(s: SampleLabels, q: SampleQuery): SampleMatch | null {
  if (q.feature && s.feature === q.feature && (s.task === null || q.task === null || s.task === q.task)) {
    const { score, total } = labelScore(s, q);
    return { kind: 'exact', score: score + 1, total: total + 1 };
  }
  if (q.material && q.finish && s.material === q.material && s.finish === q.finish) {
    const { score, total } = labelScore(s, q);
    return { kind: 'general', score, total };
  }
  return null;
}

/** Ảnh khớp, xếp: trùng "cần thấy gì" trước → tỉ lệ nhãn trùng → đèn gợi ý trước đèn thay thế. */
export function rankSamples<T extends SampleLabels>(samples: readonly T[], q: SampleQuery, limit = SAMPLE_LIMIT): (T & { match: SampleMatch })[] {
  const lightOrder = (t: string) => (q.lightTypes.includes(t) ? q.lightTypes.indexOf(t) : q.lightTypes.length);
  const matched = samples.flatMap((s) => {
    const match = matchSample(s, q);
    return match ? [{ ...s, match }] : [];
  });
  const exact = matched.filter((s) => s.match.kind === 'exact');
  // Có ảnh trùng "cần thấy gì" thì chỉ hiện nhóm đó; không có mới lấy ảnh tham khảo chung.
  const pool = exact.length > 0 ? exact : matched;
  return pool
    .sort(
      (a, b) =>
        b.match.score / b.match.total - a.match.score / a.match.total ||
        b.match.score - a.match.score ||
        lightOrder(a.lightType) - lightOrder(b.lightType)
    )
    .slice(0, limit);
}
