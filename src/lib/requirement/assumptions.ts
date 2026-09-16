/**
 * Panel Assumptions — spec V1.1 §10.3 "Luôn có panel Assumptions" (V1a hạng mục 6).
 *
 * Gom MỌI giả định về một kiểu `Assumption`, dù nó đến từ đâu:
 * - 'default'   : ô còn trống, lấy giá trị mặc định (defaults.ts)
 * - 'adapter'   : phép chuyển requirement → form bộ chọn cũ phải xấp xỉ
 * - 'parameter' : tham số tính cố định trong code (px/lỗi, GRR, k_subpixel)
 *
 * Áp lúc HIỂN THỊ, không ghi vào bản nháp: bản nháp chỉ chứa giá trị người dùng
 * nhập. Mọi hàm ở đây thuần, cùng input luôn cho cùng output.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import { DEFAULT_PX_PER_DEFECT, GRR_DIVISOR, K_SUBPIXEL } from '../vision/resolution';
import { FIELD_DEFAULTS, MATERIAL_ALPHA, N_DET_BY_CONTRAST, type KnownMaterial } from './defaults';
import { fieldsFor, readField } from './fields';
import { requirementToSelectorInput } from './toSelectorInput';
import type { Assumption, DefectContrast, Requirement } from './types';

export const defaultAssumptionKey = (path: string) => `default:${path}`;
export const derivedAssumptionKey = (path: string) => `derived:${path}`;

const ALPHA_PATH = 'object.thermalExpansionCoeff';
const SPAN_PATH = 'measurement.0.spanLength';
const SEAM_PATH = 'measurement.0.crossesCameraSeam';

function isKnownMaterial(value: unknown): value is KnownMaterial {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MATERIAL_ALPHA, value);
}

/**
 * Điền những ô còn trống của bảng tóm tắt. Trả requirement MỚI, không sửa
 * object cũ. Thứ tự: suy từ ô khác ('inferred') trước, mặc định ('assumed') sau.
 * Ô chưa hỏi và ô "Chưa rõ" (value null) đều được điền.
 *
 * Chỉ điền ô đang hiện trên bảng của loại ứng dụng này — giả định nào cũng phải
 * thay được bằng số thật ngay trong bảng.
 */
