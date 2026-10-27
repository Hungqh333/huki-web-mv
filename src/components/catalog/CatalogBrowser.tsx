'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toggleCommonAction } from '@/app/actions/components';
import type { ComponentKind } from '@/lib/components/specs';
import {
  CATALOG_FILTERS,
  COMPARE_MAX,
  SELECTION_STORAGE_KEY,
  brandFacets,
  comparableKinds,
  compareRows,
  emptyQuery,
  filterItems,
  kindCounts,
  missingSpecCount,
  optionFacets,
  rangeBounds,
  sanitizeSelection,
  specField,
  specPairs,
  summaryPairs,
  type CatalogItem,
  type CatalogQuery,
} from '@/lib/catalog/catalog';

/**
 * Danh mục thiết bị (chốt 2026-10-27, Q1–Q8). Lọc ngay trong trình duyệt (Q3); bấm một
 * dòng mở khung thông số, link ?ma= gửi được cho người khác (Q4); tick chọn → giỏ lưu trên
 * máy người dùng, so sánh tối đa 4 món cùng loại, xuất Excel (Q5); admin bấm ★ (Q7).
 * Không có công thức thiết bị nào ở đây — chỉ thông số đã khai trong kho.
 */

const PAGE_SIZE = 50;

const SOURCE_STYLES: Record<string, string> = {
  unverified: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  datasheet: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  measured: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
};

const chip = (active: boolean) =>
  active
    ? 'rounded-full bg-sky-600 px-3 py-1 text-[13px] font-medium text-white'
    : 'rounded-full border border-slate-300 px-3 py-1 text-[13px] text-slate-700 hover:border-sky-500 dark:border-slate-700 dark:text-slate-300';

const btn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-sky-500 hover:text-sky-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300';
const btnPrimary = 'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50';

/*
 * Giỏ "Đã chọn" lưu trong localStorage, đọc qua useSyncExternalStore (như ThemeToggle):
 * máy chủ luôn thấy giỏ rỗng, trình duyệt đọc sau hydration — không lệch, không setState
 * trong effect. Trình duyệt chặn lưu (chế độ riêng tư) thì giỏ chỉ sống trong bộ nhớ.
 */
const SELECTION_EVENT = 'mvh-catalog-selection';
let memoryRaw = '[]';

function readRaw(): string {
  try {
    return window.localStorage.getItem(SELECTION_STORAGE_KEY) ?? memoryRaw;
  } catch {
    return memoryRaw;
  }
}

function writeStored(selected: string[]) {
  memoryRaw = JSON.stringify(selected);
  try {
    window.localStorage.setItem(SELECTION_STORAGE_KEY, memoryRaw);
  } catch {
    /* chỉ giữ trong bộ nhớ */
  }
  window.dispatchEvent(new Event(SELECTION_EVENT));
}

function subscribeSelection(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(SELECTION_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SELECTION_EVENT, onChange);
  };
}

/** Ghi / xoá ?ma= trên thanh địa chỉ mà không tải lại trang. */
function setCodeInUrl(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('ma', code);
  else url.searchParams.delete('ma');
  window.history.replaceState(null, '', url);
}

