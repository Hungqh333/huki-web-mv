'use server';

import { extractionToFields } from '@/lib/ai/extraction';
import { parseDescription, parserConfigured } from '@/lib/ai/parser';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { PARSE_TEXT_MAX, type ParseResult } from '@/lib/requirement/parseResult';

/**
 * Đọc mô tả bài toán bằng LLM → các ô điền trước cho bảng yêu cầu (V1a hạng mục 3).
 *
 * Member trở lên, giống trang Yêu cầu: mỗi lượt đọc ăn vào hạn mức API. Kết quả chỉ là
 * gợi ý điền trước — bản nháp vẫn nằm ở trình duyệt, người dùng xem lại từng ô.
 */
export async function parseRequirementAction(rawText: string): Promise<ParseResult> {
  const session = await getSessionContext();
  if (!session || !canUseSelector(session.profile?.role)) return { status: 'denied' };

  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) return { status: 'empty' };
  if (text.length > PARSE_TEXT_MAX) return { status: 'tooLong' };
  if (!parserConfigured()) return { status: 'unavailable' };

  const outcome = await parseDescription(text);

  // Log vận hành để theo dõi chi phí. KHÔNG ghi mô tả gốc — có thể chứa thông tin dự án của khách.
  console.info(
    '[parser]',
    JSON.stringify({
      ok: outcome.ok,
      reason: outcome.ok ? undefined : outcome.reason,
      detail: outcome.ok ? undefined : outcome.detail,
      model: outcome.model,
      usage: outcome.usage,
      chars: text.length,
    })
  );

  // Mã lỗi đi cùng ra giao diện: gói Vercel Hobby chỉ giữ log một giờ, người dùng
  // đọc mã này báo lại là biết ngay lỗi key, quá tải hay hết hạn mức.
  if (!outcome.ok) return { status: 'failed', detail: `${outcome.detail ?? outcome.reason} · ${outcome.model}` };

  const { applicationType, fields, dropped } = extractionToFields(outcome.extraction, text);
  if (!applicationType && fields.length === 0) return { status: 'empty' };
  return { status: 'ok', applicationType, fields, dropped: dropped.length };
}
