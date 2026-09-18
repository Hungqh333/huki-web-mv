/**
 * Sinh supabase/seed_rule_notes.sql (và file xem trước nếu truyền đường dẫn)
 * từ scripts/rule-notes/notes.ts — V1c C8.
 *
 *   npm run build:rule-notes -- [đường-dẫn-file-xem-trước.html]
 */
import { writeFileSync } from 'node:fs';
import { renderPreviewHtml, renderRuleNotesSql } from './rule-notes/render';

writeFileSync('supabase/seed_rule_notes.sql', renderRuleNotesSql());
console.log('Đã ghi supabase/seed_rule_notes.sql');

const preview = process.argv[2];
if (preview) {
  writeFileSync(preview, renderPreviewHtml());
  console.log(`Đã ghi ${preview}`);
}
