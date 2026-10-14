/**
 * Kết quả bộ đọc mô tả → bản nháp (V1a hạng mục 3).
 *
 * Nguyên tắc: parser chỉ ĐIỀN TRƯỚC, không bao giờ đè thứ người dùng đã làm.
 * - Chỉ điền ô chưa hỏi, đang hiện trên bảng của loại ứng dụng.
 * - Chưa có loại ứng dụng: nếu parser nhận ra loại thì dựng bảng loại đó (nhãn
 *   "Suy ra" trên ô chọn loại); parser không chọn thì CODE suy từ các ô đọc được
 *   (applicationTypeFromFields, chốt 2026-10-14); vẫn không ra thì giữ các ô ở
 *   trạng thái chờ, áp khi người dùng chọn loại.
 * - "Đọc lại" không đổi loại ứng dụng đã có.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import type { ApplicationType } from '../visionEntry';
import type { DraftParse, DraftParseStatus, RequirementDraft } from './draft';
import { applyParsedFields, changeApplicationType, emptyRequirement, type ParsedField } from './fields';

/** Mô tả dài hơn thì không gửi đi đọc: tốn tiền và thường là dán nhầm tài liệu. */
export const PARSE_TEXT_MAX = 4000;

export type ParseResult =
  | { status: 'ok'; applicationType: ApplicationType | null; fields: ParsedField[]; dropped: number }
  /** `detail` = mã lỗi ngắn hiện lên màn hình để người dùng đọc lại cho người trực. */
  | { status: 'failed'; detail?: string }
  | { status: Exclude<DraftParseStatus, 'ok' | 'failed'> };

/**
 * Mã lỗi hiện ra màn hình: chỉ chữ, số và vài dấu, tối đa 60 ký tự. Chặn trường
 * hợp thông báo lỗi của thư viện lọt nguyên văn ra giao diện.
 */
export function safeParseCode(raw: string | undefined): string | undefined {
  const code = raw?.replace(/[^A-Za-z0-9 .·_-]/g, '').trim().slice(0, 60);
  return code || undefined;
}

/** Ô cho thấy bài toán phát hiện lỗi — có thì là Kiểm tra ngoại quan, kể cả khi có đo thêm. */
const DEFECT_PATHS = ['detection.0.minSize', 'detection.0.defectType'];
/** Ô cho thấy bài toán đo kích thước. */
const MEASUREMENT_PATHS = ['measurement.0.tolerance', 'measurement.0.feature', 'measurement.0.spanLength'];

/**
 * Loại ứng dụng suy từ các ô bộ đọc trích được, khi bộ đọc không chọn loại vì mô tả
 * lửng ("kiểm tra sản phẩm… độ chính xác 0.1 mm, lỗi nhỏ nhất 0.4 mm"). Luật cố
 * định trong code, cùng quy ước với prompt (extraction.ts): có lỗi → ngoại quan;
 * chỉ có đo → đo lường; còn lại không đoán. Chốt 2026-10-14 (phương án A).
 */
export function applicationTypeFromFields(fields: readonly ParsedField[]): ApplicationType | null {
  const has = (paths: string[]) => fields.some((field) => paths.includes(field.path));
  if (has(DEFECT_PATHS)) return 'AppearanceInspection';
  if (has(MEASUREMENT_PATHS)) return 'Measurement';
  return null;
}

const noResult = (status: DraftParseStatus, detail?: string): DraftParse => ({
  status,
  applied: 0,
  dropped: 0,
  inferredApplicationType: null,
  pending: [],
  ...(detail ? { detail } : {}),
});

export function applyParseResult(draft: RequirementDraft, result: ParseResult): RequirementDraft {
  if (result.status !== 'ok') {
    return { ...draft, parse: noResult(result.status, result.status === 'failed' ? safeParseCode(result.detail) : undefined) };
  }

  let requirement = draft.requirement;
  let inferred = draft.parse?.inferredApplicationType ?? null;
  let inferredFrom = draft.parse?.inferredFrom;
  if (!requirement) {
    const fromFields = result.applicationType ? null : applicationTypeFromFields(result.fields);
    const type = result.applicationType ?? fromFields;
    if (type) {
      requirement = emptyRequirement(type);
      inferred = type;
      inferredFrom = fromFields ? 'fields' : 'text';
    }
  }

  if (!requirement) {
    return {
      ...draft,
      parse: { status: 'ok', applied: 0, dropped: result.dropped, inferredApplicationType: null, pending: result.fields },
    };
  }

  const { requirement: next, applied } = applyParsedFields(requirement, result.fields);
  return {
    ...draft,
    requirement: next,
    // Ô nhập không-điều-khiển trên bảng phải vẽ lại với giá trị vừa điền.
    revision: draft.revision + 1,
    parse: {
      status: 'ok',
      applied,
      dropped: result.dropped,
      inferredApplicationType: inferred,
      ...(inferred && inferredFrom ? { inferredFrom } : {}),
      pending: [],
    },
  };
}

/** Người dùng chọn loại ứng dụng: đổi loại như cũ, rồi áp các ô parser đang giữ chờ. */
export function pickApplicationType(draft: RequirementDraft, type: ApplicationType): RequirementDraft {
  let requirement = changeApplicationType(draft.requirement, type);
  let parse = draft.parse;

  if (parse && parse.pending.length > 0) {
    const result = applyParsedFields(requirement, parse.pending);
    requirement = result.requirement;
    parse = { ...parse, applied: parse.applied + result.applied, pending: [] };
  }

  return { ...draft, requirement, revision: draft.revision + 1, ...(parse ? { parse } : {}) };
}
