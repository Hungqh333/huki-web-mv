export type KpiProblemGroup = 'presence' | 'metrology' | 'code' | 'process' | 'cosmetic';
export type KpiDeepLearning = 'no' | 'sometimes' | 'often' | 'required';
export type KpiSpecial = 'robot_guidance' | 'code_reading' | 'web_inspection';
export type KpiDataSource = 'estimate' | 'project_history' | 'vendor_spec';
export type KpiModifierDirection = 'worse' | 'better';

/** Dải giá trị, đơn vị phần trăm. */
export type Range = { min: number; max: number };

export type ProblemType = {
  id: string;
  slug: string;
  problem_group: KpiProblemGroup;
  level: number;
  name_vi: string;
  name_en: string;
  miss_min: number;
  miss_max: number;
  false_reject_week1_min: number;
  false_reject_week1_max: number;
  false_reject_min: number;
  false_reject_max: number;
  recheck_min: number;
  recheck_max: number;
  total_burden_max: number;
  ramp_up_weeks_min: number;
  ramp_up_weeks_max: number;
  deep_learning: KpiDeepLearning;
  special_kpi: KpiSpecial | null;
  note_vi: string | null;
  note_en: string | null;
  data_source: KpiDataSource;
};

export type Modifier = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
  factor_min: number;
  factor_max: number;
  direction: KpiModifierDirection;
  data_source: KpiDataSource;
};

export type TighteningFactor = {
  miss_ratio: number;
  burden_k: number;
  label_vi: string;
  label_en: string;
};

/**
 * Hằng số mô hình, đọc từ bảng kpi_config.
 * Đây là ước lượng kinh nghiệm chứ không phải hằng số vật lý — vì vậy chúng
 * nằm trong database để đội kỹ thuật chỉnh được.
 */
export type KpiConfig = {
  commercial_ceiling: number;
  modifier_cap: number;
  level_up_threshold: number;
  recheck_exponent: number;
  no_recheck_miss_multiplier: number;
  minimize_scrap_false_reject_share: number;
  assist_model_auto_clear_share: number;
};

export const DEFAULT_KPI_CONFIG: KpiConfig = {
  commercial_ceiling: 8,
  modifier_cap: 5,
  level_up_threshold: 3,
  recheck_exponent: 0.5,
  no_recheck_miss_multiplier: 1.5,
  minimize_scrap_false_reject_share: 0.15,
  assist_model_auto_clear_share: 85,
};

export type BurdenStrategy = 'no-recheck' | 'minimize-scrap' | 'balanced' | 'custom';

export type ModifierResult = {
  factor: number;
  capped: boolean;
  shouldLevelUp: boolean;
};

export type AdjustedTargets = {
  miss: Range;
  falseReject: Range;
  recheck: Range;
  totalBurden: number;
};

export type BurdenSplit = {
  falseReject: number;
  recheck: number;
  miss: Range;
  /** true khi tổng tải phụ bị cắt xuống cho vừa trần. */
  clampedToCeiling: boolean;
};

export type OperationalCost = {
  headcount: number;
  annualScrapCost: number;
};

export type TighteningAlternative = 'per-defect-class' | 'zero-auto-pass' | 'two-stage';

export type TighteningScenario = {
  impossible: boolean;
  newMiss?: Range;
  newTotalBurden?: number;
  exceedsCeiling?: boolean;
  alternatives: TighteningAlternative[];
};

export type EscapeLadderRow = {
  pRange: string;
  pMin: number;
  pMax: number | null;
  escapeTarget: number;
  status: 'normal' | 'standard' | 'warning' | 'suspended';
};

export type SampleAdequacy = {
  provableMiss: number;
  requiredSamples: number;
  isAdequate: boolean;
};
