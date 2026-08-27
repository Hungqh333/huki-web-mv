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

export type FieldDef = {
  key: string;
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
    kind: 'number',
    labelKey: 'fov_width_mm',
    unit: 'mm',
    min: 0.1,
    step: 0.1,
    required: true,
  },
  fov_height_mm: {
    key: 'fov_height_mm',
    kind: 'number',
    labelKey: 'fov_height_mm',
    unit: 'mm',
    min: 0.1,
    step: 0.1,
    required: true,
  },
  tolerance_mm: {
    key: 'tolerance_mm',
    kind: 'number',
    labelKey: 'tolerance_mm',
    unit: 'mm',
    min: 0.001,
    step: 0.001,
    required: true,
  },
  working_distance_mm: {
    key: 'working_distance_mm',
    kind: 'number',
    labelKey: 'working_distance_mm',
    unit: 'mm',
    min: 1,
    step: 1,
  },
  throughput_ppm: {
    key: 'throughput_ppm',
    kind: 'number',
    labelKey: 'throughput_ppm',
    unit: 'part/min',
    min: 0,
    step: 1,
  },
  line_speed_mms: {
    key: 'line_speed_mms',
    kind: 'number',
    labelKey: 'line_speed_mms',
    unit: 'mm/s',
    min: 0,
    step: 1,
  },
  surface: {
    key: 'surface',
    kind: 'select',
    labelKey: 'surface',
    options: SURFACE_OPTIONS,
    required: true,
  },
  environment: {
    key: 'environment',
    kind: 'multiselect',
    labelKey: 'environment',
    options: ENVIRONMENT_OPTIONS,
  },
  ip_rating: {
    key: 'ip_rating',
    kind: 'select',
    labelKey: 'ip_rating',
    options: IP_RATING_OPTIONS,
  },
  rotation_range_deg: {
    key: 'rotation_range_deg',
    kind: 'number',
    labelKey: 'rotation_range_deg',
    unit: '°',
    min: 0,
    max: 360,
    step: 1,
  },
  defect_min_size_mm: {
    key: 'defect_min_size_mm',
    kind: 'number',
    labelKey: 'defect_min_size_mm',
    unit: 'mm',
    min: 0.001,
    step: 0.001,
    required: true,
  },
  defect_variability: {
    key: 'defect_variability',
    kind: 'select',
    labelKey: 'defect_variability',
    options: VARIABILITY_OPTIONS,
    required: true,
  },
  color_critical: {
    key: 'color_critical',
    kind: 'boolean',
    labelKey: 'color_critical',
  },
  measure_type: {
    key: 'measure_type',
    kind: 'select',
    labelKey: 'measure_type',
    options: MEASURE_TYPE_OPTIONS,
    required: true,
  },
  perspective_free: {
    key: 'perspective_free',
    kind: 'boolean',
    labelKey: 'perspective_free',
  },

  // --- Bài toán phase 2 -------------------------------------------------------

  // 3D
  height_range_mm: {
    key: 'height_range_mm',
    kind: 'number',
    labelKey: 'height_range_mm',
    unit: 'mm',
    min: 0.01,
    step: 0.1,
    required: true,
  },
  z_resolution_mm: {
    key: 'z_resolution_mm',
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
    kind: 'number',
    labelKey: 'character_height_mm',
    unit: 'mm',
    min: 0.1,
    step: 0.1,
    required: true,
  },
  print_contrast: {
    key: 'print_contrast',
    kind: 'select',
    labelKey: 'print_contrast',
    options: PRINT_CONTRAST_OPTIONS,
    required: true,
  },

  // Đọc mã vạch
  code_type: {
    key: 'code_type',
    kind: 'select',
    labelKey: 'code_type',
    options: CODE_TYPE_OPTIONS,
    required: true,
  },
  module_size_mm: {
    key: 'module_size_mm',
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
    kind: 'select',
    labelKey: 'guidance_mode',
    options: GUIDANCE_MODE_OPTIONS,
    required: true,
  },
  pick_accuracy_mm: {
    key: 'pick_accuracy_mm',
    kind: 'number',
    labelKey: 'pick_accuracy_mm',
    unit: 'mm',
    min: 0.01,
    step: 0.01,
    required: true,
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
