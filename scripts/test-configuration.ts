/**
 * Tầng Cấu hình (V1c mục C2): OPT-001..005, THR-003/004 trên một bộ thiết bị,
 * và luật camera nghiêng OPT-009 ở tầng Yêu cầu.
 *
 * Bài chuẩn dùng suốt file (số tính tay ghi cạnh từng assert):
 *   vật 60 × 50 mm, 1 camera, lỗi 0,2 mm tương phản cao → 3 px → 0,0667 mm/px,
 *   WD 300 mm, Δh 2 mm, 30 sản phẩm/phút.
 *   Camera 2448 × 2048 px, pitch 3,45 µm → cảm biến 8,446 × 7,066 mm, 2/3", 23 fps, GigE.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import {
  CYCLE_DEFAULTS,
  blockingResults,
  cameraFromComponent,
  entocentricMagnification,
  evaluateConfiguration,
  focalLengthFor,
  fNumberForDepth,
  lensFromComponent,
  maxFNumber,
  pcFromComponent,
  uncheckedResults,
  type ConfigCamera,
  type ConfigLens,
  type ConfigPc,
} from '../src/lib/vision/configurationRules';
import { scoreResult } from '../src/lib/vision/feasibility';
import { RULES, type RuleResult } from '../src/lib/vision/rules';
import type { Component } from '../src/lib/components/specs';

const BASE = {
  'object.sizeX': 60,
  'object.sizeY': 50,
  'object.surface': 'matte',
  'object.heightVariation': 2,
  'detection.0.minSize': 0.2,
  'detection.0.contrast': 'high',
  'detection.0.variability': 'low',
  'production.partsPerMinute': 30,
  'system.cameraCount': 1,
  'system.workingDistance': 300,
};

const analysisOf = (overrides: Record<string, unknown> = {}) =>
  analyseRequirement(
    Object.entries({ ...BASE, ...overrides }).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'))
  );

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
  fNumberMin: 1.4,
  fNumberMax: 16,
  resolutionLpMm: 160,
  wdMinMm: 100,
  wdMaxMm: null,
};

const PC: ConfigPc = { cpuCores: 4, ramGb: 16, pcieSlots: 2, lanPorts: 2, gpu: null };

const run = (overrides: { analysis?: Record<string, unknown>; camera?: Partial<ConfigCamera>; lens?: Partial<ConfigLens> | null; pc?: Partial<ConfigPc> | null; cards?: number } = {}) =>
  evaluateConfiguration({
    analysis: analysisOf(overrides.analysis),
    camera: { ...CAMERA, ...overrides.camera },
    lens: overrides.lens === null ? null : { ...LENS, ...overrides.lens },
    pc: overrides.pc === null ? null : { ...PC, ...overrides.pc },
    interfaceCards: overrides.cards,
  });

const find = (results: RuleResult[], ruleId: string, key?: string) => {
  const found = results.filter((r) => r.ruleId === ruleId && (key === undefined || r.key === key));
  assert.equal(found.length, 1, `${ruleId}${key ? `/${key}` : ''}: can 1 ket qua, co ${found.length}`);
  return found[0];
};

test('danh mục: OPT-001..005, OPT-009, THR-003/004 đã khai, đúng nhóm khả thi', () => {
  const dims = Object.fromEntries(RULES.map((r) => [r.id, r.dimension]));
  for (const id of ['OPT-001', 'OPT-002', 'OPT-003', 'OPT-004', 'OPT-005', 'OPT-009']) assert.equal(dims[id], 'Optics', id);
  assert.equal(dims['THR-003'], 'Throughput');
  assert.equal(dims['THR-004'], 'Throughput');
});

test('công thức nền: β, tiêu cự, F#max, F cho độ sâu', () => {
  assert.ok(Math.abs(entocentricMagnification(25, 300)! - 25 / 275) < 1e-12);
  assert.equal(entocentricMagnification(300, 300), null, 'WD phai lon hon f');
  assert.ok(Math.abs(focalLengthFor(0.2, 300) - 50) < 1e-9, '300 × 0,2 ÷ 1,2 = 50');
  // 2 × 3,45 ÷ (2,44 × 0,55) = 5,14
  assert.ok(Math.abs(maxFNumber(3.45) - 5.1416) < 1e-3);
  // Pitch 2,2 µm → spec §4.2 ghi F#max ≈ 3,3
  assert.ok(Math.abs(maxFNumber(2.2) - 3.28) < 0.01);
  // 2 × 0,0909² ÷ (2 × 0,0069 × 1,0909) = 1,098
  assert.ok(Math.abs(fNumberForDepth(2, 0.0069, 25 / 275)! - 1.098) < 1e-3);
});

test('OPT-001: ống 25 mm ở 300 mm phủ đủ 60 × 50 và đạt 0,0667 mm/px', () => {
  const r = find(run(), 'OPT-001');
  assert.equal(r.status, 'pass');
  // β = 25/275 = 0,0909 → 0,00345 ÷ 0,0909 = 0,03795 mm/px → dư 0,0667/0,03795 = 1,757
  assert.ok(Math.abs(r.marginRatio! - 1.757) < 0.005, String(r.marginRatio));
  // β phủ = min(8,446/60, 7,066/50) = 0,14076 → f = 300 × 0,14076 ÷ 1,14076 = 37,0 mm
  assert.equal(r.noteValues?.fIdeal, 37);
  assert.ok(r.inputsUsed.some((i) => i.path === 'lens.focal_length_mm' && i.value === 25));
  assert.ok(r.inputsUsed.some((i) => i.path === 'system.workingDistance'));
});

test('OPT-001: tiêu cự dài quá → vùng nhìn hụt; ngắn quá → thô; camera ít pixel → không ống nào cứu', () => {
  assert.equal(find(run({ lens: { focalLengthMm: 50 } }), 'OPT-001').noteKey, 'lensFovTooSmall', 'β 0,2 > 0,1408');
  const coarse = find(run({ lens: { focalLengthMm: 8 } }), 'OPT-001');
  assert.equal(coarse.status, 'fail');
  assert.equal(coarse.noteKey, 'lensTooCoarse', '0,00345 ÷ (8/292) = 0,126 > 0,0667');
  const few = find(run({ camera: { widthPx: 640, heightPx: 480, sensorFormat: '1/3' } }), 'OPT-001');
  assert.equal(few.noteKey, 'cameraTooFewPixels', 'β can 0,0518 > β phu 0,0331');
});

test('OPT-001: WD gần hơn khoảng lấy nét của ống → FAIL; telecentric ngoài dải WD → FAIL; thiếu tiêu cự → chưa kiểm được', () => {
  assert.equal(find(run({ lens: { wdMinMm: 400 } }), 'OPT-001').noteKey, 'lensBelowMinFocus');
  const tele = find(run({ lens: { lensType: 'telecentric', focalLengthMm: null, magnification: 0.1, wdMinMm: 100, wdMaxMm: 120 } }), 'OPT-001');
  assert.equal(tele.noteKey, 'telecentricWdMismatch');
  const unknown = find(run({ lens: { focalLengthMm: null } }), 'OPT-001');
  assert.equal(unknown.status, 'info');
  assert.equal(unknown.evidence, 'unknown');
});

test('OPT-002: vòng ảnh và ngàm — C trên CS cần vòng đệm (MARGINAL), CS trên C và vòng ảnh nhỏ thì loại', () => {
  assert.equal(find(run(), 'OPT-002').status, 'pass');
  assert.equal(find(run({ lens: { imageCircleFormat: '1/2' } }), 'OPT-002').noteKey, 'imageCircleTooSmall');
  // Vòng ảnh mm theo datasheet thắng mã cỡ; 11 mm phủ 2/3" (11,0) trong dung sai làm tròn.
  const mm = find(run({ lens: { imageCircleMm: 10.9, imageCircleFormat: null } }), 'OPT-002');
  assert.equal(mm.status, 'pass');
  assert.equal(mm.marginRatio, null, 'ty le < 1 trong dung sai khong duoc cham FAIL');
  assert.equal(scoreResult(mm).status, 'PASS');

  const spacer = find(run({ camera: { mount: 'CS' } }), 'OPT-002');
  assert.equal(spacer.status, 'warn');
  assert.equal(spacer.noteKey, 'mountCsSpacer');
  assert.equal(find(run({ lens: { mount: 'CS' } }), 'OPT-002').noteKey, 'mountMismatch');
  assert.equal(find(run({ lens: { mount: 'F' } }), 'OPT-002').status, 'fail');

  const unknown = find(run({ lens: { imageCircleFormat: null } }), 'OPT-002');
  assert.deepEqual([unknown.status, unknown.evidence], ['info', 'unknown']);
});

test('OPT-003: cần 1000 ÷ (2 × pitch) lp/mm; ống thiếu số liệu chỉ cảnh báo khi pixel < 3 µm', () => {
  const ok = find(run(), 'OPT-003');
  assert.equal(ok.status, 'pass', '160 ≥ 144,9');
  assert.equal(find(run({ lens: { resolutionLpMm: 100 } }), 'OPT-003').status, 'warn');
  const unknown = find(run({ lens: { resolutionLpMm: null } }), 'OPT-003');
  assert.deepEqual([unknown.status, unknown.evidence], ['info', 'unknown']);
  const small = find(run({ camera: { pixelSizeUm: 2.4 }, lens: { resolutionLpMm: null } }), 'OPT-003');
  assert.equal(small.status, 'warn');
  assert.equal(small.noteKey, 'lensLpUnknownSmallPixel');
});

test('OPT-004: khẩu mở lớn nhất của ống phải ≤ F#max', () => {
  const ok = find(run(), 'OPT-004');
  assert.equal(ok.status, 'pass');
  assert.equal(ok.marginRatio, null, 'dat / khong dat, khong co bien');
  assert.equal(find(run({ lens: { fNumberMin: 8 } }), 'OPT-004').status, 'fail');
  assert.equal(find(run({ lens: { fNumberMin: null } }), 'OPT-004').evidence, 'unknown');
});

test('OPT-005: độ sâu ↔ nhiễu xạ — ≤ F#max đạt, ≤ 1,5× cảnh báo, hơn nữa là xung đột', () => {
  const ok = find(run(), 'OPT-005');
  assert.equal(ok.status, 'pass');
  assert.equal(ok.noteValues?.f, 1.4, 'F can 1,1 < F nho nhat cua ong 1,4 → dat F/1,4');

  // Δh 12 → F = 12 × 0,0909² ÷ (2 × 0,0069 × 1,0909) = 6,59 → 1,28 × F#max
  assert.equal(find(run({ analysis: { 'object.heightVariation': 12 } }), 'OPT-005').status, 'warn');
  // Δh 20 → F 10,98 → 2,13 × F#max
  const conflict = find(run({ analysis: { 'object.heightVariation': 20 } }), 'OPT-005');
  assert.deepEqual([conflict.status, conflict.noteKey], ['fail', 'dofConflict']);
  // Xung đột nhiễu xạ báo trước giới hạn khẩu của ống: đổi ống không giải được
  assert.equal(find(run({ analysis: { 'object.heightVariation': 20 }, lens: { fNumberMax: 8 } }), 'OPT-005').noteKey, 'dofConflict');
  // Δh 12 cần F/6,6 (trong dung sai nhiễu xạ) mà ống chỉ khép tới F/5,6 → không đạt vì ống
  assert.equal(find(run({ analysis: { 'object.heightVariation': 12 }, lens: { fNumberMax: 5.6 } }), 'OPT-005').noteKey, 'dofBeyondLensAperture');
});

test('OPT-009 + OPT-005: camera nghiêng 30° — độ sâu 60 × sin 30° = 30 mm dồn vào DOF, gợi ý Scheimpflug', () => {
  const analysis = analysisOf({ 'system.cameraTiltDeg': 30 });
  assert.ok(Math.abs(analysis.tiltDepthMm - 30) < 1e-9);
  const tilt = analysis.results.find((r) => r.ruleId === 'OPT-009')!;
  assert.equal(tilt.status, 'info', 'bai phat hien loi: chi ghi nhan');
  assert.equal(tilt.noteValues?.factor, 1.155);

  const results = run({ analysis: { 'system.cameraTiltDeg': 30 } });
  assert.equal(find(results, 'OPT-005').noteKey, 'dofConflictTilt', 'F can (2+30) → 17,6 = 3,4 × F#max');
  // Mục tiêu mm/px cạnh dài × cos 30° = 0,0577; ống 25 mm vẫn đạt 0,038
  assert.equal(find(results, 'OPT-001').status, 'pass');
});

test('OPT-009 ở tầng Yêu cầu: nhân 1/cos θ vào số pixel cạnh dài; bài đo thì cảnh báo hiệu chuẩn', () => {
  const flat = analysisOf();
  const tilted = analysisOf({ 'system.cameraTiltDeg': 30 });
  // 60 ÷ (0,0667 × 0,866) = 1040 px (thay vì 900) × 50 ÷ 0,0667 = 750 px
  assert.ok(Math.abs(flat.megapixelsPerCamera! - 0.675) < 1e-9, String(flat.megapixelsPerCamera));
  assert.ok(Math.abs(tilted.megapixelsPerCamera! - (1040 * 750) / 1e6) < 1e-9, String(tilted.megapixelsPerCamera));
  assert.equal(analysisOf({ 'system.cameraTiltDeg': 0 }).results.some((r) => r.ruleId === 'OPT-009'), false, '0° = vuong goc');

  const measuring = analyseRequirement(
    Object.entries({ 'object.sizeX': 60, 'object.sizeY': 50, 'measurement.0.tolerance': 0.05, 'system.cameraCount': 1, 'system.cameraTiltDeg': 20 }).reduce(
      (req, [path, value]) => withFieldValue(req, path, value),
      emptyRequirement('Measurement')
    )
  );
  const warn = measuring.results.find((r) => r.ruleId === 'OPT-009')!;
  assert.deepEqual([warn.status, warn.noteKey], ['warn', 'cameraTiltMeasurement']);
});

test('THR-003: 1 + 43,5 + 45,6 + 300* + 10 = 400 ms trong nhịp 2000 ms; sát nhịp cảnh báo, vượt nhịp FAIL', () => {
  const ok = find(run(), 'THR-003');
  assert.equal(ok.status, 'pass');
  // khung 1000/23 = 43,48 · truyền 5,01 MB ÷ 110 MB/s = 45,58 · xử lý GIẢ ĐỊNH 300
  assert.equal(ok.noteValues?.total, 400);
  assert.equal(ok.evidence, 'rule-of-thumb', 'xu ly la gia dinh');
  assert.match(ok.formula, /300\*/);

  assert.equal(find(run({ analysis: { 'production.partsPerMinute': 120 } }), 'THR-003').status, 'warn', 'nhip 500: du 20%');
  assert.equal(find(run({ analysis: { 'production.partsPerMinute': 200 } }), 'THR-003').status, 'fail', 'nhip 300 < 400');
  // Biến động cao → AI-002 → giả định 800 ms
  const dl = find(run({ analysis: { 'detection.0.variability': 'high' } }), 'THR-003');
  assert.equal(dl.noteValues?.process, CYCLE_DEFAULTS.processDeepLearningMs);
  // Line scan không dùng ngân sách này
  assert.equal(run({ camera: { cameraType: 'line', heightPx: 1 } }).some((r) => r.ruleId === 'THR-003'), false);
});

