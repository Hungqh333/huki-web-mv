/**
 * Ngưỡng PHÁN ĐOÁN của engine, sửa được qua admin — CLAUDE.md §9 ("toàn bộ bảng
 * luật phải sửa được qua admin UI, không hard-code"). Chốt 2026-10-12 (Q1).
 *
 * Chỉ mở các ngưỡng là lựa chọn của phòng kỹ thuật (mức phương án, trọng số xếp
 * hạng, trần telecentric, dư nhịp, thời gian xử lý giả định, ngưỡng cảnh báo).
 * KHÔNG mở hằng số vật lý / quy ước đo (λ, Gage R&R ÷10, subpixel 1/3, px/lỗi
 * 3/4/5) — xem ghi chú đầu requirement/defaults.ts: một cú nhập nhầm ở đó đổi kết
 * quả của mọi dự án mà không test nào bắt được.
 *
 * Giá trị mặc định = đúng các hằng số engine dùng trước đây; golden test luôn
 * chạy với DEFAULT_ENGINE_PARAMS. Hàm thuần: database đọc ở engineParamsLoad.ts.
 */

export const ENGINE_PARAM_GROUPS = ['levels', 'ranking', 'optics', 'throughput', 'budget'] as const;
export type EngineParamGroup = (typeof ENGINE_PARAM_GROUPS)[number];