export function applyDefaults(requirement: Requirement): { requirement: Requirement; assumptions: Assumption[] } {
  const shown = new Set(fieldsFor(requirement.applicationType).map((def) => def.path));
  const next = structuredClone(requirement);
  const assumptions: Assumption[] = [];

  // α suy từ vật liệu đi TRƯỚC mặc định: đã biết vật liệu thì không lấy "nhôm".
  const alpha = readField(next, ALPHA_PATH);
  const material = readField(next, 'object.material')?.value;
  if (shown.has(ALPHA_PATH) && alpha && alpha.value === null && isKnownMaterial(material)) {
    const typical = MATERIAL_ALPHA[material];
    const key = derivedAssumptionKey(ALPHA_PATH);
    alpha.value = typical.alpha;
    alpha.confidence = 'inferred';
    alpha.assumptionId = key;
    assumptions.push({
      key,
      source: 'derived',
      level: typical.level,
      ruleIds: ['MEC-001'],
      path: ALPHA_PATH,
      value: typical.alpha,
      unit: 'µm/(m·K)',
      vi: typical.basis.vi,
      en: typical.basis.en,
    });
  }

  /* Chiều dài cần đo chưa có → cạnh dài nhất của vật (chốt 2026-09-16, MEC-001).
     Lấy phía xấu: kích thước đo không thể dài hơn vật. Chỉ khi bài có dung sai
     đo — không đo thì chiều dài này không dùng vào đâu, giả định chỉ gây nhiễu. */
  const span = readField(next, SPAN_PATH);
  const hasTolerance = next.measurement.some((item) => item.tolerance.value !== null);
  const sides = [readField(next, 'object.sizeX')?.value, readField(next, 'object.sizeY')?.value].filter(
    (side): side is number => typeof side === 'number' && side > 0
  );
  if (shown.has(SPAN_PATH) && span && span.value === null && hasTolerance && sides.length > 0) {
    const longest = Math.max(...sides);
    const key = derivedAssumptionKey(SPAN_PATH);
    span.value = longest;
    span.confidence = 'inferred';
    span.assumptionId = key;
    assumptions.push({
      key,
      source: 'derived',
      level: 'warning',
      ruleIds: ['MEC-001'],
      path: SPAN_PATH,
      value: longest,
      unit: 'mm',
      vi: 'Chưa có chiều dài kích thước cần đo — tạm lấy cạnh dài nhất của vật (phía xấu). Nhập chiều dài thật để tính đúng sai số giãn nở nhiệt.',
      en: 'No measured span yet — using the longest side of the part (worst case). Enter the real span to size the thermal error correctly.',
    });
  }

  /* Nhiều camera, có dung sai, mà chưa trả lời "kích thước đo có vắt qua đường
     ghép không" → coi là CÓ (chốt 2026-09-16, MEC-003). Phía xấu: để trống thì
     đúng bài nhiều camera — loại dễ trượt nhất — lại không bị kiểm. Một camera
     hoặc chưa có số camera thì không có đường ghép nào để giả định. */
  const seam = readField(next, SEAM_PATH);
  const cameraCount = readField(next, 'system.cameraCount')?.value;
  if (
    shown.has(SEAM_PATH) &&
    seam &&
    seam.value === null &&
    hasTolerance &&
    typeof cameraCount === 'number' &&
    cameraCount > 1
  ) {
    const key = defaultAssumptionKey(SEAM_PATH);
    seam.value = true;
    seam.confidence = 'assumed';
    seam.assumptionId = key;
    assumptions.push({
      key,
      source: 'default',
      level: 'warning',
      ruleIds: ['MEC-003'],
      path: SEAM_PATH,
      value: true,
      vi: 'Chưa xác nhận kích thước đo có vắt qua đường ghép giữa hai camera không — tạm coi là CÓ (phía xấu). Chọn "Không" nếu kích thước nằm gọn trong một camera.',
      en: 'Not yet confirmed whether the measured dimension crosses a seam between two cameras — assuming it DOES (worst case). Choose "No" if it lies within one camera.',
    });
  }

  for (const def of FIELD_DEFAULTS) {
    if (!shown.has(def.path)) continue;
    const field = readField(next, def.path);
    if (!field || field.value !== null) continue;

    const key = defaultAssumptionKey(def.path);
    field.value = def.value;
    field.confidence = 'assumed';
    field.assumptionId = key;
    assumptions.push({
      key,
      source: 'default',
      level: def.level,
      ruleIds: def.ruleIds,
      path: def.path,
      value: def.value,
      ...(def.unit ? { unit: def.unit } : {}),
      vi: def.basis.vi,
      en: def.basis.en,
    });
  }

  return { requirement: next, assumptions };
}

const CONTRAST_LABEL: Record<DefectContrast, { vi: string; en: string }> = {
  high: { vi: 'CAO', en: 'HIGH' },
  medium: { vi: 'TRUNG BÌNH', en: 'MEDIUM' },
  low: { vi: 'THẤP', en: 'LOW' },
  unknown: { vi: 'chưa xác định', en: 'undetermined' },
};

/**
 * px/lỗi: bộ tính hiện tại dùng CỐ ĐỊNH `DEFAULT_PX_PER_DEFECT`, chưa theo
 * RES-001. Panel phải nói rõ lệch về phía nào, không viết chung chung "chưa áp
 * dụng": N nhỏ hơn luật → mm/px lớn hơn → số MP yêu cầu bị tính THIẾU.
 *
 * TODO(V1b): đổi 3 → N theo contrast (N_DET_BY_CONTRAST) trong bộ tính vision
 * và selector; cần test hồi quy vì mọi kết quả ngoại quan đang có sẽ đổi.
 * Khi đó bỏ cảnh báo này.
 */
