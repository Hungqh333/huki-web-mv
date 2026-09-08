/**
 * Ý nghĩa các khoá `spec` của bảng components.
 *
 * Bảng chỉ có một cột jsonb; file này là nơi DUY NHẤT định nghĩa khoá nào có
 * nghĩa gì với loại linh kiện nào — giống vai trò của fields.ts với trường nhập
 * liệu. Thêm thiết bị mới = chỉ thêm dữ liệu. Chỉ khi cần một loại thông số
 * chưa từng có mới phải sửa file này.
 */

/**
 * Loại linh kiện, xếp theo đúng trình tự mua hàng.
 *
 * "controller" là MÁY TÍNH công nghiệp, "light_controller" là bộ điều khiển
 * đèn — hai thứ hoàn toàn khác nhau, tên gần giống nhau là do lịch sử.
 */
export type ComponentKind =
  | 'camera'
  | 'lens'
  | 'tube'
  | 'light'
  | 'cable'
  | 'light_controller'
  | 'interface_card'
  | 'controller'
  | 'software'
  | 'pc_option'
  | 'accessory';

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
  'CXP-6': 600,
};

// ---------------------------------------------------------------- CAMERA --
export type CameraSpec = {
  /** Độ phân giải, megapixel. */
  resolution_mp: number;
  /** Số pixel thật theo từng trục — cần để kiểm đủ pixel trên CẢ HAI trục. */
  resolution_w_px: number;
  resolution_h_px: number;
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
  light_type:
    | 'ring'
    | 'dome'
    | 'backlight'
    | 'bar'
    | 'coaxial'
    | 'darkfield'
    /** Cần bốn đèn chiếu bốn hướng, không phải một thiết bị đơn lẻ. */
    | 'photometric_stereo';
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

/**
 * Bề rộng cảm biến (mm) — thứ cần để tính tiêu cự.
 *
 * Camera line scan không có "optical format" theo nghĩa thông thường: cảm biến
 * là một hàng pixel, bề rộng = số pixel × cỡ pixel. Tính thẳng từ đó thay vì
 * tra bảng.
 */
export function sensorWidthMm(spec: Record<string, unknown>): number | null {
  if (specString(spec, 'camera_type') === 'line') {
    const px = specNumber(spec, 'line_width_px');
    const size = specNumber(spec, 'pixel_size_um');
    if (px !== null && size !== null) return (px * size) / 1000;
    return null;
  }
  const format = specString(spec, 'sensor_format');
  if (!format) return null;
  return SENSOR_FORMATS[format]?.widthMm ?? null;
}

/** Đường chéo cảm biến (mm) — so với vòng ảnh ống kính. */
export function sensorDiagonalMm(format: string | null): number | null {
  if (!format) return null;
  const size = SENSOR_FORMATS[format];
  if (!size) return null;
  return Math.sqrt(size.widthMm ** 2 + size.heightMm ** 2);
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

// =============================================================================
// Định nghĩa trường spec theo từng loại linh kiện.
//
// Dùng chung cho CẢ HAI phía: form quản trị render ô nhập theo đây, và server
// action cũng dựng lại object spec theo đây. Một nguồn sự thật, nên không thể
// có chuyện form cho nhập một khoá mà server lại bỏ qua.
// =============================================================================

export type SpecFieldType = 'number' | 'text' | 'select' | 'multiselect';

export type SpecFieldDef = {
  key: string;
  type: SpecFieldType;
  unit?: string;
  options?: string[];
  required?: boolean;
  step?: number;
};

const MOUNTS = ['C', 'CS', 'F'];
const INTERFACES = Object.keys(INTERFACE_BANDWIDTH);

/** Máy tự thêm theo luật, hay để người dùng tích tay. */
export const ACCESSORY_PICK_MODES = ['rule', 'manual'];

/**
 * Các loại phụ kiện máy BIẾT khi nào cần.
 *
 * Danh sách này cố tình ngắn: chỉ những thứ suy được từ câu hỏi form đã hỏi.
 * Phụ kiện không nằm trong đây thì để pick_mode = manual.
 */
export const ACCESSORY_TYPES = [
  /** Kính lọc phân cực lắp trên ống kính — luôn đi CẶP với polarizer_light. */
  'polarizer_lens',
  /** Tấm phân cực che trước đèn. Mua thiếu một nửa thì nửa kia vô dụng. */
  'polarizer_light',
  /** Kính lọc dải hẹp theo màu đèn, để cắt ánh sáng môi trường. */
  'bandpass_filter',
  /** Vỏ bảo vệ camera theo cấp IP. */
  'ip_housing',
  'encoder',
  'encoder_cable',
  /** Cảm biến quang điện/tiệm cận sinh xung trigger. */
  'trigger_sensor',
  /** Vòng khoá nét và khẩu, chống trôi khi có rung. */
  'lock_ring',
  /** Adapter ngàm C→F, C→M42 cho cảm biến lớn và line scan. */
  'mount_adapter',
  'bracket',
  'diffuser',
  'power_supply',
  'other',
];

export const ACCESSORY_TARGETS = ['camera', 'lens', 'light', 'system'];

/** Số lượng nhân theo cái gì. */
export const ACCESSORY_QTY_BASES = ['per_camera', 'per_light', 'per_system'];

export const SPEC_FIELDS: Record<ComponentKind, SpecFieldDef[]> = {
  camera: [
    { key: 'camera_type', type: 'select', options: ['area', 'line'], required: true },
    { key: 'resolution_mp', type: 'number', unit: 'MP', step: 0.1 },
    { key: 'resolution_w_px', type: 'number', unit: 'px', step: 1 },
    { key: 'resolution_h_px', type: 'number', unit: 'px', step: 1 },
    /* Line scan chỉ có một hàng pixel; ảnh dựng dần theo chiều vật chạy. */
    { key: 'line_width_px', type: 'number', unit: 'px', step: 1 },
    { key: 'max_line_rate_khz', type: 'number', unit: 'kHz', step: 0.1 },
    { key: 'sensor_format', type: 'select', options: SENSOR_FORMAT_ORDER },
    { key: 'pixel_size_um', type: 'number', unit: 'µm', step: 0.01 },
    { key: 'mount', type: 'select', options: MOUNTS, required: true },
    { key: 'interface', type: 'select', options: INTERFACES, required: true },
    { key: 'max_fps', type: 'number', unit: 'fps', step: 0.1 },
    { key: 'color', type: 'select', options: ['mono', 'color'], required: true },
  ],
  lens: [
    { key: 'lens_type', type: 'select', options: ['fixed', 'telecentric', 'macro'], required: true },
    { key: 'focal_length_mm', type: 'number', unit: 'mm', step: 0.1 },
    { key: 'magnification', type: 'number', unit: 'x', step: 0.01 },
    { key: 'image_circle', type: 'select', options: SENSOR_FORMAT_ORDER, required: true },
    { key: 'mount', type: 'select', options: MOUNTS, required: true },
    { key: 'wd_min_mm', type: 'number', unit: 'mm', step: 1 },
    { key: 'wd_max_mm', type: 'number', unit: 'mm', step: 1 },
  ],
  light: [
    {
      key: 'light_type',
      type: 'select',
      options: ['ring', 'dome', 'backlight', 'bar', 'coaxial', 'darkfield', 'photometric_stereo'],
      required: true,
    },
    {
      key: 'color',
      type: 'select',
      options: ['white', 'red', 'blue', 'green', 'ir', 'uv'],
      required: true,
    },
    { key: 'size_mm', type: 'number', unit: 'mm', step: 1 },
    { key: 'wd_min_mm', type: 'number', unit: 'mm', step: 1 },
    { key: 'wd_max_mm', type: 'number', unit: 'mm', step: 1 },
  ],
  controller: [
    { key: 'cpu', type: 'text' },
    { key: 'ram_gb', type: 'number', unit: 'GB', step: 1 },
    { key: 'gpu', type: 'text' },
    { key: 'interfaces', type: 'multiselect', options: INTERFACES },
    /* Hai thông số quyết định CẦN MẤY MÁY. Khai ở đây thay vì đóng cứng trong
       code, đúng yêu cầu "bảng luật sửa được qua admin UI" của CLAUDE.md.
       Không khai max_cameras thì suy từ số khe PCIe nhân số cổng mỗi card. */
    { key: 'max_cameras', type: 'number', unit: 'camera', step: 1 },
    { key: 'pcie_slots', type: 'number', unit: 'khe', step: 1 },
    /* Trần băng thông cả máy gánh được. Không khai thì suy ra bằng 4 lần băng
       thông một cổng của chuẩn nhanh nhất đang dùng. */
    { key: 'max_bandwidth_mbytes_s', type: 'number', unit: 'MB/s', step: 10 },
  ],
  /** Vòng nối dài, dùng khi cần khoảng cách làm việc ngắn hơn lens cho phép. */
  tube: [
    { key: 'length_mm', type: 'number', unit: 'mm', required: true, step: 0.5 },
    { key: 'mount', type: 'select', options: MOUNTS, required: true },
  ],
  cable: [
    {
      key: 'cable_for',
      type: 'select',
      /* File BOM thật tách riêng cáp data và cáp nguồn camera — gộp lại thì báo
         giá thiếu một dòng. */
      options: ['camera_data', 'camera_power', 'light'],
      required: true,
    },
    { key: 'connector', type: 'text', required: true },
    { key: 'length_m', type: 'number', unit: 'm', required: true, step: 0.5 },
  ],
  /** Card mạng / frame grabber cắm vào máy tính, tách khỏi bản thân máy tính. */
  interface_card: [
    { key: 'interface', type: 'select', options: INTERFACES, required: true },
    { key: 'channels', type: 'number', unit: 'kênh', required: true, step: 1 },
  ],
  light_controller: [
    { key: 'channels', type: 'number', unit: 'kênh', required: true, step: 1 },
    { key: 'strobe', type: 'select', options: ['yes', 'no'], required: true },
    { key: 'max_current_a', type: 'number', unit: 'A', step: 0.1 },
  ],
  software: [
    { key: 'software_type', type: 'select', options: ['library', 'platform', 'free'], required: true },
    { key: 'license', type: 'text' },
  ],
  /** Hàng đi kèm máy tính: Windows, Office, màn hình, bàn phím. */
  pc_option: [
    {
      key: 'option_type',
      type: 'select',
      options: ['os', 'office', 'monitor', 'keyboard'],
      required: true,
    },
  ],
  /**
   * Phụ kiện chia làm hai loại, và ranh giới nằm ở `pick_mode`.
   *
   * "rule" = có điều kiện bật rõ ràng nên máy tự thêm vào danh mục: bề mặt
   * phản chiếu thì phải có kính phân cực, có yêu cầu IP thì phải có vỏ, line
   * scan thì phải có encoder. Đây đều là thứ form ĐÃ HỎI mà trước đây danh
   * mục không đáp lại gì — để người dùng tự nhớ là sẽ quên.
   *
   * "manual" = gá, khung, tủ. Không có công thức nào quyết định thay được,
   * chỉ liệt kê cho tích tay. Không ghi pick_mode thì coi là manual.
   */
  accessory: [
    { key: 'pick_mode', type: 'select', options: ACCESSORY_PICK_MODES },
    { key: 'accessory_type', type: 'select', options: ACCESSORY_TYPES },
    { key: 'accessory_for', type: 'select', options: ACCESSORY_TARGETS },
    /* Nhân theo cái gì. Kính phân cực trên lens đi theo từng camera, tấm phân
       cực đi theo từng đèn, còn encoder thì cả hệ chỉ một cái. */
    { key: 'qty_basis', type: 'select', options: ACCESSORY_QTY_BASES },
    { key: 'wavelength_nm', type: 'number', unit: 'nm', step: 1 },
  ],
};

/**
 * Thông số dùng để NHẬN RA thiết bị trong danh sách chọn.
 *
 * Khác với danh sách trường bắt buộc: camera có 7 trường bắt buộc, liệt kê hết
 * thì nhãn trong ô chọn dài quá màn điện thoại và không đọc nổi. Ở đây chỉ giữ
 * những thông số phân biệt được thiết bị này với thiết bị khác.
 */
export const SUMMARY_KEYS: Record<ComponentKind, string[]> = {
  camera: ['camera_type', 'resolution_mp', 'line_width_px', 'sensor_format', 'interface', 'color'],
  lens: ['lens_type', 'focal_length_mm', 'magnification', 'image_circle'],
  tube: ['length_mm', 'mount'],
  light: ['light_type', 'color', 'size_mm'],
  cable: ['cable_for', 'connector', 'length_m'],
  light_controller: ['channels', 'strobe', 'max_current_a'],
  interface_card: ['interface', 'channels'],
  controller: ['cpu', 'ram_gb', 'gpu', 'max_cameras'],
  software: ['software_type', 'license'],
  pc_option: ['option_type'],
  accessory: ['accessory_type', 'accessory_for', 'wavelength_nm'],
};

export const COMPONENT_KINDS: ComponentKind[] = [
  'camera',
  'lens',
  'tube',
  'light',
  'cable',
  'light_controller',
  'interface_card',
  'controller',
  'software',
  'pc_option',
  'accessory',
];

export const COMPONENT_SOURCES: ComponentSource[] = ['unverified', 'datasheet', 'measured'];

/**
 * Dựng object spec từ dữ liệu form, chỉ giữ khoá thuộc đúng loại linh kiện.
 *
 * Lọc theo loại là có chủ đích: đổi loại từ camera sang đèn mà vẫn giữ lại
 * resolution_mp thì spec sẽ chứa rác, và logic chọn sẽ đọc nhầm.
 */
export function buildSpec(
  kind: ComponentKind,
  read: (key: string) => string | string[] | null
): { spec: Record<string, unknown>; missing: string[] } {
  const spec: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const field of SPEC_FIELDS[kind]) {
    const raw = read(field.key);

    if (field.type === 'multiselect') {
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (values.length > 0) spec[field.key] = values;
      else if (field.required) missing.push(field.key);
      continue;
    }

    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value === '') {
      if (field.required) missing.push(field.key);
      continue;
    }

    if (field.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) missing.push(field.key);
      else spec[field.key] = parsed;
      continue;
    }

    if (field.type === 'select' && field.options && !field.options.includes(value)) {
      missing.push(field.key);
      continue;
    }

    spec[field.key] = value;
  }

  return { spec, missing };
}
