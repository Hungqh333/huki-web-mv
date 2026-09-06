import type { InputValue, SelectorInput } from './types';

/**
 * Catalog các trường nhập liệu (CLAUDE.md mục 4).
 *
 * Bài toán nào dùng trường nào là do dữ liệu quyết định — cột
 * task_types.input_fields trong database. Ở đây chỉ định nghĩa mỗi trường
 * NGHĨA LÀ GÌ: kiểu dữ liệu, đơn vị, danh sách lựa chọn.
 *
 * Thêm bài toán mới dùng lại các trường sẵn có = chỉ INSERT dữ liệu.
 * Chỉ khi cần một kiểu trường chưa từng có mới phải sửa file này.
 */

export type FieldKind = 'number' | 'select' | 'multiselect' | 'boolean';

export type FieldOption = {
  value: string;
  /** Khoá i18n dưới namespace selector.options */
  labelKey: string;
};

/**
 * Nhóm câu hỏi. Chia form thành nhiều bước theo CHỦ ĐỀ chứ không theo linh kiện:
 * camera/lens/đèn ràng buộc lẫn nhau nên không hỏi rời từng cụm được, còn các
 * câu hỏi thì tách theo chủ đề rất tự nhiên.
 */
export type FieldGroup = 'subject' | 'line' | 'environment' | 'system';

/** Thứ tự hỏi. Bước nào không có trường nào thì tự ẩn. */
export const FIELD_GROUPS: FieldGroup[] = ['subject', 'line', 'environment', 'system'];

export type FieldDef = {
  key: string;
  group: FieldGroup;
  /**
   * Khoá i18n cho dòng giải thích dưới ô nhập. Chỉ đặt khi thật sự cần — mỗi
   * dòng hint thêm vào là một dòng nữa người dùng phải đọc.
   */
  hintKey?: string;
  /** Chiếm trọn hàng trong lưới hai cột — dùng cho ô có hướng dẫn dài. */
  wide?: boolean;
  /**
   * Chỉ hỏi ô này khi một trường khác đang mang giá trị nhất định.
   *
   * Ví dụ tốc độ băng tải chỉ có nghĩa khi chụp lúc vật đang chạy — hỏi nó
   * cho bài chụp tĩnh là bắt người dùng nhập một con số vô nghĩa, rồi con số
   * đó lại chui vào công thức nhoè chuyển động.
   */
  showWhen?: { field: string; in: string[] };
  /**
   * Khoá i18n trỏ tới một MẢNG {value, meaning} — hiện thành bảng tra thu gọn
   * dưới ô nhập. Dùng khi một dòng chữ không đủ: ví dụ chọn N theo mục tiêu
   * kiểm tra thì phải thấy cả bốn mức mới so sánh được.
   */
  guideKey?: string;
  kind: FieldKind;
  /** Khoá i18n dưới namespace selector.fields */
  labelKey: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  options?: FieldOption[];
};

const SURFACE_OPTIONS: FieldOption[] = [
  { value: 'reflective', labelKey: 'surface.reflective' },
  { value: 'transparent', labelKey: 'surface.transparent' },
  { value: 'metal', labelKey: 'surface.metal' },
  { value: 'multicolor', labelKey: 'surface.multicolor' },
  { value: 'matte', labelKey: 'surface.matte' },
  { value: 'other', labelKey: 'surface.other' },
];

const ENVIRONMENT_OPTIONS: FieldOption[] = [
  { value: 'vibration', labelKey: 'environment.vibration' },
  { value: 'dust', labelKey: 'environment.dust' },
  { value: 'humidity', labelKey: 'environment.humidity' },
  { value: 'high_temp', labelKey: 'environment.high_temp' },
  { value: 'ambient_light', labelKey: 'environment.ambient_light' },
];

const IP_RATING_OPTIONS: FieldOption[] = [
  { value: 'none', labelKey: 'ipRating.none' },
  { value: 'ip54', labelKey: 'ipRating.ip54' },
  { value: 'ip65', labelKey: 'ipRating.ip65' },
  { value: 'ip67', labelKey: 'ipRating.ip67' },
];

