import 'server-only';

import type { createClient } from '@/lib/supabase/server';

/**
 * Ảnh mẫu chiếu sáng (chốt 2026-10-22, nhãn + thông số setting 2026-10-23) — kho riêng trên Supabase
 * Storage, RLS Member+ xem. Đọc bằng client của NGƯỜI XEM (không dùng service_role): người không đủ
 * quyền nhận danh sách rỗng.
 */
export const SAMPLES_BUCKET = 'lighting-samples';
/** Link ký tên sống 1 giờ — đủ cho một phiên xem trang. */
const SIGNED_URL_SECONDS = 3600;

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SampleRow = {
  id: string;
  task: string | null;
  /** Khoá "cần thấy gì" (tên cột giữ từ bản đầu); null = ảnh tham khảo chung. */
  defect_type: string | null;
  material: string | null;
  finish: string | null;
  shape: string | null;
  feature_color: string | null;
  background_color: string | null;
  light_type: string;
  light_color: string | null;
  light_model: string | null;
  angle_note: string | null;
  distance_mm: number | null;
  exposure_us: number | null;
  camera: string | null;
  lens: string | null;
  source: string | null;
  storage_path: string;
  caption_vi: string | null;
  caption_en: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

const COLUMNS =
  'id, task, defect_type, material, finish, shape, feature_color, background_color, light_type, light_color, light_model, angle_note, distance_mm, exposure_us, camera, lens, source, storage_path, caption_vi, caption_en, sort_order, created_by, created_at';

/** Mọi hàng ảnh mẫu (chưa có link). Lỗi đọc → rỗng (trang vẫn chạy, chỉ không có ảnh). */
export async function loadSampleRows(supabase: Supabase): Promise<SampleRow[]> {
  const { data, error } = await supabase.from('lighting_samples').select(COLUMNS).order('defect_type').order('sort_order').order('created_at');
  if (error) {
    console.warn('[lighting-samples]', error.code, error.message);
    return [];
  }
  return ((data ?? []) as SampleRow[]).map((r) => ({
    ...r,
    distance_mm: r.distance_mm === null ? null : Number(r.distance_mm),
    exposure_us: r.exposure_us === null ? null : Number(r.exposure_us),
  }));
}

/** Gắn link ký tên cho các hàng; file không ký được (đã xoá khỏi kho) thì bỏ. */
export async function withSignedUrls<T extends Pick<SampleRow, 'storage_path'>>(supabase: Supabase, rows: readonly T[]): Promise<(T & { url: string })[]> {
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage.from(SAMPLES_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), SIGNED_URL_SECONDS);
  const urlOf = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  return rows.filter((r) => urlOf.has(r.storage_path)).map((r) => ({ ...r, url: urlOf.get(r.storage_path)! }));
}

/** Trang admin: mọi ảnh kèm link. */
export async function loadSamples(supabase: Supabase): Promise<(SampleRow & { url: string })[]> {
  return withSignedUrls(supabase, await loadSampleRows(supabase));
}