test('THR-004: core tối thiểu n+2 / khuyên dùng 2n+2, RAM ≥ 16 GB, LAN n+1 khi cắm thẳng, PCIe cho card', () => {
  const base = run();
  assert.equal(find(base, 'THR-004', 'ipcCores').status, 'pass', '4 ≥ 2×1+2');
  assert.equal(find(base, 'THR-004', 'ipcRam').status, 'pass');
  assert.equal(find(base, 'THR-004', 'ipcLan').status, 'pass', '2 ≥ 1+1');
  assert.equal(base.some((r) => r.key === 'ipcPcie'), false, 'khong card, khong GPU → khong kiem PCIe');

  assert.equal(find(run({ pc: { cpuCores: 3 } }), 'THR-004', 'ipcCores').status, 'warn');
  assert.equal(find(run({ pc: { cpuCores: 2 } }), 'THR-004', 'ipcCores').status, 'fail');
  assert.equal(find(run({ pc: { ramGb: 8 } }), 'THR-004', 'ipcRam').status, 'fail');
  assert.equal(find(run({ pc: { lanPorts: 1 } }), 'THR-004', 'ipcLan').status, 'fail');
  const withCard = run({ pc: { lanPorts: 1, pcieSlots: 0 }, cards: 1 });
  assert.equal(withCard.some((r) => r.key === 'ipcLan'), false, 'co card thi khong can LAN bo mach');
  assert.equal(find(withCard, 'THR-004', 'ipcPcie').status, 'fail');

  const dl = run({ analysis: { 'detection.0.variability': 'high' } });
  assert.equal(find(dl, 'THR-004', 'ipcGpu').status, 'warn');

  const blank = run({ pc: { cpuCores: null, ramGb: null, lanPorts: null } });
  const unknown = find(blank, 'THR-004', 'ipcUnknown');
  assert.equal(unknown.evidence, 'unknown');
  assert.match(unknown.formula, /cpu_cores/);
});

