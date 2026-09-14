/**
 * Câu hỏi bổ sung — spec V1.1 §10.2 "Thông tin còn thiếu" (V1a hạng mục 5).
 *
 * Chỉ hỏi những gì luật đang cần, không hỏi cho đủ bộ. Một câu mở khi: ô còn
 * CHƯA HỎI và luật dùng ô đó đang có điều kiện chạy (vd có dung sai đo thì mới
 * cần Δh, WD, ΔT, vật liệu).
 *
 * Thứ tự theo bậc (đã duyệt 2026-09-14) — câu mở khoá luật có thể ra FAIL đứng
 * trước câu chỉ ảnh hưởng gợi ý:
 *   1 kích thước · 2 lỗi nhỏ nhất / dung sai · 3 độ tương phản · 4 Δh + WD ·
 *   5 span + ΔT + vật liệu · 6 vắt ranh giới camera · 7 số camera ·
 *   8 bề mặt, chuyển động, biến động ngoại hình
 * WD đi cùng Δh vì sai số phối cảnh = (Δh / WD) × r: hỏi tử số mà đoán mẫu số
 * thì kết quả vẫn nửa vời.
 *
 * Câu hỏi đọc BẢN NHÁP, không đọc bản đã điền giả định: ô đang giả định vẫn là
 * ô chưa hỏi, nên vẫn được hỏi.
 *
 * Trạng thái một ô, dùng đúng Confidence §3.2:
 * - không có confidence  → chưa hỏi
 * - confidence 'unknown' → đã hỏi, người dùng "Chưa rõ"; không hỏi lại
 * - có giá trị           → đã trả lời
 * Ô có sẵn giá trị enum 'unknown' (contrast, variability) thì "Chưa rõ" ghi thẳng
 * giá trị đó — luật RES-006 đọc đúng giá trị này.
 *
 * TODO(V1b): suy bảng này từ `requiredInputs` của rule registry thay vì khai tay;
 * `ruleIds` ở đây là nguồn đối chiếu. V1a chỉ hiện MỤC ĐÍCH (purposes.ts).
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import { V1A_FIELDS, fieldsFor, readField, withFieldNotAsked, withFieldUnknown, withFieldValue } from './fields';
import type { Field, Requirement } from './types';

export const MAX_VISIBLE_QUESTIONS = 3;

export type QuestionDef = {
  id: string;
  /** Bậc ưu tiên, 1 hỏi trước. */
  tier: number;
  /** Ô câu hỏi này điền. Loại ứng dụng không có đủ các ô này thì không hỏi. */
  paths: readonly string[];
  /** Ô phải hỏi tiếp tuỳ câu trả lời (vật liệu "Khác" → α; chạy liên tục → tốc độ). */
  followUp?: { path: string; when: (requirement: Requirement) => boolean };
  /** Ô này đã có giá trị thì câu hỏi coi như xong (α nhập tay → khỏi hỏi vật liệu). */
  satisfiedBy?: string;
  /** Luật cần câu trả lời — V1b. Giao diện V1a hiện mục đích suy từ đây. */
  ruleIds: readonly string[];
  /** Điều kiện luật đang cần ô này, xét trên bản nháp. */
  askWhen: (requirement: Requirement) => boolean;
  /** Nút điền nhanh giá trị cụ thể cho ô số đầu tiên — ghi 'stated'. */
  suggestions?: readonly number[];
};

export type QuestionStatus = 'open' | 'unknown' | 'answered';

const valueAt = (requirement: Requirement, path: string) => readField(requirement, path)?.value ?? null;
const hasDefectSize = (requirement: Requirement) => requirement.detection.some((item) => item.minSize.value !== null);
const hasTolerance = (requirement: Requirement) => requirement.measurement.some((item) => item.tolerance.value !== null);
const always = () => true;

