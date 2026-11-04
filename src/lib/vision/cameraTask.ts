import { targetMmPerPx, type AreaCameraInput, type CameraColorFilter } from './cameraSelector';
import { codeNeed, type CodeNeed, type CodeReaderInput } from './codeReader';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './engineParams';
import type { TriggerSource } from './highSpeed';
import { ocrGeometry, type OcrGeometry, type OcrGeometryInput } from './ocr';
import { measurementBudget, type MeasurementBudget } from './resolution';

/**
 * Ô "Bài toán" của trang Chọn camera area scan (chốt 2026-10-31, Q1–Q5). Mỗi bài toán ra
 * mm/px cần và vùng nhìn theo luật riêng, rồi đi chung bộ kiểm camera (CAM-001/002):
 *
 * - Kiểm tra ngoại quan: lỗi nhỏ nhất ÷ px/lỗi theo độ tương phản (RES-001), nhoè 1 px.
 * - Đo lường: ±t → T = 2t → U = T ÷ 10 → mm/px = 3U (RES-002, cùng hàm với Thiết kế hệ thống), nhoè 0,5 px.
 * - OCR/OCV: OCR-001 — cùng hàm với /chon-ocr; vùng nhìn tự tính từ khối chữ.
 * - Đọc mã: COD-001/002 — cùng hàm với /chon-doc-ma; vùng nhìn + fps đọc đủ N lần tự tính.
 * - Dẫn hướng robot: ROB-001 (dưới đây) — chỉ 2D; vật cần biết chiều cao / nghiêng thì báo cần 3D.
 *
 * Ô "mm/px nhập thẳng" ghi đè mm/px của mọi bài toán; vùng nhìn tự tính vẫn giữ. Hàm thuần.
 */

export type CameraTask = 'inspection' | 'measurement' | 'ocr' | 'code' | 'robot';
export const CAMERA_TASKS: readonly CameraTask[] = ['inspection', 'measurement', 'ocr', 'code', 'robot'];

/** Tham số `?bai-toan=` trên URL — gửi link cho người khác mở đúng bài toán. */
export const TASK_SLUG: Record<CameraTask, string> = { inspection: 'ngoai-quan', measurement: 'do-luong', ocr: 'ocr', code: 'doc-ma', robot: 'robot' };
export function taskFromSlug(slug: string | null | undefined): CameraTask {
  return CAMERA_TASKS.find((task) => TASK_SLUG[task] === slug) ?? 'inspection';
}

/** Màu camera mặc định khi chọn bài toán: đo, đọc chữ, đọc mã chạy mono. */
export const TASK_DEFAULT_COLOR: Record<CameraTask, CameraColorFilter> = { inspection: 'any', measurement: 'mono', ocr: 'mono', code: 'mono', robot: 'any' };
/** Bài đo và định vị dùng nhoè chặt (blurPxAllowed); phát hiện lỗi / đọc chữ / đọc mã dùng blurPxDetect. */
export const TASK_MEASURING: Record<CameraTask, boolean> = { inspection: false, measurement: true, ocr: false, code: false, robot: true };

// ═══════════════════════════════════════════════════════════════ ROB-001 ══

export type RobotInput = {
  /** Độ chính xác gắp / đặt cần (±a), mm. */
  accuracyMm: number;
  /** Vùng vật có thể nằm (tâm vật chạy trong vùng này), mm. */
  areaWidthMm: number;
  areaHeightMm: number;
  /** Cỡ vật, mm — cộng vào vùng nhìn để vật luôn nằm trọn trong ảnh. */
  partWidthMm: number;
  partHeightMm: number;
  /** Vật đổi chiều cao hoặc cần biết góc nghiêng ngoài mặt phẳng. */
  needs3d: boolean;
};

export type RobotNeed = {
  /** Phần sai số dành cho vision = a ÷ robotVisionDivisor (mm). */
  visionBudgetMm: number;
  mmPerPx: number;
  fovWidthMm: number;
  fovHeightMm: number;
  needs3d: boolean;
};

/**
 * ROB-001: vision được a ÷ 3 (phần còn lại cho độ lặp lại robot + hiệu chuẩn tay–mắt); tìm mẫu
 * lặp lại được 1/3 px nên một pixel được lớn gấp 3 phần đó: mm/px = a ÷ 3 × 3 = a.
 * Vùng nhìn = vùng vật có thể nằm + cỡ vật mỗi trục.
 */
export function robotNeed(input: RobotInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): RobotNeed {
  const visionBudgetMm = input.accuracyMm / params.robotVisionDivisor;
  return {
    visionBudgetMm,
    mmPerPx: visionBudgetMm * params.robotSubpixel,
    fovWidthMm: input.areaWidthMm + input.partWidthMm,
    fovHeightMm: input.areaHeightMm + input.partHeightMm,
    needs3d: input.needs3d,
  };
}

// ═════════════════════════════════════════════════════ GỘP THEO BÀI TOÁN ══

