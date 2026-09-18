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
  /** Ô tri thức — V1c C8. */
  media_type?: string | null;
  related_rules?: string[] | null;
  source_references?: string[] | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
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
 * Từ Prompt 4 trở đi việc làm sạch dùng allowlist thật (thư viện sanitize-html,
 * xem src/lib/html.ts) và được áp ngay lúc LƯU qua admin UI. Hàm này giữ lại để
 * lọc thêm lần nữa lúc hiển thị, phòng dữ liệu ghi vào trước khi có bước đó.
 */
export { sanitizeArticleHtml as sanitizeHtml } from './html';
