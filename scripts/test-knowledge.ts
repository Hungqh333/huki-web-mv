/**
 * Luật ↔ bài cẩm nang — V1c mục C8. Chốt Q1–Q10 ngày 2026-09-18.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';

import { MEDIA_TYPES, knowledgeStatus, parseKnowledgeFields, type KnowledgeFieldError } from '../src/lib/knowledge';
import { sanitizeArticleHtml } from '../src/lib/html';
import { FEASIBILITY_DIMENSIONS, RULES, knowledgeSlugFor } from '../src/lib/vision/rules';
import { RULE_NOTES } from './rule-notes/notes';
import { noteHtml, renderRuleNotesSql } from './rule-notes/render';

const KNOWN = { ruleIds: RULES.map((r) => r.id), dimensions: FEASIBILITY_DIMENSIONS };
const messages = (locale: string) => JSON.parse(readFileSync(join(process.cwd(), 'src', 'messages', `${locale}.json`), 'utf8'));

test('trạng thái liên kết: đã đăng → Tài liệu; nháp chỉ Admin thấy; chưa có → [Viết bài] chỉ cho Admin', () => {
  const index = { published: ['rule-mec-001'], drafts: { 'rule-opt-008': 'id-8' }, isAdmin: false };
  assert.deepEqual(knowledgeStatus(index, 'MEC-001'), { kind: 'published', href: '/cam-nang/rule-mec-001' });
  assert.deepEqual(knowledgeStatus(index, 'OPT-008'), { kind: 'missing', writeHref: null }, 'khong phai Admin thi khong biet co nhap');
  const admin = { ...index, isAdmin: true };
  assert.deepEqual(knowledgeStatus(admin, 'OPT-008'), { kind: 'draft', href: '/admin/bai-viet/id-8' });
  assert.deepEqual(knowledgeStatus(admin, 'THR-003'), { kind: 'missing', writeHref: '/admin/bai-viet/moi?rule=THR-003' });
});

test('form admin: ghi chú luật phải có mã luật có thật, slug rule-<mã>, và đã duyệt mới được đăng', () => {
  const base = { slug: 'rule-mec-001', mediaType: 'ruleNote', dimension: 'Mechanical', relatedRules: 'mec-001, MEC-003', sources: 'Nguồn A\n\n Nguồn B ', reviewed: true, publish: true };
  const ok = parseKnowledgeFields(base, KNOWN);
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.fields, { media_type: 'ruleNote', dimension: 'Mechanical', related_rules: ['MEC-001', 'MEC-003'], source_references: ['Nguồn A', 'Nguồn B'] });

  const errorsOf = (patch: Partial<typeof base>) => parseKnowledgeFields({ ...base, ...patch }, KNOWN).errors;
  assert.deepEqual(errorsOf({ reviewed: false }), { reviewed: 'ruleNoteNeedsReview' });
  assert.deepEqual(errorsOf({ reviewed: false, publish: false }), {}, 'nhap chua duyet thi luu duoc');
  assert.deepEqual(errorsOf({ slug: 'giai-thich-mec' }), { slug: 'ruleNoteSlug' });
  assert.deepEqual(errorsOf({ relatedRules: 'MEC-999' }), { related_rules: 'unknownRule', slug: 'ruleNoteSlug' });
  assert.deepEqual(errorsOf({ relatedRules: '' }), { related_rules: 'ruleNoteNeedsRule' });
  assert.deepEqual(errorsOf({ mediaType: 'webinar' }), { media_type: 'invalidMediaType' });
  assert.deepEqual(errorsOf({ dimension: 'Imaging' }), { dimension: 'invalidDimension' });
  // Bài thường: không bắt slug / duyệt.
  assert.deepEqual(parseKnowledgeFields({ ...base, mediaType: 'principle', slug: 'nguyen-ly-dome', reviewed: false }, KNOWN).errors, {});
  assert.equal(parseKnowledgeFields({ ...base, mediaType: '', dimension: '', relatedRules: '' }, KNOWN).fields.media_type, null);
});

test('câu chữ: liên kết tài liệu, form admin, trang bài — đủ vi/en', () => {
  for (const locale of ['vi', 'en'] as const) {
    const missing: string[] = [];
    const t = createTranslator({ locale, messages: messages(locale), onError: (e) => missing.push(e.message) });
    const say = (key: string, values?: Record<string, string>) => t(key as never, values as never);
    for (const key of ['doc', 'draft', 'editDraft', 'missing', 'write']) say(`knowledge.${key}`);
    say('knowledge.docTitle', { rule: 'MEC-001' });
    for (const key of ['relatedRules', 'relatedRulesNote', 'reviewed', 'sources']) say(`knowledge.article.${key}`);
    say('knowledge.article.reviewedBy', { name: 'x', date: 'y' });
    for (const type of MEDIA_TYPES) say(`admin.articles.knowledge.mediaTypes.${type}`);
    const codes: KnowledgeFieldError[] = ['invalidMediaType', 'invalidDimension', 'unknownRule', 'ruleNoteNeedsRule', 'ruleNoteSlug', 'ruleNoteNeedsReview'];
    for (const code of codes) say(`admin.errors.knowledge.${code}`);
    say('selector.vision.notes.dofAnyAperture', { dof: '0.3', fMax: '5.1' });
    assert.deepEqual(missing, [], `${locale}: ${missing.join('\n')}`);
  }
});

test('15 bài nháp: đúng danh sách chốt Q5, mỗi mã luật có thật, slug theo quy ước', () => {
  assert.deepEqual(
    RULE_NOTES.map((n) => n.ruleId),
    ['RES-001', 'RES-002', 'RES-004', 'RES-005', 'MEC-001', 'OPT-001', 'OPT-002', 'OPT-004', 'OPT-005', 'OPT-008', 'LGT-001', 'LGT-002', 'THR-002', 'THR-003', 'AI-001']
  );
  for (const note of RULE_NOTES) {
    assert.ok(KNOWN.ruleIds.includes(note.ruleId), note.ruleId);
    assert.ok(note.title.vi.startsWith(`${note.ruleId} — `) && note.title.en.startsWith(`${note.ruleId} — `), note.ruleId);
    assert.ok(note.sources.length > 0, `${note.ruleId} thieu nguon`);
  }
});

test('15 bài nháp: đủ khuôn 5 mục §12.6 cả hai thứ tiếng, HTML đi qua bộ lọc bài viết nguyên vẹn', () => {
  for (const note of RULE_NOTES) {
    for (const locale of ['vi', 'en'] as const) {
      const html = noteHtml(note, locale);
      assert.equal((html.match(/<h2>/g) ?? []).length, 5, `${note.ruleId} ${locale}`);
      for (const [section, content] of Object.entries(note[locale])) assert.ok(content.replace(/<[^>]+>/g, '').trim().length > 40, `${note.ruleId} ${locale} ${section} qua ngan`);
      // Bộ lọc là thứ admin chạy khi lưu — nếu nó cắt mất thẻ thì bài sửa lần đầu sẽ đổi khác bản nháp.
      assert.equal(sanitizeArticleHtml(html), html, `${note.ruleId} ${locale}: bo loc HTML doi noi dung`);
    }
    // Ví dụ dự án: dự án thật (GT-xxx) hoặc ghi rõ là minh hoạ — không bịa dự án.
    assert.match(note.vi.example, /GT-00\d|Minh hoạ/, note.ruleId);
    assert.match(note.en.example, /GT-00\d|Illustration/, note.ruleId);
  }
});

test('seed_rule_notes.sql khớp nguồn (đã chạy npm run build:rule-notes), nạp nháp mức Member', () => {
  const committed = readFileSync('supabase/seed_rule_notes.sql', 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, renderRuleNotesSql(), 'chay lai: npm run build:rule-notes');
  assert.match(committed, /on conflict \(slug\) do nothing;/);
  for (const note of RULE_NOTES) assert.ok(committed.includes(`'${knowledgeSlugFor(note.ruleId)}'`), note.ruleId);
  assert.equal((committed.match(/'member', 'ruleNote'/g) ?? []).length, RULE_NOTES.length);
});
