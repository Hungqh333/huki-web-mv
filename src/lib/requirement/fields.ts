/**
 * Trường nào của Requirement hiện trên bảng tóm tắt V1a, và cách đọc/ghi chúng.
 *
 * V1a chỉ làm đủ Kiểm tra ngoại quan + Đo lường, mỗi nhánh MỘT phần tử
 * (`detection[0]`, `measurement[0]`). Kiểu dữ liệu vẫn là mảng như spec §3.2
 * để khi hỗ trợ nhiều phần tử không phải đổi contract.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import type { ApplicationType } from '../visionEntry';
import type { DetectionItem, Field, MeasurementItem, Requirement } from './types';

export type RequirementSection =
  | 'object'
  | 'detection'
  | 'measurement'
  | 'production'
  | 'system'
  | 'environment';

export const REQUIREMENT_SECTIONS: readonly RequirementSection[] = [
  'object',
  'detection',
  'measurement',
  'production',
  'system',
  'environment',
];

export type RequirementFieldKind = 'number' | 'select' | 'boolean' | 'multiselect' | 'text';

export type RequirementFieldDef = {
  /** Đường dẫn trong Requirement, mảng dùng chỉ số: 'detection.0.minSize'. */
  path: string;
  section: RequirementSection;
  /** Khoá nhãn: designer.requirement.fields.<section>.<key> */
  key: string;
  kind: RequirementFieldKind;
  unit?: string;
  min?: number;
  /** Giá trị lựa chọn; nhãn ở designer.requirement.options.<optionsKey>.<value> */
  options?: readonly string[];
  optionsKey?: string;
};

/** Hai loại V1a làm đủ. Loại khác chỉ có phần thông số chung. */
export const V1A_FULL_SUPPORT: readonly ApplicationType[] = ['AppearanceInspection', 'Measurement'];

// Giá trị defectType / feature / ipRequirement lấy ĐÚNG tập giá trị của form bộ
// chọn (src/lib/selector/fields.ts) để adapter chuyển thẳng, không phải đoán.
export const SURFACES = ['matte', 'glossy', 'metallic', 'black', 'transparent', 'mixed'] as const;
export const DEFECT_TYPES = [
  'scratch',
  'glossy_curved',
  'print_color',
  'profile_hole_burr',
  'shallow_dent',
  'transparent',
] as const;
export const CONTRASTS = ['high', 'medium', 'low', 'unknown'] as const;
export const VARIABILITIES = ['low', 'medium', 'high', 'unknown'] as const;
export const FEATURES = ['dimension', 'diameter', 'angle', 'position'] as const;
export const MOTIONS = ['static', 'indexed', 'continuous'] as const;
export const CONDITIONS = ['clean', 'dust', 'oil', 'vibration', 'variableLight', 'highTemp'] as const;
export const IP_REQUIREMENTS = ['none', 'ip54', 'ip65', 'ip67'] as const;

/** Danh sách trường V1a, theo thứ tự hiện trên bảng. */
export const V1A_FIELDS: readonly RequirementFieldDef[] = [
  { path: 'object.sizeX', section: 'object', key: 'sizeX', kind: 'number', unit: 'mm', min: 0.1 },
  { path: 'object.sizeY', section: 'object', key: 'sizeY', kind: 'number', unit: 'mm', min: 0.1 },
  { path: 'object.surface', section: 'object', key: 'surface', kind: 'select', options: SURFACES, optionsKey: 'surface' },
  { path: 'object.colorInspection', section: 'object', key: 'colorInspection', kind: 'boolean' },
  { path: 'object.heightVariation', section: 'object', key: 'heightVariation', kind: 'number', unit: 'mm', min: 0 },
  { path: 'object.material', section: 'object', key: 'material', kind: 'text' },

  { path: 'detection.0.minSize', section: 'detection', key: 'minSize', kind: 'number', unit: 'mm', min: 0.001 },
  { path: 'detection.0.defectType', section: 'detection', key: 'defectType', kind: 'select', options: DEFECT_TYPES, optionsKey: 'defectType' },
  { path: 'detection.0.contrast', section: 'detection', key: 'contrast', kind: 'select', options: CONTRASTS, optionsKey: 'contrast' },
  { path: 'detection.0.variability', section: 'detection', key: 'variability', kind: 'select', options: VARIABILITIES, optionsKey: 'variability' },

  { path: 'measurement.0.tolerance', section: 'measurement', key: 'tolerance', kind: 'number', unit: '± mm', min: 0.001 },
  { path: 'measurement.0.feature', section: 'measurement', key: 'feature', kind: 'select', options: FEATURES, optionsKey: 'feature' },
  { path: 'measurement.0.spanLength', section: 'measurement', key: 'spanLength', kind: 'number', unit: 'mm', min: 0 },
  { path: 'measurement.0.crossesCameraSeam', section: 'measurement', key: 'crossesCameraSeam', kind: 'boolean' },
  { path: 'measurement.0.perspectiveFree', section: 'measurement', key: 'perspectiveFree', kind: 'boolean' },

  { path: 'production.partsPerMinute', section: 'production', key: 'partsPerMinute', kind: 'number', unit: 'part/min', min: 0 },
  { path: 'production.motion', section: 'production', key: 'motion', kind: 'select', options: MOTIONS, optionsKey: 'motion' },
  { path: 'production.conveyorSpeed', section: 'production', key: 'conveyorSpeed', kind: 'number', unit: 'mm/s', min: 0 },

  { path: 'system.cameraCount', section: 'system', key: 'cameraCount', kind: 'number', min: 1 },
  { path: 'system.workingDistance', section: 'system', key: 'workingDistance', kind: 'number', unit: 'mm', min: 1 },

  { path: 'environment.conditions', section: 'environment', key: 'conditions', kind: 'multiselect', options: CONDITIONS, optionsKey: 'conditions' },
  { path: 'environment.ambientTempRange', section: 'environment', key: 'ambientTempRange', kind: 'number', unit: 'K', min: 0 },
  { path: 'environment.ipRequirement', section: 'environment', key: 'ipRequirement', kind: 'select', options: IP_REQUIREMENTS, optionsKey: 'ipRequirement' },
];

