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
import { evaluateLens, lensNeed, selectLenses, solveGeometry, type LensSelectorInput } from '../src/lib/vision/lensSelector';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';

/** Bỏ giới hạn LNS-005 cho các test phụ kiện — ở đó ống trơn rộng hơn vật nhiều lần là cố ý. */
const NO_FOV_LIMIT = { ...DEFAULT_ENGINE_PARAMS, lensFovMaxRatio: 100 };

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
  // f = β × WD = 0,070656 × 300 = 21,197 mm (Newton, WD từ mặt trước, sF = 0 — chốt 2026-10-26)
  close(need.focalIdealMm, 21.2, 0.01, 'f');
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
  assert.equal(candidates[0].component.model, 'f16');
  const by = (m: string) => candidates.find((c) => c.component.model === m)!;
  const [c16, c12, c25] = [by('f16'), by('f12'), by('f25')];
  // 16 mm: β = 16 ÷ 300 = 0,05333 → 158,4 × 132,5 mm phủ 100 × 100
  close(c16.beta, 0.05333, 1e-5, 'β 16');
  close(c16.fovLongMm, 158.4, 0.1, 'FOV 16');
  close(c16.pixelUse, 10000 / (158.36 * 132.48), 0.002, 'pixel dùng 16');
  assert.equal(c16.status, 'pass');
  // 12 mm: β = 12 ÷ 300 = 0,04 → 211,1 × 176,6 mm — trục sát nhất vẫn dư 1,77× > 1,5× → LOẠI (LNS-005)
  assert.equal(c12.status, 'fail');
  assert.equal(c12.checks.find((c) => c.noteKey === 'fovTooWide')?.noteValues?.ratio, 1.77);
  assert.ok(c12.pixelUse! < c16.pixelUse!);
  // Nới ngưỡng thì 12 mm lại đạt
  assert.equal(selectLenses(INPUT, [l12], { ...DEFAULT_ENGINE_PARAMS, lensFovMaxRatio: 2 }).candidates[0].status, 'pass');
  // 25 mm: β = 25 ÷ 300 = 0,0833 → 101,3 × 84,8 mm — cạnh ngắn < 100
  assert.equal(c25.status, 'fail');
  assert.equal(c25.checks.find((c) => c.key === 'fov')!.noteKey, 'fovTooSmall');
});

test('loại: sai ngàm, vòng ảnh nhỏ, WD dưới MOD, mm/px thô hơn mức cần', () => {
  const wrongMount = lens({ focal_length_mm: 16, mount: 'M42' });
  const smallCircle = lens({ focal_length_mm: 16, image_circle: '1/2' });
  const tooClose = lens({ focal_length_mm: 16, wd_min_mm: 400 });
  // Ống TRƠN (chưa thử phụ kiện): cả ba bị loại đúng lý do.
  const need = lensNeed(INPUT)!;
  const bare = (c: Component) => evaluateLens(INPUT, need, c);
  assert.equal(bare(wrongMount).checks.find((c) => c.key === 'mount')!.noteKey, 'mountMismatch');
  assert.equal(bare(smallCircle).checks.find((c) => c.key === 'imageCircle')!.status, 'fail');
  assert.equal(bare(tooClose).checks.find((c) => c.key === 'workingDistance')!.noteKey, 'wdBelowMod');
  for (const c of [wrongMount, smallCircle, tooClose]) assert.equal(bare(c).status, 'fail');

  // Sau khi thử phụ kiện (2026-10-20): sai ngàm vẫn loại; vòng ảnh nhỏ cần bộ nhân 1,4× nhưng
  // vùng nhìn còn 113,1 × 94,6 < 100 × 100 → vẫn loại; MOD 400 ở WD 300 cứu được bằng ống nối
  // e ∈ [16 × (0,05333 − 0,04); 16 × 0,05333] = [0,21; 0,85] mm → 0,5 mm chuẩn.
  const { candidates } = selectLenses(INPUT, [wrongMount, smallCircle, tooClose]);
  const by = (c: Component) => candidates.find((x) => x.component === c)!;
  assert.equal(by(wrongMount).status, 'fail');
  assert.equal(by(smallCircle).status, 'fail');
  assert.equal(by(tooClose).status, 'warn');
  assert.ok(by(tooClose).accessory?.kind === 'tube' && by(tooClose).accessory!.kind === 'tube');

  // mm/px cần 0,05: 16 mm cho 0,00345 ÷ 0,05333 = 0,0647 > 0,05 → loại; bộ nhân 1,4× làm vùng
  // nhìn hẹp hơn vật 100 × 100 → không cứu được, vẫn loại.
  const coarse = selectLenses({ ...INPUT, targetMmPerPx: 0.05 }, [lens({ focal_length_mm: 16 })]).candidates[0];
  assert.equal(coarse.checks.find((c) => c.key === 'pixel')!.status, 'fail');
  assert.equal(coarse.status, 'fail');
  assert.equal(coarse.accessory, null);
});

