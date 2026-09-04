/**
 * Ý nghĩa các khoá `spec` của bảng components.
 *
 * Bảng chỉ có một cột jsonb; file này là nơi DUY NHẤT định nghĩa khoá nào có
 * nghĩa gì với loại linh kiện nào — giống vai trò của fields.ts với trường nhập
 * liệu. Thêm thiết bị mới = chỉ thêm dữ liệu. Chỉ khi cần một loại thông số
 * chưa từng có mới phải sửa file này.
 */

export type ComponentKind = 'camera' | 'lens' | 'light' | 'controller' | 'accessory';

/** Thông số đã đối chiếu tới đâu. Giao diện phải hiện cờ này. */
export type ComponentSource = 'unverified' | 'datasheet' | 'measured';

export type Component = {
  id: string;
  code: string;
  kind: ComponentKind;
  brand: string;
  model: string;
  spec: Record<string, unknown>;
  price_vnd: number | null;
  datasheet_url: string | null;
  source: ComponentSource;
  notes_vi: string | null;
  notes_en: string | null;
  is_active: boolean;
  sort_order: number;
};

/**
 * Cỡ cảm biến theo "optical format" (đơn vị inch danh nghĩa) → kích thước thật.
 *
 * Cần bảng này vì tiêu cự phụ thuộc BỀ RỘNG CẢM BIẾN tính bằng mm, mà datasheet
 * thường chỉ ghi 1/1.8", 2/3"... Con số ở đây theo quy ước quang học thông dụng.
 */
export const SENSOR_FORMATS: Record<string, { widthMm: number; heightMm: number }> = {
  '1/3': { widthMm: 4.8, heightMm: 3.6 },
  '1/2.5': { widthMm: 5.76, heightMm: 4.29 },
  '1/2': { widthMm: 6.4, heightMm: 4.8 },
  '1/1.8': { widthMm: 7.18, heightMm: 5.32 },
  '2/3': { widthMm: 8.8, heightMm: 6.6 },
  '1': { widthMm: 12.8, heightMm: 9.6 },
  '4/3': { widthMm: 17.6, heightMm: 13.2 },
};

/** Thứ tự từ nhỏ tới lớn — dùng để kiểm tra vòng ảnh ống kính có phủ nổi cảm biến không. */
export const SENSOR_FORMAT_ORDER = ['1/3', '1/2.5', '1/2', '1/1.8', '2/3', '1', '4/3'];

/**
 * Băng thông thực dụng của từng chuẩn giao tiếp (MB/s).
 *
 * Cố ý lấy THẤP hơn con số lý thuyết: GigE về lý thuyết 125 MB/s nhưng chạy
 * thật quanh 100–110 MB/s sau overhead. Dùng số lý thuyết để chọn thiết bị là
 * cách dự án chết ở hiện trường.
 */
export const INTERFACE_BANDWIDTH: Record<string, number> = {
  GigE: 110,
  USB3: 350,
  '5GigE': 550,
  '10GigE': 1100,
  CXP: 2000,
};

// ---------------------------------------------------------------- CAMERA --
export type CameraSpec = {
  /** Độ phân giải, megapixel. */
  resolution_mp: number;
  /** Optical format, khớp khoá của SENSOR_FORMATS. Ví dụ '1/1.8'. */
  sensor_format: string;
  /** Kích thước điểm ảnh (µm) — cùng độ phân giải, pixel nhỏ đòi ống kính tốt hơn. */
  pixel_size_um?: number;
  /** Ngàm: C hoặc CS. */
  mount: string;
  /** Chuẩn giao tiếp, khớp khoá của INTERFACE_BANDWIDTH. */
  interface: string;
  /** Khung hình tối đa ở full frame. */
  max_fps?: number;
  /** 'mono' hoặc 'color'. */
  color: 'mono' | 'color';
};

// ------------------------------------------------------------------ LENS --
export type LensSpec = {
  /** 'fixed' (tiêu cự cố định), 'telecentric', hoặc 'macro'. */
  lens_type: 'fixed' | 'telecentric' | 'macro';
  /** Tiêu cự (mm) — chỉ có với lens fixed/macro. */
  focal_length_mm?: number;
  /** Độ phóng đại — chỉ có với telecentric. Ví dụ 0.5 nghĩa là 0.5x. */
  magnification?: number;
  /** Vòng ảnh phủ được tới cỡ cảm biến nào, khớp khoá SENSOR_FORMATS. */
  image_circle: string;
  mount: string;
  /** Khoảng cách làm việc dùng được (mm). */
  wd_min_mm?: number;
  wd_max_mm?: number;
};

// ----------------------------------------------------------------- LIGHT --
export type LightSpec = {
  /** Kiểu chiếu sáng — khoá dùng để khớp với câu mô tả trong bảng luật. */
  light_type: 'ring' | 'dome' | 'backlight' | 'bar' | 'coaxial' | 'darkfield';
  color: 'white' | 'red' | 'blue' | 'green' | 'ir' | 'uv';
  /** Kích thước danh nghĩa (mm) — so với FOV để biết có phủ đủ không. */
  size_mm?: number;
  wd_min_mm?: number;
  wd_max_mm?: number;
};

// ------------------------------------------------------------ CONTROLLER --
export type ControllerSpec = {
  cpu?: string;
  ram_gb?: number;
  /** Để trống nghĩa là không có GPU rời. */
  gpu?: string;
  /** Các chuẩn giao tiếp máy hỗ trợ, khớp khoá INTERFACE_BANDWIDTH. */
  interfaces?: string[];
};

/** Đọc một số từ spec, trả null nếu không có hoặc không phải số hợp lệ. */
export function specNumber(spec: Record<string, unknown>, key: string): number | null {
  const value = spec[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Đọc một chuỗi từ spec. */
export function specString(spec: Record<string, unknown>, key: string): string | null {
  const value = spec[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Bề rộng cảm biến (mm) của một camera — thứ cần để tính tiêu cự. */
export function sensorWidthMm(spec: Record<string, unknown>): number | null {
  const format = specString(spec, 'sensor_format');
  if (!format) return null;
  return SENSOR_FORMATS[format]?.widthMm ?? null;
}

/** Vòng ảnh của ống kính có phủ nổi cảm biến này không. */
export function coversSensor(imageCircle: string | null, sensorFormat: string | null): boolean {
  if (!imageCircle || !sensorFormat) return false;
  const lensIndex = SENSOR_FORMAT_ORDER.indexOf(imageCircle);
  const sensorIndex = SENSOR_FORMAT_ORDER.indexOf(sensorFormat);
  if (lensIndex < 0 || sensorIndex < 0) return false;
  return lensIndex >= sensorIndex;
}

/** Băng thông chuẩn giao tiếp có tải nổi mức dữ liệu này không. */
export function interfaceCarries(interfaceName: string | null, dataRateMbytesS: number): boolean {
  if (!interfaceName) return false;
  const capacity = INTERFACE_BANDWIDTH[interfaceName];
  return capacity !== undefined && capacity >= dataRateMbytesS;
}
