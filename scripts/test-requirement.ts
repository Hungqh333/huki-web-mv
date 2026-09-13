/**
 * Requirement layer V1a (hạng mục 4): schema, bảng tóm tắt, bản nháp, adapter
 * sang bộ chọn cũ.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  REQUIREMENT_SECTIONS,
  V1A_FIELDS,
  changeApplicationType,
  countFilled,
  emptyRequirement,
  fieldsFor,
  readField,
  withFieldValue,
} from '../src/lib/requirement/fields';
import {
  REQUIREMENT_ROUTE,
  parseDraft,
  startDraftFromApp,
  startDraftFromText,
} from '../src/lib/requirement/draft';
import { requirementToSelectorInput } from '../src/lib/requirement/toSelectorInput';
import type { Requirement } from '../src/lib/requirement/types';
import { FIELD_CATALOG } from '../src/lib/selector/fields';
import { APPLICATION_TYPES } from '../src/lib/visionEntry';

function loadMessages(locale: 'vi' | 'en') {
  return JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
}

/** Mọi Field lá trong requirement. */
function leaves(node: unknown, path = ''): { path: string; field: { value: unknown; confidence: string } }[] {
  if (!node || typeof node !== 'object') return [];
  if ('confidence' in node && 'value' in node) return [{ path, field: node as never }];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
}

function filled(type: Requirement['applicationType'], values: Record<string, unknown>): Requirement {
  return Object.entries(values).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(type));
}

test('requirement rỗng: mọi thông số là Field chưa có giá trị', () => {
  const req = emptyRequirement('AppearanceInspection');
  const all = leaves(req);
  assert.ok(all.length >= 30, `it nhat 30 Field, co ${all.length}`);
  for (const { path, field } of all) {
    assert.equal(field.value, null, path);
    assert.equal(field.confidence, 'unknown', path);
  }
});

test('schema có thêm variability (AI-002) và perspectiveFree (OPT-006)', () => {
  const req = emptyRequirement('AppearanceInspection');
  assert.ok(readField(req, 'detection.0.variability'));
  assert.ok(readField(req, 'measurement.0.perspectiveFree'));
});

test('mảng detection/measurement: V1a một phần tử, nhánh không có thì rỗng', () => {
  const appearance = emptyRequirement('AppearanceInspection');
  assert.equal(appearance.detection.length, 1);
  assert.equal(appearance.measurement.length, 1);

  const measurement = emptyRequirement('Measurement');
  assert.equal(measurement.detection.length, 0);
  assert.equal(measurement.measurement.length, 1);

  const robot = emptyRequirement('RobotGuidance');
  assert.equal(robot.detection.length, 0);
  assert.equal(robot.measurement.length, 0);
});

test('bảng tóm tắt chỉ hiện nhánh mà loại ứng dụng có, và mọi ô đều đọc được', () => {
  const sections = (type: Requirement['applicationType']) => new Set(fieldsFor(type).map((d) => d.section));

  assert.deepEqual([...sections('AppearanceInspection')].sort(), [...REQUIREMENT_SECTIONS].sort());
  assert.ok(!sections('Measurement').has('detection'));
  assert.ok(sections('Measurement').has('measurement'));
  assert.ok(!sections('Other').has('detection') && !sections('Other').has('measurement'));

  for (const type of APPLICATION_TYPES) {
    const req = emptyRequirement(type);
    for (const def of fieldsFor(type)) assert.ok(readField(req, def.path), `${type}: ${def.path}`);
  }
});

test('sửa một ô → "stated"; xoá trắng → "unknown"; object cũ không bị đổi', () => {
  const before = emptyRequirement('Measurement');
  const after = withFieldValue(before, 'measurement.0.tolerance', 0.1);

  assert.equal(readField(after, 'measurement.0.tolerance')!.value, 0.1);
  assert.equal(readField(after, 'measurement.0.tolerance')!.confidence, 'stated');
  assert.equal(readField(before, 'measurement.0.tolerance')!.value, null, 'khong sua object cu');

  const cleared = withFieldValue(after, 'measurement.0.tolerance', '');
  assert.equal(readField(cleared, 'measurement.0.tolerance')!.confidence, 'unknown');
  assert.equal(withFieldValue(after, 'khong.ton.tai', 1), after, 'duong dan sai thi giu nguyen');

  assert.deepEqual(countFilled(after), { filled: 1, total: fieldsFor('Measurement').length });
});

