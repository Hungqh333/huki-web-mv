-- =============================================================================
-- Thực nghiệm chiếu sáng của phòng Vision — trang Chọn đèn
--
-- Chốt 2026-10-24 (Hùng, Q1–Q12; bảng ghép trường theo báo cáo test MC1626-01 Lenmount):
--   Lần thực nghiệm (một báo cáo) → Hạng mục (bước ren, sứt mẻ, đường kính…) → Phương án đèn
--   (thường một; thêm B, C khi so sánh) → ảnh chụp / ảnh xử lý.
-- Nhãn bài toán, cần thấy gì, vật liệu, bề mặt, màu theo đúng khoá trang Chọn đèn
-- (src/lib/vision/lightOptions.ts) để trang tìm được thực nghiệm khớp bài toán.
--
-- Quyền: Member trở lên xem bản ĐÃ CÔNG BỐ; bản nháp chỉ Admin thấy. Chỉ Admin ghi / xoá.
-- File (ảnh, báo cáo PDF / PPTX ≤ 50 MB) ở kho riêng `light-experiments`, không công khai —
-- trang hiện bằng link ký tên. Đường dẫn file là mã ngẫu nhiên, chỉ lộ qua bảng (đã khoá theo RLS).
--
-- Kèm: thêm khoá "ren" (thread) vào ràng buộc của lighting_samples (Q9).
--
-- Dán lại nhiều lần không sao.
-- =============================================================================

-- ── Kho file (ảnh ≤ 4 MB qua máy chủ; báo cáo tải thẳng từ trình duyệt bằng link ký tên, ≤ 50 MB) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'light-experiments', 'light-experiments', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "light_experiments_read_member" on storage.objects;
create policy "light_experiments_read_member"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'light-experiments' and public.is_member_plus());

drop policy if exists "light_experiments_insert_admin" on storage.objects;
create policy "light_experiments_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'light-experiments' and public.is_admin());

drop policy if exists "light_experiments_delete_admin" on storage.objects;
create policy "light_experiments_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'light-experiments' and public.is_admin());

-- ── Lần thực nghiệm (một báo cáo) ──
create table if not exists public.light_experiments (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,     -- mã dự án / báo cáo, vd MC1626-01
  title              text not null,            -- vd "Máy kiểm tra Lenmount"
  product_name       text,
  product_width_mm   numeric,
  product_height_mm  numeric,
  model_count        integer,
  min_defect_mm      numeric,                  -- kích thước lỗi nhỏ nhất
  engineer           text,
  tested_on          date,
  material           text,
  finish             text,
  shape              text,
  feature_color      text,
  background_color   text,
  conclusion_vi      text,
  conclusion_en      text,
  product_image_path text,
  report_path        text,                     -- file trong kho light-experiments
  report_name        text,
  report_url         text,                     -- hoặc link ổ nội bộ
  status             text not null default 'draft',
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint light_experiments_status_check check (status in ('draft', 'published')),
  constraint light_experiments_material_check check (material is null or material in ('metal_machined', 'metal_cast', 'metal_sheet', 'metal_polished', 'aluminum_anodized', 'copper_gold', 'plastic_matte', 'plastic_glossy', 'plastic_clear', 'plastic_translucent', 'rubber', 'pcb', 'glass', 'ceramic', 'film_foil', 'paper_label', 'fabric', 'wood', 'painted', 'wafer')),
  constraint light_experiments_finish_check check (finish is null or finish in ('matte', 'semi_gloss', 'mirror_flat', 'mirror_curved', 'textured', 'transparent', 'translucent')),
  constraint light_experiments_shape_check check (shape is null or shape in ('flat', 'curved', 'stepped')),
  constraint light_experiments_feature_color_check check (feature_color is null or feature_color in ('white', 'gray', 'black', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'brown', 'gold')),
  constraint light_experiments_background_color_check check (background_color is null or background_color in ('white', 'gray', 'black', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'brown', 'gold')),
  constraint light_experiments_numbers_check check (
    (product_width_mm is null or (product_width_mm > 0 and product_width_mm <= 100000))
    and (product_height_mm is null or (product_height_mm > 0 and product_height_mm <= 100000))
    and (model_count is null or (model_count > 0 and model_count <= 10000))
    and (min_defect_mm is null or (min_defect_mm > 0 and min_defect_mm <= 10000))
  ),
  constraint light_experiments_report_url_check check (report_url is null or report_url ~* '^https?://'),
  constraint light_experiments_text_check check (
    length(code) between 1 and 60 and length(title) between 1 and 200
    and coalesce(length(product_name), 0) <= 120 and coalesce(length(engineer), 0) <= 120
    and coalesce(length(conclusion_vi), 0) <= 2000 and coalesce(length(conclusion_en), 0) <= 2000
    and coalesce(length(report_name), 0) <= 200 and coalesce(length(report_url), 0) <= 500
  )
);

