-- =============================================================================
-- Ảnh mẫu chiếu sáng do phòng Vision tự chụp — trang Chọn đèn
--
-- Chốt 2026-10-22 (Hùng, Q6–Q8): kho ảnh RIÊNG trên Supabase Storage, gắn theo "cần thấy gì" ×
-- kiểu đèn (trang Chọn đèn bản 2). Cột defect_type lưu khoá "cần thấy gì" (lỗi, chi tiết, mã…). Chỉ Member trở lên xem (cùng mức trang Chọn đèn), chỉ Admin tải lên / xoá.
-- Trang hiện ảnh bằng link ký tên (hết hạn sau 1 giờ) — bucket KHÔNG công khai.
--
-- Dán lại nhiều lần không sao.
-- =============================================================================

-- ── Kho ảnh (bucket riêng, tối đa 5 MB mỗi ảnh, chỉ JPEG / PNG / WebP) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lighting-samples', 'lighting-samples', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lighting_samples_read_member" on storage.objects;
create policy "lighting_samples_read_member"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lighting-samples' and public.is_member_plus());

drop policy if exists "lighting_samples_insert_admin" on storage.objects;
create policy "lighting_samples_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lighting-samples' and public.is_admin());

drop policy if exists "lighting_samples_delete_admin" on storage.objects;
create policy "lighting_samples_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lighting-samples' and public.is_admin());

-- ── Bảng mô tả ảnh: nhãn bài toán + thông số setting chụp (chốt 2026-10-23, Q1–Q4) ──
-- Mọi khoá theo src/lib/vision/lightOptions.ts — trang Chọn đèn khớp ảnh với bài toán người dùng nhập:
-- trùng "cần thấy gì" trước, rồi theo số nhãn trùng; defect_type để trống = ảnh tham khảo chung.
create table if not exists public.lighting_samples (
  id               uuid primary key default gen_random_uuid(),
  task             text,
  defect_type      text,              -- khoá "cần thấy gì" (feature)
  material         text,
  finish           text,
  shape            text,
  feature_color    text,
  background_color text,
  light_type       text not null,
  light_color      text,
  light_model      text,
  angle_note       text,              -- góc chiếu, ghi chữ (vd "góc thấp ~15°")
  distance_mm      numeric,           -- khoảng cách đèn – vật
  exposure_us      numeric,           -- thời gian phơi sáng
  camera           text,
  lens             text,
  source           text,              -- nguồn ảnh: tự chụp / hãng + link
  storage_path     text not null unique,
  caption_vi       text,
  caption_en       text,
  sort_order       integer not null default 0,
  created_by       text,
  created_at       timestamptz not null default now(),

  constraint lighting_samples_task_check check (task is null or task in ('inspect', 'presence', 'align', 'measure', 'code', 'color')),
  constraint lighting_samples_defect_check check (defect_type is null or defect_type in ('scratch', 'crack_chip', 'dent_bump', 'burr', 'stain', 'particle', 'void', 'coating', 'print', 'wrinkle', 'solder', 'raised', 'flat_color', 'hole', 'transparent_part', 'shiny_part', 'wire', 'outline', 'fiducial', 'corner', 'surface_edge', 'ink_label', 'dpm', 'curved_print', 'color_match', 'color_shading')),
  constraint lighting_samples_material_check check (material is null or material in ('metal_machined', 'metal_cast', 'metal_sheet', 'metal_polished', 'aluminum_anodized', 'copper_gold', 'plastic_matte', 'plastic_glossy', 'plastic_clear', 'plastic_translucent', 'rubber', 'pcb', 'glass', 'ceramic', 'film_foil', 'paper_label', 'fabric', 'wood', 'painted', 'wafer')),
  constraint lighting_samples_finish_check check (finish is null or finish in ('matte', 'semi_gloss', 'mirror_flat', 'mirror_curved', 'textured', 'transparent', 'translucent')),
  constraint lighting_samples_shape_check check (shape is null or shape in ('flat', 'curved', 'stepped')),
  constraint lighting_samples_feature_color_check check (feature_color is null or feature_color in ('white', 'gray', 'black', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'brown', 'gold')),
  constraint lighting_samples_background_color_check check (background_color is null or background_color in ('white', 'gray', 'black', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'brown', 'gold')),
  constraint lighting_samples_light_check check (light_type in ('ring', 'dome', 'backlight', 'bar', 'coaxial', 'darkfield', 'photometric_stereo', 'multi_angle_ring', 'structured_stripe', 'line')),
  constraint lighting_samples_light_color_check check (light_color is null or light_color in ('white', 'red', 'green', 'blue', 'ir', 'uv')),
  constraint lighting_samples_numbers_check check (
    (distance_mm is null or (distance_mm > 0 and distance_mm <= 10000)) and (exposure_us is null or (exposure_us > 0 and exposure_us <= 10000000))
  ),
  constraint lighting_samples_text_check check (
    coalesce(length(caption_vi), 0) <= 300 and coalesce(length(caption_en), 0) <= 300
    and coalesce(length(light_model), 0) <= 120 and coalesce(length(angle_note), 0) <= 120
    and coalesce(length(camera), 0) <= 120 and coalesce(length(lens), 0) <= 120 and coalesce(length(source), 0) <= 300
  )
);

comment on table public.lighting_samples is
  'Ảnh mẫu chiếu sáng tự chụp (bucket lighting-samples). Member+ xem, Admin ghi. Trang /chon-den, /admin/anh-mau-chieu-sang.';

alter table public.lighting_samples enable row level security;

drop policy if exists "lighting_samples_select_member" on public.lighting_samples;
create policy "lighting_samples_select_member"
  on public.lighting_samples for select
  to authenticated
  using (public.is_member_plus());

drop policy if exists "lighting_samples_write_admin" on public.lighting_samples;
create policy "lighting_samples_write_admin"
  on public.lighting_samples for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.lighting_samples from anon;
grant select, insert, update, delete on public.lighting_samples to authenticated;
