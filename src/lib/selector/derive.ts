import {
  COLOR_DEFAULT_PIXEL_FORMAT,
  DEFAULT_PIXEL_FORMAT,
  pixelFormatBytes,
} from '@/lib/components/specs';
import type { DerivedMetric, EvalContext, SelectorInput } from './types';

/**
 * Hệ số an toàn: số pixel tối thiểu phủ lên một feature nhỏ nhất cần phân biệt.
 * CLAUDE.md mục 4 nêu khoảng 2–3 px/feature; lấy 3 cho an toàn.
 */
export const DEFAULT_SAFETY_FACTOR = 3;

/**
 * Đặc trưng nhỏ nhất cần phân biệt được lấy từ trường nào, và cần bao nhiêu
 * pixel phủ lên nó.
 *
 * Số pixel KHÔNG giống nhau giữa các bài toán, đây là chỗ dễ tính sai nhất:
 *
 * - Dung sai / kích thước lỗi: 2–3 px là đủ (CLAUDE.md mục 4).
 * - Ô module mã vạch (X-dimension): 2–3 px cho mã in thường; mã DPM khắc trực
 *   tiếp lên kim loại thì luật trong database sẽ nâng thêm.
 * - Chiều cao ký tự OCR: cần khoảng 20 px thì nhận dạng mới ổn định. Dùng 3 px
 *   như các bài khác sẽ ra độ phân giải thấp hơn thực tế gần 7 lần.
 *
 * Thứ tự trong mảng là thứ tự ưu tiên khi có nhiều trường cùng được điền.
 */
const FEATURE_SOURCES: { key: string; pxPerFeature?: number; labelVi: string }[] = [
  { key: 'tolerance_mm', labelVi: 'dung sai' },
  { key: 'defect_min_size_mm', labelVi: 'lỗi nhỏ nhất' },
  { key: 'module_size_mm', labelVi: 'ô module mã' },
  { key: 'character_height_mm', pxPerFeature: 20, labelVi: 'chiều cao ký tự' },
];

/*
 * CỐ Ý KHÔNG có 'pick_accuracy_mm' trong danh sách trên.
 *
 * Độ chính xác định vị của robot đạt được bằng ước lượng tâm DƯỚI PIXEL — thuật
 * toán nội suy trọng tâm cho độ chính xác nhỏ hơn kích thước một pixel nhiều
 * lần. Áp công thức "3 px phủ lên đặc trưng" cho nó là sai bản chất và làm phồng
 * yêu cầu cảm biến lên khoảng một bậc.
 *
 * Ví dụ đã đo: FOV 500×400 mm, độ chính xác gắp 0,1 mm → công thức cũ đòi
 * 15.000 px / 180 MP, đặt ngay cạnh ghi chú "chọn camera chính xác hơn robot là
 * lãng phí". Con số đó đi thẳng vào báo giá thiết bị.
 *
 * pick_accuracy_mm vẫn dùng được làm ĐIỀU KIỆN trong bảng luật (luật
 * ROBOT-TIGHT-ACCURACY so ngưỡng 0,1 mm), chỉ không vào công thức độ phân giải.
 */

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Tính các đại lượng suy ra từ đầu vào.
 *
 * Đây là PHÉP TÍNH, không phải luật nghiệp vụ — luật nằm ở bảng selector_rules
 * trong database. Kết quả tính được đưa ngược vào ngữ cảnh đánh giá, nên luật
 * viết được điều kiện kiểu "required_resolution_px > 5000 thì dùng line scan",
 * và admin vẫn sửa được ngưỡng đó qua bảng luật mà không cần đụng vào code.
 *
 * Công thức (CLAUDE.md mục 4):
 *   Resolution_can_thiet (px) = FOV_mm / (Dung_sai_mm / He_so_an_toan)
 * áp trên trục dài hơn của FOV.
 */
