/**
 * Hai chế độ bảng Yêu cầu: Cơ bản (mặc định) và Nâng cao — chốt 2026-10-14.
 *
 * Cơ bản chỉ hiện các thông số khách thường nêu ngay khi mô tả bài toán. Ô bị ẩn
 * KHÔNG đổi cách tính: engine vẫn dùng giả định như khi ô bỏ trống, panel Giả định
 * vẫn liệt kê đủ (Q2). Ô nâng cao đã có giá trị (bộ đọc điền, dự án cũ) vẫn hiện ở
 * Cơ bản để không giấu số liệu (Q3).
 *
 * File thuần TypeScript: chỉ là lớp HIỂN THỊ, không ảnh hưởng engine.
 */
import type { ApplicationType } from '../visionEntry';
import { fieldsFor, readField, type RequirementFieldDef } from './fields';
import type { Requirement } from './types';

export const FORM_MODES = ['basic', 'advanced'] as const;
export type FormMode = (typeof FORM_MODES)[number];
export const DEFAULT_FORM_MODE: FormMode = 'basic';
export const FORM_MODE_STORAGE_KEY = 'mvh.requirementFormMode';

export const isFormMode = (value: unknown): value is FormMode => FORM_MODES.includes(value as FormMode);

/** Ô cơ bản chung cho mọi loại ứng dụng (lọc tiếp theo ô loại đó có). */
const BASIC_COMMON = [
  'object.sizeX',
  'object.sizeY',
  'object.surface',
  'measurement.0.tolerance',
  'production.partsPerMinute',
  'production.motion',
  'system.cameraCount',
  'integration.resultInterface',
];

/** Ô cơ bản riêng theo loại — ngoại quan thêm lỗi, đo lường thêm kích thước cần đo (Q1). */
const BASIC_EXTRA: Partial<Record<ApplicationType, readonly string[]>> = {
  AppearanceInspection: ['detection.0.minSize', 'detection.0.defectType'],
  Measurement: ['measurement.0.feature'],
};

export function isBasicField(type: ApplicationType, path: string): boolean {
  return BASIC_COMMON.includes(path) || (BASIC_EXTRA[type]?.includes(path) ?? false);
}

/** Ô hiện trên bảng theo chế độ: Nâng cao = tất cả; Cơ bản = ô cơ bản + ô đã có giá trị. */
export function visibleFieldDefs(requirement: Requirement, mode: FormMode): RequirementFieldDef[] {
  const defs = fieldsFor(requirement.applicationType);
  if (mode === 'advanced') return defs;
  return defs.filter((def) => isBasicField(requirement.applicationType, def.path) || readField(requirement, def.path)?.value != null);
}

/** Số ô nâng cao đang ẩn — hiện ở nút chuyển chế độ. */
export function hiddenFieldCount(requirement: Requirement, mode: FormMode): number {
  return fieldsFor(requirement.applicationType).length - visibleFieldDefs(requirement, mode).length;
}

/** Câu hỏi "Thông tin còn thiếu" chỉ giữ câu có ít nhất một ô đang hiện (Q4). */
export function questionsForMode<Q extends { paths: readonly string[] }>(questions: readonly Q[], visiblePaths: ReadonlySet<string>): Q[] {
  return questions.filter((question) => question.paths.some((path) => visiblePaths.has(path)));
}
