/**
 * Đọc/ghi bản nháp yêu cầu trong sessionStorage (chỉ chạy ở trình duyệt).
 *
 * Viết theo dạng store ngoài cho useSyncExternalStore: component không phải
 * đọc storage trong effect rồi setState. Storage bị chặn (chế độ riêng tư,
 * trình duyệt cấm lưu) thì giữ tạm trong bộ nhớ — trang vẫn dùng được trong
 * phiên hiện tại.
 */
import type { RequirementDraft } from './draft';

export const DRAFT_STORAGE_KEY = 'mvh.requirementDraft';
const CHANGE_EVENT = 'requirementdraftchange';

let memoryDraft: string | null = null;

export function readDraftRaw(): string | null {
  try {
    return window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return memoryDraft;
  }
}

export function writeDraft(draft: RequirementDraft): void {
  const raw = JSON.stringify(draft);
  memoryDraft = raw;
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, raw);
  } catch {
    // Không lưu được thì vẫn còn bản trong bộ nhớ.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeDraft(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
