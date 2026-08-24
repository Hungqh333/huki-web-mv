import { matchesCondition } from './conditions';
import { deriveMetrics } from './derive';
import type {
  SelectorInput,
  SelectorResult,
  SelectorRule,
  SolutionApproach,
  SourcedNote,
} from './types';

/**
 * Mức độ "nặng" của hướng giải quyết. CLAUDE.md mục 4: luôn ưu tiên rule-based,
 * chỉ leo lên deep learning khi có luật nói rõ là rule-based không đáp ứng được.
 */
const APPROACH_WEIGHT: Record<SolutionApproach, number> = {
  rule_based: 0,
  hybrid: 1,
  deep_learning: 2,
};

function noteFrom(rule: SelectorRule): SourcedNote | null {
  const vi = rule.notes_vi?.trim();
  const en = rule.notes_en?.trim();
  if (!vi && !en) return null;
  return { ruleCode: rule.code, vi: vi ?? en ?? '', en: en ?? vi ?? '' };
}

/**
 * Chạy bảng luật đọc từ database trên bộ tham số người dùng nhập.
 *
 * Không có luật nào nằm trong file này — chỉ có cách GHÉP kết quả từ các luật
 * khớp. Muốn đổi gợi ý thì sửa bảng selector_rules, không sửa code.
 *
 * Cách ghép: luật priority nhỏ hơn thì thắng ở từng ô kết quả (camera, ánh
 * sáng, lens). Ghi chú thì gom từ TẤT CẢ luật khớp, vì mỗi luật cảnh báo một
 * rủi ro khác nhau và bỏ đi cái nào cũng tiếc.
 */
export function runSelector(rules: SelectorRule[], input: SelectorInput): SelectorResult {
  const { context, metrics } = deriveMetrics(input);

  const matched = rules
    .filter((rule) => rule.is_active)
    .filter((rule) => matchesCondition(rule.condition_json, context))
    .sort((a, b) => a.priority - b.priority);

  let camera: string | null = null;
  let lighting: string | null = null;
  let lens: string | null = null;
  let approach: SolutionApproach = 'rule_based';
  let approachReason: SourcedNote | null = null;
  const notes: SourcedNote[] = [];

  for (const rule of matched) {
    // Luật ưu tiên cao đã điền ô nào thì giữ nguyên ô đó.
    camera ??= rule.recommended_camera?.trim() || null;
    lighting ??= rule.recommended_lighting?.trim() || null;
    lens ??= rule.recommended_lens?.trim() || null;

    if (APPROACH_WEIGHT[rule.ai_or_rule_based] > APPROACH_WEIGHT[approach]) {
      approach = rule.ai_or_rule_based;
      approachReason = noteFrom(rule);
    }

    const note = noteFrom(rule);
    if (note && !notes.some((existing) => existing.vi === note.vi && existing.en === note.en)) {
      notes.push(note);
    }
  }

  return {
    camera,
    lighting,
    lens,
    approach,
    approachReason,
    notes,
    derived: metrics,
    matchedRuleCodes: matched.map((rule) => rule.code ?? rule.id),
    noRuleMatched: matched.length === 0,
  };
}
