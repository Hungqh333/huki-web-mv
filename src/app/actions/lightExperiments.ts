'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { dbError } from '@/lib/db-error';
import { EXPERIMENTS_BUCKET } from '@/lib/lightExperiments';
import { createClient } from '@/lib/supabase/server';
import { VERDICTS } from '@/lib/vision/experimentMatch';
import { COLORS, LIGHT_COLORS, LIGHT_FINISHES, LIGHT_MATERIALS, LIGHT_SHAPES, LIGHT_TASKS, LIGHT_TYPES_V2, TASK_FEATURES } from '@/lib/vision/lightOptions';

/**
 * Nhập thực nghiệm chiếu sáng — chỉ Admin (chốt 2026-10-24 Q6). Ghi bằng client của chính admin;
 * RLS là chốt chặn thứ hai (migration 20261024000001).
 *
 * Form ở trang server gửi thẳng vào các action này; lỗi / đã lưu báo lại bằng tham số `?e=` / `?ok=`
 * trên địa chỉ trang sửa (không cần component client cho từng form).
 */

const ADMIN_LIST = '/admin/thuc-nghiem-chieu-sang';
const editPath = (id: string) => `${ADMIN_LIST}/${id}`;

/** Vercel chặn thân yêu cầu > 4,5 MB → ảnh tối đa 4 MB (next.config.ts). */
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
/** Báo cáo tải thẳng từ trình duyệt lên kho (không qua máy chủ) — giới hạn của bucket. */
const REPORT_MAX_BYTES = 50 * 1024 * 1024;
const REPORT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
/** Ảnh tối đa cho mỗi loại (chụp / xử lý) của một phương án. */
const IMAGES_PER_KIND = 3;

class FormError extends Error {}

const text = (formData: FormData, key: string, max: number) => {
  const value = formData.get(key);
  const v = typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  if (v !== null && v.length > max) throw new FormError('text');
  return v;
};
const required = (formData: FormData, key: string, max: number) => {
  const v = text(formData, key, max);
  if (v === null) throw new FormError('required');
  return v;
};
const num = (formData: FormData, key: string, min: number, max: number, integer = false) => {
  const v = text(formData, key, 30);
  if (v === null) return null;
  const n = Number(v.replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new FormError('number');
  return n;
};
const oneOf = (formData: FormData, key: string, list: readonly string[]) => {
  const v = text(formData, key, 60);
  if (v !== null && !list.includes(v)) throw new FormError('label');
  return v;
};
const uuid = (formData: FormData, key: string) => {
  const v = text(formData, key, 36);
  if (!v || !/^[0-9a-f-]{36}$/i.test(v)) throw new FormError('missing');
  return v;
};
/** "Cần thấy gì" dạng `bài toán:mục`; trống = chưa gắn. */
const target = (formData: FormData) => {
  const v = text(formData, 'target', 60);
  if (v === null) return { task: null, feature: null };
  const [task, feature] = v.split(':');
  if (!(LIGHT_TASKS as readonly string[]).includes(task) || !(TASK_FEATURES[task as (typeof LIGHT_TASKS)[number]] as readonly string[]).includes(feature))
    throw new FormError('label');
  return { task, feature };
};
const objectLabels = (formData: FormData) => ({
  material: oneOf(formData, 'material', LIGHT_MATERIALS),
  finish: oneOf(formData, 'finish', LIGHT_FINISHES),
  shape: oneOf(formData, 'shape', LIGHT_SHAPES),
});

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) redirect('/');
  return session;
}

/** Chạy một thao tác sửa; lỗi kiểm ô → quay lại trang sửa kèm mã lỗi, xong → kèm ?ok. */
async function run(back: string, anchor: string, work: () => Promise<string | void>): Promise<never> {
  let code: string;
  try {
    code = (await work()) ?? '';
  } catch (err) {
    if (err instanceof FormError) redirect(`${back}?e=${err.message}${anchor}`);
    throw err;
  }
  revalidatePath(ADMIN_LIST, 'layout');
  revalidatePath('/chon-den', 'layout');
  redirect(code ? `${back}?e=${code}${anchor}` : `${back}?ok=1${anchor}`);
}

