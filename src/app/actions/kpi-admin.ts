'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type KpiAdminState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

const GROUPS = ['presence', 'metrology', 'code', 'process', 'cosmetic'];
const DEEP_LEARNING = ['no', 'sometimes', 'often', 'required'];
const SPECIAL = ['robot_guidance', 'code_reading', 'web_inspection'];
const DATA_SOURCES = ['estimate', 'project_history', 'vendor_spec'];

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function nullable(formData: FormData, key: string): string | null {
  return str(formData, key) || null;
}

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return null;
  return session;
}

/** Đọc một số phần trăm, chặn ở 0–100. */
function pct(formData: FormData, key: string, errors: Record<string, string>, label: string): number {
  const value = Number(str(formData, key));
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors[key] = label;
    return 0;
  }
  return value;
}

// ------------------------------------------------------------ LOẠI BÀI TOÁN --

export async function saveProblemTypeAction(
  _prevState: KpiAdminState,
  formData: FormData
): Promise<KpiAdminState> {
  const t = await getTranslations('admin.kpi.errors');

  if (!(await requireAdmin())) return { error: t('notAdmin') };

  const id = nullable(formData, 'id');
  const errors: Record<string, string> = {};

  const slug = str(formData, 'slug');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = t('invalidSlug');

  const group = str(formData, 'problem_group');
  if (!GROUPS.includes(group)) errors.problem_group = t('invalidGroup');

  const level = Number(str(formData, 'level'));
  if (!Number.isInteger(level) || level < 1 || level > 7) errors.level = t('invalidLevel');

  if (!str(formData, 'name_vi')) errors.name_vi = t('required');
  if (!str(formData, 'name_en')) errors.name_en = t('required');

  const deepLearning = str(formData, 'deep_learning');
  if (!DEEP_LEARNING.includes(deepLearning)) errors.deep_learning = t('invalidValue');

  const specialRaw = str(formData, 'special_kpi');
  if (specialRaw && !SPECIAL.includes(specialRaw)) errors.special_kpi = t('invalidValue');

  const dataSource = str(formData, 'data_source');
  if (!DATA_SOURCES.includes(dataSource)) errors.data_source = t('invalidValue');

  const invalidPct = t('invalidPercent');
  const missMin = pct(formData, 'miss_min', errors, invalidPct);
  const missMax = pct(formData, 'miss_max', errors, invalidPct);
  const frWeek1Min = pct(formData, 'false_reject_week1_min', errors, invalidPct);
  const frWeek1Max = pct(formData, 'false_reject_week1_max', errors, invalidPct);
  const frMin = pct(formData, 'false_reject_min', errors, invalidPct);
  const frMax = pct(formData, 'false_reject_max', errors, invalidPct);
  const recheckMin = pct(formData, 'recheck_min', errors, invalidPct);
  const recheckMax = pct(formData, 'recheck_max', errors, invalidPct);
  const burdenMax = pct(formData, 'total_burden_max', errors, invalidPct);

  const rampMin = Number(str(formData, 'ramp_up_weeks_min'));
  const rampMax = Number(str(formData, 'ramp_up_weeks_max'));
  if (!Number.isFinite(rampMin) || rampMin < 0) errors.ramp_up_weeks_min = t('invalidNumber');
  if (!Number.isFinite(rampMax) || rampMax < 0) errors.ramp_up_weeks_max = t('invalidNumber');

  // Mọi dải đều phải min <= max.
  const ordered: [string, number, number][] = [
    ['miss_max', missMin, missMax],
    ['false_reject_week1_max', frWeek1Min, frWeek1Max],
    ['false_reject_max', frMin, frMax],
    ['recheck_max', recheckMin, recheckMax],
    ['ramp_up_weeks_max', rampMin, rampMax],
  ];
  for (const [key, min, max] of ordered) {
    if (min > max) errors[key] = t('maxBelowMin');
  }

  // Cùng ràng buộc với database: trần tải phụ phải đủ chứa hai giá trị nhỏ nhất.
  // Không ràng buộc trên hai giá trị LỚN NHẤT — chúng không bao giờ xảy ra đồng thời.
  if (frMin + recheckMin > burdenMax + 0.001) {
    errors.total_burden_max = t('burdenFloorTooLow', { floor: frMin + recheckMin });
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const payload = {
    slug,
    problem_group: group,
    level,
    name_vi: str(formData, 'name_vi'),
    name_en: str(formData, 'name_en'),
    miss_min: missMin,
    miss_max: missMax,
    false_reject_week1_min: frWeek1Min,
    false_reject_week1_max: frWeek1Max,
    false_reject_min: frMin,
    false_reject_max: frMax,
    recheck_min: recheckMin,
    recheck_max: recheckMax,
    total_burden_max: burdenMax,
    ramp_up_weeks_min: rampMin,
    ramp_up_weeks_max: rampMax,
    deep_learning: deepLearning,
    special_kpi: specialRaw || null,
    note_vi: nullable(formData, 'note_vi'),
    note_en: nullable(formData, 'note_en'),
    data_source: dataSource,
    calibration_note_vi: nullable(formData, 'calibration_note_vi'),
    calibration_note_en: nullable(formData, 'calibration_note_en'),
    // Đánh dấu mốc thời gian khi số liệu được xác nhận bằng dữ liệu dự án thật.
    calibrated_at: dataSource === 'estimate' ? null : new Date().toISOString(),
    is_active: formData.get('is_active') === 'on',
    sort_order: Number(str(formData, 'sort_order')) || 0,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('kpi_problem_types').update(payload).eq('id', id)
    : await supabase.from('kpi_problem_types').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/admin/chi-tieu');
  revalidatePath('/cong-cu-chi-tieu');
  redirect('/admin/chi-tieu?saved=1');
}

export async function deleteProblemTypeAction(formData: FormData) {
  if (!(await requireAdmin())) redirect('/');

  const id = str(formData, 'id');
  if (id) {
    const supabase = await createClient();
    await supabase.from('kpi_problem_types').delete().eq('id', id);
  }

  revalidatePath('/admin/chi-tieu');
  revalidatePath('/cong-cu-chi-tieu');
  redirect('/admin/chi-tieu?deleted=1');
}

// ------------------------------------------------------------------ HỆ SỐ --

export async function saveModifierAction(
  _prevState: KpiAdminState,
  formData: FormData
): Promise<KpiAdminState> {
  const t = await getTranslations('admin.kpi.errors');

  if (!(await requireAdmin())) return { error: t('notAdmin') };

  const id = nullable(formData, 'id');
  const errors: Record<string, string> = {};

  const slug = str(formData, 'slug');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = t('invalidSlug');
  if (!str(formData, 'name_vi')) errors.name_vi = t('required');
  if (!str(formData, 'name_en')) errors.name_en = t('required');

  const direction = str(formData, 'direction');
  if (direction !== 'worse' && direction !== 'better') errors.direction = t('invalidValue');

  const factorMin = Number(str(formData, 'factor_min'));
  const factorMax = Number(str(formData, 'factor_max'));
  if (!Number.isFinite(factorMin) || factorMin <= 0) errors.factor_min = t('invalidFactor');
  if (!Number.isFinite(factorMax) || factorMax <= 0) errors.factor_max = t('invalidFactor');
  if (factorMin > factorMax) errors.factor_max = t('maxBelowMin');

  // Hệ số "làm tốt lên" phải nhỏ hơn 1, "làm xấu đi" phải lớn hơn 1 — ngược lại
  // là gõ nhầm, và cái nhầm đó sẽ âm thầm làm sai mọi kết quả tính.
  if (direction === 'better' && factorMax >= 1) errors.factor_max = t('betterMustBeBelowOne');
  if (direction === 'worse' && factorMin <= 1) errors.factor_min = t('worseMustBeAboveOne');

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const payload = {
    slug,
    name_vi: str(formData, 'name_vi'),
    name_en: str(formData, 'name_en'),
    factor_min: factorMin,
    factor_max: factorMax,
    direction,
    note_vi: nullable(formData, 'note_vi'),
    note_en: nullable(formData, 'note_en'),
    data_source: DATA_SOURCES.includes(str(formData, 'data_source'))
      ? str(formData, 'data_source')
      : 'estimate',
    is_active: formData.get('is_active') === 'on',
    sort_order: Number(str(formData, 'sort_order')) || 0,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('kpi_modifiers').update(payload).eq('id', id)
    : await supabase.from('kpi_modifiers').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/admin/chi-tieu/he-so');
  revalidatePath('/cong-cu-chi-tieu');
  redirect('/admin/chi-tieu/he-so?saved=1');
}

export async function deleteModifierAction(formData: FormData) {
  if (!(await requireAdmin())) redirect('/');

  const id = str(formData, 'id');
  if (id) {
    const supabase = await createClient();
    await supabase.from('kpi_modifiers').delete().eq('id', id);
  }

  revalidatePath('/admin/chi-tieu/he-so');
  revalidatePath('/cong-cu-chi-tieu');
  redirect('/admin/chi-tieu/he-so?deleted=1');
}

// ---------------------------------------------------------------- HẰNG SỐ --

export async function saveConfigAction(
  _prevState: KpiAdminState,
  formData: FormData
): Promise<KpiAdminState> {
  const t = await getTranslations('admin.kpi.errors');

  if (!(await requireAdmin())) return { error: t('notAdmin') };

  const keys = formData.getAll('config_key').filter((k): k is string => typeof k === 'string');
  const errors: Record<string, string> = {};
  const updates: { key: string; value: number }[] = [];

  for (const key of keys) {
    const raw = str(formData, `value_${key}`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      errors[`value_${key}`] = t('invalidNumber');
      continue;
    }
    updates.push({ key, value });
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const supabase = await createClient();
  for (const update of updates) {
    const { error } = await supabase
      .from('kpi_config')
      .update({ value: update.value })
      .eq('key', update.key);
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/chi-tieu/tham-so');
  revalidatePath('/cong-cu-chi-tieu');
  return { notice: t('saved') };
}

export async function saveTighteningAction(
  _prevState: KpiAdminState,
  formData: FormData
): Promise<KpiAdminState> {
  const t = await getTranslations('admin.kpi.errors');

  if (!(await requireAdmin())) return { error: t('notAdmin') };

  const ratios = formData
    .getAll('ratio')
    .filter((r): r is string => typeof r === 'string')
    .map(Number)
    .filter((r) => Number.isFinite(r));

  const errors: Record<string, string> = {};
  const updates: { ratio: number; k: number }[] = [];

  for (const ratio of ratios) {
    const k = Number(str(formData, `k_${ratio}`));
    if (!Number.isFinite(k) || k < 1) {
      errors[`k_${ratio}`] = t('tighteningKAtLeastOne');
      continue;
    }
    updates.push({ ratio, k });
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const supabase = await createClient();
  for (const update of updates) {
    const { error } = await supabase
      .from('kpi_tightening_factors')
      .update({ burden_k: update.k })
      .eq('miss_ratio', update.ratio);
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/chi-tieu/tham-so');
  revalidatePath('/cong-cu-chi-tieu');
  return { notice: t('saved') };
}
