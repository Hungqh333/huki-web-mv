'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { uploadLightingSampleAction, type SampleUploadState } from '@/app/actions/lightingSamples';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';

export type Option = { value: string; label: string };
/** Nhãn lựa chọn do trang server dựng (namespace lightSelector không có trong provider admin). */
export type SampleFormOptions = {
  targets: Option[];
  lights: Option[];
  materials: Option[];
  finishes: Option[];
  shapes: Option[];
  colors: Option[];
  lightColors: Option[];
};

function Select({ name, label, options, empty, required = false }: { name: string; label: string; options: Option[]; empty: string; required?: boolean }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select name={name} required={required} className={inputClass} defaultValue="">
        <option value="" disabled={required}>
          {empty}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Text({ name, label, placeholder, type = 'text' }: { name: string; label: string; placeholder?: string; type?: 'text' | 'number' }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input type={type} name={name} placeholder={placeholder} maxLength={type === 'text' ? 120 : undefined} min={type === 'number' ? 0 : undefined} step="any" className={inputClass} />
    </label>
  );
}

/**
 * Form tải một ảnh mẫu chiếu sáng — nhãn đúng khoá trang Chọn đèn + thông số setting chụp (chốt
 * 2026-10-23). Ô form khớp tên ô uploadLightingSampleAction đọc.
 */
export function LightingSampleForm({ options }: { options: SampleFormOptions }) {
  const t = useTranslations('admin.samples');
  const [state, formAction, pending] = useActionState<SampleUploadState, FormData>(uploadLightingSampleAction, {});
  const form = useRef<HTMLFormElement>(null);
  // Lưu xong → xoá ô file và chú thích, giữ nhãn để tải tiếp cùng nhóm.
  useEffect(() => {
    if (!state.saved || !form.current) return;
    for (const name of ['file', 'caption_vi', 'caption_en']) {
      const field = form.current.elements.namedItem(name) as HTMLInputElement | null;
      if (field) field.value = '';
    }
  }, [state]);

  return (
    <form ref={form} action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groupTask')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="target" label={t('defect')} options={options.targets} empty={t('general')} />
          <Select name="light_type" label={t('light')} options={options.lights} empty={t('choose')} required />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groupObject')}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select name="material" label={t('material')} options={options.materials} empty={t('unknown')} />
          <Select name="finish" label={t('finish')} options={options.finishes} empty={t('unknown')} />
          <Select name="shape" label={t('shape')} options={options.shapes} empty={t('unknown')} />
          <Select name="feature_color" label={t('featureColor')} options={options.colors} empty={t('unknown')} />
          <Select name="background_color" label={t('backgroundColor')} options={options.colors} empty={t('unknown')} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groupSetting')}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select name="light_color" label={t('lightColor')} options={options.lightColors} empty={t('unknown')} />
          <Text name="light_model" label={t('lightModel')} placeholder="HZ-RL9070-W" />
          <Text name="angle_note" label={t('angle')} placeholder={t('anglePlaceholder')} />
          <Text name="distance_mm" label={t('distance')} type="number" />
          <Text name="exposure_us" label={t('exposure')} type="number" />
          <Text name="camera" label={t('camera')} placeholder="mono 5 MP" />
          <Text name="lens" label={t('lens')} placeholder="f25 mm" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('groupImage')}</legend>
        <label className="block">
          <span className={labelClass}>{t('file')}</span>
          <input type="file" name="file" required accept="image/jpeg,image/png,image/webp" className={inputClass} />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t('fileHint')}</span>
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className={labelClass}>{t('source')}</span>
            <input type="text" name="source" maxLength={300} placeholder={t('sourcePlaceholder')} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('captionVi')}</span>
            <input type="text" name="caption_vi" maxLength={300} placeholder={t('captionPlaceholder')} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('captionEn')}</span>
            <input type="text" name="caption_en" maxLength={300} className={inputClass} />
          </label>
        </div>
      </fieldset>

      <button type="submit" disabled={pending} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
        {pending ? t('uploading') : t('upload')}
      </button>
    </form>
  );
}
