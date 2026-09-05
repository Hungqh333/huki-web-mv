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
  const fovHeightMm = num(input, 'fov_height_mm');
  const defectMinSizeMm = num(input, 'defect_min_size_mm');

  if (fovWidthMm === null || fovHeightMm === null || defectMinSizeMm === null) return null;

  const dutyPercent = num(input, 'duty_percent');
  const overlapPercent = num(input, 'overlap_percent');

  return {
    ...DEFAULT_APPEARANCE_INPUT,

    fovWidthMm,
    fovHeightMm,
    defectMinSizeMm,
    pxPerDefect: num(input, 'px_per_defect') ?? DEFAULT_APPEARANCE_INPUT.pxPerDefect,
    defectType: str(input, 'defect_type'),
    surface: str(input, 'surface'),
    heightToleranceMm: num(input, 'height_tolerance_mm'),

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