export type EngineParamDef = {
  key: string;
  group: EngineParamGroup;
  default: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export const ENGINE_PARAMS = [
  // Ba mức phương án — cận dưới của hệ số dư độ phân giải (mm/px cần ÷ thực).
  { key: 'levelEconomyMin', group: 'levels', default: 1.1, min: 1, max: 2, step: 0.05, unit: '×' },
  { key: 'levelRecommendedMin', group: 'levels', default: 1.3, min: 1, max: 3, step: 0.05, unit: '×' },
  { key: 'levelHighMin', group: 'levels', default: 1.8, min: 1, max: 5, step: 0.05, unit: '×' },
  // Trọng số xếp hạng mềm (spec §8.2) — cộng lại bằng 1.
  { key: 'weightResolutionMargin', group: 'ranking', default: 0.25, min: 0, max: 1, step: 0.05 },
  { key: 'weightAvailability', group: 'ranking', default: 0.2, min: 0, max: 1, step: 0.05 },
  { key: 'weightPrice', group: 'ranking', default: 0.2, min: 0, max: 1, step: 0.05 },
  { key: 'weightPriorUse', group: 'ranking', default: 0.15, min: 0, max: 1, step: 0.05 },
  { key: 'weightLocalSupport', group: 'ranking', default: 0.1, min: 0, max: 1, step: 0.05 },
  { key: 'weightRoadmap', group: 'ranking', default: 0.1, min: 0, max: 1, step: 0.05 },
  // OPT-007 — cạnh vùng nhìn một camera: ≤ practical đạt, ≤ feasible rất đắt, hơn nữa không khả thi.
  { key: 'telecentricPracticalMaxMm', group: 'optics', default: 100, min: 10, max: 500, step: 5, unit: 'mm' },
  { key: 'telecentricFeasibleMaxMm', group: 'optics', default: 200, min: 20, max: 1000, step: 5, unit: 'mm' },
  // OPT-005 — F cần tới bao nhiêu lần F#max thì còn chấp nhận (mờ nhẹ, phải chụp thử).
  { key: 'dofDiffractionTolerance', group: 'optics', default: 1.5, min: 1, max: 3, step: 0.1, unit: '×' },
  // THR-003 — dư dưới tỉ lệ này của nhịp là mỏng; thời gian xử lý giả định khi chưa đo.
  { key: 'cycleMinMargin', group: 'throughput', default: 0.3, min: 0, max: 0.9, step: 0.05 },
  { key: 'processMs', group: 'throughput', default: 300, min: 10, max: 5000, step: 10, unit: 'ms' },
  { key: 'processDeepLearningMs', group: 'throughput', default: 800, min: 10, max: 10000, step: 10, unit: 'ms' },
  // OPT-008 / MEC-001 / MEC-003 — một nguồn sai số ăn quá tỉ lệ này của ngân sách đo U thì cảnh báo.
  { key: 'errorWarnShare', group: 'budget', default: 0.5, min: 0.1, max: 1, step: 0.05 },
] as const satisfies readonly EngineParamDef[];

export type EngineParamKey = (typeof ENGINE_PARAMS)[number]['key'];
export type EngineParams = Readonly<Record<EngineParamKey, number>>;

export const DEFAULT_ENGINE_PARAMS: EngineParams = Object.freeze(
  Object.fromEntries(ENGINE_PARAMS.map((p) => [p.key, p.default])) as Record<EngineParamKey, number>
);

const DEF = new Map<string, EngineParamDef>(ENGINE_PARAMS.map((p) => [p.key, p]));
export const isEngineParamKey = (key: string): key is EngineParamKey => DEF.has(key);

export type EngineParamError =
  | { key: EngineParamKey; code: 'outOfRange'; min: number; max: number }
  | { key: EngineParamKey; code: 'levelOrder' }
  | { key: EngineParamKey; code: 'telecentricOrder' }
  | { key: EngineParamKey; code: 'weightsSum'; sum: number };

const RANKING_KEYS = ENGINE_PARAMS.filter((p) => p.group === 'ranking').map((p) => p.key);

/** Kiểm một bộ tham số đầy đủ: từng giá trị trong [min, max] + ràng buộc chéo. */
export function validateEngineParams(params: EngineParams): EngineParamError[] {
  const errors: EngineParamError[] = [];
  for (const def of ENGINE_PARAMS) {
    const value = params[def.key];
    if (!Number.isFinite(value) || value < def.min || value > def.max) errors.push({ key: def.key, code: 'outOfRange', min: def.min, max: def.max });
  }
  if (!(params.levelEconomyMin < params.levelRecommendedMin)) errors.push({ key: 'levelRecommendedMin', code: 'levelOrder' });
  if (!(params.levelRecommendedMin < params.levelHighMin)) errors.push({ key: 'levelHighMin', code: 'levelOrder' });
  if (!(params.telecentricPracticalMaxMm < params.telecentricFeasibleMaxMm)) errors.push({ key: 'telecentricFeasibleMaxMm', code: 'telecentricOrder' });
  const sum = RANKING_KEYS.reduce((acc, key) => acc + params[key], 0);
  if (Math.abs(sum - 1) > 0.001) errors.push({ key: 'weightResolutionMargin', code: 'weightsSum', sum: Math.round(sum * 1000) / 1000 });
  return errors;
}

/**
 * Bộ tham số dùng thật từ các dòng database. Khoá lạ bị bỏ; giá trị ngoài [min, max]
 * hoặc bộ kết quả vi phạm ràng buộc chéo thì dùng MẶC ĐỊNH TOÀN BỘ — engine không
 * bao giờ chạy với một bộ tham số hỏng nửa vời.
 */
export function resolveEngineParams(rows: readonly { key: string; value: number | string }[]): { params: EngineParams; overridden: EngineParamKey[]; rejected: boolean } {
  const merged: Record<EngineParamKey, number> = { ...DEFAULT_ENGINE_PARAMS };
  const overridden: EngineParamKey[] = [];
  for (const row of rows) {
    if (!isEngineParamKey(row.key)) continue;
    const value = Number(row.value);
    if (value !== DEFAULT_ENGINE_PARAMS[row.key]) overridden.push(row.key);
    merged[row.key] = value;
  }
  if (validateEngineParams(merged).length > 0) return { params: DEFAULT_ENGINE_PARAMS, overridden: [], rejected: true };
  // Không sửa gì → đúng object mặc định (tham chiếu ổn định cho useMemo phía trình duyệt).
  if (overridden.length === 0) return { params: DEFAULT_ENGINE_PARAMS, overridden, rejected: false };
  return { params: Object.freeze(merged), overridden, rejected: false };
}

/** Ba mức phương án theo tham số. Cận trên = cận dưới của mức kế tiếp. */
export function solutionLevelsFor(params: EngineParams) {
  return [
    { key: 'economy', min: params.levelEconomyMin, max: params.levelRecommendedMin },
    { key: 'recommended', min: params.levelRecommendedMin, max: params.levelHighMin },
    { key: 'highPerformance', min: params.levelHighMin, max: Infinity },
  ] as const;
}

export function rankingWeightsFor(params: EngineParams) {
  return {
    resolutionMargin: params.weightResolutionMargin,
    availability: params.weightAvailability,
    price: params.weightPrice,
    priorProjectUse: params.weightPriorUse,
    localSupport: params.weightLocalSupport,
    roadmap: params.weightRoadmap,
  } as const;
}

/**
 * Phiên bản bộ luật gồm cả tham số: mặc định → đúng `base`; có tham số sửa → thêm
 * dấu vân tay ngắn của các giá trị đã sửa. Revision lưu chuỗi này, nên Concept Report
 * của revision cũ tự ghi "bộ luật đã đổi" khi admin sửa ngưỡng.
 */
export function rulesetVersionFor(base: string, params: EngineParams): string {
  const changed = ENGINE_PARAMS.filter((p) => params[p.key] !== p.default).map((p) => `${p.key}=${params[p.key]}`);
  if (changed.length === 0) return base;
  let hash = 2166136261;
  for (const ch of changed.join('|')) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `${base}+p${hash.toString(36)}`;
}

/**
 * Đọc form admin → bộ tham số đầy đủ + lỗi. Ô trống = giữ mặc định. Trả kèm danh sách
 * dòng cần ghi (khác mặc định) và khoá cần xoá (bằng mặc định) — bảng chỉ giữ giá trị đã sửa.
 */
export function parseEngineParamsForm(read: (key: EngineParamKey) => string | null): {
  params: EngineParams;
  errors: EngineParamError[] | null;
  invalidNumber: EngineParamKey[];
  upserts: { key: EngineParamKey; value: number }[];
  deletes: EngineParamKey[];
} {
  const values: Record<EngineParamKey, number> = { ...DEFAULT_ENGINE_PARAMS };
  const invalidNumber: EngineParamKey[] = [];
  for (const def of ENGINE_PARAMS) {
    const raw = (read(def.key) ?? '').trim().replace(',', '.');
    if (raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) invalidNumber.push(def.key);
    else values[def.key] = value;
  }
  const errors = invalidNumber.length > 0 ? null : validateEngineParams(values);
  const upserts = ENGINE_PARAMS.filter((p) => values[p.key] !== p.default).map((p) => ({ key: p.key, value: values[p.key] }));
  const deletes = ENGINE_PARAMS.filter((p) => values[p.key] === p.default).map((p) => p.key);
  return { params: values, errors, invalidNumber, upserts, deletes };
}
