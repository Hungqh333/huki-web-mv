import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ComponentForm } from '@/components/admin/ComponentForm';
import type { Component } from '@/lib/components/specs';
import { createClient } from '@/lib/supabase/server';

export default async function EditComponentPage({ params }: PageProps<'/admin/linh-kien/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('admin.components');

  const supabase = await createClient();
  const { data } = await supabase
    .from('components')
    .select(
      'id, code, kind, brand, model, spec, price_vnd, lead_time_days, supplier, used_in_projects, datasheet_url, source, notes_vi, notes_en, sort_order, is_active'
    )
    .eq('id', id)
    .maybeSingle<Component>();

  if (!data) notFound();

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('editTitle')}</h2>
      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{data.code}</p>
      <div className="mt-6">
        <ComponentForm
          draft={{
            id: data.id,
            code: data.code,
            kind: data.kind,
            brand: data.brand,
            model: data.model,
            spec: data.spec ?? {},
            price_vnd: data.price_vnd === null ? '' : String(data.price_vnd),
            lead_time_days: data.lead_time_days == null ? '' : String(data.lead_time_days),
            supplier: data.supplier ?? '',
            used_in_projects: String(data.used_in_projects ?? 0),
            datasheet_url: data.datasheet_url ?? '',
            source: data.source,
            notes_vi: data.notes_vi ?? '',
            notes_en: data.notes_en ?? '',
            sort_order: data.sort_order,
            is_active: data.is_active,
          }}
        />
      </div>
    </section>
  );
}