async function failOnDb(error: { code?: string; message: string } | null, where: string) {
  if (!error) return;
  await dbError(error, where);
  throw new FormError(error.code === '23505' ? 'duplicate' : 'db');
}

// ── Lần thực nghiệm ──

export async function createExperimentAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  let id = '';
  try {
    const code = required(formData, 'code', 60);
    const title = required(formData, 'title', 200);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('light_experiments')
      .insert({ code, title, created_by: session.profile?.email ?? session.user.email ?? 'admin' })
      .select('id')
      .single<{ id: string }>();
    await failOnDb(error, 'createExperiment');
    id = data!.id;
  } catch (err) {
    if (err instanceof FormError) redirect(`${ADMIN_LIST}?e=${err.message}`);
    throw err;
  }
  revalidatePath(ADMIN_LIST);
  redirect(editPath(id));
}

export async function saveExperimentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid(formData, 'id');
  await run(editPath(id), '#chung', async () => {
    const reportUrl = text(formData, 'report_url', 500);
    if (reportUrl !== null && !/^https?:\/\//i.test(reportUrl)) throw new FormError('url');
    const testedOn = text(formData, 'tested_on', 10);
    if (testedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(testedOn)) throw new FormError('date');
    const row = {
      code: required(formData, 'code', 60),
      title: required(formData, 'title', 200),
      product_name: text(formData, 'product_name', 120),
      product_width_mm: num(formData, 'product_width_mm', 0.001, 100_000),
      product_height_mm: num(formData, 'product_height_mm', 0.001, 100_000),
      model_count: num(formData, 'model_count', 1, 10_000, true),
      min_defect_mm: num(formData, 'min_defect_mm', 0.0001, 10_000),
      engineer: text(formData, 'engineer', 120),
      tested_on: testedOn,
      ...objectLabels(formData),
      feature_color: oneOf(formData, 'feature_color', COLORS),
      background_color: oneOf(formData, 'background_color', COLORS),
      conclusion_vi: text(formData, 'conclusion_vi', 2000),
      conclusion_en: text(formData, 'conclusion_en', 2000),
      report_url: reportUrl,
      status: oneOf(formData, 'status', ['draft', 'published']) ?? 'draft',
      updated_at: new Date().toISOString(),
    };
    const supabase = await createClient();
    const { error } = await supabase.from('light_experiments').update(row).eq('id', id);
    await failOnDb(error, 'saveExperiment');
  });
}

/** Mọi file trong kho của một lần thực nghiệm (ảnh sản phẩm, báo cáo, ảnh phương án). */
async function experimentFiles(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string[]> {
  const [{ data: exp }, { data: images }] = await Promise.all([
    supabase.from('light_experiments').select('product_image_path, report_path').eq('id', id).maybeSingle<{ product_image_path: string | null; report_path: string | null }>(),
    supabase.from('light_experiment_images').select('storage_path').eq('experiment_id', id),
  ]);
  return [exp?.product_image_path, exp?.report_path, ...((images ?? []) as { storage_path: string }[]).map((i) => i.storage_path)].filter((p): p is string => Boolean(p));
}

export async function deleteExperimentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid(formData, 'id');
  const supabase = await createClient();
  const files = await experimentFiles(supabase, id);
  if (files.length > 0) await supabase.storage.from(EXPERIMENTS_BUCKET).remove(files);
  const { error } = await supabase.from('light_experiments').delete().eq('id', id);
  if (error) await dbError(error, 'deleteExperiment');
  revalidatePath(ADMIN_LIST);
  revalidatePath('/chon-den', 'layout');
  redirect(ADMIN_LIST);
}