-- ── Hạng mục kiểm (bước ren, sứt mẻ cạnh lỗ, đường kính…) ──
create table if not exists public.light_experiment_items (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.light_experiments (id) on delete cascade,
  sort_order    integer not null default 0,
  name_vi       text not null,
  name_en       text,
  requirement   text,
  task          text,
  feature       text,              -- khoá "cần thấy gì"
  material      text,              -- để trống = theo lần thực nghiệm
  finish        text,
  shape         text,
  created_at    timestamptz not null default now(),

  unique (id, experiment_id),
  constraint light_experiment_items_task_check check (task is null or task in ('inspect', 'presence', 'align', 'measure', 'code', 'color')),
  constraint light_experiment_items_feature_check check (feature is null or feature in ('scratch', 'crack_chip', 'dent_bump', 'burr', 'stain', 'particle', 'void', 'coating', 'print', 'wrinkle', 'solder', 'thread', 'raised', 'flat_color', 'hole', 'transparent_part', 'shiny_part', 'wire', 'outline', 'fiducial', 'corner', 'surface_edge', 'ink_label', 'dpm', 'curved_print', 'color_match', 'color_shading')),
  constraint light_experiment_items_material_check check (material is null or material in ('metal_machined', 'metal_cast', 'metal_sheet', 'metal_polished', 'aluminum_anodized', 'copper_gold', 'plastic_matte', 'plastic_glossy', 'plastic_clear', 'plastic_translucent', 'rubber', 'pcb', 'glass', 'ceramic', 'film_foil', 'paper_label', 'fabric', 'wood', 'painted', 'wafer')),
  constraint light_experiment_items_finish_check check (finish is null or finish in ('matte', 'semi_gloss', 'mirror_flat', 'mirror_curved', 'textured', 'transparent', 'translucent')),
  constraint light_experiment_items_shape_check check (shape is null or shape in ('flat', 'curved', 'stepped')),
  constraint light_experiment_items_text_check check (
    length(name_vi) between 1 and 200 and coalesce(length(name_en), 0) <= 200 and coalesce(length(requirement), 0) <= 1000
  )
);

-- ── Phương án đèn đã thử cho một hạng mục ──
create table if not exists public.light_experiment_trials (
  id                uuid primary key default gen_random_uuid(),
  experiment_id     uuid not null,
  item_id           uuid not null,
  sort_order        integer not null default 0,
  label             text,              -- vd "Cụm 2 — đèn vòng"
  is_chosen         boolean not null default true,
  light_type        text not null,
  light_color       text,
  light_model       text,
  angle_note        text,
  distance_mm       numeric,
  backdrop          text,              -- nền đặt dưới vật, vd "nền trắng"
  camera            text,
  lens              text,
  accessory         text,              -- tube, ống nối…
  capture_ms        numeric,
  process_ms        numeric,
  verdict           text,              -- null = chưa đánh giá
  measured_error_mm numeric,
  note              text,
  ok_samples        integer,
  ng_samples        integer,
  tp                integer,
  tn                integer,
  fp                integer,
  fn                integer,
  created_at        timestamptz not null default now(),

  unique (id, experiment_id),
  foreign key (item_id, experiment_id) references public.light_experiment_items (id, experiment_id) on delete cascade,
  constraint light_experiment_trials_light_check check (light_type in ('ring', 'dome', 'backlight', 'bar', 'coaxial', 'darkfield', 'photometric_stereo', 'multi_angle_ring', 'structured_stripe', 'line')),
  constraint light_experiment_trials_light_color_check check (light_color is null or light_color in ('white', 'red', 'green', 'blue', 'ir', 'uv')),
  constraint light_experiment_trials_verdict_check check (verdict is null or verdict in ('pass', 'conditional', 'fail')),
  constraint light_experiment_trials_numbers_check check (
    (distance_mm is null or (distance_mm > 0 and distance_mm <= 10000))
    and (capture_ms is null or (capture_ms > 0 and capture_ms <= 600000))
    and (process_ms is null or (process_ms > 0 and process_ms <= 600000))
    and (measured_error_mm is null or (measured_error_mm >= 0 and measured_error_mm <= 1000))
    and coalesce(ok_samples, 0) between 0 and 10000000 and coalesce(ng_samples, 0) between 0 and 10000000
    and coalesce(tp, 0) between 0 and 10000000 and coalesce(tn, 0) between 0 and 10000000
    and coalesce(fp, 0) between 0 and 10000000 and coalesce(fn, 0) between 0 and 10000000
  ),
  constraint light_experiment_trials_text_check check (
    coalesce(length(label), 0) <= 120 and coalesce(length(light_model), 0) <= 120 and coalesce(length(angle_note), 0) <= 120
    and coalesce(length(backdrop), 0) <= 120 and coalesce(length(camera), 0) <= 120 and coalesce(length(lens), 0) <= 120
    and coalesce(length(accessory), 0) <= 120 and coalesce(length(note), 0) <= 1000
  )
);

