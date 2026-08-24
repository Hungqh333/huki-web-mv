/**
 * Unit test cho engine bộ chọn thiết bị.
 *
 *   npm run test:engine
 *
 * Kiểm những chỗ dễ sai nhất: đánh giá điều kiện, công thức tính độ phân giải
 * theo CLAUDE.md mục 4, cách ghép kết quả theo priority, và nguyên tắc "chỉ leo
 * lên deep learning khi có luật nói rõ".
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { matchesCondition, validateCondition } from '../src/lib/selector/conditions';
import { deriveMetrics, DEFAULT_SAFETY_FACTOR } from '../src/lib/selector/derive';
import { runSelector } from '../src/lib/selector/engine';
import type { SelectorRule } from '../src/lib/selector/types';

function rule(partial: Partial<SelectorRule> & { code: string }): SelectorRule {
  return {
    id: partial.code,
    task_type_id: 'task',
    condition_json: null,
    recommended_camera: null,
    recommended_lighting: null,
    recommended_lens: null,
    ai_or_rule_based: 'rule_based',
    notes_vi: null,
    notes_en: null,
    priority: 100,
    is_active: true,
    ...partial,
  };
}

test('điều kiện rỗng là luật nền, luôn khớp', () => {
  assert.equal(matchesCondition(null, {}), true);
  assert.equal(matchesCondition({}, {}), true);
  assert.equal(matchesCondition({ all: [] }, {}), true);
});

test('so sánh số học', () => {
  const cond = { all: [{ field: 'tolerance_mm', op: 'lt' as const, value: 0.05 }] };
  assert.equal(matchesCondition(cond, { tolerance_mm: 0.02 }), true);
  assert.equal(matchesCondition(cond, { tolerance_mm: 0.05 }), false);
  assert.equal(matchesCondition(cond, { tolerance_mm: 0.2 }), false);
});

test('trường bỏ trống thì luật gắn với trường đó không khớp', () => {
  const cond = { all: [{ field: 'tolerance_mm', op: 'lt' as const, value: 0.05 }] };
  assert.equal(matchesCondition(cond, { tolerance_mm: null }), false);
  assert.equal(matchesCondition(cond, {}), false);
});

test('op "in" khớp trên trường nhiều lựa chọn khi giao nhau khác rỗng', () => {
  const cond = { all: [{ field: 'environment', op: 'in' as const, value: ['vibration'] }] };
  assert.equal(matchesCondition(cond, { environment: ['dust', 'vibration'] }), true);
  assert.equal(matchesCondition(cond, { environment: ['dust'] }), false);
  assert.equal(matchesCondition(cond, { environment: [] }), false);
});

test('tất cả predicate phải cùng đúng', () => {
  const cond = {
    all: [
      { field: 'surface', op: 'eq' as const, value: 'metal' },
      { field: 'tolerance_mm', op: 'lt' as const, value: 0.05 },
    ],
  };
  assert.equal(matchesCondition(cond, { surface: 'metal', tolerance_mm: 0.01 }), true);
  assert.equal(matchesCondition(cond, { surface: 'metal', tolerance_mm: 0.5 }), false);
});

test('validateCondition bắt được định dạng sai', () => {
  assert.deepEqual(validateCondition({ all: [] }), []);
  assert.ok(validateCondition({ all: [{ field: 'x', op: 'bogus' }] }).length > 0);
  assert.ok(validateCondition({ all: [{ field: '', op: 'eq', value: 1 }] }).length > 0);
  assert.ok(validateCondition({ all: [{ field: 'x', op: 'in', value: 'khong-phai-mang' }] }).length > 0);
  assert.ok(validateCondition({ anyOf: [] }).length > 0);
});

test('công thức độ phân giải đúng theo CLAUDE.md mục 4', () => {
  // FOV 100mm, dung sai 0.1mm, hệ số 3 -> 100 / (0.1/3) = 3000 px
  const { context } = deriveMetrics(
    { fov_width_mm: 100, fov_height_mm: 50, tolerance_mm: 0.1 },
    3
  );
  assert.equal(context.fov_long_mm, 100, 'lấy trục dài hơn của FOV');
  assert.equal(context.required_resolution_px, 3000);
  assert.equal(context.px_per_mm, 30);
});

test('hệ số an toàn mặc định nằm trong khoảng 2-3 px/feature', () => {
  assert.ok(DEFAULT_SAFETY_FACTOR >= 2 && DEFAULT_SAFETY_FACTOR <= 3);
});

test('bài ngoại quan dùng kích thước lỗi nhỏ nhất thay cho dung sai', () => {
  const { context } = deriveMetrics(
    { fov_width_mm: 60, fov_height_mm: 60, defect_min_size_mm: 0.2 },
    3
  );
  assert.equal(context.required_resolution_px, 900);
});

test('luật priority nhỏ hơn thắng ở từng ô kết quả', () => {
  const result = runSelector(
    [
      rule({ code: 'BASE', priority: 100, recommended_lighting: 'đèn vòng', recommended_camera: 'area scan' }),
      rule({
        code: 'SPECIFIC',
        priority: 50,
        recommended_lighting: 'đèn dome',
        condition_json: { all: [{ field: 'surface', op: 'eq', value: 'reflective' }] },
      }),
    ],
    { surface: 'reflective' }
  );

  assert.equal(result.lighting, 'đèn dome', 'luật ưu tiên cao thắng');
  assert.equal(result.camera, 'area scan', 'ô luật ưu tiên cao bỏ trống thì lấy của luật nền');
});

test('mặc định là rule_based, chỉ leo lên khi có luật nói rõ', () => {
  const baseOnly = runSelector([rule({ code: 'BASE' })], {});
  assert.equal(baseOnly.approach, 'rule_based');

  const escalated = runSelector(
    [
      rule({ code: 'BASE' }),
      rule({
        code: 'DL',
        priority: 20,
        ai_or_rule_based: 'deep_learning',
        notes_vi: 'Lỗi biến thiên quá lớn.',
        notes_en: 'Defects vary too much.',
        condition_json: { all: [{ field: 'defect_variability', op: 'eq', value: 'high' }] },
      }),
    ],
    { defect_variability: 'high' }
  );
  assert.equal(escalated.approach, 'deep_learning');
  assert.equal(escalated.approachReason?.vi, 'Lỗi biến thiên quá lớn.', 'phải kèm lý do');
});

test('luật deep_learning không khớp thì không được leo thang', () => {
  const result = runSelector(
    [
      rule({ code: 'BASE' }),
      rule({
        code: 'DL',
        priority: 20,
        ai_or_rule_based: 'deep_learning',
        condition_json: { all: [{ field: 'defect_variability', op: 'eq', value: 'high' }] },
      }),
    ],
    { defect_variability: 'low' }
  );
  assert.equal(result.approach, 'rule_based');
  assert.equal(result.approachReason, null);
});

test('ghi chú gom từ mọi luật khớp và không trùng lặp', () => {
  const result = runSelector(
    [
      rule({ code: 'A', notes_vi: 'ghi chú A', notes_en: 'note A' }),
      rule({ code: 'B', priority: 50, notes_vi: 'ghi chú B', notes_en: 'note B' }),
      rule({ code: 'C', priority: 60, notes_vi: 'ghi chú A', notes_en: 'note A' }),
    ],
    {}
  );
  assert.deepEqual(
    result.notes.map((note) => note.vi),
    ['ghi chú B', 'ghi chú A']
  );
});

test('luật đã tắt thì bị bỏ qua', () => {
  const result = runSelector(
    [rule({ code: 'OFF', is_active: false, recommended_camera: 'không được dùng' })],
    {}
  );
  assert.equal(result.camera, null);
  assert.equal(result.noRuleMatched, true);
});

test('không luật nào khớp thì báo rõ thay vì trả kết quả rỗng im lặng', () => {
  const result = runSelector(
    [rule({ code: 'X', condition_json: { all: [{ field: 'surface', op: 'eq', value: 'metal' }] } })],
    { surface: 'matte' }
  );
  assert.equal(result.noRuleMatched, true);
  assert.equal(result.camera, null);
});
