// Không đánh dấu 'server-only': file này chỉ có type và hàm thuần, không chạm
// cookie hay Supabase client. Nhờ vậy test unit chạy được ngoài môi trường Next.
import type { AccessTier } from '@/lib/auth';

export type ArticlePreview = {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  category_id: string | null;
  access_tier: AccessTier;
  cover_image: string | null;
  published_at: string;
  is_locked: boolean;
  teaser_vi: string;
  teaser_en: string;
};

export type ArticleFull = {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  content_vi: string | null;
  content_en: string | null;
  category_id: string | null;
  access_tier: AccessTier;
  cover_image: string | null;
  published_at: string;
};

export type Category = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
};

/**
 * Cắt teaser xuống 2–3 câu đầu (CLAUDE.md mục 5).
 * View article_previews đã cắt cứng ở 300 ký tự và bỏ thẻ HTML; ở đây chỉ làm
 * cho chỗ cắt rơi vào ranh giới câu thay vì giữa chừng một từ.
 */
export function toTeaser(raw: string, maxSentences = 3): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text === '') return '';

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) {
    // Không tìm được dấu kết câu (teaser bị cắt giữa câu) — cắt ở khoảng trắng.
    const cut = text.slice(0, 200);
    const lastSpace = cut.lastIndexOf(' ');
    return `${lastSpace > 80 ? cut.slice(0, lastSpace) : cut}…`;
  }

  // Trim từng câu: regex bắt cả khoảng trắng đứng trước, join thêm một dấu nữa
  // sẽ thành khoảng trắng đôi.
  const picked = sentences
    .slice(0, maxSentences)
    .map((sentence) => sentence.trim())
    .join(' ');
  return picked.length < text.length ? `${picked}…` : picked;
}

/**
 * Làm sạch HTML trước khi render.
 *
 * Nội dung bài viết chỉ admin ghi được (RLS chặn mọi vai trò khác), nhưng render
 * HTML thô vẫn là một đường XSS nếu tài khoản admin bị chiếm. Bộ lọc dưới đây
 * bỏ script/style/iframe, thuộc tính sự kiện on*, và các URL javascript:.
 *
 * TODO(Prompt 4): khi gắn trình soạn thảo Tiptap, chuyển sang danh sách thẻ cho
 * phép chặt chẽ hơn ở ngay bước lưu, thay vì chỉ lọc lúc hiển thị.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}
