import { getTranslations } from 'next-intl/server';
import { PanelHeader, NOTE_CLASS } from '@/components/ui/PanelHeader';
import { FormulaBookControls } from './FormulaBookControls';
import { FormulaFigure } from './FormulaFigures';
import snapshot from '@/lib/formulaBook/snapshot.json';
import { EVIDENCE_LABEL, FORMULA_BOOK, PAGE_LABEL, type FormulaEntry } from '@/lib/formulaBook/book';
import { formulaLines, relatedEntries, verdictRows, type VerdictKind } from '@/lib/formulaBook/present';
import type { LoadedEngineParams } from '@/lib/engineParamsLoad';
import { DEFAULT_ROW_DEFS, DEFAULT_ENGINE_TABLES } from '@/lib/vision/engineTables';
import { DEFAULT_ENGINE_PARAMS, ENGINE_PARAMS } from '@/lib/vision/engineParams';
import { LIGHTING_ROW_KEYS } from '@/lib/vision/lighting';
import { COLOR_ROW_KEYS, isReflectanceKey, type ColorRow, type Reflectance } from '@/lib/vision/lightColor';
import { MATRIX_ROW_KEYS } from '@/lib/vision/lightMatrix';
import { lightRowLabels } from '@/lib/lightRowLabels';

/**
 * Thân trang Sổ tay công thức (chốt 2026-10-20). SERVER COMPONENT — không được thêm
 * 'use client': nội dung sổ tay chỉ render thành HTML, không có JavaScript nào của nó
 * xuống trình duyệt (scripts/test-formula-book.ts kiểm). Dùng ở /admin/cong-thuc (sau
 * cổng admin) và /dev/cong-thuc (chỉ máy local, giá trị mặc định).
 */

const UNIT: Record<string, string | undefined> = Object.fromEntries(ENGINE_PARAMS.map((p) => [p.key, 'unit' in p ? p.unit : undefined]));
const TITLE_OF = new Map(FORMULA_BOOK.flatMap((s) => s.entries.map((e) => [e.id, e.title] as const)));

export async function FormulaBookView({ loaded }: { loaded: LoadedEngineParams }) {
  const t = await getTranslations('admin.formulas');
  const tParams = await getTranslations('admin.engine.params');
  const tTables = await getTranslations('admin.tables');
  const rowLabels = await lightRowLabels();
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

      {/* Mỗi phần là một <details> (HTML gốc, không cần JavaScript): mặc định thu gọn để nhìn
          tổng quát 13 phần; dòng tóm tắt hiện số mục (chốt 2026-10-20: bỏ mục lục và dòng mã luật). */}
      <div className="mt-4 space-y-3">
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
                      lightRow: (key) => rowLabels[key] ?? key,
                      lightColor: (key) => tTables(`lightColors.${key}`),
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
  lightRow: (key: string) => string;
  lightColor: (key: string) => string;
  defaultRow: (key: string) => string;
  option: (group: string, value: string) => string;
};

/** Chuẩn chữ thẻ (chốt 2026-10-27): nội dung 14 px, nhãn / khoá / nguồn 13 px, tên mục 15 px. */
const LABEL = 'mb-1.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400';

