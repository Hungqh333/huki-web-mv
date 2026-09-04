import { SENSOR_FORMATS, sensorDiagonalMm } from '@/lib/components/specs';
import { fmt, round, type Check } from './types';

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
