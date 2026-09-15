/**
 * Dự án + revision (V1a hạng mục 7) — phần thuần: chuyển bản nháp ↔ revision.
 *
 * Revision là ẢNH CHỤP: requirement (chỉ giá trị người dùng nhập) + danh sách
 * giả định tính TẠI LÚC LƯU. Mở lại revision không tính lại giả định — giả định
 * nằm trong code và sẽ đổi, báo giá cũ phải tái lập được đúng số cũ.
 *
 * Quyền đọc/ghi do RLS (supabase/migrations/20260914000001_projects.sql).
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import { resolveAssumptions } from '../requirement/assumptions';
import { DRAFT_VERSION, parseDraft, type RequirementDraft } from '../requirement/draft';
import type { ApplicationType } from '../visionEntry';
import type { Assumption, Requirement } from '../requirement/types';

export const PROJECTS_ROUTE = '/du-an';

/** Cùng danh sách với check constraint projects_status_check — test kiểm. */
export const PROJECT_STATUSES = ['draft', 'analysis', 'design', 'testing', 'validated', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Cùng giới hạn với projects_name_check. */
export const PROJECT_NAME_MAX = 200;

export type RevisionPayload = {
  applicationType: ApplicationType;
  requirement: Requirement;
  assumptions: Assumption[];
  rawText: string | null;
  schemaVersion: number;
};

/** Dòng project_revisions đọc từ database — requirement chưa được tin. */
export type RevisionRow = {
  id: string;
  rev_label: string;
  requirement: unknown;
  raw_text: string | null;
  schema_version: number;
  locked_at: string | null;
};

export function normalizeProjectName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= PROJECT_NAME_MAX ? name : null;
}

/**
 * Bản nháp → nội dung ghi vào revision. Giả định tính ở đây (phía server gọi),
 * không nhận từ trình duyệt. `null` khi chưa chọn loại ứng dụng.
 */
export function buildRevisionPayload(draft: RequirementDraft): RevisionPayload | null {
  const requirement = draft.requirement;
  if (!requirement) return null;
  return {
    applicationType: requirement.applicationType,
    requirement,
    assumptions: resolveAssumptions(requirement).assumptions,
    rawText: draft.rawText,
    schemaVersion: DRAFT_VERSION,
  };
}

/** JSON với khoá sắp xếp: jsonb không giữ thứ tự khoá, dấu vân tay thì phải giữ. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Nội dung lưu được của bản nháp. Không tính liên kết dự án hay bộ đếm vẽ lại. */
export function draftFingerprint(draft: Pick<RequirementDraft, 'rawText' | 'requirement'>): string {
  return stableStringify({ rawText: draft.rawText, requirement: draft.requirement });
}

/** Có ô nào đã được hỏi (có giá trị hoặc "Chưa rõ") — tức người dùng đã nhập gì đó. */
function hasAnsweredField(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  if ('value' in node) return (node as { confidence?: unknown }).confidence !== undefined;
  return Object.values(node).some(hasAnsweredField);
}

/**
 * Mở một bản nháp khác (thẻ ứng dụng, ô mô tả, revision) sẽ THAY bản nháp đang có
 * trong tab. Chỉ hỏi xác nhận khi thật sự có thứ để mất: bản nháp hiện tại có nội
 * dung, và chưa lưu (chưa gắn dự án, hoặc đã sửa sau lần lưu gần nhất). Bản nháp
 * trống hoặc chính bản sắp mở thì không hỏi.
 */
export function draftAtRisk(current: RequirementDraft | null, nextStartedFrom: string): boolean {
  if (!current || current.startedFrom === nextStartedFrom) return false;
  const hasContent = Boolean(current.rawText) || hasAnsweredField(current.requirement);
  if (!hasContent) return false;
  return !current.project || draftFingerprint(current) !== current.project.savedFingerprint;
}

/**
 * Revision → bản nháp để mở lại trên bảng tóm tắt. Đi qua đúng parseDraft như
 * bản nháp trong trình duyệt: schema cũ được chuyển đổi, schema lạ / hỏng → null.
 */
export function revisionToDraft(project: { id: string; name: string }, row: RevisionRow): RequirementDraft | null {
  if (!row.requirement || typeof row.requirement !== 'object') return null;

  const draft = parseDraft(
    JSON.stringify({
      version: row.schema_version,
      startedFrom: `project:${project.id}:${row.rev_label}`,
      rawText: row.raw_text,
      requirement: row.requirement,
      revision: 0,
    })
  );
  if (!draft?.requirement) return null;

  return {
    ...draft,
    project: {
      id: project.id,
      name: project.name,
      revisionId: row.id,
      revLabel: row.rev_label,
      locked: row.locked_at !== null,
      savedFingerprint: draftFingerprint(draft),
    },
  };
}
