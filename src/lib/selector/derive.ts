import {
  COLOR_DEFAULT_PIXEL_FORMAT,
  DEFAULT_PIXEL_FORMAT,
  pixelFormatBytes,
} from '@/lib/components/specs';
import {
  GRR_DIVISOR,
  K_SUBPIXEL,
  measurementBudget,
  type MeasurementBudget,
} from '@/lib/vision/resolution';
import type { DerivedAssumption, DerivedMetric, EvalContext, SelectorInput } from './types';

/**
 * Tỉ lệ cao/rộng giả định khi thiếu một cạnh FOV: 4:3.
 *
 * CHỈ là lưới an toàn cho dữ liệu cũ (lưu trước khi form hỏi chiều cao ở mọi
 * bài area scan) hoặc gọi API trực tiếp. Không dùng 1:1: vật thể công nghiệp
 * hiếm khi vuông, và giả định vuông sai theo hướng CHỌN DƯ — FOV 100 × 50 mm
 * thành 9 MP thay vì 4,5 MP.
 */
export const FALLBACK_FOV_ASPECT = 0.75;

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

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Làm tròn LÊN số pixel, bỏ qua sai số dấu phẩy động: 100 ÷ (0,1 ÷ 3) ra
    3000,0000000000005 và `Math.ceil` thẳng sẽ đòi thành 3001 px. */
function ceilPx(value: number): number {
  return Math.ceil(value - 1e-9);
}

/**
 * Bài toán mà `tolerance_mm` là dung sai ĐO dạng ± chứ không phải kích thước
 * đặc trưng cần phân biệt.
 *
 * Với bài đo, công thức "3 px phủ lên dung sai" của CLAUDE.md mục 4 sai bản
 * chất: ±t là dải tổng T = 2t, hệ đo chỉ được chiếm 1/10 dải đó (GR&R), và nội
 * suy dưới pixel lặp lại được cỡ 1/3 pixel. Ra mm/px = (2t ÷ 10) × 3, tức ±0,1
 * mm cần 0,06 mm/px chứ không phải 0,033. Công thức nằm ở `measurementBudget()`
 * trong vision/resolution.ts — một chỗ duy nhất, bài ngoại quan dùng chung.
 *
 * Alignment cũng có `tolerance_mm` nhưng CỐ Ý chưa đổi: sai số căn chỉnh không
 * phải phép đo theo dung sai, cần quyết định riêng.
 */
export const GAGE_TOLERANCE_TASKS: ReadonlySet<string> = new Set(['2d-measurement']);

type ResolutionTarget = {
  /** mm/px cần đạt trên trục dài. */
  mmPerPx: number;
  /** Số pixel thực tế phủ lên đặc trưng ở độ phân giải trên. */
  pxPerFeature: number;
  label: string;
  /** Vế chia trong công thức hiển thị, đã kèm giải thích. */
  explain: string;
};

function gageExplain(budget: MeasurementBudget, prefix = ''): string {
  return (
    `${round4(budget.mmPerPx)} mm/px [${prefix}±${budget.toleranceMm} mm → ` +
    `(${round4(budget.totalToleranceMm)} mm ÷ ${GRR_DIVISOR}) × ${K_SUBPIXEL} px`
  );
}

/**
 * Độ phân giải cần đạt, tính theo mm/px.
 *
 * Hai nhánh độc lập rồi lấy cái CHẶT hơn (min mm/px) — giống hệt
 * `requiredPixels()` bên vision để công cụ chọn thiết bị và bảng luật ra cùng
 * một con số:
 *   - Phát hiện: đặc trưng ÷ số pixel phủ lên nó. Với lỗi nhỏ nhất, số pixel là
 *     N người dùng khai (`px_per_defect`), không phải hệ số 3 cố định.
 *   - Đo lường: `measurement_tolerance_mm` (bài ngoại quan có đo kích thước),
 *     hoặc chính `tolerance_mm` với bài trong GAGE_TOLERANCE_TASKS.
 */
