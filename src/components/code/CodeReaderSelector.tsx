'use client';

import { ActionLink } from '@/components/ui/ActionLink';
import { Icon } from '@/components/ui/Icon';
import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { useShowFormulas } from '@/components/ui/FormulaVisibility';
import { specList, specString, type Component } from '@/lib/components/specs';
import type { AreaCandidate, CameraParams } from '@/lib/vision/cameraSelector';
import { CODE_TYPES, codeNeed, selectCodeCameras, selectReaders, type CodeReaderInput, type CodeType, type ReaderCandidate } from '@/lib/vision/codeReader';
import { DEFAULT_ENGINE_PARAMS } from '@/lib/vision/engineParams';
import { renderFormula } from '@/lib/vision/formulaTerms';
import type { Check, CheckStatus } from '@/lib/vision/types';

/**
 * Giao diện Bộ chọn đầu đọc mã (chốt 2026-10-27, Q1–Q8). Không tính gì ở đây — mọi con số
 * đến từ `@/lib/vision/codeReader` (hướng camera dùng lại bộ kiểm của trang Chọn camera).
 * Luồng giống trang Chọn camera: nhập → "Thông số cần" tính ngay → bấm "Hiển thị kết quả".
 */

type Tab = 'reader' | 'camera';

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200';
const cell = 'py-2 pr-4 whitespace-nowrap tabular-nums';
const th = 'py-2 pr-4 font-medium';

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  info: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  fail: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
};

const PAGE = 30;
const TABS: Tab[] = ['reader', 'camera'];

const num = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const num0 = (value: string): number => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : 0;
};
const show = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : String(Math.round(value * 10 ** digits) / 10 ** digits);

function StatusBadge({ status }: { status: CheckStatus }) {
  const t = useTranslations('codeReader.status');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>{t(status)}</span>;
}

