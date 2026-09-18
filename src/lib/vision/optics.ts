import { SENSOR_FORMATS, sensorDiagonalMm } from '@/lib/components/specs';
import { ERROR_WARN_SHARE } from './resolution';
import { TILE_OVERLAP_RATIO, type CameraTile } from './tiling';
import { fmt, round, type Check } from './types';
import { term } from './formulaTerms';

/**
 * Quang học: tiêu cự, vòng ảnh, và ba phép kiểm tính khả thi.
 *
 * Ba phép kiểm ở cuối (Airy, lp/mm, DOF) chỉ CẢNH BÁO chứ không chặn: chúng
 * dùng xấp xỉ và phụ thuộc chất lượng ống kính thật, nên vai trò của chúng là
 * chỉ ra chỗ ống kính sắp thành nút cổ chai — để kỹ sư đi hỏi datasheet, chứ
 * không phải để phần mềm phán quyết thay.
 */

/** Bước sóng ánh sáng trắng lấy trung bình, dùng cho đĩa Airy. */
export const WAVELENGTH_UM = 0.55;

/** Vòng tròn mờ chấp nhận được, tính theo số pixel. */
export const DEFAULT_CIRCLE_OF_CONFUSION_PX = 2;

export type LensEstimate = {
  /** β = cỡ cảm biến / FOV. */
  beta: number;
  focalLengthMm: number;
  /** Khoảng cách làm việc suy ngược từ tiêu cự — để đối chiếu. */
  workingDistanceMm: number;
};

/**
 * β = sensor / FOV ; f ≈ WD × β / (1 + β) ; WD = f × (1 + 1/β)
 *
 * ƯỚC LƯỢNG, không phải con số để đặt hàng: công thức bỏ qua vị trí điểm chính
 * và bề dày cụm thấu kính. Ống kính thật phải tra bảng khoảng cách làm việc của
 * hãng.
 */
export function estimateLens(input: {
  sensorSizeMm: number;
  fovMm: number;
  workingDistanceMm: number;
}): LensEstimate | null {
  const { sensorSizeMm, fovMm, workingDistanceMm } = input;
  if (sensorSizeMm <= 0 || fovMm <= 0 || workingDistanceMm <= 0) return null;

  const beta = sensorSizeMm / fovMm;
  const focalLengthMm = (workingDistanceMm * beta) / (1 + beta);

  return {
    beta: round(beta, 4),
    focalLengthMm: round(focalLengthMm, 2),
    workingDistanceMm: round(focalLengthMm * (1 + 1 / beta), 1),
  };
}

/** Đĩa Airy (µm): d = 2,44 × λ × F#. Lớn hơn 2 pixel thì ống kính là nút cổ chai. */
export function airyDiskUm(fNumber: number): number | null {
  if (fNumber <= 0) return null;
  return round(2.44 * WAVELENGTH_UM * fNumber, 3);
}

/** Độ phân giải ống kính cần có: lp/mm = 1 / (2 × cỡ pixel tính bằng mm). */
export function requiredLpPerMm(pixelSizeUm: number): number | null {
  if (pixelSizeUm <= 0) return null;
  return round(1 / (2 * (pixelSizeUm / 1000)), 1);
}

/** Chiều sâu trường ảnh xấp xỉ: DOF ≈ 2 × F# × c × (1 + β) / β². */
export function depthOfFieldMm(input: {
  fNumber: number;
  circleOfConfusionMm: number;
  beta: number;
}): number | null {
  const { fNumber, circleOfConfusionMm, beta } = input;
  if (fNumber <= 0 || circleOfConfusionMm <= 0 || beta <= 0) return null;
  return round((2 * fNumber * circleOfConfusionMm * (1 + beta)) / beta ** 2, 3);
}

// --------------------------------------------------------- SAI SỐ PHỐI CẢNH --
/*
 * OPT-008 — spec V1.1 §4.2. Ống kính thường (entocentric) nhìn theo chùm tia
 * toả ra: điểm cao hơn mặt chuẩn Δh hiện ra lệch khỏi chỗ thật một đoạn tỉ lệ
 * với khoảng cách của nó tới tâm ảnh. Hiệu chuẩn mặt phẳng không bù được, vì
 * mỗi sản phẩm cao thấp khác nhau.
 *
 * Chốt 2026-09-16:
 * - Δh lấy CẢ DẢI, không chia đôi. Chỉ chia đôi được khi hiệu chuẩn đúng ở mặt
 *   giữa, mà điều đó chưa ai xác nhận — lấy phía xấu.
 * - r là nửa đường chéo MỘT camera (tiling.ts), đã cộng chồng lấn.
 * - Chưa chọn ống kính (V1c) thì mặc định ống kính thường: rẻ và phổ biến nhất,
 *   nên đó là trường hợp phải kiểm.
 */

