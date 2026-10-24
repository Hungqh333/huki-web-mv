/**
 * SỔ TAY CÔNG THỨC — mọi phép tính thiết bị của Machine Vision Hub trên một trang
 * (chốt 2026-10-20: "chỉ mình tôi biết", chỉ admin xem — trang /admin/cong-thuc).
 *
 * Chỉ trang máy chủ (server component) được import file này — KHÔNG import từ file
 * 'use client', nếu không nội dung sổ tay sẽ theo JavaScript xuống trình duyệt
 * (scripts/test-formula-book.ts kiểm điều này).
 *
 * Giữ khớp với code bằng ba cách:
 * - Hằng số lấy thẳng từ module engine (import), không gõ lại số.
 * - Ngưỡng sửa qua admin khai bằng khoá `params` — trang hiện GIÁ TRỊ ĐANG CHẠY.
 * - Test bắt buộc: mọi mã luật trong RULES và mọi khoá ENGINE_PARAMS phải có mặt
 *   trong sổ tay. Thêm luật / ngưỡng mới mà quên ghi vào đây thì test đỏ.
 *
 * Chữ chỉ tiếng Việt: đây là tài liệu nội bộ cho người duyệt kỹ thuật, không phải
 * giao diện khách hàng.
 */
import { DEFAULT_CAMERAS_PER_PC, PC_BANDWIDTH_HEADROOM } from '@/lib/components/pc';
import { CYCLE_DEFAULTS, DOF_FASTEST_PRACTICAL_F } from '@/lib/vision/configurationRules';
import type { EngineParamKey } from '@/lib/vision/engineParams';
import { UNKNOWN_SCORE } from '@/lib/vision/feasibility';
import { K_STITCH } from '@/lib/vision/mechanics';
import { STANDARD_CONVERTER_FACTORS, STANDARD_TUBE_LENGTHS_MM } from '@/lib/vision/lensSelector';
import { DEFAULT_CIRCLE_OF_CONFUSION_PX, WAVELENGTH_UM } from '@/lib/vision/optics';
import { K_BLUR, STROBE_EXPOSURE_LIMIT_US, BYTES_PER_PX } from '@/lib/vision/requirementAnalysis';
import { DEFAULT_PX_PER_DEFECT, GRR_DIVISOR, K_SUBPIXEL } from '@/lib/vision/resolution';
import type { Evidence } from '@/lib/vision/rules';
import { LEAD_TIME_ZERO_DAYS, MARGIN_FULL_SCORE, PRIOR_USE_FULL } from '@/lib/vision/solutionLevels';
import { TIME_BUDGET_SAFETY } from '@/lib/vision/timing';
import { LIGHT_WAVELENGTH_NM } from '@/lib/vision/lightColor';

/** Trang dùng công thức. */
export type FormulaPage = 'design' | 'lens' | 'light' | 'oldSelector' | 'pc' | 'kpi';

export const PAGE_LABEL: Record<FormulaPage, { label: string; href: string }> = {
  design: { label: 'Thiết kế hệ thống', href: '/thiet-ke-he-thong/yeu-cau' },
  lens: { label: 'Chọn ống kính', href: '/chon-ong-kinh' },
  light: { label: 'Chọn đèn', href: '/chon-den' },
  oldSelector: { label: 'Bộ chọn thiết bị (cũ)', href: '/cong-cu-chon-thiet-bi' },
  pc: { label: 'Máy tính (PC)', href: '/cong-cu-may-tinh' },
  kpi: { label: 'Bộ tính chỉ tiêu', href: '/cong-cu-chi-tieu' },
};

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  calculated: 'Công thức vật lý',
  'rule-of-thumb': 'Kinh nghiệm ngành',
  'requires-sample-test': 'Phải chụp mẫu',
  unknown: 'Thiếu dữ liệu',
};

export type FormulaEntry = {
  /** Mã luật engine (RES-001…) hoặc mã sổ tay (ASM-…, LNS-…). */
  id: string;
  title: string;
  /** Các mã luật engine mục này mô tả — test dùng để chắc mọi luật đều có trong sổ. */
  rules?: string[];
  formula: string[];
  /** Kết luận Đạt / Cảnh báo / Loại. */
  verdict?: string[];
  notes?: string[];
  /** Ngưỡng sửa được qua admin — trang hiện giá trị đang chạy. */
  params?: EngineParamKey[];
  /** Hằng số cố định trong code. */
  constants?: { name: string; value: string | number }[];
  evidence?: Evidence;
  usedIn: FormulaPage[];
  /** File : hàm trong mã nguồn. */
  source: string;
  /** Mục có bảng sống đọc từ database (vẽ riêng trên trang). */
  liveTable?: 'defaults' | 'lighting' | 'lightColor' | 'lightMatrix';
};

export type FormulaSection = { key: string; title: string; intro?: string; entries: FormulaEntry[] };

const DESIGN_ONLY: FormulaPage[] = ['design'];

