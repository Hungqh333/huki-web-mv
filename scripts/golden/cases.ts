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