export const QUESTIONS: readonly QuestionDef[] = [
  // Bậc 1
  { id: 'objectSize', tier: 1, paths: ['object.sizeX', 'object.sizeY'], ruleIds: ['RES-004'], askWhen: always },

  // Bậc 2
  { id: 'defectMinSize', tier: 2, paths: ['detection.0.minSize'], ruleIds: ['RES-001'], askWhen: (req) => req.detection.length > 0 },
  // Ngoại quan: nhánh đo là tuỳ chọn, không hỏi. Đo lường: bắt buộc.
  { id: 'tolerance', tier: 2, paths: ['measurement.0.tolerance'], ruleIds: ['RES-002'], askWhen: (req) => req.applicationType === 'Measurement' },

  // Bậc 3
  { id: 'contrast', tier: 3, paths: ['detection.0.contrast'], ruleIds: ['RES-001', 'RES-006'], askWhen: hasDefectSize },

  // Bậc 4
  {
    id: 'heightVariation',
    tier: 4,
    paths: ['object.heightVariation'],
    ruleIds: ['OPT-006', 'OPT-008'],
    askWhen: hasTolerance,
    suggestions: [0.1, 0.5, 2],
  },
  { id: 'workingDistance', tier: 4, paths: ['system.workingDistance'], ruleIds: ['OPT-008', 'OPT-001'], askWhen: hasTolerance },

  // Bậc 5
  { id: 'spanLength', tier: 5, paths: ['measurement.0.spanLength'], ruleIds: ['MEC-001'], askWhen: hasTolerance },
  { id: 'ambientTempRange', tier: 5, paths: ['environment.ambientTempRange'], ruleIds: ['MEC-001'], askWhen: hasTolerance },
  {
    id: 'material',
    tier: 5,
    paths: ['object.material'],
    followUp: { path: 'object.thermalExpansionCoeff', when: (req) => valueAt(req, 'object.material') === 'other' },
    satisfiedBy: 'object.thermalExpansionCoeff',
    ruleIds: ['MEC-001'],
    askWhen: hasTolerance,
  },

  // Bậc 6 — một camera thì không có ranh giới.
  {
    id: 'crossesCameraSeam',
    tier: 6,
    paths: ['measurement.0.crossesCameraSeam'],
    ruleIds: ['MEC-003'],
    askWhen: (req) => hasTolerance(req) && valueAt(req, 'system.cameraCount') !== 1,
  },

  // Bậc 7
  {
    id: 'cameraCount',
    tier: 7,
    paths: ['system.cameraCount'],
    ruleIds: ['RES-005'],
    askWhen: (req) =>
      valueAt(req, 'object.sizeX') !== null &&
      valueAt(req, 'object.sizeY') !== null &&
      (hasDefectSize(req) || hasTolerance(req)),
    suggestions: [1, 2, 4],
  },

  // Bậc 8
  { id: 'surface', tier: 8, paths: ['object.surface'], ruleIds: ['LGT-001', 'LGT-002', 'LGT-003', 'LGT-004', 'LGT-005'], askWhen: always },
  {
    id: 'motion',
    tier: 8,
    paths: ['production.motion'],
    followUp: { path: 'production.conveyorSpeed', when: (req) => valueAt(req, 'production.motion') === 'continuous' },
    ruleIds: ['THR-005'],
    askWhen: always,
  },
  { id: 'variability', tier: 8, paths: ['detection.0.variability'], ruleIds: ['AI-001', 'AI-002'], askWhen: hasDefectSize },
];

const isAsked = (field: Field<unknown> | null) => field?.confidence !== undefined;
const isUnknownAnswer = (field: Field<unknown> | null) =>
  field?.confidence === 'unknown' || field?.value === 'unknown';

/** Ô câu hỏi đang phụ trách: ô chính + ô hỏi tiếp nếu đang cần. */
function activePaths(requirement: Requirement, question: QuestionDef): string[] {
  const followUp = question.followUp && question.followUp.when(requirement) ? [question.followUp.path] : [];
  return [...question.paths, ...followUp];
}

/** Ô còn phải nhập để câu hỏi xong — giao diện vẽ ô nhập theo danh sách này. */
export function pendingPaths(requirement: Requirement, question: QuestionDef): string[] {
  return activePaths(requirement, question).filter((path) => !isAsked(readField(requirement, path)));
}

/** `null` = câu hỏi không áp dụng lúc này (loại ứng dụng không có ô, hoặc luật chưa cần). */
export function questionStatus(requirement: Requirement, question: QuestionDef): QuestionStatus | null {
  const shown = new Set(fieldsFor(requirement.applicationType).map((def) => def.path));
  const followUpShown = !question.followUp || shown.has(question.followUp.path);
  if (!question.paths.every((path) => shown.has(path)) || !followUpShown) return null;
  if (!question.askWhen(requirement)) return null;

  if (question.satisfiedBy && valueAt(requirement, question.satisfiedBy) !== null) return 'answered';

  const fields = activePaths(requirement, question).map((path) => readField(requirement, path));
  if (!fields.every(isAsked)) return 'open';
  return fields.some(isUnknownAnswer) ? 'unknown' : 'answered';
}

/** Câu còn mở theo thứ tự ưu tiên, và câu người dùng đã trả lời "Chưa rõ". */
export function pendingQuestions(requirement: Requirement): { open: QuestionDef[]; unknown: QuestionDef[] } {
  const open: QuestionDef[] = [];
  const unknown: QuestionDef[] = [];
  for (const question of QUESTIONS) {
    const status = questionStatus(requirement, question);
    if (status === 'open') open.push(question);
    if (status === 'unknown') unknown.push(question);
  }
  return { open, unknown };
}

/** "Chưa rõ": mọi ô còn chưa hỏi của câu này thành đã hỏi / chưa rõ. */
export function answerUnknown(requirement: Requirement, question: QuestionDef): Requirement {
  return pendingPaths(requirement, question).reduce((req, path) => {
    const def = V1A_FIELDS.find((d) => d.path === path);
    return def?.options?.includes('unknown') ? withFieldValue(req, path, 'unknown') : withFieldUnknown(req, path);
  }, requirement);
}

/** "Hỏi lại": những ô đang "Chưa rõ" của câu này về chưa hỏi. Ô đã có giá trị thật giữ nguyên. */
export function resetQuestion(requirement: Requirement, question: QuestionDef): Requirement {
  return activePaths(requirement, question)
    .filter((path) => isUnknownAnswer(readField(requirement, path)))
    .reduce((req, path) => withFieldNotAsked(req, path), requirement);
}
