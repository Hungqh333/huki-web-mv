'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { APPLICATION_SHORTCUT_ORDER, type ApplicationType } from '@/lib/visionEntry';
import {
  REQUIREMENT_SECTIONS,
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
import type { Confidence } from '@/lib/requirement/types';

/**
 * Bảng tóm tắt yêu cầu — spec V1.1 §10.2 "Tôi hiểu bài toán của bạn".
 *
 * Mỗi dòng: thông số | ô sửa được | badge confidence. Sửa một ô thì ô đó thành
 * "Đã nêu". Chưa có parser (V1a hạng mục 3) nên mọi ô bắt đầu ở "Chưa có".
 * Bản nháp nằm ở sessionStorage; chưa lưu database (hạng mục 7).
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
    <div className="space-y-6">
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

      {requirement
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
                    const confidence = field?.confidence ?? 'unknown';
                    const id = `req-${def.path.replace(/\./g, '-')}`;
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
                        className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_6.5rem] sm:gap-4 sm:px-5"
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
                          onChange={(value) => onValue(def.path, value)}
                        />
                        <span
                          className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium sm:justify-self-end ${BADGE_CLASS[confidence]}`}
                        >
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
  );
}

function FieldInput({
  id,
  def,
  value,
  onChange,
}: {
  id: string;
  def: RequirementFieldDef;
  value: unknown;
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
          <option value="">{t('notSet')}</option>
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
