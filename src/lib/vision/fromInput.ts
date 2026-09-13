import type { SelectorInput } from '@/lib/selector/types';
import { DEFAULT_APPEARANCE_INPUT, type AppearanceInput } from './index';

/**
 * Đổi dữ liệu người dùng nhập ở form thành đầu vào của bộ tính toán.
 *
 * Tách riêng khỏi component để test được, và để chỗ đọc form chỉ có MỘT: nếu
 * thiếu một trường thì mặc định nằm ở đây chứ không rải rác trong giao diện.
 */

const num = (input: SelectorInput, key: string): number | null => {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const str = (input: SelectorInput, key: string): string | null => {
  const value = input[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

/** Trả null khi thiếu ba tham số bắt buộc — không đoán thay người dùng. */
export function appearanceInputFromForm(input: SelectorInput): AppearanceInput | null {
  const fovWidthMm = num(input, 'fov_width_mm');
  const defectMinSizeMm = num(input, 'defect_min_size_mm');

  if (fovWidthMm === null || defectMinSizeMm === null) return null;

  /* Line scan không hỏi chiều cao FOV — ảnh dựng theo chiều quét nên không có
     giới hạn đó. Lấy tạm bằng bề rộng để các công thức chung vẫn chạy; nhánh
     line scan không dùng tới con số này. */
  const fovHeightMm = num(input, 'fov_height_mm') ?? fovWidthMm;

  const dutyPercent = num(input, 'duty_percent');
  const overlapPercent = num(input, 'overlap_percent');

  const mode = str(input, 'capture_mode');

  return {
    ...DEFAULT_APPEARANCE_INPUT,

    captureMode:
      mode === 'moving_area' || mode === 'line_scan' || mode === 'static'
        ? mode
        : DEFAULT_APPEARANCE_INPUT.captureMode,
    settleTimeMs: num(input, 'settle_time_ms') ?? DEFAULT_APPEARANCE_INPUT.settleTimeMs,
    triggerJitterMs: num(input, 'trigger_jitter_ms') ?? DEFAULT_APPEARANCE_INPUT.triggerJitterMs,
    encoderResolutionUm: num(input, 'encoder_resolution_um'),

    fovWidthMm,
    fovHeightMm,
    defectMinSizeMm,
    pxPerDefect: num(input, 'px_per_defect') ?? DEFAULT_APPEARANCE_INPUT.pxPerDefect,
    defectType: str(input, 'defect_type'),
    surface: str(input, 'surface'),
    heightToleranceMm: num(input, 'height_tolerance_mm'),
    measurementToleranceMm: num(input, 'measurement_tolerance_mm'),

    workingDistanceMm: num(input, 'working_distance_mm'),
    throughputPpm: num(input, 'throughput_ppm'),
    nView: num(input, 'n_view') ?? DEFAULT_APPEARANCE_INPUT.nView,
    dutyRatio: dutyPercent !== null ? dutyPercent / 100 : DEFAULT_APPEARANCE_INPUT.dutyRatio,
    speedMmS: num(input, 'line_speed_mms'),
    totalLengthMm: num(input, 'total_length_mm'),
    overlapRatio:
      overlapPercent !== null ? overlapPercent / 100 : DEFAULT_APPEARANCE_INPUT.overlapRatio,

    exposureMs: num(input, 'exposure_ms') ?? DEFAULT_APPEARANCE_INPUT.exposureMs,
    processMs: num(input, 'process_ms') ?? DEFAULT_APPEARANCE_INPUT.processMs,

    pixelFormat: str(input, 'pixel_format') ?? DEFAULT_APPEARANCE_INPUT.pixelFormat,
    blurPx: num(input, 'blur_px') ?? DEFAULT_APPEARANCE_INPUT.blurPx,
    fNumber: num(input, 'f_number'),
  };
}