function resolutionTarget(
  input: SelectorInput,
  safetyFactor: number,
  taskSlug: string | null
): ResolutionTarget | null {
  // Đặc trưng nhỏ nhất cần phân biệt, và số pixel cần phủ lên nó — xem
  // FEATURE_SOURCES ở trên để biết vì sao con số khác nhau giữa các bài toán.
  const source = FEATURE_SOURCES.find((candidate) => {
    const value = num(input[candidate.key]);
    return value !== null && value > 0;
  });

  let primary: (ResolutionTarget & { feature: number }) | null = null;
  if (source) {
    const feature = num(input[source.key])!;
    const gage =
      source.key === 'tolerance_mm' && taskSlug !== null && GAGE_TOLERANCE_TASKS.has(taskSlug)
        ? measurementBudget(feature)
        : null;

    if (gage) {
      primary = {
        feature,
        mmPerPx: gage.mmPerPx,
        pxPerFeature: round(feature / gage.mmPerPx),
        label: 'dung sai đo',
        explain: `${gageExplain(gage)}]`,
      };
    } else {
      const declaredN = source.key === 'defect_min_size_mm' ? num(input.px_per_defect) : null;
      const px = declaredN !== null && declaredN > 0 ? declaredN : (source.pxPerFeature ?? safetyFactor);
      primary = {
        feature,
        mmPerPx: feature / px,
        pxPerFeature: px,
        label: source.labelVi,
        explain: `(${feature} mm ÷ ${px} px)`,
      };
    }
  }

  const measurement = measurementBudget(num(input.measurement_tolerance_mm));
  if (!measurement) return primary;

  if (primary && primary.mmPerPx <= measurement.mmPerPx) {
    return {
      ...primary,
      explain: `${primary.explain} [chặt hơn ngân sách đo ±${measurement.toleranceMm} mm = ${round4(measurement.mmPerPx)} mm/px]`,
    };
  }

  return {
    mmPerPx: measurement.mmPerPx,
    pxPerFeature: round((primary?.feature ?? measurement.toleranceMm) / measurement.mmPerPx),
    label: 'sai số đo',
    explain: primary
      ? `${gageExplain(measurement, 'đo ')}; chặt hơn ${primary.explain} = ${round4(primary.mmPerPx)} mm/px của ${primary.label}]`
      : `${gageExplain(measurement)}]`,
  };
}

/**
 * Tính các đại lượng suy ra từ đầu vào.
 *
 * Đây là PHÉP TÍNH, không phải luật nghiệp vụ — luật nằm ở bảng selector_rules
 * trong database. Kết quả tính được đưa ngược vào ngữ cảnh đánh giá, nên luật
 * viết được điều kiện kiểu "required_resolution_px > 5000 thì dùng line scan",
 * và admin vẫn sửa được ngưỡng đó qua bảng luật mà không cần đụng vào code.
 *
 * Công thức, áp trên trục dài hơn của FOV:
 *   Resolution_can_thiet (px) = FOV_mm ÷ mm/px cần đạt
 *   mm/px cần đạt = min(đặc trưng ÷ số px phủ lên nó, ngân sách đo)
 * Với bài không có yêu cầu đo, vế đầu chính là công thức CLAUDE.md mục 4.
 * Xem `resolutionTarget()` cho hai nhánh.
 *
 * `taskSlug` cho biết `tolerance_mm` là dung sai đo hay không — xem
 * GAGE_TOLERANCE_TASKS. Bỏ trống thì tính như bài không đo.
 */
