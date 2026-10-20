import { getTranslations } from 'next-intl/server';
import { PanelHeader, NOTE_CLASS } from '@/components/ui/PanelHeader';
import { FormulaBookControls } from './FormulaBookControls';
import snapshot from '@/lib/formulaBook/snapshot.json';
import { EVIDENCE_LABEL, FORMULA_BOOK, PAGE_LABEL, type FormulaEntry } from '@/lib/formulaBook/book';
import type { LoadedEngineParams } from '@/lib/engineParamsLoad';
import { DEFAULT_ROW_DEFS, DEFAULT_ENGINE_TABLES } from '@/lib/vision/engineTables';
import { DEFAULT_ENGINE_PARAMS, ENGINE_PARAMS } from '@/lib/vision/engineParams';
import { LIGHTING_ROW_KEYS } from '@/lib/vision/lighting';

/**
 * Thân trang Sổ tay công thức (chốt 2026-10-20). SERVER COMPONENT — không được thêm
 * 'use client': nội dung sổ tay chỉ render thành HTML, không có JavaScript nào của nó
 * xuống trình duyệt (scripts/test-formula-book.ts kiểm). Dùng ở /admin/cong-thuc (sau
 * cổng admin) và /dev/cong-thuc (chỉ máy local, giá trị mặc định).
 */

const UNIT: Record<string, string | undefined> = Object.fromEntries(ENGINE_PARAMS.map((p) => [p.key, 'unit' in p ? p.unit : undefined]));

