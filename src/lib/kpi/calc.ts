import {
  DEFAULT_KPI_CONFIG,
  type AdjustedTargets,
  type BurdenSplit,
  type BurdenStrategy,
  type EscapeLadderRow,
  type KpiConfig,
  type Modifier,
  type ModifierResult,
  type OperationalCost,
  type ProblemType,
  type Range,
  type SampleAdequacy,
  type TighteningFactor,
  type TighteningScenario,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * Nhân dồn các hệ số điều chỉnh đã chọn.
 *
 * Dùng trung bình cộng của (min, max) mỗi hệ số. Kết quả bị chặn ở modifier_cap
 * vì nhân dồn 5-6 hệ số sẽ ra con số vô lý — thực tế các điều kiện xấu chồng lên
 * nhau không nhân tuyến tính mãi được.
 *
 * Vượt level_up_threshold nghĩa là bài toán đã khác hẳn loại ban đầu: nên chọn
 * lại một loại khó hơn thay vì tiếp tục nhân hệ số lên loại dễ.
 */
export function computeModifierFactor(
  selected: Modifier[],
  config: KpiConfig = DEFAULT_KPI_CONFIG
): ModifierResult {
  const raw = selected.reduce(
    (acc, modifier) => acc * ((modifier.factor_min + modifier.factor_max) / 2),
    1
  );

  const capped = raw > config.modifier_cap;
  const factor = capped ? config.modifier_cap : raw;

  return {
    factor: round(factor, 3),
    capped,
    shouldLevelUp: raw > config.level_up_threshold,
  };
}

/**
 * Áp hệ số vào dải chỉ tiêu cơ sở.
 *
 * Hệ số áp ĐẦY ĐỦ lên bỏ sót và bắt ảo, nhưng lên tái kiểm thì dùng số mũ
 * recheck_exponent (mặc định 0,5 = căn bậc hai): tái kiểm tăng chậm hơn hai chỉ
 * số kia. Điều kiện xấu làm máy sai nhiều hơn, nhưng phần "máy không chắc" thì
 * không nở ra cùng tốc độ.
 *
 * Trần tổng tải phụ cũng giãn theo hệ số — nó là đặc tính của bài toán trong
 * điều kiện cụ thể, không phải hằng số tuyệt đối.
 */
export function applyModifier(
  base: ProblemType,
  factor: number,
  config: KpiConfig = DEFAULT_KPI_CONFIG
): AdjustedTargets {
  const recheckFactor = Math.pow(factor, config.recheck_exponent);
  const scale = (value: number, f: number) => round(clamp(value * f, 0, 100));

  return {
    miss: { min: scale(base.miss_min, factor), max: scale(base.miss_max, factor) },
    falseReject: {
      min: scale(base.false_reject_min, factor),
      max: scale(base.false_reject_max, factor),
    },
    recheck: {
      min: scale(base.recheck_min, recheckFactor),
      max: scale(base.recheck_max, recheckFactor),
    },
    totalBurden: scale(base.total_burden_max, factor),
  };
}

/**
 * Chia tổng tải phụ thành bắt ảo và tái kiểm.
 *
 * ĐÂY LÀ Ý NIỆM CỐT LÕI CỦA CẢ MODULE: bắt ảo và tái kiểm là hai nhánh LOẠI TRỪ
 * NHAU của cùng một nhóm sản phẩm — những cái máy không đủ tự tin nói OK. Chỉnh
 * ngưỡng không làm nhóm đó nhỏ đi, chỉ chuyển chúng giữa hai nhánh.
 *
 * Vì vậy hàm này luôn phân bổ ĐÚNG tổng tải phụ, không bao giờ cộng dồn vượt
 * trần. Người dùng chỉ đang chọn phần đó đi vào thùng loại hay đi vào bàn kiểm.
 *
 * Riêng 'no-recheck': bỏ vùng xám là mất vùng đệm an toàn, nên bỏ sót tăng lên
 * theo no_recheck_miss_multiplier.
 */
export function splitBurden(
  totalBurden: number,
  miss: Range,
  strategy: BurdenStrategy,
  customRecheckShare?: number,
  config: KpiConfig = DEFAULT_KPI_CONFIG
): BurdenSplit {
  const burden = Math.max(0, totalBurden);

  let recheckShare: number;
  let adjustedMiss = miss;

  switch (strategy) {
    case 'no-recheck':
      recheckShare = 0;
      adjustedMiss = {
        min: round(clamp(miss.min * config.no_recheck_miss_multiplier, 0, 100)),
        max: round(clamp(miss.max * config.no_recheck_miss_multiplier, 0, 100)),
      };
      break;

    case 'minimize-scrap':
      recheckShare = 1 - config.minimize_scrap_false_reject_share;
      break;

    case 'custom':
      recheckShare = clamp((customRecheckShare ?? 50) / 100, 0, 1);
      break;

    case 'balanced':
    default:
      recheckShare = 0.5;
      break;
  }

  const recheck = round(burden * recheckShare);
  // Lấy phần bù thay vì nhân lại, để tổng luôn khớp đúng sau khi làm tròn.
  const falseReject = round(burden - recheck);

  return {
    falseReject,
    recheck,
    miss: adjustedMiss,
    clampedToCeiling: false,
  };
}

/**
 * Quy tải phụ ra người và tiền.
 *
 * headcount   = (sp/giờ × tái kiểm% × giây kiểm mỗi sp) / 3600 × số ca
 * annualScrap = sản lượng năm × bắt ảo% × giá trị một sp
 *
 * Đây là con số làm khách hàng gật hay lắc đầu — chỉ tiêu kỹ thuật đúng nhưng
 * tốn 2 người mỗi ca thì dự án vẫn trượt.
 */
export function computeOperationalCost(input: {
  unitsPerHour: number;
  shifts: number;
  secondsPerCheck: number;
  annualVolume: number;
  unitValue: number;
  falseReject: number;
  recheck: number;
}): OperationalCost {
  const rechecksPerHour = input.unitsPerHour * (input.recheck / 100);
  const headcount = (rechecksPerHour * input.secondsPerCheck) / 3600 * input.shifts;
  const annualScrapCost = input.annualVolume * (input.falseReject / 100) * input.unitValue;

  return {
    headcount: round(headcount, 1),
    annualScrapCost: Math.round(annualScrapCost),
  };
}

/**
 * Kịch bản khách đòi siết bỏ sót.
 *
 * Siết bỏ sót không miễn phí: ngưỡng chặt hơn thì nhiều hàng tốt bị nghi ngờ
 * hơn, tổng tải phụ nhân lên theo hệ số k tra từ bảng.
 *
 * Đòi bỏ sót = 0 là yêu cầu KHÔNG TỒN TẠI về mặt toán học — không có ngưỡng nào
 * cho bỏ sót bằng 0 mà bắt ảo hữu hạn. Trả về impossible thay vì bịa ra một con
 * số, kèm ba phương án thay thế dùng được thật.
 */
export function computeTighteningScenario(
  base: { miss: Range; totalBurden: number },
  ratio: number | 'zero',
  factors: TighteningFactor[],
  config: KpiConfig = DEFAULT_KPI_CONFIG
): TighteningScenario {
  const alternatives: TighteningScenario['alternatives'] = [
    'per-defect-class',
    'zero-auto-pass',
    'two-stage',
  ];

  if (ratio === 'zero' || !Number.isFinite(ratio as number)) {
    return { impossible: true, alternatives };
  }

  const factor = factors.find((entry) => entry.miss_ratio === ratio);
  if (!factor) return { impossible: true, alternatives };

  const newTotalBurden = round(base.totalBurden * factor.burden_k);

  return {
    impossible: false,
    newMiss: {
      min: round(base.miss.min / factor.miss_ratio, 3),
      max: round(base.miss.max / factor.miss_ratio, 3),
    },
    newTotalBurden,
    exceedsCeiling: newTotalBurden > config.commercial_ceiling,
    alternatives,
  };
}

/**
 * Kiểm hai tầng bằng hai hệ thống ĐỘC LẬP.
 *
 * Kiến trúc: một trong hai hệ loại thì sản phẩm bị loại.
 *   bỏ sót   = m1 × m2         (cả hai cùng bỏ sót mới lọt)
 *   bắt ảo   = f1 + f2 − f1×f2 (một trong hai bắt nhầm là đủ)
 *
 * CẢNH BÁO BẮT BUỘC HIỂN THỊ: phép nhân chỉ đúng khi hai hệ thực sự độc lập —
 * khác nguyên lý, khác góc chụp, khác ánh sáng. Cùng camera cùng ánh sáng chỉ
 * khác thuật toán thì chúng sai ở cùng những mẫu, m1 × m2 sẽ cho con số đẹp
 * hơn thực tế rất nhiều và đó là cái bẫy nguy hiểm nhất của phương án này.
 */
export function computeTwoStage(
  s1: { miss: number; falseReject: number },
  s2: { miss: number; falseReject: number }
): { miss: number; falseReject: number } {
  const m1 = s1.miss / 100;
  const m2 = s2.miss / 100;
  const f1 = s1.falseReject / 100;
  const f2 = s2.falseReject / 100;

  return {
    miss: round(m1 * m2 * 100, 4),
    falseReject: round((f1 + f2 - f1 * f2) * 100, 3),
  };
}

/**
 * Tỷ lệ lọt trên TỔNG SẢN LƯỢNG theo tỷ lệ NG đầu vào.
 *
 *   escape = bỏ sót × p
 *
 * Phân biệt hai thứ khách hay nhầm: bỏ sót tính trên số hàng NG thật, còn escape
 * tính trên tổng sản lượng. Chất lượng đầu vào xấu đi thì escape tăng dù hệ
 * thống không hề kém đi — đó là lý do phải có bảng bậc thang và điều khoản
 * re-baseline.
 */
export function computeEscapeLadder(miss: number, p0: number): EscapeLadderRow[] {
  const bands: { pRange: string; pMin: number; pMax: number | null; at: number; status: EscapeLadderRow['status'] }[] = [
    { pRange: 'p ≤ 1%', pMin: 0, pMax: 1, at: 1, status: 'normal' },
    { pRange: '1% < p ≤ 3%', pMin: 1, pMax: 3, at: 3, status: 'standard' },
    { pRange: '3% < p ≤ 6%', pMin: 3, pMax: 6, at: 6, status: 'warning' },
    { pRange: 'p > 6%', pMin: 6, pMax: null, at: Math.max(p0, 6), status: 'suspended' },
  ];

  return bands.map((band) => ({
    pRange: band.pRange,
    pMin: band.pMin,
    pMax: band.pMax,
    escapeTarget: round((miss / 100) * band.at, 4),
    status: band.status,
  }));
}

/**
 * Quy tắc số 3.
 *
 * Chạy n mẫu NG mà bắt đúng hết thì giới hạn trên của bỏ sót ở khoảng tin cậy
 * 95% xấp xỉ 3/n. Nghĩa là 50 mẫu sạch chỉ chứng minh được "bỏ sót ≤ 6%" —
 * không đủ để cam kết 1%.
 *
 * Đây là chỗ nhiều dự án hứa liều: cam kết con số mà số mẫu trong tay không đủ
 * để chứng minh, rồi đến FAT mới phát hiện.
 */
export function computeSampleAdequacy(
  availableNgSamples: number,
  committedMiss: number
): SampleAdequacy {
  const provableMiss = availableNgSamples > 0 ? round((3 / availableNgSamples) * 100, 3) : 100;
  const requiredSamples = committedMiss > 0 ? Math.ceil(300 / committedMiss) : Infinity;

  return {
    provableMiss,
    requiredSamples,
    isAdequate: availableNgSamples > 0 && provableMiss <= committedMiss,
  };
}

/**
 * Mô hình "hỗ trợ người kiểm" — lối ra khi tổng tải phụ vượt trần thương mại.
 *
 * Thay vì bán "thay thế người kiểm" rồi trượt nghiệm thu, bán đúng thứ hệ thống
 * làm được: lọc phần hàng chắc chắn OK, người chỉ kiểm phần còn lại. Vẫn tiết
 * kiệm phần lớn nhân công mà không phải cam kết con số không đạt được.
 */
export function computeAssistModel(
  unitsPerHour: number,
  secondsPerCheck: number,
  shifts: number,
  config: KpiConfig = DEFAULT_KPI_CONFIG
): { autoClearShare: number; manualShare: number; headcountBefore: number; headcountAfter: number } {
  const autoClearShare = config.assist_model_auto_clear_share;
  const manualShare = round(100 - autoClearShare);

  const headcountFor = (share: number) =>
    round((unitsPerHour * (share / 100) * secondsPerCheck) / 3600 * shifts, 1);

  return {
    autoClearShare,
    manualShare,
    headcountBefore: headcountFor(100),
    headcountAfter: headcountFor(manualShare),
  };
}
