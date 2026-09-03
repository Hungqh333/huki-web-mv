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
  type ContractBlocker,
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
 * Hệ số áp đầy đủ lên cả ba chỉ số (recheck_exponent mặc định 1,0). Trần tổng
 * tải phụ cũng giãn theo — nó là đặc tính của bài toán trong điều kiện cụ thể,
 * không phải hằng số tuyệt đối.
 *
 * LƯU Ý khi đọc kết quả: ba dải trả về ở đây là dải cam kết ĐIỂN HÌNH của loại
 * bài toán, không phải kết quả cuối. Con số thật do splitBurden quyết định theo
 * phương án chia mà người dùng chọn, và nó có thể nằm ngoài dải này khi chọn
 * phương án lệch hẳn về một phía. Giao diện phải trình bày hai thứ đó tách bạch,
 * đừng để người dùng thấy hai con số đá nhau.
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
    // Nhân cùng hệ số với bắt ảo cam kết: điều kiện xấu đi thì tuần đầu cũng
    // xấu đi theo, không có lý do gì nó đứng yên.
    falseRejectWeek1: {
      min: scale(base.false_reject_week1_min, factor),
      max: scale(base.false_reject_week1_max, factor),
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
  // Trần đã được giải quyết theo bối cảnh dự án (8% hoặc 10% khi tiêu chuẩn
  // chưa rõ ràng). Trước đây hàm này dùng thẳng config.commercial_ceiling nên
  // giao diện cảnh báo "vượt trần 10%" cho một con số 9%.
  ceiling: number = DEFAULT_KPI_CONFIG.commercial_ceiling
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
    exceedsCeiling: newTotalBurden > ceiling,
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
 * Những lý do KHÔNG được sinh điều khoản hợp đồng.
 *
 * Đây là chốt chặn quan trọng nhất của module. Bốn trường hợp dưới đây đều cho
 * ra con số đúng về mặt tính toán nhưng biến thành cam kết pháp lý thì sai:
 *
 * - zero-miss: dải bỏ sót bằng 0 (barcode in tốt, dẫn hướng robot). In ra
 *   "bỏ sót ≤ 0%" là cam kết đúng cái điều mà chính module này tuyên bố không
 *   tồn tại về mặt toán học.
 * - special-kpi: loại bài toán có KPI riêng (độ lặp lại, tỷ lệ gắp, no-read).
 *   Bộ chỉ số bỏ sót/bắt ảo không mô tả đúng bài toán đó.
 * - over-ceiling: tổng tải phụ vượt trần thương mại. Cam kết một con số mà
 *   chính công cụ vừa cảnh báo là dự án sẽ trượt nghiệm thu vì chi phí.
 * - insufficient-samples: số mẫu NG hiện có không đủ chứng minh mức đang cam
 *   kết ở FAT. Đây đúng là kiểu "hứa liều rồi đến FAT mới phát hiện".
 */
export function findContractBlockers(input: {
  miss: number;
  totalBurden: number;
  ceiling: number;
  specialKpi: string | null;
  sampleAdequacy: SampleAdequacy | null;
}): ContractBlocker[] {
  const blockers: ContractBlocker[] = [];

  if (input.miss <= 0) blockers.push('zero-miss');
  if (input.specialKpi) blockers.push('special-kpi');
  if (input.totalBurden > input.ceiling) blockers.push('over-ceiling');
  if (input.sampleAdequacy && !input.sampleAdequacy.isAdequate) {
    blockers.push('insufficient-samples');
  }

  return blockers;
}

/**
 * Trần thương mại áp dụng cho dự án này.
 *
 * Khi tiêu chuẩn còn chưa rõ — chưa có danh mục lỗi đóng, chưa có mẫu giới hạn,
 * hoặc còn phụ thuộc cảm nhận người chấm — thì nới trần, vì hai bên đều biết
 * còn phải hiệu chỉnh sau ramp-up.
 */
export function resolveCeiling(
  specIsUnclear: boolean,
  config: KpiConfig = DEFAULT_KPI_CONFIG
): number {
  return specIsUnclear ? config.commercial_ceiling_unclear_spec : config.commercial_ceiling;
}

/**
 * Kiểm tra trạm tái kiểm có khả thi với nhân lực hiện có không.
 *
 * ĐÂY LÀ THỨ THẬT SỰ GIỚI HẠN TÁI KIỂM. Trước đây mô hình dùng căn bậc hai của
 * hệ số để "tái kiểm tăng chậm hơn" — nhưng về thống kê thì vùng xám PHÌNH TO
 * khi điều kiện xấu đi chứ không co lại. Quan sát thực tế đến từ chỗ khác: không
 * ai đẩy được 30% sản lượng sang bàn kiểm tay.
 *
 * Nói thẳng ra thành số người là trung thực hơn, và cho người dùng một con số
 * đàm phán được thay vì một hằng số vô hình trong công thức.
 */
export function computeRecheckFeasibility(input: {
  unitsPerHour: number;
  shifts: number;
  secondsPerCheck: number;
  recheck: number;
  availableHeadcount: number;
}) {
  const perPersonPerHour = input.secondsPerCheck > 0 ? 3600 / input.secondsPerCheck : 0;

  const requiredHeadcount = round(
    (input.unitsPerHour * (input.recheck / 100) * input.secondsPerCheck) / 3600 * input.shifts,
    1
  );

  // Số sản phẩm mỗi giờ mà nhân lực hiện có kiểm được, quy về % sản lượng.
  const capacityPerHour = perPersonPerHour * (input.availableHeadcount / Math.max(input.shifts, 1));
  const maxFeasibleRecheck =
    input.unitsPerHour > 0 ? round(clamp((capacityPerHour / input.unitsPerHour) * 100, 0, 100)) : 0;

  const isFeasible = requiredHeadcount <= input.availableHeadcount + 1e-9;

  return {
    requiredHeadcount,
    availableHeadcount: input.availableHeadcount,
    isFeasible,
    maxFeasibleRecheck,
    forcedToFalseReject: isFeasible ? 0 : round(Math.max(0, input.recheck - maxFeasibleRecheck)),
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
