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
] as const;
export type FormulaTerm = (typeof FORMULA_TERMS)[number];

export const term = (key: FormulaTerm) => `⟦${key}⟧`;

const TOKEN = /⟦(\w+)⟧/g;

/** Thay thẻ bằng từ đúng ngôn ngữ. Thẻ lạ (không có trong bảng) để nguyên tên khoá, không ném lỗi. */
export function renderFormula(formula: string, translate: (key: FormulaTerm) => string): string {
  return formula.replace(TOKEN, (_, key: string) => ((FORMULA_TERMS as readonly string[]).includes(key) ? translate(key as FormulaTerm) : key));
}
