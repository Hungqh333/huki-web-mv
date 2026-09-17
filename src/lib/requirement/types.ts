/**
 * Requirement — hợp đồng dữ liệu của Vision Engineer (spec V1.1 §3.2).
 *
 * Mọi thông số bọc trong Field<T>: không có giá trị "trần". Nhờ vậy mỗi con số
 * đều biết nó đến từ đâu (khách nêu / suy ra / giả định / chưa có) — điều kiện
 * để hiện được panel Assumptions và badge confidence.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 *
 * Khác spec §3.2 (đã duyệt 2026-09-13):
 * - Thêm `detection[].variability` — mở khoá AI-002.
 * - Thêm `measurement[].perspectiveFree` — mở khoá OPT-006.
 *
 * Cố ý để NGOÀI schema (tham số kỹ thuật của bộ tính, không phải yêu cầu khách):
 * TODO(V1b): `n_view` (số lần chụp mỗi sản phẩm), `px_per_defect` (N — spec coi
 * là mặc định cấu hình, suy từ `contrast`), `total_length_mm` (chiều dài cần
 * phủ — có thể cần cho RES-005 tiling).
 */
import type { ApplicationType } from '../visionEntry';

export type Confidence = 'stated' | 'inferred' | 'assumed' | 'unknown';

export interface Field<T> {
  value: T | null;
  /**
   * Không có = CHƯA HỎI (value luôn null).
   * 'unknown' = ĐÃ HỎI, người dùng trả lời "Chưa rõ" (value null).
   * Hai trạng thái này phải phân biệt được: câu hỏi bổ sung không hỏi lại ô
   * 'unknown', nhưng vẫn hỏi ô chưa hỏi.
   */
  confidence?: Confidence;
  /** Đoạn text gốc (khi confidence = 'stated' và đến từ parser). */
  sourceSpan?: string;
  /** Trỏ tới ASSUMPTION (khi confidence = 'assumed'). */
  assumptionId?: string;
  unit?: string;
}

/**
 * Giả định đến từ đâu (xem assumptions.ts):
 * 'default' ô trống lấy mặc định · 'derived' ô trống suy từ ô khác (α từ vật
 * liệu) · 'adapter' xấp xỉ khi chuyển sang bộ chọn cũ · 'parameter' tham số tính
 * cố định trong code.
 */
export type AssumptionSource = 'default' | 'derived' | 'adapter' | 'parameter';
/** 'warning': giả định sai có thể làm kết quả lệch về phía nguy hiểm. */
export type AssumptionLevel = 'info' | 'warning';

/**
 * ASSUMPTION (spec §3.1) — MỘT kiểu cho mọi nguồn giả định.
 * V1a chưa lưu database: sinh lại mỗi lần hiển thị từ bản nháp.
 */
export interface Assumption {
  /** Ổn định giữa các lần hiển thị; Field.assumptionId trỏ tới đây. */
  key: string;
  source: AssumptionSource;
  level: AssumptionLevel;
  /** Rule nào đọc giả định này. */
  ruleIds: readonly string[];
  /** Có khi source = 'default': ô nào trên bảng đang được điền. */
  path?: string;
  /** boolean cho ô Có/Không (vd vắt qua đường ghép giữa camera — MEC-003). */
  value?: number | string | boolean;
  unit?: string;
  /** Tên hiển thị khi không có `path` (với 'default', nhãn lấy từ ô trên bảng). */
  title?: { vi: string; en: string };
  vi: string;
  en: string;
}

export type Surface = 'matte' | 'glossy' | 'metallic' | 'black' | 'transparent' | 'mixed';
export type DefectContrast = 'high' | 'medium' | 'low' | 'unknown';
export type DefectVariability = 'low' | 'medium' | 'high' | 'unknown';
export type Motion = 'static' | 'indexed' | 'continuous';
export type MountingRigidity = 'rigid' | 'standard' | 'unknown';
export type EnvironmentCondition = 'clean' | 'dust' | 'oil' | 'vibration' | 'variableLight' | 'highTemp';
export type ResultInterface = 'digitalIO' | 'ethernetIP' | 'profinet' | 'modbus' | 'tcp';

// ─── NHÁNH 1: PHÁT HIỆN LỖI ───
export interface DetectionItem {
  id: string;
  /** scratch / dent / contamination / crack... */
  defectType: Field<string>;
  /** mm */
  minSize: Field<number>;
  contrast: Field<DefectContrast>;
  region: Field<'full' | 'partial'>;
  /** Biến động ngoại hình lỗi — AI-002. */
  variability: Field<DefectVariability>;
}

// ─── NHÁNH 2: ĐO LƯỜNG ───
export interface MeasurementItem {
  id: string;
  feature: Field<string>;
  /** mm */
  nominal: Field<number>;
  /** mm, DẠNG ± (T_total = 2 × giá trị này) */
  tolerance: Field<number>;
  /** mm — chiều dài kích thước cần đo (MEC-001, MEC-003) */
  spanLength: Field<number>;
  /** MEC-003 */
  crossesCameraSeam: Field<boolean>;
  /** Cần đo không phối cảnh — OPT-006. */
  perspectiveFree: Field<boolean>;
}

export interface Requirement {
  id: string;
  applicationType: ApplicationType;

  object: {
    /** mm */
    sizeX: Field<number>;
    /** mm */
    sizeY: Field<number>;
    /** mm — biến động chiều cao / độ nghiêng */
    heightVariation: Field<number>;
    surface: Field<Surface>;
    colorInspection: Field<boolean>;
    material: Field<string>;
    /** µm/(m·K) */
    thermalExpansionCoeff: Field<number>;
  };

  detection: DetectionItem[];
  measurement: MeasurementItem[];

  production: {
    /** s/sản phẩm */
    taktTime: Field<number>;
    partsPerMinute: Field<number>;
    motion: Field<Motion>;
    /** mm/s */
    conveyorSpeed: Field<number>;
  };

  system: {
    cameraCount: Field<number>;
    /** mm */
    workingDistance: Field<number>;
    /** mm — giới hạn không gian máy */
    workingDistanceMax: Field<number>;
    mountingRigidity: Field<MountingRigidity>;
    /**
     * Độ — góc trục camera lệch khỏi pháp tuyến bề mặt; 0 = nhìn vuông góc.
     * Thêm ở V1c (C2, OPT-009) sau GT-002: bụi trên mạ bóng chụp nghiêng ~30°
     * để né phản xạ gương. Trống = vuông góc, KHÔNG giả định.
     */
    cameraTiltDeg: Field<number>;
  };

  environment: {
    conditions: Field<EnvironmentCondition[]>;
    /** ΔT, K */
    ambientTempRange: Field<number>;
    ipRequirement: Field<string>;
  };

  integration: {
    plc: Field<string>;
    robot: Field<string>;
    resultInterface: Field<ResultInterface[]>;
  };
}