test('đổi loại ứng dụng giữ phần chung đã nhập', () => {
  const measurement = filled('Measurement', { 'object.sizeX': 380, 'measurement.0.tolerance': 0.1 });
  const appearance = changeApplicationType(measurement, 'AppearanceInspection');

  assert.equal(appearance.applicationType, 'AppearanceInspection');
  assert.equal(readField(appearance, 'object.sizeX')!.value, 380);
  assert.equal(readField(appearance, 'measurement.0.tolerance')!.value, 0.1, 'loai moi van co nhanh do');
  assert.equal(appearance.detection.length, 1, 'nhanh phat hien loi moi tao');

  const robot = changeApplicationType(appearance, 'RobotGuidance');
  assert.equal(robot.measurement.length, 0);
  assert.equal(readField(robot, 'object.sizeX')!.value, 380);
});

test('bản nháp: văn bản không qua URL, dữ liệu hỏng thì bỏ', () => {
  assert.equal(REQUIREMENT_ROUTE, '/thiet-ke-he-thong/yeu-cau');

  const fromText = startDraftFromText('  kiểm tra 380 × 280 mm  ', 1);
  assert.equal(fromText.rawText, 'kiểm tra 380 × 280 mm');
  assert.equal(fromText.requirement, null, 'chua co parser thi chua co loai ung dung');
  assert.deepEqual(parseDraft(JSON.stringify(fromText)), fromText);

  const fromApp = startDraftFromApp('Measurement');
  assert.equal(fromApp.startedFrom, 'app:Measurement');
  assert.deepEqual(parseDraft(JSON.stringify(fromApp)), fromApp);

  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft('{khong phai json'), null);
  assert.equal(parseDraft(JSON.stringify({ ...fromApp, version: 2 })), null);
  assert.equal(
    parseDraft(JSON.stringify({ ...fromApp, requirement: { ...fromApp.requirement, applicationType: 'Laser' } })),
    null
  );
  const oldSchema = JSON.parse(JSON.stringify(fromApp)) as { requirement: { measurement: Record<string, unknown>[] } };
  delete oldSchema.requirement.measurement[0].perspectiveFree;
  assert.equal(parseDraft(JSON.stringify(oldSchema)), null, 'ban nhap schema cu');
});

test('adapter: ngoại quan kiểu GT-001 → đúng khoá form bộ chọn', () => {
  const req = filled('AppearanceInspection', {
    'object.sizeX': 380,
    'object.sizeY': 280,
    'object.surface': 'glossy',
    'object.heightVariation': 2,
    'detection.0.minSize': 0.5,
    'detection.0.contrast': 'unknown',
    'detection.0.variability': 'high',
    'measurement.0.tolerance': 0.1,
    'measurement.0.crossesCameraSeam': true,
    'production.motion': 'continuous',
    'system.workingDistance': 300,
    'environment.conditions': ['dust', 'clean'],
  });
  const { taskSlug, input, assumptions, warnings } = requirementToSelectorInput(req);

  assert.equal(taskSlug, 'appearance-inspection');
  assert.deepEqual(input, {
    fov_width_mm: 380,
    fov_height_mm: 280,
    surface: 'reflective',
    height_tolerance_mm: 2,
    defect_min_size_mm: 0.5,
    defect_variability: 'high',
    measurement_tolerance_mm: 0.1,
    capture_mode: 'moving_area',
    working_distance_mm: 300,
    environment: ['dust'],
  });
  assert.deepEqual(warnings, []);

  const fov = assumptions.find((a) => a.key === 'fovEqualsObject');
  assert.ok(fov, 'phai ghi gia dinh FOV = kich thuoc vat');
  assert.ok(fov.vi.includes('chưa tính dung sai định vị'), fov.vi);
});

