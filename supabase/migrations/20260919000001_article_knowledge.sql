-- =============================================================================
-- Bài cẩm nang gắn với luật engine — V1c mục C8 (spec V1.1 §12.3–12.7).
--
-- Dùng lại bảng articles (HTML, access_tier, RLS sẵn có), thêm:
--   media_type         loại bài §12.3 — 'ruleNote' là bài 1:1 với một mã luật
--   dimension          nhóm khả thi §7.2 — cùng trục với luật và đánh giá khả thi
--   related_rules      mã luật liên quan ('MEC-001') — chiều bài → luật
--   reviewed_by / at   ai duyệt, ngày nào (§12.4: làm tốt hơn disclaimer chung)
--   source_references  nguồn công thức
--
-- Chiều luật → bài đi bằng slug cố định: 'rule-' || lower(mã luật)
-- (knowledgeSlugFor trong src/lib/vision/rules.ts).
--
-- Chạy lại được nhiều lần (dán trùng vào SQL Editor không hỏng).
-- =============================================================================

alter table public.articles
  add column if not exists media_type        text,
  add column if not exists dimension         text,
  add column if not exists related_rules     text[] not null default '{}',
  add column if not exists reviewed_by       text,
  add column if not exists reviewed_at       date,
  add column if not exists source_references text[] not null default '{}';

comment on column public.articles.media_type is
  'Loại bài (spec §12.3). NULL = bài cẩm nang cũ, chưa phân loại.';
comment on column public.articles.related_rules is
  'Mã luật engine liên quan, vd {MEC-001}. Bài ruleNote có đúng mã luật của nó ở đây.';
comment on column public.articles.reviewed_by is
  'Tên người duyệt. Bài ruleNote phải có người + ngày duyệt mới được đăng.';

alter table public.articles drop constraint if exists articles_media_type_check;
alter table public.articles add constraint articles_media_type_check
  check (media_type is null or media_type in
    ('principle', 'formula', 'ruleNote', 'pitfall', 'projectCase', 'glossary', 'checklist'));

alter table public.articles drop constraint if exists articles_dimension_check;
alter table public.articles add constraint articles_dimension_check
  check (dimension is null or dimension in
    ('Resolution', 'Optics', 'Lighting', 'Throughput', 'Mechanical', 'Algorithm', 'Integration'));

-- Kỹ sư dùng bài ruleNote để ra quyết định báo giá: chưa ai duyệt thì chỉ là nháp.
-- Chặn ở database, không chỉ ở form admin.
alter table public.articles drop constraint if exists articles_rule_note_reviewed_check;
alter table public.articles add constraint articles_rule_note_reviewed_check
  check (media_type is distinct from 'ruleNote'
         or published_at is null
         or (reviewed_by is not null and reviewed_at is not null));

create index if not exists articles_related_rules_idx on public.articles using gin (related_rules);

-- Nhóm "Ghi chú luật" trong trang cẩm nang.
insert into public.categories (slug, name_vi, name_en, sort_order)
values ('rule-notes', 'Ghi chú luật', 'Rule Notes', 25)
on conflict (slug) do update set
  name_vi    = excluded.name_vi,
  name_en    = excluded.name_en,
  sort_order = excluded.sort_order;
