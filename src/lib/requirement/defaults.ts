/**
 * Giá trị mặc định khi requirement còn trống — spec V1.1 §3.3 (V1a hạng mục 6).
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 *
 * Mặc định KHÔNG ghi vào bản nháp. Bản nháp chỉ chứa thứ người dùng nhập; giả
 * định áp lúc hiển thị (xem assumptions.ts). Nhờ vậy đổi một mặc định ở đây thì
 * mọi bản nháp đang mở đều thấy số mới, và không bao giờ lẫn được "khách nói
 * 300 mm" với "hệ thống đoán 300 mm".
 *
 * Phân định với CLAUDE.md §9 ("bảng luật sửa được qua admin, không hard-code"):
 * - LUẬT = logic quyết định (điều kiện → gợi ý) → database + admin.
 * - MẶC ĐỊNH = tham số kỹ thuật có căn cứ vật lý / quy ước ngành → code + test.
 *   Cho sửa qua admin thì một cú nhập nhầm đổi kết quả của mọi dự án mà không
 *   test nào bắt được.
 * TODO(V1b): xem lại ranh giới này khi dựng rule engine. FIELD_DEFAULTS có thể
 * lên DB + admin (là giả định về khách, phòng muốn chỉnh theo thị trường);
 * GRR_DIVISOR, K_SUBPIXEL, N_DET_BY_CONTRAST thì KHÔNG nên cho sửa qua admin.
 */
import type { MATERIALS } from './fields';
import type { AssumptionLevel, DefectContrast } from './types';

export type FieldDefault = {
  /** Đường dẫn trong Requirement, cùng dạng với V1A_FIELDS. */
  path: string;
  value: number | string;
  unit?: string;
  /** Rule nào đọc giá trị này — giả định sai thì rule đó ra kết quả sai. */
  ruleIds: readonly string[];
  /** 'warning': giả định sai có thể làm kết quả lệch về phía nguy hiểm. */
  level: AssumptionLevel;
  basis: { vi: string; en: string };
};

/**
 * Thứ tự = thứ tự hiện trên panel. Chỉ áp cho trường ĐANG CÓ trên bảng tóm tắt
 * của loại ứng dụng đó: giả định nào cũng phải thay được bằng số thật ngay
 * trong bảng.
 *
 * TODO(V1b): `system.mountingRigidity` = 'standard' (spec §3.3) — chưa có ô
 * trên bảng V1a nên chưa đưa vào; thêm cùng MEC-002.
 */
export const FIELD_DEFAULTS: readonly FieldDefault[] = [
  {
    path: 'detection.0.contrast',
    value: 'low',
    ruleIds: ['RES-001', 'RES-006'],
    level: 'warning',
    basis: {
      vi: 'Thiếu thông tin thì lấy trường hợp xấu nhất. Cần ảnh mẫu để xác nhận.',
      en: 'Missing information → assume the worst case. Needs sample images to confirm.',
    },
  },
  {
    path: 'object.heightVariation',
    value: 2,
    unit: 'mm',
    ruleIds: ['OPT-006', 'OPT-008'],
    level: 'warning',
    basis: {
      vi: 'Theo kinh nghiệm, cần khách xác nhận. Quyết định sai số phối cảnh và độ sâu trường ảnh.',
      en: 'Rule of thumb, must be confirmed. Drives perspective error and depth of field.',
    },
  },
  {
    path: 'system.workingDistance',
    value: 300,
    unit: 'mm',
    ruleIds: ['OPT-001', 'OPT-005', 'OPT-008'],
    level: 'warning',
    basis: {
      vi: 'Khoảng thông dụng, chưa phải không gian máy thật. Quyết định tiêu cự lens và sai số phối cảnh.',
      en: 'A typical value, not the real machine space. Drives lens focal length and perspective error.',
    },
  },
  {
    path: 'object.thermalExpansionCoeff',
    value: 23,
    unit: 'µm/(m·K)',
    ruleIds: ['MEC-001'],
    level: 'warning',
    basis: {
      vi: 'Nhôm — vật liệu phổ biến nhất. Thép ≈ 12, nhựa có thể > 50: vật liệu khác thì sửa lại.',
      en: 'Aluminium — the most common material. Steel ≈ 12, plastics can exceed 50: change it for other materials.',
    },
  },
  {
    path: 'environment.ambientTempRange',
    value: 10,
    unit: 'K',
    ruleIds: ['MEC-001'],
    level: 'warning',
    basis: {
      vi: 'Nhà máy không điều hoà.',
      en: 'Factory without air conditioning.',
    },
  },
  {
    path: 'production.motion',
    value: 'indexed',
    ruleIds: ['THR-005'],
    level: 'info',
    basis: {
      vi: 'Kiểu dây chuyền thường gặp. Nếu sản phẩm chạy liên tục khi chụp thì phải xét nhoè chuyển động.',
      en: 'The most common line type. If parts keep moving during capture, motion blur must be checked.',
    },
  },
];