-- ── Ảnh của phương án: ảnh Vision chụp (raw) / ảnh Vision xử lý (processed) ──
create table if not exists public.light_experiment_images (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid not null,
  trial_id      uuid not null,
  kind          text not null,
  storage_path  text not null unique,
  caption_vi    text,
  caption_en    text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),

  foreign key (trial_id, experiment_id) references public.light_experiment_trials (id, experiment_id) on delete cascade,
  constraint light_experiment_images_kind_check check (kind in ('raw', 'processed')),
  constraint light_experiment_images_text_check check (coalesce(length(caption_vi), 0) <= 300 and coalesce(length(caption_en), 0) <= 300)
);

create index if not exists light_experiment_items_experiment_idx on public.light_experiment_items (experiment_id);
create index if not exists light_experiment_trials_item_idx on public.light_experiment_trials (item_id);
create index if not exists light_experiment_images_trial_idx on public.light_experiment_images (trial_id);

comment on table public.light_experiments is
  'Thực nghiệm chiếu sáng (một báo cáo test). Member+ xem bản published, Admin ghi. Trang /chon-den, /chon-den/thuc-nghiem, /admin/thuc-nghiem-chieu-sang.';
comment on table public.light_experiment_items is 'Hạng mục kiểm của một lần thực nghiệm chiếu sáng.';
comment on table public.light_experiment_trials is 'Phương án đèn đã thử cho một hạng mục (kết quả, TP/TN/FP/FN).';
comment on table public.light_experiment_images is 'Ảnh Vision chụp / xử lý của một phương án (bucket light-experiments).';

-- ── RLS: Member+ xem bản đã công bố, Admin xem và ghi tất cả ──
alter table public.light_experiments enable row level security;
alter table public.light_experiment_items enable row level security;
alter table public.light_experiment_trials enable row level security;
alter table public.light_experiment_images enable row level security;

drop policy if exists "light_experiments_select" on public.light_experiments;
create policy "light_experiments_select"
  on public.light_experiments for select
  to authenticated
  using (public.is_admin() or (public.is_member_plus() and status = 'published'));

drop policy if exists "light_experiments_write_admin" on public.light_experiments;
create policy "light_experiments_write_admin"
  on public.light_experiments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Bảng con: thấy được khi thấy được lần thực nghiệm cha (truy vấn con chịu RLS của bảng cha).
drop policy if exists "light_experiment_items_select" on public.light_experiment_items;
create policy "light_experiment_items_select"
  on public.light_experiment_items for select
  to authenticated
  using (public.is_member_plus() and exists (select 1 from public.light_experiments e where e.id = experiment_id));

drop policy if exists "light_experiment_items_write_admin" on public.light_experiment_items;
create policy "light_experiment_items_write_admin"
  on public.light_experiment_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "light_experiment_trials_select" on public.light_experiment_trials;
create policy "light_experiment_trials_select"
  on public.light_experiment_trials for select
  to authenticated
  using (public.is_member_plus() and exists (select 1 from public.light_experiments e where e.id = experiment_id));

drop policy if exists "light_experiment_trials_write_admin" on public.light_experiment_trials;
create policy "light_experiment_trials_write_admin"
  on public.light_experiment_trials for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "light_experiment_images_select" on public.light_experiment_images;
create policy "light_experiment_images_select"
  on public.light_experiment_images for select
  to authenticated
  using (public.is_member_plus() and exists (select 1 from public.light_experiments e where e.id = experiment_id));

drop policy if exists "light_experiment_images_write_admin" on public.light_experiment_images;
create policy "light_experiment_images_write_admin"
  on public.light_experiment_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.light_experiments, public.light_experiment_items, public.light_experiment_trials, public.light_experiment_images from anon;
grant select, insert, update, delete on public.light_experiments, public.light_experiment_items, public.light_experiment_trials, public.light_experiment_images to authenticated;

-- ── Q9: khoá "ren" (thread) cho ảnh mẫu chiếu sáng ──
alter table public.lighting_samples drop constraint if exists lighting_samples_defect_check;
alter table public.lighting_samples add constraint lighting_samples_defect_check check (defect_type is null or defect_type in ('scratch', 'crack_chip', 'dent_bump', 'burr', 'stain', 'particle', 'void', 'coating', 'print', 'wrinkle', 'solder', 'thread', 'raised', 'flat_color', 'hole', 'transparent_part', 'shiny_part', 'wire', 'outline', 'fiducial', 'corner', 'surface_edge', 'ink_label', 'dpm', 'curved_print', 'color_match', 'color_shading'));