const CAPTURE_MODE_OPTIONS: FieldOption[] = [
  { value: 'static', labelKey: 'captureMode.static' },
  { value: 'moving_area', labelKey: 'captureMode.moving_area' },
  { value: 'line_scan', labelKey: 'captureMode.line_scan' },
];

const DEFECT_TYPE_OPTIONS: FieldOption[] = [
  { value: 'scratch', labelKey: 'defectType.scratch' },
  { value: 'glossy_curved', labelKey: 'defectType.glossy_curved' },
  { value: 'print_color', labelKey: 'defectType.print_color' },
  { value: 'profile_hole_burr', labelKey: 'defectType.profile_hole_burr' },
  { value: 'shallow_dent', labelKey: 'defectType.shallow_dent' },
  { value: 'transparent', labelKey: 'defectType.transparent' },
];

const PIXEL_FORMAT_OPTIONS: FieldOption[] = [
  { value: 'Mono8', labelKey: 'pixelFormat.Mono8' },
  { value: 'BayerRG8', labelKey: 'pixelFormat.BayerRG8' },
  { value: 'Mono12packed', labelKey: 'pixelFormat.Mono12packed' },
  { value: 'Mono16', labelKey: 'pixelFormat.Mono16' },
  { value: 'RGB8', labelKey: 'pixelFormat.RGB8' },
];

const VARIABILITY_OPTIONS: FieldOption[] = [
  { value: 'low', labelKey: 'variability.low' },
  { value: 'medium', labelKey: 'variability.medium' },
  { value: 'high', labelKey: 'variability.high' },
];

const MEASURE_TYPE_OPTIONS: FieldOption[] = [
  { value: 'dimension', labelKey: 'measureType.dimension' },
  { value: 'diameter', labelKey: 'measureType.diameter' },
  { value: 'angle', labelKey: 'measureType.angle' },
  { value: 'position', labelKey: 'measureType.position' },
];

const CODE_TYPE_OPTIONS: FieldOption[] = [
  { value: 'barcode_1d', labelKey: 'codeType.barcode_1d' },
  { value: 'datamatrix', labelKey: 'codeType.datamatrix' },
  { value: 'qr', labelKey: 'codeType.qr' },
  { value: 'dpm', labelKey: 'codeType.dpm' },
];

const PRINT_CONTRAST_OPTIONS: FieldOption[] = [
  { value: 'high', labelKey: 'printContrast.high' },
  { value: 'medium', labelKey: 'printContrast.medium' },
  { value: 'low', labelKey: 'printContrast.low' },
];

const GUIDANCE_MODE_OPTIONS: FieldOption[] = [
  { value: 'plane_2d', labelKey: 'guidanceMode.plane_2d' },
  { value: 'pose_3d', labelKey: 'guidanceMode.pose_3d' },
  { value: 'bin_picking', labelKey: 'guidanceMode.bin_picking' },
];

