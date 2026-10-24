/**
 * Thực nghiệm chiếu sáng (chốt 2026-10-24): tỉ lệ bỏ sót / hao phí (EXP-001, EXP-002), phương án
 * đại diện, huy hiệu "đã thực nghiệm", khoá ren → đồng trục (Q9).
 *
 *   npx tsx --test scripts/test-light-experiments.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { trialRates } from '../src/lib/vision/experimentMetrics';
import { chosenTrial, isWorking, rankExperimentItems, verifiedCounts } from '../src/lib/vision/experimentMatch';
import { pickLightType } from '../src/lib/vision/lightMatrix';
import { TASK_FEATURES } from '../src/lib/vision/lightOptions';

test('EXP-001/002: bỏ sót = FN / tổng, hao phí = FP / tổng; thiếu số hoặc tổng 0 → không tính', () => {
  const r = trialRates({ tp: 5, tn: 90, fp: 3, fn: 2 })!;
  assert.equal(r.total, 100);
  assert.equal(r.leakage, 0.02);
  assert.equal(r.overkill, 0.03);
  assert.equal(r.leakageOk, false, 'bo sot 2 % vuot tieu chi < 1 %');
  assert.equal(r.overkillOk, true, 'hao phi 3 % dat tieu chi < 5 %');
  assert.equal(trialRates({ tp: 5, tn: 90, fp: null, fn: 2 }), null);
  assert.equal(trialRates({ tp: 0, tn: 0, fp: 0, fn: 0 }), null);
});

test('phương án đại diện: phương án được chọn đầu tiên theo thứ tự; không chọn thì phương án đầu', () => {
  const t = (id: string, sort_order: number, is_chosen: boolean) => ({ id, sort_order, is_chosen, created_at: '2026-10-24' });
  assert.equal(chosenTrial([t('a', 0, false), t('b', 1, true), t('c', 2, true)])?.id, 'b');
  assert.equal(chosenTrial([t('a', 1, false), t('b', 0, false)])?.id, 'b');
  assert.equal(chosenTrial([]), null);
});

test('huy hiệu: chỉ đếm hạng mục trùng "cần thấy gì" đúng kiểu đèn gợi ý; kiểm được = Đạt / Đạt có điều kiện', () => {
  const item = (id: string, lightType: string, verdict: string | null, feature = 'thread') => ({
    id,
    task: 'inspect',
    feature,
    material: 'metal_cast',
    finish: 'matte',
    shape: null,
    lightType,
    verdict,
  });
  const ranked = rankExperimentItems(
    [item('a', 'coaxial', 'pass'), item('b', 'coaxial', 'conditional'), item('c', 'ring', 'pass'), item('d', 'coaxial', 'fail')],
    { task: 'inspect', feature: 'thread', material: 'metal_cast', finish: 'matte', shape: null, lightTypes: ['coaxial'] }
  );
  assert.deepEqual(verifiedCounts(ranked, 'coaxial'), { pass: 1, conditional: 1, fail: 1 });
  assert.equal(ranked[ranked.length - 1].id, 'c', 'den khac den goi y xep sau');
  assert.ok(isWorking('pass') && isWorking('conditional') && !isWorking('fail') && !isWorking(null));
});

test('Q9: ren có ở kiểm lỗi và đo; mọi bề mặt thường → đồng trục', () => {
  assert.ok((TASK_FEATURES.inspect as readonly string[]).includes('thread'));
  assert.ok((TASK_FEATURES.measure as readonly string[]).includes('thread'));
  for (const finish of ['matte', 'semi_gloss', 'textured', null] as const) {
    const pick = pickLightType({ task: 'inspect', feature: 'thread', dentDepth: null, backlightable: false, finish, shape: null })!;
    assert.equal(pick.lightType, 'coaxial', `kiem ren, be mat ${finish}`);
    assert.equal(pick.ruleId, 'LGT-022');
  }
  const measure = pickLightType({ task: 'measure', feature: 'thread', dentDepth: null, backlightable: true, finish: 'matte', shape: null })!;
  assert.equal(measure.lightType, 'coaxial');
  assert.equal(measure.rowKey, 't_measure_thread');
});
