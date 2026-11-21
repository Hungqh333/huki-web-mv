/**
 * OPT-013 — độ sâu trường ảnh chiều thuận (chốt 2026-11-21). Số tính tay ghi cạnh từng assert.
 *
 *   npx tsx --test scripts/test-depth-of-field.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DOF_BLUR_PRESETS, blurMm, depthOfFieldNewton, depthOfFieldTelecentric, optoKToBlurPx, OPTO_DOF_K_DEFECT } from '../src/lib/vision/depthOfField';
import { DEFAULT_CIRCLE_OF_CONFUSION_PX } from '../src/lib/vision/optics';

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('ba mức nhòe: 2 px (trùng OPT-005) · 4 px (Opto k 0,008) · 7,5 px (Opto k 0,015)', () => {
  assert.equal(DOF_BLUR_PRESETS.tight, DEFAULT_CIRCLE_OF_CONFUSION_PX);
  near(DOF_BLUR_PRESETS.measure, 4);
  near(DOF_BLUR_PRESETS.defect, 7.5);
  near(blurMm(2, 3.45), 0.0069);
});

test('telecentric: ví dụ Opto Engineering β 0,25 · F làm việc 8 · p 5,5 µm · k 0,015 → ≈ 10,56 mm, đối xứng', () => {
  // c = 500 × 0,015 px × 5,5 µm = 0,04125 mm; DOF = 2 × 8 × 0,04125 ÷ 0,0625 = 10,56
  const d = depthOfFieldTelecentric({ workingFNumber: 8, beta: 0.25, blur: blurMm(optoKToBlurPx(OPTO_DOF_K_DEFECT), 5.5) })!;
  near(d.totalMm, 10.56, 1e-9);
  near(d.frontMm, d.backMm);
});

test('ống thường, vùng nhìn rộng: f 8 · β 0,02 · F/11 · c 0,0069 → trước 130,4 · sau 375,0 · tổng 505,4', () => {
  // δ = 11 × 1,02 × 0,0069 = 0,077418; x = 400; x′ = 0,16
  // x_gần = 64 ÷ 0,237418 = 269,567 → trước 130,43; x_xa = 64 ÷ 0,082582 = 774,99 → sau 374,987
  const d = depthOfFieldNewton({ focalMm: 8, fNumber: 11, betaLens: 0.02, blur: 0.0069 })!;
  near(d.deltaMm, 0.077418, 1e-9);
  near(d.frontMm, 130.433, 1e-3);
  near(d.backMm, 374.987, 1e-3);
  near(d.totalMm, 505.42, 1e-2);
  assert.ok(d.backMm > d.frontMm, 'phía sau rộng hơn phía trước (Fujifilm, Edmund)');
});

test('trùng công thức Fujifilm Tr / Tf khi L đo từ tiêu điểm trước và F thay bằng F làm việc', () => {
  const f = 25;
  const beta = 0.1;
  const d = depthOfFieldNewton({ focalMm: f, fNumber: 5.6, betaLens: beta, blur: 0.007 })!;
  const L = f / beta;
  const dF = d.deltaMm; // δ·F của Fujifilm = c × F làm việc
  near(d.backMm, (dF * L * L) / (f * f - dF * L), 1e-9);
  near(d.frontMm, (dF * L * L) / (f * f + dF * L), 1e-9);
});

test('δ ≪ β·f → về bản gần đúng OPT-005: 2·N·c·(1 + β) ÷ β²', () => {
  // f 35 · β 0,35 · F/8 · c 0,0069 → 2 × 8 × 0,0069 × 1,35 ÷ 0,1225 = 1,2166
  const d = depthOfFieldNewton({ focalMm: 35, fNumber: 8, betaLens: 0.35, blur: 0.0069 })!;
  const approx = (2 * 8 * 0.0069 * 1.35) / 0.35 ** 2;
  near(approx, 1.21665, 1e-4);
  assert.ok(d.totalMm >= approx && d.totalMm - approx < approx * 1e-3);
});

test('β·f ≤ δ → nét tới vô cực (siêu tiêu cự)', () => {
  // x′ = 8 × 0,005 = 0,04 < δ = 16 × 1,005 × 0,0069 = 0,111
  const d = depthOfFieldNewton({ focalMm: 8, fNumber: 16, betaLens: 0.005, blur: 0.0069 })!;
  assert.equal(d.backMm, Infinity);
  assert.equal(d.totalMm, Infinity);
  assert.ok(Number.isFinite(d.frontMm) && d.frontMm > 0);
});

test('bộ nhân ×k: vòng mờ trên cảm biến ứng với c ÷ k ở mặt ảnh ống gốc', () => {
  const withK = depthOfFieldNewton({ focalMm: 50, fNumber: 4, betaLens: 0.2, blur: 0.007, converterFactor: 2 })!;
  const plain = depthOfFieldNewton({ focalMm: 50, fNumber: 4, betaLens: 0.2, blur: 0.0035 })!;
  near(withK.totalMm, plain.totalMm, 1e-12);
});

test('số vào sai → null', () => {
  assert.equal(depthOfFieldNewton({ focalMm: 0, fNumber: 8, betaLens: 0.1, blur: 0.007 }), null);
  assert.equal(depthOfFieldNewton({ focalMm: 8, fNumber: 8, betaLens: 0, blur: 0.007 }), null);
  assert.equal(depthOfFieldTelecentric({ workingFNumber: 8, beta: 0.1, blur: 0 }), null);
});