export function deriveMetrics(
  input: SelectorInput,
  safetyFactor: number = DEFAULT_SAFETY_FACTOR
): { context: EvalContext; metrics: DerivedMetric[] } {
  const metrics: DerivedMetric[] = [];
  const derived: EvalContext = {};

  const width = num(input.fov_width_mm);
  const height = num(input.fov_height_mm);

  if (width !== null || height !== null) {
    const long = Math.max(width ?? 0, height ?? 0);
    const short = Math.min(width ?? long, height ?? long);
    derived.fov_long_mm = round(long);
    derived.fov_short_mm = round(short);
    metrics.push({
      key: 'fov_long_mm',
      value: round(long),
      formula: `max(${width ?? '—'} mm, ${height ?? '—'} mm) = ${round(long)} mm`,
    });
  }

  // Đặc trưng nhỏ nhất cần phân biệt, và số pixel cần phủ lên nó — xem
  // FEATURE_SOURCES ở trên để biết vì sao con số khác nhau giữa các bài toán.
  const source = FEATURE_SOURCES.find((candidate) => {
    const value = num(input[candidate.key]);
    return value !== null && value > 0;
  });

  const feature = source ? num(input[source.key]) : null;
  const featureLabel = source?.labelVi ?? '';
  const pxPerFeature = source?.pxPerFeature ?? safetyFactor;

  const longFov = num(derived.fov_long_mm);

  if (feature !== null && feature > 0 && longFov !== null && longFov > 0) {
    derived.px_per_feature = pxPerFeature;
    const requiredPx = (longFov * pxPerFeature) / feature;
    derived.required_resolution_px = Math.ceil(requiredPx);
    metrics.push({
      key: 'required_resolution_px',
      value: Math.ceil(requiredPx),
      formula: `${longFov} mm ÷ (${feature} mm ÷ ${pxPerFeature} px) = ${Math.ceil(requiredPx)} px trên trục dài (${featureLabel})`,
    });

    const pxPerMm = requiredPx / longFov;
    derived.px_per_mm = round(pxPerMm);
    metrics.push({
      key: 'px_per_mm',
      value: round(pxPerMm),
      formula: `${Math.ceil(requiredPx)} px ÷ ${longFov} mm = ${round(pxPerMm)} px/mm`,
    });

    // Số điểm ảnh tối thiểu của cảm biến, giả định giữ nguyên tỉ lệ khung hình.
    const shortFov = num(derived.fov_short_mm) ?? longFov;
    const shortPx = pxPerMm * shortFov;
    const megapixels = (requiredPx * shortPx) / 1_000_000;
    derived.required_sensor_mp = round(megapixels);
    metrics.push({
      key: 'required_sensor_mp',
      value: round(megapixels),
      formula: `${Math.ceil(requiredPx)} px × ${Math.ceil(shortPx)} px ≈ ${round(megapixels)} MP`,
    });
  }

  /*
   * Băng thông dữ liệu — thứ quyết định giao tiếp camera và cấu hình máy tính.
   *
   * Cố ý CHỈ tính ra con số, không tự chọn GigE hay CoaXPress: ngưỡng nào dùng
   * chuẩn nào là quyết định kỹ thuật, phải nằm trong bảng luật admin sửa được
   * (CLAUDE.md mục 9). Luật viết điều kiện theo data_rate_mbytes_s.
   *
   *   fps      = sản phẩm mỗi phút ÷ 60   (giả định một ảnh cho một sản phẩm)
   *   byte/px  = tra PIXEL_FORMAT_BYTES theo định dạng ảnh
   *   MB/s     = MP × byte/px × fps
   *
   * Byte/px TỪNG được khai ngay tại đây là `color_critical ? 3 : 1`. Sai, và
   * sai lệch hẳn ba lần: camera màu công nghiệp truyền Bayer THÔ 1 byte/px,
   * việc nội suy ra RGB làm ở máy tính. Chỉ vài model truyền RGB8 đã nội suy
   * sẵn mới thật sự tốn 3 byte/px.
   *
   * Tệ hơn cả con số sai là việc nó SAI KHÁC với `vision/timing.ts` — nơi đã
   * có bảng PIXEL_FORMAT_BYTES đúng kèm comment giải thích chính lỗi này. Cùng
   * một bài toán, hai công cụ ra hai băng thông lệch ba lần, rồi con số của
   * derive chảy tiếp vào `maxCamerasByBandwidth()` nên kéo sai luôn số máy
   * tính và số card giao tiếp trong báo giá. Nay cả hai tra chung một bảng.
   */
  const throughput = num(input.throughput_ppm);
  const sensorMp = num(derived.required_sensor_mp);

  if (throughput !== null && throughput > 0 && sensorMp !== null && sensorMp > 0) {
    const fps = throughput / 60;
    derived.fps_required = round(fps);
    metrics.push({
      key: 'fps_required',
      value: round(fps),
      formula: `${throughput} sp/phút ÷ 60 = ${round(fps)} ảnh/giây`,
    });

    /* Ưu tiên định dạng người dùng đã khai ở form (trường `pixel_format` vốn
       đã có trong catalog trường, chỉ chỗ này là chưa đọc tới). Không khai thì
       suy từ `color_critical` — và suy ra BayerRG8, tức vẫn 1 byte/px, chứ
       không phải 3. Định dạng lạ cũng lùi về mặc định thay vì đoán. */
    const declaredFormat = typeof input.pixel_format === 'string' ? input.pixel_format : null;
    const requestedFormat =
      declaredFormat ??
      (input.color_critical === true ? COLOR_DEFAULT_PIXEL_FORMAT : DEFAULT_PIXEL_FORMAT);
    /* Định dạng lạ thì lùi về mặc định cho CẢ tên lẫn số byte. Lùi mỗi số byte
       mà giữ tên cũ thì công thức ghi "1 byte/px (Mono10packed)" — sai, vì
       Mono10packed thật là 1,25 byte/px, và người đọc không có cách nào biết
       phép tính đã âm thầm đổi sang Mono8. */
    const pixelFormat =
      pixelFormatBytes(requestedFormat) === null ? DEFAULT_PIXEL_FORMAT : requestedFormat;
    const bytesPerPixel = pixelFormatBytes(pixelFormat)!;

    const dataRate = sensorMp * bytesPerPixel * fps;
    derived.data_rate_mbytes_s = round(dataRate);
    metrics.push({
      key: 'data_rate_mbytes_s',
      value: round(dataRate),
      // Hiện cả tên định dạng: 1 byte/px cho ảnh màu trông như lỗi nếu không
      // nói rõ đang tính theo Bayer.
      formula: `${sensorMp} MP × ${bytesPerPixel} byte/px (${pixelFormat}) × ${round(fps)} fps ≈ ${round(dataRate)} MB/s`,
    });
  }

  derived.safety_factor = safetyFactor;

  return { context: { ...input, ...derived }, metrics };
}
