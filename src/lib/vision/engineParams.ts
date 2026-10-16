/**
 * Ngưỡng PHÁN ĐOÁN của engine, sửa được qua admin — CLAUDE.md §9 ("toàn bộ bảng
 * luật phải sửa được qua admin UI, không hard-code"). Chốt 2026-10-12 (Q1).
 *
 * Mở các ngưỡng là lựa chọn của phòng kỹ thuật (mức phương án, trọng số xếp
 * hạng, trần telecentric, dư nhịp, thời gian xử lý giả định, ngưỡng cảnh báo,
 * ngưỡng thiết bị). 2026-10-16 Hưng chốt mở thêm px/lỗi 3/4/5, α vật liệu và
 * băng thông giao tiếp (nhóm SENSITIVE_GROUPS — trang admin cảnh báo đỏ: sửa nhầm
 * đổi kết quả mọi dự án). Vẫn KHÔNG mở λ, Gage R&R ÷10, subpixel 1/3.
 *
 * Giá trị mặc định = đúng các hằng số engine dùng trước đây; golden test luôn
 * chạy với DEFAULT_ENGINE_PARAMS. Hàm thuần: database đọc ở engineParamsLoad.ts.
 */

import { DEFAULT_ENGINE_TABLES, engineTablesFingerprint, type EngineTables } from './engineTables';

export const ENGINE_PARAM_GROUPS = ['levels', 'ranking', 'optics', 'throughput', 'budget', 'equipment', 'detection', 'materials', 'interfaces'] as const;
export type EngineParamGroup = (typeof ENGINE_PARAM_GROUPS)[number];
/** Nhóm là hằng số vật lý / quy ước đo / thông số chuẩn — mở theo chốt 2026-10-16, trang admin cảnh báo đỏ. */
export const SENSITIVE_GROUPS: readonly EngineParamGroup[] = ['detection', 'materials', 'interfaces'];

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
  // Ngưỡng thiết bị (2026-10-16, mục 3).
  { key: 'ipcRamMinGb', group: 'equipment', default: 16, min: 4, max: 512, step: 1, unit: 'GB' },
  { key: 'ipcBufferDepth', group: 'equipment', default: 10, min: 1, max: 100, step: 1 },
  { key: 'highTempCameraMinC', group: 'equipment', default: 50, min: 30, max: 100, step: 1, unit: '°C' },
  { key: 'interfaceMaxShare', group: 'equipment', default: 0.7, min: 0.3, max: 1, step: 0.05 },
  { key: 'tileOverlapRatio', group: 'equipment', default: 0.1, min: 0, max: 0.5, step: 0.01 },
  { key: 'tileOverlapMinPx', group: 'equipment', default: 20, min: 0, max: 500, step: 1, unit: 'px' },
  { key: 'imageCircleTolerance', group: 'equipment', default: 0.02, min: 0, max: 0.2, step: 0.01 },
  { key: 'telecentricFrontDiameterFactor', group: 'equipment', default: 1.3, min: 1, max: 3, step: 0.05, unit: '×' },
  // RES-001 — số pixel phủ lên lỗi theo độ tương phản (chưa rõ = thấp). Phải tăng dần cao → thấp.
  { key: 'pxPerDefectHigh', group: 'detection', default: 3, min: 1, max: 20, step: 0.5, unit: 'px' },
  { key: 'pxPerDefectMedium', group: 'detection', default: 4, min: 1, max: 20, step: 0.5, unit: 'px' },
  { key: 'pxPerDefectLow', group: 'detection', default: 5, min: 1, max: 20, step: 0.5, unit: 'px' },
  // MEC-001 — α suy từ vật liệu, µm/(m·K).
  { key: 'alphaAluminium', group: 'materials', default: 23, min: 1, max: 300, step: 0.5, unit: 'µm/(m·K)' },
  { key: 'alphaSteel', group: 'materials', default: 12, min: 1, max: 300, step: 0.5, unit: 'µm/(m·K)' },
  { key: 'alphaStainless', group: 'materials', default: 17, min: 1, max: 300, step: 0.5, unit: 'µm/(m·K)' },
  { key: 'alphaPlastic', group: 'materials', default: 120, min: 1, max: 300, step: 0.5, unit: 'µm/(m·K)' },
  // THR-001/002 — băng thông thực dụng từng chuẩn giao tiếp, MB/s (components/specs.ts INTERFACE_BANDWIDTH).
  { key: 'bwGigE', group: 'interfaces', default: 110, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwUsbThree', group: 'interfaces', default: 350, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwFiveGigE', group: 'interfaces', default: 550, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwTenGigE', group: 'interfaces', default: 1100, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwCxpSix', group: 'interfaces', default: 600, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwCxpTwelve', group: 'interfaces', default: 1200, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwCameraLinkBase', group: 'interfaces', default: 255, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwCameraLinkMedium', group: 'interfaces', default: 510, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwCameraLinkFull', group: 'interfaces', default: 680, min: 1, max: 20000, step: 1, unit: 'MB/s' },
  { key: 'bwCameraLinkDeca', group: 'interfaces', default: 850, min: 1, max: 20000, step: 1, unit: 'MB/s' },
] as const satisfies readonly EngineParamDef[];

