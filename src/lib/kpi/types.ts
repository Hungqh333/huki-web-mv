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
  /** Nới trần khi khách chưa có danh mục lỗi đóng / mẫu giới hạn / tiêu chuẩn còn chủ quan. */
  commercial_ceiling_unclear_spec: number;
  modifier_cap: number;
  level_up_threshold: number;
  recheck_exponent: number;
  no_recheck_miss_multiplier: number;
  minimize_scrap_false_reject_share: number;
  assist_model_auto_clear_share: number;
};

export const DEFAULT_KPI_CONFIG: KpiConfig = {
  commercial_ceiling: 8,
  commercial_ceiling_unclear_spec: 10,
  modifier_cap: 5,
  level_up_threshold: 3,
  // 1,0 chứ không phải 0,5 — xem ghi chú trong seed_kpi.sql. Vùng xám phình to
  // khi điều kiện xấu đi, không co lại; trần nhân lực được kiểm riêng bằng
  // computeRecheckFeasibility.
  recheck_exponent: 1,
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
  /**
   * Bắt ảo tuần đầu, ĐÃ nhân hệ số điều chỉnh.
   *
   * Trước đây điều khoản lấy thẳng giá trị gốc chưa nhân hệ số, nên khi có hệ
   * số lớn nó in ra con số NHỎ HƠN mức cam kết kèm câu "cao hơn mức cam kết" —
   * một điều khoản tự mâu thuẫn ngay trong cùng một trang.
   */
  falseRejectWeek1: Range;
  recheck: Range;
  totalBurden: number;
};

/**
 * Lý do KHÔNG được sinh điều khoản hợp đồng.
 *
 * Mỗi lý do tương ứng một trường hợp mà con số tính ra đúng về mặt kỹ thuật
 * nhưng không được phép biến thành cam kết pháp lý.
 */
export type ContractBlocker =
  | 'zero-miss'
  | 'special-kpi'
  | 'over-ceiling'
  | 'insufficient-samples';

export type BurdenSplit = {
  falseReject: number;
  recheck: number;
  miss: Range;
  /** true khi tổng tải phụ bị cắt xuống cho vừa trần. */
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

/**
 * Trần nhân lực của trạm tái kiểm.
 *
 * Đây mới là thứ thật sự giới hạn tái kiểm trong thực tế — không phải một quy
 * luật thống kê nào. Nếu phương án đang chọn cần nhiều người hơn số hiện có,
 * phần vượt buộc phải chuyển sang bắt ảo (tức là mất hàng tốt).
 */
export type RecheckFeasibility = {
  requiredHeadcount: number;
  availableHeadcount: number;
  isFeasible: boolean;
  /** Mức tái kiểm tối đa mà nhân lực hiện có gánh được (%). */
  maxFeasibleRecheck: number;
  /** Phần tải phụ buộc phải đẩy sang bắt ảo (%). */
  forcedToFalseReject: number;
};
