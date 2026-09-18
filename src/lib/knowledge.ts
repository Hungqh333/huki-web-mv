import { knowledgeSlugFor } from '@/lib/vision/rules';

/**
 * Luật engine ↔ bài cẩm nang — V1c mục C8 (spec V1.1 §12.5, §12.7).
 *
 * Chiều luật → bài đi bằng slug cố định (knowledgeSlugFor: 'rule-mec-001'),
 * nên kết quả engine không cần biết database. Trang chỉ nạp MỘT danh sách slug
 * đã có bài để biết hiện "📄 Tài liệu" hay "Chưa có tài liệu".
 */

export type KnowledgeIndex = {
  /** Slug đã đăng (kể cả bài người xem chưa đủ quyền — trang bài hiện teaser + lời mời). */
  published: string[];
  /** Chỉ Admin: slug bản nháp → id để mở trình soạn. */
  drafts: Record<string, string>;
  isAdmin: boolean;
};

export type KnowledgeStatus =
  | { kind: 'published'; href: string }
  | { kind: 'draft'; href: string }
  | { kind: 'missing'; writeHref: string | null };

/** Tiền tố slug của bài ghi chú luật — dùng để lọc khi nạp. */
export const RULE_NOTE_SLUG_PREFIX = 'rule-';

/** Ô trình soạn điền sẵn khi Admin bấm [Viết bài] từ một luật chưa có tài liệu. */
export const newRuleNoteHref = (ruleId: string) => `/admin/bai-viet/moi?rule=${encodeURIComponent(ruleId)}`;

export function knowledgeStatus(index: KnowledgeIndex, ruleId: string): KnowledgeStatus {
  const slug = knowledgeSlugFor(ruleId);
  if (index.published.includes(slug)) return { kind: 'published', href: `/cam-nang/${slug}` };
  const draftId = index.drafts[slug];
  if (index.isAdmin && draftId) return { kind: 'draft', href: `/admin/bai-viet/${draftId}` };
  return { kind: 'missing', writeHref: index.isAdmin ? newRuleNoteHref(ruleId) : null };
}

/** Mã luật hợp lệ trong ô "luật liên quan" (form admin, file nháp). */
export const RULE_ID_PATTERN = /^[A-Z]{2,3}-\d{3}$/;

/* ── Ô tri thức trong form bài viết (admin) ─────────────────────────────── */

export const MEDIA_TYPES = ['principle', 'formula', 'ruleNote', 'pitfall', 'projectCase', 'glossary', 'checklist'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export type KnowledgeFieldsInput = {
  slug: string;
  mediaType: string;
  dimension: string;
  /** "MEC-001, MEC-003" — phẩy, chấm phẩy hoặc xuống dòng. */
  relatedRules: string;
  /** Mỗi dòng một nguồn. */
  sources: string;
  reviewed: boolean;
  publish: boolean;
};

export type KnowledgeFields = {
  media_type: MediaType | null;
  dimension: string | null;
  related_rules: string[];
  source_references: string[];
};

export type KnowledgeFieldError = 'invalidMediaType' | 'invalidDimension' | 'unknownRule' | 'ruleNoteNeedsRule' | 'ruleNoteSlug' | 'ruleNoteNeedsReview';

/**
 * Kiểm các ô tri thức trước khi lưu. Bài ruleNote phải: có mã luật có thật,
 * slug đúng quy ước rule-<mã> (chiều luật → bài đi bằng slug), và đã tick
 * "Đã duyệt" nếu muốn đăng — database cũng chặn điều cuối (migration C8).
 */
export function parseKnowledgeFields(
  input: KnowledgeFieldsInput,
  known: { ruleIds: readonly string[]; dimensions: readonly string[] }
): { fields: KnowledgeFields; errors: Partial<Record<'media_type' | 'dimension' | 'related_rules' | 'slug' | 'reviewed', KnowledgeFieldError>> } {
  const errors: Partial<Record<'media_type' | 'dimension' | 'related_rules' | 'slug' | 'reviewed', KnowledgeFieldError>> = {};
  const mediaType = input.mediaType === '' ? null : (MEDIA_TYPES as readonly string[]).includes(input.mediaType) ? (input.mediaType as MediaType) : null;
  if (input.mediaType !== '' && mediaType === null) errors.media_type = 'invalidMediaType';

  const dimension = input.dimension === '' ? null : known.dimensions.includes(input.dimension) ? input.dimension : null;
  if (input.dimension !== '' && dimension === null) errors.dimension = 'invalidDimension';

  const relatedRules = [...new Set(input.relatedRules.split(/[\s,;]+/).map((id) => id.trim().toUpperCase()).filter(Boolean))];
  if (relatedRules.some((id) => !RULE_ID_PATTERN.test(id) || !known.ruleIds.includes(id))) errors.related_rules = 'unknownRule';

  if (mediaType === 'ruleNote') {
    if (relatedRules.length === 0) errors.related_rules ??= 'ruleNoteNeedsRule';
    else if (!relatedRules.some((id) => knowledgeSlugFor(id) === input.slug)) errors.slug = 'ruleNoteSlug';
    if (input.publish && !input.reviewed) errors.reviewed = 'ruleNoteNeedsReview';
  }

  const sources = input.sources.split('\n').map((line) => line.trim()).filter(Boolean);
  return { fields: { media_type: mediaType, dimension, related_rules: relatedRules, source_references: sources }, errors };
}
