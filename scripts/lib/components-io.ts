/**
 * Nhập catalog linh kiện từ Excel — phần thuần: định nghĩa cột, kiểm từng dòng,
 * sinh SQL. Đọc/ghi file nằm ở components-template.ts và import-components.ts.
 *
 * Vì sao có file này (V1c mục C1): file NHAP_DU_LIEU_VISION.xlsx cũ tự thiết kế
 * cột theo cách người dùng quen đọc, không khớp khoá jsonb thật của bảng
 * components. Ví dụ vòng ảnh ống kính ghi bằng mm, còn database lưu cỡ cảm
 * biến lớn nhất mà vòng ảnh phủ được. Điền theo file cũ thì không nhập nổi,
 * hoặc tệ hơn, nhập được mà sai nghĩa.
 *
 * Nguyên tắc: MỘT nơi định nghĩa cột (SHEETS). File mẫu sinh từ đây, bộ nhập đọc
 * theo đây, và test kiểm mọi khoá spec sinh ra đều có trong SPEC_FIELDS — nếu
 * không, lần đầu admin bấm Lưu ở trang quản trị sẽ âm thầm xoá khoá đó.
 */
import {
  COMPONENT_SOURCES,
  INTERFACE_BANDWIDTH,
  PIXEL_FORMAT_BYTES,
  SENSOR_FORMAT_KEYS,
  sensorDiagonalMm,
  type ComponentKind,
  type ComponentSource,
} from '../../src/lib/components/specs';

// ------------------------------------------------------------------ cột --

type ColumnType = 'text' | 'number' | 'integer' | 'choice' | 'list';

export type ColumnDef = {
  /** Tiêu đề in trong file mẫu. Dòng thứ hai (trong ngoặc) là đơn vị. */
  header: string;
  /**
   * Đích ghi: cột của bảng (`brand`, `price_vnd`...) hoặc `spec.<khoá>`.
   * `derive.*` là cột chỉ dùng để suy ra khoá khác, không ghi thẳng.
   */
  target: string;
  type: ColumnType;
  required?: boolean;
  /** Nhãn hiện trong ô chọn của Excel → giá trị lưu vào database. */
  choices?: Record<string, string>;
  help: string;
  example?: string | number;
};

const MOUNT_CHOICES = { C: 'C', CS: 'CS', F: 'F', M42: 'M42' };
const YES_NO = { Có: 'yes', Không: 'no' };
const identity = (values: string[]) => Object.fromEntries(values.map((v) => [v, v]));

const SOURCE_LABELS: Record<ComponentSource, string> = {
  unverified: 'Chưa kiểm chứng',
  datasheet: 'Theo datasheet',
  measured: 'Đã đo thực tế',
};

/** Ba cột đầu mọi sheet. */
const HEAD: ColumnDef[] = [
  { header: 'Hãng', target: 'brand', type: 'text', required: true, help: 'Tên hãng sản xuất.', example: 'Basler' },
  {
    header: 'Tên model',
    target: 'model',
    type: 'text',
    required: true,
    help: 'Đúng mã model trên datasheet, không viết tắt.',
    example: 'a2A2440-20gmPRO',
  },
];

