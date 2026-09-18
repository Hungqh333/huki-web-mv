/**
 * Dựng seed SQL + file xem trước từ scripts/rule-notes/notes.ts (V1c C8).
 * Tách khỏi CLI để test so được file SQL đã commit với nội dung nguồn.
 */
import { knowledgeSlugFor, ruleDefinition } from '../../src/lib/vision/rules';
import { RULE_NOTES, SECTION_TITLES, type NoteLocale, type RuleNote } from './notes';

const SECTIONS: (keyof NoteLocale)[] = ['principle', 'when', 'formula', 'mistakes', 'example'];

export function noteHtml(note: RuleNote, locale: 'vi' | 'en'): string {
  return SECTIONS.map((key) => `<h2>${SECTION_TITLES[locale][key]}</h2>${note[locale][key]}`).join('');
}

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
const sqlArray = (values: string[]) => (values.length === 0 ? `'{}'::text[]` : `array[${values.map(sqlText).join(', ')}]`);

export function renderRuleNotesSql(): string {
  const rows = RULE_NOTES.map((note) => {
    const rule = ruleDefinition(note.ruleId);
    return [
      '(',
      `  ${sqlText(knowledgeSlugFor(note.ruleId))},`,
      `  ${sqlText(note.title.vi)},`,
      `  ${sqlText(note.title.en)},`,
      `  ${sqlText(noteHtml(note, 'vi'))},`,
      `  ${sqlText(noteHtml(note, 'en'))},`,
      `  (select id from public.categories where slug = 'rule-notes'),`,
      `  'member', 'ruleNote', ${sqlText(rule.dimension)},`,
      `  ${sqlArray([note.ruleId])},`,
      `  ${sqlArray(note.sources)},`,
      '  null',
      ')',
    ].join('\n');
  });
  return `-- =============================================================================
-- ${RULE_NOTES.length} bài "Ghi chú luật" — BẢN NHÁP chờ duyệt (V1c mục C8).
--
-- FILE SINH TỰ ĐỘNG từ scripts/rule-notes/notes.ts — đừng sửa tay ở đây.
-- Sửa nguồn rồi chạy: npm run build:rule-notes
--
-- Nạp với published_at = null: chỉ Admin thấy. Duyệt từng bài trong
-- /admin/bai-viet, tick "Đã duyệt" rồi đăng (database chặn đăng khi chưa duyệt).
-- on conflict do nothing: dán lại không đè bài đã sửa trong admin.
-- Cần migration 20260919000001_article_knowledge.sql chạy trước.
-- =============================================================================

insert into public.articles
  (slug, title_vi, title_en, content_vi, content_en, category_id,
   access_tier, media_type, dimension, related_rules, source_references, published_at)
values
${rows.join(',\n')}
on conflict (slug) do nothing;
`;
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Một trang HTML đọc được cả 15 bài, song ngữ cạnh nhau — để Hưng duyệt một lượt. */
export function renderPreviewHtml(): string {
  const toc = RULE_NOTES.map((note) => `<li><a href="#${note.ruleId}">${escapeHtml(note.title.vi)}</a></li>`).join('');
  const body = RULE_NOTES.map((note) => {
    const rule = ruleDefinition(note.ruleId);
    return `<section id="${note.ruleId}">
<p class="meta">${escapeHtml(knowledgeSlugFor(note.ruleId))} · ${rule.dimension} · Member · nháp</p>
<div class="cols">
<article><h1>${escapeHtml(note.title.vi)}</h1>${noteHtml(note, 'vi')}</article>
<article lang="en"><h1>${escapeHtml(note.title.en)}</h1>${noteHtml(note, 'en')}</article>
</div>
<p class="sources"><strong>Nguồn:</strong> ${note.sources.map(escapeHtml).join(' · ')}</p>
</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghi chú luật — bản nháp</title>
<style>
:root{--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--code:#f1f5f9;--accent:#0369a1}
@media (prefers-color-scheme:dark){:root{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--code:#1e293b;--accent:#38bdf8}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,sans-serif;padding:24px 16px}
main{max-width:1200px;margin:0 auto}
h1{font-size:20px;margin:0 0 8px}h2{font-size:15px;margin:16px 0 4px;color:var(--accent)}
section{border-top:2px solid var(--line);padding:24px 0}
.cols{display:grid;gap:32px;grid-template-columns:1fr}@media(min-width:900px){.cols{grid-template-columns:1fr 1fr}}
.meta,.sources{color:var(--muted);font-size:13px}code{background:var(--code);padding:1px 4px;border-radius:4px;font-size:13px}
ul{padding-left:20px}a{color:var(--accent)}
</style></head><body><main>
<h1>${RULE_NOTES.length} bài Ghi chú luật — bản nháp chờ duyệt</h1>
<p class="meta">Dựng từ scripts/rule-notes/notes.ts. Nạp vào database dạng nháp (chỉ Admin thấy), mức Member, danh mục "Ghi chú luật". Mỗi bài theo khuôn 5 mục của spec §12.6.</p>
<ol>${toc}</ol>
${body}
</main></body></html>
`;
}