/** Khoá chuẩn giao tiếp (INTERFACE_BANDWIDTH) → khoá ngưỡng. Khoá database chỉ nhận chữ cái. */
export const BANDWIDTH_PARAM_KEYS = {
  GigE: 'bwGigE',
  USB3: 'bwUsbThree',
  '5GigE': 'bwFiveGigE',
  '10GigE': 'bwTenGigE',
  'CXP-6': 'bwCxpSix',
  'CXP-12': 'bwCxpTwelve',
  'CameraLink-Base': 'bwCameraLinkBase',
  'CameraLink-Medium': 'bwCameraLinkMedium',
  'CameraLink-Full': 'bwCameraLinkFull',
  'CameraLink-Deca': 'bwCameraLinkDeca',
} as const;

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
  | { key: EngineParamKey; code: 'weightsSum'; sum: number }
  | { key: EngineParamKey; code: 'pxOrder' };

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
  if (!(params.pxPerDefectHigh <= params.pxPerDefectMedium)) errors.push({ key: 'pxPerDefectMedium', code: 'pxOrder' });
  if (!(params.pxPerDefectMedium <= params.pxPerDefectLow)) errors.push({ key: 'pxPerDefectLow', code: 'pxOrder' });
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

/** RES-001: px/lỗi theo độ tương phản; 'unknown' lấy như 'low' (phía xấu). */
export function pxPerDefectFor(params: EngineParams) {
  return { high: params.pxPerDefectHigh, medium: params.pxPerDefectMedium, low: params.pxPerDefectLow, unknown: params.pxPerDefectLow } as const;
}

/** MEC-001: α điển hình theo vật liệu đã biết. */
export function materialAlphaFor(params: EngineParams) {
  return { aluminium: params.alphaAluminium, steel: params.alphaSteel, stainless: params.alphaStainless, plastic: params.alphaPlastic } as const;
}

/** Bảng băng thông (MB/s) theo tên chuẩn — cùng khoá với INTERFACE_BANDWIDTH. */
export function interfaceBandwidthFor(params: EngineParams): Readonly<Record<string, number>> {
  return Object.fromEntries(Object.entries(BANDWIDTH_PARAM_KEYS).map(([name, key]) => [name, params[key]]));
}

/**
 * Phiên bản bộ luật gồm cả tham số: mặc định → đúng `base`; có tham số sửa → thêm
 * dấu vân tay ngắn của các giá trị đã sửa. Revision lưu chuỗi này, nên Concept Report
 * của revision cũ tự ghi "bộ luật đã đổi" khi admin sửa ngưỡng.
 */
export function rulesetVersionFor(base: string, params: EngineParams, tables: EngineTables = DEFAULT_ENGINE_TABLES): string {
  const changed = ENGINE_PARAMS.filter((p) => params[p.key] !== p.default).map((p) => `${p.key}=${params[p.key]}`);
  let version = base;
  if (changed.length > 0) {
    let hash = 2166136261;
    for (const ch of changed.join('|')) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
    version += `+p${hash.toString(36)}`;
  }
  // Bảng chiếu sáng / giả định mặc định đã sửa (engineTables, 2026-10-16).
  const tablePrint = engineTablesFingerprint(tables);
  return tablePrint ? `${version}+t${tablePrint}` : version;
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