/** Các cột mua hàng + quản trị, cuối mọi sheet. */
const TAIL: ColumnDef[] = [
  {
    header: 'Giá tham khảo\n(VNĐ)',
    target: 'price_vnd',
    type: 'integer',
    help: 'Bỏ trống nếu chưa có báo giá. Không bịa: giá sai tệ hơn không có giá.',
    example: 18500000,
  },
  {
    header: 'Thời gian giao hàng\n(ngày)',
    target: 'lead_time_days',
    type: 'integer',
    help: 'Từ lúc đặt tới lúc nhận. Hàng có sẵn kho ghi 0. Bỏ trống = chưa biết.',
    example: 14,
  },
  { header: 'Nhà cung cấp', target: 'supplier', type: 'text', help: 'Nhà phân phối mua được tại Việt Nam.', example: 'Công ty ABC' },
  {
    header: 'Số dự án\nđã dùng',
    target: 'used_in_projects',
    type: 'integer',
    help: 'Số dự án của phòng đã chạy thật thiết bị này. Bỏ trống = 0.',
    example: 2,
  },
  {
    header: 'Nguồn thông số',
    target: 'source',
    type: 'choice',
    choices: Object.fromEntries(COMPONENT_SOURCES.map((s) => [SOURCE_LABELS[s], s])),
    help: 'Đã đối chiếu datasheet của hãng thì chọn "Theo datasheet". Bỏ trống = Chưa kiểm chứng.',
    example: 'Theo datasheet',
  },
  { header: 'Link datasheet', target: 'datasheet_url', type: 'text', help: 'Đường dẫn tới datasheet.', example: 'https://www.baslerweb.com/...' },
  { header: 'Ghi chú', target: 'notes_vi', type: 'text', help: 'Kinh nghiệm dùng, lưu ý khi ghép thiết bị.', example: 'Đã dùng dự án đo lường 2025' },
  {
    header: 'Mã linh kiện\n(để trống = tự sinh)',
    target: 'code',
    type: 'text',
    help: 'Để trống thì tự sinh từ hãng + model. Muốn CẬP NHẬT một thiết bị đang có trên web thì chép đúng mã của nó ở trang quản trị Linh kiện vào đây.',
  },
];

export type SheetDef = { name: string; kind: ComponentKind; codePrefix: string; columns: ColumnDef[] };

