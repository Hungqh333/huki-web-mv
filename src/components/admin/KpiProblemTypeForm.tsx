'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { saveProblemTypeAction, type KpiAdminState } from '@/app/actions/kpi-admin';

export type ProblemTypeDraft = {
  id: string | null;
  slug: string;
  problem_group: string;
  level: number;
  name_vi: string;
  name_en: string;
  miss_min: number;
  miss_max: number;
  false_reject_week1_min: number;
  false_reject_week1_max: number;
  false_reject_min: number;
  false_reject_max: number;
  recheck_min: number;
  recheck_max: number;
  total_burden_max: number;
  ramp_up_weeks_min: number;
  ramp_up_weeks_max: number;
  deep_learning: string;
  special_kpi: string;
  note_vi: string;
  note_en: string;
  data_source: string;
  calibration_note_vi: string;
  calibration_note_en: string;
  sort_order: number;
  is_active: boolean;
};

const GROUPS = ['presence', 'metrology', 'code', 'process', 'cosmetic'];
const DEEP_LEARNING = ['no', 'sometimes', 'often', 'required'];
const SPECIAL = ['robot_guidance', 'code_reading', 'web_inspection'];
const DATA_SOURCES = ['estimate', 'project_history', 'vendor_spec'];

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function KpiProblemTypeForm({ draft }: { draft: ProblemTypeDraft }) {
  const t = useTranslations('admin.kpi.problemTypes');
  const tGroup = useTranslations('kpi.groups');
  const tDl = useTranslations('kpi.deepLearning');
  const tSource = useTranslations('admin.kpi.dataSource');

  const [state, formAction, pending] = useActionState<KpiAdminState, FormData>(
    saveProblemTypeAction,
    {}
  );
  const [dataSource, setDataSource] = useState(draft.data_source);

  const err = (key: string) => state.fieldErrors?.[key];

  const numberField = (key: keyof ProblemTypeDraft, label: string, step = '0.001') => (
    <Field label={label} error={err(key)}>
      <input
        name={key}
        type="number"
        min={0}
        step={step}
        defaultValue={String(draft[key])}
        className={inputClass}
      />
    </Field>
  );

  const rangeRow = (
    label: string,
    minKey: keyof ProblemTypeDraft,
    maxKey: keyof ProblemTypeDraft
  ) => (
    <div className="grid grid-cols-2 gap-3">
      {numberField(minKey, `${label} — ${t('min')}`)}
      {numberField(maxKey, `${label} — ${t('max')}`)}
    </div>
  );

  return (
    <form action={formAction} className="space-y-8">
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

        <Field label={t('fieldGroup')} error={err('problem_group')}>
          <select name="problem_group" defaultValue={draft.problem_group} className={inputClass}>
            {GROUPS.map((group) => (
              <option key={group} value={group}>
                {tGroup(group)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fieldNameVi')} error={err('name_vi')}>
          <input name="name_vi" defaultValue={draft.name_vi} required className={inputClass} />
        </Field>

        <Field label={t('fieldNameEn')} error={err('name_en')}>
          <input name="name_en" defaultValue={draft.name_en} required className={inputClass} />
        </Field>

        <Field label={t('fieldLevel')} error={err('level')} hint={t('levelHint')}>
          <input
            name="level"
            type="number"
            min={1}
            max={7}
            step={1}
            defaultValue={draft.level}
            className={inputClass}
          />
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

      <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-semibold">{t('targetsSection')}</legend>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('targetsHint')}</p>

        {rangeRow(t('fieldMiss'), 'miss_min', 'miss_max')}
        {rangeRow(t('fieldFrWeek1'), 'false_reject_week1_min', 'false_reject_week1_max')}
        {rangeRow(t('fieldFr'), 'false_reject_min', 'false_reject_max')}
        {rangeRow(t('fieldRecheck'), 'recheck_min', 'recheck_max')}

        <Field
          label={t('fieldBurdenMax')}
          error={err('total_burden_max')}
          hint={t('burdenHint')}
        >
          <input
            name="total_burden_max"
            type="number"
            min={0}
            step="0.001"
            defaultValue={draft.total_burden_max}
            className={inputClass}
          />
        </Field>

        {rangeRow(t('fieldRampUp'), 'ramp_up_weeks_min', 'ramp_up_weeks_max')}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fieldDeepLearning')} error={err('deep_learning')}>
          <select name="deep_learning" defaultValue={draft.deep_learning} className={inputClass}>
            {DEEP_LEARNING.map((value) => (
              <option key={value} value={value}>
                {tDl(value)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fieldSpecialKpi')} error={err('special_kpi')} hint={t('specialHint')}>
          <select name="special_kpi" defaultValue={draft.special_kpi} className={inputClass}>
            <option value="">—</option>
            {SPECIAL.map((value) => (
              <option key={value} value={value}>
                {t(`special.${value}`)}
              </option>
            ))}
          </select>
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

      {/*
        Khối hiệu chỉnh. Đây là chỗ biến con số ước lượng thành số liệu thật của
        công ty — mục tiêu dài hạn của cả module. Đặt nổi bật thay vì giấu vào
        một góc, và nhắc rõ đổi nhãn sau khi đối chiếu với dự án đã làm.
      */}
      <fieldset className="space-y-4 rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
        <legend className="px-1 text-sm font-semibold">{t('calibrationSection')}</legend>
        <p className="text-xs text-sky-900/80 dark:text-sky-300/80">{t('calibrationHint')}</p>

        <Field label={t('fieldDataSource')} error={err('data_source')}>
          <select
            name="data_source"
            value={dataSource}
            onChange={(event) => setDataSource(event.target.value)}
            className={inputClass}
          >
            {DATA_SOURCES.map((value) => (
              <option key={value} value={value}>
                {tSource(value)}
              </option>
            ))}
          </select>
        </Field>

        {dataSource !== 'estimate' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fieldCalibrationVi')} hint={t('calibrationNoteHint')}>
              <textarea
                name="calibration_note_vi"
                rows={3}
                defaultValue={draft.calibration_note_vi}
                className={inputClass}
              />
            </Field>
            <Field label={t('fieldCalibrationEn')}>
              <textarea
                name="calibration_note_en"
                rows={3}
                defaultValue={draft.calibration_note_en}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}
      </fieldset>

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
          href="/admin/chi-tieu"
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