/** Tải một ảnh lên kho; trả đường dẫn. */
async function uploadImage(supabase: Awaited<ReturnType<typeof createClient>>, file: FormDataEntryValue | null, folder: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new FormError('file');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new FormError('type');
  if (file.size > IMAGE_MAX_BYTES) throw new FormError('size');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(EXPERIMENTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    await dbError({ code: 'storage', message: error.message }, 'experimentImage:storage');
    throw new FormError('db');
  }
  return path;
}

export async function uploadProductImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid(formData, 'id');
  await run(editPath(id), '#chung', async () => {
    const supabase = await createClient();
    const { data: old } = await supabase.from('light_experiments').select('product_image_path').eq('id', id).maybeSingle<{ product_image_path: string | null }>();
    const path = await uploadImage(supabase, formData.get('file'), `${id}/product`);
    const { error } = await supabase.from('light_experiments').update({ product_image_path: path, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) await supabase.storage.from(EXPERIMENTS_BUCKET).remove([path]);
    await failOnDb(error, 'uploadProductImage');
    if (old?.product_image_path) await supabase.storage.from(EXPERIMENTS_BUCKET).remove([old.product_image_path]);
  });
}

// ── Báo cáo: trình duyệt tải thẳng lên kho bằng link ký tên (file tới 50 MB, Q11) ──

export type ReportUploadTicket = { path: string; token: string } | { error: string };

