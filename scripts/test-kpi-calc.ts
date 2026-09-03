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
  computeRecheckFeasibility,
  findContractBlockers,
  resolveCeiling,
  splitBurden,
} from '../src/lib/kpi/calc';
import { digitsOnly, parseNumber, parseShifts } from '../src/lib/kpi/input';
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
    CONFIG.commercial_ceiling
  );
  assert.equal(tenfold.newTotalBurden, 25);
  assert.equal(tenfold.exceedsCeiling, true, 'phai canh bao vuot tran thuong mai');
});

test('cảnh báo vượt trần dùng đúng trần của dự án, không dùng cứng 8%', () => {
  const factors = [{ miss_ratio: 2, burden_k: 1.6, label_vi: '', label_en: '' }];

  // Tong tai phu moi = 5 x 1.6 = 8: vuot tran 8 thi khong, vuot tran 10 thi khong.
  const strict = computeTighteningScenario(
    { miss: { min: 0.5, max: 2 }, totalBurden: 5.7 },
    2,
    factors,
    CONFIG.commercial_ceiling
  );
  const relaxed = computeTighteningScenario(
    { miss: { min: 0.5, max: 2 }, totalBurden: 5.7 },
    2,
    factors,
    CONFIG.commercial_ceiling_unclear_spec
  );

  assert.equal(strict.newTotalBurden, 9.12);
  assert.equal(strict.exceedsCeiling, true, 'vuot tran 8%');
  assert.equal(relaxed.exceedsCeiling, false, 'chua vuot tran 10% khi spec chua ro');
});

// ---------------------------------------------------------------- LỖI SỐ BA --

test('hệ số áp đầy đủ lên cả ba chỉ số', () => {
  const base = problem({ miss_max: 2, false_reject_max: 5, recheck_max: 4 });
  const adjusted = applyModifier(base, 4, CONFIG);

  assert.equal(adjusted.miss.max, 8, 'bo sot: 2 x 4');
  assert.equal(adjusted.falseReject.max, 20, 'bat ao: 5 x 4');
  assert.equal(adjusted.recheck.max, 16, 'tai kiem: 4 x 4 — khong dung can bac hai');
});

test('số mũ tái kiểm vẫn chỉnh được nếu dữ liệu dự án cho thấy khác', () => {
  const base = problem({ recheck_max: 4 });
  const withSqrt = applyModifier(base, 4, { ...CONFIG, recheck_exponent: 0.5 });
  assert.equal(withSqrt.recheck.max, 8, 'so mu 0.5 van hoat dong khi co ai do doi lai');
});

