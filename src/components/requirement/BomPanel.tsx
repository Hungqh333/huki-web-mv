'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { Component } from '@/lib/components/specs';
import { V1A_FIELDS } from '@/lib/requirement/fields';
import { BOM_QTY_MAX, type BomSelection } from '@/lib/vision/bomSelection';
import type { BomLine, BomSnapshot } from '@/lib/vision/bom';

/**
 * Danh mục vật tư của phương án đã chọn — V1c mục C5 (spec §11.2, UI_CONTENT màn 7).
 *
 * Chỉnh ở đây chỉ đổi LỰA CHỌN trong bản nháp (số lượng, dòng bỏ / thêm); bảng
 * dựng lại từ kho mỗi lần vẽ, và server dựng lại lần nữa khi lưu dự án.
 *
 * Luôn kèm khối Giả định & Loại trừ — thứ bảo vệ phòng khi khách đổi yêu cầu.
 */

const CATEGORY_ORDER = ['vision', 'lighting', 'cabling', 'computing', 'software', 'accessory', 'mechanical'] as const;

export function BomPanel({
  bom,
  selection,
  accessories,
  onChange,
  onClear,
  readOnly,
}: {
  bom: BomSnapshot | null;
  selection: BomSelection;
  /** Phụ kiện tích tay trong kho (listAccessories). */
  accessories: Component[];
  onChange: (next: BomSelection) => void;
  onClear: () => void;
  readOnly: boolean;
}) {
  const t = useTranslations('designer.requirement.bom');
  const tLevels = useTranslations('designer.requirement.solutions.levels');
  const tFields = useTranslations('designer.requirement.fields');
  const tStatus = useTranslations('designer.requirement.analysis.status');
  const tOptions = useTranslations('designer.requirement.options');
  const format = useFormatter();
  const [adding, setAdding] = useState('');

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
      <div>
        <h2 id="bom-title" className="text-sm font-semibold">
          {t('title', { level: tLevels(selection.level) })}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>
      {readOnly ? null : (
        <button type="button" onClick={onClear} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
          {t('clear')}
        </button>
      )}
    </div>
  );

  if (!bom) {
    return (
      <section aria-labelledby="bom-title" className="rounded-2xl border border-amber-300 bg-white shadow-sm dark:border-amber-800 dark:bg-slate-900">
        {heading}
        <p className="px-4 py-4 text-sm text-amber-800 sm:px-5 dark:text-amber-300">{t('unavailable')}</p>
      </section>
    );
  }

  const setQty = (line: BomLine, value: string) => {
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 1 || qty > BOM_QTY_MAX) return;
    const next = { ...selection.qty };
    if (qty === line.suggestedQty) delete next[line.key];
    else next[line.key] = qty;
    onChange({ ...selection, qty: next });
  };
  const remove = (line: BomLine) => {
    if (line.manual) {
      onChange({ ...selection, added: selection.added.filter((code) => code !== line.code) });
    } else {
      onChange({ ...selection, removed: [...selection.removed, line.key] });
    }
  };
  const restoreAll = () => onChange({ ...selection, removed: [] });
  const add = () => {
    if (!adding || selection.added.includes(adding)) return;
    onChange({ ...selection, added: [...selection.added, adding] });
    setAdding('');
  };

  const nameOf = (line: BomLine) => (line.placeholder ? t(`placeholders.${line.placeholder}`) : `${line.brand} ${line.model}`);
  const fieldLabel = (path: string) => {
    const [section, index, key] = path.split('.');
    return tFields(`${section}.${key ?? index}`);
  };
  /** Giá trị giả định đọc được: có / không, nhãn lựa chọn thay vì mã enum. */
  const valueLabel = (path: string, value: unknown): string => {
    if (typeof value === 'boolean') return t(value ? 'yes' : 'no');
    const def = V1A_FIELDS.find((item) => item.path === path);
    const label = (v: unknown) => (def?.optionsKey ? tOptions(`${def.optionsKey}.${String(v)}`) : String(v));
    const text = Array.isArray(value) ? value.map(label).join(', ') : label(value);
    return def?.unit ? `${text} ${def.unit}` : text;
  };
  const available = accessories.filter((item) => !bom.lines.some((line) => line.code === item.code));

  return (
    <section aria-labelledby="bom-title" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {heading}
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-3 font-medium">{t('colItem')}</th>
                <th className="py-2 pr-3 font-medium">{t('colQty')}</th>
                <th className="py-2 pr-3 font-medium">{t('colPrice')}</th>
                <th className="py-2 pr-3 font-medium">{t('colLeadTime')}</th>
                <th className="py-2 pr-3 font-medium">{t('colRule')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            {CATEGORY_ORDER.map((category) => {
              const lines = bom.lines.filter((line) => line.category === category);
              if (lines.length === 0) return null;
              return (
                <tbody key={category} className="border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <td colSpan={6} className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t(`categories.${category}`)}
                    </td>
                  </tr>
                  {lines.map((line) => (
                    <tr key={line.key} className="align-top">
                      <td className="py-1.5 pr-3">
                        <span className={line.placeholder ? 'italic' : 'font-medium'}>{nameOf(line)}</span>
                        {line.unverified ? (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-300">{t('unverified')}</span>
                        ) : null}
                        {line.placeholder ? <span className="block text-xs text-amber-700 dark:text-amber-400">{t('needsQuote')}</span> : null}
                        {line.summary ? <span className="block text-xs text-slate-500 dark:text-slate-400">{line.summary}</span> : null}
                        {line.supplier ? <span className="block text-xs text-slate-500 dark:text-slate-400">{line.supplier}</span> : null}
                      </td>
                      <td className="py-1.5 pr-3">
                        {readOnly ? (
                          line.qty
                        ) : (
                          <input
                            type="number"
                            min={1}
                            max={BOM_QTY_MAX}
                            step={1}
                            defaultValue={line.qty}
                            key={`${line.key}-${line.qty}`}
                            onBlur={(event) => setQty(line, event.target.value)}
                            aria-label={t('qtyFor', { item: nameOf(line) })}
                            className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        )}
                        {line.qty !== line.suggestedQty ? (
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">{t('suggested', { qty: line.suggestedQty })}</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{line.unitPrice != null ? format.number(line.unitPrice) : '—'}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{line.leadTimeDays != null ? t('days', { days: line.leadTimeDays }) : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs text-slate-500 dark:text-slate-400">{line.ruleIds.join(', ') || t('manual')}</td>
                      <td className="py-1.5 text-right">
                        {line.removable && !readOnly ? (
                          <button type="button" onClick={() => remove(line)} className="text-xs text-red-700 hover:underline dark:text-red-400">
                            {t('remove')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="font-semibold">
            {bom.total != null ? t('total', { total: format.number(bom.total) }) : t('totalMissing', { count: bom.missingPrices })}
          </p>
          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              {selection.removed.length > 0 ? (
                <button type="button" onClick={restoreAll} className="text-xs text-sky-700 hover:underline dark:text-sky-400">
                  {t('restore', { count: selection.removed.length })}
                </button>
              ) : null}
              {available.length > 0 ? (
                <>
                  <select
                    value={adding}
                    onChange={(event) => setAdding(event.target.value)}
                    aria-label={t('addLabel')}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">{t('addPlaceholder')}</option>
                    {available.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.brand} {item.model}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={add} disabled={!adding} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-slate-700">
                    {t('add')}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Giả định & Loại trừ — UI_CONTENT màn 7, bắt buộc. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
          <h3 className="font-semibold">{t('assumptionsTitle')}</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('assumptionsIntro')}</p>
          {bom.assumptions.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {bom.assumptions.map((item) => (
                <li key={item.path}>
                  {fieldLabel(item.path)}: {valueLabel(item.path, item.value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs">{t('noAssumptions')}</p>
          )}
          <p className="mt-2 text-xs font-semibold">{t('exclusionsTitle')}</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {bom.exclusions.map((key) => (
              <li key={key}>{t(`exclusions.${key}`)}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            {t('feasibilityAt')} <strong>{tStatus(bom.feasibility)}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
