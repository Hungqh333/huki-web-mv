/**
 * Chữ trong công thức engine — V1c mục C9 (chốt Q4).
 *
 * Công thức đã thay số (`Check.formula`) từng viết cứng tiếng Việt ("vs nhịp
 * 2000 ms", "4 ≥ 2 cổng"), nên bản tiếng Anh, PDF tiếng Anh và dữ kiện gửi bộ
 * diễn giải đều lọt chữ Việt. Engine giờ ghi THẺ (⟦takt⟧); mọi nơi hiển thị gọi
 * `renderFormula` với bảng từ của ngôn ngữ đang dùng. Số không đổi.
 *
 * Bảng từ nằm ở messages: selector.vision.formulaTerms.<khoá>.
 */

export const FORMULA_TERMS = [
  'takt',
  'min',
  'recommended',
  'ports',
  'fovDiagonal',
  'fovLongSide',
  'maxDeltaT',
  'seams',
  'thermal',
  'ifStandardLens',
  'tileSide',
  'frontDiameter',
  'grid',
  'perCamera',
  'overlap',
  'framesPerSecond',
  // Bộ chọn thiết bị cũ (line scan, thời gian chu kỳ, bảng "Các phép tính") — C9 bổ sung.
  'linesPerSecond',
  'ofCamera',
  'perLine',
  'umPerPulse',
  'bytesPerPx',
  'msPerImage',
  'partsPerMinute',
  'msPerPart',
  'settling',
  'perRow',
  'neededAcross',
  'acrossWidth',
  'target',
  'imageCircle',
  'sensorDiagonal',
  'tolerance',
  'onLongAxis',
  'measurementTolerance',
  'measurementError',
  'smallestDefect',
  'codeModule',
  'charHeight',
  'tighterThan',
  'measurementBudgetOf',
  'of',
  'headroom',
  'worseAxis',
  'comparedToTarget',
] as const;
export type FormulaTerm = (typeof FORMULA_TERMS)[number];

export const term = (key: FormulaTerm) => `⟦${key}⟧`;

const TOKEN = /⟦(\w+)⟧/g;

/**
 * Phần KẾT QUẢ của một công thức đã thay số — sau dấu "=" hoặc "≈" cuối cùng. Người không phải
 * admin chỉ thấy phần này (bảo vệ công thức, chốt 2026-10-21). Không có dấu bằng → null.
 */
export function formulaResult(formula: string): string | null {
  const at = Math.max(formula.lastIndexOf(' = '), formula.lastIndexOf(' ≈ '));
  return at < 0 ? null : formula.slice(at + 3).trim() || null;
}

/** Thay thẻ bằng từ đúng ngôn ngữ. Thẻ lạ (không có trong bảng) để nguyên tên khoá, không ném lỗi. */
export function renderFormula(formula: string, translate: (key: FormulaTerm) => string): string {
  return formula.replace(TOKEN, (_, key: string) => ((FORMULA_TERMS as readonly string[]).includes(key) ? translate(key as FormulaTerm) : key));
}
