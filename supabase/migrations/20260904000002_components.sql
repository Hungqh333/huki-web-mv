-- =============================================================================
-- Catalog linh kiện thật
--
-- Bảng luật (selector_rules) chỉ nói LOẠI thiết bị: "Area scan đơn sắc ≥ 5 MP".
-- Bảng này giữ THIẾT BỊ CỤ THỂ: hãng, mã hàng, thông số. Nhờ vậy bộ chọn mới
-- trả ra được "Basler a2A2590-22gm, 5 MP, 1/1.8\", GigE" thay vì một câu mô tả.
--
-- Thông số để trong `spec` jsonb chứ không tách thành cột: camera, ống kính và
-- đèn có bộ thông số hoàn toàn khác nhau, tách cột sẽ ra một bảng rất rộng và
-- rỗng. Ý nghĩa từng khoá spec định nghĩa ở src/lib/components/specs.ts, giống
-- cách catalog trường nhập liệu đang làm.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Kiểu dữ liệu
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.component_kind as enum
    ('camera', 'lens', 'light', 'controller', 'accessory');
exception when duplicate_object then null;
end $$;

-- Nguồn gốc thông số. Cột quan trọng nhất về QUẢN TRỊ RỦI RO: dữ liệu khởi tạo
-- do đội phát triển điền theo trí nhớ, CHƯA đối chiếu datasheet. Giao diện phải
-- nói rõ điều đó để không ai lấy thẳng đi báo giá.
do $$ begin
  create type public.component_source as enum ('unverified', 'datasheet', 'measured');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Bảng linh kiện
-- -----------------------------------------------------------------------------

create table if not exists public.components (
  id            uuid primary key default gen_random_uuid(),

  -- Khoá tự nhiên để seed và nhập Excel chạy lại được mà không nhân bản.
  code          text not null unique,

  kind          public.component_kind not null,
  brand         text not null,
  model         text not null,

  -- Thông số theo từng loại. Xem src/lib/components/specs.ts để biết khoá nào
  -- có nghĩa gì với loại nào.
  spec          jsonb not null default '{}'::jsonb,

  price_vnd     numeric(14,0),
  datasheet_url text,
  source        public.component_source not null default 'unverified',

  notes_vi      text,
  notes_en      text,

  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.components.spec is
  'Thông số theo loại linh kiện. Khoá được định nghĩa ở src/lib/components/specs.ts.';

comment on column public.components.source is
  'unverified = chưa đối chiếu datasheet. Đổi sang datasheet sau khi kiểm tra với tài liệu hãng.';

create index if not exists components_kind_idx on public.components (kind, sort_order);
create index if not exists components_spec_idx on public.components using gin (spec);

drop trigger if exists components_set_updated_at on public.components;
create trigger components_set_updated_at
  before update on public.components
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. ROW LEVEL SECURITY
--
-- Cùng mức nhạy cảm với bảng luật gợi ý: danh sách thiết bị kèm giá là thông
-- tin thương mại. Member trở lên đọc được, chỉ admin ghi.
-- =============================================================================

alter table public.components enable row level security;

drop policy if exists "components_select_member_plus" on public.components;
create policy "components_select_member_plus"
  on public.components for select to authenticated
  using (public.is_member_plus() and (is_active or public.is_admin()));

drop policy if exists "components_write_admin" on public.components;
create policy "components_write_admin"
  on public.components for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.components from anon;
grant select, insert, update, delete on public.components to authenticated;
