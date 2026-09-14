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
import { FIELD_DEFAULTS, N_DET_BY_CONTRAST } from './defaults';
import { fieldsFor, readField } from './fields';
import { requirementToSelectorInput } from './toSelectorInput';
import type { Assumption, DefectContrast, Requirement } from './types';

export const defaultAssumptionKey = (path: string) => `default:${path}`;

/**
 * Điền mặc định vào những ô còn trống của bảng tóm tắt. Trả requirement MỚI
 * (ô được điền mang confidence 'assumed' + assumptionId), không sửa object cũ.
 *
 * Chỉ điền ô đang hiện trên bảng của loại ứng dụng này — giả định nào cũng phải
 * thay được bằng số thật ngay trong bảng.
 */
export function applyDefaults(requirement: Requirement): { requirement: Requirement; assumptions: Assumption[] } {
  const shown = new Set(fieldsFor(requirement.applicationType).map((def) => def.path));
  const next = structuredClone(requirement);
  const assumptions: Assumption[] = [];

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
        `Theo RES-001, contrast ${label.vi} phải dùng ${driving.n}. ` +
        `Số MP yêu cầu hiện tại có thể ĐANG BỊ TÍNH THIẾU — nhánh phát hiện lỗi cần gấp ` +
        `(${driving.n}/${used})² ≈ ${String(factor).replace('.', ',')} lần. Sẽ áp dụng đầy đủ ở V1b.`,
      en:
        `px/defect is currently fixed at ${used}${usedLabel ? ` (matches ${usedLabel.en} contrast)` : ''}. ` +
        `Per RES-001, ${label.en} contrast requires ${driving.n}. ` +
        `The required MP may currently be UNDERESTIMATED — the detection branch needs ` +
        `(${driving.n}/${used})² ≈ ${factor}× as many. Will be fully applied in V1b.`,
    };
  }

  return {
    ...base,
    level: 'info',
    vi:
      driving.n === used
        ? `px/lỗi đang dùng cố định ${used} — khớp RES-001 cho contrast ${label.vi}.`
        : `px/lỗi đang dùng cố định ${used} — nhiều hơn RES-001 yêu cầu (${driving.n}) cho contrast ${label.vi}, số MP tính dư.`,
    en:
      driving.n === used
        ? `px/defect is currently fixed at ${used} — matches RES-001 for ${label.en} contrast.`
        : `px/defect is currently fixed at ${used} — more than RES-001 requires (${driving.n}) for ${label.en} contrast; MP is overestimated.`,
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