export const SHEETS: SheetDef[] = [
  {
    name: 'CAMERA',
    kind: 'camera',
    codePrefix: 'CAM',
    columns: [
      ...HEAD,
      {
        header: 'Loại camera',
        target: 'spec.camera_type',
        type: 'choice',
        required: true,
        choices: { 'Area scan': 'area', 'Line scan': 'line' },
        help: 'Area scan chụp cả khung hình; Line scan chỉ có một hàng pixel.',
        example: 'Area scan',
      },
      {
        header: 'Độ phân giải ngang\n(pixel)',
        target: 'derive.width_px',
        type: 'integer',
        required: true,
        help: 'Số pixel theo chiều ngang. Line scan: số pixel của một hàng.',
        example: 2448,
      },
      {
        header: 'Độ phân giải dọc\n(pixel)',
        target: 'spec.resolution_h_px',
        type: 'integer',
        help: 'BẮT BUỘC với Area scan. Line scan để trống.',
        example: 2048,
      },
      {
        header: 'Cỡ cảm biến\n(inch)',
        target: 'spec.sensor_format',
        type: 'choice',
        choices: identity(SENSOR_FORMAT_KEYS),
        help: 'BẮT BUỘC với Area scan. Máy sẽ kiểm lại bằng pixel × pixel pitch: ghi 1.1" mà tính ra 1" là báo lỗi.',
        example: '2/3',
      },
      {
        header: 'Pixel pitch\n(µm)',
        target: 'spec.pixel_size_um',
        type: 'number',
        required: true,
        help: 'Kích thước một điểm ảnh.',
        example: 3.45,
      },
      {
        header: 'Shutter',
        target: 'spec.shutter',
        type: 'choice',
        required: true,
        choices: { Global: 'global', Rolling: 'rolling' },
        help: 'Sản phẩm chuyển động thì rolling shutter làm méo ảnh.',
        example: 'Global',
      },
      {
        header: 'Tốc độ tối đa\n(fps)',
        target: 'spec.max_fps',
        type: 'number',
        help: 'Area scan: khung hình/giây ở độ phân giải đầy đủ.',
        example: 23,
      },
      {
        header: 'Tốc độ quét dòng\n(kHz)',
        target: 'spec.max_line_rate_khz',
        type: 'number',
        help: 'Chỉ Line scan.',
      },
      {
        header: 'Chuẩn kết nối',
        target: 'spec.interface',
        type: 'choice',
        required: true,
        choices: identity(Object.keys(INTERFACE_BANDWIDTH)),
        help: 'Camera Link phải chọn đúng cấu hình Base / Medium / Full / Deca — băng thông chênh nhau tới 3 lần.',
        example: 'GigE',
      },
      { header: 'Ngàm', target: 'spec.mount', type: 'choice', required: true, choices: MOUNT_CHOICES, help: 'Ngàm ống kính.', example: 'C' },
      {
        header: 'Màu',
        target: 'spec.color',
        type: 'choice',
        required: true,
        choices: { Mono: 'mono', Color: 'color' },
        help: 'Mono = đơn sắc.',
        example: 'Mono',
      },
      {
        header: 'Định dạng ảnh truyền',
        target: 'spec.pixel_format',
        type: 'choice',
        choices: identity(Object.keys(PIXEL_FORMAT_BYTES)),
        help: 'Để trống nếu không chắc: máy tự lấy Mono8 / BayerRG8. Chỉ chọn RGB8 khi datasheet ghi camera truyền RGB đã nội suy.',
      },
      { header: 'Độ sâu bit', target: 'spec.bit_depth', type: 'integer', help: 'Ví dụ 8, 10, 12.', example: 12 },
      {
        header: 'Có chân trigger?',
        target: 'spec.trigger_io',
        type: 'choice',
        required: true,
        choices: YES_NO,
        help: 'Có đầu vào trigger phần cứng (opto-isolated IO).',
        example: 'Có',
      },
      {
        header: 'Nhiệt độ hoạt động\ntối đa (°C)',
        target: 'spec.temp_max_c',
        type: 'number',
        help: 'Theo datasheet, thường là nhiệt độ vỏ.',
        example: 50,
      },
      { header: 'Cấp bảo vệ IP', target: 'spec.ip_rating', type: 'text', help: 'Dạng IP30, IP67. Bỏ trống nếu không ghi.' },
      ...TAIL,
    ],
  },
  {
    name: 'ỐNG KÍNH',
    kind: 'lens',
    codePrefix: 'LENS',
    columns: [
      ...HEAD,
      {
        header: 'Loại ống kính',
        target: 'spec.lens_type',
        type: 'choice',
        required: true,
        choices: { 'Thường (Entocentric)': 'fixed', Telecentric: 'telecentric', Macro: 'macro' },
        help: 'Telecentric quy định bằng ĐỘ PHÓNG ĐẠI, không bằng tiêu cự.',
        example: 'Thường (Entocentric)',
      },
      {
        header: 'Tiêu cự\n(mm)',
        target: 'spec.focal_length_mm',
        type: 'number',
        help: 'BẮT BUỘC với ống thường và macro.',
        example: 25,
      },
      {
        header: 'Độ phóng đại\n(x)',
        target: 'spec.magnification',
        type: 'number',
        help: 'BẮT BUỘC với telecentric. Ví dụ 0.5.',
      },
      { header: 'Ngàm', target: 'spec.mount', type: 'choice', required: true, choices: MOUNT_CHOICES, help: 'Ngàm ống kính.', example: 'C' },
      {
        header: 'Image circle\n(mm)',
        target: 'spec.image_circle_mm',
        type: 'number',
        required: true,
        help: 'Đường kính vòng ảnh theo datasheet. Máy tự quy ra cỡ cảm biến lớn nhất mà vòng này phủ được.',
        example: 11,
      },
      {
        header: 'F số nhỏ nhất\n(khẩu mở lớn nhất)',
        target: 'spec.f_number_min',
        type: 'number',
        required: true,
        help: 'Ví dụ ống F1.4–F16 thì ghi 1.4.',
        example: 1.4,
      },
      {
        header: 'F số lớn nhất\n(khẩu đóng nhỏ nhất)',
        target: 'spec.f_number_max',
        type: 'number',
        required: true,
        help: 'Ví dụ ống F1.4–F16 thì ghi 16.',
        example: 16,
      },
      {
        header: 'Độ phân giải\n(lp/mm)',
        target: 'spec.resolution_lp_mm',
        type: 'number',
        help: 'Có thì điền — cần để biết ống có theo kịp pixel nhỏ không.',
        example: 100,
      },
      {
        header: 'Khoảng làm việc\ntối thiểu (mm)',
        target: 'spec.wd_min_mm',
        type: 'number',
        help: 'MOD — khoảng lấy nét gần nhất.',
        example: 100,
      },
      { header: 'Khoảng làm việc\ntối đa (mm)', target: 'spec.wd_max_mm', type: 'number', help: 'Bỏ trống nếu lấy nét tới vô cực.' },
      { header: 'Độ méo hình\n(%)', target: 'spec.distortion_pct', type: 'number', help: 'Giá trị tuyệt đối.', example: 0.1 },
      ...TAIL,
    ],
  },
  {
    name: 'ĐÈN',
    kind: 'light',
    codePrefix: 'LIGHT',
    columns: [
      ...HEAD,
      {
        header: 'Loại đèn',
        target: 'spec.light_type',
        type: 'choice',
        required: true,
        choices: {
          'Vòng (Ring)': 'ring',
          'Vòm (Dome)': 'dome',
          'Đèn nền (Backlight)': 'backlight',
          'Thanh (Bar)': 'bar',
          'Đồng trục (Coaxial)': 'coaxial',
          'Góc thấp (Dark field)': 'darkfield',
          'Photometric stereo': 'photometric_stereo',
        },
        help: 'Đèn phẳng tán xạ dùng đặt ở góc phản xạ cũng chọn "Đèn nền".',
        example: 'Vòng (Ring)',
      },
      {
        header: 'Màu',
        target: 'spec.color',
        type: 'choice',
        required: true,
        choices: {
          Trắng: 'white',
          Đỏ: 'red',
          'Xanh dương': 'blue',
          'Xanh lá': 'green',
          'Hồng ngoại (IR)': 'ir',
          'Tử ngoại (UV)': 'uv',
        },
        help: 'Màu ánh sáng.',
        example: 'Trắng',
      },
      { header: 'Bước sóng\n(nm)', target: 'spec.wavelength_nm', type: 'number', help: 'Đèn màu thì điền, ví dụ đỏ 625.' },
      {
        header: 'Kích thước\n(mm)',
        target: 'spec.size_mm',
        type: 'number',
        required: true,
        help: 'Vòng / vòm: đường kính NGOÀI. Đèn nền / thanh: cạnh DÀI của vùng phát sáng.',
        example: 100,
      },
      { header: 'Cạnh ngắn\n(mm)', target: 'spec.size_short_mm', type: 'number', help: 'Chỉ đèn nền / thanh.' },
      { header: 'Khoảng làm việc\ntối thiểu (mm)', target: 'spec.wd_min_mm', type: 'number', help: 'Theo khuyến nghị của hãng.' },
      { header: 'Khoảng làm việc\ntối đa (mm)', target: 'spec.wd_max_mm', type: 'number', help: 'Theo khuyến nghị của hãng.' },
      {
        header: 'Chạy xung (strobe)?',
        target: 'spec.strobe',
        type: 'choice',
        required: true,
        choices: YES_NO,
        help: 'Đèn chịu được xung dòng cao (overdrive) khi phơi sáng rất ngắn.',
        example: 'Có',
      },
      { header: 'Cấp bảo vệ IP', target: 'spec.ip_rating', type: 'text', help: 'Dạng IP65.' },
      ...TAIL,
    ],
  },
  {
    name: 'MÁY TÍNH IPC',
    kind: 'controller',
    codePrefix: 'PC',
    columns: [
      ...HEAD,
      { header: 'CPU', target: 'spec.cpu', type: 'text', required: true, help: 'Ví dụ Intel Core i7-12700E.', example: 'Intel Core i7-12700E' },
      { header: 'Số core', target: 'spec.cpu_cores', type: 'integer', required: true, help: 'Số nhân CPU.', example: 12 },
      { header: 'RAM\n(GB)', target: 'spec.ram_gb', type: 'integer', required: true, help: 'Dung lượng RAM.', example: 32 },
      { header: 'Số khe PCIe', target: 'spec.pcie_slots', type: 'integer', required: true, help: 'Khe còn trống để cắm card.', example: 2 },
      { header: 'Số cổng LAN', target: 'spec.lan_ports', type: 'integer', required: true, help: 'Cổng mạng có sẵn trên bo mạch.', example: 2 },
      { header: 'Model GPU', target: 'spec.gpu', type: 'text', help: 'Bỏ trống = không có GPU rời.' },
      { header: 'Ổ cứng\n(GB)', target: 'spec.storage_gb', type: 'integer', help: 'Tổng dung lượng.', example: 1000 },
      {
        header: 'Chuẩn giao tiếp\ncó sẵn',
        target: 'spec.interfaces',
        type: 'list',
        choices: identity(Object.keys(INTERFACE_BANDWIDTH)),
        help: `Cách nhau bằng dấu phẩy. Dùng đúng tên: ${Object.keys(INTERFACE_BANDWIDTH).join(', ')}.`,
        example: 'GigE',
      },
      { header: 'Số camera\ntối đa', target: 'spec.max_cameras', type: 'integer', help: 'Bỏ trống thì máy tự suy từ khe PCIe.' },
      ...TAIL,
    ],
  },
];

