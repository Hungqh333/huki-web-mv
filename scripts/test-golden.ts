/**
 * Golden test V1b — spec V1.1 §13. Tiêu chí phát hành V1b: toàn bộ ca pass.
 *
 * Ca và đáp án ở scripts/golden/cases.ts. Chỉ GT-001 là dự án thật; ca S-xx là
 * mẫu soạn (xem chú thích đầu file đó) — V1b "xong có điều kiện" cho tới khi
 * có đủ dự án thật.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyRequirement, withFieldValue } from '../src/lib/requirement/fields';
import { assessFeasibility } from '../src/lib/vision/feasibility';
import { analyseRequirement } from '../src/lib/vision/requirementAnalysis';
import { GOLDEN_CASES } from './golden/cases';

const sorted = (values: string[]) => [...new Set(values)].sort();

test('bộ golden: ID duy nhất, có ít nhất một dự án thật, mọi ca có ghi chú tính tay', () => {
  const ids = GOLDEN_CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(GOLDEN_CASES.some((c) => c.source === 'real-project'));
  for (const c of GOLDEN_CASES) {
    assert.ok(c.note.length > 20, `${c.id}: can ghi chu tinh tay`);
    if (c.source === 'synthetic') assert.ok(c.name.startsWith('Mẫu soạn'), `${c.id}: mau soan phai ghi ro trong ten`);
    for (const gap of c.knownGaps ?? []) assert.ok(gap.trim().length > 20, `${c.id}: knownGaps phai ghi ro`);
  }
});

test('chỗ lệch đã biết giữa engine và dự án thật được liệt kê, không bị che khi ca vẫn pass', () => {
  const gaps = GOLDEN_CASES.filter((c) => c.source === 'real-project').flatMap((c) => (c.knownGaps ?? []).map((gap) => `${c.id}: ${gap}`));
  // Có lệch thì in ra để người chạy test luôn thấy, không chỉ nằm trong file dữ liệu.
  for (const gap of gaps) console.log(`  [lech da biet] ${gap.slice(0, 140)}…`);
  assert.ok(gaps.filter((gap) => gap.startsWith('GT-002')).length >= 4, 'GT-002 co it nhat 4 cho lech da ghi');
});

for (const golden of GOLDEN_CASES) {
  test(`${golden.id} — ${golden.name}`, () => {
    const requirement = Object.entries(golden.input).reduce(
      (req, [path, value]) => withFieldValue(req, path, value),
      emptyRequirement(golden.applicationType)
    );
    const analysis = analyseRequirement(requirement);
    const feasibility = assessFeasibility(analysis.results);
    const { expect } = golden;

    assert.deepEqual(sorted(analysis.results.map((r) => r.ruleId)), sorted(expect.rulesFired), 'luat da chay');
    assert.deepEqual(sorted(feasibility.blockers.map((r) => r.ruleId)), sorted(expect.failingRules), 'luat FAIL');
    assert.equal(feasibility.status, expect.status, 'ket luan');
    assert.equal(feasibility.overall, expect.overall, 'diem tong');
    assert.deepEqual(feasibility.limitingFactors, expect.limitingFactors, 'yeu to gioi han');

    if (expect.governingMmPerPx !== undefined) {
      assert.ok(Math.abs(analysis.governingMmPerPx! - expect.governingMmPerPx) < 1e-9, `mm/px ${analysis.governingMmPerPx}`);
    }
    if (expect.megapixelsPerCamera) {
      const [value, tolerance] = expect.megapixelsPerCamera;
      assert.ok(Math.abs(analysis.megapixelsPerCamera! - value) <= tolerance, `MP/camera ${analysis.megapixelsPerCamera}`);
    }
  });
}
