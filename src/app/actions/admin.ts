'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionContext, isAdmin, type UserRole } from '@/lib/auth';
import { sanitizeArticleHtml } from '@/lib/html';
import { validateCondition } from '@/lib/selector/conditions';
import { createClient } from '@/lib/supabase/server';

export type AdminState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

const ROLES: UserRole[] = ['registered', 'member', 'vip', 'admin'];
const TIERS = ['public', 'registered', 'member', 'vip'];
const APPROACHES = ['rule_based', 'deep_learning', 'hybrid'];

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function nullable(formData: FormData, key: string): string | null {
  return str(formData, key) || null;
}

/** Mọi action quản trị đều đi qua đây trước. RLS là chốt chặn thứ hai. */
async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdmin(session.profile?.role)) return null;
  return session;
}

// ---------------------------------------------------------------- NGƯỜI DÙNG --

export async function updateUserRoleAction(
  _prevState: AdminState,
  formData: FormData
): Promise<AdminState> {
  const t = await getTranslations('admin.errors');

  const session = await requireAdmin();
  if (!session) return { error: t('notAdmin') };

  const userId = str(formData, 'user_id');
  const role = str(formData, 'role');

  if (!userId || !ROLES.includes(role as UserRole)) return { error: t('invalidRole') };

  // Không cho admin tự đổi vai trò của chính mình: một cú nhầm tay là mất
  // quyền quản trị và không có đường vào lại ngoài SQL Editor.
  if (userId === session.user.id) return { error: t('cannotChangeOwnRole') };

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);

  if (error) return { error: error.message };

  revalidatePath('/admin/nguoi-dung');
  return { notice: t('roleUpdated') };
}

// ------------------------------------------------------------------ BÀI VIẾT --

export async function saveArticleAction(
  _prevState: AdminState,
  formData: FormData
): Promise<AdminState> {
  const t = await getTranslations('admin.errors');

  const session = await requireAdmin();
  if (!session) return { error: t('notAdmin') };

  const id = nullable(formData, 'id');
  const slug = str(formData, 'slug');
  const titleVi = str(formData, 'title_vi');
  const titleEn = str(formData, 'title_en');
  const accessTier = str(formData, 'access_tier');
  const categoryId = nullable(formData, 'category_id');
  const coverImage = nullable(formData, 'cover_image');
  const publish = formData.get('publish') === 'on';

  const fieldErrors: Record<string, string> = {};
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fieldErrors.slug = t('invalidSlug');
  if (!titleVi) fieldErrors.title_vi = t('required');
  if (!titleEn) fieldErrors.title_en = t('required');
  if (!TIERS.includes(accessTier)) fieldErrors.access_tier = t('invalidTier');

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Làm sạch NGAY LÚC LƯU: dữ liệu bẩn không bao giờ vào được database.
  const contentVi = sanitizeArticleHtml(str(formData, 'content_vi'));
  const contentEn = sanitizeArticleHtml(str(formData, 'content_en'));

  const supabase = await createClient();

  const payload = {
    slug,
    title_vi: titleVi,
    title_en: titleEn,
    content_vi: contentVi || null,
    content_en: contentEn || null,
    category_id: categoryId,
    access_tier: accessTier,
    cover_image: coverImage,
  };

  if (id) {
    // Giữ nguyên published_at cũ khi vẫn đang publish, để không nhảy ngày mỗi lần sửa.
    const { data: existing } = await supabase
      .from('articles')
      .select('published_at')
      .eq('id', id)
      .maybeSingle<{ published_at: string | null }>();

    const publishedAt = publish ? (existing?.published_at ?? new Date().toISOString()) : null;

    const { error } = await supabase
      .from('articles')
      .update({ ...payload, published_at: publishedAt })
      .eq('id', id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('articles').insert({
      ...payload,
      author_id: session.user.id,
      published_at: publish ? new Date().toISOString() : null,
    });

    if (error) return { error: error.message };
  }

  revalidatePath('/admin/bai-viet');
  revalidatePath('/cam-nang');
  redirect('/admin/bai-viet?saved=1');
}

export async function deleteArticleAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session) redirect('/');

  const id = str(formData, 'id');
  if (!id) redirect('/admin/bai-viet');

  const supabase = await createClient();
  await supabase.from('articles').delete().eq('id', id);

  revalidatePath('/admin/bai-viet');
  revalidatePath('/cam-nang');
  redirect('/admin/bai-viet?deleted=1');
}

// ------------------------------------------------------------ LUẬT GỢI Ý --

export async function saveRuleAction(
  _prevState: AdminState,
  formData: FormData
): Promise<AdminState> {
  const t = await getTranslations('admin.errors');

  const session = await requireAdmin();
  if (!session) return { error: t('notAdmin') };

  const id = nullable(formData, 'id');
  const taskTypeId = str(formData, 'task_type_id');
  const approach = str(formData, 'ai_or_rule_based');
  const priorityRaw = str(formData, 'priority');
  const conditionRaw = str(formData, 'condition_json') || '{}';

  const fieldErrors: Record<string, string> = {};
  if (!taskTypeId) fieldErrors.task_type_id = t('required');
  if (!APPROACHES.includes(approach)) fieldErrors.ai_or_rule_based = t('invalidApproach');

  const priority = Number(priorityRaw);
  if (!Number.isInteger(priority) || priority < 0) fieldErrors.priority = t('invalidPriority');

  // Validate condition_json trước khi lưu: JSON hợp lệ, rồi mới tới cấu trúc luật.
  let condition: unknown;
  try {
    condition = JSON.parse(conditionRaw);
  } catch {
    fieldErrors.condition_json = t('invalidJson');
  }

  if (!fieldErrors.condition_json) {
    const problems = validateCondition(condition);
    if (problems.length > 0) fieldErrors.condition_json = problems.join(' ');
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();

  const payload = {
    task_type_id: taskTypeId,
    condition_json: condition,
    recommended_camera: nullable(formData, 'recommended_camera'),
    recommended_lighting: nullable(formData, 'recommended_lighting'),
    recommended_lens: nullable(formData, 'recommended_lens'),
    ai_or_rule_based: approach,
    notes_vi: nullable(formData, 'notes_vi'),
    notes_en: nullable(formData, 'notes_en'),
    priority,
    is_active: formData.get('is_active') === 'on',
    code: nullable(formData, 'code'),
  };

  const { error } = id
    ? await supabase.from('selector_rules').update(payload).eq('id', id)
    : await supabase.from('selector_rules').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/admin/luat-goi-y');
  redirect('/admin/luat-goi-y?saved=1');
}

export async function deleteRuleAction(formData: FormData) {
  const session = await requireAdmin();
  if (!session) redirect('/');

  const id = str(formData, 'id');
  if (!id) redirect('/admin/luat-goi-y');

  const supabase = await createClient();
  await supabase.from('selector_rules').delete().eq('id', id);

  revalidatePath('/admin/luat-goi-y');
  redirect('/admin/luat-goi-y?deleted=1');
}
