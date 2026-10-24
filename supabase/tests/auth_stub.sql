-- =============================================================================
-- Stub tối thiểu của những thứ Supabase dựng sẵn trên project thật.
--
-- CHỈ dùng cho việc chạy thử migration ở máy local bằng PGlite
-- (xem scripts/verify-db.mjs). KHÔNG bao giờ chạy file này trên Supabase thật —
-- ở đó schema auth đã tồn tại.
-- =============================================================================

create schema if not exists auth;

-- Chỉ giữ những cột mà migration và test thực sự chạm tới.
create table auth.users (
  id                 uuid primary key,
  instance_id        uuid,
  aud                varchar,
  role               varchar,
  email              varchar,
  encrypted_password varchar,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  is_sso_user        boolean not null default false,
  is_anonymous       boolean not null default false
);

-- Bản sao hành vi của auth.uid() trên Supabase: đọc 'sub' từ JWT claims.
create or replace function auth.uid()
returns uuid language sql stable as $fn$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$fn$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

grant usage on schema auth to anon, authenticated, service_role;

-- Supabase Storage (2026-10-22, ảnh mẫu chiếu sáng): chỉ hai bảng và các cột migration chạm tới.
-- Trên Supabase thật storage.objects đã bật RLS sẵn.
create schema if not exists storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;
