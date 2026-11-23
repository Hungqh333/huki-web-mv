/**
 * OPT-013 — Độ sâu trường ảnh (DOF) theo chiều thuận: biết khẩu F → DOF phía trước / phía sau điểm nét.
 * Chốt 2026-11-21 (Q1–Q5 như đề xuất), đối chiếu công thức các hãng:
 *   - Fujifilm (thuật ngữ ống MV): phía sau Tr = δ·F·L² ÷ (f² − δ·F·L), phía trước Tf = δ·F·L² ÷ (f² + δ·F·L).
 *   - Edmund Optics: độ sâu phía ảnh = 2 × F làm việc × vết nhòe; F làm việc thay F ghi ở vô cực khi chụp gần.
 *   - Opto Engineering: F làm việc = (1 + β) × F; telecentric DOF = F làm việc × p × k ÷ β²,
 *     k = 0,008 đo lường / 0,015 phát hiện lỗi; cần ảnh rất nét chỉ dùng một nửa DOF.
 *   - FRAMOS: vòng mờ = cỡ pixel × hệ số (1,4 đơn sắc, 2,0 màu).
 * Viết theo mô hình Newton của phần mềm (x = WD − sF, β = f ÷ x, x′ = f² ÷ x = β·f): ống thường lệch vạch nét
 * phía ảnh ±δ với δ = N·(1 + β)·c ÷ k (k: bộ nhân phóng ảnh sau ống, vết nhòe c trên cảm biến ứng với c ÷ k ở
 * mặt ảnh của ống). Vật nét từ x_gần = f² ÷ (β·f + δ) tới x_xa = f² ÷ (β·f − δ) (β·f ≤ δ → xa tới ∞, siêu tiêu cự).
 * Khi δ ≪ β·f: DOF ≈ 2·N·c·(1 + β) ÷ β² — đúng bản gần đúng OPT-005 đang dùng.
 */

import { DEFAULT_CIRCLE_OF_CONFUSION_PX } from './optics';

/** Hệ số k của Opto Engineering (DOF[mm] = F làm việc × p[µm] × k ÷ β²). */
export const OPTO_DOF_K_MEASURE = 0.008;
export const OPTO_DOF_K_DEFECT = 0.015;

/** Đổi k Opto → vòng mờ tính bằng số pixel: 2 × c = p × k × 1000 → c ÷ p = 500 × k. */
export function optoKToBlurPx(k: number): number {
  return 500 * k;
}

/** Vòng mờ chặt mặc định — trùng DEFAULT_CIRCLE_OF_CONFUSION_PX (optics.ts) và FRAMOS camera màu. */
export const DOF_BLUR_TIGHT_PX = DEFAULT_CIRCLE_OF_CONFUSION_PX;

export type DofBlurPreset = 'tight' | 'measure' | 'defect';

/** Ba mức độ nhòe cho phép (Q2-A): đo chặt 2 px · đo lường 4 px (Opto k 0,008) · phát hiện lỗi 7,5 px (Opto k 0,015). */
export const DOF_BLUR_PRESETS: Record<DofBlurPreset, number> = {
  tight: DOF_BLUR_TIGHT_PX,
  measure: optoKToBlurPx(OPTO_DOF_K_MEASURE),
  defect: optoKToBlurPx(OPTO_DOF_K_DEFECT),
};

/** Khẩu F chuẩn — vạch trên thanh trượt F. */
export const STANDARD_F_STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32] as const;

/** Khẩu F mặc định khi chưa biết F đặt (Opto: F/8 là khẩu thường dùng, datasheet telecentric ghi DOF ở F/8). */
export const DOF_DEFAULT_F = 8;

export type DepthOfField = {
  /** Phía trước điểm nét (về phía ống), mm. */
  frontMm: number;
  /** Phía sau điểm nét, mm; Infinity = nét tới vô cực. */
  backMm: number;
  /** Tổng = trước + sau; Infinity khi sau = ∞. */
  totalMm: number;
  /** Vạch lệch nét cho phép phía ảnh (mm). */
  deltaMm: number;
};

/** Vòng mờ (mm) = số px × cỡ điểm ảnh (µm) ÷ 1000. */
export function blurMm(blurPx: number, pixelUm: number): number {
  return (blurPx * pixelUm) / 1000;
}

/**
 * Ống thường (entocentric), mô hình Newton. Số của ỐNG GỐC: f, F trên vòng khẩu, β = f ÷ (WD − sF).
 * `blur` là vòng mờ trên cảm biến (mm); `converterFactor` = k của bộ nhân sau ống (1 = không có).
 */
export function depthOfFieldNewton(input: { focalMm: number; fNumber: number; betaLens: number; blur: number; converterFactor?: number }): DepthOfField | null {
  const { focalMm: f, fNumber: n, betaLens: b, blur: c } = input;
  const k = input.converterFactor ?? 1;
  if (!(f > 0) || !(n > 0) || !(b > 0) || !(c > 0) || !(k > 0)) return null;
  const delta = (n * (1 + b) * c) / k;
  const xPrime = b * f;
  const x = f / b;
  const xNear = (f * f) / (xPrime + delta);
  const xFar = xPrime > delta ? (f * f) / (xPrime - delta) : Infinity;
  const frontMm = x - xNear;
  const backMm = xFar - x;
  return { frontMm, backMm, totalMm: frontMm + backMm, deltaMm: delta };
}

/** Telecentric: β không đổi theo khoảng cách → đối xứng hai phía, DOF = 2 × F làm việc × c ÷ β² (Opto Engineering). */
export function depthOfFieldTelecentric(input: { workingFNumber: number; beta: number; blur: number }): DepthOfField | null {
  const { workingFNumber: n, beta: b, blur: c } = input;
  if (!(n > 0) || !(b > 0) || !(c > 0)) return null;
  const half = (n * c) / (b * b);
  return { frontMm: half, backMm: half, totalMm: 2 * half, deltaMm: n * c };
}

/**
 * Chiều ngược của depthOfFieldNewton (ống thường, không bộ nhân): khoảng cách vật gần nhất / xa nhất DỌC TRỤC QUANG
 * (tính từ tâm ống) phải cùng nằm trong DOF. Đặt nét giữa hai ảnh: x′ = f² ÷ (khoảng − f),
 * δ = (x′_gần − x′_xa) ÷ 2, x′₀ = (x′_gần + x′_xa) ÷ 2, β₀ = x′₀ ÷ f, N = δ ÷ ((1 + β₀) × c).
 * Dùng cho camera nghiêng (OPT-014): mặt phẳng nét vuông góc trục quang, mặt vật nằm chéo.
 */
export function fNumberForDepthRange(input: { focalMm: number; nearMm: number; farMm: number; blur: number }): { fNumber: number; focusMm: number; beta: number } | null {
  const { focalMm: f, nearMm, farMm, blur: c } = input;
  if (!(f > 0) || !(c > 0) || !(nearMm > f) || !(farMm >= nearMm)) return null;
  const xpNear = (f * f) / (nearMm - f);
  const xpFar = (f * f) / (farMm - f);
  const delta = (xpNear - xpFar) / 2;
  const xp0 = (xpNear + xpFar) / 2;
  const beta = xp0 / f;
  return { fNumber: delta / ((1 + beta) * c), focusMm: f + (f * f) / xp0, beta };
}