/** Dòng mẫu trong file Excel bắt đầu bằng chữ này ở cột Hãng — bộ nhập bỏ qua. */
export const EXAMPLE_MARK = '(Ví dụ)';

/** So khớp tiêu đề không phụ thuộc xuống dòng, khoảng trắng, hoa thường. */
export const normalizeHeader = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

// ----------------------------------------------------------- kiểm dòng --

export type SheetRow = { row: number; cells: Record<string, string> };

export type Problem = { sheet: string; row: number; column: string; message: string };

export type ParsedComponent = {
  sheet: string;
  row: number;
  code: string;
  kind: ComponentKind;
  brand: string;
  model: string;
  spec: Record<string, unknown>;
  price_vnd: number | null;
  lead_time_days: number | null;
  supplier: string | null;
  used_in_projects: number;
  source: ComponentSource;
  datasheet_url: string | null;
  notes_vi: string | null;
};

/** Mã tự sinh: CAM-BASLER-A2A2440-20GMPRO. Khớp quy tắc mã ở trang quản trị. */
export function componentCode(prefix: string, brand: string, model: string): string {
  const slug = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return [prefix, slug(brand), slug(model)].filter(Boolean).join('-');
}

/**
 * Cỡ cảm biến LỚN NHẤT mà vòng ảnh (mm) phủ trọn được.
 *
 * Làm tròn XUỐNG là có chủ ý: ống ghi 11 mm phủ được 2/3" (đường chéo 11,0)
 * nhưng không phủ được 1". Làm tròn lên thì bộ chọn ghép ống này với camera
 * 1" và ảnh tối bốn góc. Sai số cho phép 0,5% để 11 mm không bị đánh trượt
 * khỏi 2/3" (11,0 mm) vì làm tròn trên datasheet.
 */