/** Sai số phối cảnh (mm): Δh ÷ WD × r. */
export function perspectiveErrorMm(input: {
  heightVariationMm: number;
  workingDistanceMm: number;
  offAxisMm: number;
}): number | null {
  const { heightVariationMm, workingDistanceMm, offAxisMm } = input;
  if (!(heightVariationMm >= 0) || !(workingDistanceMm > 0) || !(offAxisMm >= 0)) return null;
  return (heightVariationMm / workingDistanceMm) * offAxisMm;
}

/**
 * So sai số phối cảnh với ngân sách đo U (resolution.ts):
 * > U → FAIL · > 50% U → WARN · còn lại PASS.
 *
 * Khách yêu cầu đo không phối cảnh thì KHÔNG FAIL: con số vẫn hiện để thấy vì
 * sao, nhưng kết luận là phải dùng ống kính telecentric (OPT-006).
 *
 * Bài không có dung sai đo (U = null), hoặc thiếu Δh / WD / vùng nhìn, thì
 * không có phép kiểm này — trả null, không đoán.
 */
export function perspectiveCheck(input: {
  heightVariationMm: number | null;
  workingDistanceMm: number | null;
  tile: CameraTile | null;
  uncertaintyBudgetMm: number | null;
  perspectiveFree: boolean;
}): Check | null {
  const { heightVariationMm, workingDistanceMm, tile, uncertaintyBudgetMm } = input;
  if (uncertaintyBudgetMm === null || !(uncertaintyBudgetMm > 0)) return null;
  if (heightVariationMm === null || workingDistanceMm === null || !tile) return null;

  const errorMm = perspectiveErrorMm({ heightVariationMm, workingDistanceMm, offAxisMm: tile.halfDiagonalMm });
  if (errorMm === null) return null;

  const ratio = errorMm / uncertaintyBudgetMm;
  const values = {
    error: round(errorMm, 4),
    budget: round(uncertaintyBudgetMm, 4),
    ratio: round(ratio, 1),
    share: Math.round(ratio * 100),
  };
  const base = `${fmt(heightVariationMm)} mm ÷ ${fmt(workingDistanceMm)} mm × ${fmt(tile.halfDiagonalMm, 1)} mm = ${fmt(errorMm, 4)} mm`;

  if (input.perspectiveFree) {
    return {
      key: 'perspectiveError',
      status: 'warn',
      formula: `${base} (${term('ifStandardLens')})`,
      noteKey: 'perspectiveNeedsTelecentric',
      noteValues: values,
    };
  }

  const status = ratio > 1 ? 'fail' : ratio > ERROR_WARN_SHARE ? 'warn' : 'pass';
  return {
    key: 'perspectiveError',
    status,
    formula: `${base} ${ratio > 1 ? '>' : '≤'} U ${fmt(uncertaintyBudgetMm, 4)} mm`,
    noteKey: status === 'fail' ? 'perspectiveExceedsBudget' : status === 'warn' ? 'perspectiveEatsBudget' : undefined,
    noteValues: status === 'pass' ? undefined : values,
  };
}

// ------------------------------------------------------ TRẦN TELECENTRIC --
/*
 * OPT-007 — spec V1.1 §6. Khi phối cảnh FAIL (hoặc khách yêu cầu đo không phối
 * cảnh), gợi ý thẳng "dùng telecentric" là chưa đủ: ống telecentric cần đường
 * kính đầu lớn hơn vùng nhìn, nên vùng nhìn lớn thì ống kính không tồn tại hoặc
 * không mua nổi. Engine phải nói điều đó VÀ đưa phương án thay thế có số.
 *
 * Chốt 2026-09-17 (gộp spec §6 và UI_CONTENT màn 6, hai nguồn ghi lệch nhau):
 * - Cạnh lớn nhất vùng nhìn MỘT camera (có chồng lấn): ≤ 100 mm PASS kèm lưu ý
 *   chi phí · 100–200 mm WARN rất đắt · > 200 mm FAIL không khả thi.
 * - Đường kính đầu ≈ 1,3 × cạnh vùng nhìn (spec cho 1,15–1,3, lấy phía xấu).
 * - Chỉ chạy khi engine sắp gợi ý telecentric.
 * - 100 / 200 mm và 1,3 là PHÁN ĐOÁN THỊ TRƯỜNG (giá đổi thì phải sửa), khác
 *   hằng số vật lý. TODO(V1b B6): cân nhắc đưa lên database + admin cùng khung luật.
 */

