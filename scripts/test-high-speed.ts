/**
 * Tốc độ cao — đợt 1 (chốt 2026-10-26): THR-006 số ảnh/giây · THR-007 lệch vị trí khi
 * trigger · LGT-024 đủ sáng ở thời gian phơi ngắn · THR-008 độ trễ tới điểm gạt, và
 * THR-003 đổi sang khâu chậm nhất (Q5).
 *
 * Bài chuẩn (số tính tay ghi cạnh từng assert):
 *   vật 60 × 50 mm, 1 camera, lỗi 0,15 mm tương phản cao → 3 px → 0,05 mm/px,
 *   chạy liên tục 1000 mm/s, 60 sản phẩm/phút.
 *   → t_max = 0,5 × 0,05 ÷ 1000 = 25 µs (LGT-008: < 50 µs → strobe).
 *   Camera 2448 × 2048, 23 fps, GigE → khung 43,48 ms · truyền 5,01 MB ÷ 110 = 45,58 ms.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { applyDefaults } from '../src/lib/requirement/assumptions';
import { FIELDS_ADDED_AFTER_V2, parseDraft, startDraftFromApp } from '../src/lib/requirement/draft';
import { emptyRequirement, readField, withFieldValue } from '../src/lib/requirement/fields';
import { QUESTIONS } from '../src/lib/requirement/questions';
import { RULE_PURPOSE } from '../src/lib/requirement/purposes';
import type { Component } from '../src/lib/components/specs';
import { evaluateConfiguration, type ConfigCamera } from '../src/lib/vision/configurationRules';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';
import { cameraRequirementChecks } from '../src/lib/vision/equipmentFilter';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import type { RuleResult } from '../src/lib/vision/rules';

const BASE = {
  'object.sizeX': 60,
  'object.sizeY': 50,
  'object.surface': 'matte',
  'detection.0.minSize': 0.15,
  'detection.0.contrast': 'high',
  'detection.0.variability': 'low',
  'production.partsPerMinute': 60,
  'production.motion': 'continuous',
  'production.conveyorSpeed': 1000,
  'system.cameraCount': 1,
  'system.workingDistance': 300,
};

const reqOf = (overrides: Record<string, unknown> = {}) =>
  Object.entries({ ...BASE, ...overrides })
    .filter(([, value]) => value !== undefined)
    .reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement('AppearanceInspection'));
const analysisOf = (overrides: Record<string, unknown> = {}) => analyseRequirement(reqOf(overrides));
const rule = (results: RuleResult[], id: string) => results.find((r) => r.ruleId === id);

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
const config = (overrides: Record<string, unknown> = {}, camera: Partial<ConfigCamera> = {}) =>
  evaluateConfiguration({ analysis: analysisOf(overrides), camera: { ...CAMERA, ...camera } });

const cameraComponent = (spec: Record<string, unknown>): Component => ({
  id: 'cam',
  code: 'CAM',
  kind: 'camera',
  brand: 'Test',
  model: 'CAM',
  spec: { camera_type: 'area', resolution_w_px: 2448, resolution_h_px: 2048, pixel_size_um: 3.45, sensor_format: '2/3', mount: 'C', interface: 'GigE', shutter: 'global', trigger_io: 'yes', ...spec },
  price_vnd: null,
  datasheet_url: null,
  source: 'datasheet',
  notes_vi: null,
  notes_en: null,
  is_active: true,
  sort_order: 0,
});

test('bài chuẩn: t_max 25 µs, strobe bắt buộc, 1 ảnh/giây', () => {
  const a = analysisOf();
  assert.ok(Math.abs(a.exposureMaxUs! - 25) < 1e-9, String(a.exposureMaxUs));
  assert.equal(rule(a.results, 'LGT-008')?.status, 'warn');
  assert.deepEqual([a.imagesPerPart, a.framesPerSecondNeeded], [1, 1]);
  assert.deepEqual([a.conveyorSpeedMmS, a.rejectDistanceMm], [1000, null]);
});

test('THR-006: fps cần = ảnh/sản phẩm × ppm ÷ 60; lọc camera theo fps tối đa', () => {
  const thr = rule(analysisOf({ 'production.imagesPerPart': 3 }).results, 'THR-006')!;
  assert.equal(thr.status, 'info');
  assert.equal(thr.noteValues?.fps, 3);
  assert.match(thr.formula, /^3 × 60 ÷ 60 = 3 /);

  const check = (ppm: number, spec: Record<string, unknown> = { max_fps: 23 }) =>
    rule(cameraRequirementChecks(analysisOf({ 'production.partsPerMinute': ppm }), cameraComponent(spec)), 'THR-006')!;
  assert.equal(check(600).status, 'pass', '10 ≤ 23 × 0,7 = 16,1');
  assert.deepEqual([check(1000).status, check(1000).noteKey], ['warn', 'cameraFpsTight'], '16,7 > 16,1');
  assert.deepEqual([check(1500).status, check(1500).noteKey], ['fail', 'cameraFpsTooLow'], '25 > 23');
  assert.deepEqual([check(600, {}).status, check(600, {}).evidence], ['info', 'unknown'], 'chua khai fps');

  // THR-001 và băng thông camera nhân số ảnh mỗi sản phẩm.
  const one = analysisOf({ 'production.partsPerMinute': 600 }).dataRateTotalMBs!;
  const two = analysisOf({ 'production.partsPerMinute': 600, 'production.imagesPerPart': 2 }).dataRateTotalMBs!;
  assert.ok(Math.abs(two - 2 * one) < 1e-9);
});

test('THR-007: Δx = v × sai lệch trigger; quá 5 % cạnh ngắn → cảnh báo; encoder → đạt', () => {
  // Giả định 0,5 ms → 1000 × 0,5 ÷ 1000 = 0,5 mm = 10 px · 0,5 ÷ 50 = 1 % ≤ 5 %
  const ok = rule(analysisOf().results, 'THR-007')!;
  assert.deepEqual([ok.status, ok.noteKey, ok.noteValues?.shift, ok.noteValues?.px, ok.noteValues?.margin], ['pass', 'triggerShiftOk', 0.5, 10, 1]);
  assert.ok(ok.inputsAssumed.some((i) => i.path === 'production.triggerJitterMs'), 'sai lech la gia dinh');

  // 3 ms → 3 mm = 6 % > 5 %
  const high = rule(analysisOf({ 'production.triggerJitterMs': 3 }).results, 'THR-007')!;
  assert.deepEqual([high.status, high.noteKey, high.noteValues?.shift], ['warn', 'triggerShiftHigh', 3]);

  const encoder = rule(analysisOf({ 'production.triggerSource': 'encoder' }).results, 'THR-007')!;
  assert.deepEqual([encoder.status, encoder.noteKey], ['pass', 'triggerEncoder']);

  assert.equal(rule(analysisOf({ 'production.motion': 'indexed' }).results, 'THR-007'), undefined, 'khong chay lien tuc thi khong kiem');
});

test('LGT-024: hệ số sáng = phơi lúc chụp mẫu ÷ t_max; duty = t_max × fps', () => {
  // Ước tính 1 ms → 1000 ÷ 25 = ×40 > ×10 → chỉ CẢNH BÁO vì là ước tính
  const assumed = rule(analysisOf().results, 'LGT-024')!;
  assert.deepEqual([assumed.status, assumed.noteKey, assumed.noteValues?.boost, assumed.evidence], ['warn', 'lightBoostTooHigh', 40, 'requires-sample-test']);

  // Cùng số nhưng là số THẬT → LOẠI
  const stated = rule(analysisOf({ 'production.sampleExposureMs': 1 }).results, 'LGT-024')!;
  assert.deepEqual([stated.status, stated.noteKey], ['fail', 'lightBoostTooHigh']);

  // 0,2 ms → ×8 ≤ ×10 → cần overdrive · duty 25 µs × 1 = 0,0025 %
  const overdrive = rule(analysisOf({ 'production.sampleExposureMs': 0.2 }).results, 'LGT-024')!;
  assert.deepEqual([overdrive.status, overdrive.noteKey, overdrive.noteValues?.boost, overdrive.noteValues?.duty], ['warn', 'lightNeedsOverdrive', 8, '< 0.01']);

  // 20 µs < 25 µs → đèn liên tục đủ
  assert.equal(rule(analysisOf({ 'production.sampleExposureMs': 0.02 }).results, 'LGT-024')!.noteKey, 'lightContinuousOk');

  // Chậm 10 mm/s → t_max 2500 µs; mẫu 5 ms → ×2; 3000 sp/phút = 50 ảnh/s → duty 12,5 % > 10 % → LOẠI
  const duty = rule(analysisOf({ 'production.conveyorSpeed': 10, 'production.partsPerMinute': 3000, 'production.sampleExposureMs': 5 }).results, 'LGT-024')!;
  assert.deepEqual([duty.status, duty.noteKey, duty.noteValues?.duty], ['fail', 'lightDutyTooHigh', '12.5']);
});

test('THR-003 khâu chậm nhất, THR-008 độ trễ tới điểm gạt', () => {
  // THR-003: 1 × max(43,48; 45,58; 300*) = 300 ms vs nhịp 1000 ms → đạt
  const base = config();
  assert.deepEqual([rule(base, 'THR-003')!.status, rule(base, 'THR-003')!.noteValues?.total], ['pass', 300]);
  // Chưa có khoảng cách → chưa kiểm được
  assert.deepEqual([rule(base, 'THR-008')!.status, rule(base, 'THR-008')!.evidence], ['info', 'unknown']);

  // trễ = 1 + 43,48 + 45,58 + 300 × 1,5 + 10 + 20 (cơ cấu gạt giả định) = 570 ms
  const late = rule(config({ 'production.rejectDistance': 300 }), 'THR-008')!;
  assert.deepEqual([late.status, late.noteKey, late.noteValues?.latency, late.noteValues?.budget], ['fail', 'rejectTooLate', 570, 300]);
  assert.ok(late.inputsAssumed.some((i) => i.path === 'production.rejectActuationMs'));
  assert.deepEqual([rule(config({ 'production.rejectDistance': 750 }), 'THR-008')!.noteKey], ['rejectTight'], 'du 24 % < 30 %');
  assert.deepEqual([rule(config({ 'production.rejectDistance': 1000 }), 'THR-008')!.noteKey], ['rejectWithin'], 'du 43 %');

  // Ngưỡng admin: hệ số lần chậm 1 → 420 ms
  const p = { ...DEFAULT_ENGINE_PARAMS, processWorstFactor: 1 };
  const custom = evaluateConfiguration({ analysis: analyseRequirement(reqOf({ 'production.rejectDistance': 300 }), p), camera: CAMERA });
  assert.equal(rule(custom, 'THR-008')!.noteValues?.latency, 420);

  assert.equal(rule(config({ 'production.motion': 'indexed' }), 'THR-008'), undefined, 'chi khi chay lien tuc');
});

test('ngưỡng admin thay hằng số: k_blur, ngưỡng strobe', () => {
  const p = { ...DEFAULT_ENGINE_PARAMS, blurPxAllowed: 1, strobeExposureLimitUs: 40 };
  const a = analyseRequirement(reqOf(), p);
  assert.ok(Math.abs(a.exposureMaxUs! - 50) < 1e-9, '1 × 0,05 ÷ 1000 = 50 µs');
  assert.equal(rule(a.results, 'LGT-008'), undefined, '50 ≥ 40 → khong bat strobe');
});

test('giả định tốc độ cao chỉ áp khi có điều kiện', () => {
  const paths = (overrides: Record<string, unknown>) => applyDefaults(reqOf(overrides)).assumptions.map((x) => x.path);
  const moving = paths({});
  for (const path of ['production.imagesPerPart', 'production.triggerSource', 'production.triggerJitterMs', 'production.sampleExposureMs']) {
    assert.ok(moving.includes(path), path);
  }
  assert.ok(!moving.includes('production.rejectActuationMs'), 'chua co khoang cach gat');
  assert.ok(paths({ 'production.rejectDistance': 500 }).includes('production.rejectActuationMs'));
  assert.ok(!paths({ 'production.triggerSource': 'encoder' }).includes('production.triggerJitterMs'), 'encoder khong can sai lech cam bien');

  const still = paths({ 'production.motion': 'static', 'production.conveyorSpeed': undefined });
  assert.deepEqual(still.filter((p) => p?.startsWith('production.') && p !== 'production.imagesPerPart'), [], 'dung yen: khong gia dinh trigger / phoi mau');
  assert.ok(!paths({ 'production.partsPerMinute': undefined }).includes('production.imagesPerPart'), 'chua co san luong');
});

test('bản nháp lưu trước khi có ô tốc độ cao vẫn mở được', () => {
  const draft = startDraftFromApp('AppearanceInspection');
  const production = draft.requirement!.production as Record<string, unknown>;
  for (const path of FIELDS_ADDED_AFTER_V2.filter((p) => p.startsWith('production.'))) delete production[path.split('.')[1]];
  const parsed = parseDraft(JSON.stringify(draft));
  assert.ok(parsed, 'khong bi loai');
  assert.equal(readField(parsed!.requirement!, 'production.imagesPerPart')?.value, null);
});

test('câu hỏi, mục đích và chữ vi/en cho các luật mới', () => {
  for (const id of ['THR-006', 'THR-007', 'THR-008', 'LGT-024']) assert.ok(RULE_PURPOSE[id], id);
  const ids = QUESTIONS.map((q) => q.id);
  for (const id of ['imagesPerPart', 'triggerSource', 'rejectDistance', 'sampleExposure']) assert.ok(ids.includes(id), id);

  const notes = [
    'frameRateNeeded', 'triggerEncoder', 'triggerShiftOk', 'triggerShiftHigh', 'lightContinuousOk', 'lightNeedsOverdrive', 'lightBoostTooHigh', 'lightDutyTooHigh',
    'cameraFpsTooLow', 'cameraFpsTight', 'cameraFpsUnknown', 'rejectDistanceUnknown', 'rejectWithin', 'rejectTight', 'rejectTooLate',
  ];
  const params = ['blurPxAllowed', 'strobeExposureLimitUs', 'cycleTriggerMs', 'cycleIoMs', 'processWorstFactor', 'triggerShiftMaxShare', 'strobeBoostMax', 'strobeMaxDuty'];
  for (const locale of ['vi', 'en']) {
    const m = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of notes) assert.ok(m.selector.vision.notes[key], `${locale} notes.${key}`);
    for (const key of ['frameRateNeeded', 'triggerShift', 'lightBudget', 'rejectLatency']) assert.ok(m.selector.vision.checks[key], `${locale} checks.${key}`);
    for (const key of params) assert.ok(m.admin.engine.params[key], `${locale} params.${key}`);
    for (const key of ['imagesPerPart', 'triggerSource', 'triggerJitterMs', 'rejectDistance', 'rejectActuationMs', 'sampleExposureMs']) {
      assert.ok(m.designer.requirement.fields.production[key], `${locale} fields.${key}`);
    }
    for (const key of ['imagesPerPart', 'triggerSource', 'triggerJitterMs', 'rejectActuationMs', 'sampleExposureMs']) {
      assert.ok(m.admin.tables.defaults.rows[key], `${locale} defaults.rows.${key}`);
    }
    assert.deepEqual(Object.keys(m.designer.requirement.options.triggerSource), ['photoSensor', 'encoder']);
  }
});