export const FORMULA_BOOK: readonly FormulaSection[] = [
  // ───────────────────────────────────────────────────────────── 1. ĐẦU VÀO ──
  {
    key: 'inputs',
    title: '1. Đầu vào & giả định',
    intro:
      'Ô trống trên bảng Yêu cầu được điền tạm trước khi tính — mọi giả định hiện trên panel Giả định của trang và ghi vào luật dùng nó (inputsAssumed). Bản nháp của khách KHÔNG bị ghi đè.',
    entries: [
      {
        id: 'ASM-DEFAULT',
        title: 'Giá trị mặc định cho ô còn trống',
        formula: ['ô trống → giá trị trong bảng Giả định mặc định (sửa ở Quản trị → Giả định mặc định)'],
        notes: ['Độ tương phản mặc định "thấp" là phía xấu: N px/lỗi lớn nhất → camera nhiều pixel nhất.'],
        liveTable: 'defaults',
        usedIn: DESIGN_ONLY,
        source: 'requirement/assumptions.ts : applyDefaults · vision/engineTables.ts',
      },
      {
        id: 'ASM-ALPHA',
        title: 'Hệ số giãn nở α suy từ vật liệu',
        formula: ['α trống + đã chọn vật liệu → α = α của vật liệu đó (ưu tiên trước giá trị mặc định)'],
        params: ['alphaAluminium', 'alphaSteel', 'alphaStainless', 'alphaPlastic'],
        notes: ['Nhựa lấy phía xấu của dải (chốt 2026-09-14).'],
        usedIn: DESIGN_ONLY,
        source: 'requirement/assumptions.ts : applyDefaults',
      },
      {
        id: 'ASM-SPAN',
        title: 'Chiều dài kích thước cần đo',
        formula: ['có dung sai đo + chiều dài đo trống → L = max(vật rộng, vật cao)'],
        notes: ['Phía xấu: kích thước đo không thể dài hơn vật. Dùng cho MEC-001, MEC-003.'],
        usedIn: DESIGN_ONLY,
        source: 'requirement/assumptions.ts : applyDefaults',
      },
      {
        id: 'ASM-SEAM',
        title: 'Kích thước đo vắt qua đường ghép camera',
        formula: ['số camera > 1 + có dung sai + câu "vắt qua đường ghép" trống → coi là CÓ'],
        notes: ['Phía xấu: loại bài dễ trượt nhất không được bỏ qua phép kiểm MEC-003.'],
        usedIn: DESIGN_ONLY,
        source: 'requirement/assumptions.ts : applyDefaults',
      },
      {
        id: 'ASM-PPM',
        title: 'Nhịp sản xuất',
        formula: ['ppm = sản phẩm/phút; nếu chỉ có takt (giây) thì ppm = 60 ÷ takt'],
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : analyseRequirement',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── 2. ĐỘ PHÂN GIẢI ──
  {
    key: 'resolution',
    title: '2. Độ phân giải & số camera',
    entries: [
      {
        id: 'RES-001',
        title: 'Nhánh phát hiện lỗi — mm/px cần',
        rules: ['RES-001'],
        formula: ['m_phát hiện = d_min ÷ N', 'N theo độ tương phản: cao / vừa / thấp (chưa rõ = thấp)', 'nhiều loại lỗi → lấy m nhỏ nhất'],
        params: ['pxPerDefectHigh', 'pxPerDefectMedium', 'pxPerDefectLow'],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : RES-001',
      },
      {
        id: 'RES-006',
        title: 'Độ tương phản chưa xác nhận',
        rules: ['RES-006'],
        formula: ['tương phản chưa được khách nêu (kể cả đang giả định) → nhắc chụp mẫu'],
        verdict: ['Luôn CẢNH BÁO'],
        evidence: 'requires-sample-test',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : RES-006',
      },
      {
        id: 'RES-002',
        title: 'Nhánh đo lường — ngân sách sai số',
        rules: ['RES-002'],
        formula: ['T = 2 × t   (t là dung sai dạng ±)', 'U = T ÷ GRR', 'm_đo = U × k_subpixel', 'nhiều dung sai → lấy t nhỏ nhất'],
        constants: [
          { name: 'GRR (Gage R&R, không mở qua admin)', value: GRR_DIVISOR },
          { name: 'k_subpixel (không mở qua admin)', value: K_SUBPIXEL },
        ],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/resolution.ts : measurementBudget',
      },
      {
        id: 'RES-003',
        title: 'Nhánh quyết định',
        rules: ['RES-003'],
        formula: ['m_cần = min(m_phát hiện, m_đo)'],
        notes: ['Lấy MIN, không lấy trung bình: hệ thống phải thoả cả hai tiêu chí.'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : RES-003',
      },
      {
        id: 'RES-005',
        title: 'Chia vùng nhìn cho nhiều camera',
        rules: ['RES-005'],
        formula: [
          'lưới gần vuông nhất: số hàng = ước lớn nhất ≤ √n, số cột = n ÷ hàng; chiều nhiều camera nằm theo cạnh dài vật',
          'ô một camera = cạnh vật ÷ số ô trên trục + chồng lấn',
          'chồng lấn = max(tỉ lệ × ô, số px tối thiểu × m_cần)   (trục chỉ 1 camera: không cộng)',
          'chưa có số camera → CẢNH BÁO, báo MP nếu dùng 1 camera = ⌈W ÷ m⌉ × ⌈H ÷ m⌉ ÷ 10⁶',
        ],
        params: ['tileOverlapRatio', 'tileOverlapMinPx'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/tiling.ts : cameraGrid, cameraTile',
      },
      {
        id: 'RES-004',
        title: 'Số pixel / MP mỗi camera + lọc camera',
        rules: ['RES-004'],
        formula: [
          'Nx = ⌈rộng ô ÷ (m_cần × cos θ)⌉, Ny = ⌈cao ô ÷ m_cần⌉   (cos θ chỉ nhân trục DÀI khi camera nghiêng θ)',
          'MP = Nx × Ny ÷ 10⁶',
          'camera đạt khi (W ≥ Nx và H ≥ Ny) hoặc xoay 90° (W ≥ Ny và H ≥ Nx)',
        ],
        verdict: ['Thiếu pixel → LOẠI camera', 'Camera màu cho bài không cần màu → CẢNH BÁO', 'Camera line scan → LOẠI (engine chưa hỗ trợ)'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : RES-004 · vision/equipmentFilter.ts : cameraRequirementChecks',
      },
    ],
  },

  // ─────────────────────────────────────────────────── 3. QUANG HỌC (YÊU CẦU) ──
  {
    key: 'opticsRequirement',
    title: '3. Quang học ở tầng Yêu cầu (chưa cần thiết bị)',
    entries: [
      {
        id: 'OPT-009',
        title: 'Camera nghiêng',
        rules: ['OPT-009'],
        formula: ['hệ số kéo dài pixel = 1 ÷ cos θ', 'độ sâu sinh ra do nghiêng = cạnh dài ô × sin θ   (cộng vào Δh ở OPT-005)'],
        verdict: ['Bài đo → CẢNH BÁO (phải hiệu chuẩn phối cảnh)', 'Bài phát hiện → chỉ ghi nhận'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : OPT-009',
      },
      {
        id: 'OPT-008',
        title: 'Sai số phối cảnh (ống thường)',
        rules: ['OPT-008'],
        formula: ['e = Δh ÷ WD × r', 'r = nửa đường chéo vùng nhìn MỘT camera (đã cộng chồng lấn)', 'Δh lấy cả dải, không chia đôi'],
        verdict: ['e > U → LOẠI', 'e > tỉ lệ cảnh báo × U → CẢNH BÁO', 'chỉ chạy khi bài có dung sai đo'],
        params: ['errorWarnShare'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/optics.ts : perspectiveErrorMm, perspectiveCheck',
      },
      {
        id: 'OPT-006',
        title: 'Khách yêu cầu đo không phối cảnh',
        rules: ['OPT-006'],
        formula: ['vẫn tính e như OPT-008 để hiển thị, kết luận: phải dùng telecentric'],
        verdict: ['Luôn CẢNH BÁO'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/optics.ts : perspectiveCheck',
      },
      {
        id: 'OPT-007',
        title: 'Trần khả thi của telecentric',
        rules: ['OPT-007'],
        formula: [
          'chạy khi OPT-008 LOẠI hoặc có OPT-006',
          'cạnh = cạnh dài vùng nhìn một camera; Ø đầu ống ≈ cạnh × hệ số đầu ống',
          'nếu chia nhiều camera: số ô mỗi trục = ⌈cạnh vật ÷ (trần thực tế ÷ (1 + tỉ lệ chồng lấn))⌉',
          'Δh tối đa cho ống thường = U × WD ÷ r',
        ],
        verdict: ['cạnh ≤ trần thực tế → ĐẠT', 'cạnh ≤ trần khả thi → CẢNH BÁO (rất đắt)', 'lớn hơn → LOẠI'],
        params: ['telecentricPracticalMaxMm', 'telecentricFeasibleMaxMm', 'telecentricFrontDiameterFactor'],
        evidence: 'rule-of-thumb',
        usedIn: ['design', 'lens'],
        source: 'vision/optics.ts : telecentricCheck, camerasForTelecentric, maxHeightVariationMm',
      },
    ],
  },

  // ──────────────────────────────────────────────── 4. CƠ KHÍ & MÔI TRƯỜNG ──
  {
    key: 'mechanics',
    title: '4. Cơ khí, nhiệt & môi trường',
    entries: [
      {
        id: 'MEC-001',
        title: 'Giãn nở nhiệt',
        rules: ['MEC-001'],
        formula: ['e = α × L × ΔT   (µm; α µm/(m·K), L m, ΔT K là cả DẢI dao động)', 'ΔT_max = U ÷ (α × L)   (dải; giữ trong ± ΔT_max ÷ 2)'],
        verdict: ['e > U → LOẠI', 'e > tỉ lệ cảnh báo × U → CẢNH BÁO', 'chỉ chạy khi bài có dung sai đo'],
        params: ['errorWarnShare'],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/mechanics.ts : thermalErrorUm, maxDeltaTK, thermalCheck',
      },
      {
        id: 'MEC-003',
        title: 'Ghép ảnh giữa camera',
        rules: ['MEC-003'],
        formula: [
          'số đường ghép = min(n − 1, max(1, ⌈L ÷ bước lưới⌉ − 1)) theo trục nhiều camera; bước = ô − chồng lấn',
          'e = số đường ghép × k_stitch × m_cần + e_nhiệt   (cộng thẳng, không căn tổng bình phương)',
        ],
        verdict: ['e > U → LOẠI', 'e > tỉ lệ cảnh báo × U → CẢNH BÁO'],
        params: ['errorWarnShare'],
        constants: [{ name: 'k_stitch (không mở qua admin)', value: K_STITCH }],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/mechanics.ts : seamsCrossed, stitchCheck',
      },
      {
        id: 'MEC-002',
        title: 'Rung động',
        rules: ['MEC-002'],
        formula: ['môi trường có rung → nhắc gá cứng, chống rung'],
        verdict: ['CẢNH BÁO'],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : MEC-002',
      },
      {
        id: 'ENV-001',
        title: 'Bụi / dầu + cấp IP camera',
        rules: ['ENV-001'],
        formula: ['môi trường bụi/dầu → CẢNH BÁO', 'lọc camera: IP camera < IP yêu cầu (54 / 65 / 67) → cần vỏ bảo vệ'],
        verdict: ['CẢNH BÁO (không loại camera)'],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : ENV-001 · vision/equipmentFilter.ts',
      },
      {
        id: 'ENV-002',
        title: 'Nhiệt độ cao',
        rules: ['ENV-002'],
        formula: ['môi trường nhiệt cao → CẢNH BÁO', 'lọc camera: nhiệt độ làm việc tối đa < ngưỡng → CẢNH BÁO'],
        params: ['highTempCameraMinC'],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : ENV-002 · vision/equipmentFilter.ts',
      },
    ],
  },

  // ───────────────────────────────────────────────────────── 5. THÔNG LƯỢNG ──
  {
    key: 'throughput',
    title: '5. Nhoè chuyển động, băng thông & giao tiếp',
    entries: [
      {
        id: 'THR-005',
        title: 'Phơi sáng tối đa để không nhoè',
        rules: ['THR-005'],
        formula: ['t_max = k_blur × m_cần ÷ v   (µs; chỉ khi sản phẩm chạy liên tục)'],
        verdict: ['lọc camera: rolling shutter khi vật chạy → LOẠI'],
        constants: [{ name: 'k_blur (px nhoè cho phép)', value: K_BLUR }],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : THR-005 · vision/equipmentFilter.ts',
      },
      {
        id: 'LGT-008',
        title: 'Bắt buộc strobe + global shutter',
        rules: ['LGT-008'],
        formula: ['t_max < ngưỡng strobe → CẢNH BÁO', 'lọc camera: không có trigger IO → LOẠI', 'lọc đèn: không strobe được → LOẠI'],
        constants: [{ name: 'ngưỡng strobe (µs)', value: STROBE_EXPOSURE_LIMIT_US }],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : LGT-008 · vision/equipmentFilter.ts',
      },
      {
        id: 'THR-001',
        title: 'Lưu lượng dữ liệu',
        rules: ['THR-001'],
        formula: ['ảnh/giây = ppm ÷ 60', 'MB/s mỗi camera = MP × byte/px × ảnh/giây', 'tổng = MB/s mỗi camera × số camera'],
        constants: [{ name: 'byte/px khi chưa chọn camera (Mono8 / Bayer8)', value: BYTES_PER_PX }],
        evidence: 'calculated',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : THR-001',
      },
      {
        id: 'THR-002',
        title: 'Chuẩn giao tiếp tối thiểu',
        rules: ['THR-002'],
        formula: [
          'chọn chuẩn có băng thông NHỎ NHẤT thoả: băng thông × tỉ lệ dùng tối đa ≥ MB/s mỗi camera',
          'lọc camera: MB/s ≤ tỉ lệ × băng thông chuẩn của camera (CXP nhân số làn)',
        ],
        verdict: ['không chuẩn nào đủ → LOẠI'],
        params: ['interfaceMaxShare', 'bwGigE', 'bwUsbThree', 'bwFiveGigE', 'bwTenGigE', 'bwCxpSix', 'bwCxpTwelve', 'bwCameraLinkBase', 'bwCameraLinkMedium', 'bwCameraLinkFull', 'bwCameraLinkDeca'],
        evidence: 'calculated',
        usedIn: ['design', 'oldSelector', 'pc'],
        source: 'vision/requirementAnalysis.ts : THR-002 · components/specs.ts : INTERFACE_BANDWIDTH',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── 6. CHIẾU SÁNG ──
  {
    key: 'lighting',
    title: '6. Chiếu sáng',
    intro: 'Bảng tra kinh nghiệm, không phải công thức — luôn cần chụp mẫu để xác nhận.',
    entries: [
      {
        id: 'LGT-001..004',
        title: 'Kiểu đèn theo bề mặt và loại lỗi',
        rules: ['LGT-001', 'LGT-002', 'LGT-003', 'LGT-004'],
        formula: [
          'bề mặt bóng / kim loại / trong suốt LẤN ÁT loại lỗi; còn lại tra theo loại lỗi',
          'mã luật: bề mặt phản xạ → LGT-001 · trong suốt → LGT-004 · biên dạng/lỗ/bavia → LGT-003 · xước, lõm nông → LGT-002 · còn lại → LGT-001',
          'lỗi in / sai màu → thanh (thay: vòng khuếch tán) — chốt 2026-10-22 (nháp F3)',
          'cỡ đèn tối thiểu: vòng / dome / góc thấp ≥ đường chéo vùng nhìn (ô); loại khác ≥ cạnh dài',
          'lọc đèn: sai kiểu → LOẠI; nhỏ hơn cỡ tối thiểu → LOẠI',
        ],
        verdict: ['Luôn CẢNH BÁO (phải chụp mẫu)'],
        liveTable: 'lighting',
        evidence: 'requires-sample-test',
        usedIn: ['design', 'oldSelector'],
        source: 'vision/lighting.ts : suggestLighting, lightingRuleId, minLightSizeMm · vision/equipmentFilter.ts : lightChecks',
      },
      {
        id: 'LGT-017..023',
        title: 'Kiểu đèn (trang Chọn đèn bản 2)',
        rules: ['LGT-017', 'LGT-018', 'LGT-019', 'LGT-020', 'LGT-021', 'LGT-022', 'LGT-023'],
        formula: [
          'nhập 5 bước: bài toán → cần thấy gì → vật liệu (chỉ điền sẵn) → bề mặt + hình dạng → màu chi tiết + màu nền',
          'thứ tự xét (dòng đầu tiên khớp quyết định):',
          'LGT-017 · đo / căn chỉnh / có-không + đường bao hoặc lỗ xuyên + đặt được đèn phía sau → đèn nền',
          'LGT-018 · kiểm lỗi + trong suốt: bọt / dị vật / nứt (bên trong) → đèn nền; lỗi trên mặt → góc thấp · mờ đục: chỉ lỗi bên trong',
          'LGT-019 · bóng phẳng như gương → đồng trục; kiểm xước / dị vật → góc thấp',
          'LGT-020 · bóng cong → vòm; móp → nhiều hướng / đèn sọc',
          'LGT-021 · nhiều bậc cao thấp → vòm / vòng nhiều tầng; dấu định vị → đồng trục',
          'LGT-022 · kiểm lỗi còn lại → ma trận lỗi × bề mặt (mờ / bán bóng / có vân; chưa chọn hoặc mờ đục → như mờ; móp rất nông → dòng riêng)',
          'LGT-023 · bài toán khác → bảng bài toán × cần thấy gì',
          'cỡ đèn tối thiểu: vòng / vòm / góc thấp / vòng nhiều tầng ≥ đường chéo vùng nhìn; loại khác ≥ cạnh dài',
          'lọc đèn: sai kiểu → LOẠI; nhỏ hơn cỡ tối thiểu → LOẠI',
        ],
        verdict: [
          'kiểu đèn: luôn CẢNH BÁO (phải chụp mẫu)',
          'đo + đèn nền → nhắc đèn nền song song + telecentric · đo không soi xuyên → CẢNH BÁO kém chính xác',
          'cao su / màu đen → LGT-005',
        ],
        notes: ['Nguồn: Opto Engineering, KEYENCE, Advanced Illumination, Edmund Optics — xem docs/NHAP_CHON_DEN_V2.md mục 6–7.'],
        liveTable: 'lightMatrix',
        evidence: 'requires-sample-test',
        usedIn: ['light'],
        source: 'vision/lightMatrix.ts : pickLightType · vision/lightSelector.ts : selectLights, reasonKeyFor · vision/lighting.ts : minLightSizeMm',
      },
      {
        id: 'LGT-009..016',
        title: 'Màu đèn / bước sóng (trang Chọn đèn bản 2)',
        rules: ['LGT-009', 'LGT-010', 'LGT-011', 'LGT-012', 'LGT-013', 'LGT-014', 'LGT-015', 'LGT-016'],
        formula: [
          'bảng phản xạ 3 mức (0 tối · 1 vừa · 2 sáng) của 13 màu dưới đèn đỏ / lục / lam; đèn trắng = trung bình ba kênh',
          'thứ tự xét (luật đầu tiên khớp chọn màu chính):',
          '1. huỳnh quang → UV 365–395 nm (LGT-014) · 2. nhìn xuyên lớp in → IR 850 nm (LGT-012)',
          '3. camera màu → trắng (LGT-009)',
          '4. camera đơn sắc + màu chi tiết + màu nền → đèn cho |chi tiết − nền| lớn nhất (LGT-010); hoà → đỏ, lục, lam rồi mới trắng',
          '   chênh = 0 → LGT-011 cảnh báo, trắng · cả hai trung tính (trắng / xám / đen) → LGT-011, trắng (thay: đỏ)',
          '   chưa có màu nền → đèn làm chi tiết sáng nhất (LGT-010); chi tiết trung tính → trắng',
          '5. camera đơn sắc + bài đo / chi tiết nhỏ → xanh lam 450–470 nm (LGT-013) · 6. còn lại → trắng',
          'kèm: ánh sáng ngoài thay đổi → đèn đơn sắc + lọc băng hẹp cùng bước sóng; đèn trắng → che chắn / strobe (LGT-015)',
          'kèm: đèn IR → camera màu LOẠI (lọc IR-cut); camera đơn sắc cảnh báo QE ở 850 nm (LGT-016) · đèn UV → lọc chặn UV',
          'lọc đèn trong kho: màu đèn ∉ {màu chính, màu thay thế} → LOẠI',
          'hình B: độ sáng chi tiết / nền / chênh dưới đỏ, lục, lam, trắng — đọc thẳng từ bảng phản xạ',
        ],
        verdict: ['màu chính: THÔNG TIN; LGT-011 (chênh 0) / LGT-015 / LGT-016 / lọc UV: CẢNH BÁO; camera màu + IR: LOẠI'],
        notes: ['Bước sóng chỉ để ghi chú: nhiễu xạ (OPT-004) vẫn tính ở 550 nm (chốt 2026-10-22 Q2).', 'Nguồn: wenglor; Advanced Illumination — xem docs/NHAP_CHON_DEN_V2.md mục 5.'],
        constants: Object.entries(LIGHT_WAVELENGTH_NM)
          .filter(([, nm]) => nm !== null)
          .map(([color, nm]) => ({ name: `bước sóng ${color} (nm)`, value: nm! })),
        liveTable: 'lightColor',
        evidence: 'requires-sample-test',
        usedIn: ['light'],
        source: 'vision/lightColor.ts : suggestLightColor, levelUnder, colorTableFromRows · vision/lightSelector.ts : selectLights',
      },
      {
        id: 'LGT-005',
        title: 'Bề mặt đen',
        rules: ['LGT-005'],
        formula: ['bề mặt đen → nhắc đèn mạnh / góc thấp, chụp mẫu', 'trang Chọn đèn: vật liệu cao su hoặc màu chi tiết / nền đen → nhắc như trên'],
        verdict: ['CẢNH BÁO'],
        evidence: 'requires-sample-test',
        usedIn: ['design', 'light'],
        source: 'vision/requirementAnalysis.ts : LGT-005 · vision/lightSelector.ts : selectLights',
      },
      {
        id: 'LGT-006',
        title: 'Kiểm màu',
        rules: ['LGT-006'],
        formula: ['bài kiểm màu → cần đèn CRI cao', 'lọc camera: camera đơn sắc → LOẠI'],
        verdict: ['CẢNH BÁO'],
        evidence: 'requires-sample-test',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : LGT-006 · vision/equipmentFilter.ts',
      },
      {
        id: 'LGT-007',
        title: 'Ánh sáng môi trường thay đổi',
        rules: ['LGT-007'],
        formula: ['ánh sáng ngoài thay đổi → nhắc strobe / che chắn'],
        verdict: ['CẢNH BÁO'],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : LGT-007',
      },
    ],
  },

  // ─────────────────────────────────────────────── 7. THUẬT TOÁN & TÍCH HỢP ──
  {
    key: 'algorithm',
    title: '7. Thuật toán & tích hợp',
    entries: [
      {
        id: 'AI-001/002',
        title: 'Truyền thống hay học sâu',
        rules: ['AI-001', 'AI-002'],
        formula: ['biến động lỗi thấp / vừa → truyền thống (AI-001, ĐẠT)', 'biến động cao → ứng viên học sâu (AI-002, CẢNH BÁO, phải chụp mẫu)', 'chưa rõ → AI-001 CẢNH BÁO'],
        notes: ['AI-002 bật thì THR-003 dùng thời gian xử lý học sâu và THR-004 đòi GPU.'],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : AI-001 / AI-002',
      },
      {
        id: 'INT-001',
        title: 'Giao tiếp trả kết quả',
        rules: ['INT-001'],
        formula: ['chỉ ghi nhận giao thức đã chọn, không tụt điểm khả thi (chốt 2026-10-12)'],
        constants: [{ name: 'thời gian IO giả định trong THR-003 (ms)', value: CYCLE_DEFAULTS.ioMs }],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/requirementAnalysis.ts : INT-001',
      },
    ],
  },

  // ─────────────────────────────────────── 8. CẤU HÌNH CAMERA + ỐNG + MÁY ──
  {
    key: 'configuration',
    title: '8. Cấu hình cụ thể: camera + ống kính + máy tính',
    intro: 'Chạy trên TỪNG cặp thiết bị trong kho. LOẠI = bỏ khỏi danh sách kèm lý do; thiếu thông số = "chưa kiểm được", không loại.',
    entries: [
      {
        id: 'OPT-001',
        title: 'Vùng nhìn thật & mm/px thật',
        rules: ['OPT-001'],
        formula: [
          'β = f ÷ (WD − f)   (telecentric: β ghi trên ống)',
          'β_phủ = min(cảm biến dài ÷ ô dài, cảm biến ngắn ÷ ô ngắn)',
          'β_cần = pitch ÷ (m_cần × cos θ)',
          'mm/px thật = pitch ÷ β; dư = m_cần ÷ mm/px thật',
          'tiêu cự lý tưởng = WD × β_phủ ÷ (1 + β_phủ)',
        ],
        verdict: [
          'WD < MOD của ống, hoặc telecentric ngoài dải WD → LOẠI',
          'β_cần > β_phủ → LOẠI (camera thiếu pixel)',
          'β > β_phủ → LOẠI (vùng nhìn hẹp hơn vật)',
          'mm/px thật > m_cần → LOẠI (ống cho pixel thô)',
        ],
        evidence: 'calculated',
        usedIn: ['design', 'lens'],
        source: 'vision/configurationRules.ts : OPT-001',
      },
      {
        id: 'OPT-002',
        title: 'Vòng ảnh & ngàm',
        rules: ['OPT-002'],
        formula: ['Ø vòng ảnh ≥ đường chéo cảm biến × (1 − dung sai vòng ảnh)', 'ngàm ống = ngàm camera'],
        verdict: ['vòng ảnh nhỏ → LOẠI', 'ống C lên camera CS → CẢNH BÁO (vòng đệm 5 mm)', 'ngàm khác → LOẠI'],
        params: ['imageCircleTolerance'],
        evidence: 'calculated',
        usedIn: ['design', 'lens'],
        source: 'vision/configurationRules.ts : OPT-002, mountFit',
      },
      {
        id: 'OPT-003',
        title: 'Độ phân giải ống kính',
        rules: ['OPT-003'],
        formula: ['lp/mm cần = 1000 ÷ (2 × pitch µm)   (tần số Nyquist)'],
        verdict: ['lp/mm ống < cần → CẢNH BÁO', 'ống chưa khai lp/mm và pitch < 3 µm → CẢNH BÁO'],
        evidence: 'calculated',
        usedIn: ['design', 'lens', 'oldSelector'],
        source: 'vision/optics.ts : requiredLpPerMm · vision/configurationRules.ts : OPT-003',
      },
      {
        id: 'OPT-004',
        title: 'Giới hạn nhiễu xạ (F# hiệu dụng)',
        rules: ['OPT-004'],
        formula: [
          'Airy = 2,44 × λ × N_hiệu dụng ≤ 2 pixel',
          'F#max (vòng khẩu) = 2 × pitch ÷ (2,44 × λ) ÷ (1 + β)   (telecentric: không chia, datasheet ghi sẵn F# làm việc)',
        ],
        verdict: ['F nhỏ nhất của ống > F#max → LOẠI'],
        constants: [{ name: 'λ (µm, không mở qua admin)', value: WAVELENGTH_UM }],
        evidence: 'calculated',
        usedIn: ['design', 'lens', 'oldSelector'],
        source: 'vision/configurationRules.ts : maxFNumber, effectiveFNumberFactor, OPT-004',
      },
      {
        id: 'OPT-005',
        title: 'Độ sâu trường ảnh ↔ nhiễu xạ',
        rules: ['OPT-005'],
        formula: [
          'c = vòng mờ cho phép = số px × pitch',
          'F_cần = (Δh + độ sâu nghiêng) × β² ÷ (2 × c × (1 + β))   (telecentric: ÷ 2c)',
          'tỉ lệ = F_cần ÷ F#max',
        ],
        verdict: [
          'tỉ lệ > dung sai → bài đo LOẠI / bài phát hiện CẢNH BÁO',
          'F_cần > F lớn nhất của ống → LOẠI',
          '1 < tỉ lệ ≤ dung sai → CẢNH BÁO (mờ nhẹ, chụp thử)',
          'tỉ lệ ≤ 1 → ĐẠT, đặt khẩu F_cần (ống chưa khai khẩu thì coi mở được tới F/1)',
        ],
        params: ['dofDiffractionTolerance'],
        constants: [
          { name: 'vòng mờ c (px)', value: DEFAULT_CIRCLE_OF_CONFUSION_PX },
          { name: 'F nhanh nhất giả định khi ống chưa khai', value: DOF_FASTEST_PRACTICAL_F },
        ],
        evidence: 'calculated',
        usedIn: ['design', 'lens'],
        source: 'vision/configurationRules.ts : fNumberForDepth, ringFNumberForDepth, OPT-005',
      },
      {
        id: 'THR-003',
        title: 'Ngân sách thời gian chu kỳ',
        rules: ['THR-003'],
        formula: [
          'T_nhịp = 60 000 ÷ ppm   (ms)',
          'T = trigger + khung + truyền + xử lý + IO',
          'khung = 1000 ÷ fps camera (không khai: giả định) · truyền = MB một ảnh ÷ băng thông × 1000',
          'xử lý = số đo thật; chưa đo → giả định (học sâu nếu AI-002)',
          'dư = (T_nhịp − T) ÷ T_nhịp',
        ],
        verdict: ['dư < 0 → LOẠI', 'dư < dư tối thiểu → CẢNH BÁO'],
        params: ['cycleMinMargin', 'processMs', 'processDeepLearningMs'],
        constants: [
          { name: 'trigger (ms)', value: CYCLE_DEFAULTS.triggerMs },
          { name: 'IO (ms)', value: CYCLE_DEFAULTS.ioMs },
          { name: 'khung khi camera không khai fps (ms)', value: CYCLE_DEFAULTS.frameIntervalMs },
        ],
        evidence: 'rule-of-thumb',
        usedIn: DESIGN_ONLY,
        source: 'vision/configurationRules.ts : THR-003',
      },
      {
        id: 'THR-004',
        title: 'Cỡ máy tính (IPC)',
        rules: ['THR-004'],
        formula: [
          'lõi CPU: tối thiểu n + 2, khuyên dùng 2n + 2   (n = số camera)',
          'RAM ≥ max(RAM tối thiểu, ⌈4 × MB một ảnh × n × số ảnh đệm ÷ 1024⌉) GB',
          'khe PCIe ≥ số card giao tiếp (+ 1 GPU nếu học sâu)',
          'cổng LAN ≥ n + 1 khi camera Ethernet cắm thẳng bo mạch',
        ],
        verdict: ['thiếu lõi dưới tối thiểu / RAM / PCIe / LAN → LOẠI', 'lõi dưới mức khuyên → CẢNH BÁO', 'học sâu mà máy không GPU → CẢNH BÁO'],
        params: ['ipcRamMinGb', 'ipcBufferDepth'],
        evidence: 'rule-of-thumb',
        usedIn: ['design'],
        source: 'vision/configurationRules.ts : THR-004',
      },
    ],
  },

  // ───────────────────────────────────────────────────── 9. CHỌN ỐNG KÍNH ──
  {
    key: 'lens',
    title: '9. Trang Chọn ống kính',
    intro: 'Dùng lại OPT-001…005 cho từng ống trong kho. Không có dung sai đo nên xung đột độ sâu ↔ nhiễu xạ chỉ CẢNH BÁO.',
    entries: [
      {
        id: 'LNS-001',
        title: 'Độ phóng đại theo trục giới hạn',
        formula: ['β = min(cảm biến dài ÷ vùng nhìn dài, cảm biến ngắn ÷ vùng nhìn ngắn)   (xoay camera được)', 'line scan: β = cảm biến dài ÷ vùng nhìn rộng'],
        evidence: 'calculated',
        usedIn: ['lens', 'oldSelector'],
        source: 'vision/optics.ts : magnificationToFit',
      },
      {
        id: 'LNS-002',
        title: 'Biết 2 trong 3 (thấu kính mỏng)',
        formula: [
          'vùng nhìn + WD → f = WD × β ÷ (1 + β)',
          'f + WD → β = f ÷ (WD − f), vùng nhìn = cảm biến ÷ β',
          'f + vùng nhìn → WD = f × (1 + 1 ÷ β)',
          'có bộ nhân ×k khai tay (OPT-011): f là của ống GỐC, β cả hệ = k × β ống gốc → f = WD × (β ÷ k) ÷ (1 + β ÷ k) · β = k × f ÷ (WD − f) · WD = f × (1 + k ÷ β)',
        ],
        notes: ['Ước lượng: WD tính từ mặt phẳng chính, không phải mặt trước ống — kiểm bảng WD của hãng.'],
        evidence: 'calculated',
        usedIn: ['lens'],
        source: 'vision/lensSelector.ts : solveGeometry',
      },
      {
        id: 'LNS-003',
        title: 'Góc nhìn tại WD',
        formula: ['góc = 2 × atan(vùng nhìn ÷ (2 × WD))'],
        notes: ['Datasheet thường ghi góc ở vô cực (2 × atan(cảm biến ÷ 2f)) → lệch vài % khi lấy nét gần.'],
        evidence: 'calculated',
        usedIn: ['lens'],
        source: 'vision/optics.ts : angleOfViewDeg',
      },
      {
        id: 'LNS-004',
        title: 'Xếp hạng ống',
        formula: [
          'pixel dùng = diện tích vật ÷ diện tích vùng nhìn thật',
          'xếp: Đạt → Cảnh báo → Đạt nhờ phụ kiện (OPT-010/011) → Chưa kiểm được → Loại; cùng nhóm: pixel dùng giảm dần, rồi ít thông số thiếu hơn',
          'người dùng khai phụ kiện (ô Phụ kiện, chỉ tab ống thường): mọi ống kiểm với đúng cấu hình đó, KHÔNG gợi ý phụ kiện tự động',
          'tab M12: chỉ ống ngàm M12 · tab ống thường: bỏ M12 · tab telecentric: chỉ telecentric (WD tuỳ chọn)',
        ],
        evidence: 'calculated',
        usedIn: ['lens'],
        source: 'vision/lensSelector.ts : selectLenses',
      },
      {
        id: 'OPT-010',
        title: 'Ống nối (extension tube) — khi MOD không đạt',
        rules: ['OPT-010'],
        formula: [
          'chỉ thử khi ống thường bị LOẠI DUY NHẤT vì WD < MOD (không áp telecentric, không ghép với bộ nhân)',
          'β_WD = f ÷ (WD − f) — ở cùng WD độ phóng đại KHÔNG đổi; ống nối chỉ cho tới được WD đó',
          'β_MOD = f ÷ (MOD − f); thêm ống e → lấy nét được β ∈ [e ÷ f; e ÷ f + β_MOD]',
          'e cần ∈ [f × (β_WD − β_MOD); f × β_WD] → tổ hợp ống trong kho ít khúc nhất, rồi ngắn nhất (tối đa 4 khúc)',
          'dải WD sau khi lắp = [f × (1 + 1 ÷ (e/f + β_MOD)); f × (1 + f ÷ e)]',
          'mất sáng = 2 × log₂(1 + β_WD) stop',
          'chạy lại toàn bộ OPT-001…005; còn LOẠI thì bỏ phương án',
          'KHAI TAY e (chỉ tab ống thường): mọi ống kiểm với e đó, tắt gợi ý tự động; WD ngoài dải lấy nét mới → LOẠI; ống chưa khai MOD → chỉ biết giới hạn xa f × (1 + f ÷ e)',
          'khai tay: mất sáng = 2 × log₂(1 + β ống gốc) stop (cộng dồn với bộ nhân nếu khai cả hai — OPT-011)',
        ],
        verdict: [
          'đạt → CẢNH BÁO, xếp sau ống đạt trơn (gợi ý tự động); khai tay → theo đúng các phép kiểm, không ép CẢNH BÁO',
          'khai tay: WD > giới hạn xa → LOẠI, dùng ống nối ngắn hơn · WD < giới hạn gần → LOẠI, cần ống nối dài hơn',
          'β_WD ≥ ngưỡng macro → cảnh báo chất lượng (khuyên ống macro)',
          'mất sáng ≥ ngưỡng stop → cảnh báo tối',
          'e > hệ số × f → cảnh báo cơ khí (đòn bẩy, rung)',
          'số khúc > ngưỡng → cảnh báo đồng trục',
          'kho chưa có ống ngàm C/CS phù hợp → gợi ý bộ chuẩn, ghi "chưa có trong kho"',
        ],
        params: ['accessoryMacroBetaWarn', 'accessoryLightLossStopsWarn', 'tubeLengthToFocalWarn', 'tubeMaxSegments'],
        constants: [{ name: 'bộ ống nối chuẩn gợi ý (mm)', value: STANDARD_TUBE_LENGTHS_MM.join(' / ') }],
        evidence: 'calculated',
        usedIn: ['lens', 'oldSelector'],
        source: 'vision/lensSelector.ts : tubeLengthRange, tubeFocusRange, chooseTubeStack, tryAccessory, activeFixedAccessory, manualVariant, evaluateLens · components/match.ts : pickTube',
      },
      {
        id: 'OPT-011',
        title: 'Bộ nhân tiêu cự (rear converter) ×k',
        rules: ['OPT-011'],
        formula: [
          'chỉ thử khi ống thường bị LOẠI chỉ vì pixel thô và/hoặc vòng ảnh nhỏ (MOD không cứu được: MOD không đổi)',
          'pixel: k ≥ mm/px thật ÷ mm/px cần · vòng ảnh: k ≥ đường chéo cảm biến × (1 − dung sai) ÷ Ø vòng ảnh ống',
          'chọn k nhỏ nhất ≥ k cần, ≤ k tối đa, cùng ngàm, cỡ cảm biến tối đa của bộ nhân phủ cảm biến',
          'sau khi lắp: β = k × f ÷ (WD − f) · F# × k · Ø vòng ảnh × k · lp/mm ÷ k',
          'mất sáng = 2 × log₂ k stop',
          'chạy lại toàn bộ OPT-001…005 với các số đã nhân; còn LOẠI thì bỏ phương án',
          'KHAI TAY k (chỉ tab ống thường): mọi ống kiểm với k đó, tắt gợi ý tự động; f lý tưởng của ống gốc = WD × (β ÷ k) ÷ (1 + β ÷ k); F# tối đa trên vòng khẩu ống gốc = F#max ÷ k',
          'khai cả ống nối e + bộ nhân k: mất sáng cộng dồn = 2 × log₂(1 + β ống gốc) + 2 × log₂ k stop',
        ],
        verdict: [
          'đạt → CẢNH BÁO, xếp sau ống đạt trơn (gợi ý tự động); khai tay → theo đúng các phép kiểm',
          'mất sáng (cộng dồn nếu khai cả hai) ≥ ngưỡng stop → cảnh báo tối',
          'khai tay k > k tối đa → cảnh báo mềm ảnh, tối',
          'luôn nhắc: giảm tương phản, thấu kính sau nhô ra có thể không lắp được',
        ],
        params: ['converterMaxFactor', 'accessoryLightLossStopsWarn'],
        constants: [{ name: 'hệ số chuẩn gợi ý khi kho chưa có', value: STANDARD_CONVERTER_FACTORS.join(' / ') }],
        evidence: 'calculated',
        usedIn: ['lens'],
        source: 'vision/lensSelector.ts : convertLens, converterChecks, tryAccessory, manualVariant, lensNeed, solveGeometry',
      },
    ],
  },

  // ─────────────────────────────────────────── 10. KHẢ THI & BA MỨC PHƯƠNG ÁN ──
  {
    key: 'feasibility',
    title: '10. Đánh giá khả thi & ba mức phương án',
    entries: [
      {
        id: 'FEA-001',
        title: 'Điểm một luật',
        formula: [
          'LOẠI: dư ≥ 0,8 → 45, còn lại → 20',
          'cần chụp mẫu / thiếu dữ liệu → CHƯA RÕ ' + UNKNOWN_SCORE,
          'CẢNH BÁO → SÁT 70',
          'dư ≥ 1,5 hoặc không có dư → 95 · dư ≥ 1,2 → 85 · dư ≥ 1 → SÁT 70',
        ],
        notes: ['Điểm chỉ là cách HIỂN THỊ dư (marginRatio), không phải chân lý toán học.'],
        usedIn: DESIGN_ONLY,
        source: 'vision/feasibility.ts : scoreResult',
      },
      {
        id: 'FEA-002',
        title: 'Điểm nhóm & kết luận',
        formula: [
          'điểm nhóm = MIN điểm các luật trong nhóm · tổng = MIN các nhóm đã đánh giá',
          'nhóm không có luật nào chạy = "chưa đánh giá", không tính',
          'có nhóm LOẠI → Không khả thi · có nhóm không ĐẠT → Khả thi khi kiểm chứng · còn lại → Khả thi kỹ thuật',
        ],
        usedIn: DESIGN_ONLY,
        source: 'vision/feasibility.ts : assessFeasibility',
      },
      {
        id: 'SOL-001',
        title: 'Ba mức phương án',
        formula: [
          'dư độ phân giải = m_cần ÷ mm/px thật của cặp camera + ống',
          'Tiết kiệm: [mức Tiết kiệm, mức Khuyên dùng) · Khuyên dùng: [mức Khuyên dùng, mức Cao cấp) · Cao cấp: ≥ mức Cao cấp',
          'Tiết kiệm chỉ chọn trong cặp KHÔNG có luật LOẠI/SÁT; hết cặp sạch mới lấy cặp điểm cao nhất để nêu lý do chặn',
        ],
        params: ['levelEconomyMin', 'levelRecommendedMin', 'levelHighMin'],
        usedIn: DESIGN_ONLY,
        source: 'vision/solutionLevels.ts : buildSolutionLevels',
      },
      {
        id: 'SOL-002',
        title: 'Điểm mềm chọn thiết bị trong một mức',
        formula: [
          'điểm = 100 × Σ trọng số × giá trị (0…1)',
          'dư: (dư − 1) ÷ (dư đủ điểm − 1) · sẵn hàng: 1 − ngày giao ÷ mốc 0 điểm · giá: (giá cao nhất − giá) ÷ (cao nhất − thấp nhất)',
          'đã dùng: số dự án ÷ mốc đủ điểm · hỗ trợ local, lộ trình: 0 (chưa có dữ liệu)',
        ],
        params: ['weightResolutionMargin', 'weightAvailability', 'weightPrice', 'weightPriorUse', 'weightLocalSupport', 'weightRoadmap'],
        constants: [
          { name: 'dư đủ điểm', value: MARGIN_FULL_SCORE },
          { name: 'ngày giao = 0 điểm', value: LEAD_TIME_ZERO_DAYS },
          { name: 'số dự án đủ điểm', value: PRIOR_USE_FULL },
        ],
        usedIn: DESIGN_ONLY,
        source: 'vision/solutionLevels.ts : softScores',
      },
    ],
  },

  // ───────────────────────────────────────────────────── 11. BỘ CHỌN CŨ ──
  {
    key: 'oldSelector',
    title: '11. Bộ chọn thiết bị cũ',
    intro: 'Form theo từng bài toán (task_types). Gợi ý chữ lấy từ bảng luật selector_rules (Quản trị → Luật gợi ý); phép kiểm số dùng các công thức dưới.',
    entries: [
      {
        id: 'OLD-001',
        title: 'Độ phân giải',
        formula: ['m = min(d_min ÷ N, U × k_subpixel)   (N do người dùng nhập, mặc định bên dưới)', 'Nx = ⌈vùng nhìn rộng ÷ m⌉, Ny = ⌈vùng nhìn cao ÷ m⌉'],
        constants: [{ name: 'N mặc định (px/lỗi)', value: DEFAULT_PX_PER_DEFECT }],
        notes: ['Hướng dẫn N: có/không 3 · ngoại quan có vân 4–6 · phân loại 8–10 · đo ≥ 10.'],
        evidence: 'calculated',
        usedIn: ['oldSelector'],
        source: 'vision/resolution.ts : requiredPixels',
      },
      {
        id: 'OLD-002',
        title: 'Nhoè & ngân sách thời gian',
        formula: [
          't_phơi ≤ px nhoè × mm/px ÷ v   (< 1 ms → cần strobe)',
          'T_khả dụng = 60 000 ÷ ppm × tỉ lệ thời gian trong tầm nhìn × hệ số an toàn',
          'T_tiêu thụ = số ảnh × (trigger + phơi + đọc + truyền) + xử lý (+ chờ hết rung nếu chụp tĩnh) + xuất',
          'truyền = W × H × byte/px ÷ (băng thông × 10⁶) × 1000 ms',
        ],
        constants: [{ name: 'hệ số an toàn thời gian', value: TIME_BUDGET_SAFETY }],
        evidence: 'calculated',
        usedIn: ['oldSelector'],
        source: 'vision/timing.ts : maxExposureForBlur, cycleBudget, frameTransfer',
      },
      {
        id: 'OLD-003',
        title: 'Line scan',
        formula: ['tần số dòng = v ÷ mm/px ngang', 'phơi tối đa = 1000 ÷ tần số dòng (ms)', 'dữ liệu = số px dòng × tần số × byte/px ÷ 10⁶ MB/s', 'encoder đủ mịn khi µm/xung ÷ 1000 ≤ mm/px ngang'],
        evidence: 'calculated',
        usedIn: ['oldSelector'],
        source: 'vision/linescan.ts : lineScanNeed, encoderFineEnough',
      },
      {
        id: 'OLD-004',
        title: 'Độ sâu trường ảnh (bộ chọn cũ)',
        formula: ['DOF = 2 × N × c × (1 + β) ÷ β²   (c = px vòng mờ × pitch)', 'DOF ≥ dung sai chiều cao → ĐẠT, không thì CẢNH BÁO', 'lp/mm cần > 100 → CẢNH BÁO ống phải độ phân giải cao'],
        evidence: 'calculated',
        usedIn: ['oldSelector'],
        source: 'vision/optics.ts : depthOfFieldMm, opticsChecks',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── 12. MÁY TÍNH ──
  {
    key: 'pc',
    title: '12. Trang Máy tính (PC)',
    entries: [
      {
        id: 'PC-001',
        title: 'Số camera một máy gánh được',
        formula: ['= max_cameras khai trong kho; không khai → khe PCIe × số cổng card; không có cả hai → mặc định', 'theo băng thông: ⌊trần × băng thông một cổng ÷ MB/s mỗi camera⌋'],
        constants: [
          { name: 'camera/máy mặc định', value: DEFAULT_CAMERAS_PER_PC },
          { name: 'trần băng thông một máy (× một cổng)', value: PC_BANDWIDTH_HEADROOM },
        ],
        usedIn: ['pc'],
        source: 'components/pc.ts : camerasPerPc, maxCamerasByBandwidth',
      },
      {
        id: 'PC-002',
        title: 'Số máy & số card',
        formula: ['số máy = ⌈tổng camera ÷ camera/máy⌉ — xếp máy cần ÍT bộ hơn lên trước', 'số card = ⌈camera mỗi máy ÷ số cổng card⌉ × số máy (card không chia được cho hai máy)'],
        usedIn: ['pc'],
        source: 'components/pc.ts : pickPc, pickCard, cardUnits, planPcForLines',
      },
    ],
  },

  // ─────────────────────────────────────────────────────── 13. CHỈ TIÊU (KPI) ──
  {
    key: 'kpi',
    title: '13. Bộ tính chỉ tiêu (KPI)',
    intro: 'Các hệ số đọc từ bảng kpi_config, kpi_modifiers, kpi_tightening_factors (Quản trị → Chỉ tiêu).',
    entries: [
      {
        id: 'KPI-001',
        title: 'Hệ số điều chỉnh',
        formula: ['hệ số = Π (min + max) ÷ 2 của các điều kiện đã chọn, chặn ở modifier_cap', 'vượt level_up_threshold → gợi ý chọn loại bài khó hơn'],
        usedIn: ['kpi'],
        source: 'kpi/calc.ts : computeModifierFactor',
      },
      {
        id: 'KPI-002',
        title: 'Áp hệ số & chia tải phụ',
        formula: [
          'chỉ tiêu = cơ sở × hệ số (tái kiểm: × hệ số ^ recheck_exponent), cắt 0–100',
          'bắt ảo + tái kiểm = tổng tải phụ (chỉ chuyển giữa hai nhánh, không cộng dồn)',
          'không tái kiểm → bỏ sót × no_recheck_miss_multiplier',
        ],
        usedIn: ['kpi'],
        source: 'kpi/calc.ts : applyModifier, splitBurden',
      },
      {
        id: 'KPI-003',
        title: 'Quy ra người và tiền',
        formula: ['người = sp/giờ × tái kiểm% × giây kiểm ÷ 3600 × số ca', 'tiền phế = sản lượng năm × bắt ảo% × giá trị một sp'],
        usedIn: ['kpi'],
        source: 'kpi/calc.ts : computeOperationalCost',
      },
      {
        id: 'KPI-004',
        title: 'Siết bỏ sót & kiểm hai tầng',
        formula: ['siết: tổng tải phụ mới = cũ × k (bảng); bỏ sót = 0 → không tồn tại về toán học', 'hai tầng độc lập: bỏ sót = m₁ × m₂ · bắt ảo = f₁ + f₂ − f₁ × f₂'],
        notes: ['Phép nhân hai tầng chỉ đúng khi hai hệ thật sự độc lập (khác nguyên lý, góc chụp, ánh sáng).'],
        usedIn: ['kpi'],
        source: 'kpi/calc.ts : computeTighteningScenario, computeTwoStage',
      },
      {
        id: 'KPI-005',
        title: 'Escape, số mẫu chứng minh, nhân lực tái kiểm',
        formula: [
          'escape (trên tổng sản lượng) = bỏ sót × tỉ lệ NG đầu vào p',
          'quy tắc số 3: n mẫu NG bắt đúng hết → bỏ sót ≤ 3 ÷ n (tin cậy 95%); cam kết bỏ sót m% cần ⌈300 ÷ m⌉ mẫu',
          'năng lực tái kiểm = 3600 ÷ giây kiểm × (số người ÷ số ca) sp/giờ',
          'chặn điều khoản hợp đồng khi: bỏ sót = 0, bài có KPI riêng, vượt trần thương mại, thiếu mẫu NG',
        ],
        usedIn: ['kpi'],
        source: 'kpi/calc.ts : computeEscapeLadder, computeSampleAdequacy, computeRecheckFeasibility, findContractBlockers, resolveCeiling, computeAssistModel',
      },
    ],
  },
];

/** Mọi mã luật engine có trong sổ tay — test so với RULES. */
export const documentedRules = (): Set<string> => new Set(FORMULA_BOOK.flatMap((s) => s.entries.flatMap((e) => e.rules ?? [])));

/** Mọi ngưỡng admin có trong sổ tay — test so với ENGINE_PARAMS. */
export const documentedParams = (): Set<string> => new Set(FORMULA_BOOK.flatMap((s) => s.entries.flatMap((e) => e.params ?? [])));