/** Vùng nhìn mỗi camera đến mức này thì telecentric còn hợp lý về giá. */
export const TELECENTRIC_PRACTICAL_MAX_MM = 100;
/** Quá mức này thì ống telecentric thực tế không có hoặc không mua nổi. */
export const TELECENTRIC_FEASIBLE_MAX_MM = 200;
/** Đường kính đầu ống kính ≈ hệ số này × cạnh vùng nhìn. */
export const TELECENTRIC_FRONT_DIAMETER_FACTOR = 1.3;

/** Đường kính đầu ống telecentric cần cho một cạnh vùng nhìn (mm). */
export function telecentricFrontDiameterMm(fovMaxMm: number): number | null {
  if (!(fovMaxMm > 0)) return null;
  return fovMaxMm * TELECENTRIC_FRONT_DIAMETER_FACTOR;
}

/**
 * Phương án thay thế ①: lưới camera để mỗi camera ≤ 100 mm, tính cả chồng lấn
 * 10% như tiling.ts. Trục vừa một camera thì không cần chồng lấn.
 */
export function camerasForTelecentric(input: { fovWidthMm: number; fovHeightMm: number }): {
  cols: number;
  rows: number;
  count: number;
} | null {
  const { fovWidthMm, fovHeightMm } = input;
  if (!(fovWidthMm > 0) || !(fovHeightMm > 0)) return null;
  const maxBase = TELECENTRIC_PRACTICAL_MAX_MM / (1 + TILE_OVERLAP_RATIO);
  const axis = (totalMm: number) => (totalMm <= TELECENTRIC_PRACTICAL_MAX_MM ? 1 : Math.ceil(totalMm / maxBase));
  const cols = axis(fovWidthMm);
  const rows = axis(fovHeightMm);
  return { cols, rows, count: cols * rows };
}

/**
 * Phương án thay thế ②: giữ ống kính thường thì chiều cao sản phẩm phải ổn định
 * trong Δh_max = U × WD ÷ r (đảo công thức phối cảnh).
 */
export function maxHeightVariationMm(input: {
  uncertaintyBudgetMm: number;
  workingDistanceMm: number;
  offAxisMm: number;
}): number | null {
  const { uncertaintyBudgetMm, workingDistanceMm, offAxisMm } = input;
  if (!(uncertaintyBudgetMm > 0) || !(workingDistanceMm > 0) || !(offAxisMm > 0)) return null;
  return (uncertaintyBudgetMm * workingDistanceMm) / offAxisMm;
}

export function telecentricCheck(input: {
  /** true khi phối cảnh FAIL hoặc khách yêu cầu đo không phối cảnh. */
  needed: boolean;
  tile: CameraTile | null;
  fovWidthMm: number;
  fovHeightMm: number;
  uncertaintyBudgetMm: number | null;
  workingDistanceMm: number | null;
}): Check | null {
  const { tile } = input;
  if (!input.needed || !tile) return null;

  const sizeMm = Math.max(tile.widthMm, tile.heightMm);
  const diameterMm = telecentricFrontDiameterMm(sizeMm);
  if (diameterMm === null) return null;

  const status = sizeMm <= TELECENTRIC_PRACTICAL_MAX_MM ? 'pass' : sizeMm <= TELECENTRIC_FEASIBLE_MAX_MM ? 'warn' : 'fail';
  const grid = camerasForTelecentric({ fovWidthMm: input.fovWidthMm, fovHeightMm: input.fovHeightMm });
  const maxHeight =
    input.uncertaintyBudgetMm !== null && input.workingDistanceMm !== null
      ? maxHeightVariationMm({
          uncertaintyBudgetMm: input.uncertaintyBudgetMm,
          workingDistanceMm: input.workingDistanceMm,
          offAxisMm: tile.halfDiagonalMm,
        })
      : null;

  const limit = status === 'fail' ? `> ${TELECENTRIC_FEASIBLE_MAX_MM}` : status === 'warn' ? `> ${TELECENTRIC_PRACTICAL_MAX_MM}` : `≤ ${TELECENTRIC_PRACTICAL_MAX_MM}`;
  return {
    key: 'telecentricFeasibility',
    status,
    formula: `${term('tileSide')} ${fmt(sizeMm, 1)} mm ${limit} mm · ${term('frontDiameter')} ≈ ${fmt(sizeMm, 1)} × ${TELECENTRIC_FRONT_DIAMETER_FACTOR} = ${fmt(diameterMm, 0)} mm`,
    noteKey: status === 'fail' ? 'telecentricInfeasible' : status === 'warn' ? 'telecentricExpensive' : 'telecentricCostNote',
    noteValues: {
      size: round(sizeMm, 1),
      diameter: Math.round(diameterMm),
      cols: grid?.cols ?? '—',
      rows: grid?.rows ?? '—',
      cameras: grid?.count ?? '—',
      maxHeight: maxHeight !== null ? round(maxHeight, 3) : '—',
    },
  };
}