export const FIELD_CATALOG: Record<string, FieldDef> = {
  fov_width_mm: {
    key: 'fov_width_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'fov_width_mm',
    unit: 'mm',
    min: 0.1,
    step: 0.1,
    required: true,
  },
  fov_height_mm: {
    key: 'fov_height_mm',
    showWhen: { field: 'capture_mode', in: ['static', 'moving_area'] },
    group: 'subject',
    kind: 'number',
    labelKey: 'fov_height_mm',
    unit: 'mm',
    min: 0.1,
    step: 0.1,
    required: true,
  },
  tolerance_mm: {
    key: 'tolerance_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'tolerance_mm',
    unit: 'mm',
    min: 0.001,
    step: 0.001,
    required: true,
  },
  working_distance_mm: {
    key: 'working_distance_mm',
    group: 'line',
    kind: 'number',
    labelKey: 'working_distance_mm',
    unit: 'mm',
    min: 1,
    step: 1,
  },
  throughput_ppm: {
    key: 'throughput_ppm',
    group: 'line',
    kind: 'number',
    labelKey: 'throughput_ppm',
    unit: 'part/min',
    min: 0,
    step: 1,
  },
  line_speed_mms: {
    key: 'line_speed_mms',
    showWhen: { field: 'capture_mode', in: ['moving_area', 'line_scan'] },
    group: 'line',
    kind: 'number',
    labelKey: 'line_speed_mms',
    unit: 'mm/s',
    min: 0,
    step: 1,
  },
  surface: {
    key: 'surface',
    group: 'subject',
    kind: 'select',
    labelKey: 'surface',
    options: SURFACE_OPTIONS,
    required: true,
  },
  environment: {
    key: 'environment',
    group: 'environment',
    kind: 'multiselect',
    labelKey: 'environment',
    options: ENVIRONMENT_OPTIONS,
  },
  ip_rating: {
    key: 'ip_rating',
    group: 'environment',
    kind: 'select',
    labelKey: 'ip_rating',
    options: IP_RATING_OPTIONS,
  },
  rotation_range_deg: {
    key: 'rotation_range_deg',
    group: 'subject',
    kind: 'number',
    labelKey: 'rotation_range_deg',
    unit: '°',
    min: 0,
    max: 360,
    step: 1,
  },
  defect_min_size_mm: {
    key: 'defect_min_size_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'defect_min_size_mm',
    unit: 'mm',
    min: 0.001,
    step: 0.001,
    required: true,
  },
  defect_variability: {
    key: 'defect_variability',
    group: 'subject',
    kind: 'select',
    labelKey: 'defect_variability',
    options: VARIABILITY_OPTIONS,
    required: true,
  },
  color_critical: {
    key: 'color_critical',
    group: 'subject',
    kind: 'boolean',
    labelKey: 'color_critical',
  },
  measure_type: {
    key: 'measure_type',
    group: 'subject',
    kind: 'select',
    labelKey: 'measure_type',
    options: MEASURE_TYPE_OPTIONS,
    required: true,
  },
  perspective_free: {
    key: 'perspective_free',
    group: 'subject',
    kind: 'boolean',
    labelKey: 'perspective_free',
  },

  // --- Bài toán phase 2 -------------------------------------------------------

  // 3D
  height_range_mm: {
    key: 'height_range_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'height_range_mm',
    unit: 'mm',
    min: 0.01,
    step: 0.1,
    required: true,
  },
  z_resolution_mm: {
    key: 'z_resolution_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'z_resolution_mm',
    unit: 'mm',
    min: 0.0001,
    step: 0.001,
    required: true,
  },

  // OCR / OCV
  character_height_mm: {
    key: 'character_height_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'character_height_mm',
    unit: 'mm',
    min: 0.1,
    step: 0.1,
    required: true,
  },
  print_contrast: {
    key: 'print_contrast',
    group: 'subject',
    kind: 'select',
    labelKey: 'print_contrast',
    options: PRINT_CONTRAST_OPTIONS,
    required: true,
  },

  // Đọc mã vạch
  code_type: {
    key: 'code_type',
    group: 'subject',
    kind: 'select',
    labelKey: 'code_type',
    options: CODE_TYPE_OPTIONS,
    required: true,
  },
  module_size_mm: {
    key: 'module_size_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'module_size_mm',
    unit: 'mm',
    min: 0.01,
    step: 0.01,
    required: true,
  },

  // Robot guidance
  guidance_mode: {
    key: 'guidance_mode',
    group: 'subject',
    kind: 'select',
    labelKey: 'guidance_mode',
    options: GUIDANCE_MODE_OPTIONS,
    required: true,
  },
  pick_accuracy_mm: {
    key: 'pick_accuracy_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'pick_accuracy_mm',
    unit: 'mm',
    min: 0.01,
    step: 0.01,
    required: true,
  },

  // --- Kiểm tra ngoại quan: tham số của bộ tính toán quang học/thời gian ---

  /**
   * Câu hỏi quyết định cả bộ công thức phía sau, nên đặt đầu tiên.
   *
   * Chụp tĩnh thì không có nhoè chuyển động. Line scan thì không có chiều
   * cao FOV, và độ phân giải dọc đường chạy do tốc độ chia tần số dòng quyết
   * định chứ không phải do cảm biến.
   */
  capture_mode: {
    key: 'capture_mode',
    group: 'subject',
    kind: 'select',
    labelKey: 'capture_mode',
    hintKey: 'capture_modeHint',
    options: CAPTURE_MODE_OPTIONS,
    required: true,
    wide: true,
  },

  /** Chụp tĩnh: cơ cấu dừng rồi mới chụp, phải chờ hết rung. */
  settle_time_ms: {
    key: 'settle_time_ms',
    group: 'line',
    kind: 'number',
    labelKey: 'settle_time_ms',
    hintKey: 'settle_time_msHint',
    unit: 'ms',
    min: 0,
    step: 1,
    showWhen: { field: 'capture_mode', in: ['static'] },
  },

  /** Động area scan: sai lệch thời điểm trigger đổi thành sai lệch vị trí. */
  trigger_jitter_ms: {
    key: 'trigger_jitter_ms',
    group: 'line',
    kind: 'number',
    labelKey: 'trigger_jitter_ms',
    hintKey: 'trigger_jitter_msHint',
    unit: 'ms',
    min: 0,
    step: 0.1,
    showWhen: { field: 'capture_mode', in: ['moving_area'] },
  },

  /** Line scan: không có encoder thì độ phân giải dọc trôi theo tốc độ. */
  encoder_resolution_um: {
    key: 'encoder_resolution_um',
    group: 'line',
    kind: 'number',
    labelKey: 'encoder_resolution_um',
    hintKey: 'encoder_resolution_umHint',
    unit: 'µm/xung',
    min: 0.1,
    step: 0.1,
    showWhen: { field: 'capture_mode', in: ['line_scan'] },
  },

  /** N — số pixel phủ lên lỗi nhỏ nhất. Trước đây đóng cứng ở 3. */
  px_per_defect: {
    key: 'px_per_defect',
    group: 'subject',
    kind: 'number',
    labelKey: 'px_per_defect',
    guideKey: 'px_per_defectGuide',
    unit: 'px',
    min: 1,
    step: 1,
    required: true,
  },
  defect_type: {
    key: 'defect_type',
    group: 'subject',
    kind: 'select',
    labelKey: 'defect_type',
    hintKey: 'defect_typeHint',
    options: DEFECT_TYPE_OPTIONS,
  },
  height_tolerance_mm: {
    key: 'height_tolerance_mm',
    group: 'subject',
    kind: 'number',
    labelKey: 'height_tolerance_mm',
    hintKey: 'height_tolerance_mmHint',
    unit: 'mm',
    min: 0,
    step: 0.1,
  },

  n_view: {
    key: 'n_view',
    showWhen: { field: 'capture_mode', in: ['static', 'moving_area'] },
    group: 'line',
    kind: 'number',
    labelKey: 'n_view',
    hintKey: 'n_viewHint',
    min: 1,
    step: 1,
  },
  duty_percent: {
    key: 'duty_percent',
    showWhen: { field: 'capture_mode', in: ['static', 'moving_area'] },
    group: 'line',
    kind: 'number',
    labelKey: 'duty_percent',
    hintKey: 'duty_percentHint',
    unit: '%',
    min: 1,
    max: 100,
    step: 1,
  },
  total_length_mm: {
    key: 'total_length_mm',
    group: 'line',
    kind: 'number',
    labelKey: 'total_length_mm',
    hintKey: 'total_length_mmHint',
    unit: 'mm',
    min: 0,
    step: 1,
  },

  pixel_format: {
    key: 'pixel_format',
    group: 'system',
    kind: 'select',
    labelKey: 'pixel_format',
    hintKey: 'pixel_formatHint',
    options: PIXEL_FORMAT_OPTIONS,
  },
  f_number: {
    key: 'f_number',
    group: 'system',
    kind: 'number',
    labelKey: 'f_number',
    hintKey: 'f_numberHint',
    min: 1,
    step: 0.1,
  },
  blur_px: {
    key: 'blur_px',
    showWhen: { field: 'capture_mode', in: ['moving_area'] },
    group: 'system',
    kind: 'number',
    labelKey: 'blur_px',
    hintKey: 'blur_pxHint',
    unit: 'px',
    min: 0.1,
    step: 0.1,
  },
  overlap_percent: {
    key: 'overlap_percent',
    group: 'system',
    kind: 'number',
    labelKey: 'overlap_percent',
    hintKey: 'overlap_percentHint',
    unit: '%',
    min: 0,
    max: 50,
    step: 1,
  },
  exposure_ms: {
    key: 'exposure_ms',
    group: 'system',
    kind: 'number',
    labelKey: 'exposure_ms',
    hintKey: 'exposure_msHint',
    unit: 'ms',
    min: 0.01,
    step: 0.1,
  },
  process_ms: {
    key: 'process_ms',
    group: 'system',
    kind: 'number',
    labelKey: 'process_ms',
    hintKey: 'process_msHint',
    unit: 'ms',
    min: 0,
    step: 1,
  },
};

