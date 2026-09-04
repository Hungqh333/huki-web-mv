'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminField } from './AdminField';
import { saveComponentAction, type ComponentState } from '@/app/actions/components';
import {
  COMPONENT_KINDS,
  COMPONENT_SOURCES,
  SPEC_FIELDS,
  type ComponentKind,
} from '@/lib/components/specs';

export type ComponentDraft = {
  id: string | null;
  code: string;
  kind: ComponentKind;
  brand: string;
  model: string;
  spec: Record<string, unknown>;
  price_vnd: string;
  datasheet_url: string;
  source: string;
  notes_vi: string;
  notes_en: string;
  sort_order: number;
  is_active: boolean;
};

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function ComponentForm({ draft }: { draft: ComponentDraft }) {
  const t = useTranslations('admin.components');
  const tSpec = useTranslations('admin.components.spec');

  const [state, formAction, pending] = useActionState<ComponentState, FormData>(
    saveComponentAction,
    {}
  );

  // Đổi loại thì bộ ô thông số đổi theo — camera và đèn không dùng chung khoá nào.
  const [kind, setKind] = useState<ComponentKind>(draft.kind);

  const err = (key: string) => state.fieldErrors?.[key];

  /** Giá trị cũ chỉ dùng lại khi vẫn đang ở đúng loại ban đầu. */
  const specValue = (key: string): string => {
    if (kind !== draft.kind) return '';
    const value = draft.spec[key];
    if (value === undefined || value === null) return '';
    return Array.isArray(value) ? value.join(',') : String(value);
  };

  const specList = (key: string): string[] => {
    if (kind !== draft.kind) return [];
    const value = draft.spec[key];
    return Array.isArray(value) ? value.map(String) : [];
  };

  return (
    <form action={formAction} className="space-y-6">
      {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label={t('fieldCode')} error={err('code')} hint={t('codeHint')}>
          <input name="code" defaultValue={draft.code} required className={inputClass} />
        </AdminField>

        <AdminField label={t('fieldKind')} error={err('kind')}>
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as ComponentKind)}
            className={inputClass}
          >
            {COMPONENT_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`kinds.${value}`)}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField label={t('fieldBrand')} error={err('brand')}>
          <input name="brand" defaultValue={draft.brand} required className={inputClass} />
        </AdminField>

        <AdminField label={t('fieldModel')} error={err('model')}>
          <input name="model" defaultValue={draft.model} required className={inputClass} />
        </AdminField>
      </div>

      {/* Thông số kỹ thuật — đổi theo loại linh kiện */}
      <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-semibold">{t('specSection')}</legend>

        {SPEC_FIELDS[kind].length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('specNone')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {SPEC_FIELDS[kind].map((field) => {
              const name = `spec_${field.key}`;
              const label = `${tSpec(field.key)}${field.unit ? ` (${field.unit})` : ''}`;

              if (field.type === 'multiselect') {
                const selected = specList(field.key);
                return (
                  <AdminField key={field.key} label={label} error={err(name)}>
                    <div className="flex flex-wrap gap-3 py-1.5">
                      {(field.options ?? []).map((option) => (
                        <label key={option} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            name={name}
                            value={option}
                            defaultChecked={selected.includes(option)}
                            className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </AdminField>
                );
              }

              if (field.type === 'select') {
                return (
                  <AdminField key={field.key} label={label} error={err(name)}>
                    <select
                      name={name}
                      defaultValue={specValue(field.key)}
                      className={inputClass}
                      // key ép React dựng lại select khi đổi loại, nếu không
                      // defaultValue cũ sẽ dính lại.
                      key={`${kind}-${field.key}`}
                    >
                      <option value="">—</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                );
              }

              return (
                <AdminField key={field.key} label={label} error={err(name)}>
                  <input
                    key={`${kind}-${field.key}`}
                    name={name}
                    type={field.type === 'number' ? 'number' : 'text'}
                    step={field.step}
                    defaultValue={specValue(field.key)}
                    className={inputClass}
                  />
                </AdminField>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label={t('fieldSource')} error={err('source')} hint={t('sourceHint')}>
          <select name="source" defaultValue={draft.source} className={inputClass}>
            {COMPONENT_SOURCES.map((value) => (
              <option key={value} value={value}>
                {t(`sources.${value}`)}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField label={t('fieldPrice')} error={err('price_vnd')} hint={t('priceHint')}>
          <input
            name="price_vnd"
            inputMode="numeric"
            defaultValue={draft.price_vnd}
            className={inputClass}
          />
        </AdminField>

        <AdminField label={t('fieldDatasheet')}>
          <input
            name="datasheet_url"
            type="url"
            defaultValue={draft.datasheet_url}
            className={inputClass}
          />
        </AdminField>

        <AdminField label={t('fieldSortOrder')} error={err('sort_order')}>
          <input
            name="sort_order"
            type="number"
            step={10}
            defaultValue={draft.sort_order}
            className={inputClass}
          />
        </AdminField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label={t('fieldNotesVi')}>
          <textarea name="notes_vi" rows={3} defaultValue={draft.notes_vi} className={inputClass} />
        </AdminField>
        <AdminField label={t('fieldNotesEn')}>
          <textarea name="notes_en" rows={3} defaultValue={draft.notes_en} className={inputClass} />
        </AdminField>
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
          href="/admin/linh-kien"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('cancel')}
        </Link>
      </div>
    </form>
  );
}
