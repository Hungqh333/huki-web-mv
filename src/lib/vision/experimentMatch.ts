import { rankSamples, type SampleLabels, type SampleMatch, type SampleQuery } from './sampleMatch';

/**
 * Khớp hạng mục của dự án thực nghiệm với bài toán người dùng nhập ở trang Chọn đèn (chốt 2026-10-24) —
 * cùng cách khớp như ảnh mẫu (sampleMatch.ts): trùng "cần thấy gì" trước, rồi theo số nhãn trùng;
 * không có thì cùng vật liệu + bề mặt. Kiểu đèn của hạng mục = phương án được chọn.
 * Không phải công thức thiết bị — chỉ đếm để hiện trên nút và huy hiệu.
 */

export const VERDICTS = ['pass', 'conditional', 'fail'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Phương án đại diện cho hạng mục: phương án được chọn đầu tiên; không đánh dấu thì phương án đầu. */
export function chosenTrial<T extends { is_chosen: boolean; sort_order: number; created_at: string }>(trials: readonly T[]): T | null {
  const sorted = [...trials].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  return sorted.find((t) => t.is_chosen) ?? sorted[0] ?? null;
}

/** Mọi hạng mục khớp (không cắt bớt) — dùng để đếm. */
export function rankExperimentItems<T extends SampleLabels>(items: readonly T[], q: SampleQuery): (T & { match: SampleMatch })[] {
  return rankSamples(items, q, Infinity);
}

/** Hạng mục "kiểm được" khi phương án được chọn Đạt hoặc Đạt có điều kiện (như "3/3 hạng mục" của báo cáo). */
export function isWorking(verdict: string | null): boolean {
  return verdict === 'pass' || verdict === 'conditional';
}

/**
 * Huy hiệu cạnh kiểu đèn gợi ý (Q5): đếm hạng mục TRÙNG "cần thấy gì" đã thử đúng kiểu đèn đó,
 * theo kết quả. Không đổi gợi ý của engine.
 */
export function verifiedCounts(
  items: readonly { match: SampleMatch; lightType: string; verdict: string | null }[],
  lightType: string
): { pass: number; conditional: number; fail: number } {
  const counts = { pass: 0, conditional: 0, fail: 0 };
  for (const item of items) {
    if (item.match.kind !== 'exact' || item.lightType !== lightType) continue;
    if (item.verdict === 'pass' || item.verdict === 'conditional' || item.verdict === 'fail') counts[item.verdict]++;
  }
  return counts;
}