test('thiết bị thiếu thông số: gắn cờ chưa kiểm được, KHÔNG thành lý do loại (chốt Q4)', () => {
  const results = run({
    lens: { imageCircleFormat: null, fNumberMin: null, resolutionLpMm: null },
    pc: { cpuCores: null, ramGb: null, lanPorts: null, pcieSlots: null },
  });
  assert.deepEqual(blockingResults(results).map((r) => r.ruleId), []);
  const unchecked = uncheckedResults(results).map((r) => r.ruleId).sort();
  assert.deepEqual(unchecked, ['OPT-002', 'OPT-003', 'OPT-004', 'THR-004']);
});

test('bộ chuyển Component → cấu hình: đọc đúng khoá spec, line scan và định dạng màu', () => {
  const component = (kind: Component['kind'], spec: Record<string, unknown>): Component => ({
    id: 'x', code: 'X', kind, brand: 'B', model: 'M', spec, price_vnd: null, datasheet_url: null, source: 'datasheet', notes_vi: null, notes_en: null, is_active: true, sort_order: 0,
  });
  const cam = cameraFromComponent(component('camera', { camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, color: 'color', interface: 'GigE' }));
  assert.equal(cam.bytesPerPx, 1, 'mau → Bayer 1 byte');
  assert.equal(cameraFromComponent(component('camera', { color: 'color', pixel_format: 'RGB8' })).bytesPerPx, 3);
  const line = cameraFromComponent(component('camera', { camera_type: 'line', line_width_px: 4096, pixel_size_um: 7 }));
  assert.deepEqual([line.cameraType, line.widthPx, line.heightPx], ['line', 4096, 1]);

  const lens = lensFromComponent(component('lens', { lens_type: 'telecentric', magnification: 0.5, image_circle: '2/3', f_number_min: 8 }));
  assert.deepEqual([lens.lensType, lens.magnification, lens.imageCircleFormat, lens.fNumberMin], ['telecentric', 0.5, '2/3', 8]);
  const pc = pcFromComponent(component('controller', { cpu_cores: 12, ram_gb: 32, pcie_slots: 2, lan_ports: 2 }));
  assert.deepEqual(pc, { cpuCores: 12, ramGb: 32, pcieSlots: 2, lanPorts: 2, gpu: null });
});

