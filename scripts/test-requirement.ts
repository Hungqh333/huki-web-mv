/**
 * Requirement layer V1a (hạng mục 4): schema, bảng tóm tắt, bản nháp, adapter
 * sang bộ chọn cũ. Hạng mục 6: mặc định §3.3 + panel Assumptions. Hạng mục 5:
 * câu hỏi bổ sung.
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
  MATERIALS,
  readField,
  withFieldUnknown,
  withFieldValue,
} from '../src/lib/requirement/fields';
import {
  REQUIREMENT_ROUTE,
  parseDraft,
  startDraftFromApp,
  startDraftFromText,
} from '../src/lib/requirement/draft';
import { requirementToSelectorInput } from '../src/lib/requirement/toSelectorInput';
import { applyDefaults, defaultAssumptionKey, resolveAssumptions } from '../src/lib/requirement/assumptions';
import { FIELD_DEFAULTS, MATERIAL_ALPHA, N_DET_BY_CONTRAST } from '../src/lib/requirement/defaults';
import { PURPOSES, RULE_PURPOSE } from '../src/lib/requirement/purposes';
import {
  MAX_VISIBLE_QUESTIONS,
  NEED_LEVELS,
  QUESTIONS,
  answerUnknown,
  countByNeed,
  needsFor,
  pendingPaths,
  pendingQuestions,
  questionStatus,
  resetQuestion,
} from '../src/lib/requirement/questions';
import type { Requirement } from '../src/lib/requirement/types';
import { FIELD_CATALOG } from '../src/lib/selector/fields';
import { DEFAULT_PX_PER_DEFECT, GRR_DIVISOR, K_SUBPIXEL } from '../src/lib/vision/resolution';
import { APPLICATION_TYPES } from '../src/lib/visionEntry';

function loadMessages(locale: 'vi' | 'en') {
  return JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8'));
}

/** Mọi Field lá trong requirement. */
function leaves(node: unknown, path = ''): { path: string; field: { value: unknown; confidence?: string } }[] {
  if (!node || typeof node !== 'object') return [];
  if ('value' in node) return [{ path, field: node as never }];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
}

function filled(type: Requirement['applicationType'], values: Record<string, unknown>): Requirement {
  return Object.entries(values).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(type));
}