export function getFieldDefs(keys: unknown): FieldDef[] {
  if (!Array.isArray(keys)) return [];
  return keys
    .filter((key): key is string => typeof key === 'string')
    .map((key) => FIELD_CATALOG[key])
    .filter((def): def is FieldDef => Boolean(def));
}

/** Key có trong input_fields nhưng chưa có trong catalog — cảnh báo cho admin. */
export function getUnknownFieldKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys.filter(
    (key): key is string => typeof key === 'string' && !FIELD_CATALOG[key]
  );
}

export type ParseResult = {
  input: SelectorInput;
  errors: Record<string, 'required' | 'invalid'>;
};

/** Đọc FormData theo đúng catalog. Bỏ qua mọi field lạ do client tự thêm. */
/**
 * Lọc ra những trường đang thực sự được hỏi.
 *
 * Dùng chung cho cả giao diện lẫn server: form ẩn ô nào thì server cũng phải
 * bỏ qua đúng ô đó, nếu không ô bắt buộc đang ẩn sẽ báo "thiếu dữ liệu" mà
 * người dùng không thấy nó ở đâu để điền.
 */
export function visibleFieldDefs(
  defs: FieldDef[],
  read: (key: string) => string | null
): FieldDef[] {
  return defs.filter((def) => {
    if (!def.showWhen) return true;
    const value = read(def.showWhen.field);
    return value !== null && def.showWhen.in.includes(value);
  });
}

