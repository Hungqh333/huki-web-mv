import 'server-only';

import { RULE_NOTE_SLUG_PREFIX, type KnowledgeIndex } from '@/lib/knowledge';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Chỉ mục bài ghi chú luật cho một trang (V1c C8).
 *
 * Bài đã đăng đọc qua view article_previews (chỉ slug), nên người chưa đủ quyền
 * vẫn thấy "📄 Tài liệu" và vào trang bài gặp teaser + lời mời — không thấy toàn
 * văn. Bản nháp chỉ Admin đọc được (RLS bảng articles), dùng cho nút [Sửa nháp].
 */
export async function loadKnowledgeIndex(supabase: Supabase, isAdmin: boolean): Promise<KnowledgeIndex> {
  const pattern = `${RULE_NOTE_SLUG_PREFIX}%`;
  const [{ data: published }, drafts] = await Promise.all([
    supabase.from('article_previews').select('slug').like('slug', pattern),
    isAdmin
      ? supabase.from('articles').select('id, slug').like('slug', pattern).is('published_at', null)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ]);
  return {
    published: (published ?? []).map((row) => row.slug as string),
    drafts: Object.fromEntries((drafts.data ?? []).map((row) => [row.slug, row.id])),
    isAdmin,
  };
}