test('requirement rỗng: mọi thông số là Field chưa hỏi (không có confidence)', () => {
  const req = emptyRequirement('AppearanceInspection');
  const all = leaves(req);
  assert.ok(all.length >= 30, `it nhat 30 Field, co ${all.length}`);
  for (const { path, field } of all) {
    assert.equal(field.value, null, path);
    assert.equal(field.confidence, undefined, path);
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

test('sửa một ô → "stated"; xoá trắng → chưa hỏi; object cũ không bị đổi', () => {
  const before = emptyRequirement('Measurement');
  const after = withFieldValue(before, 'measurement.0.tolerance', 0.1);

  assert.equal(readField(after, 'measurement.0.tolerance')!.value, 0.1);
  assert.equal(readField(after, 'measurement.0.tolerance')!.confidence, 'stated');
  assert.equal(readField(before, 'measurement.0.tolerance')!.value, null, 'khong sua object cu');

  const cleared = withFieldValue(after, 'measurement.0.tolerance', '');
  assert.equal(readField(cleared, 'measurement.0.tolerance')!.confidence, undefined);
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
  assert.equal(parseDraft(JSON.stringify({ ...fromApp, version: 3 })), null);
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
    for (const key of [
      'step', 'title', 'subtitle', 'applicationType', 'progress', 'reset', 'notSet', 'yes', 'no',
      'needLegend', 'missingOnly', 'missingOnlyNone',
    ]) {
      assert.ok(r[key], `${locale}: ${key}`);
    }
    for (const level of NEED_LEVELS) assert.ok(r.need?.[level], `${locale}: need.${level}`);
    for (const c of ['stated', 'inferred', 'assumed', 'unknown', 'notAsked']) assert.ok(r.confidence[c], `${locale}: confidence.${c}`);
    for (const s of REQUIREMENT_SECTIONS) assert.ok(r.sections[s], `${locale}: sections.${s}`);
    for (const def of V1A_FIELDS) {
      assert.ok(r.fields[def.section]?.[def.key], `${locale}: fields.${def.section}.${def.key}`);
      for (const option of def.options ?? []) {
        assert.ok(r.options[def.optionsKey!]?.[option], `${locale}: options.${def.optionsKey}.${option}`);
      }
    }
  }
});

// ───────────────────────────── Hạng mục 6: giả định ─────────────────────────────

test('mặc định §3.3: mỗi giá trị trỏ tới ô có trên bảng và là giá trị ô đó chấp nhận', () => {
  for (const d of FIELD_DEFAULTS) {
    const def = V1A_FIELDS.find((f) => f.path === d.path);
    assert.ok(def, `${d.path} khong co o tren bang — gia dinh khong sua duoc`);
    if (def.kind === 'select') assert.ok(def.options!.includes(d.value as string), `${d.path}=${d.value}`);
    if (def.kind === 'number') {
      assert.equal(typeof d.value, 'number', d.path);
      assert.ok(def.min === undefined || (d.value as number) >= def.min, d.path);
    }
    assert.ok(d.ruleIds.length > 0 && d.basis.vi && d.basis.en, d.path);
  }
  const byPath = Object.fromEntries(FIELD_DEFAULTS.map((d) => [d.path, d.value]));
  assert.deepEqual(byPath, {
    'detection.0.contrast': 'low',
    'object.heightVariation': 2,
    'system.workingDistance': 300,
    'object.thermalExpansionCoeff': 23,
    'environment.ambientTempRange': 10,
    'production.motion': 'indexed',
  });
});

test('RES-001 là MỘT luật ba nhánh: cao 3, trung bình 4, thấp/chưa rõ 5', () => {
  assert.deepEqual(N_DET_BY_CONTRAST, { high: 3, medium: 4, low: 5, unknown: 5 });
});

test('áp mặc định lúc hiển thị: ô trống → "assumed", bản nháp không đổi', () => {
  const draft = emptyRequirement('AppearanceInspection');
  const { requirement, assumptions } = applyDefaults(draft);

  const contrast = readField(requirement, 'detection.0.contrast')!;
  assert.equal(contrast.value, 'low');
  assert.equal(contrast.confidence, 'assumed');
  assert.equal(contrast.assumptionId, defaultAssumptionKey('detection.0.contrast'));
  assert.equal(readField(draft, 'detection.0.contrast')!.value, null, 'ban nhap khong bi ghi gia dinh');
  assert.equal(readField(draft, 'detection.0.contrast')!.confidence, undefined, 'ban nhap van la chua hoi');

  assert.deepEqual(assumptions.map((a) => a.path).sort(), FIELD_DEFAULTS.map((d) => d.path).sort());
  assert.ok(assumptions.every((a) => a.source === 'default'));
  for (const a of assumptions) assert.equal(readField(requirement, a.path!)!.assumptionId, a.key);

  const measurement = applyDefaults(emptyRequirement('Measurement'));
  assert.ok(!measurement.assumptions.some((a) => a.path === 'detection.0.contrast'), 'do 2D khong co nhanh loi');
});

test('ô đã nhập thì không giả định — kể cả khi người dùng chọn "Chưa rõ"', () => {
  const draft = filled('AppearanceInspection', {
    'system.workingDistance': 250,
    'detection.0.contrast': 'unknown',
  });
  const { requirement, assumptions } = applyDefaults(draft);
  assert.equal(readField(requirement, 'system.workingDistance')!.value, 250);
  assert.equal(readField(requirement, 'system.workingDistance')!.confidence, 'stated');
  assert.equal(readField(requirement, 'detection.0.contrast')!.value, 'unknown');
  assert.ok(!assumptions.some((a) => a.path === 'system.workingDistance' || a.path === 'detection.0.contrast'));
});

test('px/lỗi: contrast chưa xác định → ghi rõ đang dùng 3 và MP có thể TÍNH THIẾU', () => {
  const pxOf = (req: Requirement) => resolveAssumptions(req).assumptions.find((a) => a.key === 'parameter:pxPerDefect');
  assert.equal(DEFAULT_PX_PER_DEFECT, 3, 'doi so nay (V1b) thi phai sua canh bao va test nay');

  for (const req of [emptyRequirement('AppearanceInspection'), filled('AppearanceInspection', { 'detection.0.contrast': 'unknown' })]) {
    const px = pxOf(req)!;
    assert.equal(px.level, 'warning');
    assert.equal(px.value, 3);
    for (const phrase of [
      'cố định 3',
      'tương ứng contrast CAO',
      'Theo luật chọn độ phân giải theo độ tương phản, contrast chưa xác định phải dùng 5',
      'ĐANG BỊ TÍNH THIẾU',
      'V1b',
    ]) {
      assert.ok(px.vi.includes(phrase), `thieu "${phrase}": ${px.vi}`);
    }
    assert.ok(px.en.includes('UNDERESTIMATED'), px.en);
    assert.ok(px.vi.includes('(5/3)² ≈ 2,8 lần'), px.vi);
  }

  assert.ok(pxOf(filled('AppearanceInspection', { 'detection.0.contrast': 'medium' }))!.vi.includes('contrast TRUNG BÌNH phải dùng 4'));

  const high = pxOf(filled('AppearanceInspection', { 'detection.0.contrast': 'high' }))!;
  assert.equal(high.level, 'info');
  assert.ok(!high.vi.includes('THIẾU'), high.vi);

  // Nhiều mục lỗi: mục cần nhiều px nhất quyết định.
  const two = filled('AppearanceInspection', { 'detection.0.contrast': 'high' });
  two.detection.push({ ...structuredClone(two.detection[0]), id: 'det-2' });
  two.detection[1].contrast.value = 'low';
  assert.ok(pxOf(two)!.vi.includes('contrast THẤP phải dùng 5'));

  assert.equal(pxOf(emptyRequirement('Measurement')), undefined, 'khong co nhanh loi thi khong co px/loi');
});

test('panel gom MỘT kiểu Assumption từ bốn nguồn, đủ song ngữ và rule ID', () => {
  const req = filled('Measurement', { 'object.sizeX': 100, 'measurement.0.tolerance': 0.05 });
  const { assumptions } = resolveAssumptions(req);

  // 'derived' từ V1b B3: có dung sai mà chưa có chiều dài cần đo → suy từ cạnh dài của vật.
  assert.deepEqual([...new Set(assumptions.map((a) => a.source))], ['derived', 'default', 'adapter', 'parameter']);
  assert.equal(assumptions.find((a) => a.source === 'derived')!.value, 100);
  assert.ok(assumptions.some((a) => a.key === 'fovEqualsObject'));
  assert.equal(assumptions.find((a) => a.key === 'parameter:grrDivisor')!.value, GRR_DIVISOR);
  assert.equal(assumptions.find((a) => a.key === 'parameter:kSubpixel')!.value, K_SUBPIXEL);
  assert.equal(new Set(assumptions.map((a) => a.key)).size, assumptions.length, 'key khong trung');
  for (const a of assumptions) {
    assert.ok(a.vi && a.en && a.ruleIds.length > 0, a.key);
    assert.ok(a.path || a.title, `${a.key}: can path hoac title de hien ten`);
  }

  const robot = resolveAssumptions(emptyRequirement('RobotGuidance')).assumptions;
  assert.ok(!robot.some((a) => a.source === 'parameter'), 'khong co nhanh nao thi khong co tham so tinh');
});

test('nhãn panel giả định đủ ở cả hai ngôn ngữ', () => {
  for (const locale of ['vi', 'en'] as const) {
    const r = loadMessages(locale).designer.requirement;
    assert.ok(r.assumedOption?.includes('{value}'), `${locale}: assumedOption`);
    for (const key of ['title', 'subtitle', 'defaultsTitle', 'methodTitle', 'noDefaults', 'editInTable', 'fixedInCode', 'warningLabel']) {
      assert.ok(r.assumptions?.[key], `${locale}: assumptions.${key}`);
    }
  }
});

// ───────────────────────────── Hạng mục 5: câu hỏi bổ sung ─────────────────────────────

const question = (id: string) => QUESTIONS.find((q) => q.id === id)!;
const openIds = (req: Requirement) => pendingQuestions(req).open.map((q) => q.id);
const GT001_CORE = {
  'object.sizeX': 380,
  'object.sizeY': 280,
  'detection.0.minSize': 0.5,
  'measurement.0.tolerance': 0.1,
};

test('chưa hỏi ≠ chưa rõ: hai trạng thái dùng đúng Confidence §3.2', () => {
  const req = emptyRequirement('Measurement');
  assert.ok(!('confidence' in readField(req, 'system.workingDistance')!), 'chua hoi: khong co confidence');

  const unknown = withFieldUnknown(req, 'system.workingDistance');
  assert.deepEqual({ ...readField(unknown, 'system.workingDistance')! }, { value: null, confidence: 'unknown', unit: 'mm' });
  assert.ok(!('confidence' in readField(req, 'system.workingDistance')!), 'khong sua object cu');

  const cleared = withFieldValue(unknown, 'system.workingDistance', '');
  assert.ok(!('confidence' in readField(cleared, 'system.workingDistance')!), 'xoa trang = chua hoi');
});

test('bản nháp v1 → v2: ô trống v1 là chưa hỏi, vật liệu chữ tự do bỏ', () => {
  const v1 = JSON.parse(JSON.stringify(startDraftFromApp('AppearanceInspection')));
  v1.version = 1;
  v1.requirement.system.workingDistance = { value: null, confidence: 'unknown', unit: 'mm' };
  v1.requirement.object.material = { value: 'nhôm 6061', confidence: 'stated' };
  v1.requirement.object.sizeX = { value: 380, confidence: 'stated', unit: 'mm' };

  const parsed = parseDraft(JSON.stringify(v1))!;
  assert.equal(parsed.version, 2);
  const req = parsed.requirement!;
  assert.ok(!('confidence' in readField(req, 'system.workingDistance')!));
  assert.equal(readField(req, 'object.material')!.value, null);
  assert.ok(!('confidence' in readField(req, 'object.material')!));
  assert.equal(readField(req, 'object.sizeX')!.confidence, 'stated');

  // v2 giữ nguyên 'unknown' — đó là câu trả lời thật.
  const v2 = withFieldUnknown(emptyRequirement('Measurement'), 'system.workingDistance');
  const kept = parseDraft(JSON.stringify({ ...startDraftFromApp('Measurement'), requirement: v2 }))!;
  assert.equal(readField(kept.requirement!, 'system.workingDistance')!.confidence, 'unknown');
});

test('bộ câu hỏi: đúng thứ tự bậc đã duyệt, trỏ tới ô có trên bảng', () => {
  assert.deepEqual(QUESTIONS.map((q) => q.id), [
    'objectSize', 'defectMinSize', 'tolerance', 'contrast', 'heightVariation', 'workingDistance',
    'spanLength', 'ambientTempRange', 'material', 'crossesCameraSeam', 'cameraCount',
    'surface', 'motion', 'variability',
  ]);
  assert.deepEqual(QUESTIONS.map((q) => q.tier), [1, 2, 2, 3, 4, 4, 5, 5, 5, 6, 7, 8, 8, 8]);
  assert.equal(MAX_VISIBLE_QUESTIONS, 3);

  const paths = new Set(V1A_FIELDS.map((f) => f.path));
  for (const q of QUESTIONS) {
    for (const path of [...q.paths, ...(q.followUp ? [q.followUp.path] : []), ...(q.satisfiedBy ? [q.satisfiedBy] : [])]) {
      assert.ok(paths.has(path), `${q.id}: ${path}`);
    }
    assert.ok(q.ruleIds.length > 0, q.id);
  }
});

test('mức cần thiết của ô: suy từ bảng câu hỏi, chỉ gồm ô đang hiện của loại đó', () => {
  const insp = needsFor('AppearanceInspection');
  const meas = needsFor('Measurement');

  // Bậc 1–2 (kích thước, lỗi nhỏ nhất / dung sai) = thiếu thì luật không chạy.
  assert.equal(insp.get('object.sizeX'), 'required');
  assert.equal(insp.get('object.sizeY'), 'required');
  assert.equal(insp.get('detection.0.minSize'), 'required');
  assert.equal(meas.get('measurement.0.tolerance'), 'required');
  // Bài ngoại quan không bắt buộc dung sai, nhưng vẫn nên có.
  assert.equal(insp.get('measurement.0.tolerance'), 'recommended');

  for (const path of ['detection.0.contrast', 'object.heightVariation', 'system.workingDistance', 'object.surface']) {
    assert.equal(insp.get(path), 'recommended', path);
  }
  // Không câu hỏi nào cần: α chỉ hỏi khi vật liệu "Khác", tốc độ chỉ khi chạy liên tục.
  for (const path of ['object.colorInspection', 'environment.ipRequirement', 'object.thermalExpansionCoeff', 'production.conveyorSpeed']) {
    assert.equal(insp.get(path), 'optional', path);
  }

  assert.deepEqual(
    [...insp.keys()].sort(),
    fieldsFor('AppearanceInspection').map((def) => def.path).sort()
  );
  assert.equal(meas.has('detection.0.minSize'), false, 'bai do khong co nhanh phat hien loi');

  // Mức 'required' luôn đến từ câu hỏi bậc ≤ 2 — hai nguồn không lệch nhau.
  const tier12 = new Set(QUESTIONS.filter((q) => q.tier <= 2).flatMap((q) => q.paths));
  for (const needs of [insp, meas]) {
    for (const [path, need] of needs) {
      if (need === 'required') assert.ok(tier12.has(path), path);
    }
  }
});

test('đếm theo mức: tổng bằng số ô đang hiện, điền ô nào thì đúng mức đó tăng', () => {
  const empty = emptyRequirement('Measurement');
  const counts = countByNeed(empty);
  assert.deepEqual(NEED_LEVELS.map((level) => counts[level].filled), [0, 0, 0]);
  assert.equal(
    NEED_LEVELS.reduce((sum, level) => sum + counts[level].total, 0),
    fieldsFor('Measurement').length
  );

  const withSize = countByNeed(withFieldValue(empty, 'object.sizeX', 380));
  assert.equal(withSize.required.filled, 1);
  assert.equal(withSize.recommended.filled, 0);
  assert.equal(withSize.optional.filled, 0);
});

test('bản nháp: bỏ chờ bộ đọc là một trạng thái đọc hợp lệ', () => {
  const draft = {
    ...startDraftFromApp('Measurement'),
    parse: { status: 'cancelled', applied: 0, dropped: 0, inferredApplicationType: null, pending: [] },
  };
  assert.deepEqual(parseDraft(JSON.stringify(draft))!.parse, draft.parse);
});

test('bản nháp trống: chỉ hỏi cái luật đang cần', () => {
  assert.deepEqual(openIds(emptyRequirement('AppearanceInspection')), ['objectSize', 'defectMinSize', 'surface', 'motion']);
  assert.deepEqual(openIds(emptyRequirement('Measurement')), ['objectSize', 'tolerance', 'surface', 'motion']);
  // Loại chưa hỗ trợ đủ: chỉ phần chung, không hỏi ô loại đó không có.
  assert.deepEqual(openIds(emptyRequirement('RobotGuidance')), ['objectSize', 'surface', 'motion']);
});

test('GT-001: có dung sai thì hỏi Δh, WD, span, ΔT, vật liệu — kể cả khi đang giả định', () => {
  const gt = filled('AppearanceInspection', GT001_CORE);
  assert.deepEqual(openIds(gt), [
    'contrast', 'heightVariation', 'workingDistance', 'spanLength', 'ambientTempRange', 'material',
    'crossesCameraSeam', 'cameraCount', 'surface', 'motion', 'variability',
  ]);
  const assumed = resolveAssumptions(gt).assumptions.map((a) => a.path);
  for (const path of ['object.heightVariation', 'system.workingDistance', 'environment.ambientTempRange', 'detection.0.contrast']) {
    assert.ok(assumed.includes(path), `${path} dang gia dinh ma van phai hoi`);
  }

  assert.ok(!openIds(withFieldValue(gt, 'system.cameraCount', 1)).includes('crossesCameraSeam'), 'mot camera: khong co ranh gioi');
  assert.ok(openIds(withFieldValue(gt, 'system.cameraCount', 4)).includes('crossesCameraSeam'));

  const noTolerance = filled('AppearanceInspection', { 'object.sizeX': 380, 'object.sizeY': 280, 'detection.0.minSize': 0.5 });
  for (const id of ['heightVariation', 'workingDistance', 'spanLength', 'ambientTempRange', 'material', 'crossesCameraSeam']) {
    assert.ok(!openIds(noTolerance).includes(id), `khong co dung sai thi khong hoi ${id}`);
  }
});

test('"Chưa rõ": ô không có enum unknown → {null, unknown}; không hỏi lại; vẫn áp giả định; hỏi lại được', () => {
  const gt4 = filled('AppearanceInspection', { ...GT001_CORE, 'system.cameraCount': 4 });
  const seam = question('crossesCameraSeam');

  const answered = answerUnknown(gt4, seam);
  assert.deepEqual({ ...readField(answered, 'measurement.0.crossesCameraSeam')! }, { value: null, confidence: 'unknown' });
  assert.equal(questionStatus(answered, seam), 'unknown');
  assert.ok(!openIds(answered).includes('crossesCameraSeam'));
  assert.ok(pendingQuestions(answered).unknown.includes(seam));
  assert.equal(questionStatus(resetQuestion(answered, seam), seam), 'open');

  const h = answerUnknown(gt4, question('heightVariation'));
  assert.equal(readField(h, 'object.heightVariation')!.confidence, 'unknown');
  assert.equal(readField(resolveAssumptions(h).requirement, 'object.heightVariation')!.value, 2, 'chua ro van gia dinh 2 mm');

  const size = answerUnknown(emptyRequirement('Measurement'), question('objectSize'));
  assert.equal(readField(size, 'object.sizeX')!.confidence, 'unknown');
  assert.equal(readField(size, 'object.sizeY')!.confidence, 'unknown');
});

test('"Chưa rõ" cho contrast / biến động lỗi ghi thẳng giá trị enum unknown', () => {
  const gt = filled('AppearanceInspection', GT001_CORE);
  for (const id of ['contrast', 'variability']) {
    const q = question(id);
    const answered = answerUnknown(gt, q);
    const field = readField(answered, q.paths[0])!;
    assert.deepEqual([field.value, field.confidence], ['unknown', 'stated'], id);
    assert.equal(questionStatus(answered, q), 'unknown', id);
    assert.equal(questionStatus(resetQuestion(answered, q), q), 'open', id);
  }
});

test('trả lời một phần: chỉ ô còn thiếu được hỏi tiếp, "Hỏi lại" không xoá ô đã có', () => {
  const partSize = withFieldValue(emptyRequirement('Measurement'), 'object.sizeX', 100);
  assert.deepEqual(pendingPaths(partSize, question('objectSize')), ['object.sizeY']);
  const unknownY = answerUnknown(partSize, question('objectSize'));
  assert.equal(readField(unknownY, 'object.sizeX')!.value, 100);
  assert.equal(readField(resetQuestion(unknownY, question('objectSize')), 'object.sizeX')!.value, 100);
});

test('vật liệu: suy α có nguồn; "Khác" hỏi tiếp α; α nhập tay thắng', () => {
  const gt = filled('AppearanceInspection', GT001_CORE);
  const material = question('material');

  const steel = withFieldValue(gt, 'object.material', 'steel');
  assert.equal(questionStatus(steel, material), 'answered');
  const resolved = resolveAssumptions(steel);
  const alpha = readField(resolved.requirement, 'object.thermalExpansionCoeff')!;
  assert.equal(alpha.value, MATERIAL_ALPHA.steel.alpha);
  assert.equal(alpha.confidence, 'inferred');
  const source = resolved.assumptions.find((a) => a.key === alpha.assumptionId)!;
  assert.equal(source.source, 'derived');
  assert.ok(source.vi.includes('Suy từ vật liệu') && source.en.includes('Inferred from material'));
  assert.ok(
    !resolved.assumptions.some((a) => a.source === 'default' && a.path === 'object.thermalExpansionCoeff'),
    'da biet vat lieu thi khong gia dinh nhom'
  );

  const other = withFieldValue(gt, 'object.material', 'other');
  assert.equal(questionStatus(other, material), 'open');
  assert.deepEqual(pendingPaths(other, material), ['object.thermalExpansionCoeff']);
  assert.equal(questionStatus(withFieldValue(other, 'object.thermalExpansionCoeff', 70), material), 'answered');

  const manual = withFieldValue(steel, 'object.thermalExpansionCoeff', 11);
  assert.equal(readField(resolveAssumptions(manual).requirement, 'object.thermalExpansionCoeff')!.confidence, 'stated');
  assert.equal(
    questionStatus(withFieldValue(gt, 'object.thermalExpansionCoeff', 23), material),
    'answered',
    'alpha nhap tay thi khoi hoi vat lieu'
  );

  assert.equal(
    readField(resolveAssumptions(gt).requirement, 'object.thermalExpansionCoeff')!.confidence,
    'assumed',
    'chua biet vat lieu: mac dinh nhom'
  );

  for (const m of MATERIALS.filter((item) => item !== 'other')) {
    assert.ok(MATERIAL_ALPHA[m].alpha > 0, m);
  }
  // Dải rộng lấy phía xấu (§3.3): α lớn → không tính thiếu giãn nở nhiệt.
  assert.equal(MATERIAL_ALPHA.plastic.alpha, 120, 'nhua: can tren thuc dung, khong lay giua dai 50-150');
  assert.equal(MATERIAL_ALPHA.plastic.level, 'warning');
  assert.ok(MATERIAL_ALPHA.plastic.basis.vi.includes('50–150') && MATERIAL_ALPHA.plastic.basis.vi.includes('"Khác"'));
  assert.equal(MATERIAL_ALPHA.stainless.alpha, 17);
  assert.ok(MATERIAL_ALPHA.stainless.basis.vi.includes('SUS430'));
});

test('chuyển động "chạy liên tục" hỏi tiếp tốc độ băng tải', () => {
  const gt = filled('AppearanceInspection', GT001_CORE);
  const motion = question('motion');
  const continuous = withFieldValue(gt, 'production.motion', 'continuous');
  assert.equal(questionStatus(continuous, motion), 'open');
  assert.deepEqual(pendingPaths(continuous, motion), ['production.conveyorSpeed']);
  assert.equal(questionStatus(withFieldValue(continuous, 'production.conveyorSpeed', 200), motion), 'answered');
  assert.equal(questionStatus(withFieldValue(gt, 'production.motion', 'indexed'), motion), 'answered');
});

test('V1a hiện MỤC ĐÍCH: mọi mã luật trong cấu hình có mục đích, nhãn không lộ mã luật', () => {
  const gt = filled('AppearanceInspection', { ...GT001_CORE, 'object.material': 'plastic' });
  const ruleIds = [
    ...QUESTIONS.flatMap((q) => q.ruleIds),
    ...FIELD_DEFAULTS.flatMap((d) => d.ruleIds),
    ...resolveAssumptions(gt).assumptions.flatMap((a) => a.ruleIds),
    ...resolveAssumptions(emptyRequirement('Measurement')).assumptions.flatMap((a) => a.ruleIds),
  ];
  for (const id of ruleIds) assert.ok(RULE_PURPOSE[id], `${id} chua co muc dich`);

  const RULE_CODE = /\b[A-Z]{2,3}-\d{3}\b/;

  // Chữ của panel giả định (sinh trong code, không nằm trong messages) cũng không lộ mã luật.
  const contrasts = ['high', 'medium', 'low', 'unknown'] as const;
  const panelSources = [
    gt,
    filled('AppearanceInspection', { ...GT001_CORE, 'object.material': 'stainless' }),
    ...contrasts.map((c) => filled('AppearanceInspection', { ...GT001_CORE, 'detection.0.contrast': c })),
    emptyRequirement('AppearanceInspection'),
    emptyRequirement('Measurement'),
  ];
  for (const req of panelSources) {
    for (const a of resolveAssumptions(req).assumptions) {
      const text = [a.vi, a.en, a.title?.vi ?? '', a.title?.en ?? ''].join(' | ');
      assert.ok(!RULE_CODE.test(text), `${a.key}: lo ma luat — ${text}`);
    }
  }
  for (const locale of ['vi', 'en'] as const) {
    const r = loadMessages(locale).designer.requirement;
    for (const p of PURPOSES) assert.ok(r.purposes?.[p], `${locale}: purposes.${p}`);
    for (const q of QUESTIONS) {
      assert.ok(r.questions?.items?.[q.id]?.question && r.questions.items[q.id].short, `${locale}: questions.items.${q.id}`);
    }
    for (const key of ['title', 'subtitle', 'done', 'more', 'markedUnknown', 'askAgain', 'unknown', 'confirm', 'suggestions', 'invalidNumber']) {
      assert.ok(r.questions[key], `${locale}: questions.${key}`);
    }
    assert.ok(r.inferredOption?.includes('{value}'), `${locale}: inferredOption`);
    for (const m of MATERIALS) assert.ok(r.options.material?.[m], `${locale}: options.material.${m}`);
    assert.ok(!RULE_CODE.test(JSON.stringify({ q: r.questions, p: r.purposes, a: r.assumptions })), `${locale}: nhan lo ma luat`);
  }
});

// ─────────────────────────── V1b B3: chiều dài cần đo suy ra ───────────────────────────

test('chưa có chiều dài cần đo → giả định cạnh dài nhất của vật, chỉ khi có dung sai đo', () => {
  const SPAN = 'measurement.0.spanLength';
  const base = { 'object.sizeX': 100, 'object.sizeY': 380, 'measurement.0.tolerance': 0.1 };

  const derived = applyDefaults(filled('Measurement', base));
  const span = readField(derived.requirement, SPAN)!;
  assert.equal(span.value, 380, 'lay canh dai nhat, du canh do nam o truc doc');
  assert.equal(span.confidence, 'inferred');
  const assumption = derived.assumptions.find((a) => a.path === SPAN)!;
  assert.equal(assumption.key, 'derived:measurement.0.spanLength');
  assert.equal(assumption.source, 'derived');
  assert.deepEqual(assumption.ruleIds, ['MEC-001']);
  assert.equal(assumption.level, 'warning');

  // Người dùng đã nhập thì giữ nguyên, không giả định.
  const entered = applyDefaults(filled('Measurement', { ...base, [SPAN]: 200 }));
  assert.equal(readField(entered.requirement, SPAN)!.value, 200);
  assert.ok(!entered.assumptions.some((a) => a.path === SPAN));

  // Không có dung sai đo → chiều dài không dùng vào đâu → không giả định.
  const noTolerance = applyDefaults(filled('Measurement', { 'object.sizeX': 100, 'object.sizeY': 380 }));
  assert.equal(readField(noTolerance.requirement, SPAN)!.value, null);

  // Chưa có kích thước vật → không có gì để suy.
  const noSize = applyDefaults(filled('Measurement', { 'measurement.0.tolerance': 0.1 }));
  assert.equal(readField(noSize.requirement, SPAN)!.value, null);
});

// ─────────────────────────── V1b B4: vắt qua đường ghép giả định ───────────────────────────

test('nhiều camera + có dung sai + chưa trả lời vắt qua đường ghép → giả định CÓ (phía xấu)', () => {
  const SEAM = 'measurement.0.crossesCameraSeam';
  const base = { 'object.sizeX': 380, 'object.sizeY': 280, 'measurement.0.tolerance': 0.1, 'system.cameraCount': 4 };

  const assumed = applyDefaults(filled('Measurement', base));
  const seam = readField(assumed.requirement, SEAM)!;
  assert.equal(seam.value, true);
  assert.equal(seam.confidence, 'assumed');
  const assumption = assumed.assumptions.find((a) => a.path === SEAM)!;
  assert.equal(assumption.key, defaultAssumptionKey(SEAM));
  assert.deepEqual(assumption.ruleIds, ['MEC-003']);
  assert.equal(assumption.level, 'warning');

  const answeredNo = applyDefaults(filled('Measurement', { ...base, [SEAM]: false }));
  assert.equal(readField(answeredNo.requirement, SEAM)!.value, false, 'nguoi dung da chon Khong');
  assert.ok(!answeredNo.assumptions.some((a) => a.path === SEAM));

  const one = applyDefaults(filled('Measurement', { ...base, 'system.cameraCount': 1 }));
  assert.equal(readField(one.requirement, SEAM)!.value, null, 'mot camera thi khong co duong ghep');

  const { 'system.cameraCount': _count, ...noCount } = base;
  void _count;
  assert.equal(readField(applyDefaults(filled('Measurement', noCount)).requirement, SEAM)!.value, null, 'chua co so camera');

  const { 'measurement.0.tolerance': _tol, ...noTolerance } = base;
  void _tol;
  assert.equal(readField(applyDefaults(filled('Measurement', noTolerance)).requirement, SEAM)!.value, null, 'khong do');
});