function pxPerDefectAssumption(effective: Requirement): Assumption | null {
  if (effective.detection.length === 0) return null;

  // Nhiều mục lỗi thì mục cần nhiều px nhất quyết định.
  const driving = effective.detection
    .map((item) => {
      const stated = item.contrast.confidence !== 'assumed' ? item.contrast.value : null;
      const contrast: DefectContrast = stated ?? 'unknown';
      return { contrast, n: N_DET_BY_CONTRAST[contrast] };
    })
    .reduce((worst, entry) => (entry.n > worst.n ? entry : worst));

  const used = DEFAULT_PX_PER_DEFECT;
  const usedMatches = (Object.keys(CONTRAST_LABEL) as DefectContrast[]).find((c) => N_DET_BY_CONTRAST[c] === used);
  const usedLabel = usedMatches ? CONTRAST_LABEL[usedMatches] : null;
  const label = CONTRAST_LABEL[driving.contrast];
  const title = { vi: 'Số pixel phủ lên lỗi (px/lỗi)', en: 'Pixels per defect (px/defect)' };
  const base = { key: 'parameter:pxPerDefect', source: 'parameter' as const, ruleIds: ['RES-001'], value: used, title };

  if (driving.n > used) {
    // MP tỉ lệ với N² (N tăng thì mm/px giảm theo cả hai trục).
    const factor = Math.round((driving.n / used) ** 2 * 10) / 10;
    return {
      ...base,
      level: 'warning',
      vi:
        `px/lỗi đang dùng cố định ${used}${usedLabel ? ` (tương ứng contrast ${usedLabel.vi})` : ''}. ` +
        `Theo luật chọn độ phân giải theo độ tương phản, contrast ${label.vi} phải dùng ${driving.n}. ` +
        `Số MP yêu cầu hiện tại có thể ĐANG BỊ TÍNH THIẾU — nhánh phát hiện lỗi cần gấp ` +
        `(${driving.n}/${used})² ≈ ${String(factor).replace('.', ',')} lần. Sẽ áp dụng đầy đủ ở V1b.`,
      en:
        `px/defect is currently fixed at ${used}${usedLabel ? ` (matches ${usedLabel.en} contrast)` : ''}. ` +
        `Per the contrast-based resolution rule, ${label.en} contrast requires ${driving.n}. ` +
        `The required MP may currently be UNDERESTIMATED — the detection branch needs ` +
        `(${driving.n}/${used})² ≈ ${factor}× as many. Will be fully applied in V1b.`,
    };
  }

  return {
    ...base,
    level: 'info',
    vi:
      driving.n === used
        ? `px/lỗi đang dùng cố định ${used} — khớp luật chọn độ phân giải theo độ tương phản cho contrast ${label.vi}.`
        : `px/lỗi đang dùng cố định ${used} — nhiều hơn luật chọn độ phân giải theo độ tương phản yêu cầu (${driving.n}) cho contrast ${label.vi}, số MP tính dư.`,
    en:
      driving.n === used
        ? `px/defect is currently fixed at ${used} — matches the contrast-based resolution rule for ${label.en} contrast.`
        : `px/defect is currently fixed at ${used} — more than the contrast-based resolution rule requires (${driving.n}) for ${label.en} contrast; MP is overestimated.`,
  };
}

function measurementParameters(effective: Requirement): Assumption[] {
  if (effective.measurement.length === 0) return [];
  return [
    {
      key: 'parameter:grrDivisor',
      source: 'parameter',
      level: 'info',
      ruleIds: ['RES-002'],
      value: GRR_DIVISOR,
      title: { vi: 'Hệ số Gage R&R (GRR_divisor)', en: 'Gage R&R divisor (GRR_divisor)' },
      vi: `Ngân sách sai số đo = dải dung sai tổng ÷ ${GRR_DIVISOR} (mức gage tốt; 4 là tối thiểu còn chấp nhận).`,
      en: `Measurement uncertainty budget = total tolerance band ÷ ${GRR_DIVISOR} (good gage practice; 4 is the minimum acceptable).`,
    },
    {
      key: 'parameter:kSubpixel',
      source: 'parameter',
      level: 'info',
      ruleIds: ['RES-002'],
      value: K_SUBPIXEL,
      title: { vi: 'Hệ số subpixel (k_subpixel)', en: 'Subpixel factor (k_subpixel)' },
      vi: `Độ lặp lại dưới pixel giả định 1/${K_SUBPIXEL} px — mức bảo toàn, chưa hiệu chỉnh bằng dự án thật.`,
      en: `Subpixel repeatability assumed to be 1/${K_SUBPIXEL} px — conservative, not yet calibrated on real projects.`,
    },
  ];
}

/**
 * Mọi thứ panel cần: requirement đã điền mặc định (để bảng hiện badge
 * "Giả định") và danh sách giả định theo thứ tự hiển thị.
 */
export function resolveAssumptions(requirement: Requirement): {
  requirement: Requirement;
  assumptions: Assumption[];
} {
  const { requirement: effective, assumptions: defaults } = applyDefaults(requirement);
  const adapter = requirementToSelectorInput(requirement).assumptions;
  const pxPerDefect = pxPerDefectAssumption(effective);

  return {
    requirement: effective,
    assumptions: [...defaults, ...adapter, ...(pxPerDefect ? [pxPerDefect] : []), ...measurementParameters(effective)],
  };
}
