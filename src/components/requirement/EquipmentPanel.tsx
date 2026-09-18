'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { SPEC_FIELDS, SUMMARY_KEYS, type Component } from '@/lib/components/specs';
import type { Candidate, CameraCandidate, EquipmentFilter } from '@/lib/vision/equipmentFilter';
import type { RuleResult } from '@/lib/vision/rules';

/**
 * Thiết bị phù hợp — V1c mục C3 (spec V1.1 §8.1 lọc cứng).
 *
 * Chỉ LỌC và LIỆT KÊ: thiết bị đạt (kèm cờ chưa kiểm được / chưa kiểm chứng) và
 * mục "Đã loại — lý do" có mã luật. Xếp hạng và ba mức giải pháp là C4.
 *
 * Kết quả lọc tính ở DesignPanels (dùng chung với khối Phương án — C4).
 */

export function summarise(component: Component): string {
  const keys = SUMMARY_KEYS[component.kind] ?? [];
  return (SPEC_FIELDS[component.kind] ?? [])
    .filter((field) => keys.includes(field.key))
    .map((field) => {
      const value = component.spec[field.key];
      if (value === undefined || value === null || value === '') return null;
      return `${value}${field.unit ? ` ${field.unit}` : ''}`;
    })
    .filter(Boolean)
    .join(' · ');
}

export const nameOf = (component: Component) => `${component.brand} ${component.model}`;

type NoteOf = (result: RuleResult) => string;

export function EquipmentPanel({ filter, catalogEmpty }: { filter: EquipmentFilter; catalogEmpty: boolean }) {
  const t = useTranslations('designer.requirement.equipment');
  const tv = useTranslations('selector.vision');

  const noteOf: NoteOf = (result) =>
    result.noteKey ? tv(`notes.${result.noteKey}`, result.noteValues ?? {}) : tv(`checks.${result.key}`);

  const body = () => {
    if (catalogEmpty) return <p className="text-sm text-slate-600 dark:text-slate-400">{t('noCatalog')}</p>;
    if (!filter.ready) return <p className="text-sm text-slate-600 dark:text-slate-400">{t('notReady')}</p>;

    return (
      <div className="space-y-5">
        <Group title={t('cameras')} accepted={filter.cameras.accepted.length} excluded={filter.cameras.excluded} noteOf={noteOf}>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {filter.cameras.accepted.map((camera) => (
              <CameraRow key={camera.component.id} camera={camera} noteOf={noteOf} />
            ))}
          </ul>
        </Group>

        <Group
          title={t('lights')}
          hint={filter.lights.wantedTypes.length > 0 ? t('lightsWanted', { types: filter.lights.wantedTypes.join(' / ') }) : t('lightsAny')}
          accepted={filter.lights.accepted.length}
          excluded={filter.lights.excluded}
          noteOf={noteOf}
        >
          <CandidateList items={filter.lights.accepted} noteOf={noteOf} />
        </Group>

        <Group
          title={t('pcs')}
          hint={filter.pcs.referenceCamera ? t('pcsReference', { camera: nameOf(filter.pcs.referenceCamera) }) : t('pcsNoCamera')}
          accepted={filter.pcs.accepted.length}
          excluded={filter.pcs.excluded}
          noteOf={noteOf}
        >
          <CandidateList items={filter.pcs.accepted} noteOf={noteOf} />
        </Group>
      </div>
    );
  };

  return (
    <section aria-labelledby="equipment-title" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
        <h2 id="equipment-title" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>
      <div className="px-4 py-4 sm:px-5">{body()}</div>
    </section>
  );
}

function Group({
  title,
  hint,
  accepted,
  excluded,
  noteOf,
  children,
}: {
  title: string;
  hint?: string;
  accepted: number;
  excluded: Candidate[];
  noteOf: NoteOf;
  children: ReactNode;
}) {
  const t = useTranslations('designer.requirement.equipment');
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-slate-500 dark:text-slate-400">· {t('counts', { accepted, excluded: excluded.length })}</span>
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      <div className="mt-2">{accepted > 0 ? children : <p className="text-sm text-red-700 dark:text-red-400">{t('noneAccepted')}</p>}</div>
      {excluded.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-sky-700 hover:underline dark:text-sky-400">{t('excludedTitle', { count: excluded.length })}</summary>
          <ul className="mt-2 space-y-1.5">
            {excluded.map((item) => (
              <li key={item.component.id} className="rounded-lg border border-red-200 px-3 py-2 text-xs dark:border-red-900">
                <p className="font-medium text-slate-800 dark:text-slate-200">{nameOf(item.component)}</p>
                {item.reasons.map((reason, index) => (
                  <p key={`${reason.ruleId}-${index}`} className="mt-0.5 text-slate-600 dark:text-slate-400">
                    <span className="mr-1.5 font-mono text-red-700 dark:text-red-400">{reason.ruleId}</span>
                    {noteOf(reason)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Badges({ item }: { item: Candidate }) {
  const t = useTranslations('designer.requirement.equipment');
  return (
    <>
      {item.unverified ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-300">{t('unverified')}</span>
      ) : null}
      {item.warnings.length > 0 ? (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {t('conditions', { rules: item.warnings.map((r) => r.ruleId).join(', ') })}
        </span>
      ) : null}
      {item.unchecked.length > 0 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t('unchecked', { rules: [...new Set(item.unchecked.map((r) => r.ruleId))].join(', ') })}
        </span>
      ) : null}
    </>
  );
}

function CandidateList({ items, noteOf }: { items: Candidate[]; noteOf: NoteOf }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {items.map((item) => (
        <li key={item.component.id} className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{nameOf(item.component)}</span>
            <Badges item={item} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{summarise(item.component)}</p>
          {item.warnings.map((warning, index) => (
            <p key={`${warning.ruleId}-${index}`} className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              <span className="mr-1.5 font-mono">{warning.ruleId}</span>
              {noteOf(warning)}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function CameraRow({ camera, noteOf: note }: { camera: CameraCandidate; noteOf: NoteOf }) {
  const t = useTranslations('designer.requirement.equipment');
  const { lenses } = camera;
  const best = lenses.best;
  const fit = best?.results.find((r) => r.ruleId === 'OPT-001');
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{nameOf(camera.component)}</span>
        <Badges item={camera} />
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{summarise(camera.component)}</p>
      {camera.warnings.map((warning, index) => (
        <p key={`${warning.ruleId}-${index}`} className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="mr-1.5 font-mono">{warning.ruleId}</span>
          {note(warning)}
        </p>
      ))}
      <p className="mt-1 text-xs">
        {best ? (
          <>
            {t('lensesAccepted', { count: lenses.accepted.length })} · {t('bestLens', { lens: nameOf(best.component) })}
            {fit?.marginRatio ? <span className="text-slate-500 dark:text-slate-400"> · {t('lensMargin', { margin: fit.marginRatio.toFixed(2) })}</span> : null}
          </>
        ) : (
          <span className="text-red-700 dark:text-red-400">{t('noLens')}</span>
        )}
      </p>
      {lenses.excluded.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-sky-700 hover:underline dark:text-sky-400">{t('lensesExcluded', { count: lenses.excluded.length })}</summary>
          <ul className="mt-1 space-y-1">
            {lenses.excluded.map((lens) => (
              <li key={lens.component.id} className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">{nameOf(lens.component)}</span>
                {lens.reasons.map((reason, index) => (
                  <span key={`${reason.ruleId}-${index}`} className="block pl-3">
                    <span className="mr-1.5 font-mono text-red-700 dark:text-red-400">{reason.ruleId}</span>
                    {note(reason)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
