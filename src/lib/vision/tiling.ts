import { round } from './types';

/**
 * Chia vùng nhìn cho nhiều camera — spec V1.1 §4.1 RES-005.
 *
 * Mỗi camera nhìn một ô của lưới, cộng phần chồng lấn với ô kề. Kích thước ô
 * này là đầu vào của các phép tính "theo từng camera": sai số phối cảnh
 * (OPT-008) lấy nửa đường chéo MỘT camera, không phải của cả vật. Lấy cả vật
 * thì sai số bị thổi phồng gấp đôi với hệ 2×2.
 */

/** Chồng lấn tối thiểu bằng 10% bề rộng một ô. */
export const TILE_OVERLAP_RATIO = 0.1;

/**
 * …và không ít hơn 20 pixel: đủ chỗ cho lỗi nằm đúng đường ghép vẫn lọt trọn
 * vào ít nhất một camera, và đủ điểm chung để hiệu chuẩn ghép ảnh.
 */
export const TILE_OVERLAP_MIN_PX = 20;

export type CameraGrid = {
  /** Số cột, theo trục ngang của vật. */
  cols: number;
  /** Số hàng, theo trục dọc của vật. */
  rows: number;
};

/**
 * Lưới gần vuông nhất đúng bằng số camera (chốt 2026-09-16):
 * 1 → 1×1, 2 → 2×1, 3 → 3×1, 4 → 2×2, 6 → 3×2. Chiều nhiều camera hơn nằm
 * theo trục DÀI của vật.
 *
 * Số hàng là ước lớn nhất không vượt √n, nên lưới luôn phủ kín đúng n camera,
 * không có ô thừa. Số camera nguyên tố (5, 7) thành một hàng dài — đúng với
 * cách bố trí thường gặp khi vật dài.
 */
export function cameraGrid(input: {
  cameraCount: number;
  fovWidthMm: number;
  fovHeightMm: number;
}): CameraGrid | null {
  const { cameraCount: n, fovWidthMm, fovHeightMm } = input;
  if (!Number.isInteger(n) || n < 1 || !(fovWidthMm > 0) || !(fovHeightMm > 0)) return null;

  let short = 1;
  for (let divisor = Math.floor(Math.sqrt(n)); divisor >= 1; divisor--) {
    if (n % divisor === 0) {
      short = divisor;
      break;
    }
  }
  const long = n / short;
  return fovWidthMm >= fovHeightMm ? { cols: long, rows: short } : { cols: short, rows: long };
}

export type CameraTile = {
  grid: CameraGrid;
  /** Vùng nhìn MỘT camera, đã cộng chồng lấn (mm). */
  widthMm: number;
  heightMm: number;
  /** Phần chồng lấn đã cộng trên mỗi trục; 0 khi trục đó chỉ có một camera. */
  overlapXMm: number;
  overlapYMm: number;
  /** Nửa đường chéo vùng nhìn một camera — khoảng lệch tâm xa nhất (mm). */
  halfDiagonalMm: number;
};

/**
 * FOV một camera = FOV cả vật ÷ số ô trên trục đó + chồng lấn, với
 * chồng lấn = max(10% ô, 20 px × mm/px).
 *
 * Trục chỉ có một camera thì không cộng chồng lấn — không có đường ghép nào.
 * Chưa biết mm/px thì chỉ dùng mức 10%.
 */
export function cameraTile(input: {
  fovWidthMm: number;
  fovHeightMm: number;
  cameraCount: number;
  mmPerPx: number | null;
}): CameraTile | null {
  const grid = cameraGrid(input);
  if (!grid) return null;

  const minOverlapMm = input.mmPerPx !== null && input.mmPerPx > 0 ? TILE_OVERLAP_MIN_PX * input.mmPerPx : 0;
  const axis = (totalMm: number, count: number) => {
    const baseMm = totalMm / count;
    if (count === 1) return { sizeMm: baseMm, overlapMm: 0 };
    const overlapMm = Math.max(TILE_OVERLAP_RATIO * baseMm, minOverlapMm);
    return { sizeMm: baseMm + overlapMm, overlapMm };
  };

  const x = axis(input.fovWidthMm, grid.cols);
  const y = axis(input.fovHeightMm, grid.rows);
  return {
    grid,
    widthMm: round(x.sizeMm, 3),
    heightMm: round(y.sizeMm, 3),
    overlapXMm: round(x.overlapMm, 3),
    overlapYMm: round(y.overlapMm, 3),
    halfDiagonalMm: round(Math.hypot(x.sizeMm, y.sizeMm) / 2, 3),
  };
}