export function imageCircleFormat(diameterMm: number): string | null {
  const fits = SENSOR_FORMAT_KEYS.filter((key) => sensorDiagonalMm(key)! <= diameterMm * 1.005);
  return fits.length > 0 ? fits[fits.length - 1] : null;
}

/**
 * Cỡ cảm biến có đường chéo gần nhất với kích thước tính từ pixel.
 *
 * Dùng để bắt lỗi kiểu mockup: 5472 × 3648 px × 2,4 µm = 13,1 × 8,8 mm là cỡ
 * 1", nhưng tài liệu ghi 1.1". Lệch cỡ → lệch yêu cầu vòng ảnh của ống kính.
 */
export function closestSensorFormat(widthPx: number, heightPx: number, pixelUm: number): string {
  const diagonal = (Math.hypot(widthPx, heightPx) * pixelUm) / 1000;
  return [...SENSOR_FORMAT_KEYS].sort(
    (a, b) => Math.abs(sensorDiagonalMm(a)! - diagonal) - Math.abs(sensorDiagonalMm(b)! - diagonal)
  )[0];
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Ô số kiểu Việt Nam: "18.500.000" hoặc "3,45". */
function parseNumber(text: string, integer: boolean): number | null {
  let cleaned = text.replace(/\s/g, '');
  if (integer) cleaned = cleaned.replace(/[.,](?=\d{3}(\D|$))/g, '');
  cleaned = cleaned.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  if (integer && !Number.isInteger(value)) return null;
  return value;
}

export function parseSheet(sheet: SheetDef, rows: SheetRow[]): { components: ParsedComponent[]; problems: Problem[] } {
  const components: ParsedComponent[] = [];
  const problems: Problem[] = [];

  for (const { row, cells } of rows) {
    if ((cells['brand'] ?? '').startsWith(EXAMPLE_MARK)) continue;
    if (Object.values(cells).every((value) => value.trim() === '')) continue;

    const at = (column: ColumnDef | string, message: string) =>
      problems.push({
        sheet: sheet.name,
        row,
        column: typeof column === 'string' ? column : column.header.replace(/\n/g, ' '),
        message,
      });

    const values: Record<string, unknown> = {};
    for (const column of sheet.columns) {
      const text = (cells[column.target] ?? '').trim();
      if (text === '') {
        if (column.required) at(column, 'Bắt buộc, đang để trống.');
        continue;
      }

      if (column.type === 'number' || column.type === 'integer') {
        const value = parseNumber(text, column.type === 'integer');
        if (value === null) at(column, `"${text}" không phải ${column.type === 'integer' ? 'số nguyên' : 'số'} không âm.`);
        else values[column.target] = value;
      } else if (column.type === 'choice') {
        const match = Object.entries(column.choices!).find(([label, value]) =>
          [label, value].some((option) => option.toLowerCase() === text.toLowerCase())
        );
        if (!match) at(column, `"${text}" không nằm trong danh sách: ${Object.keys(column.choices!).join(' / ')}.`);
        else values[column.target] = match[1];
      } else if (column.type === 'list') {
        const items = text.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
        const valid = Object.values(column.choices!);
        const unknown = items.filter((item) => !valid.includes(item));
        if (unknown.length > 0) at(column, `Không nhận ra: ${unknown.join(', ')}. Dùng đúng tên: ${valid.join(', ')}.`);
        else values[column.target] = items;
      } else {
        values[column.target] = text;
      }
    }

    const spec: Record<string, unknown> = {};
    for (const [target, value] of Object.entries(values)) {
      if (target.startsWith('spec.')) spec[target.slice(5)] = value;
    }

    const num = (key: string) => (typeof spec[key] === 'number' ? (spec[key] as number) : null);
    const find = (target: string) => sheet.columns.find((c) => c.target === target)!;

    if (sheet.kind === 'camera') {
      const widthPx = values['derive.width_px'] as number | undefined;
      if (spec.camera_type === 'line') {
        if (widthPx !== undefined) spec.line_width_px = widthPx;
        for (const key of ['resolution_h_px', 'sensor_format', 'max_fps']) {
          if (spec[key] !== undefined) at(find(`spec.${key}`), 'Line scan không dùng cột này — để trống.');
        }
      } else if (spec.camera_type === 'area') {
        if (widthPx !== undefined) spec.resolution_w_px = widthPx;
        const heightPx = num('resolution_h_px');
        if (heightPx === null && !problems.some((p) => p.row === row && p.sheet === sheet.name && p.column.startsWith('Độ phân giải dọc'))) {
          at(find('spec.resolution_h_px'), 'Area scan bắt buộc điền.');
        }
        if (spec.sensor_format === undefined) at(find('spec.sensor_format'), 'Area scan bắt buộc điền.');
        if (spec.max_line_rate_khz !== undefined) at(find('spec.max_line_rate_khz'), 'Area scan không dùng cột này — để trống.');

        const pitch = num('pixel_size_um');
        if (widthPx !== undefined && heightPx !== null) {
          spec.resolution_mp = round((widthPx * heightPx) / 1e6, 1);
          if (pitch !== null && typeof spec.sensor_format === 'string') {
            const closest = closestSensorFormat(widthPx, heightPx, pitch);
            if (closest !== spec.sensor_format) {
              const w = round((widthPx * pitch) / 1000, 2);
              const h = round((heightPx * pitch) / 1000, 2);
              at(
                find('spec.sensor_format'),
                `Ghi ${spec.sensor_format}" nhưng ${widthPx} × ${heightPx} px × ${pitch} µm = ${w} × ${h} mm, gần cỡ ${closest}" nhất. Kiểm lại datasheet.`
              );
            }
          }
        }
      }
      if (spec.ip_rating !== undefined && !/^IP\d{2}$/i.test(String(spec.ip_rating))) {
        at(find('spec.ip_rating'), 'Ghi dạng IP + 2 chữ số, ví dụ IP67.');
      } else if (typeof spec.ip_rating === 'string') spec.ip_rating = spec.ip_rating.toUpperCase();
    }

    if (sheet.kind === 'lens') {
      if ((spec.lens_type === 'fixed' || spec.lens_type === 'macro') && spec.focal_length_mm === undefined) {
        at(find('spec.focal_length_mm'), 'Ống thường / macro bắt buộc có tiêu cự.');
      }
      if (spec.lens_type === 'telecentric' && spec.magnification === undefined) {
        at(find('spec.magnification'), 'Telecentric bắt buộc có độ phóng đại.');
      }
      const circle = num('image_circle_mm');
      if (circle !== null) {
        const format = imageCircleFormat(circle);
        if (format === null) {
          const smallest = SENSOR_FORMAT_KEYS[0];
          at(find('spec.image_circle_mm'), `${circle} mm nhỏ hơn cả cảm biến ${smallest}" (${round(sensorDiagonalMm(smallest)!, 1)} mm).`);
        } else spec.image_circle = format;
      }
      const fMin = num('f_number_min');
      const fMax = num('f_number_max');
      if (fMin !== null && fMax !== null && fMin > fMax) at(find('spec.f_number_min'), `F số nhỏ nhất (${fMin}) lớn hơn F số lớn nhất (${fMax}) — có thể điền ngược cột.`);
    }

    if (sheet.kind === 'lens' || sheet.kind === 'light') {
      const wdMin = num('wd_min_mm');
      const wdMax = num('wd_max_mm');
      if (wdMin !== null && wdMax !== null && wdMin > wdMax) at(find('spec.wd_min_mm'), `Khoảng làm việc tối thiểu (${wdMin}) lớn hơn tối đa (${wdMax}).`);
    }

    if (sheet.kind === 'light' && spec.ip_rating !== undefined) {
      if (!/^IP\d{2}$/i.test(String(spec.ip_rating))) at(find('spec.ip_rating'), 'Ghi dạng IP + 2 chữ số, ví dụ IP65.');
      else spec.ip_rating = String(spec.ip_rating).toUpperCase();
    }

    const brand = (values.brand as string | undefined) ?? '';
    const model = (values.model as string | undefined) ?? '';
    const code = (values.code as string | undefined)?.toUpperCase() ?? componentCode(sheet.codePrefix, brand, model);
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) {
      at(find('code'), `Mã "${code}" chỉ được gồm CHỮ HOA, số và dấu gạch ngang.`);
    }

    const url = values.datasheet_url as string | undefined;
    if (url !== undefined && !/^https?:\/\//i.test(url)) at(find('datasheet_url'), 'Link phải bắt đầu bằng http:// hoặc https://.');

    components.push({
      sheet: sheet.name,
      row,
      code,
      kind: sheet.kind,
      brand,
      model,
      spec,
      price_vnd: (values.price_vnd as number | undefined) ?? null,
      lead_time_days: (values.lead_time_days as number | undefined) ?? null,
      supplier: (values.supplier as string | undefined) ?? null,
      used_in_projects: (values.used_in_projects as number | undefined) ?? 0,
      source: (values.source as ComponentSource | undefined) ?? 'unverified',
      datasheet_url: url ?? null,
      notes_vi: (values.notes_vi as string | undefined) ?? null,
    });
  }

  return { components, problems };
}

/** Kiểm cả file: từng sheet + mã trùng giữa các dòng (kể cả khác sheet). */
export function parseWorkbook(sheets: { sheet: SheetDef; rows: SheetRow[] }[]): {
  components: ParsedComponent[];
  problems: Problem[];
} {
  const components: ParsedComponent[] = [];
  const problems: Problem[] = [];
  for (const { sheet, rows } of sheets) {
    const result = parseSheet(sheet, rows);
    components.push(...result.components);
    problems.push(...result.problems);
  }

  const seen = new Map<string, ParsedComponent>();
  for (const component of components) {
    const first = seen.get(component.code);
    if (first) {
      problems.push({
        sheet: component.sheet,
        row: component.row,
        column: 'Mã linh kiện',
        message: `Mã ${component.code} trùng với sheet ${first.sheet} dòng ${first.row}. Hai dòng cùng hãng + model?`,
      });
    } else seen.set(component.code, component);
  }

  return { components, problems };
}

// ------------------------------------------------------------------ SQL --

const sqlText = (value: string | null) => (value === null ? 'null' : `'${value.replace(/'/g, "''")}'`);
const sqlNumber = (value: number | null) => (value === null ? 'null' : String(value));

/**
 * SQL upsert theo mã.
 *
 * Khi cập nhật thiết bị đã có: THAY cả spec (Excel là bản đầy đủ), giữ nguyên
 * notes_en và sort_order (Excel không có hai cột này), và KHÔNG động tới
 * is_active — thiết bị admin đã tắt thì nhập lại cũng không tự bật.
 */
export function toSql(components: ParsedComponent[], generatedAt = new Date()): string {
  const values = components
    .map(
      (c, index) => `(${sqlText(c.code)}, ${sqlText(c.kind)}, ${sqlText(c.brand)}, ${sqlText(c.model)},
 '${JSON.stringify(c.spec).replace(/'/g, "''")}'::jsonb,
 ${sqlNumber(c.price_vnd)}, ${sqlNumber(c.lead_time_days)}, ${sqlText(c.supplier)}, ${c.used_in_projects},
 ${sqlText(c.source)}, ${sqlText(c.datasheet_url)}, ${sqlText(c.notes_vi)}, ${1000 + index * 10})`
    )
    .join(',\n\n');

  const counts = SHEETS.map((s) => `${s.name}: ${components.filter((c) => c.kind === s.kind).length}`).join(', ');

  return `-- =============================================================================
-- Catalog linh kiện — sinh tự động từ file Excel bởi scripts/import-components.ts
-- Sinh lúc: ${generatedAt.toISOString()}
-- Số thiết bị: ${components.length} (${counts})
--
-- Cần chạy trước: migration 20260917000001_component_sourcing.sql
-- (file CHAY-BUOC-NAY-THIETBI.sql).
--
-- Chạy lại được: trùng mã thì cập nhật, không nhân bản. Thiết bị đang có trên
-- web mà không nằm trong file này được giữ nguyên.
-- =============================================================================

insert into public.components
  (code, kind, brand, model, spec, price_vnd, lead_time_days, supplier, used_in_projects,
   source, datasheet_url, notes_vi, sort_order)
values

${values}

on conflict (code) do update set
  kind             = excluded.kind,
  brand            = excluded.brand,
  model            = excluded.model,
  spec             = excluded.spec,
  price_vnd        = excluded.price_vnd,
  lead_time_days   = excluded.lead_time_days,
  supplier         = excluded.supplier,
  used_in_projects = excluded.used_in_projects,
  source           = excluded.source,
  datasheet_url    = excluded.datasheet_url,
  notes_vi         = excluded.notes_vi;
`;
}
