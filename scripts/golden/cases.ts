/**
 * Bộ golden test V1b — spec V1.1 §13.
 *
 * NGUỒN (chốt 2026-09-16): chỉ GT-001 là dự án thật (spec §13, 2025). Các ca
 * "S-xx" là MẪU SOẠN từ công thức — chúng chỉ chứng minh engine làm đúng công
 * thức và đi đúng nhánh, KHÔNG chứng minh công thức đúng với thực tế. Khi phòng
 * gom đủ 10–15 dự án thật (sheet DỰ ÁN CŨ), thêm ca "GT-0xx" và đợt hiệu chỉnh
 * luật chạy trên chúng. Tới lúc đó V1b chỉ "xong có điều kiện".
 *
 * Đáp án tính TAY trước (ghi trong `note`), rồi mới cho engine chạy. Không sửa
 * đáp án cho khớp máy mà không soát lại phép tính tay.
 */
import type { ApplicationType } from '../../src/lib/visionEntry';
import type { FeasibilityDimension } from '../../src/lib/vision/rules';
import type { FeasibilityStatus } from '../../src/lib/vision/feasibility';

export type GoldenCase = {
  id: string;
  name: string;
  source: 'real-project' | 'synthetic';
  applicationType: ApplicationType;
  input: Record<string, unknown>;
  expect: {
    rulesFired: string[];
    failingRules: string[];
    status: FeasibilityStatus;
    overall: number | null;
    limitingFactors: FeasibilityDimension[];
    governingMmPerPx?: number;
    /** [giá trị, sai số cho phép] */
    megapixelsPerCamera?: [number, number];
  };
  note: string;
  /**
   * Chỗ engine CHƯA khớp dự án thật, đã biết và chưa sửa (một dự án chưa đủ để
   * đổi luật). Ghi ra để không bị che đi khi ca vẫn pass; đợt hiệu chỉnh luật đọc
   * danh sách này.
   */
  knownGaps?: string[];
};

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: 'GT-001',
    name: 'Ngoại quan + đo, 4 camera, vỏ nhôm 380 × 280 mm',
    source: 'real-project',
    applicationType: 'AppearanceInspection',
    input: {
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
    },
    expect: {
      rulesFired: ['RES-001', 'RES-006', 'RES-002', 'RES-003', 'RES-005', 'RES-004', 'OPT-008', 'OPT-007', 'MEC-001', 'MEC-003', 'LGT-001', 'AI-001'],
      failingRules: ['OPT-008', 'OPT-007', 'MEC-001', 'MEC-003'],
      status: 'NOT_FEASIBLE',
      overall: 20,
      limitingFactors: ['Optics', 'Mechanical'],
      governingMmPerPx: 0.06,
      megapixelsPerCamera: [8.94, 0.01],
    },
    note:
      'Tay: U = 0,2/10 = 0,02; mm/px = 0,06 (đo) < 0,1 (lỗi 0,5/5). Lưới 2×2, ô 209×154 (chồng lấn 10%) → 3484×2567 px = 8,94 MP. ' +
      'Phối cảnh 2/300×129,8 = 0,865 mm; nhiệt 23×0,38×10 = 87,4 µm; ghép 0,03 + 0,0874 mm; telecentric 209 mm > 200. ' +
      'LỆCH SPEC §13 CÓ CHỦ Ý: spec ghi 8,3 MP (ô ~200×150, không rõ chồng lấn); spec liệt kê OPT-004/006, THR-001/002 — cần thiết bị hoặc sản lượng, V1b chưa có; ' +
      'spec ghi yếu tố giới hạn chỉ Mechanical — engine tính phối cảnh 43× U cũng FAIL cùng điểm 20 nên hiện cả Optics.',
  },
  {
    id: 'GT-002',
    name: 'Bụi trên lớp mạ sản phẩm nhựa, 1 camera 20 MP, đèn phẳng ở góc phản xạ',
    source: 'real-project',
    applicationType: 'AppearanceInspection',
    input: {
      'object.sizeX': 80,
      'object.sizeY': 55,
      'object.surface': 'glossy',
      'detection.0.minSize': 0.3,
      'detection.0.contrast': 'medium',
      'detection.0.variability': 'high',
      'production.motion': 'indexed',
      'system.cameraCount': 1,
      'system.workingDistance': 200,
      'system.cameraTiltDeg': 30,
    },
    expect: {
      rulesFired: ['RES-001', 'RES-004', 'OPT-009', 'LGT-001', 'AI-002'],
      failingRules: [],
      status: 'FEASIBLE_WITH_VALIDATION',
      overall: 60,
      limitingFactors: ['Lighting', 'Algorithm'],
      governingMmPerPx: 0.075,
      megapixelsPerCamera: [0.9, 0.01],
    },
    note:
      'Dự án thật 2025, sheet DỰ ÁN CŨ dòng 4 (Hưng nhập 2026-09-17; 2026-09-17 Hưng sửa kích thước vật 100×100 → 80×55 mm, vùng nhìn thật 105×70 mm). Kết quả thật: ĐẠT, yếu tố giới hạn thực tế: Chiếu sáng — ' +
      'engine khớp (khả thi cần xác nhận mẫu, Chiếu sáng là yếu tố giới hạn). Tay: tương phản trung bình → 4 px/lỗi → 0,3/4 = 0,075 mm/px; ' +
      'nghiêng 30° (V1c OPT-009): cạnh dài 80 ÷ (0,075 × cos 30°) = 1232 px × 55 ÷ 0,075 = 734 px = 0,90 MP. OPT-009 bài phát hiện lỗi chỉ ghi nhận (info). ' +
      'Thực tế: camera 20 MP 5472×3648, pixel 2,4 µm, ống 25 mm 1,2", WD 200 → vùng nhìn 105×70 mm, 0,019 mm/px. Tầng Cấu hình (OPT-001, xấp xỉ thấu kính mỏng β = f/(WD − f)) ra 91,9 × 61,3 mm — vẫn phủ vật 80 × 55, lệch ~13% so với thực tế vì WD đo từ mặt ống chứ không từ điểm chính. ' +
      'Đèn: backlight 200×200 nằm trên (cách 200 mm) + backlight 200×100 dựng bên cạnh (cách 100 mm), camera nghiêng ~25–35° — tấm sáng phẳng ở góc phản xạ gương.',
    knownGaps: [
      'Độ phân giải: engine đòi tối thiểu 0,075 mm/px (0,90 MP kể cả nghiêng 30°, V1c); thực tế dùng 0,019 mm/px (20 MP) và Hưng xác nhận camera thấp hơn đã thử KHÔNG thấy bụi. ' +
        'Hệ số nghiêng chỉ là 1/cos 30° = 1,155 (bản ghi trước ghi ×2 là sai), nên chênh lệch vẫn khoảng 20 lần về MP → số px/lỗi cho bụi trên bề mặt mạ bóng có thể phải cao hơn bảng 3/4/5. Chờ thêm dự án trước khi sửa luật; cần biết camera thấp hơn đã thử là bao nhiêu MP.',
      'Độ sâu trường ảnh (OPT-005, V1c): nghiêng 30° trên cạnh 80 mm → sâu thêm 40 mm; cộng Δh giả định 2 mm → cần khoảng F/78, gấp ~22× F#max F/3,6 → engine báo xung đột. Dự án thật vẫn đạt. ' +
        'Nguyên nhân khả dĩ: spec lấy vòng mờ c = 2 × pixel pitch, nhưng camera 20 MP dư ~4 lần so với 0,065 mm/px cần — mờ cho phép thật tính trên vật lớn hơn nhiều. Hưng chốt 2026-09-17: để sau, chưa đổi công thức. ' +
        'C9 (2026-09-18, chốt Q3): bài chỉ phát hiện lỗi thì xung đột này thành CẢNH BÁO + chụp mẫu (không loại ống) → GT-002 có phương án; bài có đo vẫn FAIL. Công thức vòng mờ vẫn chưa đổi.',
      'Chiếu sáng: engine gợi ý dome; thực tế dùng đèn phẳng ở góc phản xạ. Đã thêm "backlight" làm phương án thay thế cho bề mặt bóng (2026-09-17), chưa đổi gợi ý chính.',
    ],
  },
  {
    id: 'S-01',
    name: 'Mẫu soạn — đo 1 camera, chi tiết thép nhỏ, dung sai vừa → khả thi',
    source: 'synthetic',
    applicationType: 'Measurement',
    input: {
      'object.sizeX': 50,
      'object.sizeY': 40,
      'object.surface': 'matte',
      'object.heightVariation': 0.02,
      'object.material': 'steel',
      'measurement.0.tolerance': 0.05,
      'measurement.0.spanLength': 20,
      'system.cameraCount': 1,
      'system.workingDistance': 150,
      'environment.ambientTempRange': 5,
    },
    expect: {
      rulesFired: ['RES-002', 'RES-004', 'OPT-008', 'MEC-001'],
      failingRules: [],
      status: 'TECHNICALLY_FEASIBLE',
      overall: 95,
      limitingFactors: ['Resolution', 'Optics', 'Mechanical'],
      governingMmPerPx: 0.03,
      megapixelsPerCamera: [2.22, 0.01],
    },
    note:
      'Tay: U = 0,1/10 = 0,01; mm/px 0,03. 1 camera 50×40 → 1667×1334 = 2,22 MP. Phối cảnh 0,02/150×32,02 = 0,0043 (43% U, PASS, biên 2,3 → 95). ' +
      'Nhiệt 12×0,02×5 = 1,2 µm (12% U → 95). Bề mặt mờ, không có nhánh lỗi → không có luật chiếu sáng, thuật toán.',
  },
  {
    id: 'S-02',
    name: 'Mẫu soạn — ngoại quan 1 camera, vết xước, tương phản cao, biến động thấp',
    source: 'synthetic',
    applicationType: 'AppearanceInspection',
    input: {
      'object.sizeX': 100,
      'object.sizeY': 80,
      'object.surface': 'matte',
      'detection.0.minSize': 0.2,
      'detection.0.contrast': 'high',
      'detection.0.defectType': 'scratch',
      'detection.0.variability': 'low',
      'system.cameraCount': 1,
    },
    expect: {
      rulesFired: ['RES-001', 'RES-004', 'LGT-002', 'AI-001'],
      failingRules: [],
      status: 'FEASIBLE_WITH_VALIDATION',
      overall: 60,
      limitingFactors: ['Lighting'],
      megapixelsPerCamera: [1.8, 0.01],
    },
    note: 'Tay: 0,2/3 = 0,0667 mm/px → 1500×1200 = 1,8 MP. Xước → dark field, cần thử mẫu → Chiếu sáng UNKNOWN 60 (LGT-009). Biến động thấp → truyền thống PASS.',
  },
  {
    id: 'S-03',
    name: 'Mẫu soạn — như S-02 nhưng lỗi biến động cao → học sâu chờ mẫu',
    source: 'synthetic',
    applicationType: 'AppearanceInspection',
    input: {
      'object.sizeX': 100,
      'object.sizeY': 80,
      'object.surface': 'matte',
      'detection.0.minSize': 0.2,
      'detection.0.contrast': 'high',
      'detection.0.defectType': 'scratch',
      'detection.0.variability': 'high',
      'system.cameraCount': 1,
    },
    expect: {
      rulesFired: ['RES-001', 'RES-004', 'LGT-002', 'AI-002'],
      failingRules: [],
      status: 'FEASIBLE_WITH_VALIDATION',
      overall: 60,
      limitingFactors: ['Lighting', 'Algorithm'],
    },
    note: 'Tay: như S-02; AI-002 cần mẫu thật → Thuật toán UNKNOWN 60, cùng điểm với Chiếu sáng.',
  },
  {
    id: 'S-04',
    name: 'Mẫu soạn — như S-02 nhưng băng tải chạy 3 m/s → bắt buộc strobe',
    source: 'synthetic',
    applicationType: 'AppearanceInspection',
    input: {
      'object.sizeX': 100,
      'object.sizeY': 80,
      'object.surface': 'matte',
      'detection.0.minSize': 0.2,
      'detection.0.contrast': 'high',
      'detection.0.defectType': 'scratch',
      'detection.0.variability': 'low',
      'system.cameraCount': 1,
      'production.motion': 'continuous',
      'production.conveyorSpeed': 3000,
    },
    expect: {
      rulesFired: ['RES-001', 'RES-004', 'THR-005', 'LGT-008', 'LGT-002', 'AI-001'],
      failingRules: [],
      status: 'FEASIBLE_WITH_VALIDATION',
      overall: 60,
      limitingFactors: ['Lighting'],
    },
    note: 'Tay: phơi sáng tối đa 0,5×0,0667/3000 s = 11 µs < 50 µs → LGT-008. Chiếu sáng vẫn UNKNOWN 60 (xước cần mẫu) thấp hơn MARGINAL 70.',
  },
  {
    id: 'S-05',
    name: 'Mẫu soạn — vùng lớn, lỗi nhỏ, sản lượng cao → vượt mọi giao tiếp một làn',
    source: 'synthetic',
    applicationType: 'AppearanceInspection',
    input: {
      'object.sizeX': 400,
      'object.sizeY': 300,
      'detection.0.minSize': 0.05,
      'detection.0.contrast': 'high',
      'system.cameraCount': 1,
      'production.partsPerMinute': 600,
    },
    expect: {
      rulesFired: ['RES-001', 'RES-004', 'THR-001', 'THR-002', 'AI-001'],
      failingRules: ['THR-002'],
      status: 'NOT_FEASIBLE',
      overall: 20,
      limitingFactors: ['Throughput'],
    },
    note: 'Tay: 0,05/3 = 0,0167 mm/px → 24000×18000 ≈ 432 MP; 10 ảnh/s → ~4320 MB/s > CXP-12 1200×70% → THR-002 FAIL. Một camera cho vùng này là sai thiết kế — đúng thứ engine phải nói.',
  },
  {
    id: 'S-06',
    name: 'Mẫu soạn — đo span 300 mm trên chi tiết nhựa, xưởng không điều hoà → nhiệt FAIL',
    source: 'synthetic',
    applicationType: 'Measurement',
    input: {
      'object.sizeX': 300,
      'object.sizeY': 100,
      'object.heightVariation': 0,
      'object.material': 'plastic',
      'measurement.0.tolerance': 0.05,
      'measurement.0.spanLength': 300,
      'system.cameraCount': 1,
      'system.workingDistance': 500,
    },
    expect: {
      rulesFired: ['RES-002', 'RES-004', 'OPT-008', 'MEC-001'],
      failingRules: ['MEC-001'],
      status: 'NOT_FEASIBLE',
      overall: 20,
      limitingFactors: ['Mechanical'],
    },
    note: 'Tay: U 0,01; nhựa α 120 (suy từ vật liệu), ΔT giả định 10 → 120×0,3×10 = 360 µm = 36× U → FAIL. Δh = 0 → phối cảnh 0, PASS.',
  },
  {
    id: 'S-07',
    name: 'Mẫu soạn — vật inox nhỏ, yêu cầu đo không phối cảnh → telecentric khả thi',
    source: 'synthetic',
    applicationType: 'Measurement',
    input: {
      'object.sizeX': 60,
      'object.sizeY': 40,
      'object.heightVariation': 1,
      'object.material': 'stainless',
      'measurement.0.tolerance': 0.02,
      'measurement.0.spanLength': 30,
      'measurement.0.perspectiveFree': true,
      'system.cameraCount': 1,
      'system.workingDistance': 200,
      'environment.ambientTempRange': 2,
    },
    expect: {
      rulesFired: ['RES-002', 'RES-004', 'OPT-006', 'OPT-007', 'MEC-001'],
      failingRules: [],
      status: 'FEASIBLE_WITH_VALIDATION',
      overall: 70,
      limitingFactors: ['Optics'],
    },
    note: 'Tay: OPT-006 cảnh báo cần telecentric (MARGINAL 70); vùng 60 mm ≤ 100 → OPT-007 PASS (biên 1,67). Nhiệt 17×0,03×2 = 1 µm = 26% U → PASS.',
  },
  {
    id: 'S-08',
    name: 'Mẫu soạn — 2 camera, kích thước đo nằm gọn trong một camera → khả thi',
    source: 'synthetic',
    applicationType: 'Measurement',
    input: {
      'object.sizeX': 400,
      'object.sizeY': 100,
      'object.heightVariation': 0.02,
      'object.material': 'steel',
      'measurement.0.tolerance': 0.1,
      'measurement.0.spanLength': 150,
      'measurement.0.crossesCameraSeam': false,
      'system.cameraCount': 2,
      'system.workingDistance': 400,
      'environment.ambientTempRange': 3,
    },
    expect: {
      rulesFired: ['RES-002', 'RES-005', 'RES-004', 'OPT-008', 'MEC-001'],
      failingRules: [],
      status: 'TECHNICALLY_FEASIBLE',
      overall: 95,
      limitingFactors: ['Resolution', 'Optics', 'Mechanical'],
    },
    note: 'Tay: lưới 2×1, ô 220×100 (chồng lấn 20), r = 120,8; phối cảnh 0,02/400×120,8 = 0,006 = 30% U. Nhiệt 12×0,15×3 = 5,4 µm = 27% U. Không vắt qua → không có MEC-003.',
  },
  {
    id: 'S-09',
    name: 'Mẫu soạn — như S-08 nhưng kích thước đo vắt qua đường ghép → FAIL',
    source: 'synthetic',
    applicationType: 'Measurement',
    input: {
      'object.sizeX': 400,
      'object.sizeY': 100,
      'object.heightVariation': 0.02,
      'object.material': 'steel',
      'measurement.0.tolerance': 0.1,
      'measurement.0.spanLength': 150,
      'measurement.0.crossesCameraSeam': true,
      'system.cameraCount': 2,
      'system.workingDistance': 400,
      'environment.ambientTempRange': 3,
    },
    expect: {
      rulesFired: ['RES-002', 'RES-005', 'RES-004', 'OPT-008', 'MEC-001', 'MEC-003'],
      failingRules: ['MEC-003'],
      status: 'NOT_FEASIBLE',
      overall: 20,
      limitingFactors: ['Mechanical'],
    },
    note: 'Tay: 1 đường ghép × 0,5 × 0,06 = 0,03 + nhiệt 0,0054 = 0,0354 mm = 1,77× U → FAIL (biên 0,56 → 20). Chỉ khác S-08 đúng một ô.',
  },
  {
    id: 'S-10',
    name: 'Mẫu soạn — GT-001 chưa nhập số camera → không đoán, nhiệt vẫn FAIL',
    source: 'synthetic',
    applicationType: 'AppearanceInspection',
    input: {
      'object.sizeX': 380,
      'object.sizeY': 280,
      'detection.0.minSize': 0.5,
      'detection.0.contrast': 'unknown',
      'measurement.0.tolerance': 0.1,
    },
    expect: {
      rulesFired: ['RES-001', 'RES-006', 'RES-002', 'RES-003', 'RES-005', 'MEC-001', 'AI-001'],
      failingRules: ['MEC-001'],
      status: 'NOT_FEASIBLE',
      overall: 20,
      limitingFactors: ['Mechanical'],
    },
    note: 'Tay: RES-005 báo cần số camera (UNKNOWN). Chiều dài đo suy = 380, α giả định 23, ΔT giả định 10 → 87,4 µm = 4,4× U → FAIL. Không có phối cảnh / ghép ảnh vì không đoán số camera.',
  },
];