export function parseInput(defs: FieldDef[], formData: FormData): ParseResult {
  const input: SelectorInput = {};
  const errors: Record<string, 'required' | 'invalid'> = {};

  for (const def of defs) {
    let value: InputValue = null;

    switch (def.kind) {
      case 'number': {
        const raw = formData.get(def.key);
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (text === '') {
          value = null;
        } else {
          const parsed = Number(text);
          if (!Number.isFinite(parsed)) {
            errors[def.key] = 'invalid';
          } else if (
            (def.min !== undefined && parsed < def.min) ||
            (def.max !== undefined && parsed > def.max)
          ) {
            errors[def.key] = 'invalid';
          } else {
            value = parsed;
          }
        }
        break;
      }

      case 'select': {
        const raw = formData.get(def.key);
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (text === '') {
          value = null;
        } else if (def.options?.some((option) => option.value === text)) {
          value = text;
        } else {
          errors[def.key] = 'invalid';
        }
        break;
      }

      case 'multiselect': {
        const allowed = new Set(def.options?.map((option) => option.value) ?? []);
        const picked = formData
          .getAll(def.key)
          .filter((entry): entry is string => typeof entry === 'string')
          .filter((entry) => allowed.has(entry));
        value = picked;
        break;
      }

      case 'boolean': {
        value = formData.get(def.key) === 'on' || formData.get(def.key) === 'true';
        break;
      }
    }

    if (def.required && !errors[def.key]) {
      const missing =
        value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (missing) errors[def.key] = 'required';
    }

    input[def.key] = value;
  }

  return { input, errors };
}
