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
 *
 * Thứ tự cỡ cảm biến suy từ ĐƯỜNG CHÉO, và đường chéo TÍNH từ bề rộng và
 * chiều cao chứ không khai sẵn. Hai lựa chọn này cùng dẹp một loại lỗi: hai
 * nguồn cho cùng một thông tin rồi lệch nhau.
 *
 *  - Trước đây thứ tự nằm ở một mảng viết tay riêng (`SENSOR_FORMAT_ORDER`) và
 *    phép kiểm vòng ảnh so theo vị trí trong mảng đó. Thêm format vào bảng mà
 *    quên mảng thì `coversSensor` trả false cho MỌI ống kính: bộ chọn loại sạch
 *    lens khỏi kết quả, không FAIL, không cảnh báo.
 *  - Sau đó có một bản khai sẵn `diagonalMm` ngay trong bảng, làm tròn 2 chữ
 *    số. Đó vẫn là nguồn thứ hai: sửa bề rộng mà quên đường chéo là lệch, và
 *    bản làm tròn đã lệch sẵn tới 0,005 mm so với số tính (1.1": 17,52 so với
 *    17,5151). Tính lúc chạy thì không còn gì để lệch.
 *
 * Xếp theo đường chéo tăng dần cho dễ đọc, nhưng thứ tự trong file KHÔNG phải
 * là thứ tự có hiệu lực — 1.1" (17,5 mm) nằm GIỮA 1" (16 mm) và 4/3" (22 mm),
 * nên mọi chỗ cần thứ tự đều sắp theo đường chéo.
 *
 * Nguồn con số: bảy format đầu có từ lúc dựng catalog, theo quy ước quang học
 * thông dụng, CHƯA đối chiếu datasheet. 1.1" và APS-C lấy theo
 * docs/HIEN_TRANG_VA_KHOANG_TRONG.md (GAP 6), cũng CHƯA đối chiếu datasheet.
 */
export const SENSOR_FORMATS: Record<string, { widthMm: number; heightMm: number }> = {
  '1/3': { widthMm: 4.8, heightMm: 3.6 },
  '1/2.5': { widthMm: 5.76, heightMm: 4.29 },
  '1/2': { widthMm: 6.4, heightMm: 4.8 },
  '1/1.8': { widthMm: 7.18, heightMm: 5.32 },
  '2/3': { widthMm: 8.8, heightMm: 6.6 },
  '1': { widthMm: 12.8, heightMm: 9.6 },
  /* Format phổ biến nhất của camera công nghiệp 12–24 MP hiện nay (IMX253,
     IMX255, IMX531). Thiếu nó thì đúng nhóm camera đang dùng nhiều nhất không
     tính nổi tiêu cự. */
  '1.1': { widthMm: 14.13, heightMm: 10.35 },
  '4/3': { widthMm: 17.6, heightMm: 13.2 },
  'APS-C': { widthMm: 23.6, heightMm: 15.6 },
};

/** Đường chéo của một kích thước cảm biến, tính từ hai cạnh. */
function diagonalOf(size: { widthMm: number; heightMm: number }): number {
  return Math.sqrt(size.widthMm ** 2 + size.heightMm ** 2);
}

/**
 * Khoá của SENSOR_FORMATS, sắp từ cảm biến nhỏ tới lớn.
 *
 * SUY RA từ bảng trên chứ không viết tay, nên thêm một format là nó tự vào
 * đúng chỗ ở mọi ô chọn. Thay cho `SENSOR_FORMAT_ORDER` cũ.
 */
export const SENSOR_FORMAT_KEYS: string[] = Object.keys(SENSOR_FORMATS).sort(
  (a, b) => diagonalOf(SENSOR_FORMATS[a]) - diagonalOf(SENSOR_FORMATS[b])
);

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
  /* CoaXPress 12,5 Gbps trên MỘT làn. Hệ 2 hay 4 làn thì nhân lên — khai sẵn
     số của cấu hình nhiều làn ở đây là mời người sau nhân thêm lần nữa. */
  'CXP-12': 1200,
  /* Con số của cấu hình Full. Base và Medium thấp hơn nhiều, nên chọn chuẩn
     này là phải xác nhận grabber lẫn cáp đúng là Full, không suy từ chữ
     "Camera Link" trên datasheet. */
  CameraLink: 800,
};

