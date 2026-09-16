import { ERROR_WARN_SHARE } from './resolution';
import { fmt, round, type Check } from './types';

/**
 * Cơ khí & nhiệt — nhóm MEC của spec V1.1 §6.
 *
 * Đây là những nguồn sai số mà độ phân giải camera KHÔNG giải thích được: tăng
 * megapixel không làm vật bớt giãn nở. Với bài đo span dài, chúng thường mới là
 * yếu tố giới hạn thật (spec §17, phép thử GT-001).
 */

// ------------------------------------------------------------ GIÃN NỞ NHIỆT --
/*
 * MEC-001 — thermal_error = α × L × ΔT.
 *
 * ΔT ở đây là DAO ĐỘNG nhiệt độ (cả dải, cùng nghĩa với ô "Dao động nhiệt độ môi
 * trường" của bảng Yêu cầu), không phải ±. Nên ΔT tối đa cho phép cũng là một
 * dải: 2,3 K nghĩa là giữ trong ±1,15 K quanh nhiệt độ hiệu chuẩn. Ghi cả hai
 * cách để khỏi đọc nhầm gấp đôi.
 *
 * Chốt 2026-09-16:
 * - FAIL > U, WARN > 50% U (ERROR_WARN_SHARE, chung với phối cảnh và ghép ảnh).
 * - Bài không có dung sai đo thì không kiểm: giãn nở làm hỏng phép đo, không
 *   làm mất lỗi.
 * - Chưa biết chiều dài cần đo thì tầng Yêu cầu giả định bằng cạnh dài của vật
 *   (requirement/assumptions.ts) — file này chỉ nhận số.
 */

/** Sai số do giãn nở nhiệt (µm): α [µm/(m·K)] × L [m] × ΔT [K]. */
export function thermalErrorUm(input: { alphaUmPerMK: number; lengthMm: number; deltaTK: number }): number | null {
  const { alphaUmPerMK, lengthMm, deltaTK } = input;
  if (!(alphaUmPerMK >= 0) || !(lengthMm >= 0) || !(deltaTK >= 0)) return null;
  return alphaUmPerMK * (lengthMm / 1000) * deltaTK;
}

/**
 * Dao động nhiệt lớn nhất còn nằm trong ngân sách đo: ΔT_max = U ÷ (α × L).
 * Đây là con số kỹ sư đem đi làm việc với khách, không chỉ một chữ FAIL.
 */
export function maxDeltaTK(input: { uncertaintyBudgetMm: number; alphaUmPerMK: number; lengthMm: number }): number | null {
  const { uncertaintyBudgetMm, alphaUmPerMK, lengthMm } = input;
  if (!(uncertaintyBudgetMm > 0) || !(alphaUmPerMK > 0) || !(lengthMm > 0)) return null;
  return (uncertaintyBudgetMm * 1000) / (alphaUmPerMK * (lengthMm / 1000));
}

/**
 * So sai số nhiệt với ngân sách đo U: > U → FAIL · > 50% U → WARN · còn lại PASS.
 * Thiếu U (bài không đo), α, L hoặc ΔT thì trả null — không đoán.
 */
export function thermalCheck(input: {
  alphaUmPerMK: number | null;
  lengthMm: number | null;
  deltaTK: number | null;
  uncertaintyBudgetMm: number | null;
}): Check | null {
  const { alphaUmPerMK, lengthMm, deltaTK, uncertaintyBudgetMm } = input;
  if (uncertaintyBudgetMm === null || !(uncertaintyBudgetMm > 0)) return null;
  if (alphaUmPerMK === null || lengthMm === null || deltaTK === null) return null;

  const errorUm = thermalErrorUm({ alphaUmPerMK, lengthMm, deltaTK });
  if (errorUm === null) return null;

  const errorMm = errorUm / 1000;
  const ratio = errorMm / uncertaintyBudgetMm;
  const allowed = maxDeltaTK({ uncertaintyBudgetMm, alphaUmPerMK, lengthMm });
  const status = ratio > 1 ? 'fail' : ratio > ERROR_WARN_SHARE ? 'warn' : 'pass';

  const formula =
    `${fmt(alphaUmPerMK)} µm/(m·K) × ${fmt(lengthMm / 1000, 4)} m × ${fmt(deltaTK)} K = ${fmt(errorUm, 1)} µm ` +
    `${ratio > 1 ? '>' : '≤'} U ${fmt(uncertaintyBudgetMm * 1000, 1)} µm` +
    (allowed !== null ? ` · dao động nhiệt tối đa ${fmt(allowed, 2)} K` : '');

  return {
    key: 'thermalError',
    status,
    formula,
    noteKey: status === 'fail' ? 'thermalExceedsBudget' : status === 'warn' ? 'thermalEatsBudget' : undefined,
    noteValues:
      status === 'pass'
        ? undefined
        : {
            error: round(errorMm, 4),
            budget: round(uncertaintyBudgetMm, 4),
            ratio: round(ratio, 1),
            share: Math.round(ratio * 100),
            maxDeltaT: allowed !== null ? round(allowed, 2) : '—',
            halfDeltaT: allowed !== null ? round(allowed / 2, 2) : '—',
          },
  };
}