test('mọi khoá tên bước và câu diễn giải của tầng Cấu hình có đủ vi/en', () => {
  const scenarios = [
    run(),
    run({ lens: { focalLengthMm: 50 } }),
    run({ lens: { focalLengthMm: 8, mount: 'CS', imageCircleFormat: null, resolutionLpMm: null, fNumberMin: 8 } }),
    run({ camera: { widthPx: 640, heightPx: 480, mount: 'CS', pixelSizeUm: 2.4 }, lens: { resolutionLpMm: null, fNumberMin: null } }),
    run({ lens: { wdMinMm: 400, resolutionLpMm: 100 } }),
    run({ lens: { lensType: 'telecentric', magnification: 0.1, wdMinMm: 100, wdMaxMm: 120 } }),
    run({ lens: { focalLengthMm: null, imageCircleFormat: '1/2' } }),
    run({ analysis: { 'object.heightVariation': 12, 'production.partsPerMinute': 120 } }),
    run({ analysis: { 'object.heightVariation': 20, 'production.partsPerMinute': 200, 'detection.0.variability': 'high' }, pc: { cpuCores: 3, ramGb: 8, lanPorts: 1 } }),
    run({ analysis: { 'object.heightVariation': 12 }, lens: { fNumberMax: 5.6 }, pc: { cpuCores: 2, pcieSlots: 0 }, cards: 1 }),
    run({ analysis: { 'system.cameraTiltDeg': 30 }, pc: { cpuCores: null } }),
  ].flat();
  const tiltResults = [analysisOf({ 'system.cameraTiltDeg': 30 }).results, analyseRequirement(
    Object.entries({ 'object.sizeX': 60, 'object.sizeY': 50, 'measurement.0.tolerance': 0.05, 'system.cameraCount': 1, 'system.cameraTiltDeg': 20 }).reduce(
      (req, [path, value]) => withFieldValue(req, path, value),
      emptyRequirement('Measurement')
    )
  ).results].flat().filter((r) => r.ruleId === 'OPT-009');
  const all = [...scenarios, ...tiltResults];

  const noteKeys = new Set(all.map((r) => r.noteKey).filter(Boolean));
  for (const expected of ['lensFovTooSmall', 'lensTooCoarse', 'cameraTooFewPixels', 'lensBelowMinFocus', 'telecentricWdMismatch', 'mountCsSpacer', 'mountMismatch', 'dofConflict', 'dofBeyondLensAperture', 'dofConflictTilt', 'cycleOver', 'cycleTight', 'ipcCoresShort', 'ipcRamShort', 'ipcLanShort', 'ipcPcieShort', 'ipcGpuMissing', 'ipcSpecsIncomplete', 'cameraTiltMeasurement']) {
    assert.ok(noteKeys.has(expected), `kich ban chua phu ${expected}`);
  }

  for (const locale of ['vi', 'en']) {
    const vision = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8')).selector.vision;
    for (const result of all) {
      assert.ok(vision.checks[result.key], `${locale}: thieu checks.${result.key}`);
      if (result.noteKey) assert.ok(vision.notes[result.noteKey], `${locale}: thieu notes.${result.noteKey}`);
    }
  }
});
