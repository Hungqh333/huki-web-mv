import { fmt, round, type CameraLike, type Check } from './types';

/**
 * Độ phân giải: cần bao nhiêu pixel, và camera THẬT có đạt không.
 *
 * Điểm khác biệt so với cách tính cũ: trước đây chỉ ra một con số megapixel tối
 * thiểu rồi dừng. Nhưng cảm biến có tỉ lệ khung hình CỐ ĐỊNH, nên "đủ
 * megapixel" không có nghĩa là đủ pixel trên CẢ HAI trục. Phải tính riêng từng
 * trục, chọn camera thật, rồi tính ngược lại xem thực tế được bao nhiêu pixel
 * phủ lên lỗi.
 */

/** Bảng gợi ý N (số pixel phủ lên lỗi nhỏ nhất) theo mục tiêu kiểm tra. */
export const PX_PER_DEFECT_GUIDE: { min: number; max: number | null; goalKey: string }[] = [
  { min: 3, max: 3, goalKey: 'presence' },
  { min: 4, max: 6, goalKey: 'appearanceTextured' },
  { min: 8, max: 10, goalKey: 'classify' },
  { min: 10, max: null, goalKey: 'measure' },
];

export const DEFAULT_PX_PER_DEFECT = 3;

export type ResolutionNeed = {
  /** mm ứng với một pixel, mục tiêu cần đạt. */
  mmPerPxTarget: number;
  /** Số pixel cần trên trục ngang và dọc. */
  nx: number;
  ny: number;
};

/**
 * N_x = FOV_x / (d_min / N), N_y = FOV_y / (d_min / N).
 *
 * Tính riêng hai trục, không suy trục này từ trục kia: FOV hiếm khi vuông, và
 * cảm biến cũng vậy.
 */
export function requiredPixels(input: {
  fovWidthMm: number;
  fovHeightMm: number;
  defectMinSizeMm: number;
  pxPerDefect: number;
}): ResolutionNeed | null {
  const { fovWidthMm, fovHeightMm, defectMinSizeMm, pxPerDefect } = input;
  if (fovWidthMm <= 0 || fovHeightMm <= 0 || defectMinSizeMm <= 0 || pxPerDefect <= 0) return null;

  const mmPerPxTarget = defectMinSizeMm / pxPerDefect;
  return {
    mmPerPxTarget,
    nx: Math.ceil(fovWidthMm / mmPerPxTarget),
    ny: Math.ceil(fovHeightMm / mmPerPxTarget),
  };
}

export type ResolutionVerdict = {
  mmPerPxX: number;
  mmPerPxY: number;
  pxPerDefectX: number;
  pxPerDefectY: number;
  /** Trục xấu hơn quyết định — lỗi có thể nằm theo hướng bất kỳ. */
  worstPxPerDefect: number;
  meetsTarget: boolean;
};

/**
 * Tính ngược từ camera thật: mỗi pixel ứng với bao nhiêu mm, và thực tế có bao
 * nhiêu pixel phủ lên lỗi nhỏ nhất.
 */
export function verifyResolution(
  camera: Pick<CameraLike, 'widthPx' | 'heightPx'>,
  input: { fovWidthMm: number; fovHeightMm: number; defectMinSizeMm: number; pxPerDefect: number }
): ResolutionVerdict | null {
  if (camera.widthPx <= 0 || camera.heightPx <= 0) return null;
  if (input.fovWidthMm <= 0 || input.fovHeightMm <= 0 || input.defectMinSizeMm <= 0) return null;

  const mmPerPxX = input.fovWidthMm / camera.widthPx;
  const mmPerPxY = input.fovHeightMm / camera.heightPx;
  const pxPerDefectX = input.defectMinSizeMm / mmPerPxX;
  const pxPerDefectY = input.defectMinSizeMm / mmPerPxY;
  const worst = Math.min(pxPerDefectX, pxPerDefectY);

  return {
    mmPerPxX: round(mmPerPxX, 5),
    mmPerPxY: round(mmPerPxY, 5),
    pxPerDefectX: round(pxPerDefectX, 2),
    pxPerDefectY: round(pxPerDefectY, 2),
    worstPxPerDefect: round(worst, 2),
    meetsTarget: worst >= input.pxPerDefect,
  };
}

/** Camera có đủ pixel trên CẢ HAI trục không. */
export function cameraCoversNeed(camera: Pick<CameraLike, 'widthPx' | 'heightPx'>, need: ResolutionNeed): boolean {
  return camera.widthPx >= need.nx && camera.heightPx >= need.ny;
}

/**
 * Số camera cần để phủ hết chiều dài: n = ceil(L / (FOV × (1 − chồng lấn))).
 *
 * Phải có chồng lấn, nếu không lỗi nằm đúng đường ghép giữa hai camera sẽ bị
 * cắt đôi và không camera nào thấy đủ.
 */
export function cameraCount(input: {
  totalLengthMm: number;
  fovWidthMm: number;
  overlapRatio: number;
}): number | null {
  const { totalLengthMm, fovWidthMm, overlapRatio } = input;
  if (totalLengthMm <= 0 || fovWidthMm <= 0) return null;
  if (overlapRatio < 0 || overlapRatio >= 1) return null;
  return Math.ceil(totalLengthMm / (fovWidthMm * (1 - overlapRatio)));
}

