/**
 * OPT-014 — Camera nghiêng nhìn xuống mặt phẳng ngang (chốt 2026-11-23, Q1-B vị trí 3D tự do, Q2-A trang riêng
 * /camera-nghieng, Q3 có ô mm/px cần, Q4 độ dư vùng phủ mặc định 5 %).
 *
 * Mô hình chiếu tâm (lỗ kim), tâm chiếu = vị trí camera (đồng tử vào), không tính méo ống kính:
 *   - Toạ độ: mặt phẳng XY nằm ngang, Z lên. Vùng kiểm tra [−A/2; A/2] × [0; B] — Y xa dần camera.
 *   - Camera C = (lệch bên, −khoảng lùi, chiều cao). Điểm ngắm T: góc nghiêng để trống → tâm vùng (0, B/2, 0);
 *     có góc θ (so với phương đứng, vòng 2 2026-11-23 Q4) → camera giữ chỗ lắp, hướng ngang h = hướng từ chân camera
 *     tới tâm vùng, T = (Cx, Cy, 0) + h × H × tan θ.
 *   - Trục quang d = (T − C) ÷ |T − C|; trục ngang ảnh r = d × Z (ảnh không xoay quanh trục quang); trục dọc u = r × d.
 *   - Nét tại T: khoảng ảnh v = f × D ÷ (D − f), D = |T − C| (thấu kính mỏng, cùng gốc Newton: x′ = f² ÷ (D − f)).
 *   - Điểm P lên cảm biến: z = (P − C)·d, ảnh = ((P − C)·r, (P − C)·u) × v ÷ z.
 * Vùng phủ đủ khi cả 4 góc vùng kiểm tra nằm trong cảm biến đã chừa độ dư. Toạ độ ảnh tỉ lệ thuận với v nên tiêu cự
 * lớn nhất còn phủ đủ giải được trực tiếp: v_max = v × (1 − dư) ÷ mức dùng, f_max = v_max × D ÷ (D + v_max).
 */

import { blurMm, fNumberForDepthRange } from './depthOfField';

export type Vec3 = readonly [number, number, number];

export type ObliqueInput = {
  /** Vùng kiểm tra: rộng (ngang, trục X) × dài (xa dần camera, trục Y), mm. */
  areaWidthMm: number;
  areaLengthMm: number;
  /** Chiều cao camera so với mặt phẳng, mm. */
  heightMm: number;
  /** Khoảng lùi ngang từ camera tới mép gần của vùng (dương = camera đứng trước mép gần), mm. */
  setbackMm: number;
  /** Lệch bên so với đường giữa vùng, mm. */
  sideOffsetMm: number;
  /** Góc nghiêng trục quang so với phương đứng (độ); null = ngắm tâm vùng. */
  tiltDeg: number | null;
  sensorLongMm: number;
  sensorShortMm: number;
  pixelUm: number;
  /** true: cạnh dài cảm biến nằm ngang (theo bề rộng vùng); false: xoay 90°. */
  longAcross: boolean;
  focalMm: number;
  /** Độ dư vùng phủ (0,05 = 5 %): góc vùng phải nằm trong (1 − dư) nửa cảm biến. */
  margin: number;
  /** Vòng mờ cho DOF (px) — như OPT-013. */
  blurPx: number;
};

export type GroundPoint = { x: number; y: number };

export type PointSample = {
  /** Toạ độ trên mặt phẳng. */
  x: number;
  y: number;
  /** mm/px theo hai hướng ảnh (ngang, dọc). */
  gsdAcrossMm: number;
  gsdAlongMm: number;
  /** Mức dùng cảm biến = max(|ảnh ngang| ÷ nửa rộng, |ảnh dọc| ÷ nửa cao); > 1 là ra ngoài ảnh. */
  usage: number;
  /** Toạ độ trên cảm biến (mm, tính từ tâm; ngang sang phải, dọc lên trên) — hình "Ảnh camera nhìn thấy". */
  imageX: number;
  imageY: number;
};