export type CodeTaskInput = Pick<CodeReaderInput, 'codeType' | 'moduleMm' | 'codeWidthMm' | 'codeHeightMm' | 'toleranceXMm' | 'toleranceYMm' | 'motionAxis'>;

export type TaskInput =
  | { task: 'inspection'; fovWidthMm: number; fovHeightMm: number; defectMm: number | null; contrast: 'high' | 'medium' | 'low' | 'unknown' }
  | { task: 'measurement'; fovWidthMm: number; fovHeightMm: number; toleranceMm: number | null }
  | { task: 'ocr'; ocr: OcrGeometryInput }
  | { task: 'code'; code: CodeTaskInput }
  | { task: 'robot'; robot: RobotInput };

/** Phần chung mọi bài toán: ô ghi đè mm/px, màu, khung Tốc độ. */
export type TaskCommon = {
  mmPerPxOverride: number | null;
  color: CameraColorFilter;
  speedMmS: number | null;
  partsPerMinute: number | null;
  imagesPerPart: number;
  triggerSource: TriggerSource;
  sensorResponseMs: number | null;
  sampleExposureMs: number | null;
  overlapped: boolean;
};

export type TaskDetail =
  | { task: 'inspection'; pxPerDefect: number | null }
  | { task: 'measurement'; budget: MeasurementBudget | null }
  | { task: 'ocr'; geometry: OcrGeometry }
  | { task: 'code'; need: CodeNeed }
  | { task: 'robot'; need: RobotNeed };

export type TaskCamera = {
  /** mm/px theo luật của bài toán; null khi chỉ có số nhập thẳng. */
  derivedMmPerPx: number | null;
  /** Ô nhập thẳng đang ghi đè mm/px. */
  overridden: boolean;
  detail: TaskDetail;
  camera: AreaCameraInput;
};

/** Bài toán → đầu vào bộ kiểm camera area scan. null khi chưa đủ số để có mm/px hoặc vùng nhìn. */
export function taskCamera(input: TaskInput, common: TaskCommon, params: EngineParams = DEFAULT_ENGINE_PARAMS): TaskCamera | null {
  const override = common.mmPerPxOverride !== null && common.mmPerPxOverride > 0 ? common.mmPerPxOverride : null;
  const base = {
    color: common.color,
    measuring: TASK_MEASURING[input.task],
    speedMmS: common.speedMmS,
    partsPerMinute: common.partsPerMinute,
    imagesPerPart: Math.max(1, common.imagesPerPart),
    triggerSource: common.triggerSource,
    sensorResponseMs: common.sensorResponseMs,
    sampleExposureMs: common.sampleExposureMs,
    overlapped: common.overlapped,
  };
  const build = (derived: number | null, fovWidthMm: number, fovHeightMm: number, detail: TaskDetail, extra: Partial<AreaCameraInput> = {}): TaskCamera | null => {
    const mmPerPx = override ?? derived;
    if (mmPerPx === null || !(mmPerPx > 0) || !(fovWidthMm > 0) || !(fovHeightMm > 0)) return null;
    return {
      derivedMmPerPx: derived,
      overridden: override !== null,
      detail,
      camera: { ...base, fovWidthMm, fovHeightMm, targetMmPerPx: mmPerPx, ...extra },
    };
  };

  switch (input.task) {
    case 'inspection': {
      const fromDefect = targetMmPerPx({ mmPerPx: null, defectMm: input.defectMm, contrast: input.contrast }, params);
      return build(fromDefect?.mmPerPx ?? null, input.fovWidthMm, input.fovHeightMm, { task: 'inspection', pxPerDefect: fromDefect?.pxPerDefect ?? null });
    }
    case 'measurement': {
      const budget = measurementBudget(input.toleranceMm);
      return build(budget?.mmPerPx ?? null, input.fovWidthMm, input.fovHeightMm, { task: 'measurement', budget });
    }
    case 'ocr': {
      const geometry = ocrGeometry(input.ocr, params);
      return build(geometry.mmPerPx, geometry.fovWidthMm, geometry.fovHeightMm, { task: 'ocr', geometry });
    }
    case 'code': {
      const need = codeNeed(
        { ...input.code, speedMmS: common.speedMmS, fovAlongMm: null, partsPerMinute: common.partsPerMinute, minReads: params.codeMinReads, workingDistanceMm: null },
        params
      );
      // Như /chon-doc-ma: fps cần (đọc đủ N lần hoặc theo sản lượng) đưa vào dạng "ảnh/phút", 1 ảnh mỗi lượt.
      return build(need.mmPerPx, need.fovWidthMm, need.fovHeightMm, { task: 'code', need }, {
        partsPerMinute: need.fpsNeeded !== null ? need.fpsNeeded * 60 : null,
        imagesPerPart: 1,
      });
    }
    case 'robot': {
      const need = robotNeed(input.robot, params);
      return build(need.mmPerPx, need.fovWidthMm, need.fovHeightMm, { task: 'robot', need });
    }
  }
}