export async function createReportUploadAction(experimentId: string, fileType: string, fileSize: number): Promise<ReportUploadTicket> {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return { error: 'notAdmin' };
  if (!/^[0-9a-f-]{36}$/i.test(experimentId)) return { error: 'missing' };
  const ext = REPORT_TYPES[fileType];
  if (!ext) return { error: 'reportType' };
  if (!(fileSize > 0 && fileSize <= REPORT_MAX_BYTES)) return { error: 'reportSize' };
  const supabase = await createClient();
  const path = `${experimentId}/report/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(EXPERIMENTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    await dbError({ code: 'storage', message: error?.message ?? 'no ticket' }, 'createReportUpload');
    return { error: 'db' };
  }
  return { path: data.path, token: data.token };
}

/** Sau khi trình duyệt tải xong: gắn file vào lần thực nghiệm, xoá báo cáo cũ. */
export async function attachReportAction(experimentId: string, path: string, name: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return { error: 'notAdmin' };
  // Chỉ nhận đúng đường dẫn do createReportUploadAction cấp cho lần thực nghiệm này.
  if (!new RegExp(`^${experimentId}/report/[0-9a-f-]{36}\\.(pdf|pptx)$`, 'i').test(path)) return { error: 'missing' };
  const supabase = await createClient();
  const { data: old } = await supabase.from('light_experiments').select('report_path').eq('id', experimentId).maybeSingle<{ report_path: string | null }>();
  const { error } = await supabase
    .from('light_experiments')
    .update({ report_path: path, report_name: name.slice(0, 200), updated_at: new Date().toISOString() })
    .eq('id', experimentId);
  if (error) {
    await supabase.storage.from(EXPERIMENTS_BUCKET).remove([path]);
    await dbError(error, 'attachReport');
    return { error: 'db' };
  }
  if (old?.report_path && old.report_path !== path) await supabase.storage.from(EXPERIMENTS_BUCKET).remove([old.report_path]);
  revalidatePath(editPath(experimentId));
  revalidatePath('/chon-den', 'layout');
  return { ok: true };
}

export async function removeReportAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid(formData, 'id');
  await run(editPath(id), '#chung', async () => {
    const supabase = await createClient();
    const { data: old } = await supabase.from('light_experiments').select('report_path').eq('id', id).maybeSingle<{ report_path: string | null }>();
    const { error } = await supabase.from('light_experiments').update({ report_path: null, report_name: null }).eq('id', id);
    await failOnDb(error, 'removeReport');
    if (old?.report_path) await supabase.storage.from(EXPERIMENTS_BUCKET).remove([old.report_path]);
  });
}

// ── Hạng mục ──

const itemFields = (formData: FormData) => ({
  name_vi: required(formData, 'name_vi', 200),
  name_en: text(formData, 'name_en', 200),
  requirement: text(formData, 'requirement', 1000),
  ...target(formData),
  ...objectLabels(formData),
  sort_order: num(formData, 'sort_order', 0, 1000, true) ?? 0,
});

export async function addItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  await run(editPath(experimentId), '#hang-muc', async () => {
    const supabase = await createClient();
    const { count } = await supabase.from('light_experiment_items').select('id', { count: 'exact', head: true }).eq('experiment_id', experimentId);
    const { data, error } = await supabase
      .from('light_experiment_items')
      .insert({ experiment_id: experimentId, ...itemFields(formData), sort_order: count ?? 0 })
      .select('id')
      .single<{ id: string }>();
    await failOnDb(error, 'addItem');
    // Mỗi hạng mục có sẵn một phương án để điền tiếp (báo cáo thường chỉ có một).
    const light = oneOf(formData, 'light_type', LIGHT_TYPES_V2);
    if (light) {
      const { error: trialError } = await supabase.from('light_experiment_trials').insert({ experiment_id: experimentId, item_id: data!.id, light_type: light });
      await failOnDb(trialError, 'addItem:trial');
    }
  });
}

export async function saveItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const id = uuid(formData, 'id');
  await run(editPath(experimentId), `#hm-${id}`, async () => {
    const supabase = await createClient();
    const { error } = await supabase.from('light_experiment_items').update(itemFields(formData)).eq('id', id).eq('experiment_id', experimentId);
    await failOnDb(error, 'saveItem');
  });
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const id = uuid(formData, 'id');
  await run(editPath(experimentId), '#hang-muc', async () => {
    const supabase = await createClient();
    const { data: trials } = await supabase.from('light_experiment_trials').select('id').eq('item_id', id);
    const trialIds = ((trials ?? []) as { id: string }[]).map((t) => t.id);
    if (trialIds.length > 0) {
      const { data: images } = await supabase.from('light_experiment_images').select('storage_path').in('trial_id', trialIds);
      const paths = ((images ?? []) as { storage_path: string }[]).map((i) => i.storage_path);
      if (paths.length > 0) await supabase.storage.from(EXPERIMENTS_BUCKET).remove(paths);
    }
    const { error } = await supabase.from('light_experiment_items').delete().eq('id', id).eq('experiment_id', experimentId);
    await failOnDb(error, 'deleteItem');
  });
}

// ── Phương án đèn ──

const trialFields = (formData: FormData) => {
  const light = oneOf(formData, 'light_type', LIGHT_TYPES_V2);
  if (!light) throw new FormError('light');
  const count = (key: string) => num(formData, key, 0, 10_000_000, true);
  return {
    label: text(formData, 'label', 120),
    is_chosen: formData.get('is_chosen') === 'on',
    light_type: light,
    light_color: oneOf(formData, 'light_color', LIGHT_COLORS),
    light_model: text(formData, 'light_model', 120),
    angle_note: text(formData, 'angle_note', 120),
    distance_mm: num(formData, 'distance_mm', 0.001, 10_000),
    backdrop: text(formData, 'backdrop', 120),
    camera: text(formData, 'camera', 120),
    lens: text(formData, 'lens', 120),
    accessory: text(formData, 'accessory', 120),
    capture_ms: num(formData, 'capture_ms', 0.001, 600_000),
    process_ms: num(formData, 'process_ms', 0.001, 600_000),
    verdict: oneOf(formData, 'verdict', VERDICTS),
    measured_error_mm: num(formData, 'measured_error_mm', 0, 1000),
    note: text(formData, 'note', 1000),
    ok_samples: count('ok_samples'),
    ng_samples: count('ng_samples'),
    tp: count('tp'),
    tn: count('tn'),
    fp: count('fp'),
    fn: count('fn'),
    sort_order: num(formData, 'sort_order', 0, 1000, true) ?? 0,
  };
};

