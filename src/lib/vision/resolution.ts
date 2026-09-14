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

/*
 * Cố định 3 = nhánh contrast CAO của RES-001. Contrast chưa rõ phải dùng 5, nên
 * số MP yêu cầu hiện có thể bị tính THIẾU — panel Assumptions đang ghi rõ điều
 * này (src/lib/requirement/assumptions.ts).
 * TODO(V1b): đổi 3 → N theo contrast (N_DET_BY_CONTRAST trong
 * src/lib/requirement/defaults.ts); cần test hồi quy toàn bộ bài ngoại quan.
 */
export const DEFAULT_PX_PER_DEFECT = 3;

// ------------------------------------------------------- NHÁNH ĐO LƯỜNG --
/*
 * Phát hiện lỗi và đo kích thước là HAI tiêu chí khác nhau, không gộp được vào
 * một biến mm/px. "Đủ pixel phủ lên lỗi" trả lời được câu có thấy lỗi không,
 * nhưng không trả lời được câu khách hàng thật sự hỏi: ±0,1 mm có đo nổi không.
 * Trước đây bài đo phải tự đặt N = 10 theo kinh nghiệm — đó không phải ngân
 * sách sai số.
 *
 * Nguồn hai hằng số dưới đây: docs/VISION_ENGINEER_SPEC_V1.1.md §3.3 và
 * RES-002. Cả hai là quy ước ngành (rule-of-thumb), CHƯA hiệu chỉnh bằng dự án
 * thật của phòng.
 */

/**
 * Hệ số Gage R&R: ngân sách sai số đo = dải dung sai tổng ÷ hệ số này.
 * 10 là mức "tốt" theo quy ước gage; 4 là mức tối thiểu còn chấp nhận.
 */
export const GRR_DIVISOR = 10;

/**
 * Độ lặp lại dưới pixel giả định bằng 1/3 px. Thuật toán tìm biên nội suy được
 * vị trí nhỏ hơn một pixel, nên một pixel được phép lớn hơn ngân sách sai số
 * đúng bằng hệ số này. Lấy 3 là bảo toàn.
 */
export const K_SUBPIXEL = 3;

export type MeasurementBudget = {
  /** Dung sai nhập vào, dạng ± (mm). */
  toleranceMm: number;
  /** Dải dung sai tổng T = 2 × dung sai. */
  totalToleranceMm: number;
  /** Ngân sách sai số đo U = T ÷ GRR_DIVISOR. */
  uncertaintyBudgetMm: number;
  /** Kích thước một pixel lớn nhất còn đo nổi: U × K_SUBPIXEL. */
  mmPerPx: number;
};

/**
 * ±t → T = 2t → U = T ÷ 10 → mm/px = U × 3.
 *
 * Dung sai nhập theo dạng ± vì đó là cách bản vẽ ghi. Quên nhân đôi thì ngân
 * sách lệch đúng hai lần — nên phép nhân nằm ở đây, không để người dùng tự đổi.
 * Không có dung sai (hoặc ≤ 0) thì trả null: bài không có yêu cầu đo.
 */
export function measurementBudget(toleranceMm: number | null | undefined): MeasurementBudget | null {
  if (toleranceMm === null || toleranceMm === undefined || !(toleranceMm > 0)) return null;
  const totalToleranceMm = 2 * toleranceMm;
  const uncertaintyBudgetMm = totalToleranceMm / GRR_DIVISOR;
  return {
    toleranceMm,
    totalToleranceMm,
    uncertaintyBudgetMm,
    mmPerPx: uncertaintyBudgetMm * K_SUBPIXEL,
  };
}

export type ResolutionNeed = {
  /** mm ứng với một pixel, mục tiêu cần đạt — nhánh CHẶT HƠN quyết định. */
  mmPerPxTarget: number;
  /** Nhánh phát hiện lỗi: d_min ÷ N. */
  mmPerPxDetection: number;
  /** Nhánh đo lường theo dung sai; null khi bài không có yêu cầu đo. */
  mmPerPxMeasurement: number | null;
  /** Nhánh nào đang quyết định độ phân giải. */
  governing: 'detection' | 'measurement';
  /** Số pixel cần trên trục ngang và dọc. */
  nx: number;
  ny: number;
};

/**
 * N_x = FOV_x / mm_per_px, N_y = FOV_y / mm_per_px, với
 * mm_per_px = min(nhánh phát hiện lỗi, nhánh đo lường).
 *
 * Tính riêng hai trục, không suy trục này từ trục kia: FOV hiếm khi vuông, và
 * cảm biến cũng vậy.
 *
 * Lấy MIN, không lấy trung bình: hệ thống phải thoả CẢ HAI tiêu chí, nên tiêu
 * chí chặt hơn quyết định. Không có dung sai đo thì nhánh đo lường tắt và kết
 * quả y hệt trước khi có nhánh này.
 */