const BADGE: Record<Exclude<VerdictKind, 'neutral'>, string> = {
  bad: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
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
  const lines = formulaLines(entry);
  const verdicts = verdictRows(entry);
  const related = relatedEntries(entry);
  const hasParams = Boolean(entry.params?.length || entry.constants?.length || entry.liveTable);

  return (
    <article id={entry.id} className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-[#E4E5F6] px-4 py-3 dark:border-slate-800 dark:bg-[#22274A]">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">{entry.id}</span>
          <h3 className="text-[15px] font-semibold text-indigo-950 dark:text-indigo-100">{entry.title}</h3>
          {entry.evidence ? <span className="text-[13px] text-slate-500 dark:text-slate-400">{EVIDENCE_LABEL[entry.evidence]}</span> : null}
        </div>
        {entry.usedIn.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.usedIn.map((page) => (
              <a
                key={page}
                href={PAGE_LABEL[page].href}
                className="rounded-full bg-white/75 px-2.5 py-0.5 text-[13px] text-slate-600 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {PAGE_LABEL[page].label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-4 pb-4 pt-3.5">
        <div>
          <div className={LABEL}>Công thức</div>
          <div className="space-y-1.5">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`flex flex-col gap-0.5 border-l-[3px] bg-slate-50 px-3 py-1.5 sm:flex-row sm:items-baseline sm:gap-3 dark:bg-slate-950 ${
                  line.indent ? 'ml-6 border-sky-300 dark:border-sky-800' : 'border-sky-600 dark:border-sky-500'
                }`}
              >
                <code className="flex-1 break-words font-mono text-sm text-slate-900 dark:text-slate-100">{line.main}</code>
                {line.note ? <span className="text-[13px] text-slate-500 sm:max-w-[45%] dark:text-slate-400">{line.note}</span> : null}
              </div>
            ))}
          </div>
        </div>

        {entry.figure ? <FormulaFigure figure={entry.figure} uid={entry.id} /> : null}

        {verdicts.length ? (
          <div>
            <div className={LABEL}>Kết luận</div>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {verdicts.map((row, i) => (
                // Điện thoại: nhãn xuống dòng dưới điều kiện (chốt 2026-10-27).
                <li key={i} className="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-slate-700 dark:text-slate-300">
                    {row.kind !== 'neutral' && row.when !== 'Mọi trường hợp' ? (
                      <span className="mr-1.5 text-slate-500 dark:text-slate-400">Khi</span>
                    ) : null}
                    {row.when}
                  </span>
                  {row.kind === 'neutral' ? (
                    row.label ? <span className="text-slate-600 sm:max-w-[50%] sm:text-right dark:text-slate-400">→ {row.label}</span> : null
                  ) : (
                    <span
                      className={`self-start rounded-full px-2.5 py-0.5 text-[13px] font-semibold ring-1 ring-inset sm:max-w-[50%] sm:self-auto sm:text-right ${BADGE[row.kind]}`}
                    >
                      {row.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasParams ? (
          <div>
            <div className={LABEL}>Ngưỡng đang chạy</div>
            {entry.params?.length || entry.constants?.length ? (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {entry.params?.map((key) => {
                  const unit = UNIT[key];
                  return (
                    <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                        <div className="text-slate-700 dark:text-slate-300">{paramLabel(key)}</div>
                        <div className="break-words font-mono text-[13px] text-slate-400">{key}</div>
                      </div>
                      <div className="ml-auto whitespace-nowrap text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {loaded.params[key]}
                        {unit ? ` ${unit}` : ''}
                      </div>
                      <div className="shrink-0 text-right text-[13px] sm:w-24">
                        {overridden.has(key) ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            đã sửa · mặc định {DEFAULT_ENGINE_PARAMS[key]}
                          </span>
                        ) : (
                          <span className="text-slate-400">admin</span>
                        )}
                      </div>
                    </li>
                  );
                })}
                {entry.constants?.map((c) => (
                  <li key={c.name} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                    <div className="min-w-0 basis-full text-slate-700 sm:basis-auto sm:flex-1 dark:text-slate-300">{c.name}</div>
                    <div className="ml-auto text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{c.value}</div>
                    <div className="shrink-0 text-right text-[13px] sm:w-24 text-slate-400">trong code</div>
                  </li>
                ))}
              </ul>
            ) : null}
            {entry.liveTable === 'defaults' ? <DefaultsTable loaded={loaded} labels={tables} /> : null}
            {entry.liveTable === 'lighting' ? <LightingTable loaded={loaded} labels={tables} /> : null}
            {entry.liveTable === 'lightColor' ? <LightColorTable loaded={loaded} labels={tables} /> : null}
            {entry.liveTable === 'lightMatrix' ? <LightMatrixTable loaded={loaded} labels={tables} /> : null}
          </div>
        ) : null}

        {entry.notes?.length ? (
          <div>
            <div className={LABEL}>Ghi chú</div>
            <div className="space-y-1.5">
              {entry.notes.map((note) => (
                <p key={note} className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {note}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-1 border-t border-slate-100 pt-2.5 text-[13px] text-slate-400 dark:border-slate-800">
          {related.length ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span>Liên quan:</span>
              {related.map((id) => (
                <a
                  key={id}
                  href={`#${encodeURIComponent(id)}`}
                  title={TITLE_OF.get(id)}
                  className="font-mono text-sky-700 underline underline-offset-[3px] hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  {id}
                </a>
              ))}
            </div>
          ) : null}
          <div>
            Nguồn: <code className="break-words font-mono text-slate-500 dark:text-slate-400">{entry.source}</code>
          </div>
        </div>
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
            def.kind === 'choice' ? labels.option(def.key, String(row.value)) : `${row.value}${'unit' in def ? ` ${def.unit}` : ''}`;
          return (
            <tr key={def.key}>
              <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{labels.defaultRow(def.key)}</td>
              <td className="py-1 text-right font-mono text-slate-900 dark:text-slate-100">{value}</td>
              <td className="py-1 pl-3 text-[13px]">{changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">đã sửa</span> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LightColorTable({ loaded, labels }: { loaded: LoadedEngineParams; labels: TableLabels }) {
  const badge = <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">đã sửa</span>;
  return (
    <table className="w-full max-w-2xl text-left text-sm">
      <thead className="text-[13px] text-slate-500 dark:text-slate-400">
        <tr>
          <th className="py-1 pr-3 font-medium" />
          <th className="py-1 pr-3 font-medium">R · G · B / đèn</th>
          <th />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {COLOR_ROW_KEYS.map((key) => {
          const row = loaded.tables.lightColor[key];
          const changed = JSON.stringify(row) !== JSON.stringify(DEFAULT_ENGINE_TABLES.lightColor[key]);
          return (
            <tr key={key}>
              <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{labels.lightRow(key)}</td>
              <td className="py-1 font-mono text-slate-900 dark:text-slate-100">
                {isReflectanceKey(key)
                  ? `${(row as Reflectance).r} · ${(row as Reflectance).g} · ${(row as Reflectance).b}`
                  : `${labels.lightColor((row as ColorRow).color)}${(row as ColorRow).alternative ? ` / ${labels.lightColor((row as ColorRow).alternative!)}` : ''}`}
              </td>
              <td className="py-1 pl-3 text-[13px]">{changed ? badge : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LightMatrixTable({ loaded, labels }: { loaded: LoadedEngineParams; labels: TableLabels }) {
  return (
    <table className="w-full max-w-3xl text-left text-sm">
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {MATRIX_ROW_KEYS.map((key) => {
          const row = loaded.tables.lightMatrix[key];
          const base = DEFAULT_ENGINE_TABLES.lightMatrix[key];
          const changed = row.lightType !== base.lightType || row.alternativeType !== base.alternativeType;
          return (
            <tr key={key}>
              <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{labels.lightRow(key)}</td>
              <td className="py-1 font-mono text-slate-900 dark:text-slate-100">
                {labels.lightType(row.lightType)}
                {row.alternativeType ? ` / ${labels.lightType(row.alternativeType)}` : ''}
              </td>
              <td className="py-1 pl-3 text-[13px]">{changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">đã sửa</span> : null}</td>
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
              <td className="py-1 pl-3 text-[13px]">{changed ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">đã sửa</span> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