test('adapter: đo 2D dùng tolerance_mm, measure_type, perspective_free', () => {
  const req = filled('Measurement', {
    'object.sizeX': 100,
    'measurement.0.tolerance': 0.05,
    'measurement.0.feature': 'diameter',
    'measurement.0.perspectiveFree': true,
  });
  const { taskSlug, input } = requirementToSelectorInput(req);
  assert.equal(taskSlug, '2d-measurement');
  assert.equal(input.tolerance_mm, 0.05);
  assert.equal(input.measure_type, 'diameter');
  assert.equal(input.perspective_free, true);
  assert.ok(!('measurement_tolerance_mm' in input));
  assert.ok(!('fov_height_mm' in input), 'chua nhap thi khong dien');
});

test('adapter: nhiều phần tử thì lấy chặt nhất KÈM cảnh báo', () => {
  const req = filled('AppearanceInspection', { 'measurement.0.tolerance': 0.1, 'detection.0.minSize': 0.5 });
  req.measurement.push({ ...structuredClone(req.measurement[0]), id: 'meas-2' });
  req.measurement[1].tolerance.value = 0.05;
  req.detection.push({ ...structuredClone(req.detection[0]), id: 'det-2' });
  req.detection[1].minSize.value = 0.3;

  const { input, warnings } = requirementToSelectorInput(req);
  assert.equal(input.measurement_tolerance_mm, 0.05);
  assert.equal(input.defect_min_size_mm, 0.3);
  assert.deepEqual(warnings.map((w) => w.key).sort(), ['detectionReducedToMin', 'measurementReducedToMin']);
});

test('adapter: điều kiện "dầu" chưa có ở bộ chọn thì báo, không lẳng lặng bỏ', () => {
  const req = filled('Measurement', { 'environment.conditions': ['oil'] });
  const { input, warnings } = requirementToSelectorInput(req);
  assert.ok(!('environment' in input));
  assert.deepEqual(warnings.map((w) => w.key), ['oilNotInSelector']);
});

test('adapter chỉ sinh khoá và giá trị form bộ chọn chấp nhận', () => {
  const req = filled('AppearanceInspection', {
    'object.sizeX': 1, 'object.sizeY': 1, 'object.colorInspection': true, 'object.heightVariation': 1,
    'detection.0.minSize': 0.1, 'detection.0.defectType': 'scratch', 'detection.0.variability': 'low',
    'measurement.0.tolerance': 0.1, 'production.partsPerMinute': 60, 'production.motion': 'static',
    'production.conveyorSpeed': 100, 'system.workingDistance': 200,
    'environment.conditions': ['vibration', 'highTemp', 'variableLight', 'dust'], 'environment.ipRequirement': 'ip65',
  });
  const measurement = filled('Measurement', { 'measurement.0.tolerance': 0.1, 'measurement.0.feature': 'angle' });

  for (const surface of ['matte', 'glossy', 'metallic', 'black', 'transparent', 'mixed']) {
    for (const source of [withFieldValue(req, 'object.surface', surface), measurement]) {
      const { input } = requirementToSelectorInput(source);
      for (const [key, value] of Object.entries(input)) {
        const def = FIELD_CATALOG[key];
        assert.ok(def, `khoa ${key} khong co trong catalog form`);
        if (def.options) {
          const allowed = def.options.map((o) => o.value);
          for (const v of Array.isArray(value) ? value : [value]) assert.ok(allowed.includes(v as string), `${key}=${v}`);
        }
      }
    }
  }
});

test('nhãn bảng tóm tắt đủ ở cả hai ngôn ngữ', () => {
  for (const locale of ['vi', 'en'] as const) {
    const r = loadMessages(locale).designer.requirement;
    for (const key of ['step', 'title', 'subtitle', 'applicationType', 'progress', 'reset', 'notSet', 'yes', 'no']) {
      assert.ok(r[key], `${locale}: ${key}`);
    }
    for (const c of ['stated', 'inferred', 'assumed', 'unknown']) assert.ok(r.confidence[c], `${locale}: confidence.${c}`);
    for (const s of REQUIREMENT_SECTIONS) assert.ok(r.sections[s], `${locale}: sections.${s}`);
    for (const def of V1A_FIELDS) {
      assert.ok(r.fields[def.section]?.[def.key], `${locale}: fields.${def.section}.${def.key}`);
      for (const option of def.options ?? []) {
        assert.ok(r.options[def.optionsKey!]?.[option], `${locale}: options.${def.optionsKey}.${option}`);
      }
    }
  }
});