// --------------------------------------------------------------- CÁC BƯỚC --

export function opticsChecks(input: {
  fovWidthMm: number;
  workingDistanceMm: number | null;
  sensorFormat: string | null;
  pixelSizeUm: number | null;
  fNumber: number | null;
  lensImageCircleFormat: string | null;
  heightToleranceMm: number | null;
  circleOfConfusionPx: number;
}): Check[] {
  const checks: Check[] = [];

  const sensor = input.sensorFormat ? SENSOR_FORMATS[input.sensorFormat] : undefined;
  let beta: number | null = null;

  if (sensor && input.workingDistanceMm !== null) {
    const lens = estimateLens({
      sensorSizeMm: sensor.widthMm,
      fovMm: input.fovWidthMm,
      workingDistanceMm: input.workingDistanceMm,
    });
    if (lens) {
      beta = lens.beta;
      checks.push({
        key: 'magnification',
        status: 'info',
        formula: `${fmt(sensor.widthMm)} mm ÷ ${fmt(input.fovWidthMm)} mm = ${fmt(lens.beta, 4)}`,
      });
      checks.push({
        key: 'focalLength',
        status: 'info',
        formula: `${fmt(input.workingDistanceMm)} × ${fmt(lens.beta, 4)} ÷ (1 + ${fmt(lens.beta, 4)}) ≈ ${fmt(lens.focalLengthMm, 1)} mm`,
        noteKey: 'focalIsEstimate',
      });
    }
  }

  // Vòng ảnh phải phủ hết ĐƯỜNG CHÉO cảm biến, không phải bề rộng.
  const sensorDiag = sensorDiagonalMm(input.sensorFormat);
  const lensDiag = sensorDiagonalMm(input.lensImageCircleFormat);
  if (sensorDiag !== null && lensDiag !== null) {
    const ok = lensDiag >= sensorDiag;
    checks.push({
      key: 'imageCircle',
      status: ok ? 'pass' : 'fail',
      formula: `vòng ảnh ${fmt(lensDiag, 2)} mm ${ok ? '≥' : '<'} đường chéo cảm biến ${fmt(sensorDiag, 2)} mm`,
      noteKey: ok ? undefined : 'imageCircleTooSmall',
    });
  }

  if (input.fNumber !== null && input.pixelSizeUm !== null) {
    const airy = airyDiskUm(input.fNumber);
    if (airy !== null) {
      const bottleneck = airy > 2 * input.pixelSizeUm;
      checks.push({
        key: 'airyDisk',
        status: bottleneck ? 'warn' : 'pass',
        formula: `2,44 × ${WAVELENGTH_UM} µm × F/${fmt(input.fNumber, 1)} = ${fmt(airy, 2)} µm ${bottleneck ? '>' : '≤'} 2 × ${fmt(input.pixelSizeUm, 2)} µm`,
        noteKey: bottleneck ? 'airyBottleneck' : undefined,
      });
    }
  }

  if (input.pixelSizeUm !== null) {
    const lp = requiredLpPerMm(input.pixelSizeUm);
    if (lp !== null) {
      const demanding = lp > 100;
      checks.push({
        key: 'lpPerMm',
        status: demanding ? 'warn' : 'pass',
        formula: `1 ÷ (2 × ${fmt(input.pixelSizeUm / 1000, 5)} mm) = ${fmt(lp, 1)} lp/mm`,
        noteKey: demanding ? 'lensMustBeHighRes' : undefined,
        noteValues: { lp },
      });
    }
  }

  if (beta !== null && input.fNumber !== null && input.pixelSizeUm !== null) {
    const cMm = (input.circleOfConfusionPx * input.pixelSizeUm) / 1000;
    const dof = depthOfFieldMm({ fNumber: input.fNumber, circleOfConfusionMm: cMm, beta });
    if (dof !== null) {
      // Chỉ so được khi biết dung sai chiều cao chi tiết.
      const tolerance = input.heightToleranceMm;
      const enough = tolerance === null ? null : dof >= tolerance;
      checks.push({
        key: 'depthOfField',
        status: enough === null ? 'info' : enough ? 'pass' : 'warn',
        formula:
          `2 × F/${fmt(input.fNumber, 1)} × ${fmt(cMm, 5)} mm × (1 + ${fmt(beta, 4)}) ÷ ${fmt(beta, 4)}² = ${fmt(dof, 2)} mm` +
          (tolerance !== null ? ` ${enough ? '≥' : '<'} dung sai ${fmt(tolerance)} mm` : ''),
        noteKey: enough === false ? 'dofTooShallow' : undefined,
        noteValues: { dof },
      });
    }
  }

  return checks;
}