/**
 * Số byte cho một pixel theo định dạng ảnh.
 *
 * Trước đây code lấy 3 byte/px khi cần phân biệt màu — sai với đa số hệ vision
 * công nghiệp: camera màu truyền ảnh Bayer THÔ 1 byte/px, việc nội suy ra RGB
 * làm ở máy tính. Lấy 3 byte/px là thổi phồng băng thông lên ba lần.
 *
 * Bảng này TỪNG nằm trong `vision/timing.ts`, trong khi `selector/derive.ts`
 * tự khai riêng `color_critical ? 3 : 1`. Cùng một bài toán, hai công cụ ra hai
 * con số lệch nhau ba lần, và con số của derive còn chảy tiếp vào
 * `maxCamerasByBandwidth()` nên sai luôn cả số máy tính lẫn số card giao tiếp.
 *
 * Chuyển về đây vì đây là tầng thấp nhất mà cả hai bên đều đã phụ thuộc: để
 * bảng ở `timing.ts` rồi cho `specs.ts` import ngược lên sẽ thành vòng tròn
 * (`timing.ts` vốn đã import `INTERFACE_BANDWIDTH` từ file này). `timing.ts`
 * re-export lại để mọi chỗ đang `import ... from '@/lib/vision'` không phải sửa.
 */
export const PIXEL_FORMAT_BYTES: Record<string, number> = {
  Mono8: 1,
  BayerRG8: 1,
  Mono12packed: 1.5,
  Mono16: 2,
  RGB8: 3,
};

/** Định dạng mặc định khi không khai gì: ảnh đơn sắc 8 bit. */
export const DEFAULT_PIXEL_FORMAT = 'Mono8';

/**
 * Định dạng mặc định khi bài toán CẦN PHÂN BIỆT MÀU.
 *
 * Vẫn là 1 byte/px. Cần màu không có nghĩa là camera truyền 3 byte/px — nó
 * truyền Bayer thô rồi máy tính nội suy. Chỉ chọn RGB8 khi datasheet nói rõ
 * camera truyền RGB đã nội suy sẵn, và khi đó băng thông mới thật sự gấp ba.
 */
export const COLOR_DEFAULT_PIXEL_FORMAT = 'BayerRG8';

/** Byte/px của một định dạng. Định dạng lạ hoặc thiếu thì trả null, không đoán. */
export function pixelFormatBytes(format: string | null): number | null {
  if (!format) return null;
  return PIXEL_FORMAT_BYTES[format] ?? null;
}

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
  /**
   * Định dạng ảnh camera TRUYỀN ĐI, khớp khoá của PIXEL_FORMAT_BYTES.
   *
   * Khác với `color`: `color` nói cảm biến có lọc màu hay không, khoá này nói
   * mỗi pixel chiếm mấy byte trên đường truyền. Đa số camera màu công nghiệp
   * truyền Bayer 1 byte/px, nhưng có model truyền RGB8 3 byte/px — cùng độ
   * phân giải mà gấp ba băng thông, đủ để đổi từ GigE sang 5GigE.
   *
   * Không khai thì suy từ `color`: có màu → BayerRG8, đơn sắc → Mono8.
   */
  pixel_format?: string;
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
  return size ? diagonalOf(size) : null;
}

/**
 * Vòng ảnh của ống kính có phủ nổi cảm biến này không.
 *
 * So ĐƯỜNG CHÉO chứ không so vị trí trong một danh sách xếp sẵn như trước. Hai
 * cái cho cùng kết quả với bảy format cũ, nhưng so đường chéo là so đúng đại
 * lượng vật lý: thêm format mới chỉ cần khai kích thước, không phải nhớ chèn
 * nó vào đúng chỗ ở một mảng thứ hai. Cũng là phép so mà `opticsChecks` đang
 * dùng, nên hai nơi không thể lệch nhau nữa.
 *
 * Format lạ vẫn trả false: thà loại một ống kính chưa khai đủ thông số còn hơn
 * cho qua rồi lắp vào máy mới biết tối bốn góc.
 */
export function coversSensor(imageCircle: string | null, sensorFormat: string | null): boolean {
  const lensDiagonalMm = sensorDiagonalMm(imageCircle);
  const sensorDiag = sensorDiagonalMm(sensorFormat);
  if (lensDiagonalMm === null || sensorDiag === null) return false;
  return lensDiagonalMm >= sensorDiag;
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
    { key: 'sensor_format', type: 'select', options: SENSOR_FORMAT_KEYS },
    { key: 'pixel_size_um', type: 'number', unit: 'µm', step: 0.01 },
    { key: 'mount', type: 'select', options: MOUNTS, required: true },
    { key: 'interface', type: 'select', options: INTERFACES, required: true },
    { key: 'max_fps', type: 'number', unit: 'fps', step: 0.1 },
    { key: 'color', type: 'select', options: ['mono', 'color'], required: true },
    /* Để trống thì suy từ `color`. Chỉ khai khi datasheet nói rõ camera truyền
       RGB đã nội suy — đó là lúc băng thông thật sự gấp ba. */
    { key: 'pixel_format', type: 'select', options: Object.keys(PIXEL_FORMAT_BYTES) },
  ],
  lens: [
    { key: 'lens_type', type: 'select', options: ['fixed', 'telecentric', 'macro'], required: true },
    { key: 'focal_length_mm', type: 'number', unit: 'mm', step: 0.1 },
    { key: 'magnification', type: 'number', unit: 'x', step: 0.01 },
    { key: 'image_circle', type: 'select', options: SENSOR_FORMAT_KEYS, required: true },
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