test('dải điển hình và kết quả chia là hai thứ khác nhau, không được coi là một', () => {
  // Doi lai so mu ve 0.5 se lam dai hien thi mau thuan voi ket qua chia —
  // day chinh la ly do bo no. Test nay chot lai quan he giua hai dai luong.
  const base = problem({ recheck_max: 4, total_burden_max: 8 });
  const adjusted = applyModifier(base, 2, CONFIG);
  const split = splitBurden(adjusted.totalBurden, adjusted.miss, 'balanced', undefined, CONFIG);

  assert.equal(adjusted.totalBurden, 16, 'tran tai phu gian theo he so');
  assert.equal(split.recheck + split.falseReject, 16, 'chia dung tong');
  assert.ok(
    split.recheck <= adjusted.recheck.max,
    `voi so mu 1.0 va phuong an can bang, ket qua chia (${split.recheck}) khong duoc vuot dai (${adjusted.recheck.max})`
  );
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

// ------------------------------------------------- CHẶN SINH ĐIỀU KHOẢN --

const noBlockers = {
  miss: 1.5,
  totalBurden: 5,
  ceiling: 8,
  specialKpi: null,
  sampleAdequacy: null,
};

test('trường hợp bình thường thì không chặn gì', () => {
  assert.deepEqual(findContractBlockers(noBlockers), []);
});

test('chặn khi dải bỏ sót bằng 0 — không cam kết điều bất khả thi', () => {
  // barcode-good va robot-guidance trong seed deu co miss_min = miss_max = 0
  assert.deepEqual(findContractBlockers({ ...noBlockers, miss: 0 }), ['zero-miss']);
});

test('chặn khi loại bài toán có KPI riêng', () => {
  assert.deepEqual(findContractBlockers({ ...noBlockers, specialKpi: 'robot_guidance' }), [
    'special-kpi',
  ]);
  assert.deepEqual(findContractBlockers({ ...noBlockers, specialKpi: 'code_reading' }), [
    'special-kpi',
  ]);
});

test('chặn khi tổng tải phụ vượt trần', () => {
  assert.deepEqual(findContractBlockers({ ...noBlockers, totalBurden: 9 }), ['over-ceiling']);
  // Tran noi len 10% thi 9% khong con bi chan
  assert.deepEqual(findContractBlockers({ ...noBlockers, totalBurden: 9, ceiling: 10 }), []);
});

test('chặn khi số mẫu NG không đủ chứng minh mức cam kết', () => {
  const notEnough = computeSampleAdequacy(50, 1);
  assert.deepEqual(findContractBlockers({ ...noBlockers, sampleAdequacy: notEnough }), [
    'insufficient-samples',
  ]);

  const enough = computeSampleAdequacy(500, 1);
  assert.deepEqual(findContractBlockers({ ...noBlockers, sampleAdequacy: enough }), []);
});

test('nhiều rào cản cùng lúc thì liệt kê hết, không dừng ở cái đầu', () => {
  const blockers = findContractBlockers({
    miss: 0,
    totalBurden: 12,
    ceiling: 8,
    specialKpi: 'code_reading',
    sampleAdequacy: computeSampleAdequacy(10, 1),
  });

  assert.equal(blockers.length, 4, `chi thay: ${blockers.join(', ')}`);
});

// --------------------------------------------- BẮT ẢO TUẦN ĐẦU NHÂN HỆ SỐ --

test('bắt ảo tuần đầu nhân cùng hệ số với bắt ảo cam kết', () => {
  const base = problem({ false_reject_week1_min: 10, false_reject_week1_max: 18 });
  const adjusted = applyModifier(base, 2, CONFIG);

  assert.equal(adjusted.falseRejectWeek1.min, 20);
  assert.equal(adjusted.falseRejectWeek1.max, 36);
});

test('tuần đầu luôn lớn hơn cam kết ở phương án cân bằng', () => {
  // Day la dieu ma dieu khoan khang dinh — phai dung, khong duoc de no nguoc lai.
  const base = problem({
    false_reject_week1_min: 10,
    false_reject_week1_max: 18,
    total_burden_max: 8,
  });

  for (const factor of [1, 2, 3, 5]) {
    const adjusted = applyModifier(base, factor, CONFIG);
    const split = splitBurden(adjusted.totalBurden, adjusted.miss, 'balanced', undefined, CONFIG);
    assert.ok(
      adjusted.falseRejectWeek1.max > split.falseReject,
      `he so ${factor}: tuan dau ${adjusted.falseRejectWeek1.max} phai > cam ket ${split.falseReject}`
    );
  }
});

// ------------------------------------------------------------ TRẦN THƯƠNG MẠI --

test('tiêu chuẩn chưa rõ ràng thì nới trần thương mại lên 10%', () => {
  assert.equal(resolveCeiling(false, CONFIG), 8);
  assert.equal(resolveCeiling(true, CONFIG), 10);
});

// --------------------------------------------------------- TRẦN NHÂN LỰC --

test('trạm tái kiểm vượt nhân lực hiện có thì báo không khả thi', () => {
  // 3600 sp/gio, tai kiem 10% = 360 sp/gio, moi sp 10 giay -> 1 nguoi/ca x 2 ca = 2 nguoi
  const result = computeRecheckFeasibility({
    unitsPerHour: 3600,
    shifts: 2,
    secondsPerCheck: 10,
    recheck: 10,
    availableHeadcount: 1,
  });

  assert.equal(result.requiredHeadcount, 2);
  assert.equal(result.isFeasible, false);
  assert.ok(result.forcedToFalseReject > 0, 'phan vuot phai chuyen sang bat ao');
});

test('đủ người thì báo khả thi và không phải đẩy sang bắt ảo', () => {
  const result = computeRecheckFeasibility({
    unitsPerHour: 3600,
    shifts: 2,
    secondsPerCheck: 10,
    recheck: 10,
    availableHeadcount: 3,
  });

  assert.equal(result.isFeasible, true);
  assert.equal(result.forcedToFalseReject, 0);
});

test('mức tái kiểm khả thi tối đa tỷ lệ thuận với số người', () => {
  const forHeadcount = (n: number) =>
    computeRecheckFeasibility({
      unitsPerHour: 3600,
      shifts: 1,
      secondsPerCheck: 10,
      recheck: 50,
      availableHeadcount: n,
    }).maxFeasibleRecheck;

  assert.equal(forHeadcount(1), 10, '1 nguoi kiem duoc 360/3600 = 10%');
  assert.equal(forHeadcount(2), 20);
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

// -------------------------------------------------------- ĐỌC SỐ TỪ Ô NHẬP --

test('ô số lớn hiểu đúng dấu phân cách nghìn kiểu Việt Nam', () => {
  // "50.000" là năm mươi nghìn đồng. Number("50.000") ra 50 — sai một nghìn lần
  // và không có gì báo, chi phí phế hàng năm chỉ hiện ra bé đi.
  assert.equal(Number(digitsOnly('50.000')), 50_000);
  assert.equal(Number(digitsOnly('1.200.000')), 1_200_000);
  assert.equal(Number(digitsOnly('50,000')), 50_000, 'dau phay cung phai hieu');
  assert.equal(Number(digitsOnly('50 000 ')), 50_000, 'dau cach cung phai hieu');
  assert.equal(digitsOnly(''), '', 'o trong van phai la o trong');
});

test('số ca không bao giờ nhỏ hơn 1', () => {
  assert.equal(parseShifts('0'), 1, 'so ca 0 se lam moi chi phi ra 0 dong');
  assert.equal(parseShifts(''), 1, 'bo trong thi coi nhu 1 ca');
  assert.equal(parseShifts('-2'), 1);
  assert.equal(parseShifts('abc'), 1);
  assert.equal(parseShifts('3'), 3, 'gia tri hop le giu nguyen');
});

test('ô trống khác với số 0 người dùng cố ý nhập', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('   '), null);
  assert.equal(parseNumber('0'), 0);
  assert.equal(parseNumber('khong phai so'), null);
});
