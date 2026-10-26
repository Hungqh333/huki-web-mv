/**
 * Bộ ca KIỂM CHỨNG công thức nền (Bước 0, chốt 2026-10-17).
 *
 * Mỗi ca là một phép tính tay, ghi nguồn công thức cạnh nó. Đây không phải test
 * hành vi — đây là chỗ khoá các con số mà Lens / Illumination / Frame rate
 * selector đều dựa vào. Công thức nào bị sửa lệch thì ca ở đây đỏ trước.
 *
 * Nguồn công thức:
 *   [TL]  Phương trình thấu kính mỏng 1/f = 1/s + 1/s', β = s'/s → f = s·β/(1+β).
 *   [WFN] F# hiệu dụng ("working f-number") N_w ≈ N × (1 + β/P), P = độ phóng đại
 *         đồng tử, lấy P = 1 (Wikipedia "f-number", mục Working f-number).
 *   [AIRY] Đường kính đĩa Airy tới vòng tối đầu tiên d = 2,44 × λ × N.
 *   [NYQ] Tần số Nyquist của cảm biến: 1 ÷ (2 × pitch).
 *   [DOF] Độ sâu trường ảnh cận cảnh: DOF ≈ 2·N·c·(1+β)/β² (Wikipedia "Depth of
 *         field", công thức close-up, khi khoảng cách ≪ siêu tiêu cự).
 *   [BLUR] Nhoè chuyển động: t ≤ blur_px × mm/px ÷ v.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import {
  effectiveFNumberFactor,
  entocentricMagnification,
  evaluateConfiguration,
  focalLengthFor,
  fNumberForDepth,
  maxFNumber,
  maxRingFNumber,
  type ConfigCamera,
  type ConfigLens,
} from '../src/lib/vision/configurationRules';
import {
  airyDiskUm,
  depthOfFieldMm,
  estimateLens,
  magnificationToFit,
  opticsChecks,
  requiredLpPerMm,
} from '../src/lib/vision/optics';
import { frameTransfer, maxExposureForBlur } from '../src/lib/vision/timing';
import { SENSOR_FORMATS, sensorDiagonalMm } from '../src/lib/components/specs';

const close = (actual: number | null | undefined, expected: number, tol: number, label: string) => {
  assert.ok(actual !== null && actual !== undefined, `${label}: null`);
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} ≠ ${expected} ± ${tol}`);
};

// --------------------------------------------------------- HÌNH HỌC ỐNG KÍNH --

test('[TL] tiêu cự và độ phóng đại: hai chiều khớp nhau (Newton, WD từ mặt trước — chốt 2026-10-26)', () => {
  // β = 8,8 ÷ 100 = 0,088 ; f = β × WD = 0,088 × 300 = 26,4 mm (sF chưa khai = 0)
  close(focalLengthFor(0.088, 300), 26.4, 1e-9, 'f');
  // Ngược lại: ống 25 mm ở WD 300 → β = 25 ÷ 300 = 0,0833 (Edmund / Hikrobot: f = cảm biến × WD ÷ vùng nhìn)
  close(entocentricMagnification(25, 300), 0.083333, 1e-6, 'β');
  // Chụp cận: ống 25 mm ở WD 50 → β = 25 ÷ 50 = 0,5
  close(entocentricMagnification(25, 50), 0.5, 1e-9, 'β cận');
  // Có sF: Basler C125-2522 (f 25, sF 1,83) ở WD 500 → β = 25 ÷ 498,17 = 0,0502 (datasheet 0,048, f ±5 %)
  close(entocentricMagnification(25, 500, 1.83), 0.050184, 1e-6, 'β có sF');
  // WD không vượt sF → không lấy nét được
  assert.equal(entocentricMagnification(25, 1.5, 1.83), null);
});

test('[F1] β theo trục giới hạn: vùng nhìn vuông trên cảm biến 4:3', () => {
  const s = SENSOR_FORMATS['2/3']; // 8,8 × 6,6 mm
  // min(8,8 ÷ 100 ; 6,6 ÷ 100) = 0,066 → vùng nhìn thật 133,3 × 100 mm
  const fit = magnificationToFit({ sensorWidthMm: s.widthMm, sensorHeightMm: s.heightMm, fovWidthMm: 100, fovHeightMm: 100 })!;
  close(fit.beta, 0.066, 1e-9, 'β');
  close(s.widthMm / fit.beta, 133.33, 0.01, 'vùng nhìn dài');
  close(s.heightMm / fit.beta, 100, 1e-9, 'vùng nhìn ngắn');
  // f = 0,066 × 300 = 19,8 mm (bản trước F1 ra 26,4 mm → vật bị cắt còn 75 mm)
  close(focalLengthFor(fit.beta, 300), 19.8, 1e-9, 'f');
});

test('[F1] vùng nhìn dọc: xoay camera, ghép cạnh dài với cạnh dài', () => {
  // Vùng nhìn 50 × 120: dài 8,8 ÷ 120 = 0,0733 ; ngắn 6,6 ÷ 50 = 0,132 → β = 0,0733
  const fit = magnificationToFit({ sensorWidthMm: 8.8, sensorHeightMm: 6.6, fovWidthMm: 50, fovHeightMm: 120 })!;
  close(fit.beta, 0.07333, 1e-5, 'β');
  // Vùng nhìn rộng (4:3 khít) thì hai trục bằng nhau
  close(magnificationToFit({ sensorWidthMm: 8.8, sensorHeightMm: 6.6, fovWidthMm: 200, fovHeightMm: 150 })!.beta, 0.044, 1e-9, 'β 4:3');
  // Line scan: chỉ trục hàng pixel
  close(magnificationToFit({ sensorWidthMm: 28.67, sensorHeightMm: 0, fovWidthMm: 300, fovHeightMm: 1000, lineScan: true })!.beta, 0.09557, 1e-5, 'β line');
});

test('[F1] bộ chọn cũ: phép kiểm tiêu cự dùng trục giới hạn', () => {
  const checks = opticsChecks({
    fovWidthMm: 100,
    fovHeightMm: 100,
    workingDistanceMm: 300,
    sensorFormat: '2/3',
    pixelSizeUm: 3.45,
    fNumber: null,
    lensImageCircleFormat: null,
    heightToleranceMm: null,
    circleOfConfusionPx: 2,
  });
  const focal = checks.find((c) => c.key === 'focalLength')!;
  assert.match(focal.formula, /19\.8 mm$/, focal.formula);
});

test('[TL] estimateLens suy ngược ra đúng WD', () => {
  const lens = estimateLens({ sensorSizeMm: 6.6, fovMm: 100, workingDistanceMm: 300 })!;
  close(lens.workingDistanceMm, 300, 0.1, 'WD');
});

test('vòng ảnh so trên đường chéo: 2/3" = √(8,8² + 6,6²) = 11,0 mm', () => {
  close(sensorDiagonalMm('2/3'), 11.0, 1e-9, 'đường chéo');
});

// ------------------------------------------------------ NHIỄU XẠ / ĐỘ NÉT --

test('[AIRY] đĩa Airy 2,44 × 0,55 × N', () => {
  close(airyDiskUm(8), 10.736, 1e-9, 'F/8');
  close(airyDiskUm(4), 5.368, 1e-9, 'F/4');
});

test('[WFN] F# hiệu dụng N × (1 + β); telecentric ghi sẵn F# làm việc', () => {
  assert.equal(effectiveFNumberFactor(0.5, 'fixed'), 1.5);
  assert.equal(effectiveFNumberFactor(0.5, 'telecentric'), 1);
  assert.equal(effectiveFNumberFactor(null, 'fixed'), 1, 'chưa biết β thì như cũ');
  // pitch 3,45 µm: F#max hiệu dụng = 6,9 ÷ 1,342 = 5,1416
  close(maxFNumber(3.45), 5.1416, 1e-4, 'F#max hiệu dụng');
  // trên vòng khẩu ở β 0,5: 5,1416 ÷ 1,5 = 3,4277 ; ở β 0,088: 4,7257
  close(maxRingFNumber(3.45, 0.5), 3.4277, 1e-4, 'β 0,5');
  close(maxRingFNumber(3.45, 0.088), 4.7257, 1e-4, 'β 0,088');
  // F/4 trên vòng ở β 0,5 → hiệu dụng F/6 → Airy 8,05 µm > 2 × 3,45
  close(airyDiskUm(4 * 1.5), 8.052, 1e-9, 'Airy hiệu dụng');
});

test('[NYQ] độ phân giải ống cần có 1 ÷ (2 × pitch)', () => {
  close(requiredLpPerMm(3.45), 144.9, 0.05, '3,45 µm');
  close(requiredLpPerMm(2.74), 182.5, 0.05, '2,74 µm');
});

test('[DOF] độ sâu trường ảnh 2·N·c·(1+β)/β² và phép ngược', () => {
  // N 8, c = 2 × 3,45 µm = 0,0069 mm, β 0,088:
  // 2 × 8 × 0,0069 × 1,088 ÷ 0,007744 = 15,511 mm
  close(depthOfFieldMm({ fNumber: 8, circleOfConfusionMm: 0.0069, beta: 0.088 }), 15.511, 1e-3, 'DOF');
  close(fNumberForDepth(15.511, 0.0069, 0.088), 8, 1e-3, 'F ngược');
});

// --------------------------------------------- LUẬT CẤU HÌNH Ở ĐỘ PHÓNG ĐẠI LỚN --

const CAMERA: ConfigCamera = {
  cameraType: 'area',
  widthPx: 2448,
  heightPx: 2048,
  pixelSizeUm: 3.45,
  sensorFormat: '2/3',
  mount: 'C',
  interfaceName: 'GigE',
  maxFps: 23,
  bytesPerPx: 1,
};

const LENS: ConfigLens = {
  lensType: 'fixed',
  focalLengthMm: 25,
  magnification: null,
  imageCircleMm: null,
  imageCircleFormat: '2/3',
  mount: 'C',
  fNumberMin: 4,
  fNumberMax: 16,
  resolutionLpMm: 160,
  wdMinMm: null,
  wdMaxMm: null,
};

const analysisAt = (wd: number) =>
  analyseRequirement(
    Object.entries({
      'object.sizeX': 15,
      'object.sizeY': 12,
      'object.surface': 'matte',
      'detection.0.minSize': 0.02,
      'detection.0.contrast': 'high',
      'detection.0.variability': 'low',
      'system.cameraCount': 1,
      'system.workingDistance': wd,
    }).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'))
  );

test('[WFN] OPT-004 chụp cận: ống nhanh nhất F/4 ở β 0,5 không còn đạt', () => {
  // WD 50, f 25 → β 0,5 → F#max trên vòng 3,43 < F/4 → FAIL (trước khi sửa: 4 ≤ 5,14 → PASS)
  const near = evaluateConfiguration({ analysis: analysisAt(50), camera: CAMERA, lens: LENS }).find((r) => r.ruleId === 'OPT-004')!;
  assert.equal(near.status, 'fail', near.formula);
  assert.match(near.formula, /÷ \(1 \+ 0\.5\) = 3\.43/, near.formula);
  // WD 300, f 25 → β 0,0833 → F#max trên vòng 4,75 ≥ F/4 → vẫn đạt
  const far = evaluateConfiguration({ analysis: analysisAt(300), camera: CAMERA, lens: LENS }).find((r) => r.ruleId === 'OPT-004')!;
  assert.equal(far.status, 'pass', far.formula);
  // Telecentric ghi F# làm việc: không chia thêm
  const tele = evaluateConfiguration({
    analysis: analysisAt(110),
    camera: CAMERA,
    lens: { ...LENS, lensType: 'telecentric', focalLengthMm: null, magnification: 0.5, fNumberMin: 4 },
  }).find((r) => r.ruleId === 'OPT-004')!;
  assert.equal(tele.status, 'pass', tele.formula);
});

// ------------------------------------------------------ BĂNG THÔNG / NHOÈ --

test('truyền ảnh: 20 MP Mono8 qua GigE (110 MB/s thực dùng)', () => {
  // 5472 × 3648 × 1 = 19,961856 MB ÷ 110 MB/s = 181,47 ms → tối đa 5,5 ảnh/giây
  const t = frameTransfer({ widthPx: 5472, heightPx: 3648, pixelFormat: 'Mono8', interfaceName: 'GigE' })!;
  close(t.transferMs, 181.471, 1e-3, 'ms');
  close(1000 / t.transferMs, 5.51, 0.01, 'fps');
  // Mono12packed 1,5 byte/px → gấp rưỡi
  close(frameTransfer({ widthPx: 5472, heightPx: 3648, pixelFormat: 'Mono12packed', interfaceName: 'GigE' })!.transferMs, 272.207, 1e-3, '12 bit');
});

test('[BLUR] phơi sáng tối đa: 1 px × 0,05 mm/px ÷ 500 mm/s = 0,1 ms', () => {
  const b = maxExposureForBlur({ blurPx: 1, mmPerPx: 0.05, speedMmS: 500 })!;
  close(b.maxExposureMs, 0.1, 1e-9, 'ms');
  assert.equal(b.needsStrobe, true);
});