export type ObliqueResult = {
  cameraPos: Vec3;
  aimPoint: Vec3;
  /** Góc trục quang so với phương thẳng đứng, độ. */
  tiltDeg: number;
  distanceToAimMm: number;
  imageDistanceMm: number;
  /** 4 góc vùng: gần trái, gần phải, xa phải, xa trái. */
  corners: PointSample[];
  nearCenter: PointSample;
  farCenter: PointSample;
  maxUsage: number;
  covers: boolean;
  /** Tiêu cự lớn nhất còn phủ đủ (đã trừ độ dư). */
  focalMaxMm: number;
  /** mm/px thô nhất trong các điểm xét (4 góc + giữa mép gần + giữa mép xa). */
  worstGsdMm: number;
  bestGsdMm: number;
  /** Khoảng cách dọc trục quang tới góc gần nhất / xa nhất của vùng — dùng cho DOF. */
  nearestMm: number;
  farthestMm: number;
  /** F cần để cả vùng nằm trong DOF (OPT-013) và khoảng nét tối ưu; null khi thiếu số. */
  depth: { fNumber: number; focusMm: number; beta: number } | null;
  /** Đường biên vùng phủ trên mặt phẳng (để vẽ); điểm nhìn quá đường chân trời bị kéo ra xa. */
  footprint: GroundPoint[];
  /** Một phần ảnh nhìn lên quá đường chân trời — vùng phủ không khép kín. */
  horizon: boolean;
  /** Nửa rộng / nửa cao cảm biến theo hướng đang lắp (mm). */
  sensorHalfWidthMm: number;
  sensorHalfHeightMm: number;
  /** Chỗ chạm đất của tia mép ảnh ở cột giữa (hình nhìn ngang): gần, xa (null = quá chân trời). */
  edgeNear: GroundPoint | null;
  edgeFar: GroundPoint | null;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.sqrt(dot(a, a));
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec3): Vec3 => scale(a, 1 / len(a));

