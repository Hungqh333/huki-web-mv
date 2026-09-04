'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionContext, isAdmin } from '@/lib/auth';
import { dbError } from '@/lib/db-error';
import {
  buildSpec,
  COMPONENT_KINDS,
  COMPONENT_SOURCES,
  type ComponentKind,
  type ComponentSource,
} from '@/lib/components/specs';
import { createClient } from '@/lib/supabase/server';

export type ComponentState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

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

export async function saveComponentAction(
  _prevState: ComponentState,
  formData: FormData
): Promise<ComponentState> {
  const t = await getTranslations('admin.components.errors');

  if (!(await requireAdmin())) return { error: t('notAdmin') };

  const id = nullable(formData, 'id');
  const fieldErrors: Record<string, string> = {};

  const code = str(formData, 'code');
  // Mã là khoá tự nhiên để seed và nhập Excel chạy lại được — phải chặt chẽ.
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) fieldErrors.code = t('invalidCode');

  const kind = str(formData, 'kind') as ComponentKind;
  if (!COMPONENT_KINDS.includes(kind)) fieldErrors.kind = t('invalidKind');

  const source = str(formData, 'source') as ComponentSource;
  if (!COMPONENT_SOURCES.includes(source)) fieldErrors.source = t('invalidSource');

  if (!str(formData, 'brand')) fieldErrors.brand = t('required');
  if (!str(formData, 'model')) fieldErrors.model = t('required');

  const sortOrder = Number(str(formData, 'sort_order') || '0');
  if (!Number.isInteger(sortOrder)) fieldErrors.sort_order = t('invalidNumber');

  const priceRaw = str(formData, 'price_vnd');
  let price: number | null = null;
  if (priceRaw !== '') {
    // Ô giá nhận dấu phân cách nghìn kiểu Việt Nam ("12.500.000").
    const digits = priceRaw.replace(/\D/g, '');
    price = digits === '' ? null : Number(digits);
    if (price !== null && !Number.isFinite(price)) fieldErrors.price_vnd = t('invalidNumber');
  }

  // Dựng spec theo đúng loại đã chọn — khoá của loại khác bị bỏ hẳn.
  const { spec, missing } = COMPONENT_KINDS.includes(kind)
    ? buildSpec(kind, (key) => {
        const values = formData.getAll(`spec_${key}`);
        if (values.length > 1) return values.filter((v): v is string => typeof v === 'string');
        const single = values[0];
        return typeof single === 'string' ? single : null;
      })
    : { spec: {}, missing: [] };

  for (const key of missing) fieldErrors[`spec_${key}`] = t('required');

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const payload = {
    code,
    kind,
    brand: str(formData, 'brand'),
    model: str(formData, 'model'),
    spec,
    price_vnd: price,
    datasheet_url: nullable(formData, 'datasheet_url'),
    source,
    notes_vi: nullable(formData, 'notes_vi'),
    notes_en: nullable(formData, 'notes_en'),
    sort_order: sortOrder,
    is_active: formData.get('is_active') === 'on',
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('components').update(payload).eq('id', id)
    : await supabase.from('components').insert(payload);

  if (error) return { error: await dbError(error, 'saveComponent') };

  revalidatePath('/admin/linh-kien');
  redirect('/admin/linh-kien?saved=1');
}

export async function deleteComponentAction(formData: FormData) {
  if (!(await requireAdmin())) redirect('/');

  const id = str(formData, 'id');
  if (!id) redirect('/admin/linh-kien');

  const supabase = await createClient();
  await supabase.from('components').delete().eq('id', id);

  revalidatePath('/admin/linh-kien');
  redirect('/admin/linh-kien?deleted=1');
}