export function CodeReaderSelector({ components, params = DEFAULT_ENGINE_PARAMS }: { components: Component[]; params?: CameraParams }) {
  const t = useTranslations('codeReader');
  const showFormulas = useShowFormulas();
  const readers = useMemo(() => components.filter((c) => c.kind === 'code_reader'), [components]);
  const cameras = useMemo(() => components.filter((c) => c.kind === 'camera'), [components]);

  const empty = useMemo(
    () => ({ codeType: 'datamatrix' as CodeType, module: '', codeW: '', codeH: '', tolX: '', tolY: '', speed: '', axis: 'x' as 'x' | 'y', fovAlong: '', ppm: '', reads: String(params.codeMinReads), wd: '' }),
    [params.codeMinReads]
  );
  const [tab, setTab] = useState<Tab>(readers.length > 0 ? 'reader' : 'camera');
  const [form, setForm] = useState(empty);
  const [showRejected, setShowRejected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const set = (key: keyof typeof empty) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const input = useMemo<CodeReaderInput | null>(() => {
    const moduleMm = num(form.module);
    const codeWidthMm = num(form.codeW);
    const codeHeightMm = num(form.codeH) ?? (form.codeType === 'datamatrix' || form.codeType === 'qr' || form.codeType === 'dpm' ? codeWidthMm : null);
    if (moduleMm === null || codeWidthMm === null || codeHeightMm === null) return null;
    return {
      codeType: form.codeType,
      moduleMm,
      codeWidthMm,
      codeHeightMm,
      toleranceXMm: num0(form.tolX),
      toleranceYMm: num0(form.tolY),
      speedMmS: num(form.speed),
      motionAxis: form.axis,
      fovAlongMm: num(form.fovAlong),
      partsPerMinute: num(form.ppm),
      minReads: Math.max(1, Math.round(num(form.reads) ?? params.codeMinReads)),
      workingDistanceMm: num(form.wd),
    };
  }, [form, params.codeMinReads]);
  const need = useMemo(() => (input ? codeNeed(input, params) : null), [input, params]);

  const inputKey = JSON.stringify(input);
  const [shown, setShown] = useState<{ key: string; input: CodeReaderInput } | null>(null);
  const stale = shown !== null && shown.key !== inputKey;
  const showResults = () => {
    if (!input) return;
    setShown({ key: inputKey, input });
    setLimit(PAGE);
    setOpen(null);
  };
  const readerResult = useMemo(() => (shown ? selectReaders(readers, shown.input, params) : null), [shown, readers, params]);
  const cameraResult = useMemo(() => (shown ? selectCodeCameras(cameras, shown.input, params) : null), [shown, cameras, params]);
  const all: (ReaderCandidate | AreaCandidate)[] = (tab === 'reader' ? readerResult : cameraResult) ?? [];
  const counts = { pass: 0, warn: 0, info: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const c of all) counts[c.status]++;
  const visible = showRejected ? all : all.filter((c) => c.status !== 'fail');

  const reset = () => {
    setForm(empty);
    setShown(null);
    setShowRejected(false);
    setLimit(PAGE);
    setOpen(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          ↺ {t('reset')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="code-task" title={t('task.title')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput id="code-type" label={t('task.codeType')} value={form.codeType} options={CODE_TYPES} labelOf={(v) => t(`codeType.${v}`)} onChange={set('codeType')} />
            <NumberInput id="code-module" label={t('task.module')} hint={t('task.moduleHint')} value={form.module} onChange={set('module')} step="0.01" />
            <NumberInput id="code-w" label={t('task.codeWidth')} value={form.codeW} onChange={set('codeW')} />
            <NumberInput id="code-h" label={t('task.codeHeight')} hint={form.codeType === 'barcode_1d' ? undefined : t('task.codeHeightHint')} value={form.codeH} onChange={set('codeH')} />
            <NumberInput id="code-tol-x" label={t('task.tolX')} value={form.tolX} onChange={set('tolX')} />
            <NumberInput id="code-tol-y" label={t('task.tolY')} value={form.tolY} onChange={set('tolY')} />
          </div>
        </Panel>

        <Panel id="code-speed" title={t('speed.title')} note={t('speed.note')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput id="code-speed-v" label={t('speed.speed')} value={form.speed} onChange={set('speed')} />
            <SelectInput id="code-axis" label={t('speed.axis')} value={form.axis} options={['x', 'y'] as const} labelOf={(v) => t(`axis.${v}`)} onChange={set('axis')} />
            <NumberInput id="code-fov-along" label={t('speed.fovAlong')} hint={t('speed.fovAlongHint')} value={form.fovAlong} onChange={set('fovAlong')} />
            <NumberInput id="code-reads" label={t('speed.reads')} hint={t('speed.readsHint')} value={form.reads} onChange={set('reads')} step="1" />
            <NumberInput id="code-ppm" label={t('speed.ppm')} value={form.ppm} onChange={set('ppm')} />
            <NumberInput id="code-wd" label={t('speed.wd')} hint={t('speed.wdHint')} value={form.wd} onChange={set('wd')} />
          </div>
        </Panel>
      </div>

      <Panel id="code-need" title={t('need.title')}>
        {need ? (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <NeedItem label={t('need.mmPerPx')} value={`${show(need.mmPerPx, 4)} mm/px`} note={t('need.mmPerPxNote', { ppm: need.pxPerModule })} />
            <NeedItem label={t('need.fov')} value={`${show(need.fovWidthMm, 1)} × ${show(need.fovHeightMm, 1)} mm`} note={need.readWindowMm !== null ? t('need.fovMovingNote', { window: show(need.readWindowMm, 1) }) : t('need.fovNote')} />
            <NeedItem label={t('need.pixels')} value={`${need.pxW} × ${need.pxH} px`} note={t('need.megapixels', { mp: show(need.megapixels, 2) })} />
            <NeedItem
              label={t('need.fps')}
              value={need.fpsNeeded !== null ? `${show(need.fpsNeeded, 1)} ${t('need.perSecond')}` : '—'}
              note={
                need.fpsForReads !== null
                  ? t('need.fpsReadsNote', { reads: input!.minReads, window: show(need.readWindowMm, 1), fps: show(need.fpsForReads, 1) })
                  : need.fpsFromRate !== null
                    ? t('need.fpsRateNote')
                    : t('need.fpsMissing')
              }
            />
            <NeedItem label={t('need.exposure')} value={need.exposureMaxUs !== null ? `${show(need.exposureMaxUs, 0)} µs` : '—'} note={need.exposureMaxUs === null ? t('need.exposureStatic') : t('need.exposureNote')} />
            <NeedItem
              label={t('need.strobe')}
              value={need.exposureMaxUs === null ? '—' : need.strobeRequired ? t('need.strobeYes') : t('need.strobeNo')}
              status={need.exposureMaxUs === null ? undefined : need.strobeRequired ? 'warn' : 'pass'}
            />
          </dl>
        ) : (
          <p className={NOTE_CLASS}>{t('need.missing')}</p>
        )}
        {need && form.codeType === 'dpm' ? (
          <p className={`mt-3 ${NOTE_CLASS}`}>
            {t('need.dpmLight')}{' '}
            <ActionLink href="/chon-den" variant="text">
              {t('need.toLight')}
            </ActionLink>
          </p>
        ) : null}
      </Panel>

      {input ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={showResults} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
            {t('list.showResults')}
          </button>
          {stale ? <span className="text-sm text-amber-700 dark:text-amber-300">{t('list.stale')}</span> : null}
        </div>
      ) : null}

      {shown ? (
        <Panel
          id="code-list"
          title={t('list.title')}
          meta={t('list.meta', counts)}
          actions={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div role="tablist" aria-label={t('tabs.label')} className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                {TABS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => {
                      setTab(value);
                      setLimit(PAGE);
                      setOpen(null);
                    }}
                    className={`rounded px-2.5 py-1 font-medium ${tab === value ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    {t(`tabs.${value}`, { n: value === 'reader' ? readers.length : cameras.filter((c) => specString(c.spec, 'camera_type') !== 'line').length })}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="size-4 rounded border-slate-300 text-sky-600 dark:border-slate-600" />
                {t('list.showRejected')}
              </label>
            </div>
          }
          bodyClassName={stale ? 'opacity-50 transition-opacity' : 'transition-opacity'}
        >
          {visible.length === 0 ? (
            <p className={`px-4 py-4 sm:px-5 ${NOTE_CLASS}`}>{t(all.length === 0 ? (tab === 'reader' ? 'list.noReaders' : 'list.noCameras') : 'list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {tab === 'reader' ? (
                    <tr>
                      <th scope="col" className={`min-w-48 pl-4 ${th}`}>{t('list.colReader')}</th>
                      <th scope="col" className={th}>{t('list.colResolution')}</th>
                      <th scope="col" className={th}>{t('list.colAov')}</th>
                      <th scope="col" className={th}>{t('list.colWd')}</th>
                      <th scope="col" className={th}>{t('list.colMmPerPx')}</th>
                      <th scope="col" className={th}>{t('list.colFov')}</th>
                      <th scope="col" className={th}>{t('list.colDecode')}</th>
                      <th scope="col" className={th}>{t('list.colTypes')}</th>
                      <th scope="col" className={th}>{t('list.colFocus')}</th>
                      <th scope="col" className={th}>{t('list.colStatus')}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="col" className={`min-w-48 pl-4 ${th}`}>{t('list.colCamera')}</th>
                      <th scope="col" className={th}>{t('list.colResolution')}</th>
                      <th scope="col" className={th}>{t('list.colPixel')}</th>
                      <th scope="col" className={th}>{t('list.colMmPerPx')}</th>
                      <th scope="col" className={th}>{t('list.colMargin')}</th>
                      <th scope="col" className={th}>{t('list.colFps')}</th>
                      <th scope="col" className={th}>{t('list.colData')}</th>
                      <th scope="col" className={th}>{t('list.colInterface')}</th>
                      <th scope="col" className={th}>{t('list.colShutter')}</th>
                      <th scope="col" className={th}>{t('list.colStatus')}</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <ResultRow
                      key={c.component.id}
                      candidate={c}
                      kind={tab}
                      open={open === c.component.id}
                      onToggle={() => setOpen(open === c.component.id ? null : c.component.id)}
                      showFormulas={showFormulas}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visible.length > 0 ? <p className={`border-t border-slate-100 px-4 py-2 sm:px-5 dark:border-slate-800 ${NOTE_CLASS}`}>{t(tab === 'reader' ? 'list.footReader' : 'list.footCamera')}</p> : null}
          {visible.length > limit ? (
            <div className="border-t border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
              <button type="button" onClick={() => setLimit(limit + PAGE)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                {t('list.showMore', { n: Math.min(PAGE, visible.length - limit) })}
              </button>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

function NumberInput({ id, label, hint, value, onChange, step = 'any' }: { id: string; label: string; hint?: string; value: string; onChange: (value: string) => void; step?: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      {hint ? <p className={`mt-1 ${NOTE_CLASS}`}>{hint}</p> : null}
    </div>
  );
}

function SelectInput<V extends string>({ id, label, value, options, labelOf, onChange }: { id: string; label: string; value: V; options: readonly V[]; labelOf: (value: V) => string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`}>
        {options.map((o) => (
          <option key={o} value={o}>{labelOf(o)}</option>
        ))}
      </select>
    </div>
  );
}

function NeedItem({ label, value, note, status }: { label: string; value: string; note?: string; status?: CheckStatus }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
        {value}
        {status ? <StatusBadge status={status} /> : null}
      </dd>
      {note ? <dd className={`mt-0.5 ${NOTE_CLASS}`}>{note}</dd> : null}
    </div>
  );
}

/** Danh sách phép kiểm — câu chữ của đầu đọc ở codeReader.*, của camera ở cameraSelector.* (dùng chung bộ kiểm). */
function CheckList({ checks, showFormulas, namespace }: { checks: Check[]; showFormulas: boolean; namespace: 'codeReader' | 'cameraSelector' }) {
  const t = useTranslations(namespace);
  const tv = useTranslations('selector.vision');
  return (
    <ul className="space-y-2">
      {checks.map((check, i) => (
        <li key={`${check.key}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <StatusBadge status={check.status} />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t(`checks.${check.key}`)}</span>
          {showFormulas ? <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{renderFormula(check.formula, (key) => tv(`formulaTerms.${key}`))}</span> : null}
          {check.noteKey ? <span className="w-full text-sm text-slate-600 dark:text-slate-300">{t(`notes.${check.noteKey}`, check.noteValues ?? {})}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ResultRow({ candidate: c, kind, open, onToggle, showFormulas }: { candidate: ReaderCandidate | AreaCandidate; kind: Tab; open: boolean; onToggle: () => void; showFormulas: boolean }) {
  const t = useTranslations('codeReader');
  const tc = useTranslations('cameraSelector');
  const spec = c.component.spec;
  const toggle = (
    <div className="flex items-center gap-2">
      <StatusBadge status={c.status} />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? t('list.hide') : t('list.details')}
        title={open ? t('list.hide') : t('list.details')}
        className="inline-flex size-6 items-center justify-center rounded-full text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950"
      >
        <Icon name="arrowRight" className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
    </div>
  );
  const name = (
    <td className="py-2 pl-4 pr-4">
      <button type="button" onClick={onToggle} aria-expanded={open} className="text-left font-medium text-slate-900 hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-400">
        {c.component.brand} {c.component.model}
      </button>
      {c.component.code !== c.component.model ? <div className={NOTE_CLASS}>{c.component.code}</div> : null}
    </td>
  );

  let cells;
  if (kind === 'reader') {
    const r = c as ReaderCandidate;
    const wd = r.wdRange ? `${show(r.wdRange.minMm, 0)}–${Number.isFinite(r.wdRange.maxMm) ? show(r.wdRange.maxMm, 0) : '∞'}` : r.wdUsedMm !== null ? show(r.wdUsedMm, 0) : '—';
    cells = (
      <>
        {name}
        <td className={cell}>{r.pxLong !== null ? `${r.pxLong} × ${r.pxShort}` : '—'}</td>
        <td className={cell}>{r.aovLongDeg !== null ? `${show(r.aovLongDeg, 1)}° × ${show(r.aovShortDeg, 1)}°` : '—'}</td>
        <td className={cell}>{wd}</td>
        <td className={cell}>{show(r.mmPerPx, 4)}</td>
        <td className={cell}>{r.fovLongMm !== null ? `${show(r.fovLongMm, 1)} × ${show(r.fovShortMm, 1)}` : '—'}</td>
        <td className={cell}>{r.decodeRateHz !== null ? show(r.decodeRateHz, 0) : '—'}</td>
        <td className={cell}>{specList(spec, 'code_types').join(', ') || '—'}</td>
        <td className={cell}>{specString(spec, 'focus') ? t(`focus.${specString(spec, 'focus')}`) : '—'}</td>
        <td className="py-2 pr-4">{toggle}</td>
      </>
    );
  } else {
    const a = c as AreaCandidate;
    const iface = a.camera.interfaceName ? `${a.camera.interfaceName}${(a.camera.lanes ?? 1) > 1 ? ` × ${a.camera.lanes}` : ''}` : '—';
    cells = (
      <>
        {name}
        <td className={cell}>{a.camera.widthPx && a.camera.heightPx ? `${a.camera.widthPx} × ${a.camera.heightPx}` : '—'}</td>
        <td className={cell}>{a.camera.pixelSizeUm !== null ? `${show(a.camera.pixelSizeUm, 2)} µm` : '—'}</td>
        <td className={cell}>{show(a.mmPerPx, 4)}</td>
        <td className={cell}>{a.margin !== null ? `${show(a.margin, 2)}×` : '—'}</td>
        <td className={cell}>
          {a.fpsReal !== null ? show(a.fpsReal, 1) : '—'}
          {a.fpsNeeded !== null ? <span className="text-slate-500"> / {show(a.fpsNeeded, 1)}</span> : null}
          {a.fpsLimiter !== null && a.fpsLimiter !== 'sensor' ? <div className={NOTE_CLASS}>{tc(`limiter.${a.fpsLimiter}`)}</div> : null}
        </td>
        <td className={cell}>{a.dataRateMBs !== null ? show(a.dataRateMBs, 1) : '—'}</td>
        <td className={cell}>{iface}</td>
        <td className={cell}>{specString(spec, 'shutter') ? tc(`shutter.${specString(spec, 'shutter')}`) : '—'}</td>
        <td className="py-2 pr-4">{toggle}</td>
      </>
    );
  }

  return (
    <Fragment>
      <tr className={c.status === 'fail' ? 'opacity-60' : undefined}>{cells}</tr>
      {open ? (
        <tr className="bg-slate-50/60 dark:bg-slate-900/60">
          <td colSpan={10} className="px-4 py-3">
            {kind === 'camera' ? <p className={`mb-3 ${NOTE_CLASS}`}>{t('list.cameraHint')}</p> : null}
            <CheckList checks={c.checks} showFormulas={showFormulas} namespace={kind === 'reader' ? 'codeReader' : 'cameraSelector'} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {kind === 'camera' ? (
                <ActionLink href="/chon-ong-kinh" variant="text">
                  {t('list.toLens')}
                </ActionLink>
              ) : null}
              {c.component.datasheet_url ? (
                <ActionLink href={c.component.datasheet_url} external variant="text">
                  {t('list.datasheet')}
                </ActionLink>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
