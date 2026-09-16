/**
 * Khung luật V1b (B6): engine chạy thẳng trên bảng Yêu cầu, trả RuleResult.
 *
 * GT-001 ở đây là bộ số của spec §4.1 / §13 — dự án thật 2025. Golden test đầy
 * đủ (kết luận khả thi, yếu tố giới hạn) nằm ở test-golden.ts (B10).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import type { Requirement } from '../src/lib/requirement/types';
import { analyseRequirement, K_BLUR, STROBE_EXPOSURE_LIMIT_US } from '../src/lib/vision/requirementAnalysis';
import { completeness, FEASIBILITY_DIMENSIONS, knowledgeSlugFor, RULES, type RuleResult } from '../src/lib/vision/rules';

function filled(type: Requirement['applicationType'], values: Record<string, unknown>): Requirement {
  return Object.entries(values).reduce((req, [path, value]) => withFieldValue(req, path, value), emptyRequirement(type));
}

/** Input GT-001 đúng như spec §13. */
export const GT001_INPUT = {
  'object.sizeX': 380,
  'object.sizeY': 280,
  'object.surface': 'glossy',
  'object.heightVariation': 2,
  'detection.0.minSize': 0.5,
  'detection.0.contrast': 'unknown',
  'measurement.0.tolerance': 0.1,
  'measurement.0.spanLength': 380,
  'measurement.0.crossesCameraSeam': true,
  'system.cameraCount': 4,
  'system.workingDistance': 300,
  'environment.ambientTempRange': 10,
};

const byRule = (results: RuleResult[], id: string) => results.filter((r) => r.ruleId === id);
const one = (results: RuleResult[], id: string) => {
  const found = byRule(results, id);
  assert.equal(found.length, 1, `${id}: can dung 1 ket qua, co ${found.length}`);
  return found[0];
};

test('danh mục luật: ID duy nhất, đúng dạng, mỗi luật thuộc một nhóm khả thi', () => {
  const ids = RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of RULES) {
    assert.match(rule.id, /^(RES|OPT|LGT|THR|MEC|ENV|AI|INT)-\d{3}$/);
    assert.ok(rule.id.startsWith(rule.category), rule.id);
    assert.ok((FEASIBILITY_DIMENSIONS as readonly string[]).includes(rule.dimension), rule.id);
    assert.match(rule.version, /^\d+\.\d+\.\d+$/);
  }
  assert.equal(knowledgeSlugFor('MEC-001'), 'rule-mec-001');
});

test('GT-001: hai nhánh độ phân giải, nhánh đo quyết định, lưới 2×2 cần ~8,9 MP/camera', () => {
  const analysis = analyseRequirement(filled('AppearanceInspection', GT001_INPUT));
  const { results } = analysis;

  assert.ok(one(results, 'RES-001').formula.includes('0.5 mm ÷ 5 px = 0.1 mm/px'), 'contrast chua ro → N = 5');
  assert.equal(one(results, 'RES-006').status, 'warn');
  assert.equal(one(results, 'RES-006').evidence, 'requires-sample-test');
  assert.ok(one(results, 'RES-002').formula.includes('= 0.06 mm/px'));
  assert.equal(one(results, 'RES-003').noteKey, 'governedByMeasurement');
  assert.equal(analysis.governingMmPerPx, 0.06);
  assert.equal(analysis.uncertaintyBudgetMm, 0.02);

  assert.deepEqual(analysis.tile!.grid, { cols: 2, rows: 2 });
  assert.ok(one(results, 'RES-005').formula.includes('lưới 2×2'));
  // Spec §4.1 ghi ~8,3 MP với ô ~200×150 mm; engine cộng chồng lấn 10% (chốt B2) → 209×154 mm.
  assert.equal(Math.round(analysis.megapixelsPerCamera! * 100) / 100, 8.94);
});