export async function FormulaBookView({ loaded }: { loaded: LoadedEngineParams }) {
  const t = await getTranslations('admin.formulas');
  const tParams = await getTranslations('admin.engine.params');
  const tTables = await getTranslations('admin.tables');
  const tOptions = await getTranslations('designer.requirement.options');
  const overridden = new Set<string>(loaded.overridden);

  const ruleCount = FORMULA_BOOK.reduce((n, s) => n + s.entries.length, 0);

  return (
    <section>
      <PanelHeader
        standalone
        title={t('title')}
        meta={t('meta', { count: ruleCount })}
        note={`${t('subtitle')} ${t('reviewedAt', { date: snapshot.reviewedAt })}`}
        actions={<FormulaBookControls expandLabel={t('expandAll')} collapseLabel={t('collapseAll')} />}
      />

      {/* Mục lục — bấm vào thì phần tương ứng tự mở (FormulaBookControls). */}
      <nav aria-label={t('toc')} className="mt-4 flex flex-wrap gap-2">
        {FORMULA_BOOK.map((section) => (
          <a
            key={section.key}
            href={`#${section.key}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {section.title}
          </a>
        ))}
      </nav>

      {/* Mỗi phần là một <details> (HTML gốc, không cần JavaScript): mặc định thu gọn để nhìn
          tổng quát 13 phần; dòng tóm tắt vẫn hiện số mục và các mã luật trong phần. */}
      <div className="mt-6 space-y-3">
        {FORMULA_BOOK.map((section) => (
          <details
            key={section.key}
            id={section.key}
            data-formula-section
            className="group scroll-mt-20 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block w-3 text-slate-400 transition-transform group-open:rotate-90">
                ▸
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>
              <span className={NOTE_CLASS}>{t('entries', { count: section.entries.length })}</span>
              <span className="w-full pl-6 font-mono text-[11px] text-slate-400 sm:w-auto sm:pl-0">
                {section.entries.map((entry) => entry.id).join(' · ')}
              </span>
            </summary>
            <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-800">
              {section.intro ? <p className={`max-w-3xl ${NOTE_CLASS}`}>{section.intro}</p> : null}
              <div className="mt-3 space-y-4">
                {section.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    loaded={loaded}
                    overridden={overridden}
                    paramLabel={(key) => tParams(key)}
                    tables={{
                      lightingRow: (key) => tTables(`lighting.rows.${key}`),
                      lightType: (key) => tTables(`lightTypes.${key}`),
                      defaultRow: (key) => tTables(`defaults.rows.${key}`),
                      option: (group, value) => tOptions(`${group}.${value}` as never),
                    }}
                  />
                ))}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

type TableLabels = {
  lightingRow: (key: string) => string;
  lightType: (key: string) => string;
  defaultRow: (key: string) => string;
  option: (group: 'contrast' | 'motion', value: string) => string;
};

function EntryCard({
  entry,
  loaded,
  overridden,
  paramLabel,
  tables,
}: {
  entry: FormulaEntry;
  loaded: LoadedEngineParams;
  overridden: Set<string>;
  paramLabel: (key: string) => string;
  tables: TableLabels;
}) {
  return (
    <article id={entry.id} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-slate-200 bg-[#E4E5F6] px-4 py-2.5 dark:border-slate-800 dark:bg-[#22274A]">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">{entry.id}</span>
          <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">{entry.title}</h3>
          {entry.evidence ? <span className={NOTE_CLASS}>{EVIDENCE_LABEL[entry.evidence]}</span> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entry.usedIn.map((page) => (
            <a key={page} href={PAGE_LABEL[page].href} className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300">
              {PAGE_LABEL[page].label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {entry.formula.join('\n')}
        </pre>

        {entry.verdict?.length ? (
          <ul className="space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
            {entry.verdict.map((line) => (
              <li key={line}>→ {line}</li>
            ))}
          </ul>
        ) : null}

        {entry.params?.length || entry.constants?.length ? (
          <table className="w-full max-w-2xl text-left text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entry.params?.map((key) => {
                const value = loaded.params[key];
                const changed = overridden.has(key);
                const unit = UNIT[key];
                return (
                  <tr key={key}>
                    <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">
                      {paramLabel(key)} <span className="font-mono text-[11px] text-slate-400">{key}</span>
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {value}
                      {unit ? ` ${unit}` : ''}
                    </td>
                    <td className="py-1 pl-3 text-xs">
                      {changed ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                          đã sửa · mặc định {DEFAULT_ENGINE_PARAMS[key]}
                        </span>
                      ) : (
                        <span className="text-slate-400">admin</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {entry.constants?.map((c) => (
                <tr key={c.name}>
                  <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{c.name}</td>
                  <td className="py-1 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{c.value}</td>
                  <td className="py-1 pl-3 text-xs text-slate-400">trong code</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {entry.liveTable === 'defaults' ? <DefaultsTable loaded={loaded} labels={tables} /> : null}
        {entry.liveTable === 'lighting' ? <LightingTable loaded={loaded} labels={tables} /> : null}

        {entry.notes?.map((note) => (
          <p key={note} className={NOTE_CLASS}>
            {note}
          </p>
        ))}
        <p className="font-mono text-[11px] text-slate-400">{entry.source}</p>
      </div>
    </article>
  );
}

function DefaultsTable({ loaded, labels }: { loaded: LoadedEngineParams; labels: TableLabels }) {
  return (
    <table className="w-full max-w-2xl text-left text-sm">
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {DEFAULT_ROW_DEFS.map((def) => {
          const row = loaded.tables.defaults[def.key];
          const changed = JSON.stringify(row) !== JSON.stringify(DEFAULT_ENGINE_TABLES.defaults[def.key]);
          const value =
            def.kind === 'choice' ? labels.option(def.key === 'contrast' ? 'contrast' : 'motion', String(row.value)) : `${row.value}${'unit' in def ? ` ${def.unit}` : ''}`;
          return (
            <tr key={def.key}>
              <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{labels.defaultRow(def.key)}</td>
              <td className="py-1 text-right font-mono text-slate-900 dark:text-slate-100">{value}</td>
              <td className="py-1 pl-3 text-xs">{changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">đã sửa</span> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LightingTable({ loaded, labels }: { loaded: LoadedEngineParams; labels: TableLabels }) {
  return (
    <table className="w-full max-w-2xl text-left text-sm">
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {LIGHTING_ROW_KEYS.map((key) => {
          const row = loaded.tables.lighting[key];
          const changed = JSON.stringify(row) !== JSON.stringify(DEFAULT_ENGINE_TABLES.lighting[key]);
          return (
            <tr key={key}>
              <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{labels.lightingRow(key)}</td>
              <td className="py-1 font-mono text-slate-900 dark:text-slate-100">
                {labels.lightType(row.lightType)}
                {row.alternativeType ? ` / ${labels.lightType(row.alternativeType)}` : ''}
              </td>
              <td className="py-1 pl-3 text-xs">{changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">đã sửa</span> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