export async function addTrialAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const itemId = uuid(formData, 'item_id');
  await run(editPath(experimentId), `#hm-${itemId}`, async () => {
    const light = oneOf(formData, 'light_type', LIGHT_TYPES_V2);
    if (!light) throw new FormError('light');
    const supabase = await createClient();
    const { count } = await supabase.from('light_experiment_trials').select('id', { count: 'exact', head: true }).eq('item_id', itemId);
    // Phương án thêm sau để so sánh — chưa phải phương án được chọn.
    const { error } = await supabase
      .from('light_experiment_trials')
      .insert({ experiment_id: experimentId, item_id: itemId, light_type: light, label: text(formData, 'label', 120), is_chosen: false, sort_order: count ?? 0 });
    await failOnDb(error, 'addTrial');
  });
}

export async function saveTrialAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const id = uuid(formData, 'id');
  await run(editPath(experimentId), `#pa-${id}`, async () => {
    const supabase = await createClient();
    const { error } = await supabase.from('light_experiment_trials').update(trialFields(formData)).eq('id', id).eq('experiment_id', experimentId);
    await failOnDb(error, 'saveTrial');
  });
}

export async function deleteTrialAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const id = uuid(formData, 'id');
  await run(editPath(experimentId), '#hang-muc', async () => {
    const supabase = await createClient();
    const { data: images } = await supabase.from('light_experiment_images').select('storage_path').eq('trial_id', id);
    const paths = ((images ?? []) as { storage_path: string }[]).map((i) => i.storage_path);
    if (paths.length > 0) await supabase.storage.from(EXPERIMENTS_BUCKET).remove(paths);
    const { error } = await supabase.from('light_experiment_trials').delete().eq('id', id).eq('experiment_id', experimentId);
    await failOnDb(error, 'deleteTrial');
  });
}

// ── Ảnh của phương án ──

export async function uploadTrialImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const trialId = uuid(formData, 'trial_id');
  await run(editPath(experimentId), `#pa-${trialId}`, async () => {
    const kind = oneOf(formData, 'kind', ['raw', 'processed']);
    if (!kind) throw new FormError('label');
    const caption = text(formData, 'caption_vi', 300);
    const supabase = await createClient();
    const { count } = await supabase.from('light_experiment_images').select('id', { count: 'exact', head: true }).eq('trial_id', trialId).eq('kind', kind);
    if ((count ?? 0) >= IMAGES_PER_KIND) throw new FormError('tooMany');
    const path = await uploadImage(supabase, formData.get('file'), `${experimentId}/trials/${trialId}/${kind}`);
    const { error } = await supabase
      .from('light_experiment_images')
      .insert({ experiment_id: experimentId, trial_id: trialId, kind, storage_path: path, caption_vi: caption, sort_order: count ?? 0 });
    if (error) await supabase.storage.from(EXPERIMENTS_BUCKET).remove([path]);
    await failOnDb(error, 'uploadTrialImage');
  });
}

export async function deleteTrialImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const experimentId = uuid(formData, 'experiment_id');
  const id = uuid(formData, 'id');
  await run(editPath(experimentId), '#hang-muc', async () => {
    const supabase = await createClient();
    const { data } = await supabase.from('light_experiment_images').select('storage_path').eq('id', id).maybeSingle<{ storage_path: string }>();
    if (!data) return;
    await supabase.storage.from(EXPERIMENTS_BUCKET).remove([data.storage_path]);
    const { error } = await supabase.from('light_experiment_images').delete().eq('id', id);
    await failOnDb(error, 'deleteTrialImage');
  });
}
