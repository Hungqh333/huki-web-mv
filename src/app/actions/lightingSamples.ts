'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { dbError } from '@/lib/db-error';
import { SAMPLES_BUCKET } from '@/lib/lightingSamples';
import { createClient } from '@/lib/supabase/server';
import { COLORS, LIGHT_COLORS, LIGHT_FINISHES, LIGHT_MATERIALS, LIGHT_SHAPES, LIGHT_TASKS, LIGHT_TYPES_V2, TASK_FEATURES } from '@/lib/vision/lightOptions';
import type { AdminState } from './admin';

/**
 * Ảnh mẫu chiếu sáng (chốt 2026-10-22 Q6–Q8; nhãn + thông số setting 2026-10-23 Q1–Q4). Kho riêng
 * `lighting-samples` trên Supabase Storage — RLS: Member+ xem, chỉ Admin tải lên / xoá (migration
 * 20261022000002). Tải lên bằng client của chính admin, không dùng khoá service_role.
 *
 * Một ảnh một lần gọi — nhập hàng loạt từ CSV ở trình duyệt cũng gọi hàm này từng ảnh, nên mọi
 * ảnh đi qua đúng một chỗ kiểm nhãn.
 */

/** Vercel chặn thân yêu cầu > 4,5 MB → ảnh tối đa 4 MB (next.config.ts). */
const SAMPLE_MAX_BYTES = 4 * 1024 * 1024;
const SAMPLE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const CAPTION_MAX = 300;
const SHORT_MAX = 120;

export type SampleUploadState = AdminState & { saved?: boolean };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

export async function uploadLightingSampleAction(_prev: SampleUploadState, formData: FormData): Promise<SampleUploadState> {
  const t = await getTranslations('admin.samples');
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return { error: t('errors.notAdmin') };

  // "Cần thấy gì" gửi dạng `bài toán:mục` (một mục như "lỗ" có ở nhiều bài toán); trống = ảnh tham khảo chung.
  const target = text(formData, 'target');
  const [task, feature] = target ? (target.split(':') as [string, string]) : [null, null];
  if (task !== null && !(LIGHT_TASKS.includes(task as never) && (TASK_FEATURES[task as (typeof LIGHT_TASKS)[number]] as readonly string[]).includes(feature!)))
    return { error: t('errors.defect') };
  const light = text(formData, 'light_type');
  if (!light || !(LIGHT_TYPES_V2 as readonly string[]).includes(light)) return { error: t('errors.light') };

  const pick = (key: string, list: readonly string[]) => {
    const v = text(formData, key);
    return v === null || list.includes(v) ? { ok: true as const, v } : { ok: false as const, v: null };
  };
  const enums = {
    material: pick('material', LIGHT_MATERIALS),
    finish: pick('finish', LIGHT_FINISHES),
    shape: pick('shape', LIGHT_SHAPES),
    feature_color: pick('feature_color', COLORS),
    background_color: pick('background_color', COLORS),
    light_color: pick('light_color', LIGHT_COLORS),
  };
  if (Object.values(enums).some((e) => !e.ok)) return { error: t('errors.label') };
  const num = (key: string, max: number) => {
    const v = text(formData, key);
    if (v === null) return { ok: true as const, v: null };
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) && n > 0 && n <= max ? { ok: true as const, v: n } : { ok: false as const, v: null };
  };
  const distance = num('distance_mm', 10_000);
  const exposure = num('exposure_us', 10_000_000);
  if (!distance.ok || !exposure.ok) return { error: t('errors.number') };
  const short = { light_model: text(formData, 'light_model'), angle_note: text(formData, 'angle_note'), camera: text(formData, 'camera'), lens: text(formData, 'lens') };
  const captionVi = text(formData, 'caption_vi');
  const captionEn = text(formData, 'caption_en');
  const source = text(formData, 'source');
  if (Object.values(short).some((v) => (v?.length ?? 0) > SHORT_MAX) || [captionVi, captionEn, source].some((v) => (v?.length ?? 0) > CAPTION_MAX))
    return { error: t('errors.caption') };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: t('errors.file') };
  const ext = SAMPLE_TYPES[file.type];
  if (!ext) return { error: t('errors.type') };
  if (file.size > SAMPLE_MAX_BYTES) return { error: t('errors.size') };

  const supabase = await createClient();
  const path = `${feature ?? 'general'}/${light}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(SAMPLES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: await dbError({ code: 'storage', message: uploadError.message }, 'uploadLightingSample:storage') };

  const { error } = await supabase.from('lighting_samples').insert({
    task,
    defect_type: feature,
    material: enums.material.v,
    finish: enums.finish.v,
    shape: enums.shape.v,
    feature_color: enums.feature_color.v,
    background_color: enums.background_color.v,
    light_type: light,
    light_color: enums.light_color.v,
    ...short,
    distance_mm: distance.v,
    exposure_us: exposure.v,
    source,
    storage_path: path,
    caption_vi: captionVi,
    caption_en: captionEn,
    created_by: session.profile?.email ?? session.user.email ?? 'admin',
  });
  if (error) {
    // Không để file mồ côi trong kho khi ghi bảng lỗi.
    await supabase.storage.from(SAMPLES_BUCKET).remove([path]);
    return { error: await dbError(error, 'uploadLightingSample:insert') };
  }

  revalidatePath('/admin/anh-mau-chieu-sang');
  return { notice: t('saved'), saved: true };
}

export async function deleteLightingSampleAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return;
  const id = text(formData, 'id');
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase.from('lighting_samples').select('storage_path').eq('id', id).maybeSingle<{ storage_path: string }>();
  if (!data) return;
  await supabase.storage.from(SAMPLES_BUCKET).remove([data.storage_path]);
  const { error } = await supabase.from('lighting_samples').delete().eq('id', id);
  if (error) await dbError(error, 'deleteLightingSample');
  revalidatePath('/admin/anh-mau-chieu-sang');
}