export function requiredPixels(input: {
  fovWidthMm: number;
  fovHeightMm: number;
  defectMinSizeMm: number;
  pxPerDefect: number;
  /** Dung sai đo dạng ± (mm). Bỏ trống = không có yêu cầu đo. */
  measurementToleranceMm?: number | null;
}): ResolutionNeed | null {
  const { fovWidthMm, fovHeightMm, defectMinSizeMm, pxPerDefect } = input;
  if (fovWidthMm <= 0 || fovHeightMm <= 0 || defectMinSizeMm <= 0 || pxPerDefect <= 0) return null;

  const mmPerPxDetection = defectMinSizeMm / pxPerDefect;
  const mmPerPxMeasurement = measurementBudget(input.measurementToleranceMm)?.mmPerPx ?? null;
  const governing =
    mmPerPxMeasurement !== null && mmPerPxMeasurement < mmPerPxDetection ? 'measurement' : 'detection';
  const mmPerPxTarget = governing === 'measurement' ? mmPerPxMeasurement! : mmPerPxDetection;

  return {
    mmPerPxTarget,
    mmPerPxDetection,
    mmPerPxMeasurement,
    governing,
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

/** Camera thật có đạt ngân sách đo không, kèm biên = ngân sách ÷ thực tế. */
function measurementCheck(actualMmPerPx: number, budgetMmPerPx: number, axisNote: string): Check {
  const ok = actualMmPerPx <= budgetMmPerPx;
  return {
    key: 'measurementResolution',
    status: ok ? 'pass' : 'fail',
    formula:
      `${fmt(actualMmPerPx, 5)} mm/px${axisNote} ${ok ? '≤' : '>'} ${fmt(budgetMmPerPx, 5)} mm/px ` +
      `(biên ${fmt(budgetMmPerPx / actualMmPerPx, 2)}×)`,
    noteKey: ok ? undefined : 'measurementTooCoarse',
    noteValues: ok ? undefined : { actual: round(actualMmPerPx, 5), target: round(budgetMmPerPx, 5) },
  };
}

export function resolutionChecks(
  input: {
    fovWidthMm: number;
    fovHeightMm: number;
    defectMinSizeMm: number;
    pxPerDefect: number;
    measurementToleranceMm?: number | null;
    totalLengthMm: number | null;
    overlapRatio: number;
  },
  camera: Pick<CameraLike, 'widthPx' | 'heightPx'> | null
): Check[] {
  const checks: Check[] = [];
  const need = requiredPixels(input);
  if (!need) return checks;

  const measurement = measurementBudget(input.measurementToleranceMm);

  if (!measurement || need.mmPerPxMeasurement === null) {
    // Không có yêu cầu đo: giữ nguyên cách trình bày cũ, một nhánh duy nhất.
    checks.push({
      key: 'mmPerPxTarget',
      status: 'info',
      formula: `${fmt(input.defectMinSizeMm)} mm ÷ ${input.pxPerDefect} px = ${fmt(need.mmPerPxDetection, 5)} mm/px`,
    });
  } else {
    /* Hai nhánh SONG SONG rồi mới nói nhánh nào quyết định — để kỹ sư thấy
       được phần chênh, và biết nới dung sai hay nới kích thước lỗi mới là
       thứ thật sự giảm được yêu cầu camera. */
    checks.push({
      key: 'detectionBudget',
      status: 'info',
      formula: `${fmt(input.defectMinSizeMm)} mm ÷ ${input.pxPerDefect} px = ${fmt(need.mmPerPxDetection, 5)} mm/px`,
    });
    checks.push({
      key: 'measurementBudget',
      status: 'info',
      formula:
        `T = 2 × ±${fmt(measurement.toleranceMm, 4)} = ${fmt(measurement.totalToleranceMm, 4)} mm · ` +
        `U = ${fmt(measurement.totalToleranceMm, 4)} ÷ ${GRR_DIVISOR} = ${fmt(measurement.uncertaintyBudgetMm, 5)} mm · ` +
        `${fmt(measurement.uncertaintyBudgetMm, 5)} × ${K_SUBPIXEL} = ${fmt(need.mmPerPxMeasurement, 5)} mm/px`,
    });

    const byMeasurement = need.governing === 'measurement';
    const ratio = byMeasurement
      ? need.mmPerPxDetection / need.mmPerPxMeasurement
      : need.mmPerPxMeasurement / need.mmPerPxDetection;
    checks.push({
      key: 'governingResolution',
      status: 'info',
      formula: `min(${fmt(need.mmPerPxDetection, 5)}, ${fmt(need.mmPerPxMeasurement, 5)}) = ${fmt(need.mmPerPxTarget, 5)} mm/px`,
      noteKey: byMeasurement ? 'governedByMeasurement' : 'governedByDetection',
      noteValues: { ratio: round(ratio, 2) },
    });
  }

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

    // Quét dòng chỉ kiểm được bề ngang; chiều dọc do encoder quyết định.
    if (need.mmPerPxMeasurement !== null) {
      checks.push(measurementCheck(mmPerPx, need.mmPerPxMeasurement, ' theo bề ngang'));
    }
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

      if (need.mmPerPxMeasurement !== null) {
        // Trục THÔ hơn quyết định: kích thước cần đo có thể nằm theo hướng bất kỳ.
        const worstMmPerPx = Math.max(verdict.mmPerPxX, verdict.mmPerPxY);
        checks.push(measurementCheck(worstMmPerPx, need.mmPerPxMeasurement, ''));
      }
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
