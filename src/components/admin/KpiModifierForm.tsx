'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { saveModifierAction, type KpiAdminState } from '@/app/actions/kpi-admin';

export type ModifierDraft = {
  id: string | null;
  slug: string;
  name_vi: string;
  name_en: string;
  factor_min: number;
  factor_max: number;
  direction: string;
  note_vi: string;
  note_en: string;
  data_source: string;
  sort_order: number;
  is_active: boolean;
};

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function KpiModifierForm({ draft }: { draft: ModifierDraft }) {
  const t = useTranslations('admin.kpi.modifiers');
  const tSource = useTranslations('admin.kpi.dataSource');

  const [state, formAction, pending] = useActionState<KpiAdminState, FormData>(
    saveModifierAction,
    {}
  );

  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="space-y-6">
      {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fieldSlug')} error={err('slug')}>
          <input name="slug" defaultValue={draft.slug} required className={inputClass} />
        </Field>

        <Field label={t('fieldDirection')} error={err('direction')} hint={t('directionHint')}>
          <select name="direction" defaultValue={draft.direction} className={inputClass}>
            <option value="worse">{t('worse')}</option>
            <option value="better">{t('better')}</option>
          </select>
        </Field>

        <Field label={t('fieldNameVi')} error={err('name_vi')}>
          <input name="name_vi" defaultValue={draft.name_vi} required className={inputClass} />
        </Field>

        <Field label={t('fieldNameEn')} error={err('name_en')}>
          <input name="name_en" defaultValue={draft.name_en} required className={inputClass} />
        </Field>

        <Field label={t('fieldFactorMin')} error={err('factor_min')}>
          <input
            name="factor_min"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={draft.factor_min}
            className={inputClass}
          />
        </Field>

        <Field label={t('fieldFactorMax')} error={err('factor_max')}>
          <input
            name="factor_max"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={draft.factor_max}
            className={inputClass}
          />
        </Field>

        <Field label={t('fieldDataSource')}>
          <select name="data_source" defaultValue={draft.data_source} className={inputClass}>
            {['estimate', 'project_history', 'vendor_spec'].map((value) => (
              <option key={value} value={value}>
                {tSource(value)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fieldSortOrder')}>
          <input
            name="sort_order"
            type="number"
            step={10}
            defaultValue={draft.sort_order}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fieldNoteVi')}>
          <textarea name="note_vi" rows={3} defaultValue={draft.note_vi} className={inputClass} />
        </Field>
        <Field label={t('fieldNoteEn')}>
          <textarea name="note_en" rows={3} defaultValue={draft.note_en} className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={draft.is_active}
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
        />
        {t('activeLabel')}
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? t('saving') : t('save')}
        </button>
        <Link
          href="/admin/chi-tieu/he-so"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('cancel')}
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {children}
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
