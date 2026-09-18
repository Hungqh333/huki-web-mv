/**
 * Bản nháp yêu cầu giữa trang chủ và bảng tóm tắt.
 *
 * V1a chưa có bảng projects (hạng mục 7) nên bản nháp nằm ở sessionStorage của
 * trình duyệt. Văn bản khách gõ KHÔNG đưa lên URL: vừa dài vừa có thể chứa
 * thông tin dự án. Thẻ ứng dụng thì chỉ truyền enum qua `?app=`.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import { APPLICATION_TYPES, type ApplicationType } from '../visionEntry';
import { MATERIALS, emptyRequirement, fieldsFor, readField, type ParsedField } from './fields';
import type { Requirement } from './types';
import { isBomSelection, type BomSelection } from '../vision/bomSelection';

export const REQUIREMENT_ROUTE = '/thiet-ke-he-thong/yeu-cau';

/**
 * v2 (hạng mục 5): ô chưa hỏi không còn mang confidence 'unknown' — 'unknown'
 * giờ nghĩa là đã hỏi và người dùng chưa rõ. Ô Vật liệu thành ô chọn.
 */
export const DRAFT_VERSION = 2;

/**
 * Bản nháp đang gắn với revision nào của dự án (hạng mục 7). Không có = bản nháp
 * tự do, chưa lưu. Chỉ là con trỏ để hiển thị và gọi lưu — quyền thật do RLS.
 */
export type DraftProjectLink = {
  id: string;
  name: string;
  revisionId: string;
  revLabel: string;
  /** Revision đã khoá: chỉ xem, không lưu đè được. */
  locked: boolean;
  /** Dấu vân tay nội dung lúc lưu gần nhất (draftFingerprint) để biết có thay đổi chưa lưu. */
  savedFingerprint: string;
};

export type RequirementDraft = {
  version: typeof DRAFT_VERSION;
  /**
   * Bản nháp bắt đầu từ đâu: 'text:<thời điểm>' (ô nhập), 'app:<loại>' (thẻ),
   * 'manual'. Trang dùng để biết `?app=` trên URL đã được áp vào bản nháp chưa.
   */
  startedFrom: string;
  rawText: string | null;
  /** `null` khi chưa chọn loại ứng dụng (vào từ ô nhập, parser chưa có). */
  requirement: Requirement | null;
  /** Tăng mỗi lần làm lại / đổi loại / trả lời câu hỏi, để ô nhập không-điều-khiển vẽ lại. */
  revision: number;
  project?: DraftProjectLink;
  /** Kết quả lượt đọc mô tả gần nhất (hạng mục 3). Không có = chưa đọc. */
  parse?: DraftParse;
  /** Phương án + chỉnh sửa BOM đã chọn (V1c C5). Không có = chưa chọn phương án. */
  bom?: BomSelection;
};

// 'cancelled' = người dùng bấm "Bỏ chờ, tôi tự điền" trong lúc bộ đọc đang chạy.
export const DRAFT_PARSE_STATUSES = ['ok', 'empty', 'failed', 'unavailable', 'tooLong', 'denied', 'cancelled'] as const;
export type DraftParseStatus = (typeof DRAFT_PARSE_STATUSES)[number];

export type DraftParse = {
  status: DraftParseStatus;
  /** Số ô đã điền vào bảng. */
  applied: number;
  /** Số ô bộ đọc trả về nhưng bị loại khi kiểm (không khớp nguyên văn mô tả, mơ hồ...). */
  dropped: number;
  /** Loại ứng dụng do bộ đọc chọn — hiện nhãn "Suy ra" tới khi người dùng đổi. */
  inferredApplicationType: ApplicationType | null;
  /** Ô đọc được khi chưa có loại ứng dụng — áp khi người dùng chọn loại. */
  pending: ParsedField[];
  /**
   * Mã lỗi ngắn của lượt đọc hỏng ("ApiError 503 · gemini-3.5-flash-lite"), hiện
   * lên màn hình vì gói Vercel Hobby chỉ giữ log một giờ. Không chứa mô tả hay key.
   */
  detail?: string;
};

function isDraftParse(value: unknown): value is DraftParse {
  if (!value || typeof value !== 'object') return false;
  const parse = value as Record<string, unknown>;
  return (
    (DRAFT_PARSE_STATUSES as readonly unknown[]).includes(parse.status) &&
    typeof parse.applied === 'number' &&
    typeof parse.dropped === 'number' &&
    (parse.inferredApplicationType === null || isApplicationType(parse.inferredApplicationType)) &&
    (parse.detail === undefined || typeof parse.detail === 'string') &&
    Array.isArray(parse.pending) &&
    parse.pending.every(
      (item) =>
        Boolean(item) &&
        typeof (item as ParsedField).path === 'string' &&
        typeof (item as ParsedField).sourceSpan === 'string' &&
        'value' in (item as object)
    )
  );
}

function isProjectLink(value: unknown): value is DraftProjectLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  return (
    ['id', 'name', 'revisionId', 'revLabel', 'savedFingerprint'].every((key) => typeof link[key] === 'string') &&
    typeof link.locked === 'boolean'
  );
}

export function isApplicationType(value: unknown): value is ApplicationType {
  return typeof value === 'string' && (APPLICATION_TYPES as readonly string[]).includes(value);
}

/**
 * Thẻ ứng dụng ở trang chủ → bảng tóm tắt yêu cầu với loại điền sẵn. Cả 8 thẻ
 * vào CÙNG một luồng (spec §10.1), không trỏ riêng vào từng bộ chọn.
 */
