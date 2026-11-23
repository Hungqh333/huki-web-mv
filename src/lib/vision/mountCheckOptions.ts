import { sensorDiagonalMm, specNumber, specString, type Component } from '@/lib/components/specs';
import { cameraFromComponent, lensFromComponent } from '@/lib/vision/configurationRules';
import { sensorOf } from '@/lib/vision/lensSelector';

/**
 * Danh sách chọn của trang Kiểm tra lắp đặt (chốt 2026-11-11 Q1-B): rút gọn kho ở máy chủ, chỉ gửi
 * xuống trình duyệt đúng các số hình cần. Không tính gì mới — cỡ cảm biến theo sensorOf (cùng Chọn ống kính).
 */

export type MountLensOption = {
  id: string;
  label: string;
  focalMm: number;
  /** sF đã khai; null = chưa khai. */
  frontFocalMm: number | null;
  frontFocalApprox: boolean;
  modMm: number | null;
  /** Dải khẩu F trên vòng (OPT-013 thanh khẩu F); null = chưa khai. */
  fNumberMin: number | null;
  fNumberMax: number | null;
  /** Vòng ảnh (mm) và ngàm — trang Camera nghiêng lọc gợi ý ống (OPT-014). */
  imageCircleMm: number | null;
  mount: string | null;
};

export type MountCameraOption = {
  id: string;
  label: string;
  sensorLongMm: number;
  /** null = line scan. */
  sensorShortMm: number | null;
  /** Cỡ điểm ảnh (µm) — vòng mờ của DOF (OPT-013); null = chưa khai. */
  pixelUm: number | null;
  mount: string | null;
};

/** Số điền sẵn khi mở từ một dòng kết quả Chọn ống kính (chuỗi thô từ URL, MountCheck tự đọc số). */
export type MountCheckInitial = Partial<Record<(typeof MOUNT_PARAM_KEYS)[number], string>>;

// w, h: số pixel camera nhập tay (2026-11-21: ô camera tay nhập số pixel, không nhập mm); sl, ss (mm) chỉ dùng khi
// Chọn ống kính khai camera theo cỡ danh định, không có số pixel.
// nghieng=1: mở sẵn khung Camera nghiêng (link cũ /camera-nghieng chuyển về đây, 2026-11-23 vòng 2).
export const MOUNT_PARAM_KEYS = ['lens', 'cam', 'w', 'h', 'sl', 'ss', 'px', 'wd', 'e', 'k', 'fw', 'fh', 'n', 'nghieng'] as const;

export function readMountParams(params: Record<string, string | string[] | undefined>): MountCheckInitial {
  const out: MountCheckInitial = {};
  for (const key of MOUNT_PARAM_KEYS) {
    const v = params[key];
    if (typeof v === 'string' && v.length <= 64) out[key] = v;
  }
  return out;
}

/** Link mở trang Kiểm tra lắp đặt với số của một dòng kết quả. */
export function mountCheckHref(base: string, values: Partial<Record<(typeof MOUNT_PARAM_KEYS)[number], string | number | null>>): string {
  const q = new URLSearchParams();
  for (const key of MOUNT_PARAM_KEYS) {
    const v = values[key];
    if (v !== null && v !== undefined && v !== '') q.set(key, typeof v === 'number' ? String(Math.round(v * 1e4) / 1e4) : v);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Ống thường có tiêu cự — cùng điều kiện hiện hình ở Chọn ống kính. */
export function mountLensOptions(components: Component[]): MountLensOption[] {
  const out: MountLensOption[] = [];
  for (const c of components) {
    if (c.kind !== 'lens') continue;
    const lens = lensFromComponent(c);
    if (lens.lensType !== 'fixed' || lens.focalLengthMm === null || !(lens.focalLengthMm > 0)) continue;
    const mount = specString(c.spec, 'mount');
    out.push({
      id: c.id,
      label: `${c.brand} ${c.model} · f ${round(lens.focalLengthMm, 1)} mm${mount ? ` · ${mount}` : ''}`,
      focalMm: lens.focalLengthMm,
      frontFocalMm: lens.frontFocalMm ?? null,
      frontFocalApprox: lens.frontFocalApprox === true,
      modMm: lens.wdMinMm,
      fNumberMin: lens.fNumberMin,
      fNumberMax: lens.fNumberMax,
      imageCircleMm: lens.imageCircleMm ?? sensorDiagonalMm(lens.imageCircleFormat),
      mount: lens.mount,
    });
  }
  return out;
}

export function mountCameraOptions(components: Component[]): MountCameraOption[] {
  const out: MountCameraOption[] = [];
  for (const c of components) {
    if (c.kind !== 'camera') continue;
    const camera = cameraFromComponent(c);
    const sensor = sensorOf(camera);
    if (!sensor) continue;
    const line = camera.cameraType === 'line';
    const w = specNumber(c.spec, 'resolution_w_px') ?? specNumber(c.spec, 'line_width_px');
    const h = specNumber(c.spec, 'resolution_h_px');
    const px = w && h && !line ? `${w}×${h}` : w ? `${w} px` : null;
    out.push({
      id: c.id,
      label: `${c.brand} ${c.model}${px ? ` · ${px}` : ''} · ${round(sensor.longMm)}${line ? '' : ` × ${round(sensor.shortMm)}`} mm`,
      sensorLongMm: sensor.longMm,
      sensorShortMm: line ? null : sensor.shortMm,
      pixelUm: camera.pixelSizeUm,
      mount: camera.mount,
    });
  }
  return out;
}