test('ống C trên camera CS: cảnh báo vòng đệm, không loại', () => {
  const c = selectLenses({ ...INPUT, camera: { ...CAMERA, mount: 'CS' } }, [lens({ focal_length_mm: 16 })]).candidates[0];
  assert.equal(c.checks.find((k) => k.key === 'mount')!.noteKey, 'mountCsSpacer');
  assert.equal(c.status, 'warn');
});

test('độ sâu: Δh 10 mm đặt F/2; Δh 40 mm cần F/7,8 > 1,5 × F#max 4,88 → cảnh báo xung đột', () => {
  // 16 mm: β 0,05333 ; c = 0,0069 mm
  // F = 10 × 0,05333² ÷ (2 × 0,0069 × 1,05333) = 1,957 → F/2 ≤ F#max 4,88 → đặt F/2
  const shallow = selectLenses({ ...INPUT, heightVariationMm: 10 }, [lens({ focal_length_mm: 16 })]).candidates[0];
  const depth = shallow.checks.find((c) => c.key === 'depth')!;
  assert.equal(depth.status, 'pass', depth.formula);
  close(shallow.fSet, 2.0, 0.05, 'F đặt');
  // Δh 40 mm: F/7,8 > 1,5 × 4,88 = 7,3 → xung đột với nhiễu xạ (cảnh báo, không loại)
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
  // 2/3" 8,8 × 6,6 → min(0,088 ; 0,066) = 0,066 → f = 0,066 × 300 = 19,8 mm
  close(need.beta, 0.066, 1e-6, 'β');
  close(need.focalIdealMm, 19.8, 0.01, 'f');
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
  // Vùng nhìn 100 × 100 + WD 300 → β 0,070656 → f = 0,070656 × 300 = 21,197 mm
  const a = solveGeometry({ ...base, mode: 'fov-wd', fovWidthMm: 100, fovHeightMm: 100, workingDistanceMm: 300 })!;
  close(a.beta, 0.070656, 1e-6, 'β');
  close(a.focalLengthMm, 21.197, 1e-3, 'f');
  // Ống 16 mm ở WD 300 → β = 16 ÷ 300 = 0,053333 → vùng nhìn 8,4456 ÷ β = 158,36 × 7,0656 ÷ β = 132,48
  const b = solveGeometry({ ...base, mode: 'focal-wd', focalLengthMm: 16, workingDistanceMm: 300 })!;
  close(b.beta, 0.053333, 1e-6, 'β');
  close(b.fovWidthMm, 158.36, 0.01, 'rộng');
  close(b.fovHeightMm, 132.48, 0.01, 'cao');
  // Ống 16 mm, vùng nhìn 100 × 100 → β 0,070656 → WD = 16 ÷ 0,070656 = 226,45 mm
  const c = solveGeometry({ ...base, mode: 'focal-fov', focalLengthMm: 16, fovWidthMm: 100, fovHeightMm: 100 })!;
  close(c.workingDistanceMm, 226.45, 0.01, 'WD');
  // Đi ngược lại phải ra đúng β: 16 ÷ 226,45
  close(16 / c.workingDistanceMm, c.beta, 1e-9, 'khứ hồi');
  // Thiếu dữ kiện / WD ≤ sF (0) → null, không đoán
  assert.equal(solveGeometry({ ...base, mode: 'focal-wd', focalLengthMm: 16, workingDistanceMm: 0 }), null);
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

// ─────────────────────────────── PHỤ KIỆN: ỐNG NỐI / BỘ NHÂN (OPT-010 / OPT-011, 2026-10-20) ──

const part = (kind: 'tube' | 'converter', spec: Record<string, unknown>, model: string): Component =>
  ({ ...lens(spec, model), kind, spec }) as unknown as Component;

test('[OPT-010] dải ống nối và dải lấy nét — tính tay', async () => {
  const { tubeLengthRange, tubeFocusRange, chooseTubeStack } = await import('../src/lib/vision/lensSelector');
  // f 25, MOD 200, WD 100 (Newton, sF = 0): β_WD = 25 ÷ 100 = 0,25 ; β_MOD = 25 ÷ 200 = 0,125
  // e ∈ [25 × (0,25 − 0,125); 25 × 0,25] = [3,125; 6,25] mm
  const r = tubeLengthRange(25, 200, 100)!;
  close(r.minMm, 3.125, 1e-9, 'e min');
  close(r.maxMm, 6.25, 1e-9, 'e max');
  // Có sF 5: β_WD = 25 ÷ 95, β_MOD = 25 ÷ 195
  close(tubeLengthRange(25, 200, 100, 5)!.maxMm, 25 * (25 / 95), 1e-9, 'e max co sF');
  // Ống 5 mm: β ∈ [0,2; 0,325] → WD = f ÷ β ∈ [25 ÷ 0,325; 25 ÷ 0,2] = [76,92; 125]
  const f = tubeFocusRange(25, 200, 5);
  close(f.wdMinMm, 76.923, 1e-3, 'WD min');
  close(f.wdMaxMm, 125, 1e-9, 'WD max');
  // Chọn ít khúc nhất: kho 2/5/10 → [5]; khoảng [11; 13] → 1 khúc không có → 2 + 10 = 12
  assert.deepEqual(chooseTubeStack([{ lengthMm: 2 }, { lengthMm: 5 }, { lengthMm: 10 }], 3.125, 6.25)!.map((t) => t.lengthMm), [5]);
  assert.deepEqual(chooseTubeStack([{ lengthMm: 2 }, { lengthMm: 5 }, { lengthMm: 10 }], 11, 13)!.map((t) => t.lengthMm), [2, 10]);
  assert.equal(chooseTubeStack([{ lengthMm: 20 }], 4, 8), null);
});

test('[OPT-010] ống bị loại vì MOD → đạt nhờ ống nối 5 mm trong kho, cảnh báo macro', () => {
  const lens25 = lens({ focal_length_mm: 25, wd_min_mm: 200 }, 'f25-mod200');
  const tubes = [part('tube', { length_mm: 5, mount: 'C' }, 'T5'), part('tube', { length_mm: 10, mount: 'C' }, 'T10')];
  // WD 80: β = 25 ÷ 80 = 0,3125 ; e ∈ [25 × (0,3125 − 0,125); 25 × 0,3125] = [4,69; 7,81] → 5 mm
  const input = { ...INPUT, fovWidthMm: 20, fovHeightMm: 18, workingDistanceMm: 80 };
  const c = selectLenses(input, [lens25, ...tubes]).candidates[0];
  assert.equal(c.status, 'warn', JSON.stringify(c.checks.map((k) => [k.key, k.status, k.noteKey])));
  assert.equal(c.accessory?.kind, 'tube');
  assert.ok(c.accessory?.kind === 'tube' && c.accessory.inStock && c.accessory.totalMm === 5);
  const notes = c.checks.filter((k) => k.key === 'tube').map((k) => k.noteKey);
  assert.ok(notes.includes('tubeChosen'));
  assert.ok(notes.includes('tubeMacro'), 'β 0,3125 ≥ 0,3');
  assert.ok(!notes.includes('accessoryLight'), '2 log₂ 1,3125 = 0,78 stop < 1');
  // WD được kiểm theo dải mới, không còn LOẠI vì MOD
  assert.equal(c.checks.find((k) => k.key === 'workingDistance')!.noteKey, 'wdWithTube');
  // Kho không có ống nối → gợi ý mức chuẩn 5 mm, "chưa có trong kho"
  const std = selectLenses(input, [lens25]).candidates[0];
  assert.ok(std.accessory?.kind === 'tube' && !std.accessory.inStock && std.accessory.totalMm === 5);
  assert.ok(std.checks.some((k) => k.noteKey === 'accessoryNotInStock'));
});

test('[OPT-011] mm/px thô → bộ nhân: k cần 1,62 → 2× chuẩn; kho có 1,7× thì lấy 1,7×', () => {
  // f 16 ở WD 300: β = 16 ÷ 300 = 0,05333 → 0,06469 mm/px > 0,04 → k ≥ 0,06469 ÷ 0,04 = 1,617
  const lens16 = lens({ focal_length_mm: 16 }, 'f16');
  const input = { ...INPUT, fovWidthMm: 60, fovHeightMm: 50, targetMmPerPx: 0.04 };
  const std = selectLenses(input, [lens16], NO_FOV_LIMIT).candidates[0];
  assert.equal(std.accessory?.kind, 'converter');
  assert.ok(std.accessory?.kind === 'converter' && std.accessory.factor === 2 && !std.accessory.inStock);
  close(std.accessory!.kind === 'converter' ? std.accessory!.needFactor : 0, 1.617, 1e-3, 'k cần');
  // 2 × 0,05333 = 0,10667 → 0,03234 mm/px ≤ 0,04 ; vùng nhìn 79,2 × 66,2 phủ 60 × 50
  close(std.beta, 0.10667, 1e-5, 'β cả hệ');
  close(std.mmPerPx, 0.03234, 1e-5, 'mm/px');
  // F nhanh nhất 1,4 × 2 = 2,8 ≤ F#max 5,1416 ÷ 1,10667 = 4,65 → nhiễu xạ vẫn đạt
  assert.equal(std.checks.find((k) => k.key === 'diffraction')!.status, 'pass');
  // lp/mm 160 ÷ 2 = 80 < 144,9 → cảnh báo độ phân giải ống
  assert.equal(std.checks.find((k) => k.key === 'resolution')!.status, 'warn');
  // mất 2 log₂ 2 = 2 stop ≥ 1 → cảnh báo tối
  assert.ok(std.checks.some((k) => k.key === 'converter' && k.noteKey === 'accessoryLight'));
  const conv = part('converter', { factor: 1.7, mount: 'C', max_format: '1.1' }, 'X1.7');
  const fromStock = selectLenses(input, [lens16, conv], NO_FOV_LIMIT).candidates[0];
  assert.ok(fromStock.accessory?.kind === 'converter' && fromStock.accessory.factor === 1.7 && fromStock.accessory.inStock);
});

test('[OPT-011] vòng ảnh nhỏ → bộ nhân 1,4× (k ≥ 10,78 ÷ 8 = 1,35), không cảnh báo tối', () => {
  const half = lens({ focal_length_mm: 16, image_circle: '1/2' }, 'f16-half');
  const c = selectLenses({ ...INPUT, fovWidthMm: 60, fovHeightMm: 50 }, [half], NO_FOV_LIMIT).candidates[0];
  assert.ok(c.accessory?.kind === 'converter' && c.accessory.factor === 1.4 && c.accessory.reason === 'imageCircle');
  assert.equal(c.checks.find((k) => k.key === 'imageCircle')!.status, 'pass', 'Ø 8 × 1,4 = 11,2 ≥ 11');
  assert.ok(!c.checks.some((k) => k.noteKey === 'accessoryLight'), '2 log₂ 1,4 = 0,97 stop < 1');
});

test('phụ kiện: không cứu ống telecentric, không ghép hai phụ kiện, xếp sau ống đạt trơn', () => {
  // Hỏng cả MOD lẫn mm/px → cần hai phụ kiện → không gợi ý (Q4)
  const both = lens({ focal_length_mm: 16, wd_min_mm: 400 }, 'both');
  const r = selectLenses({ ...INPUT, targetMmPerPx: 0.04 }, [both], NO_FOV_LIMIT).candidates[0];
  assert.equal(r.status, 'fail');
  assert.equal(r.accessory, null);
  // Telecentric ngoài dải WD → vẫn LOẠI, không thử phụ kiện (Q5)
  const tele = lens({ lens_type: 'telecentric', focal_length_mm: null, magnification: 0.1, wd_min_mm: 290, wd_max_mm: 310 }, 'tc');
  const t = selectLenses({ ...INPUT, fovWidthMm: 60, fovHeightMm: 50, workingDistanceMm: 200, lensKind: 'telecentric' }, [tele]).candidates[0];
  assert.equal(t.status, 'fail');
  assert.equal(t.accessory, null);
  // Thứ tự: ống đạt trơn trước ống cần phụ kiện
  const plain = lens({ focal_length_mm: 12 }, 'plain12');
  const mod = lens({ focal_length_mm: 16, wd_min_mm: 400 }, 'mod16');
  const order = selectLenses(INPUT, [mod, plain], NO_FOV_LIMIT).candidates.map((c) => c.component.model);
  assert.deepEqual(order, ['plain12', 'mod16']);
});

// ─────────────────────── PHỤ KIỆN ANH TỰ KHAI (chốt 2026-10-20, Q1–Q4) ──

test('[OPT-010 khai tay] ống nối 5 mm áp cho mọi ống: vừa → đạt; quá dài / quá ngắn → loại có lý do', () => {
  const tube5 = { tubeMm: 5, converterFactor: null };
  // f 25, MOD 200, WD 80: dải nét [76,92; 125] → 80 nằm trong → đạt (cảnh báo macro β 0,3125)
  const a = selectLenses({ ...INPUT, fovWidthMm: 20, fovHeightMm: 18, workingDistanceMm: 80, fixedAccessory: tube5 }, [lens({ focal_length_mm: 25, wd_min_mm: 200 })]).candidates[0];
  assert.equal(a.checks.find((k) => k.key === 'workingDistance')!.noteKey, 'wdWithTube');
  assert.ok(a.checks.some((k) => k.noteKey === 'tubeMacro'));
  assert.equal(a.status, 'warn');
  assert.equal(a.accessory, null, 'khai tay: không gắn phụ kiện tự gợi ý');
  // f 16, WD 300: lắp 5 mm thì nét xa nhất 16² ÷ 5 = 51,2 mm < 300 → ống nối quá dài
  const b = selectLenses({ ...INPUT, fixedAccessory: tube5 }, [lens({ focal_length_mm: 16 })]).candidates[0];
  const wdB = b.checks.find((k) => k.key === 'workingDistance')!;
  assert.equal(wdB.noteKey, 'tubeTooLong');
  assert.equal(b.status, 'fail');
  // f 25, MOD 200, ống 1 mm: nét gần nhất 25 ÷ (0,04 + 0,125) = 151,5 > 100 → vẫn quá ngắn
  const c = selectLenses({ ...INPUT, fovWidthMm: 20, fovHeightMm: 18, workingDistanceMm: 100, fixedAccessory: { tubeMm: 1, converterFactor: null } }, [lens({ focal_length_mm: 25, wd_min_mm: 200 })]).candidates[0];
  assert.equal(c.checks.find((k) => k.key === 'workingDistance')!.noteKey, 'tubeTooShort');
  // Ống chưa khai MOD: chỉ biết giới hạn xa 25² ÷ 5 = 125 mm ≥ 100 → chưa kiểm được cận dưới
  const d = selectLenses({ ...INPUT, fovWidthMm: 20, fovHeightMm: 18, workingDistanceMm: 100, fixedAccessory: tube5 }, [lens({ focal_length_mm: 25, wd_min_mm: null })]).candidates[0];
  assert.equal(d.checks.find((k) => k.key === 'workingDistance')!.noteKey, 'tubeModUnknown');
});

test('[OPT-011 khai tay] bộ nhân 2× cho mọi ống: tiêu cự lý tưởng là của ống gốc', () => {
  const input = { ...INPUT, fovWidthMm: 60, fovHeightMm: 50, fixedAccessory: { tubeMm: null, converterFactor: 2 } };
  // β cần = min(8,4456 ÷ 60 ; 7,0656 ÷ 50) = 0,14076 → ống gốc 0,07038 → f = 0,07038 × 300 = 21,11
  const need = lensNeed(input)!;
  close(need.focalIdealMm, 21.11, 0.01, 'f ống gốc');
  // F#max vòng khẩu ống gốc = 5,1416 ÷ 1,14076 ÷ 2 = 2,254
  close(need.fMaxRing, 2.25, 0.01, 'F#max ống gốc');
  assert.equal(need.converterFactor, 2);
  const c = selectLenses(input, [lens({ focal_length_mm: 16 })]).candidates[0];
  close(c.beta, 0.10667, 1e-5, 'β cả hệ');
  assert.ok(c.checks.some((k) => k.noteKey === 'converterManual'));
  assert.ok(c.checks.some((k) => k.noteKey === 'accessoryLight'), '2 stop');
  assert.equal(c.accessory, null);
});

test('[khai tay] cả hai: cảnh báo mất sáng CỘNG DỒN; tắt gợi ý tự động; chỉ tab ống thường', () => {
  // ống 25 (MOD 200) ở WD 100 + ống nối 5 + bộ nhân 2×: β = 2 × 0,25 = 0,5 → vùng nhìn 16,9 × 14,1 ⊇ 10 × 8
  const both = selectLenses(
    { ...INPUT, fovWidthMm: 10, fovHeightMm: 8, workingDistanceMm: 100, fixedAccessory: { tubeMm: 5, converterFactor: 2 } },
    [lens({ focal_length_mm: 25, wd_min_mm: 200 })],
    NO_FOV_LIMIT
  ).candidates[0];
  close(both.beta, 0.5, 1e-4, 'β cả hệ');
  // 2 log₂(1,25) + 2 log₂ 2 = 0,644 + 2 = 2,64 stop
  const light = both.checks.find((k) => k.noteKey === 'accessoryLightTotal')!;
  close(Number(light.noteValues!.stops), 2.6, 0.05, 'stop cộng dồn');
  assert.equal(both.checks.filter((k) => k.noteKey === 'accessoryLight').length, 0, 'không lặp dòng riêng lẻ');
  assert.notEqual(both.status, 'fail', JSON.stringify(both.checks.filter((k) => k.status === 'fail')));
  // Đã khai bộ nhân → ống MOD 400 ở WD 300 KHÔNG được tự gợi ý ống nối nữa (Q1)
  const noAuto = selectLenses({ ...INPUT, fixedAccessory: { tubeMm: null, converterFactor: 1.4 } }, [lens({ focal_length_mm: 12, wd_min_mm: 400 })], NO_FOV_LIMIT).candidates[0];
  assert.equal(noAuto.checks.find((k) => k.key === 'workingDistance')!.noteKey, 'wdBelowMod');
  assert.equal(noAuto.accessory, null);
  // Tab M12: khai tay bị bỏ qua (Q4)
  const m12 = selectLenses({ ...INPUT, lensKind: 'm12', fixedAccessory: { tubeMm: 5, converterFactor: 2 } }, [lens({ focal_length_mm: 8, mount: 'M12', image_circle: '2/3' })]).candidates[0];
  assert.ok(!m12.checks.some((k) => k.key === 'tube' || k.key === 'converter'));
});

test('[khai tay] biết 2 trong 3 với bộ nhân 2×: tiêu cự là của ống gốc', () => {
  const base = { camera: CAMERA, focalLengthMm: null, workingDistanceMm: null, fovWidthMm: null, fovHeightMm: null, converterFactor: 2 };
  close(solveGeometry({ ...base, mode: 'fov-wd', fovWidthMm: 60, fovHeightMm: 50, workingDistanceMm: 300 })!.focalLengthMm, 21.11, 0.01, 'f');
  // f 16 ở WD 300 → β cả hệ 2 × 0,05333 = 0,10667 → vùng nhìn 8,4456 ÷ 0,10667 = 79,18
  close(solveGeometry({ ...base, mode: 'focal-wd', focalLengthMm: 16, workingDistanceMm: 300 })!.fovWidthMm, 79.18, 0.01, 'vùng nhìn');
  // f 16, vùng nhìn 60 × 50 → β ống gốc 0,07038 → WD = 16 ÷ 0,07038 = 227,3
  close(solveGeometry({ ...base, mode: 'focal-fov', focalLengthMm: 16, fovWidthMm: 60, fovHeightMm: 50 })!.workingDistanceMm, 227.3, 0.1, 'WD');
});

test('[OPT-012] WD thật: khoảng cách để ống vừa khít vùng nhìn, chênh với WD nhập, dưới MOD', async () => {
  const { betaToFit, realWorkingDistanceMm } = await import('../src/lib/vision/lensSelector');
  // Vùng nhìn 100 × 100, cảm biến 8,4456 × 7,0656 → β vừa khít = min(0,084456 ; 0,070656) = 0,070656
  close(betaToFit(8.4456, 7.0656, 100, 100, false), 0.070656, 1e-6, 'β vừa khít');
  // Line scan: chỉ cạnh dài
  close(betaToFit(8.4456, 7.0656, 100, 100, true), 0.084456, 1e-6, 'β line');
  // Bộ nhân 2×: WD = 16 × 2 ÷ 0,070656 = 452,9 ; có sF 3: + 3
  close(realWorkingDistanceMm(16, 0.070656, 2), 452.9, 0.1, 'WD bộ nhân');
  close(realWorkingDistanceMm(16, 0.070656, 1, 3), 229.45, 0.01, 'WD có sF');

  const l16 = lens({ focal_length_mm: 16 }, 'wd16');
  const l25 = lens({ focal_length_mm: 25 }, 'wd25');
  const l8 = lens({ focal_length_mm: 8, wd_min_mm: 200 }, 'wd8');
  const { candidates } = selectLenses(INPUT, [l16, l25, l8]);
  const real = (model: string) => candidates.find((c) => c.component.model === model)!.realWd!;
  // 16 mm: 16 ÷ 0,070656 = 226,4 → gần hơn WD 300 là 73,6 mm
  const r16 = real('wd16');
  assert.equal(r16.kind, 'focal');
  if (r16.kind === 'focal') {
    close(r16.mm, 226.4, 0.1, 'WD thật 16');
    close(r16.deltaMm, -73.6, 0.1, 'chênh 16');
    assert.equal(r16.belowModMm, null);
  }
  // 25 mm: 25 ÷ 0,070656 = 353,8 → xa hơn 53,8 mm (ống này bị loại ở WD 300 nhưng WD thật vẫn hiện)
  const r25 = real('wd25');
  if (r25.kind === 'focal') close(r25.deltaMm, 53.8, 0.1, 'chênh 25');
  // 8 mm: 113,2 mm < MOD 200 → báo dưới MOD
  const r8 = real('wd8');
  if (r8.kind === 'focal') assert.equal(r8.belowModMm, 200);
  // Không nhập WD: vẫn có WD thật, không có chênh
  const inputNoWd = { ...INPUT, workingDistanceMm: null };
  const noWd = evaluateLens(inputNoWd, lensNeed(INPUT)!, l16).realWd!;
  assert.ok(noWd.kind === 'focal' && noWd.deltaMm === null && Math.abs(noWd.mm - 226.4) < 0.1);
  // Telecentric: dải WD của hãng
  const tele = lens({ lens_type: 'telecentric', focal_length_mm: null, magnification: 0.1, wd_min_mm: 290, wd_max_mm: 310, image_circle: '2/3' }, 'wdtc');
  const rt = selectLenses({ ...INPUT, fovWidthMm: 60, fovHeightMm: 50, lensKind: 'telecentric' }, [tele]).candidates[0].realWd;
  assert.deepEqual(rt, { kind: 'fixed', minMm: 290, maxMm: 310 });
});

test('[đối chiếu hãng] Hikrobot Lens Selector + datasheet Basler (chốt 2026-10-26 Q6)', () => {
  // Hik MV-CS050-10GM (2448 × 2048, 3,45 µm), vùng nhìn rộng 100 (cao tự tính 83,66), WD 300:
  // Hik ra β 0,084456, f 25,3 mm (= β × WD). Trang mình phải ra đúng như vậy.
  const input = { ...INPUT, fovWidthMm: 100, fovHeightMm: 83.66 };
  const need = lensNeed(input)!;
  close(need.beta, 0.084456, 1e-5, 'β Hik');
  close(need.focalIdealMm, 25.3, 0.05, 'f Hik');
  // Ống 25 mm ở WD 300: Hik ra vùng nhìn rộng 97,8–106,1 mm tuỳ ống (dữ liệu riêng từng ống);
  // công thức nhanh (sF = 0) ra 101,3 — nằm trong dải đó, và ống được chấm đạt (trước đây 92,9 → loại oan).
  const c25 = selectLenses(input, [lens({ focal_length_mm: 25 })]).candidates[0];
  close(c25.fovLongMm, 101.35, 0.1, 'vùng nhìn 25 mm');
  assert.ok(c25.fovLongMm! >= 97.8 && c25.fovLongMm! <= 106.1);
  assert.equal(c25.status, 'pass');
  // Basler C125-2522-5M-P: f 25, sF 1,83 mm, datasheet ghi β 0,048 ở WD 500 (f ±5 %).
  const basler = evaluateLens({ ...input, workingDistanceMm: 500 }, lensNeed({ ...input, workingDistanceMm: 500 })!, lens({ focal_length_mm: 25, front_focal_mm: 1.83 }));
  close(basler.beta, 0.05018, 1e-4, 'β Basler');
  assert.ok(Math.abs(basler.beta! - 0.048) / 0.048 < 0.05, 'trong dung sai tiêu cự ±5 %');
});

test('[đối chiếu Hik] 8 ống khai sF: vùng nhìn khớp Hikrobot ở 3 lượt chạy (chốt 2026-10-26 Q4)', () => {
  // sF dò ngược từ lượt 1 (MV-CS050-10GM, WD 300) — docs/tham-khao-hang/sf-hikrobot.csv.
  // [model, f, sF, vùng nhìn rộng Hik: 2/3" WD 300, 2/3" WD 600, 1/1.8" (MV-CS060-10GM) WD 300]
  const HIK: [string, number, number, number, number, number][] = [
    ['MF2518M-5MPE', 25, 3.7, 100.1, 201.5, 87.4],
    ['MF2528M-10MPE', 25, 1.9, 100.7, 202, 87.9],
    ['MF2528M-8MP', 25, 10.5, 97.8, 199.2, 85.4],
    ['KF2528M-12MPE', 25, -13.8, 106, 207.3, 92.5],
    ['KF2524M-25MP', 25, -14.1, 106.1, 207.4, 92.6],
    ['MF3518M-5MPE', 35, 21.1, 67.3, 139.7, 58.8],
    ['MF3528M-8MP', 35, 29.8, 65.2, 137.6, 57],
    ['KF3524M-25MP', 35, -7.1, 74.1, 146.5, 64.7],
  ];
  const small: ConfigCamera = { ...CAMERA, widthPx: 3072, heightPx: 2048, pixelSizeUm: 2.4, sensorFormat: '1/1.8' };
  for (const [model, f, sF, w300, w600, wSmall] of HIK) {
    const component = lens({ focal_length_mm: f, front_focal_mm: sF, wd_min_mm: 100 }, model);
    const at = (camera: ConfigCamera, wd: number) => {
      const input = { ...INPUT, camera, workingDistanceMm: wd, fovWidthMm: 50, fovHeightMm: 40 };
      return evaluateLens(input, lensNeed(input)!, component).fovLongMm!;
    };
    close(at(CAMERA, 300), w300, 0.2, `${model} WD 300`);
    close(at(CAMERA, 600), w600, 0.2, `${model} WD 600`);
    close(at(small, 300), wSmall, 0.2, `${model} cảm biến 1/1.8"`);
  }
});

test('ống Image Size LỚN hơn cảm biến vẫn được đề xuất; nhỏ hơn thì loại (OPT-002)', () => {
  // Camera 2/3" (đường chéo 11 mm): ống 1.1" (Φ17,6) và 1.2" cùng tiêu cự đều đạt như ống 2/3"; ống 1/2" (Φ8) bị loại.
  const formats = ['2/3', '1.1', '1.2', '1/2'];
  const { candidates } = selectLenses(INPUT, formats.map((f) => lens({ focal_length_mm: 16, image_circle: f }, `f16-${f}`)), NO_FOV_LIMIT);
  const status = Object.fromEntries(candidates.map((c) => [c.component.model, c.status]));
  assert.equal(status['f16-2/3'], 'pass');
  assert.equal(status['f16-1.1'], 'pass');
  assert.equal(status['f16-1.2'], 'pass');
  assert.notEqual(status['f16-1/2'], 'pass');
});
