export type SolutionApproach = 'rule_based' | 'deep_learning' | 'hybrid';

/** Giá trị một trường nhập liệu có thể nhận. */
export type InputValue = number | string | boolean | string[] | null;

/** Dữ liệu người dùng nhập, đã chuẩn hoá theo catalog trường. */
export type SelectorInput = Record<string, InputValue>;

/**
 * Ngữ cảnh mà luật được đánh giá trên đó: dữ liệu người dùng nhập cộng thêm các
 * đại lượng do engine tính ra (xem derive.ts). Nhờ vậy luật trong database viết
 * được điều kiện theo cả tham số đầu vào lẫn kết quả tính toán.
 */
export type EvalContext = Record<string, InputValue>;

export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'nin'
  | 'exists';

export type ConditionPredicate = {
  field: string;
  op: ConditionOperator;
  value?: unknown;
};

export type RuleCondition = {
  all?: ConditionPredicate[];
};

export type SelectorRule = {
  id: string;
  code: string | null;
  task_type_id: string;
  condition_json: RuleCondition | null;
  recommended_camera: string | null;
  recommended_lighting: string | null;
  recommended_lens: string | null;
  recommended_processing: string | null;
  recommended_accessories: string | null;
  ai_or_rule_based: SolutionApproach;
  notes_vi: string | null;
  notes_en: string | null;
  priority: number;
  is_active: boolean;
};

/** Một dòng ghi chú kèm nguồn gốc, để người dùng truy được luật nào sinh ra nó. */
export type SourcedNote = {
  ruleCode: string | null;
  vi: string;
  en: string;
};

export type DerivedMetric = {
  key: string;
  value: number;
  /** Công thức đã thay số, để hiển thị cho kỹ sư kiểm chứng. */
  formula: string;
};

/**
 * Giá trị engine TỰ ĐIỀN khi đầu vào thiếu, luôn phải hiện cho người dùng.
 * TODO(V1b): thay bằng assumptionId trong Field<T> (spec §3.2).
 */
export type DerivedAssumption = {
  /** Trường đầu vào bị thiếu, vd. 'fov_height_mm'. */
  key: string;
  value: number;
  unit: string;
  /** Tỉ lệ dùng để suy ra, vd. '4:3'. */
  ratio: string;
  vi: string;
  en: string;
};

export type SelectorResult = {
  camera: string | null;
  lighting: string | null;
  lens: string | null;
  processing: string | null;
  accessories: string | null;
  approach: SolutionApproach;
  /** Ghi chú của chính luật đã quyết định approach — chính là "lý do". */
  approachReason: SourcedNote | null;
  notes: SourcedNote[];
  derived: DerivedMetric[];
  /** Không bắt buộc: bản ghi selector_history cũ lưu trước khi có trường này. */
  assumptions?: DerivedAssumption[];
  matchedRuleCodes: string[];
  /** true khi không luật nào khớp — cần báo cho người dùng, không im lặng. */
  noRuleMatched: boolean;
};
