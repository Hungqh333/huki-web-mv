/**
 * Bộ chọn ống kính (2026-10-17). Số tính tay ghi cạnh từng assert.
 *
 * Camera chuẩn: 2448 × 2048 px, pitch 3,45 µm → cảm biến 8,4456 × 7,0656 mm, ngàm C.
 * Bài chuẩn: vùng nhìn 100 × 100 mm, WD 300 mm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Component } from '../src/lib/components/specs';
import type { ConfigCamera } from '../src/lib/vision/configurationRules';
import { lensNeed, selectLenses, solveGeometry, type LensSelectorInput } from '../src/lib/vision/lensSelector';

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

const INPUT: LensSelectorInput = {
  camera: CAMERA,
  fovWidthMm: 100,
  fovHeightMm: 100,
  workingDistanceMm: 300,
  heightVariationMm: null,
  targetMmPerPx: null,
  lensKind: 'fixed',
};

let nextId = 0;
const lens = (spec: Record<string, unknown>, model = `L${nextId}`): Component =>
  ({
    id: `lens-${nextId++}`,
    code: model,
    kind: 'lens',
    brand: 'Test',
    model,
    spec: { lens_type: 'fixed', mount: 'C', image_circle: '2/3', f_number_min: 1.4, f_number_max: 16, resolution_lp_mm: 160, wd_min_mm: 100, ...spec },
    price_vnd: null,
    datasheet_url: null,
    source: 'manual',
    notes_vi: null,
    notes_en: null,
    is_active: true,
    sort_order: 0,
  }) as unknown as Component;

const close = (actual: number | null | undefined, expected: number, tol: number, label: string) => {
  assert.ok(actual !== null && actual !== undefined, `${label}: null`);
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} ≠ ${expected} ± ${tol}`);
};

test('nhu cầu: β theo trục ngắn, tiêu cự lý tưởng, F#max trên vòng khẩu', () => {
  const need = lensNeed(INPUT)!;
  // min(8,4456 ÷ 100 ; 7,0656 ÷ 100) = 0,070656
  close(need.beta, 0.070656, 1e-5, 'β');
  // f = 300 × 0,070656 ÷ 1,070656 = 19,798 mm
  close(need.focalIdealMm, 19.8, 0.01, 'f');
  // vùng nhìn thật 119,5 × 100 mm
  close(need.fovLongMm, 119.5, 0.1, 'vùng nhìn dài');
  close(need.fovShortMm, 100, 0.1, 'vùng nhìn ngắn');
  // mm/px = 0,00345 ÷ 0,070656 = 0,04883
  close(need.mmPerPx, 0.04883, 1e-5, 'mm/px');
  // F#max = 5,1416 ÷ 1,070656 = 4,80
  close(need.fMaxRing, 4.8, 0.01, 'F#max');
  close(need.lpPerMm, 144.9, 0.05, 'lp/mm');
});

test('xếp hạng: ống phủ vừa vật nhất lên đầu, ống hẹp quá bị loại', () => {
  const l12 = lens({ focal_length_mm: 12 }, 'f12');
  const l16 = lens({ focal_length_mm: 16 }, 'f16');
  const l25 = lens({ focal_length_mm: 25 }, 'f25');
  const { candidates } = selectLenses(INPUT, [l25, l12, l16]);
  assert.deepEqual(
    candidates.map((c) => c.component.model),
    ['f16', 'f12', 'f25']
  );
  const [c16, c12, c25] = candidates;
  // 16 mm: β = 16 ÷ 284 = 0,05634 → 149,9 × 125,4 mm phủ 100 × 100
  close(c16.beta, 0.05634, 1e-5, 'β 16');
  close(c16.fovLongMm, 149.9, 0.1, 'FOV 16');
  close(c16.pixelUse, 10000 / (149.91 * 125.41), 0.002, 'pixel dùng 16');
  assert.equal(c16.status, 'pass');
  // 12 mm: β = 12 ÷ 288 = 0,041667 → 202,7 × 169,6 mm, dùng ít pixel hơn
  assert.equal(c12.status, 'pass');
  assert.ok(c12.pixelUse! < c16.pixelUse!);
  // 25 mm: β = 25 ÷ 275 = 0,0909 → 92,9 × 77,7 mm < 100 × 100
  assert.equal(c25.status, 'fail');
  assert.equal(c25.checks.find((c) => c.key === 'fov')!.noteKey, 'fovTooSmall');
});

test('loại: sai ngàm, vòng ảnh nhỏ, WD dưới MOD, mm/px thô hơn mức cần', () => {
  const wrongMount = lens({ focal_length_mm: 16, mount: 'M42' });
  const smallCircle = lens({ focal_length_mm: 16, image_circle: '1/2' });
  const tooClose = lens({ focal_length_mm: 16, wd_min_mm: 400 });
  const { candidates } = selectLenses(INPUT, [wrongMount, smallCircle, tooClose]);
  for (const c of candidates) assert.equal(c.status, 'fail', c.component.spec.mount as string);
  assert.equal(candidates.find((c) => c.component === wrongMount)!.checks.find((c) => c.key === 'mount')!.noteKey, 'mountMismatch');
  assert.equal(candidates.find((c) => c.component === smallCircle)!.checks.find((c) => c.key === 'imageCircle')!.status, 'fail');
  assert.equal(candidates.find((c) => c.component === tooClose)!.checks.find((c) => c.key === 'workingDistance')!.noteKey, 'wdBelowMod');

  // mm/px cần 0,05: 16 mm cho 0,00345 ÷ 0,05634 = 0,0612 > 0,05 → loại
  const coarse = selectLenses({ ...INPUT, targetMmPerPx: 0.05 }, [lens({ focal_length_mm: 16 })]).candidates[0];
  assert.equal(coarse.checks.find((c) => c.key === 'pixel')!.status, 'fail');
  assert.equal(coarse.status, 'fail');
});

test('ống C trên camera CS: cảnh báo vòng đệm, không loại', () => {
  const c = selectLenses({ ...INPUT, camera: { ...CAMERA, mount: 'CS' } }, [lens({ focal_length_mm: 16 })]).candidates[0];
  assert.equal(c.checks.find((k) => k.key === 'mount')!.noteKey, 'mountCsSpacer');
  assert.equal(c.status, 'warn');
});

test('độ sâu: Δh 10 mm đặt F/2,2; Δh 40 mm cần F/8,7 > 1,5 × F#max 4,87 → cảnh báo xung đột', () => {
  // 16 mm: β 0,05634 ; c = 0,0069 mm
  // F = 10 × 0,05634² ÷ (2 × 0,0069 × 1,05634) = 2,177 → F/2,2 ≤ F#max 4,87 → đặt F/2,2
  const shallow = selectLenses({ ...INPUT, heightVariationMm: 10 }, [lens({ focal_length_mm: 16 })]).candidates[0];
  const depth = shallow.checks.find((c) => c.key === 'depth')!;
  assert.equal(depth.status, 'pass', depth.formula);
  close(shallow.fSet, 2.2, 0.05, 'F đặt');
  // Δh 40 mm: F/8,7 > 1,5 × 4,87 = 7,3 → xung đột với nhiễu xạ (cảnh báo, không loại)
  const deep = selectLenses({ ...INPUT, heightVariationMm: 40 }, [lens({ focal_length_mm: 16 })]).candidates[0];
  assert.equal(deep.checks.find((c) => c.key === 'depth')!.noteKey, 'dofConflict');
  assert.equal(deep.status, 'warn');
});

test('telecentric: lọc theo loại, kiểm WD trong dải, β cố định', () => {
  const tele = lens({ lens_type: 'telecentric', focal_length_mm: null, magnification: 0.1, wd_min_mm: 290, wd_max_mm: 310, f_number_min: 8, image_circle: '2/3' }, 'tc');
  const fixed = lens({ focal_length_mm: 16 }, 'f16');
  const only = selectLenses({ ...INPUT, fovWidthMm: 60, fovHeightMm: 50, lensKind: 'telecentric' }, [tele, fixed]);
  assert.deepEqual(only.candidates.map((c) => c.component.model), ['tc']);
  const c = only.candidates[0];
  // β 0,1 → 84,5 × 70,7 mm phủ 60 × 50 ; F/8 làm việc > F#max 5,14 (telecentric không chia 1 + β) → loại
  close(c.fovLongMm, 84.5, 0.1, 'FOV');
  assert.equal(c.checks.find((k) => k.key === 'diffraction')!.status, 'fail');
  // Đầu ống cần ≈ 1,3 × 60 = 78 mm → trong mức thực tế
  assert.equal(only.need!.telecentricStatus, 'pass');
  close(only.need!.telecentricFrontMm, 78, 0.5, 'đầu ống');
  // WD 350 ngoài dải 290–310 → loại
  const far = selectLenses({ ...INPUT, workingDistanceMm: 350, fovWidthMm: 60, fovHeightMm: 50, lensKind: 'telecentric' }, [tele]).candidates[0];
  assert.equal(far.checks.find((k) => k.key === 'workingDistance')!.status, 'fail');
});

test('ống chưa khai tiêu cự: không được xếp đạt', () => {
  const c = selectLenses(INPUT, [lens({ focal_length_mm: null })]).candidates[0];
  assert.equal(c.status, 'info');
  assert.ok(c.unknownCount > 0);
});

test('camera nhập tay chỉ có cỡ danh nghĩa (chưa có pitch): vẫn ra β và tiêu cự', () => {
  const need = lensNeed({ ...INPUT, camera: { ...CAMERA, pixelSizeUm: null } })!;
  // 2/3" 8,8 × 6,6 → min(0,088 ; 0,066) = 0,066 → f = 18,57 mm
  close(need.beta, 0.066, 1e-6, 'β');
  close(need.focalIdealMm, 18.57, 0.01, 'f');
  assert.equal(need.mmPerPx, null);
  assert.equal(need.fMaxRing, null);
});

test('cùng một nguồn: F#max và kết luận nhiễu xạ khớp OPT-004 của Thiết kế hệ thống', async () => {
  const { evaluateConfiguration, lensFromComponent } = await import('../src/lib/vision/configurationRules');
  const { emptyRequirement, withFieldValue } = await import('../src/lib/requirement/fields');
  const { analyseRequirement } = await import('../src/lib/vision/requirementAnalysis');
  const analysis = analyseRequirement(
    Object.entries({ 'object.sizeX': 100, 'object.sizeY': 100, 'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'system.cameraCount': 1, 'system.workingDistance': 75 }).reduce(
      (req, [path, value]) => withFieldValue(req, path, value),
      emptyRequirement('AppearanceInspection')
    )
  );
  for (const fMin of [2.8, 4]) {
    const component = lens({ focal_length_mm: 25, f_number_min: fMin, wd_min_mm: null });
    const ours = selectLenses({ ...INPUT, workingDistanceMm: 75 }, [component]).candidates[0].checks.find((c) => c.key === 'diffraction')!;
    const theirs = evaluateConfiguration({ analysis, camera: CAMERA, lens: lensFromComponent(component) }).find((r) => r.ruleId === 'OPT-004')!;
    assert.equal(ours.status, theirs.status, `F/${fMin}`);
    assert.equal(ours.noteValues?.fMax, theirs.noteValues?.fMax, `F/${fMin}`);
  }
});

// ---------------------------------------------- BIẾT 2 TRONG 3 + GÓC NHÌN (2026-10-18) --

test('biết 2 trong 3: ba chế độ ra cùng một hình học', () => {
  const base = { camera: CAMERA, focalLengthMm: null, workingDistanceMm: null, fovWidthMm: null, fovHeightMm: null };
  // Vùng nhìn 100 × 100 + WD 300 → β 0,070656 → f = 300 × 0,070656 ÷ 1,070656 = 19,798 mm
  const a = solveGeometry({ ...base, mode: 'fov-wd', fovWidthMm: 100, fovHeightMm: 100, workingDistanceMm: 300 })!;
  close(a.beta, 0.070656, 1e-6, 'β');
  close(a.focalLengthMm, 19.798, 1e-3, 'f');
  // Ống 16 mm ở WD 300 → β = 16 ÷ 284 = 0,056338 → vùng nhìn 8,4456 ÷ β = 149,91 × 7,0656 ÷ β = 125,41
  const b = solveGeometry({ ...base, mode: 'focal-wd', focalLengthMm: 16, workingDistanceMm: 300 })!;
  close(b.beta, 0.056338, 1e-6, 'β');
  close(b.fovWidthMm, 149.91, 0.01, 'rộng');
  close(b.fovHeightMm, 125.41, 0.01, 'cao');
  // Ống 16 mm, vùng nhìn 100 × 100 → β 0,070656 → WD = 16 × (1 + 1 ÷ 0,070656) = 242,45 mm
  const c = solveGeometry({ ...base, mode: 'focal-fov', focalLengthMm: 16, fovWidthMm: 100, fovHeightMm: 100 })!;
  close(c.workingDistanceMm, 242.45, 0.01, 'WD');
  // Đi ngược lại phải ra đúng β: 16 ÷ (242,45 − 16)
  close(16 / (c.workingDistanceMm - 16), c.beta, 1e-9, 'khứ hồi');
  // Thiếu dữ kiện / WD ≤ f → null, không đoán
  assert.equal(solveGeometry({ ...base, mode: 'focal-wd', focalLengthMm: 16, workingDistanceMm: 10 }), null);
  assert.equal(solveGeometry({ ...base, mode: 'fov-wd', fovWidthMm: 100, fovHeightMm: 100 }), null);
});

test('chế độ tiêu cự + WD: ống đúng tiêu cự đó phủ khít 100% và đứng đầu', () => {
  const g = solveGeometry({ mode: 'focal-wd', camera: CAMERA, focalLengthMm: 16, workingDistanceMm: 300, fovWidthMm: null, fovHeightMm: null })!;
  const { candidates } = selectLenses(
    { ...INPUT, fovWidthMm: g.fovWidthMm, fovHeightMm: g.fovHeightMm, workingDistanceMm: g.workingDistanceMm },
    [lens({ focal_length_mm: 12 }, 'f12'), lens({ focal_length_mm: 16 }, 'f16'), lens({ focal_length_mm: 25 }, 'f25')]
  );
  assert.equal(candidates[0].component.model, 'f16');
  close(candidates[0].pixelUse, 1, 1e-3, 'pixel dùng');
  assert.equal(candidates.find((x) => x.component.model === 'f25')!.status, 'fail');
});

test('góc nhìn tại WD: 2 × atan(vùng nhìn thật ÷ 2·WD)', () => {
  const need = lensNeed(INPUT)!;
  // vùng nhìn thật 119,53 × 100 mm ở WD 300: 2·atan(119,53 ÷ 600) = 22,53° ; 2·atan(100 ÷ 600) = 18,92°
  close(need.aovLongDeg, 22.53, 0.01, 'cạnh dài');
  close(need.aovShortDeg, 18.92, 0.01, 'cạnh ngắn');
  // Telecentric: không có góc nhìn
  assert.equal(lensNeed({ ...INPUT, lensKind: 'telecentric' })!.aovLongDeg, null);
});

test('tab M12 chỉ lấy ngàm M12; tab ống thường bỏ M12', () => {
  const m12 = lens({ focal_length_mm: 8, mount: 'M12', image_circle: '1/2' }, 'm12');
  const c = lens({ focal_length_mm: 16 }, 'c16');
  assert.deepEqual(selectLenses({ ...INPUT, lensKind: 'm12' }, [m12, c]).candidates.map((x) => x.component.model), ['m12']);
  assert.deepEqual(selectLenses(INPUT, [m12, c]).candidates.map((x) => x.component.model), ['c16']);
  // Camera ngàm C với ống M12: loại vì sai ngàm (vòng ảnh 1/2" cũng không phủ 2/3")
  const r = selectLenses({ ...INPUT, lensKind: 'm12' }, [m12]).candidates[0];
  assert.equal(r.status, 'fail');
  assert.equal(r.checks.find((k) => k.key === 'mount')!.noteKey, 'mountMismatch');
});

test('telecentric để trống WD: vẫn lọc, khoảng cách lấy theo dải của ống', () => {
  const tele = lens({ lens_type: 'telecentric', focal_length_mm: null, magnification: 0.1, wd_min_mm: 290, wd_max_mm: 310, f_number_min: 4, image_circle: '2/3' }, 'tc');
  const r = selectLenses({ ...INPUT, fovWidthMm: 60, fovHeightMm: 50, workingDistanceMm: null, lensKind: 'telecentric' }, [tele]);
  assert.equal(r.need!.focalIdealMm, null);
  // F#max telecentric là F# làm việc: 5,1416, không chia (1 + β)
  close(r.need!.fMaxRing, 5.14, 0.01, 'F#max telecentric');
  const wd = r.candidates[0].checks.find((k) => k.key === 'workingDistance')!;
  assert.equal(wd.noteKey, 'wdFromLens');
  assert.equal(r.candidates[0].status, 'pass');
  // Ống thường bắt buộc có WD
  assert.equal(lensNeed({ ...INPUT, workingDistanceMm: null }), null);
});
