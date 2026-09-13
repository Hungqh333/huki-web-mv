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
import { emptyRequirement, fieldsFor, readField } from './fields';
import type { Requirement } from './types';

export const REQUIREMENT_ROUTE = '/thiet-ke-he-thong/yeu-cau';

export type RequirementDraft = {
  version: 1;
  /**
   * Bản nháp bắt đầu từ đâu: 'text:<thời điểm>' (ô nhập), 'app:<loại>' (thẻ),
   * 'manual'. Trang dùng để biết `?app=` trên URL đã được áp vào bản nháp chưa.
   */
  startedFrom: string;
  rawText: string | null;
  /** `null` khi chưa chọn loại ứng dụng (vào từ ô nhập, parser chưa có). */
  requirement: Requirement | null;
  /** Tăng mỗi lần làm lại / đổi loại, để ô nhập không-điều-khiển vẽ lại. */
  revision: number;
};

export function isApplicationType(value: unknown): value is ApplicationType {
  return typeof value === 'string' && (APPLICATION_TYPES as readonly string[]).includes(value);
}

export function startDraftFromText(text: string, now: number = Date.now()): RequirementDraft {
  return { version: 1, startedFrom: `text:${now}`, rawText: text.trim() || null, requirement: null, revision: 0 };
}

export function startDraftFromApp(type: ApplicationType): RequirementDraft {
  return { version: 1, startedFrom: `app:${type}`, rawText: null, requirement: emptyRequirement(type), revision: 0 };
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

  const draft = data as Partial<RequirementDraft>;
  if (draft.version !== 1) return null;
  if (typeof draft.startedFrom !== 'string') return null;
  if (draft.rawText !== null && typeof draft.rawText !== 'string') return null;
  if (typeof draft.revision !== 'number') return null;

  const requirement = draft.requirement;
  if (requirement !== null) {
    if (!requirement || typeof requirement !== 'object') return null;
    if (!isApplicationType(requirement.applicationType)) return null;
    if (!Array.isArray(requirement.detection) || !Array.isArray(requirement.measurement)) return null;
    // Mọi ô V1a của loại này phải đọc được — chặn bản nháp của schema cũ.
    if (fieldsFor(requirement.applicationType).some((def) => readField(requirement, def.path) === null)) {
      return null;
    }
  }

  return draft as RequirementDraft;
}