const hasDetection = (type: ApplicationType) => type === 'AppearanceInspection';
const hasMeasurement = (type: ApplicationType) =>
  type === 'AppearanceInspection' || type === 'Measurement';

/** Trường hiện cho một loại ứng dụng: nhánh nào loại đó không có thì ẩn. */
export function fieldsFor(type: ApplicationType): RequirementFieldDef[] {
  return V1A_FIELDS.filter((def) => {
    if (def.section === 'detection') return hasDetection(type);
    if (def.section === 'measurement') return hasMeasurement(type);
    return true;
  });
}

function unknown<T>(unit?: string): Field<T> {
  return unit ? { value: null, confidence: 'unknown', unit } : { value: null, confidence: 'unknown' };
}

function emptyDetection(id: string): DetectionItem {
  return {
    id,
    defectType: unknown(),
    minSize: unknown('mm'),
    contrast: unknown(),
    region: unknown(),
    variability: unknown(),
  };
}

function emptyMeasurement(id: string): MeasurementItem {
  return {
    id,
    feature: unknown(),
    nominal: unknown('mm'),
    tolerance: unknown('mm'),
    spanLength: unknown('mm'),
    crossesCameraSeam: unknown(),
    perspectiveFree: unknown(),
  };
}

/** Requirement chưa có thông số nào: mọi Field đều `unknown`. */
export function emptyRequirement(type: ApplicationType, id = 'draft'): Requirement {
  return {
    id,
    applicationType: type,
    object: {
      sizeX: unknown('mm'),
      sizeY: unknown('mm'),
      heightVariation: unknown('mm'),
      surface: unknown(),
      colorInspection: unknown(),
      material: unknown(),
      thermalExpansionCoeff: unknown('µm/(m·K)'),
    },
    detection: hasDetection(type) ? [emptyDetection('det-1')] : [],
    measurement: hasMeasurement(type) ? [emptyMeasurement('meas-1')] : [],
    production: {
      taktTime: unknown('s'),
      partsPerMinute: unknown('part/min'),
      motion: unknown(),
      conveyorSpeed: unknown('mm/s'),
    },
    system: {
      cameraCount: unknown(),
      workingDistance: unknown('mm'),
      workingDistanceMax: unknown('mm'),
      mountingRigidity: unknown(),
    },
    environment: {
      conditions: unknown(),
      ambientTempRange: unknown('K'),
      ipRequirement: unknown(),
    },
    integration: {
      plc: unknown(),
      robot: unknown(),
      resultInterface: unknown(),
    },
  };
}

function isField(node: unknown): node is Field<unknown> {
  return Boolean(node) && typeof node === 'object' && 'value' in (node as object) && 'confidence' in (node as object);
}

/** Đọc một Field theo đường dẫn; `null` nếu đường dẫn không tồn tại. */
export function readField(requirement: Requirement, path: string): Field<unknown> | null {
  let node: unknown = requirement;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return null;
    node = Array.isArray(node) ? node[Number(part)] : (node as Record<string, unknown>)[part];
  }
  return isField(node) ? node : null;
}

/**
 * Người dùng sửa một ô trên bảng tóm tắt → giá trị đó thành 'stated'.
 * Xoá trắng → quay về 'unknown'. Trả object mới, không sửa object cũ.
 */
export function withFieldValue(requirement: Requirement, path: string, value: unknown): Requirement {
  const next = structuredClone(requirement);
  const field = readField(next, path);
  if (!field) return requirement;

  const empty = value === null || value === '' || (Array.isArray(value) && value.length === 0);
  field.value = empty ? null : value;
  field.confidence = empty ? 'unknown' : 'stated';
  delete field.sourceSpan;
  delete field.assumptionId;
  return next;
}

/**
 * Đổi loại ứng dụng mà không mất phần đã nhập: giữ thông số chung (vật thể,
 * sản xuất, hệ thống, môi trường, tích hợp), giữ nhánh nào loại mới vẫn có.
 */
export function changeApplicationType(previous: Requirement | null, type: ApplicationType): Requirement {
  const next = emptyRequirement(type, previous?.id);
  if (!previous) return next;

  const carried = structuredClone(previous);
  return {
    ...next,
    object: carried.object,
    production: carried.production,
    system: carried.system,
    environment: carried.environment,
    integration: carried.integration,
    detection: next.detection.length > 0 && carried.detection.length > 0 ? carried.detection : next.detection,
    measurement: next.measurement.length > 0 && carried.measurement.length > 0 ? carried.measurement : next.measurement,
  };
}

/** Bao nhiêu ô trên bảng đã có giá trị. */
export function countFilled(requirement: Requirement): { filled: number; total: number } {
  const defs = fieldsFor(requirement.applicationType);
  const filled = defs.filter((def) => readField(requirement, def.path)?.value != null).length;
  return { filled, total: defs.length };
}
