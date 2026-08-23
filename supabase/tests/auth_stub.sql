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