export function CatalogBrowser({
  items: initialItems,
  admin,
  persistStar = true,
  initialCode = null,
  exportPath,
}: {
  items: CatalogItem[];
  admin: boolean;
  /** false ở trang xem trước local: ★ chỉ đổi trên màn hình, không ghi database. */
  persistStar?: boolean;
  initialCode?: string | null;
  /** Đường dẫn file Excel; mã nối vào ?ma=. */
  exportPath: string;
}) {
  const t = useTranslations('catalog');
  const tc = useTranslations('admin.components');
  const tv = useTranslations('catalog.values');
  const locale = useLocale();

  const [items, setItems] = useState(initialItems);
  const byCode = useMemo(() => new Map(items.map((i) => [i.code, i])), [items]);
  const hasCommon = items.some((i) => i.is_common);

  const opened0 = initialCode ? byCode.get(initialCode) ?? null : null;
  const [rawQuery, setQuery] = useState<CatalogQuery>(() => {
    const commonOnly = opened0 ? Boolean(opened0.is_common) : hasCommon;
    const kinds = kindCounts(initialItems, commonOnly);
    return emptyQuery(opened0?.kind ?? kinds[0]?.kind ?? 'camera', commonOnly);
  });
  // Admin bỏ ★ món cuối cùng → không còn chế độ Thường dùng, tự về cả kho.
  const query = useMemo(() => (hasCommon || !rawQuery.commonOnly ? rawQuery : { ...rawQuery, commonOnly: false }), [rawQuery, hasCommon]);
  const [page, setPage] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(opened0?.code ?? null);
  const selectionRaw = useSyncExternalStore(subscribeSelection, readRaw, () => '[]');
  const selected = useMemo(() => {
    try {
      return sanitizeSelection(JSON.parse(selectionRaw), new Set(initialItems.map((i) => i.code)));
    } catch {
      return [];
    }
  }, [selectionRaw, initialItems]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [compareKind, setCompareKind] = useState<ComponentKind | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Tăng khi xoá lọc để ô khoảng số (không điều khiển) trống lại. */
  const [resetKey, setResetKey] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (compareKind) setCompareKind(null);
      else if (openCode) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = {
    kind: (k: ComponentKind) => tc(`kinds.${k}`),
    spec: (key: string) => (tc.has(`spec.${key}`) ? tc(`spec.${key}`) : key),
    value: (key: string, v: string) => (tv.has(`${key}.${v}`) ? tv(`${key}.${v}`) : v),
  };
  const fmtValues = (kind: ComponentKind, key: string, values: string[]) => {
    const unit = specField(kind, key)?.unit;
    return `${values.map((v) => label.value(key, v)).join(', ')}${unit ? ` ${unit}` : ''}`;
  };
  const money = (n: number | null | undefined) => (n == null ? null : `${new Intl.NumberFormat('vi-VN').format(n)} ₫`);

  const kinds = kindCounts(items, query.commonOnly);
  const results = useMemo(() => filterItems(items, query), [items, query]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const shown = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const filters = CATALOG_FILTERS[query.kind] ?? [];
  const filtered =
    query.text !== '' ||
    query.brands.length > 0 ||
    Object.values(query.options).some((v) => v.length) ||
    Object.values(query.ranges).some((r) => r.min !== null || r.max !== null);

  const update = (next: Partial<CatalogQuery>) => {
    setQuery((q) => ({ ...q, ...next }));
    setPage(0);
  };
  const setMode = (commonOnly: boolean) => {
    const available = kindCounts(items, commonOnly);
    const kind = available.some((k) => k.kind === query.kind) ? query.kind : (available[0]?.kind ?? query.kind);
    setQuery(emptyQuery(kind, commonOnly));
    setPage(0);
  };
  const toggleOption = (key: string, value: string) => {
    const current = query.options[key] ?? [];
    update({ options: { ...query.options, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] } });
  };
  const setRange = (key: string, side: 'min' | 'max', raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
    const current = query.ranges[key] ?? { min: null, max: null };
    update({ ranges: { ...query.ranges, [key]: { ...current, [side]: Number.isFinite(n) ? n : null } } });
  };

  const choose = (code: string) => writeStored(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  const clearSelection = () => {
    writeStored([]);
    setTrayOpen(false);
  };

  const open = (code: string) => {
    setOpenCode(code);
    setCopied(false);
    setCodeInUrl(code);
  };
  function close() {
    setOpenCode(null);
    setCodeInUrl(null);
  }

  const star = (item: CatalogItem) => {
    const next = !item.is_common;
    const apply = (value: boolean) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, is_common: value } : i)));
    apply(next);
    setStarError(null);
    if (!persistStar) return;
    startTransition(async () => {
      const result = await toggleCommonAction(item.id, next);
      if (!result.ok) {
        apply(!next);
        setStarError(t('starError', { error: result.error ?? '' }));
      }
    });
  };

  const selectedItems = selected.map((c) => byCode.get(c)).filter((i): i is CatalogItem => Boolean(i));
  const compareable = comparableKinds(selectedItems);
  const exportHref = (() => {
    const [path, qs] = exportPath.split('?');
    const params = new URLSearchParams(qs);
    params.set('ma', selected.join(','));
    return `${path}?${params.toString()}`;
  })();
  const openItem = openCode ? byCode.get(openCode) ?? null : null;

  if (!items.length) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t('emptyCatalog')}</p>;
  }

  const starButton = (item: CatalogItem) =>
    admin ? (
      <button
        type="button"
        onClick={() => star(item)}
        aria-pressed={Boolean(item.is_common)}
        title={item.is_common ? t('unstar') : t('star')}
        aria-label={item.is_common ? t('unstar') : t('star')}
        className={`grid size-8 shrink-0 place-items-center rounded-md text-lg leading-none hover:bg-amber-50 dark:hover:bg-amber-950/40 ${
          item.is_common ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'
        }`}
      >
        {item.is_common ? '★' : '☆'}
      </button>
    ) : item.is_common ? (
      <span title={t('common')} className="grid size-8 shrink-0 place-items-center text-lg leading-none text-amber-500">
        ★
      </span>
    ) : (
      <span className="size-8 shrink-0" />
    );

  const filterPanel = (
    <div className="space-y-5">
      <FilterGroup title={t('brand')}>
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
          {brandFacets(items, query).map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={query.brands.includes(f.value)}
              onClick={() =>
                update({ brands: query.brands.includes(f.value) ? query.brands.filter((b) => b !== f.value) : [...query.brands, f.value] })
              }
              className={chip(query.brands.includes(f.value))}
            >
              {f.value} <span className="opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      {filters.map((def) =>
        def.type === 'options' ? (
          // Kho chưa ai khai thông số này cho loại đang xem → bỏ nhóm lọc.
          optionFacets(items, query, def.key).length === 0 ? null : (
          <FilterGroup key={def.key} title={label.spec(def.key)}>
            <div className="flex flex-wrap gap-1.5">
              {optionFacets(items, query, def.key).map((f) => {
                const active = (query.options[def.key] ?? []).includes(f.value);
                return (
                  <button key={f.value} type="button" aria-pressed={active} onClick={() => toggleOption(def.key, f.value)} className={chip(active)}>
                    {label.value(def.key, f.value)} <span className="opacity-70">{f.count}</span>
                  </button>
                );
              })}
            </div>
          </FilterGroup>
          )
        ) : rangeBounds(items, query.kind, def.key) === null ? null : (
          <RangeFilter
            key={`${query.kind}-${def.key}-${resetKey}`}
            title={`${label.spec(def.key)}${specField(query.kind, def.key)?.unit ? ` (${specField(query.kind, def.key)!.unit})` : ''}`}
            bounds={rangeBounds(items, query.kind, def.key)}
            value={query.ranges[def.key] ?? { min: null, max: null }}
            onChange={(side, raw) => setRange(def.key, side, raw)}
            fromLabel={t('from')}
            toLabel={t('to')}
          />
        )
      )}

      {filtered ? (
        <button
          type="button"
          onClick={() => {
            update({ text: '', brands: [], options: {}, ranges: {} });
            setResetKey((k) => k + 1);
          }}
          className={btn}
        >
          {t('clearFilters')}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={selected.length ? 'pb-24' : ''}>
      {/* Chế độ xem + tìm chữ */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" className="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
          {[true, false].map((common) => (
            <button
              key={String(common)}
              type="button"
              aria-pressed={query.commonOnly === common}
              disabled={common && !hasCommon}
              onClick={() => setMode(common)}
              className={`px-3 py-1.5 text-sm disabled:opacity-40 ${
                query.commonOnly === common ? 'bg-sky-600 font-medium text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {common ? `★ ${t('modeCommon')}` : t('modeAll')}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={t('search')}
          aria-label={t('search')}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 sm:max-w-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400">{t('results', { count: results.length })}</span>
      </div>

      {!hasCommon ? (
        <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">
          {t('noCommon')} {admin ? t('noCommonAdmin') : null}
        </p>
      ) : null}
      {starError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{starError}</p> : null}

      {/* Tab loại thiết bị */}
      <nav className="mt-4 flex flex-wrap gap-2" aria-label={tc('filterLabel')}>
        {kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            aria-current={query.kind === k.kind ? 'page' : undefined}
            onClick={() => {
              setQuery(emptyQuery(k.kind, query.commonOnly));
              setPage(0);
            }}
            className={chip(query.kind === k.kind).replace('text-[13px]', 'text-sm')}
          >
            {label.kind(k.kind)} <span className="opacity-70">{k.count}</span>
          </button>
        ))}
      </nav>

      <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Điện thoại: bộ lọc gập lại; máy tính: cột trái */}
        <details className="rounded-xl border border-slate-200 bg-white p-4 lg:hidden dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">{t('filters')}</summary>
          <div className="mt-4">{filterPanel}</div>
        </details>
        <aside className="hidden lg:block">{filterPanel}</aside>

        <div className="min-w-0">
          {shown.length ? (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {shown.map((item) => {
                const isSelected = selected.includes(item.code);
                return (
                  <li key={item.id} className={`flex items-start gap-2 px-3 py-2.5 ${isSelected ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => choose(item.code)}
                      aria-label={t('select', { name: `${item.brand} ${item.model}` })}
                      className="mt-2 size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                    />
                    {starButton(item)}
                    <button type="button" onClick={() => open(item.code)} className="min-w-0 flex-1 rounded-md text-left hover:bg-slate-50 sm:flex sm:items-start sm:gap-4 dark:hover:bg-slate-800/60">
                      <div className="min-w-0 flex-1 px-1 py-0.5">
                        <div className="text-sm">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{item.brand}</span>{' '}
                          <span className="text-slate-700 dark:text-slate-300">{item.model}</span>
                        </div>
                        <div className="font-mono text-[12px] text-slate-400">{item.code}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {summaryPairs(item).map((p) => (
                            <span key={p.key} className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {fmtValues(item.kind, p.key, p.values)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 px-1 pb-1 sm:flex-col sm:items-end sm:py-0.5">
                        <span className="whitespace-nowrap font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">{money(item.price_vnd) ?? '—'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${SOURCE_STYLES[item.source] ?? SOURCE_STYLES.unverified}`}>
                          {tc(`sources.${item.source}`)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">{t('empty')}</p>
          )}

          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button type="button" className={btn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                {t('prev')}
              </button>
              <span className="text-slate-500 dark:text-slate-400">{t('page', { page: page + 1, pages })}</span>
              <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                {t('next')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Giỏ "Đã chọn" (Q5) */}
      {selectedItems.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            {trayOpen ? (
              <ul className="mb-3 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
                {selectedItems.map((item) => (
                  <li key={item.code} className="flex items-center gap-3 py-1.5">
                    <span className="w-28 shrink-0 text-[13px] text-slate-500 dark:text-slate-400">{label.kind(item.kind)}</span>
                    <button type="button" onClick={() => open(item.code)} className="min-w-0 flex-1 truncate text-left hover:text-sky-700 dark:hover:text-sky-400">
                      <span className="font-medium">{item.brand}</span> {item.model}
                    </button>
                    <button type="button" onClick={() => choose(item.code)} className="text-[13px] text-slate-500 hover:text-red-600">
                      {t('tray.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('tray.title', { count: selectedItems.length })}</span>
              <button type="button" className={btn} onClick={() => setTrayOpen((o) => !o)}>
                {trayOpen ? t('tray.hide') : t('tray.show')}
              </button>
              {compareable.length ? (
                compareable.map((kind) => (
                  <button key={kind} type="button" className={btn} onClick={() => setCompareKind(kind)}>
                    {t('tray.compare', { kind: label.kind(kind) })}
                  </button>
                ))
              ) : (
                <span className="text-[13px] text-slate-500 dark:text-slate-400">{t('tray.compareHint')}</span>
              )}
              <a href={exportHref} className={btnPrimary}>
                {t('tray.export')}
              </a>
              <button type="button" className="ml-auto text-[13px] text-slate-500 hover:text-red-600" onClick={clearSelection}>
                {t('tray.clear')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Khung thông số (Q4) */}
      {openItem ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${openItem.brand} ${openItem.model}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:max-w-lg dark:bg-slate-900"
          >
            <div className="flex items-start gap-3 border-b border-slate-200 bg-[#E4E5F6] px-5 py-4 dark:border-slate-800 dark:bg-[#22274A]">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-slate-500 dark:text-slate-400">{label.kind(openItem.kind)}</div>
                <h2 className="text-[17px] font-semibold text-indigo-950 dark:text-indigo-100">
                  {openItem.brand} {openItem.model}
                </h2>
                <div className="font-mono text-[13px] text-slate-500 dark:text-slate-400">{openItem.code}</div>
              </div>
              {starButton(openItem)}
              <button type="button" onClick={close} aria-label={t('detail.close')} className="grid size-8 place-items-center rounded-md text-xl leading-none text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800">
                ×
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={selected.includes(openItem.code) ? btn : btnPrimary} onClick={() => choose(openItem.code)}>
                  {selected.includes(openItem.code) ? t('detail.remove') : t('detail.add')}
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href).then(
                      () => setCopied(true),
                      () => setCopied(false)
                    );
                  }}
                >
                  {copied ? t('detail.copied') : t('detail.copyLink')}
                </button>
                {openItem.datasheet_url ? (
                  <a href={openItem.datasheet_url} target="_blank" rel="noopener noreferrer" className={btn}>
                    {t('detail.datasheet')} ↗
                  </a>
                ) : null}
              </div>

              {openItem.source === 'unverified' ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t('detail.unverifiedNote')}</p>
              ) : null}

              <section>
                <h3 className="mb-1.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400">{t('detail.specs')}</h3>
                {specPairs(openItem).length ? (
                  <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    {specPairs(openItem).map(({ field, values }) => (
                      <div key={field.key} className="flex gap-3 py-1.5">
                        <dt className="w-1/2 shrink-0 text-slate-600 dark:text-slate-400">{label.spec(field.key)}</dt>
                        <dd className="min-w-0 flex-1 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{fmtValues(openItem.kind, field.key, values)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500">{t('detail.noSpecs')}</p>
                )}
                {missingSpecCount(openItem) ? <p className="mt-1.5 text-[13px] text-slate-400">{t('detail.missing', { count: missingSpecCount(openItem) })}</p> : null}
              </section>

              <section>
                <h3 className="mb-1.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400">{t('detail.buying')}</h3>
                <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {[
                    [t('detail.price'), money(openItem.price_vnd)],
                    [t('detail.supplier'), openItem.supplier],
                    [t('detail.leadTime'), openItem.lead_time_days == null ? null : t('detail.days', { count: openItem.lead_time_days })],
                    [t('detail.usedIn'), String(openItem.used_in_projects ?? 0)],
                    [t('detail.source'), tc(`sources.${openItem.source}`)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1.5">
                      <dt className="w-1/2 shrink-0 text-slate-600 dark:text-slate-400">{k}</dt>
                      <dd className={`min-w-0 flex-1 text-right ${v ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>{v ?? t('detail.unknown')}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {(locale === 'en' ? openItem.notes_en || openItem.notes_vi : openItem.notes_vi || openItem.notes_en) ? (
                <section>
                  <h3 className="mb-1.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400">{t('detail.notes')}</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {locale === 'en' ? openItem.notes_en || openItem.notes_vi : openItem.notes_vi || openItem.notes_en}
                  </p>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* So sánh (Q5) */}
      {compareKind ? (
        <CompareDialog
          items={selectedItems.filter((i) => i.kind === compareKind)}
          title={t('compare.title', { kind: label.kind(compareKind) })}
          onClose={() => setCompareKind(null)}
          labels={{ spec: label.spec, fmt: (key, values) => fmtValues(compareKind, key, values), money, source: (s) => tc(`sources.${s}`) }}
          text={{
            onlyFirst: t('compare.onlyFirst', { max: COMPARE_MAX }),
            differ: t('compare.differ'),
            close: t('compare.close'),
            price: t('detail.price'),
            source: t('detail.source'),
          }}
        />
      ) : null}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function RangeFilter({
  title,
  bounds,
  value,
  onChange,
  fromLabel,
  toLabel,
}: {
  title: string;
  bounds: { min: number; max: number } | null;
  value: { min: number | null; max: number | null };
  onChange: (side: 'min' | 'max', raw: string) => void;
  fromLabel: string;
  toLabel: string;
}) {
  const input =
    'w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900';
  return (
    <FilterGroup title={title}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          aria-label={`${title} ${fromLabel}`}
          placeholder={bounds ? String(bounds.min) : fromLabel}
          defaultValue={value.min ?? ''}
          onChange={(e) => onChange('min', e.target.value)}
          className={input}
        />
        <span className="text-[13px] text-slate-400">–</span>
        <input
          type="number"
          inputMode="decimal"
          aria-label={`${title} ${toLabel}`}
          placeholder={bounds ? String(bounds.max) : toLabel}
          defaultValue={value.max ?? ''}
          onChange={(e) => onChange('max', e.target.value)}
          className={input}
        />
      </div>
    </FilterGroup>
  );
}

function CompareDialog({
  items,
  title,
  onClose,
  labels,
  text,
}: {
  items: CatalogItem[];
  title: string;
  onClose: () => void;
  labels: { spec: (key: string) => string; fmt: (key: string, values: string[]) => string; money: (n: number | null | undefined) => string | null; source: (s: string) => string };
  text: { onlyFirst: string; differ: string; close: string; price: string; source: string };
}) {
  const list = items.slice(0, COMPARE_MAX);
  const rows = compareRows(list);
  const cell = 'px-3 py-1.5 align-top';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-[#E4E5F6] px-5 py-3 dark:border-slate-800 dark:bg-[#22274A]">
          <h2 className="flex-1 text-[15px] font-semibold text-indigo-950 dark:text-indigo-100">{title}</h2>
          <button type="button" onClick={onClose} aria-label={text.close} className="grid size-8 place-items-center rounded-md text-xl leading-none text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800">
            ×
          </button>
        </div>
        <div className="px-5 py-3 text-[13px] text-slate-500 dark:text-slate-400">
          {text.differ} {items.length > COMPARE_MAX ? text.onlyFirst : null}
        </div>
        <div className="overflow-x-auto px-2 pb-4">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={`${cell} w-44`} />
                {list.map((item) => (
                  <th key={item.code} className={`${cell} font-normal`}>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.brand}</div>
                    <div className="text-slate-700 dark:text-slate-300">{item.model}</div>
                    <div className="font-mono text-[12px] text-slate-400">{item.code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className={`${cell} text-slate-600 dark:text-slate-400`}>{text.price}</td>
                {list.map((item) => (
                  <td key={item.code} className={`${cell} font-mono tabular-nums`}>
                    {labels.money(item.price_vnd) ?? '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`${cell} text-slate-600 dark:text-slate-400`}>{text.source}</td>
                {list.map((item) => (
                  <td key={item.code} className={cell}>
                    {labels.source(item.source)}
                  </td>
                ))}
              </tr>
              {rows.map((row) => (
                <tr key={row.key} className={row.differs ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}>
                  <td className={`${cell} text-slate-600 dark:text-slate-400`}>{labels.spec(row.key)}</td>
                  {row.cells.map((values, i) => (
                    <td key={i} className={`${cell} font-mono tabular-nums text-slate-900 dark:text-slate-100`}>
                      {values.length ? labels.fmt(row.key, values) : <span className="text-slate-400">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