export function deriveMetrics(
  input: SelectorInput,
  safetyFactor: number = DEFAULT_SAFETY_FACTOR,
  taskSlug: string | null = null
): { context: EvalContext; metrics: DerivedMetric[]; assumptions: DerivedAssumption[] } {
  const metrics: DerivedMetric[] = [];
  const derived: EvalContext = {};
  const assumptions: DerivedAssumption[] = [];

  const width = num(input.fov_width_mm);
  const height = num(input.fov_height_mm);

  if (width !== null || height !== null) {
    let usedWidth = width;
    let usedHeight = height;

    if (width === null || height === null) {
      const known = (width ?? height) as number;

      if (input.capture_mode === 'line_scan') {
        /* Line scan không có chiều cao FOV theo thiết kế — ảnh dựng theo chiều
           quét. Giữ cách tính cũ và KHÔNG cảnh báo: thiếu ở đây là đúng. */
        usedWidth = known;
        usedHeight = known;
      } else if (height === null) {
        // TODO(V1b): chuyển thành assumptionId theo Field<T> (spec §3.2, confidence 'assumed').
        usedHeight = round(known * FALLBACK_FOV_ASPECT);
        assumptions.push({
          key: 'fov_height_mm',
          value: usedHeight,
          unit: 'mm',
          ratio: '4:3',
          vi: `Chiều cao FOV chưa xác định — đã giả định ${usedHeight} mm (= chiều rộng ${known} mm × ${FALLBACK_FOV_ASPECT}, tỉ lệ 4:3). Nhập chiều cao thật để kết quả chính xác.`,
          en: `FOV height not specified — assumed ${usedHeight} mm (= width ${known} mm × ${FALLBACK_FOV_ASPECT}, 4:3 ratio). Enter the real height for an accurate result.`,
        });
      } else {
        // TODO(V1b): chuyển thành assumptionId theo Field<T> (spec §3.2, confidence 'assumed').
        usedWidth = round(known / FALLBACK_FOV_ASPECT);
        assumptions.push({
          key: 'fov_width_mm',
          value: usedWidth,
          unit: 'mm',
          ratio: '4:3',
          vi: `Chiều rộng FOV chưa xác định — đã giả định ${usedWidth} mm (= chiều cao ${known} mm ÷ ${FALLBACK_FOV_ASPECT}, tỉ lệ 4:3). Nhập chiều rộng thật để kết quả chính xác.`,
          en: `FOV width not specified — assumed ${usedWidth} mm (= height ${known} mm ÷ ${FALLBACK_FOV_ASPECT}, 4:3 ratio). Enter the real width for an accurate result.`,
        });
      }
    }

    const long = Math.max(usedWidth as number, usedHeight as number);
    const short = Math.min(usedWidth as number, usedHeight as number);
    const side = (given: number | null, used: number | null) =>
      given !== null ? `${given} mm` : input.capture_mode === 'line_scan' ? '—' : `${used} mm (giả định)`;
    derived.fov_long_mm = round(long);
    derived.fov_short_mm = round(short);
    metrics.push({
      key: 'fov_long_mm',
      value: round(long),
      formula: `max(${side(width, usedWidth)}, ${side(height, usedHeight)}) = ${round(long)} mm`,
    });
  }

  const longFov = num(derived.fov_long_mm);
  const target = longFov !== null && longFov > 0 ? resolutionTarget(input, safetyFactor, taskSlug) : null;

  if (target && longFov !== null) {
    derived.px_per_feature = target.pxPerFeature;
    const requiredPx = longFov / target.mmPerPx;
    const requiredPxCeil = ceilPx(requiredPx);
    derived.required_resolution_px = requiredPxCeil;
    metrics.push({
      key: 'required_resolution_px',
      value: requiredPxCeil,
      formula: `${longFov} mm ÷ ${target.explain} = ${requiredPxCeil} px trên trục dài (${target.label})`,
    });

    const pxPerMm = requiredPx / longFov;
    derived.px_per_mm = round(pxPerMm);
    metrics.push({
      key: 'px_per_mm',
      value: round(pxPerMm),
      formula: `${requiredPxCeil} px ÷ ${longFov} mm = ${round(pxPerMm)} px/mm`,
    });

    // Số điểm ảnh tối thiểu của cảm biến, giả định giữ nguyên tỉ lệ khung hình.
    const shortFov = num(derived.fov_short_mm) ?? longFov;
    const shortPx = pxPerMm * shortFov;
    const megapixels = (requiredPx * shortPx) / 1_000_000;
    derived.required_sensor_mp = round(megapixels);
    metrics.push({
      key: 'required_sensor_mp',
      value: round(megapixels),
      formula: `${requiredPxCeil} px × ${ceilPx(shortPx)} px ≈ ${round(megapixels)} MP`,
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

  return { context: { ...input, ...derived }, metrics, assumptions };
}