// --------------------------------------------------------------- CÁC BƯỚC --

export function resolutionChecks(
  input: {
    fovWidthMm: number;
    fovHeightMm: number;
    defectMinSizeMm: number;
    pxPerDefect: number;
    totalLengthMm: number | null;
    overlapRatio: number;
  },
  camera: Pick<CameraLike, 'widthPx' | 'heightPx'> | null
): Check[] {
  const checks: Check[] = [];
  const need = requiredPixels(input);
  if (!need) return checks;

  checks.push({
    key: 'mmPerPxTarget',
    status: 'info',
    formula: `${fmt(input.defectMinSizeMm)} mm ÷ ${input.pxPerDefect} px = ${fmt(need.mmPerPxTarget, 5)} mm/px`,
  });

  checks.push({
    key: 'requiredPixels',
    status: 'info',
    formula:
      `X: ${fmt(input.fovWidthMm)} ÷ ${fmt(need.mmPerPxTarget, 5)} = ${need.nx} px · ` +
      `Y: ${fmt(input.fovHeightMm)} ÷ ${fmt(need.mmPerPxTarget, 5)} = ${need.ny} px`,
  });

  /*
   * Line scan chỉ có một hàng pixel: chiều dọc do quét sinh ra nên không bị
   * cảm biến giới hạn. Kiểm cả hai trục như area scan sẽ luôn báo FAIL sai.
   */
  const lineCamera = camera as { lineWidthPx?: number | null } | null;
  const isLine = Boolean(lineCamera?.lineWidthPx);

  if (isLine && lineCamera?.lineWidthPx) {
    const lineWidth = lineCamera.lineWidthPx;
    const fits = lineWidth >= need.nx;
    checks.push({
      key: 'sensorFits',
      status: fits ? 'pass' : 'fail',
      formula: `${lineWidth} px một hàng ≥ ${need.nx} px cần theo bề ngang`,
      noteKey: fits ? undefined : 'sensorTooSmall',
    });

    const mmPerPx = input.fovWidthMm / lineWidth;
    const pxPerDefect = input.defectMinSizeMm / mmPerPx;
    const ok = pxPerDefect >= input.pxPerDefect;

    checks.push({
      key: 'actualMmPerPx',
      status: 'info',
      formula: `${fmt(input.fovWidthMm)} ÷ ${lineWidth} = ${fmt(mmPerPx, 5)} mm/px theo bề ngang`,
    });
    checks.push({
      key: 'actualPxPerDefect',
      status: ok ? 'pass' : 'fail',
      formula: `${fmt(input.defectMinSizeMm)} ÷ ${fmt(mmPerPx, 5)} = ${fmt(pxPerDefect, 2)} px (mục tiêu ${input.pxPerDefect} px)`,
      noteKey: ok ? undefined : 'belowTarget',
      noteValues: { actual: round(pxPerDefect, 2), target: input.pxPerDefect },
    });
  } else if (camera) {
    const fits = cameraCoversNeed(camera, need);
    checks.push({
      key: 'sensorFits',
      status: fits ? 'pass' : 'fail',
      formula: `W ${camera.widthPx} ≥ ${need.nx} · H ${camera.heightPx} ≥ ${need.ny}`,
      noteKey: fits ? undefined : 'sensorTooSmall',
    });

    const verdict = verifyResolution(camera, input);
    if (verdict) {
      checks.push({
        key: 'actualMmPerPx',
        status: 'info',
        formula:
          `X: ${fmt(input.fovWidthMm)} ÷ ${camera.widthPx} = ${fmt(verdict.mmPerPxX, 5)} mm/px · ` +
          `Y: ${fmt(input.fovHeightMm)} ÷ ${camera.heightPx} = ${fmt(verdict.mmPerPxY, 5)} mm/px`,
      });

      checks.push({
        key: 'actualPxPerDefect',
        status: verdict.meetsTarget ? 'pass' : 'fail',
        formula:
          `${fmt(input.defectMinSizeMm)} ÷ ${fmt(verdict.mmPerPxX, 5)} = ${fmt(verdict.pxPerDefectX, 2)} px · ` +
          `${fmt(input.defectMinSizeMm)} ÷ ${fmt(verdict.mmPerPxY, 5)} = ${fmt(verdict.pxPerDefectY, 2)} px ` +
          `(trục xấu hơn ${fmt(verdict.worstPxPerDefect, 2)} px so với mục tiêu ${input.pxPerDefect} px)`,
        noteKey: verdict.meetsTarget ? undefined : 'belowTarget',
        noteValues: { actual: verdict.worstPxPerDefect, target: input.pxPerDefect },
      });
    }
  }

  if (input.totalLengthMm !== null && input.totalLengthMm > 0) {
    const count = cameraCount({
      totalLengthMm: input.totalLengthMm,
      fovWidthMm: input.fovWidthMm,
      overlapRatio: input.overlapRatio,
    });
    if (count !== null) {
      checks.push({
        key: 'cameraCount',
        status: 'info',
        formula: `⌈${fmt(input.totalLengthMm)} ÷ (${fmt(input.fovWidthMm)} × (1 − ${input.overlapRatio}))⌉ = ${count}`,
        noteKey: 'cameraCountNote',
        noteValues: { count },
      });
    }
  }

  return checks;
}
