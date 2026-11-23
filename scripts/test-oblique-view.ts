/**
 * OPT-014 — camera nghiêng nhìn xuống mặt phẳng ngang (chốt 2026-11-23). Số đối chiếu: mô hình Python độc lập
 * (chiếu tia 4 góc cảm biến xuống mặt phẳng, kiểm góc vùng nằm trong tứ giác) chạy khi tư vấn 2026-11-23.
 *
 * Ca chuẩn: vùng 1200 × 800 mm, camera cao 1500 mm, lùi 600 mm trước mép gần, ngắm tâm vùng;
 * cảm biến 2448 × 2048 px × 3,45 µm = 8,4456 × 7,0656 mm, cạnh dài nằm ngang.
 *
 *   npx tsx --test scripts/test-oblique-view.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { obliqueView, type ObliqueInput } from '../src/lib/vision/obliqueView';
import { depthOfFieldNewton, fNumberForDepthRange } from '../src/lib/vision/depthOfField';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

const base: ObliqueInput = {
  areaWidthMm: 1200,
  areaLengthMm: 800,
  heightMm: 1500,
  setbackMm: 600,
  sideOffsetMm: 0,
  aimShiftMm: 0,
  sensorLongMm: 2448 * 0.00345,
  sensorShortMm: 2048 * 0.00345,
  pixelUm: 3.45,
  longAcross: true,
  focalMm: 8,
  margin: 0,
  blurPx: 2,
};

test('ca chuẩn: góc nghiêng 33,7° · f 8 phủ đủ, f 12 thiếu · f tối đa ≈ 11,06 mm', () => {
  const r8 = obliqueView(base)!;
  near(r8.tiltDeg, 33.69, 0.01); // atan(1000 ÷ 1500)
  assert.equal(r8.covers, true);
  assert.equal(obliqueView({ ...base, focalMm: 12 })!.covers, false);
  near(r8.focalMaxMm, 11.06, 0.01);
  // f tối đa không phụ thuộc f đang thử (toạ độ ảnh tỉ lệ thuận với v).
  near(obliqueView({ ...base, focalMm: 6 })!.focalMaxMm, r8.focalMaxMm, 1e-6);
  // Xoay cảm biến 90°: f tối đa ≈ 9,26 mm.
  near(obliqueView({ ...base, longAcross: false })!.focalMaxMm, 9.26, 0.01);
});

test('ngay tại f tối đa: góc gần dùng đúng 100 % cảm biến; độ dư 5 % → f tối đa nhỏ lại', () => {
  const fMax = obliqueView(base)!.focalMaxMm;
  near(obliqueView({ ...base, focalMm: fMax })!.maxUsage, 1, 1e-9);
  const withMargin = obliqueView({ ...base, margin: 0.05 })!;
  assert.ok(withMargin.focalMaxMm < fMax);
  near(obliqueView({ ...base, margin: 0.05, focalMm: withMargin.focalMaxMm })!.maxUsage, 0.95, 1e-9);
});

test('mm/px f 8: giữa mép gần 0,679 / 0,716 · giữa mép xa 0,869 / 1,174 (ngang / dọc)', () => {
  const r = obliqueView(base)!;
  near(r.nearCenter.gsdAcrossMm, 0.679, 0.002);
  near(r.nearCenter.gsdAlongMm, 0.716, 0.002);
  near(r.farCenter.gsdAcrossMm, 0.869, 0.002);
  near(r.farCenter.gsdAlongMm, 1.174, 0.002);
  assert.ok(r.worstGsdMm >= r.farCenter.gsdAlongMm);
});

test('khoảng cách dọc trục 1581 → 2025 mm; F cần cho cả dải ≈ F/0,65 (c = 2 × 3,45 µm)', () => {
  const r = obliqueView(base)!;
  near(r.nearestMm, 1581, 1);
  near(r.farthestMm, 2025, 1);
  near(r.depth!.fNumber, 0.65, 0.01);
  near(r.depth!.focusMm, 1776, 1);
});

test('fNumberForDepthRange ngược đúng depthOfFieldNewton: ở F tìm được, DOF trùng khít hai đầu', () => {
  const f = 25;
  const out = fNumberForDepthRange({ focalMm: f, nearMm: 300, farMm: 340, blur: 0.0069 })!;
  const dof = depthOfFieldNewton({ focalMm: f, fNumber: out.fNumber, betaLens: out.beta, blur: 0.0069 })!;
  near(out.focusMm - dof.frontMm, 300, 1e-6);
  near(out.focusMm + dof.backMm, 340, 1e-6);
});

test('nhìn thẳng xuống (không lùi, ngắm tâm): vùng phủ đối xứng, mm/px đều', () => {
  const r = obliqueView({ ...base, setbackMm: -400 })!; // camera ngay trên tâm vùng
  near(r.tiltDeg, 0, 1e-9);
  near(r.nearCenter.gsdAcrossMm, r.farCenter.gsdAcrossMm, 1e-6);
  near(r.corners[0].usage, r.corners[2].usage, 1e-9);
});

test('lệch bên: góc phía xa camera dùng nhiều cảm biến hơn góc phía gần camera', () => {
  const r = obliqueView({ ...base, sideOffsetMm: 500 })!;
  // camera lệch sang +X → góc trái (−X) xa hơn theo phương ngang
  assert.ok(r.corners[3].gsdAcrossMm > r.corners[2].gsdAcrossMm);
});

test('ngắm quá cao → một phần ảnh nhìn quá chân trời; số vào sai → null', () => {
  const r = obliqueView({ ...base, heightMm: 300, setbackMm: 2000, focalMm: 4 })!;
  assert.equal(r.horizon, true);
  assert.equal(obliqueView({ ...base, focalMm: 0 }), null);
  assert.equal(obliqueView({ ...base, areaWidthMm: 0 }), null);
});