export type KnownMaterial = Exclude<(typeof MATERIALS)[number], 'other'>;

export type MaterialAlpha = {
  /** µm/(m·K) */
  alpha: number;
  /** 'warning' khi mác vật liệu trong nhóm lệch α nhiều. */
  level: AssumptionLevel;
  basis: { vi: string; en: string };
};

/**
 * MEC-001 — hệ số giãn nở nhiệt α suy từ vật liệu (V1a hạng mục 5).
 *
 * Giá trị điển hình, chưa đối chiếu datasheet. Cần xác minh trước khi dùng
 * cho báo giá thực tế.
 *
 * Là tham số vật lý → code + test, không qua admin.
 *
 * Nhóm có dải rộng lấy về phía XẤU (theo §3.3: thiếu thông tin thì giả định xấu
 * nhất, giống contrast mặc định 'low'). α lớn hơn → sai số giãn nở lớn hơn →
 * MEC-001 khó PASS hơn. Lấy giá trị giữa dải thì khoảng một nửa số trường hợp
 * tính THIẾU sai số: MEC-001 báo PASS trong khi thực tế FAIL.
 * - Nhựa: dải 50–150 → lấy 120, cận trên thực dụng (nhựa kỹ thuật thường dùng
 *   ABS, POM, PA, PC ở khoảng 70–110).
 * - Inox: 17 (austenit SUS304/316) — cảnh báo ferrit SUS430 chỉ khoảng 10.
 */
export const MATERIAL_ALPHA: Record<KnownMaterial, MaterialAlpha> = {
  aluminium: {
    alpha: 23,
    level: 'info',
    basis: {
      vi: 'Suy từ vật liệu: hợp kim nhôm, α điển hình ở 20 °C (khoảng 21–24). Cần datasheet để chốt.',
      en: 'Inferred from material: aluminium alloy, typical α at 20 °C (about 21–24). Confirm with the datasheet.',
    },
  },
  steel: {
    alpha: 12,
    level: 'info',
    basis: {
      vi: 'Suy từ vật liệu: thép carbon, α điển hình ở 20 °C (khoảng 11–13). Cần datasheet để chốt.',
      en: 'Inferred from material: carbon steel, typical α at 20 °C (about 11–13). Confirm with the datasheet.',
    },
  },
  stainless: {
    alpha: 17,
    level: 'warning',
    basis: {
      vi: 'Suy từ vật liệu: inox austenit (SUS304/316) khoảng 16–17. Inox ferrit (SUS430) chỉ khoảng 10 — mác khác thì chọn "Khác" và nhập α.',
      en: 'Inferred from material: austenitic stainless (SUS304/316) about 16–17. Ferritic grades (SUS430) are only about 10 — for other grades choose "Other" and enter α.',
    },
  },
  plastic: {
    alpha: 120,
    level: 'warning',
    basis: {
      vi: 'Suy từ vật liệu: nhựa lệch rất rộng (khoảng 50–150 tuỳ loại). Lấy 120 — phía xấu của dải, để không tính thiếu giãn nở nhiệt. Biết loại nhựa thì chọn "Khác" và nhập α theo datasheet.',
      en: 'Inferred from material: plastics vary widely (about 50–150 by type). Using 120 — the unfavourable end of the range, so thermal expansion is not underestimated. If the grade is known, choose "Other" and enter α from the datasheet.',
    },
  },
};

/**
 * RES-001 — số pixel phủ lên lỗi nhỏ nhất, theo độ tương phản lỗi.
 * Rule-of-thumb cho lỗi dạng blob; vết xước mảnh cần nhiều hơn (LGT-002).
 *
 * Đây là MỘT luật với ba nhánh, không phải ba hằng số. Spec §3.3 bản 2026-09-13
 * ghi "N_det = 4" là sai — 4 chỉ là nhánh contrast trung bình.
 */
export const N_DET_BY_CONTRAST: Record<DefectContrast, number> = {
  high: 3,
  medium: 4,
  low: 5,
  unknown: 5,
};
