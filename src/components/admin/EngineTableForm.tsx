'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { PanelHeader } from '@/components/ui/PanelHeader';
import {
  saveDefaultsTableAction,
  saveLightColorTableAction,
  saveLightMatrixTableAction,
  saveLightingTableAction,
  type EngineTableState,
} from '@/app/actions/admin';
import { FIELD_DEFAULTS } from '@/lib/requirement/defaults';
import { DEFAULT_LIGHTING_ROWS } from '@/lib/vision/lighting';
import {
  COLOR_ROW_KEYS,
  MATRIX_ROW_KEYS,
  DEFAULT_ENGINE_TABLES,
  DEFAULT_ROW_DEFS,
  LIGHT_TYPES,
  LIGHTING_ROW_KEYS,
  TABLE_TEXT_MAX,
  type EngineTableKey,
  type EngineTables,
} from '@/lib/vision/engineTables';
import { LIGHT_COLORS, REFLECTANCE_LEVELS, isReflectanceKey, type ColorRow, type Reflectance } from '@/lib/vision/lightColor';
import { LIGHT_TYPES_V2 } from '@/lib/vision/lightOptions';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';

/**
 * Form bảng chiếu sáng / giả định mặc định (chốt 2026-10-16, đợt 2). Mỗi dòng là
 * một khung; ô câu chữ để trống = dùng câu mặc định (hiện làm chữ mờ trong ô).
 * Ô form tên `${dòng}__${trường}` — saveEngineTable đọc đúng tên này.
 */
