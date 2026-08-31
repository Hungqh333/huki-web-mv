/**
 * Unit test cho công thức tính chỉ tiêu Vision.
 *
 * Ba nhóm test đầu chốt đúng ba lỗi nghiệp vụ dễ mắc nhất:
 *   1. Cộng dồn bắt ảo và tái kiểm vượt trần — chúng là hai nhánh loại trừ nhau
 *   2. Cho phép bỏ sót = 0 rồi trả về một con số bắt ảo hữu hạn
 *   3. Áp hệ số đầy đủ lên tái kiểm thay vì dùng số mũ
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyModifier,
  computeAssistModel,
  computeEscapeLadder,
  computeModifierFactor,
  computeOperationalCost,
  computeSampleAdequacy,
  computeTighteningScenario,
  computeTwoStage,
  splitBurden,
} from '../src/lib/kpi/calc';
import { DEFAULT_KPI_CONFIG, type Modifier, type ProblemType } from '../src/lib/kpi/types';

const CONFIG = DEFAULT_KPI_CONFIG;

function problem(overrides: Partial<ProblemType> = {}): ProblemType {
  return {
    id: 'x',
    slug: 'test',
    problem_group: 'cosmetic',
    level: 6,
    name_vi: 'Test',
    name_en: 'Test',
    miss_min: 0.5,
    miss_max: 2,
    false_reject_week1_min: 10,
    false_reject_week1_max: 18,
    false_reject_min: 2,
    false_reject_max: 5,
    recheck_min: 2,
    recheck_max: 4,
    total_burden_max: 8,
    ramp_up_weeks_min: 4,
    ramp_up_weeks_max: 8,
    deep_learning: 'often',
    special_kpi: null,
    note_vi: null,
    note_en: null,
    data_source: 'estimate',
    ...overrides,
  };
}

function modifier(min: number, max: number, direction: 'worse' | 'better' = 'worse'): Modifier {
  return {
    id: 'm',
    slug: 'm',
    name_vi: 'm',
    name_en: 'm',
    factor_min: min,
    factor_max: max,
    direction,
    data_source: 'estimate',
  };
}

// ---------------------------------------------------------------- LỖI SỐ MỘT --

test('bắt ảo + tái kiểm LUÔN bằng đúng tổng tải phụ, không cộng dồn vượt trần', () => {
  const burden = 8;
  for (const strategy of ['no-recheck', 'minimize-scrap', 'balanced'] as const) {
    const split = splitBurden(burden, { min: 0.5, max: 2 }, strategy);
    const total = split.falseReject + split.recheck;
    assert.ok(
      Math.abs(total - burden) < 0.01,
      `${strategy}: f(${split.falseReject}) + r(${split.recheck}) = ${total}, phai bang ${burden}`
    );
  }
});

test('mọi tỷ lệ tuỳ chỉnh đều giữ đúng tổng', () => {
  for (let share = 0; share <= 100; share += 5) {
    const split = splitBurden(7.3, { min: 1, max: 3 }, 'custom', share);
    assert.ok(
      Math.abs(split.falseReject + split.recheck - 7.3) < 0.01,
      `share=${share}: tong lech`
    );
  }
});

test('chỉnh ngưỡng chỉ chuyển hàng giữa hai nhánh, không làm tổng nhỏ đi', () => {
  const narrow = splitBurden(7, { min: 1, max: 2 }, 'custom', 15);
  const wide = splitBurden(7, { min: 1, max: 2 }, 'custom', 85);

  assert.ok(narrow.falseReject > wide.falseReject, 'vung xam hep thi bat ao nhieu hon');
  assert.ok(narrow.recheck < wide.recheck, 'vung xam hep thi tai kiem it hon');
  assert.equal(
    round(narrow.falseReject + narrow.recheck),
    round(wide.falseReject + wide.recheck),
    'tong hai truong hop phai bang nhau'
  );
});

const round = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- LỖI SỐ HAI --

test('đòi bỏ sót = 0 thì trả impossible, KHÔNG trả ra con số', () => {
  const result = computeTighteningScenario(
    { miss: { min: 0.5, max: 2 }, totalBurden: 8 },
    'zero',
    []
  );

  assert.equal(result.impossible, true);
  assert.equal(result.newMiss, undefined, 'khong duoc bia ra con so bo sot');
  assert.equal(result.newTotalBurden, undefined, 'khong duoc bia ra con so tai phu');
  assert.equal(result.alternatives.length, 3, 'phai kem 3 phuong an thay the');
});

test('siết bỏ sót n lần thì tổng tải phụ nhân theo hệ số của bảng', () => {
  const factors = [
    { miss_ratio: 2, burden_k: 1.6, label_vi: '', label_en: '' },
    { miss_ratio: 10, burden_k: 5.0, label_vi: '', label_en: '' },
  ];

  const half = computeTighteningScenario(
    { miss: { min: 0.5, max: 2 }, totalBurden: 5 },
    2,
    factors
  );
  assert.equal(half.impossible, false);
  assert.equal(half.newMiss?.max, 1, 'bo sot giam mot nua');
  assert.equal(half.newTotalBurden, 8, '5 x 1.6');

  const tenfold = computeTighteningScenario(
    { miss: { min: 0.5, max: 2 }, totalBurden: 5 },
    10,
    factors,
    CONFIG
  );
  assert.equal(tenfold.newTotalBurden, 25);
  assert.equal(tenfold.exceedsCeiling, true, 'phai canh bao vuot tran thuong mai');
});

// ---------------------------------------------------------------- LỖI SỐ BA --

test('hệ số áp đầy đủ lên bỏ sót và bắt ảo, nhưng dùng căn bậc hai cho tái kiểm', () => {
  const base = problem({ miss_max: 2, false_reject_max: 5, recheck_max: 4 });
  const adjusted = applyModifier(base, 4, CONFIG);

  assert.equal(adjusted.miss.max, 8, 'bo sot: 2 x 4');
  assert.equal(adjusted.falseReject.max, 20, 'bat ao: 5 x 4');
  assert.equal(adjusted.recheck.max, 8, 'tai kiem: 4 x sqrt(4) = 4 x 2');
});

test('tái kiểm tăng chậm hơn hẳn hai chỉ số kia', () => {
  const base = problem({ miss_max: 1, false_reject_max: 1, recheck_max: 1 });
  const adjusted = applyModifier(base, 9, CONFIG);

  assert.equal(adjusted.miss.max, 9);
  assert.equal(adjusted.recheck.max, 3, 'sqrt(9) = 3');
  assert.ok(adjusted.recheck.max < adjusted.miss.max);
});

// ------------------------------------------------------------------- HỆ SỐ --

test('hệ số là tích trung bình cộng của từng dải', () => {
  const result = computeModifierFactor([modifier(1.5, 3.0), modifier(2.0, 3.0)], CONFIG);
  // (1.5+3)/2 = 2.25 ; (2+3)/2 = 2.5 ; 2.25 x 2.5 = 5.625 -> cham tran 5
  assert.equal(result.capped, true);
  assert.equal(result.factor, 5);
});

test('không chọn hệ số nào thì bằng 1', () => {
  const result = computeModifierFactor([], CONFIG);
  assert.equal(result.factor, 1);
  assert.equal(result.capped, false);
  assert.equal(result.shouldLevelUp, false);
});

test('vượt ngưỡng 3,0 thì đề xuất nâng mức', () => {
  assert.equal(computeModifierFactor([modifier(2, 2)], CONFIG).shouldLevelUp, false);
  assert.equal(computeModifierFactor([modifier(2, 2), modifier(2, 2)], CONFIG).shouldLevelUp, true);
});

test('hệ số làm tốt kéo tổng xuống', () => {
  const worse = computeModifierFactor([modifier(2, 2)], CONFIG).factor;
  const mixed = computeModifierFactor([modifier(2, 2), modifier(0.7, 0.7, 'better')], CONFIG).factor;
  assert.ok(mixed < worse);
  assert.equal(mixed, 1.4);
});

test('chỉ số không bao giờ vượt 100%', () => {
  const base = problem({ miss_max: 40, false_reject_max: 50 });
  const adjusted = applyModifier(base, 5, CONFIG);
  assert.ok(adjusted.miss.max <= 100);
  assert.ok(adjusted.falseReject.max <= 100);
});

// --------------------------------------------------------- BỎ TRẠM TÁI KIỂM --

test('bỏ trạm tái kiểm thì r = 0 và bỏ sót tăng 1,5 lần', () => {
  const split = splitBurden(8, { min: 1, max: 2 }, 'no-recheck', undefined, CONFIG);
  assert.equal(split.recheck, 0);
  assert.equal(split.falseReject, 8, 'toan bo tai phu roi vao bat ao');
  assert.equal(split.miss.max, 3, '2 x 1.5');
  assert.equal(split.miss.min, 1.5);
});

test('các chiến lược khác không đụng vào bỏ sót', () => {
  for (const strategy of ['balanced', 'minimize-scrap', 'custom'] as const) {
    const split = splitBurden(8, { min: 1, max: 2 }, strategy, 50, CONFIG);
    assert.equal(split.miss.max, 2, `${strategy} khong duoc doi bo sot`);
  }
});

test('ưu tiên giữ hàng thì phần lớn tải phụ đi vào tái kiểm', () => {
  const split = splitBurden(10, { min: 1, max: 2 }, 'minimize-scrap', undefined, CONFIG);
  assert.equal(split.recheck, 8.5);
  assert.equal(split.falseReject, 1.5);
});

// ------------------------------------------------------------------ CHI PHÍ --

test('quy tải phụ ra người và tiền', () => {
  const cost = computeOperationalCost({
    unitsPerHour: 3600,
    shifts: 2,
    secondsPerCheck: 10,
    annualVolume: 1_000_000,
    unitValue: 50_000,
    falseReject: 2,
    recheck: 5,
  });

  // 3600 sp/gio x 5% = 180 sp can tai kiem; x 10 giay = 1800 giay = 0.5 nguoi/ca
  assert.equal(cost.headcount, 1, '0.5 nguoi moi ca x 2 ca');
  // 1.000.000 x 2% x 50.000 = 1 ty
  assert.equal(cost.annualScrapCost, 1_000_000_000);
});

// -------------------------------------------------------------- HAI TẦNG --

test('kiểm hai tầng: bỏ sót nhân, bắt ảo cộng', () => {
  const result = computeTwoStage({ miss: 2, falseReject: 3 }, { miss: 2, falseReject: 3 });
  assert.equal(result.miss, 0.04, '2% x 2% = 0.04%');
  assert.equal(result.falseReject, 5.91, '3 + 3 - 0.09');
});

test('bắt ảo hai tầng luôn lớn hơn từng tầng, bỏ sót luôn nhỏ hơn', () => {
  const result = computeTwoStage({ miss: 5, falseReject: 4 }, { miss: 3, falseReject: 2 });
  assert.ok(result.miss < 3, 'bo sot phai giam manh');
  assert.ok(result.falseReject > 4, 'bat ao phai tang');
  assert.ok(result.falseReject < 6, 'nhung khong duoc cong don gian don');
});

// -------------------------------------------------------------- ESCAPE --

test('escape trên tổng sản lượng = bỏ sót × tỷ lệ NG đầu vào', () => {
  const ladder = computeEscapeLadder(2, 1);
  assert.equal(ladder.length, 4);
  assert.equal(ladder[0].escapeTarget, 0.02, '2% bo sot x 1% NG = 0.02%');
  assert.equal(ladder[1].escapeTarget, 0.06);
  assert.equal(ladder[2].escapeTarget, 0.12);
  assert.equal(ladder[3].status, 'suspended');
});

// -------------------------------------------------------- ĐỦ MẪU HAY CHƯA --

test('quy tắc số 3: n mẫu sạch chỉ chứng minh được 3/n', () => {
  assert.equal(computeSampleAdequacy(50, 6).provableMiss, 6);
  assert.equal(computeSampleAdequacy(100, 3).provableMiss, 3);
  assert.equal(computeSampleAdequacy(300, 1).provableMiss, 1);
  assert.equal(computeSampleAdequacy(3000, 0.1).provableMiss, 0.1);
});

test('50 mẫu không đủ để cam kết bỏ sót 1%', () => {
  const result = computeSampleAdequacy(50, 1);
  assert.equal(result.isAdequate, false);
  assert.equal(result.provableMiss, 6);
  assert.equal(result.requiredSamples, 300, 'can 300 mau moi chung minh duoc 1%');
});

test('đủ mẫu thì báo đủ', () => {
  assert.equal(computeSampleAdequacy(500, 1).isAdequate, true);
});

test('không có mẫu nào thì không chứng minh được gì', () => {
  const result = computeSampleAdequacy(0, 1);
  assert.equal(result.provableMiss, 100);
  assert.equal(result.isAdequate, false);
});

// ------------------------------------------------- MÔ HÌNH HỖ TRỢ NGƯỜI KIỂM --

test('mô hình hỗ trợ người kiểm cắt phần lớn nhân công', () => {
  const result = computeAssistModel(3600, 10, 2, CONFIG);
  assert.equal(result.autoClearShare, 85);
  assert.equal(result.manualShare, 15);
  assert.equal(result.headcountBefore, 20, 'kiem tay 100%');
  assert.equal(result.headcountAfter, 3, 'chi con 15%');
  assert.ok(result.headcountAfter < result.headcountBefore);
});
