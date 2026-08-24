import type { DerivedMetric, EvalContext, SelectorInput } from './types';

/**
 * Hệ số an toàn: số pixel tối thiểu phủ lên một feature nhỏ nhất cần phân biệt.
 * CLAUDE.md mục 4 nêu khoảng 2–3 px/feature; lấy 3 cho an toàn.
 */
export const DEFAULT_SAFETY_FACTOR = 3;

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

  // Feature nhỏ nhất cần phân biệt: dung sai với bài đo lường, kích thước lỗi
  // nhỏ nhất với bài kiểm tra ngoại quan.
  const tolerance = num(input.tolerance_mm);
  const defectSize = num(input.defect_min_size_mm);
  const feature = tolerance ?? defectSize;
  const featureLabel = tolerance !== null ? 'dung sai' : 'lỗi nhỏ nhất';

  const longFov = num(derived.fov_long_mm);

  if (feature !== null && feature > 0 && longFov !== null && longFov > 0) {
    const requiredPx = (longFov * safetyFactor) / feature;
    derived.required_resolution_px = Math.ceil(requiredPx);
    metrics.push({
      key: 'required_resolution_px',
      value: Math.ceil(requiredPx),
      formula: `${longFov} mm ÷ (${feature} mm ÷ ${safetyFactor} px) = ${Math.ceil(requiredPx)} px trên trục dài (${featureLabel})`,
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

  derived.safety_factor = safetyFactor;

  return { context: { ...input, ...derived }, metrics };
}