export function EngineTableForm({
  table,
  current,
  stored,
  rejected,
  defaultReasons = {},
  rowLabels = {},
}: {
  /** Nhãn dòng do trang server dựng (bảng của trang Chọn đèn: ghép tên lỗi, bề mặt, bài toán). */
  rowLabels?: Record<string, string>;
  /** Câu lý do chiếu sáng mặc định theo dòng, đủ vi/en (trang server lấy từ messages của cả hai ngôn ngữ). */
  defaultReasons?: Partial<Record<string, { vi: string; en: string }>>;
  table: EngineTableKey;
  current: EngineTables;
  stored: Record<string, { updatedBy: string | null; updatedAt: string }>;
  /** Dòng đang lưu bị bỏ vì không hợp lệ. */
  rejected: string[];
}) {
  const t = useTranslations('admin.tables');
  const tReason = useTranslations('selector.vision.lightingReason');
  const tOptions = useTranslations('designer.requirement.options');
  const [state, formAction, pending] = useActionState<EngineTableState, FormData>(
    table === 'lighting'
      ? saveLightingTableAction
      : table === 'lightColor'
        ? saveLightColorTableAction
        : table === 'lightMatrix'
          ? saveLightMatrixTableAction
          : saveDefaultsTableAction,
    {}
  );

  const meta = (row: string) => {
    const info = stored[`${table}.${row}`];
    return info?.updatedBy ? t('updatedBy', { name: info.updatedBy }) : null;
  };
  const rowError = (row: string) => state.fieldErrors?.[row];

  const rowFrame = (row: string, title: string, changed: boolean, body: React.ReactNode) => (
    <fieldset key={row} className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <legend className="sr-only">{title}</legend>
      <PanelHeader
        as="h3"
        title={
          <>
            {title}
            {changed ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                {t('changed')}
              </span>
            ) : null}
          </>
        }
        meta={meta(row)}
        note={
          rejected.includes(row) ? <span className="text-amber-700 dark:text-amber-400">{t('rowRejected')}</span> : undefined
        }
      />
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {body}
        {rowError(row) ? <p className="text-xs text-red-600 dark:text-red-400">{rowError(row)}</p> : null}
      </div>
    </fieldset>
  );

  const textPair = (row: string, fields: [string, string], values: [string | null, string | null], defaults: [string, string]) => (
    <div className="grid gap-3 md:grid-cols-2">
      {(['vi', 'en'] as const).map((lang, i) => (
        <label key={lang} className="block">
          <span className={labelClass}>{t(`text.${lang}`)}</span>
          <textarea
            name={`${row}__${fields[i]}`}
            defaultValue={values[i] ?? ''}
            placeholder={defaults[i]}
            maxLength={TABLE_TEXT_MAX}
            rows={3}
            className={inputClass}
          />
        </label>
      ))}
    </div>
  );

  return (
    <form action={formAction} className="space-y-6">
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

      {table === 'lightColor' ? (
        <LightColorEditor current={current} rowLabels={rowLabels} rejected={rejected} rowError={rowError} />
      ) : table === 'lightMatrix' ? (
        <LightMatrixEditor current={current} rowLabels={rowLabels} rejected={rejected} rowError={rowError} />
      ) : table === 'lighting'
        ? LIGHTING_ROW_KEYS.map((row) => {
            const value = current.lighting[row];
            const base = DEFAULT_ENGINE_TABLES.lighting[row];
            const changed = JSON.stringify(value) !== JSON.stringify(base);
            const fallback = tReason(DEFAULT_LIGHTING_ROWS[row].reasonKey as never);
            const defaultReason = defaultReasons[row] ?? { vi: fallback, en: fallback };
            return rowFrame(
              row,
              t(`lighting.rows.${row}`),
              changed,
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{t('lighting.lightType')}</span>
                    <select name={`${row}__lightType`} defaultValue={value.lightType} className={inputClass}>
                      {LIGHT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`lightTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>{t('lighting.alternativeType')}</span>
                    <select name={`${row}__alternativeType`} defaultValue={value.alternativeType ?? ''} className={inputClass}>
                      <option value="">{t('lighting.none')}</option>
                      {LIGHT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`lightTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('defaultIs', {
                    value: base.alternativeType
                      ? `${t(`lightTypes.${base.lightType}`)} / ${t(`lightTypes.${base.alternativeType}`)}`
                      : t(`lightTypes.${base.lightType}`),
                  })}
                </p>
                {textPair(row, ['reasonVi', 'reasonEn'], [value.reasonVi, value.reasonEn], [defaultReason.vi, defaultReason.en])}
              </>
            );
          })
        : DEFAULT_ROW_DEFS.map((def) => {
            const value = current.defaults[def.key];
            const base = DEFAULT_ENGINE_TABLES.defaults[def.key];
            const changed = JSON.stringify(value) !== JSON.stringify(base);
            const basis = FIELD_DEFAULTS.find((d) => d.path === def.path)!.basis;
            // Khoá dòng lựa chọn trùng khoá nhãn: contrast / motion / triggerSource.
            const optionLabel = (option: string) => tOptions(`${def.key}.${option}` as never);
            return rowFrame(
              def.key,
              t(`defaults.rows.${def.key}`),
              changed,
              <>
                <label className="block sm:max-w-xs">
                  <span className={labelClass}>
                    {t('defaults.value')}
                    {'unit' in def ? ` (${def.unit})` : ''}
                  </span>
                  {def.kind === 'number' ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      name={`${def.key}__value`}
                      defaultValue={String(value.value)}
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      className={`${inputClass} tabular-nums`}
                    />
                  ) : (
                    <select name={`${def.key}__value`} defaultValue={String(value.value)} className={inputClass}>
                      {def.options.map((option) => (
                        <option key={option} value={option}>
                          {optionLabel(option)}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('defaultIs', { value: def.kind === 'number' ? `${base.value} ${'unit' in def ? def.unit : ''}` : optionLabel(String(base.value)) })}
                  {def.kind === 'number' ? ` · ${t('range', { min: def.min, max: def.max })}` : ''}
                </p>
                {textPair(def.key, ['basisVi', 'basisEn'], [value.basisVi, value.basisEn], [basis.vi, basis.en])}
              </>
            );
          })}

      <p className="text-xs text-slate-500 dark:text-slate-400">{t('versionNote')}</p>
      <button type="submit" disabled={pending} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}

/* ── Bảng của trang Chọn đèn (chốt 2026-10-22): dạng bảng gọn, mỗi dòng một hàng ── */

const cellSelect =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const changedBadge = 'rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';

type EditorProps = {
  current: EngineTables;
  rowLabels: Record<string, string>;
  rejected: string[];
  rowError: (row: string) => string | undefined;
};

function RowNote({ row, rejected, rowError }: { row: string; rejected: string[]; rowError: EditorProps['rowError'] }) {
  const t = useTranslations('admin.tables');
  const error = rowError(row);
  if (error) return <span className="text-xs text-red-600 dark:text-red-400">{error}</span>;
  return rejected.includes(row) ? <span className="text-xs text-amber-700 dark:text-amber-400">{t('rowRejected')}</span> : null;
}

function LightColorEditor({ current, rowLabels, rejected, rowError }: EditorProps) {
  const t = useTranslations('admin.tables');
  const colorName = (color: string) => t(`lightColors.${color}`);
  const refl = COLOR_ROW_KEYS.filter(isReflectanceKey);
  const special = COLOR_ROW_KEYS.filter((k) => !isReflectanceKey(k));
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="py-2 pl-4 pr-3 font-medium">{t('lightColor.colColor')}</th>
              {(['r', 'g', 'b'] as const).map((ch) => (
                <th key={ch} className="py-2 pr-3 font-medium">{t(`lightColor.channel.${ch}`)}</th>
              ))}
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {refl.map((row) => {
              const value = current.lightColor[row] as Reflectance;
              const base = DEFAULT_ENGINE_TABLES.lightColor[row] as Reflectance;
              return (
                <tr key={row}>
                  <td className="py-1.5 pl-4 pr-3">{rowLabels[row] ?? row}</td>
                  {(['r', 'g', 'b'] as const).map((ch) => (
                    <td key={ch} className="py-1.5 pr-3">
                      <select name={`${row}__${ch}`} defaultValue={String(value[ch])} className={cellSelect} aria-label={`${rowLabels[row] ?? row} ${ch}`}>
                        {REFLECTANCE_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {t(`lightColor.level.${level}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className="py-1.5 pr-4 text-xs">
                    {JSON.stringify(value) !== JSON.stringify(base) ? <span className={changedBadge}>{t('changed')}</span> : null}{' '}
                    <RowNote row={row} rejected={rejected} rowError={rowError} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PairTable
        rows={special}
        rowLabels={rowLabels}
        value={(row) => {
          const v = current.lightColor[row as (typeof special)[number]] as ColorRow;
          return [v.color, v.alternative];
        }}
        base={(row) => {
          const v = DEFAULT_ENGINE_TABLES.lightColor[row as (typeof special)[number]] as ColorRow;
          return [v.color, v.alternative];
        }}
        options={LIGHT_COLORS}
        optionName={colorName}
        fields={['color', 'alternative']}
        headers={[t('lightColor.color'), t('lightColor.alternative')]}
        rejected={rejected}
        rowError={rowError}
      />
    </div>
  );
}

/** Nhóm dòng bảng kiểu đèn theo tiền tố khoá: thứ tự xét / ma trận / bài toán khác. */
const MATRIX_GROUPS = [
  { key: 'overrides', prefix: 'ovr_' },
  { key: 'matrix', prefix: 'm_' },
  { key: 'tasks', prefix: 't_' },
] as const;

function LightMatrixEditor({ current, rowLabels, rejected, rowError }: EditorProps) {
  const t = useTranslations('admin.tables');
  return (
    <div className="space-y-6">
      {MATRIX_GROUPS.map((group) => (
        <div key={group.key}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t(`lightMatrix.groups.${group.key}`)}</h3>
          <PairTable
            rows={MATRIX_ROW_KEYS.filter((k) => k.startsWith(group.prefix))}
            rowLabels={rowLabels}
            value={(row) => {
              const v = current.lightMatrix[row as (typeof MATRIX_ROW_KEYS)[number]];
              return [v.lightType, v.alternativeType];
            }}
            base={(row) => {
              const v = DEFAULT_ENGINE_TABLES.lightMatrix[row as (typeof MATRIX_ROW_KEYS)[number]];
              return [v.lightType, v.alternativeType];
            }}
            options={LIGHT_TYPES_V2}
            optionName={(type) => t(`lightTypes.${type}`)}
            fields={['lightType', 'alternativeType']}
            headers={[t('lighting.lightType'), t('lighting.alternativeType')]}
            rejected={rejected}
            rowError={rowError}
          />
        </div>
      ))}
    </div>
  );
}

/** Bảng "chính / thay thế" — mỗi dòng hai ô chọn. Ô form tên `${dòng}__${trường}`. */
function PairTable({
  rows,
  rowLabels,
  value,
  base,
  options,
  optionName,
  fields,
  headers,
  rejected,
  rowError,
}: {
  rows: readonly string[];
  rowLabels: Record<string, string>;
  value: (row: string) => [string, string | null];
  base: (row: string) => [string, string | null];
  options: readonly string[];
  optionName: (option: string) => string;
  fields: [string, string];
  headers: [string, string];
  rejected: string[];
  rowError: EditorProps['rowError'];
}) {
  const t = useTranslations('admin.tables');
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="py-2 pl-4 pr-3 font-medium">{t('lightMatrix.colRow')}</th>
            <th className="py-2 pr-3 font-medium">{headers[0]}</th>
            <th className="py-2 pr-3 font-medium">{headers[1]}</th>
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const [main, alt] = value(row);
            const [baseMain, baseAlt] = base(row);
            return (
              <tr key={row}>
                <td className="py-1.5 pl-4 pr-3">{rowLabels[row] ?? row}</td>
                <td className="py-1.5 pr-3">
                  <select name={`${row}__${fields[0]}`} defaultValue={main} className={cellSelect} aria-label={`${rowLabels[row] ?? row}: ${headers[0]}`}>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {optionName(o)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-3">
                  <select name={`${row}__${fields[1]}`} defaultValue={alt ?? ''} className={cellSelect} aria-label={`${rowLabels[row] ?? row}: ${headers[1]}`}>
                    <option value="">{t('lighting.none')}</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {optionName(o)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-4 text-xs">
                  {main !== baseMain || alt !== baseAlt ? <span className={changedBadge}>{t('changed')}</span> : null}{' '}
                  <RowNote row={row} rejected={rejected} rowError={rowError} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