test('GT-001: phối cảnh, telecentric, nhiệt, ghép ảnh đều FAIL; chiếu sáng bề mặt bóng cần thử mẫu', () => {
  const { results } = analyseRequirement(filled('AppearanceInspection', GT001_INPUT));

  for (const id of ['OPT-008', 'OPT-007', 'MEC-001', 'MEC-003']) {
    assert.equal(one(results, id).status, 'fail', id);
    assert.ok(one(results, id).marginRatio! < 1, `${id}: marginRatio < 1`);
  }
  assert.equal(byRule(results, 'OPT-006').length, 0, 'khach khong yeu cau do khong phoi canh');

  const lighting = one(results, 'LGT-001');
  assert.equal(lighting.status, 'warn');
  assert.equal(lighting.evidence, 'requires-sample-test');
  assert.equal(lighting.formula, 'dome');

  // Vật liệu chưa nêu → α đang giả định 23 (nhôm): phải nằm trong inputsAssumed của MEC-001.
  const thermal = one(results, 'MEC-001');
  assert.ok(thermal.inputsAssumed.some((i) => i.path === 'object.thermalExpansionCoeff' && i.value === 23));
  assert.ok(thermal.inputsUsed.some((i) => i.path === 'environment.ambientTempRange' && i.value === 10));
  assert.deepEqual(thermal.knowledgeRefs, ['rule-mec-001']);
});

test('chưa có số camera → không tự đoán: báo cần nhập, cho biết MP nếu dùng 1 camera, bỏ phối cảnh / ghép ảnh', () => {
  const { 'system.cameraCount': _count, ...rest } = GT001_INPUT;
  void _count;
  const analysis = analyseRequirement(filled('AppearanceInspection', rest));
  const tiling = one(analysis.results, 'RES-005');
  assert.equal(tiling.status, 'warn');
  assert.equal(tiling.noteKey, 'cameraCountMissing');
  assert.equal(tiling.noteValues!.mp, 29.6, '380/0,06 × 280/0,06 ≈ 29,6 MP');
  assert.equal(analysis.tile, null);
  for (const id of ['RES-004', 'OPT-008', 'OPT-007', 'MEC-003']) assert.equal(byRule(analysis.results, id).length, 0, id);
  assert.equal(byRule(analysis.results, 'MEC-001').length, 1, 'nhiet khong can so camera');
});

test('bài chỉ phát hiện lỗi (không dung sai) → không có luật đo, phối cảnh, nhiệt, ghép ảnh', () => {
  const { results } = analyseRequirement(
    filled('AppearanceInspection', { 'object.sizeX': 100, 'object.sizeY': 80, 'detection.0.minSize': 0.2, 'detection.0.contrast': 'high', 'system.cameraCount': 1 })
  );
  assert.ok(one(results, 'RES-001').formula.includes('0.2 mm ÷ 3 px'));
  assert.equal(byRule(results, 'RES-006').length, 0, 'nguoi dung da neu contrast cao');
  for (const id of ['RES-002', 'RES-003', 'RES-005', 'OPT-008', 'MEC-001', 'MEC-003']) assert.equal(byRule(results, id).length, 0, id);
  assert.equal(one(results, 'RES-004').status, 'info');
});

test('nhoè chuyển động: phơi sáng tối đa = k_blur × mm/px ÷ tốc độ; dưới 50 µs thì bắt buộc strobe', () => {
  assert.equal(K_BLUR, 0.5);
  assert.equal(STROBE_EXPOSURE_LIMIT_US, 50);
  const run = (speed: number) =>
    analyseRequirement(filled('AppearanceInspection', { ...GT001_INPUT, 'production.motion': 'continuous', 'production.conveyorSpeed': speed })).results;

  const slow = run(500); // 0,5 × 0,06 ÷ 500 = 60 µs
  assert.ok(one(slow, 'THR-005').formula.includes('= 60 µs'));
  assert.equal(byRule(slow, 'LGT-008').length, 0);

  const fast = run(1000); // 30 µs
  assert.equal(one(fast, 'LGT-008').status, 'warn');
  assert.equal(one(fast, 'LGT-008').noteValues!.us, 30);

  assert.equal(byRule(analyseRequirement(filled('AppearanceInspection', GT001_INPUT)).results, 'THR-005').length, 0, 'dung tung buoc thi khong nhoe');
});

