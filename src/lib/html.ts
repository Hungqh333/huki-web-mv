import sanitizeHtmlLib from 'sanitize-html';

/**
 * Danh sách thẻ và thuộc tính được phép trong nội dung bài viết.
 *
 * Khớp với những gì trình soạn thảo Tiptap (StarterKit) có thể sinh ra. Bất cứ
 * thứ gì ngoài danh sách này đều bị loại bỏ — cách tiếp cận allowlist, an toàn
 * hơn hẳn việc liệt kê những thứ cần chặn.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  's',
  'u',
  'code',
  'pre',
  'blockquote',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'hr',
];

/**
 * Làm sạch HTML bài viết.
 *
 * Gọi ở HAI nơi: khi lưu qua admin UI (chốt chặn chính, dữ liệu bẩn không bao
 * giờ vào database) và khi hiển thị (phòng trường hợp dữ liệu cũ được ghi vào
 * trước khi có bước làm sạch này).
 *
 * Quyền ghi articles vốn đã bị RLS giới hạn cho admin, nên đây là lớp phòng thủ
 * bổ sung cho tình huống tài khoản admin bị chiếm — không phải lớp duy nhất.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      code: ['class'],
      pre: ['class'],
    },
    // Chỉ cho phép giao thức an toàn: chặn javascript:, data:, vbscript:
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    // Link ra ngoài luôn kèm rel chống tấn công reverse tabnabbing.
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer nofollow' },
      }),
    },
    disallowedTagsMode: 'discard',
  });
}

/** Bỏ hết thẻ, chỉ lấy chữ — dùng để đếm ký tự và dựng teaser. */
export function htmlToPlainText(html: string): string {
  return sanitizeHtmlLib(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
