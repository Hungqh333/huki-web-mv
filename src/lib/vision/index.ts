import { lightingChecks } from './lighting';
import { opticsChecks } from './optics';
import { DEFAULT_PX_PER_DEFECT, resolutionChecks, requiredPixels, verifyResolution } from './resolution';
import { DEFAULT_PIXEL_FORMAT, timingChecks } from './timing';
import type { CameraLike, Check, CheckStatus } from './types';

export * from './types';
export * from './resolution';
export * from './timing';
export * from './optics';
export * from './lighting';

/**
 * Bộ tính toán cho bài Kiểm tra ngoại quan.
 *
 * Gom bốn nhóm phép kiểm thành một kết quả có thứ tự. Toàn bộ là hàm thuần nên
 * chạy được cả ở server lẫn trình duyệt, và test được từng phép một.
 */

export type AppearanceInput = {
  // Vật thể & lỗi
  fovWidthMm: number;
  fovHeightMm: number;
  defectMinSizeMm: number;
  /** N — số pixel phủ lên lỗi nhỏ nhất. Xem PX_PER_DEFECT_GUIDE. */
  pxPerDefect: number;
  defectType: string | null;
  surface: string | null;
  heightToleranceMm: number | null;

  // Dây chuyền
  workingDistanceMm: number | null;
  throughputPpm: number | null;
  /** Số ảnh chụp cho mỗi sản phẩm. */
  nView: number;
  /** Tỉ lệ thời gian sản phẩm nằm trong tầm nhìn (0–1). */
  dutyRatio: number;
  speedMmS: number | null;
  totalLengthMm: number | null;
  overlapRatio: number;

  // Thời gian thành phần (ms)
  triggerMs: number;
  readoutMs: number;
  processMs: number;
  outputMs: number;
  /** Phơi sáng mong muốn; sẽ bị siết xuống nếu nhoè chuyển động đòi ngắn hơn. */
  exposureMs: number;

  // Ảnh & quang học
  pixelFormat: string;
  blurPx: number;
  fNumber: number | null;
  circleOfConfusionPx: number;
};

export type AppearanceSection = {
  key: 'resolution' | 'timing' | 'optics' | 'lighting';
  checks: Check[];
};

export type AppearanceAnalysis = {
  sections: AppearanceSection[];
  /** Trạng thái xấu nhất trong toàn bộ phép kiểm. */
  overall: CheckStatus;
  /**
   * Cảnh báo cố định, LUÔN hiển thị dù mọi phép kiểm đều đạt.
   *
   * Đủ độ phân giải chỉ nói lên lỗi đủ lớn trong ảnh, không nói lên nó có nổi
   * bật khỏi nền hay không. Đây là ranh giới mà không công thức nào vượt qua
   * được — phải chụp mẫu thật.
   */
  standingWarningKey: 'contrastDisclaimer';
};

export const DEFAULT_APPEARANCE_INPUT: Pick<
  AppearanceInput,
  | 'pxPerDefect'
  | 'nView'
  | 'dutyRatio'
  | 'overlapRatio'
  | 'triggerMs'
  | 'readoutMs'
  | 'processMs'
  | 'outputMs'
  | 'exposureMs'
  | 'pixelFormat'
  | 'blurPx'
  | 'circleOfConfusionPx'
> = {
  pxPerDefect: DEFAULT_PX_PER_DEFECT,
  nView: 1,
  dutyRatio: 0.5,
  overlapRatio: 0.1,
  triggerMs: 1,
  readoutMs: 5,
  processMs: 20,
  outputMs: 2,
  exposureMs: 5,
  pixelFormat: DEFAULT_PIXEL_FORMAT,
  blurPx: 1,
  circleOfConfusionPx: 2,
};

const SEVERITY: Record<CheckStatus, number> = { info: 0, pass: 1, warn: 2, fail: 3 };

export function worstStatus(checks: Check[]): CheckStatus {
  let worst: CheckStatus = 'info';
  for (const check of checks) {
    if (SEVERITY[check.status] > SEVERITY[worst]) worst = check.status;
  }
  return worst;
}

export function analyseAppearance(
  input: AppearanceInput,
  camera: CameraLike | null,
  lens: { imageCircleFormat: string | null } | null
): AppearanceAnalysis {
  const resolution = resolutionChecks(input, camera);

  // mm/px thật của camera đã chọn — nhoè chuyển động phải tính trên con số này,
  // không phải trên mục tiêu lý thuyết.
  const need = requiredPixels(input);
  const verdict = camera ? verifyResolution(camera, input) : null;
  const mmPerPx = verdict
    ? Math.max(verdict.mmPerPxX, verdict.mmPerPxY)
    : (need?.mmPerPxTarget ?? null);

  const cameraCountForBandwidth =
    input.totalLengthMm && input.totalLengthMm > 0
      ? Math.ceil(input.totalLengthMm / (input.fovWidthMm * (1 - input.overlapRatio)))
      : 1;

  const timing = timingChecks({
    widthPx: camera?.widthPx ?? null,
    heightPx: camera?.heightPx ?? null,
    pixelFormat: input.pixelFormat,
    interfaceName: camera?.interfaceName ?? null,
    cameraCount: cameraCountForBandwidth,
    throughputPpm: input.throughputPpm,
    dutyRatio: input.dutyRatio,
    nView: input.nView,
    triggerMs: input.triggerMs,
    readoutMs: input.readoutMs,
    processMs: input.processMs,
    outputMs: input.outputMs,
    exposureMs: input.exposureMs,
    speedMmS: input.speedMmS,
    blurPx: input.blurPx,
    mmPerPx,
  });

  const optics = opticsChecks({
    fovWidthMm: input.fovWidthMm,
    workingDistanceMm: input.workingDistanceMm,
    sensorFormat: camera?.sensorFormat ?? null,
    pixelSizeUm: camera?.pixelSizeUm ?? null,
    fNumber: input.fNumber,
    lensImageCircleFormat: lens?.imageCircleFormat ?? null,
    heightToleranceMm: input.heightToleranceMm,
    circleOfConfusionPx: input.circleOfConfusionPx,
  });

  const lighting = lightingChecks({ defectType: input.defectType, surface: input.surface });

  const sections: AppearanceSection[] = [
    { key: 'resolution', checks: resolution },
    { key: 'timing', checks: timing },
    { key: 'optics', checks: optics },
    { key: 'lighting', checks: lighting },
  ];

  return {
    sections,
    overall: worstStatus(sections.flatMap((section) => section.checks)),
    standingWarningKey: 'contrastDisclaimer',
  };
}
