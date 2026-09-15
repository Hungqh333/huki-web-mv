/**
 * Kết quả bộ đọc mô tả → bản nháp (V1a hạng mục 3).
 *
 * Nguyên tắc: parser chỉ ĐIỀN TRƯỚC, không bao giờ đè thứ người dùng đã làm.
 * - Chỉ điền ô chưa hỏi, đang hiện trên bảng của loại ứng dụng.
 * - Chưa có loại ứng dụng: nếu parser nhận ra loại thì dựng bảng loại đó (nhãn
 *   "Suy ra" trên ô chọn loại); không nhận ra thì giữ các ô đọc được ở trạng thái
 *   chờ, áp khi người dùng chọn loại.
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
  | { status: Exclude<DraftParseStatus, 'ok'> };

const noResult = (status: DraftParseStatus): DraftParse => ({
  status,
  applied: 0,
  dropped: 0,
  inferredApplicationType: null,
  pending: [],
});

export function applyParseResult(draft: RequirementDraft, result: ParseResult): RequirementDraft {
  if (result.status !== 'ok') return { ...draft, parse: noResult(result.status) };

  let requirement = draft.requirement;
  let inferred = draft.parse?.inferredApplicationType ?? null;
  if (!requirement && result.applicationType) {
    requirement = emptyRequirement(result.applicationType);
    inferred = result.applicationType;
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
    parse: { status: 'ok', applied, dropped: result.dropped, inferredApplicationType: inferred, pending: [] },
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