export function requirementHrefFor(type: ApplicationType): string {
  return `${REQUIREMENT_ROUTE}?app=${encodeURIComponent(type)}`;
}

export function startDraftFromText(text: string, now: number = Date.now()): RequirementDraft {
  return { version: DRAFT_VERSION, startedFrom: `text:${now}`, rawText: text.trim() || null, requirement: null, revision: 0 };
}

export function startDraftFromApp(type: ApplicationType): RequirementDraft {
  return { version: DRAFT_VERSION, startedFrom: `app:${type}`, rawText: null, requirement: emptyRequirement(type), revision: 0 };
}

/**
 * v1 → v2, sửa tại chỗ.
 * - v1 chưa có câu hỏi nào, nên mọi ô trống mang 'unknown' thực ra là CHƯA HỎI.
 * - Vật liệu v1 là ô chữ tự do; không khớp danh sách thì coi như chưa hỏi, vì
 *   giữ chữ tự do trong ô chọn sẽ không suy được α mà cũng không hiện được.
 */
function migrateV1(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(migrateV1);

  const record = node as Record<string, unknown>;
  if ('value' in record) {
    if (record.value === null && record.confidence === 'unknown') delete record.confidence;
    return;
  }
  for (const child of Object.values(record)) migrateV1(child);
}

function migrateMaterialV1(requirement: Requirement): void {
  const material = readField(requirement, 'object.material');
  if (!material || material.value === null) return;
  if (!(MATERIALS as readonly unknown[]).includes(material.value)) {
    material.value = null;
    delete material.confidence;
    delete material.sourceSpan;
  }
}

/**
 * Ô thêm SAU khi bản nháp / revision được lưu (ví dụ system.cameraTiltDeg ở V1c)
 * → điền ô trống "chưa hỏi" từ requirement rỗng cùng loại. CHỈ các ô liệt kê ở
 * FIELDS_ADDED_AFTER_V2: thiếu ô khác vẫn là bản nháp hỏng và bị loại.
 *
 * Không có bước này thì mọi revision đã lưu trước khi thêm ô sẽ bị coi là schema
 * cũ và không mở lại được — thêm một ô tuỳ chọn không đáng làm mất dự án. Chỉ
 * điền khi nhánh cha còn nguyên; nhánh cha hỏng thì vẫn để phép kiểm bên dưới
 * loại bản nháp.
 */
export const FIELDS_ADDED_AFTER_V2: readonly string[] = ['system.cameraTiltDeg'];

function backfillAddedFields(requirement: Requirement): void {
  if (!isApplicationType(requirement.applicationType)) return;
  const empty = emptyRequirement(requirement.applicationType);
  for (const def of fieldsFor(requirement.applicationType)) {
    if (!FIELDS_ADDED_AFTER_V2.includes(def.path) || readField(requirement, def.path) !== null) continue;
    const parts = def.path.split('.');
    const key = parts.pop()!;
    let parent: unknown = requirement;
    let template: unknown = empty;
    for (const part of parts) {
      parent = (parent as Record<string, unknown> | null)?.[part];
      template = (template as Record<string, unknown> | null)?.[part];
    }
    if (parent && typeof parent === 'object' && !Array.isArray(parent) && !(key in parent) && template && typeof template === 'object') {
      (parent as Record<string, unknown>)[key] = structuredClone((template as Record<string, unknown>)[key]);
    }
  }
}

/**
 * Đọc bản nháp đã lưu. Dữ liệu trong sessionStorage có thể cũ (khác phiên bản
 * schema) hoặc bị sửa tay — không hợp lệ thì bỏ, trả `null`, không ném lỗi.
 */
export function parseDraft(raw: string | null): RequirementDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const draft = data as Omit<Partial<RequirementDraft>, 'version'> & { version?: unknown };
  if (draft.version !== 1 && draft.version !== DRAFT_VERSION) return null;
  if (typeof draft.startedFrom !== 'string') return null;
  if (draft.rawText !== null && typeof draft.rawText !== 'string') return null;
  if (typeof draft.revision !== 'number') return null;

  const requirement = draft.requirement;
  if (requirement !== null) {
    if (!requirement || typeof requirement !== 'object') return null;
    if (!isApplicationType(requirement.applicationType)) return null;
    if (!Array.isArray(requirement.detection) || !Array.isArray(requirement.measurement)) return null;
    backfillAddedFields(requirement);
    // Mọi ô V1a của loại này phải đọc được — chặn bản nháp của schema cũ.
    if (fieldsFor(requirement.applicationType).some((def) => readField(requirement, def.path) === null)) {
      return null;
    }
    if (draft.version === 1) {
      migrateV1(requirement);
      migrateMaterialV1(requirement);
    }
  }

  const result = { ...(draft as RequirementDraft), version: DRAFT_VERSION } as RequirementDraft;
  // Liên kết dự án hỏng thì bỏ liên kết, giữ nội dung — mất nội dung tệ hơn mất con trỏ.
  if ('project' in result && !isProjectLink(result.project)) delete result.project;
  // Trạng thái đọc hỏng thì bỏ: tệ nhất là trang đọc lại mô tả một lần nữa.
  if ('parse' in result && !isDraftParse(result.parse)) delete result.parse;
  // Lựa chọn BOM hỏng thì bỏ: tệ nhất là người dùng chọn lại phương án.
  if ('bom' in result && !isBomSelection(result.bom)) delete result.bom;
  return result;
}
