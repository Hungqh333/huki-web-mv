import type { Check } from './types';

/**
 * Khung luật V1b — spec V1.1 §5.
 *
 * Mỗi phép kiểm của engine trả về một `RuleResult`: vẫn là `Check` (để giao
 * diện đang có vẽ lại được y nguyên), cộng thêm mã luật, nhóm khả thi, loại bằng
 * chứng, ô nào thật / ô nào giả định, và slug bài cẩm nang.
 *
 * Không có "confidence 0,82" gõ tay (spec §5.1): độ tin cậy nhìn thẳng vào danh
 * sách `inputsAssumed`, và chỉ số tổng hợp — nếu cần — là hàm của độ đầy đủ
 * input, tính bằng code (`completeness`).
 *
 * Logic luật nằm trong CODE, không trong bảng `selector_rules`: luật V1b là công
 * thức vật lý có nhiều bước, không diễn đạt được bằng condition_json. Tham số
 * PHÁN ĐOÁN (ngưỡng telecentric 100/200 mm, hệ số 1,3…) là hằng có tên, để ngỏ
 * việc đưa lên database + admin sau (xem TODO ở optics.ts).
 */

export const RULE_CATEGORIES = ['RES', 'OPT', 'LGT', 'THR', 'MEC', 'ENV', 'AI', 'INT'] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

/** Bảy nhóm khả thi (spec §7.2), theo thứ tự hiển thị. */
export const FEASIBILITY_DIMENSIONS = [
  'Resolution',
  'Optics',
  'Lighting',
  'Throughput',
  'Mechanical',
  'Algorithm',
  'Integration',
] as const;
export type FeasibilityDimension = (typeof FEASIBILITY_DIMENSIONS)[number];

/**
 * 'calculated' công thức vật lý · 'rule-of-thumb' kinh nghiệm ngành ·
 * 'requires-sample-test' không kết luận được nếu chưa chụp mẫu · 'unknown' thiếu
 * dữ liệu để kết luận.
 */
export type Evidence = 'calculated' | 'rule-of-thumb' | 'requires-sample-test' | 'unknown';

export type RuleInput = { path: string; value: unknown };
export type RuleAssumedInput = RuleInput & { assumptionId: string };

export type RuleResult = Check & {
  ruleId: string;
  ruleVersion: string;
  dimension: FeasibilityDimension;
  evidence: Evidence;
  inputsUsed: RuleInput[];
  inputsAssumed: RuleAssumedInput[];
  /** Khả dụng ÷ cần — > 1 là còn dư. null khi luật không so với một ngưỡng. */
  marginRatio: number | null;
  /** Slug bài cẩm nang (spec §12). Chưa có bài thì giao diện hiện "Chưa có tài liệu". */
  knowledgeRefs: string[];
};

export type RuleDefinition = {
  id: string;
  version: string;
  category: RuleCategory;
  dimension: FeasibilityDimension;
};

/**
 * Danh mục luật engine V1b đang chạy. ID là hợp đồng — không đổi sau khi phát
 * hành (spec §6). Luật cần thiết bị cụ thể (OPT-001..005, THR-003/004, INT) là
 * việc của V1c, chưa có ở đây.
 */
export const RULES: readonly RuleDefinition[] = [
  { id: 'RES-001', version: '1.0.0', category: 'RES', dimension: 'Resolution' },
  { id: 'RES-002', version: '1.0.0', category: 'RES', dimension: 'Resolution' },
  { id: 'RES-003', version: '1.0.0', category: 'RES', dimension: 'Resolution' },
  { id: 'RES-004', version: '1.0.0', category: 'RES', dimension: 'Resolution' },
  { id: 'RES-005', version: '1.0.0', category: 'RES', dimension: 'Resolution' },
  { id: 'RES-006', version: '1.0.0', category: 'RES', dimension: 'Resolution' },
  { id: 'OPT-006', version: '1.0.0', category: 'OPT', dimension: 'Optics' },
  { id: 'OPT-007', version: '1.0.0', category: 'OPT', dimension: 'Optics' },
  { id: 'OPT-008', version: '1.0.0', category: 'OPT', dimension: 'Optics' },
  { id: 'LGT-001', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-002', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-003', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-004', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-005', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-006', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-007', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'LGT-008', version: '1.0.0', category: 'LGT', dimension: 'Lighting' },
  { id: 'THR-001', version: '1.0.0', category: 'THR', dimension: 'Throughput' },
  { id: 'THR-002', version: '1.0.0', category: 'THR', dimension: 'Throughput' },
  { id: 'THR-005', version: '1.0.0', category: 'THR', dimension: 'Throughput' },
  { id: 'MEC-001', version: '1.0.0', category: 'MEC', dimension: 'Mechanical' },
  { id: 'MEC-002', version: '1.0.0', category: 'MEC', dimension: 'Mechanical' },
  { id: 'MEC-003', version: '1.0.0', category: 'MEC', dimension: 'Mechanical' },
  { id: 'ENV-001', version: '1.0.0', category: 'ENV', dimension: 'Mechanical' },
  { id: 'ENV-002', version: '1.0.0', category: 'ENV', dimension: 'Mechanical' },
  { id: 'AI-001', version: '1.0.0', category: 'AI', dimension: 'Algorithm' },
  { id: 'AI-002', version: '1.0.0', category: 'AI', dimension: 'Algorithm' },
];

const BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export function ruleDefinition(id: string): RuleDefinition {
  const rule = BY_ID.get(id);
  if (!rule) throw new Error(`Luật chưa khai trong RULES: ${id}`);
  return rule;
}

/** Slug bài cẩm nang loại ruleNote cho một luật — quy ước cố định, chưa cần bài viết. */
export const knowledgeSlugFor = (ruleId: string) => `rule-${ruleId.toLowerCase()}`;

/**
 * Bọc một `Check` thành `RuleResult`. `ratio` là cần ÷ khả dụng (quy ước của
 * các phép kiểm sai số: sai số ÷ ngân sách) — đảo lại thành marginRatio.
 */
export function toRuleResult(
  ruleId: string,
  check: Check,
  extra: {
    evidence: Evidence;
    inputsUsed?: RuleInput[];
    inputsAssumed?: RuleAssumedInput[];
    marginRatio?: number | null;
  }
): RuleResult {
  const rule = ruleDefinition(ruleId);
  return {
    ...check,
    ruleId,
    ruleVersion: rule.version,
    dimension: rule.dimension,
    evidence: extra.evidence,
    inputsUsed: extra.inputsUsed ?? [],
    inputsAssumed: extra.inputsAssumed ?? [],
    marginRatio: extra.marginRatio ?? null,
    knowledgeRefs: [knowledgeSlugFor(ruleId)],
  };
}

/**
 * Độ đầy đủ input = số ô thật ÷ (ô thật + ô giả định), spec §5.1. Tính bằng
 * code; không có input nào thì trả null chứ không phải 1.
 */
export function completeness(results: readonly RuleResult[]): number | null {
  const used = new Set<string>();
  const assumed = new Set<string>();
  for (const result of results) {
    for (const input of result.inputsUsed) used.add(input.path);
    for (const input of result.inputsAssumed) assumed.add(input.path);
  }
  for (const path of assumed) used.delete(path);
  const total = used.size + assumed.size;
  return total === 0 ? null : used.size / total;
}
