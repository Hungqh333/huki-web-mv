'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { APPLICATION_SHORTCUT_ORDER, type ApplicationType } from '@/lib/visionEntry';
import {
  REQUIREMENT_SECTIONS,
  V1A_FIELDS,
  V1A_FULL_SUPPORT,
  changeApplicationType,
  countFilled,
  emptyRequirement,
  fieldsFor,
  readField,
  withFieldValue,
  type RequirementFieldDef,
} from '@/lib/requirement/fields';
import {
  isApplicationType,
  parseDraft,
  startDraftFromApp,
  type RequirementDraft,
} from '@/lib/requirement/draft';
import { readDraftRaw, subscribeDraft, writeDraft } from '@/lib/requirement/draftStore';
import { resolveAssumptions } from '@/lib/requirement/assumptions';
import type { Assumption, Confidence } from '@/lib/requirement/types';

/**
 * Bảng tóm tắt yêu cầu — spec V1.1 §10.2 "Tôi hiểu bài toán của bạn".
 *
 * Mỗi dòng: thông số | ô sửa được | badge confidence. Sửa một ô thì ô đó thành
 * "Đã nêu". Chưa có parser (V1a hạng mục 3) nên mọi ô bắt đầu ở "Chưa có".
 * Bản nháp nằm ở sessionStorage; chưa lưu database (hạng mục 7).
 *
 * Panel Assumptions (hạng mục 6) ở cột phải, dính khi cuộn. Giả định áp lúc
 * hiển thị, không ghi vào bản nháp; panel chỉ đọc — muốn thay giả định thì nhập
 * số thật trong bảng.
 */

// Cùng class với ô nhập trong Field.tsx.
const INPUT_CLASS =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