test('băng thông: MP × 1 byte × ảnh/s, chọn giao tiếp nhỏ nhất còn biên 30%', () => {
  const { results } = analyseRequirement(filled('AppearanceInspection', { ...GT001_INPUT, 'production.partsPerMinute': 60 }));
  assert.ok(one(results, 'THR-001').formula.includes('8.94 MP × 1 byte × 1 ảnh/s = 8.9 MB/s/camera · ×4 = 35.8 MB/s'), one(results, 'THR-001').formula);
  const iface = one(results, 'THR-002');
  assert.equal(iface.status, 'info');
  assert.ok(iface.formula.startsWith('GigE:'), iface.formula);
});

test('thuật toán: biến động cao → học sâu cần mẫu thật; thấp → truyền thống; chưa biết → chưa chọn', () => {
  const run = (variability: string | null) =>
    analyseRequirement(filled('AppearanceInspection', { ...GT001_INPUT, ...(variability ? { 'detection.0.variability': variability } : {}) })).results;
  assert.equal(one(run('high'), 'AI-002').evidence, 'requires-sample-test');
  assert.equal(one(run('low'), 'AI-001').status, 'pass');
  assert.equal(one(run(null), 'AI-001').noteKey, 'variabilityUnknown');
  assert.equal(byRule(analyseRequirement(filled('Measurement', GT001_INPUT)).results, 'AI-001').length, 0, 'bai do khong co nhanh loi');
});

test('môi trường: rung, bụi/dầu, nhiệt cao, ánh sáng thay đổi, kiểm màu → cảnh báo đúng luật', () => {
  const { results } = analyseRequirement(
    filled('AppearanceInspection', {
      ...GT001_INPUT,
      'environment.conditions': ['vibration', 'oil', 'highTemp', 'variableLight'],
      'object.colorInspection': true,
    })
  );
  for (const id of ['MEC-002', 'ENV-001', 'ENV-002', 'LGT-007', 'LGT-006']) assert.equal(one(results, id).status, 'warn', id);
});

test('độ đầy đủ input = ô thật ÷ (ô thật + ô giả định), tính bằng code', () => {
  const full = analyseRequirement(filled('AppearanceInspection', GT001_INPUT));
  assert.ok(full.completeness! > 0 && full.completeness! < 1, 'GT-001 van con gia dinh α, WD mac dinh...');
  assert.equal(completeness([]), null);

  const sparse = analyseRequirement(filled('AppearanceInspection', { 'object.sizeX': 380, 'object.sizeY': 280, 'measurement.0.tolerance': 0.1, 'system.cameraCount': 4 }));
  assert.ok(sparse.completeness! < full.completeness!, 'cang nhieu gia dinh thi do day du cang thap');
});

test('mọi kết quả: mã luật có trong danh mục, nhãn và ghi chú đủ ở cả hai ngôn ngữ', () => {
  const inputs: Requirement[] = [
    filled('AppearanceInspection', GT001_INPUT),
    filled('AppearanceInspection', { ...GT001_INPUT, 'measurement.0.perspectiveFree': true, 'object.surface': 'black' }),
    filled('AppearanceInspection', {
      ...GT001_INPUT,
      'production.motion': 'continuous',
      'production.conveyorSpeed': 2000,
      'production.partsPerMinute': 6000,
      'detection.0.variability': 'high',
      'environment.conditions': ['vibration', 'dust', 'highTemp', 'variableLight'],
      'object.colorInspection': true,
    }),
    filled('AppearanceInspection', { 'object.sizeX': 380, 'object.sizeY': 280, 'detection.0.minSize': 0.5 }),
    filled('Measurement', { 'object.sizeX': 60, 'object.sizeY': 40, 'measurement.0.tolerance': 0.01, 'system.cameraCount': 1 }),
  ];
  const ruleIds = new Set(RULES.map((r) => r.id));
  for (const locale of ['vi', 'en'] as const) {
    const vision = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), 'utf8')).selector.vision;
    for (const input of inputs) {
      for (const result of analyseRequirement(input).results) {
        assert.ok(ruleIds.has(result.ruleId), result.ruleId);
        assert.ok(vision.checks[result.key], `${locale}: checks.${result.key}`);
        if (result.noteKey) {
          const note = result.noteKey.includes('.')
            ? result.noteKey.split('.').reduce((node: Record<string, unknown> | undefined, part) => node?.[part] as Record<string, unknown> | undefined, vision)
            : vision.notes[result.noteKey];
          assert.ok(note, `${locale}: note ${result.noteKey}`);
        }
      }
    }
  }
});
