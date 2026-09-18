'use client';

import { useTranslations, useFormatter } from 'next-intl';
import type { Candidate } from '@/lib/vision/equipmentFilter';
import { noteMessageKey, type RuleResult } from '@/lib/vision/rules';
import type { SolutionLevel, SolutionLevelKey, Solutions } from '@/lib/vision/solutionLevels';
import { nameOf, summarise } from './EquipmentPanel';

/**
 * Ba mức giải pháp — V1c mục C4 (spec V1.1 §8.3, UI_CONTENT màn 5).
 *
 * Ba mức KHÔNG khác nhau ở độ chính xác: sai số / lỗi nhỏ nhất là yêu cầu của
 * khách, cả ba phải đạt. Chúng khác ở hệ số an toàn (dư độ phân giải tính trên
 * mm/px, không phải MP), chi phí và rủi ro. Tiết kiệm có rủi ro đã biết thì bị
 * chặn và nói lý do, không bày ra như một phương án rẻ hơn.
 */

type NoteOf = (result: RuleResult) => string;

export function SolutionPanel({
  solutions,
  requirementLine,
  ready,
  selectedLevel,
  onSelect,
}: {
  solutions: Solutions;
  /** Mức đang chọn làm BOM (C5). */
  selectedLevel: SolutionLevelKey | null;
  /** null = chỉ xem (revision đã khoá). */
  onSelect: ((level: SolutionLevelKey) => void) | null;
  /** "sai số ±0,1 mm · lỗi 0,5 mm · vật 380 × 280 mm" — dựng ở DesignPanels. */
  requirementLine: string;
  ready: boolean;
}) {
  const t = useTranslations('designer.requirement.solutions');
  const tv = useTranslations('selector.vision');
  const noteOf: NoteOf = (result) => (result.noteKey ? tv(noteMessageKey(result.noteKey), result.noteValues ?? {}) : tv(`checks.${result.key}`));

  return (
    <section aria-labelledby="solutions-title" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
        <h2 id="solutions-title" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {!ready ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('notReady')}</p>
        ) : (
          <>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <p className="font-semibold">{t('mandatory', { line: requirementLine })}</p>
              <p className="mt-1 text-xs">{t('mandatoryNote')}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {solutions.levels.map((level) => (
                <LevelCard
                  key={level.key}
                  level={level}
                  noteOf={noteOf}
                  selected={selectedLevel === level.key}
                  highlighted={selectedLevel ? selectedLevel === level.key : level.key === 'recommended'}
                  onSelect={onSelect}
                />
              ))}
            </div>

            {solutions.unplacedPairs > 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">{t('unplaced', { count: solutions.unplacedPairs })}</p> : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('marginNote')}</p>
          </>
        )}
      </div>
    </section>
  );
}

function LevelCard({
  level,
  noteOf,
  selected,
  highlighted,
  onSelect,
}: {
  level: SolutionLevel;
  noteOf: NoteOf;
  selected: boolean;
  /** Viền nổi: mức đang chọn; chưa chọn gì thì mức Đề xuất. */
  highlighted: boolean;
  onSelect: ((level: SolutionLevelKey) => void) | null;
}) {
  const t = useTranslations('designer.requirement.solutions');
  const format = useFormatter();
  const range = Number.isFinite(level.max) ? `${level.min}–${level.max}×` : `≥ ${level.min}×`;

  return (
    <article
      className={`flex flex-col rounded-xl border px-4 py-3 ${
        highlighted ? 'border-sky-400 ring-1 ring-sky-400 dark:border-sky-600 dark:ring-sky-600' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <header>
        <h3 className="text-sm font-semibold">{t(`levels.${level.key}`)}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('marginRange', { range })}</p>
      </header>

      {level.status === 'blocked' ? (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">⛔ {t('blocked')}</p>
          <p className="mt-1 text-xs">{t('blockedNote')}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {level.blockReasons.map((reason, index) => (
              <li key={`${reason.ruleId}-${index}`}>
                <span className="mr-1.5 font-mono">{reason.ruleId}</span>
                {noteOf(reason)}
              </li>
            ))}
          </ul>
          <a href="#analysis-title" className="mt-2 inline-block text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
            {t('whatToRelax')}
          </a>
        </div>
      ) : level.status === 'empty' ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('empty')}</p>
      ) : (
        <>
          <dl className="mt-3 space-y-2 text-sm">
            <Item label={t('camera')} item={level.camera} qty={level.cost?.lines[0]?.qty} />
            <Item label={t('lens')} item={level.lens} />
            <Item label={t('light')} item={level.light} empty={t('noLight')} />
            <Item label={t('pc')} item={level.pc} empty={t('noPc')} />
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{t('software')}</dt>
              <dd className="text-xs text-slate-600 dark:text-slate-400">{t('softwareLater')}</dd>
            </div>
          </dl>

          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <p>
              {t('margin', { margin: level.margin!.toFixed(2) })}
              {level.mmPerPx !== null ? ` · ${level.mmPerPx.toFixed(4)} mm/px` : ''}
            </p>
            <p>
              {level.cost?.total != null
                ? t('cost', { total: format.number(level.cost.total) })
                : t('costMissing', { count: level.cost?.missingPrices ?? 0 })}
            </p>
            {level.score ? (
              <details>
                <summary className="cursor-pointer text-sky-700 hover:underline dark:text-sky-400">{t('score', { score: level.score.total })}</summary>
                <table className="mt-1 w-full text-left">
                  <tbody>
                    {level.score.parts.map((part) => (
                      <tr key={part.criterion} className={part.hasData ? '' : 'text-slate-400 dark:text-slate-500'}>
                        <td className="pr-2">{t(`criteria.${part.criterion}`)}</td>
                        <td className="pr-2 tabular-nums">× {part.weight}</td>
                        <td className="tabular-nums">{part.hasData ? part.value.toFixed(2) : t('noData')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}
          </div>

          {onSelect || selected ? (
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              {selected ? (
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">✓ {t('selected')}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect?.(level.key)}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                >
                  {t('select')}
                </button>
              )}
            </div>
          ) : null}

          {level.risks.length > 0 ? (
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{t('risks', { count: level.risks.length })}</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {level.risks.map((risk, index) => (
                  <li key={`${risk.ruleId}-${risk.key}-${index}`}>
                    <span className="mr-1.5 font-mono text-amber-700 dark:text-amber-400">{risk.ruleId}</span>
                    {noteOf(risk)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

function Item({ label, item, qty, empty }: { label: string; item: Candidate | null; qty?: number; empty?: string }) {
  const t = useTranslations('designer.requirement.solutions');
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd>
        {item ? (
          <>
            <span className="font-medium">
              {qty && qty > 1 ? `${qty} × ` : ''}
              {nameOf(item.component)}
            </span>
            {item.unverified ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-300">{t('unverified')}</span> : null}
            <span className="block text-xs text-slate-500 dark:text-slate-400">{summarise(item.component)}</span>
          </>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">{empty ?? '—'}</span>
        )}
      </dd>
    </div>
  );
}