/** Thiếu số / camera dưới mặt phẳng / tiêu cự ≥ khoảng cách → null. */
export function obliqueView(input: ObliqueInput): ObliqueResult | null {
  const { areaWidthMm: A, areaLengthMm: B, heightMm: H, focalMm: f } = input;
  if (!(A > 0) || !(B > 0) || !(H > 0) || !(f > 0) || !(input.sensorLongMm > 0) || !(input.sensorShortMm > 0) || !(input.pixelUm > 0)) return null;
  const margin = Math.min(Math.max(input.margin, 0), 0.5);
  const C: Vec3 = [input.sideOffsetMm, -input.setbackMm, H];
  let T: Vec3 = [0, B / 2, 0];
  if (input.tiltDeg !== null) {
    const tilt = Math.min(Math.max(input.tiltDeg, 0), OBLIQUE_MAX_TILT_DEG);
    const hx = T[0] - C[0];
    const hy = T[1] - C[1];
    const hl = Math.hypot(hx, hy);
    // Camera ngay trên tâm vùng: chưa có hướng ngang → nghiêng về phía xa (+Y).
    const [ux, uy] = hl < 1e-9 ? [0, 1] : [hx / hl, hy / hl];
    const reach = H * Math.tan((tilt * Math.PI) / 180);
    T = [C[0] + ux * reach, C[1] + uy * reach, 0];
  }
  const D = len(sub(T, C));
  if (!(D > f)) return null;
  const d = norm(sub(T, C));
  // Nhìn thẳng xuống: d ∥ Z → lấy trục ngang ảnh theo X.
  const rRaw = cross(d, [0, 0, 1]);
  const r = len(rRaw) < 1e-9 ? ([1, 0, 0] as Vec3) : norm(rRaw);
  const u = cross(r, d);
  const v = (f * D) / (D - f);
  const halfW = (input.longAcross ? input.sensorLongMm : input.sensorShortMm) / 2;
  const halfH = (input.longAcross ? input.sensorShortMm : input.sensorLongMm) / 2;
  const pitch = input.pixelUm / 1000;

  const toImage = (P: Vec3) => {
    const w = sub(P, C);
    const z = dot(w, d);
    return { px: (dot(w, r) / z) * v, py: (dot(w, u) / z) * v, z };
  };
  const toGround = (px: number, py: number): Vec3 | null => {
    const dir: Vec3 = [d[0] * v + r[0] * px + u[0] * py, d[1] * v + r[1] * px + u[1] * py, d[2] * v + r[2] * px + u[2] * py];
    if (dir[2] >= -1e-12) return null;
    const t = -C[2] / dir[2];
    return [C[0] + t * dir[0], C[1] + t * dir[1], 0];
  };
  const sample = (x: number, y: number): PointSample => {
    const { px, py, z } = toImage([x, y, 0]);
    const usage = z > 0 ? Math.max(Math.abs(px) / halfW, Math.abs(py) / halfH) : Infinity;
    const g0 = toGround(px, py);
    const gx = toGround(px + pitch, py);
    const gy = toGround(px, py + pitch);
    const dist = (a: Vec3 | null, b: Vec3 | null) => (a && b ? len(sub(a, b)) : Infinity);
    return { x, y, gsdAcrossMm: dist(g0, gx), gsdAlongMm: dist(g0, gy), usage, imageX: px, imageY: py };
  };

  const corners = [sample(-A / 2, 0), sample(A / 2, 0), sample(A / 2, B), sample(-A / 2, B)];
  const nearCenter = sample(0, 0);
  const farCenter = sample(0, B);
  const maxUsage = Math.max(...corners.map((c) => c.usage));
  const covers = maxUsage <= 1 - margin + 1e-12;
  const vMax = Number.isFinite(maxUsage) && maxUsage > 0 ? (v * (1 - margin)) / maxUsage : 0;
  const focalMaxMm = (vMax * D) / (D + vMax);
  const all = [...corners, nearCenter, farCenter];
  const worstGsdMm = Math.max(...all.map((p) => Math.max(p.gsdAcrossMm, p.gsdAlongMm)));
  const bestGsdMm = Math.min(...all.map((p) => Math.min(p.gsdAcrossMm, p.gsdAlongMm)));
  const depths = corners.map((c) => dot(sub([c.x, c.y, 0], C), d));
  const nearestMm = Math.min(...depths);
  const farthestMm = Math.max(...depths);
  const depth = nearestMm > f ? fNumberForDepthRange({ focalMm: f, nearMm: nearestMm, farMm: farthestMm, blur: blurMm(input.blurPx, input.pixelUm) }) : null;

  // Biên vùng phủ: lấy mẫu viền cảm biến; tia nhìn quá chân trời → kéo ra xa theo hướng nằm ngang của tia.
  const footprint: GroundPoint[] = [];
  let horizon = false;
  const far = 20 * Math.max(A, B, H, input.setbackMm + B);
  const edge: [number, number][] = [];
  const n = 24;
  for (let i = 0; i < n; i++) edge.push([-halfW + (2 * halfW * i) / n, -halfH]);
  for (let i = 0; i < n; i++) edge.push([halfW, -halfH + (2 * halfH * i) / n]);
  for (let i = 0; i < n; i++) edge.push([halfW - (2 * halfW * i) / n, halfH]);
  for (let i = 0; i < n; i++) edge.push([-halfW, halfH - (2 * halfH * i) / n]);
  for (const [px, py] of edge) {
    const g = toGround(px, py);
    if (g && len(sub(g, C)) <= far) footprint.push({ x: g[0], y: g[1] });
    else {
      horizon = true;
      const dir: Vec3 = [d[0] * v + r[0] * px + u[0] * py, d[1] * v + r[1] * px + u[1] * py, 0];
      const h = len(dir) || 1;
      footprint.push({ x: C[0] + (dir[0] / h) * far, y: C[1] + (dir[1] / h) * far });
    }
  }

  // Tia mép trên / dưới ảnh ở cột giữa — cho hình nhìn ngang.
  const e1 = toGround(0, -halfH);
  const e2 = toGround(0, halfH);
  const pts = [e1, e2].filter((p): p is Vec3 => p !== null).sort((a, b) => a[1] - b[1]);
  const edgeNear = pts.length > 0 ? { x: pts[0][0], y: pts[0][1] } : null;
  const edgeFar = pts.length > 1 ? { x: pts[1][0], y: pts[1][1] } : null;

  return {
    cameraPos: C,
    aimPoint: T,
    tiltDeg: (Math.acos(Math.min(1, Math.max(-1, -d[2]))) * 180) / Math.PI,
    distanceToAimMm: D,
    imageDistanceMm: v,
    corners,
    nearCenter,
    farCenter,
    maxUsage,
    covers,
    focalMaxMm,
    worstGsdMm,
    bestGsdMm,
    nearestMm,
    farthestMm,
    depth,
    footprint,
    horizon,
    sensorHalfWidthMm: halfW,
    sensorHalfHeightMm: halfH,
    edgeNear,
    edgeFar,
  };
}

/** Độ dư vùng phủ mặc định (Q4): méo ống góc rộng 1–3 % + sai lệch lắp. */
export const OBLIQUE_DEFAULT_MARGIN = 0.05;

/** Góc nghiêng lớn nhất của thanh trượt (vòng 2 Q4) — 90° là nhìn ngang, không chạm mặt phẳng. */
export const OBLIQUE_MAX_TILT_DEG = 80;