const BADGE_CLASS: Record<Confidence, string> = {
  stated: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  inferred: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  assumed: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const EMPTY_DRAFT: RequirementDraft = {
  version: 1,
  startedFrom: 'manual',
  rawText: null,
  requirement: null,
  revision: 0,
};

const inputId = (path: string) => `req-${path.replace(/\./g, '-')}`;

/** Panel bấm "Sửa trong bảng" → cuộn tới ô đó và đặt con trỏ vào. */
function focusField(path: string) {
  const element = document.getElementById(inputId(path));
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

export function RequirementSummary({ initialApp }: { initialApp: ApplicationType | null }) {
  const t = useTranslations('designer.requirement');
  const tApps = useTranslations('home.entry.apps');

  const raw = useSyncExternalStore(subscribeDraft, readDraftRaw, () => null);
  const stored = useMemo(() => parseDraft(raw), [raw]);

  /* Vào từ thẻ (?app=) mà bản nháp chưa bắt đầu từ đúng thẻ đó → bản nháp mới
     cho loại này. Đã áp rồi thì thôi, để người dùng đổi loại không bị kéo lại. */
  const draft =
    initialApp && stored?.startedFrom !== `app:${initialApp}` ? startDraftFromApp(initialApp) : stored;

  useEffect(() => {
    /* Đọc thẳng storage, KHÔNG dùng `stored`: effect đầu tiên chạy ngay sau
       hydrate, lúc `stored` còn là snapshot phía server (null). Dùng nó thì
       tải lại trang sẽ ghi đè bản nháp đang có bằng bản rỗng. */
    const current = parseDraft(readDraftRaw());
    if (initialApp && current?.startedFrom !== `app:${initialApp}`) {
      writeDraft(startDraftFromApp(initialApp));
    }
  }, [initialApp, stored]);

  const base = draft ?? EMPTY_DRAFT;
  const requirement = base.requirement;
  // Ô số/chữ không điều khiển: vẽ lại khi đổi loại, làm lại, hoặc lúc bản nháp
  // đã lưu vừa đọc xong sau hydrate.
  const mountKey = `${base.revision}-${raw !== null}`;

  // Bản đã điền mặc định — CHỈ để hiển thị. Mọi thao tác ghi vẫn trên `requirement`.
  const resolved = useMemo(() => (requirement ? resolveAssumptions(requirement) : null), [requirement]);

  const onPickApp = (value: string) => {
    if (!isApplicationType(value)) return;
    writeDraft({ ...base, requirement: changeApplicationType(requirement, value), revision: base.revision + 1 });
  };
  const onValue = (path: string, value: unknown) => {
    if (!requirement) return;
    writeDraft({ ...base, requirement: withFieldValue(requirement, path, value) });
  };
  const onReset = () => {
    if (!requirement) return;
    writeDraft({
      ...base,
      requirement: emptyRequirement(requirement.applicationType, requirement.id),
      revision: base.revision + 1,
    });
  };

  const defs = requirement ? fieldsFor(requirement.applicationType) : [];
  const progress = requirement ? countFilled(requirement) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {base.rawText ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-sm font-semibold">{t('rawTextTitle')}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {base.rawText}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('rawTextNote')}</p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <label htmlFor="application-type" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('applicationType')}
          </label>
          <select
            id="application-type"
            value={requirement?.applicationType ?? ''}
            onChange={(event) => onPickApp(event.target.value)}
            className={`mt-2 sm:max-w-sm ${INPUT_CLASS}`}
          >
            <option value="" disabled>
              {t('pickApplication')}
            </option>
            {APPLICATION_SHORTCUT_ORDER.map((type) => (
              <option key={type} value={type}>
                {tApps(`${type}.title`)}
              </option>
            ))}
          </select>

          {requirement && !V1A_FULL_SUPPORT.includes(requirement.applicationType) ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {t('partialSupport')}
            </p>
          ) : null}
          {progress ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('progress', progress)}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('pickApplicationHint')}</p>
          )}
        </div>

        {requirement && resolved
          ? REQUIREMENT_SECTIONS.map((section) => {
              const sectionDefs = defs.filter((def) => def.section === section);
              if (sectionDefs.length === 0) return null;
              return (
                <section
                  key={section}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold sm:px-5 dark:border-slate-800">
                    {t(`sections.${section}`)}
                  </h2>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sectionDefs.map((def) => {
                      const field = readField(requirement, def.path);
                      const shown = readField(resolved.requirement, def.path);
                      const confidence = shown?.confidence ?? 'unknown';
                      const id = inputId(def.path);
                      const label = (
                        <>
                          {t(`fields.${def.section}.${def.key}`)}
                          {def.unit ? (
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({def.unit})</span>
                          ) : null}
                        </>
                      );
                      return (
                        <li
                          key={def.path}
                          className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_6.5rem] sm:gap-4 sm:px-5"
                        >
                          {def.kind === 'multiselect' ? (
                            <span id={`${id}-label`} className="text-sm text-slate-700 dark:text-slate-300">
                              {label}
                            </span>
                          ) : (
                            <label htmlFor={id} className="text-sm text-slate-700 dark:text-slate-300">
                              {label}
                            </label>
                          )}
                          <FieldInput
                            key={`${def.path}-${mountKey}`}
                            id={id}
                            def={def}
                            value={field?.value ?? null}
                            assumedValue={confidence === 'assumed' ? (shown?.value ?? null) : null}
                            onChange={(value) => onValue(def.path, value)}
                          />
                          <span
                            className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium sm:justify-self-end ${BADGE_CLASS[confidence]}`}
                          >
                            {confidence === 'assumed' ? <span aria-hidden="true">⚠ </span> : null}
                            {t(`confidence.${confidence}`)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          : null}

        {requirement ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('reset')}
            </button>
          </div>
        ) : null}
      </div>

      {resolved ? (
        <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <AssumptionsPanel assumptions={resolved.assumptions} />
        </aside>
      ) : null}
    </div>
  );
}

function AssumptionsPanel({ assumptions }: { assumptions: Assumption[] }) {
  const t = useTranslations('designer.requirement');
  const locale = useLocale();
  const pick = (text: { vi: string; en: string }) => (locale === 'en' ? text.en : text.vi);

  const defaults = assumptions.filter((a) => a.source === 'default');
  const method = assumptions.filter((a) => a.source !== 'default');

  const titleOf = (assumption: Assumption) => {
    const def = assumption.path ? V1A_FIELDS.find((d) => d.path === assumption.path) : undefined;
    if (def) return t(`fields.${def.section}.${def.key}`);
    return assumption.title ? pick(assumption.title) : assumption.key;
  };
  const valueOf = (assumption: Assumption) => {
    if (assumption.value === undefined) return null;
    const def = assumption.path ? V1A_FIELDS.find((d) => d.path === assumption.path) : undefined;
    if (def?.kind === 'select') return t(`options.${def.optionsKey}.${assumption.value}`);
    return assumption.unit ? `${assumption.value} ${assumption.unit}` : String(assumption.value);
  };

  const row = (assumption: Assumption) => {
    const value = valueOf(assumption);
    const highlight = assumption.source !== 'default' && assumption.level === 'warning';
    return (
      <li
        key={assumption.key}
        className={`px-4 py-3 ${highlight ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {assumption.level === 'warning' ? (
              <span className="text-amber-600 dark:text-amber-400" title={t('assumptions.warningLabel')}>
                ⚠{' '}
              </span>
            ) : null}
            {titleOf(assumption)}
            {value !== null ? (
              <>
                : <span className="tabular-nums">{value}</span>
              </>
            ) : null}
          </p>
          {assumption.path ? (
            <button
              type="button"
              onClick={() => focusField(assumption.path!)}
              className="shrink-0 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              {t('assumptions.editInTable')}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{pick(assumption)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('assumptions.rules')}:</span>
          {assumption.ruleIds.map((ruleId) => (
            <span
              key={ruleId}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {ruleId}
            </span>
          ))}
          {assumption.source === 'parameter' ? (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">· {t('assumptions.fixedInCode')}</span>
          ) : null}
        </div>
      </li>
    );
  };

  const heading = 'px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <section
      aria-labelledby="assumptions-title"
      className="rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-500/30 dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 id="assumptions-title" className="text-sm font-semibold">
          {t('assumptions.title')}{' '}
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            {assumptions.length}
          </span>
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('assumptions.subtitle')}</p>
      </div>

      <h3 className={heading}>{t('assumptions.defaultsTitle')}</h3>
      {defaults.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">{defaults.map(row)}</ul>
      ) : (
        <p className="px-4 pb-3 text-sm text-slate-600 dark:text-slate-400">{t('assumptions.noDefaults')}</p>
      )}

      {method.length > 0 ? (
        <>
          <h3 className={`${heading} border-t border-slate-200 dark:border-slate-800`}>
            {t('assumptions.methodTitle')}
          </h3>
          <ul className="divide-y divide-slate-100 pb-1 dark:divide-slate-800">{method.map(row)}</ul>
        </>
      ) : null}
    </section>
  );
}

function FieldInput({
  id,
  def,
  value,
  assumedValue,
  onChange,
}: {
  id: string;
  def: RequirementFieldDef;
  value: unknown;
  /** Giá trị mặc định đang áp khi ô trống — chỉ hiện làm gợi ý, không phải giá trị ô. */
  assumedValue: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('designer.requirement');
  const optionLabel = (option: string) => t(`options.${def.optionsKey}.${option}`);

  switch (def.kind) {
    case 'number':
      return (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          min={def.min}
          defaultValue={typeof value === 'number' ? value : ''}
          placeholder={assumedValue !== null ? t('assumedOption', { value: String(assumedValue) }) : undefined}
          onChange={(event) => {
            const text = event.target.value.trim();
            if (text === '') return onChange(null);
            const parsed = Number(text);
            if (Number.isFinite(parsed) && (def.min === undefined || parsed >= def.min)) onChange(parsed);
          }}
          className={INPUT_CLASS}
        />
      );

    case 'text':
      return (
        <input
          id={id}
          type="text"
          defaultValue={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value.trim() || null)}
          className={INPUT_CLASS}
        />
      );

    case 'select':
      return (
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
          className={INPUT_CLASS}
        >
          <option value="">
            {typeof assumedValue === 'string'
              ? t('assumedOption', { value: optionLabel(assumedValue) })
              : t('notSet')}
          </option>
          {(def.options ?? []).map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      );

    case 'boolean':
      return (
        <select
          id={id}
          value={value === true ? 'yes' : value === false ? 'no' : ''}
          onChange={(event) =>
            onChange(event.target.value === 'yes' ? true : event.target.value === 'no' ? false : null)
          }
          className={INPUT_CLASS}
        >
          <option value="">{t('notSet')}</option>
          <option value="yes">{t('yes')}</option>
          <option value="no">{t('no')}</option>
        </select>
      );

    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-x-4 gap-y-2">
          {(def.options ?? []).map((option) => (
            <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...selected, option] : selected.filter((item) => item !== option)
                  )
                }
                className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
              />
              {optionLabel(option)}
            </label>
          ))}
        </div>
      );
    }
  }
}
