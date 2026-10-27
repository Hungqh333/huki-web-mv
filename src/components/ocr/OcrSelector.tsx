'use client';

import { ActionLink } from '@/components/ui/ActionLink';
import { Icon } from '@/components/ui/Icon';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { useShowFormulas } from '@/components/ui/FormulaVisibility';
import { specString, type Component } from '@/lib/components/specs';
import type { AreaCandidate, CameraParams } from '@/lib/vision/cameraSelector';
import { DEFAULT_ENGINE_PARAMS } from '@/lib/vision/engineParams';
import { renderFormula } from '@/lib/vision/formulaTerms';
import type { TriggerSource } from '@/lib/vision/highSpeed';
import { PRINT_TYPES, ocrNeed, selectOcrCameras, type OcrBackground, type OcrFont, type OcrInput, type OcrMode, type PrintType } from '@/lib/vision/ocr';
import type { CheckStatus } from '@/lib/vision/types';

/**
 * Giao diện Bộ chọn camera OCR / OCV (chốt 2026-10-27, Q5–Q7). Không tính gì ở đây — mọi
 * con số đến từ `@/lib/vision/ocr` (camera dùng lại bộ kiểm trang Chọn camera).
 * Luồng giống trang Chọn camera: nhập → "Thông số cần" tính ngay → bấm "Hiển thị kết quả".
 */

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
const MODES: OcrMode[] = ['ocr', 'ocv'];
const BACKGROUNDS: OcrBackground[] = ['plain', 'complex'];
const FONTS: OcrFont[] = ['fixed', 'varies'];
const TRIGGERS: TriggerSource[] = ['photoSensor', 'software', 'encoder'];
const EMPTY = {
  mode: 'ocr' as OcrMode,
  printType: 'inkjet' as PrintType,
  charH: '',
  stroke: '',
  textW: '',
  lines: '1',
  spacing: '',
  tolX: '',
  tolY: '',
  background: 'plain' as OcrBackground,
  font: 'fixed' as OcrFont,
  speed: '',
  ppm: '',
  trigger: 'photoSensor' as TriggerSource,
};

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
  const t = useTranslations('ocr.status');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>{t(status)}</span>;
}

export function OcrSelector({ components, params = DEFAULT_ENGINE_PARAMS }: { components: Component[]; params?: CameraParams }) {
  const t = useTranslations('ocr');
  const showFormulas = useShowFormulas();
  const cameras = useMemo(() => components.filter((c) => c.kind === 'camera'), [components]);
  const [form, setForm] = useState(EMPTY);
  const [showRejected, setShowRejected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const input = useMemo<OcrInput | null>(() => {
    const charHeightMm = num(form.charH);
    const textWidthMm = num(form.textW);
    if (charHeightMm === null || textWidthMm === null) return null;
    return {
      mode: form.mode,
      printType: form.printType,
      charHeightMm,
      strokeMm: num(form.stroke),
      textWidthMm,
      lines: Math.max(1, Math.round(num(form.lines) ?? 1)),
      lineSpacingMm: num(form.spacing),
      toleranceXMm: num0(form.tolX),
      toleranceYMm: num0(form.tolY),
      background: form.background,
      font: form.font,
      speedMmS: num(form.speed),
      partsPerMinute: num(form.ppm),
      triggerSource: form.trigger,
    };
  }, [form]);
  const need = useMemo(() => (input ? ocrNeed(input, params) : null), [input, params]);

  const inputKey = JSON.stringify(input);
  const [shown, setShown] = useState<{ key: string; input: OcrInput } | null>(null);
  const stale = shown !== null && shown.key !== inputKey;
  const showResults = () => {
    if (!input) return;
    setShown({ key: inputKey, input });
    setLimit(PAGE);
    setOpen(null);
  };
  const all = useMemo(() => (shown ? selectOcrCameras(cameras, shown.input, params).candidates : []), [shown, cameras, params]);
  const counts = { pass: 0, warn: 0, info: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const c of all) counts[c.status]++;
  const visible = showRejected ? all : all.filter((c) => c.status !== 'fail');

  const reset = () => {
    setForm(EMPTY);
    setShown(null);
    setShowRejected(false);
    setLimit(PAGE);
    setOpen(null);
  };

  const sp = need?.speed;
  const trig = sp?.trigger && sp.trigger.source !== 'encoder' ? sp.trigger : null;

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
        <Panel id="ocr-text" title={t('task.title')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput id="ocr-mode" label={t('task.mode')} value={form.mode} options={MODES} labelOf={(v) => t(`mode.${v}`)} onChange={set('mode')} />
            <SelectInput id="ocr-print" label={t('task.printType')} value={form.printType} options={PRINT_TYPES} labelOf={(v) => t(`printType.${v}`)} onChange={set('printType')} />
            <NumberInput id="ocr-char-h" label={t('task.charHeight')} value={form.charH} onChange={set('charH')} step="0.1" />
            <NumberInput id="ocr-stroke" label={t('task.stroke')} hint={t('task.strokeHint')} value={form.stroke} onChange={set('stroke')} step="0.01" />
            <NumberInput id="ocr-text-w" label={t('task.textWidth')} value={form.textW} onChange={set('textW')} />
            <NumberInput id="ocr-lines" label={t('task.lines')} value={form.lines} onChange={set('lines')} step="1" />
            <NumberInput id="ocr-spacing" label={t('task.spacing')} hint={t('task.spacingHint')} value={form.spacing} onChange={set('spacing')} step="0.1" />
            <NumberInput id="ocr-tol-x" label={t('task.tolX')} value={form.tolX} onChange={set('tolX')} />
            <NumberInput id="ocr-tol-y" label={t('task.tolY')} value={form.tolY} onChange={set('tolY')} />
            <SelectInput id="ocr-bg" label={t('task.background')} value={form.background} options={BACKGROUNDS} labelOf={(v) => t(`background.${v}`)} onChange={set('background')} />
            <SelectInput id="ocr-font" label={t('task.font')} value={form.font} options={FONTS} labelOf={(v) => t(`font.${v}`)} onChange={set('font')} />
          </div>
        </Panel>

        <Panel id="ocr-speed" title={t('speed.title')} note={t('speed.note')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput id="ocr-speed-v" label={t('speed.speed')} value={form.speed} onChange={set('speed')} />
            <NumberInput id="ocr-ppm" label={t('speed.ppm')} value={form.ppm} onChange={set('ppm')} />
            <SelectInput id="ocr-trigger" label={t('speed.trigger')} value={form.trigger} options={TRIGGERS} labelOf={(v) => t(`trigger.${v}`)} onChange={set('trigger')} />
          </div>
        </Panel>
      </div>

      <Panel id="ocr-need" title={t('need.title')}>
        {need && sp ? (
          <div className="space-y-4">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              <NeedItem
                label={t('need.mmPerPx')}
                value={`${show(need.mmPerPx, 4)} mm/px`}
                note={t(need.governedBy === 'stroke' ? 'need.byStroke' : 'need.byHeight', { char: need.pxPerChar, stroke: need.pxPerStroke })}
              />
              <NeedItem label={t('need.fov')} value={`${show(need.fovWidthMm, 1)} × ${show(need.fovHeightMm, 1)} mm`} note={t('need.fovNote', { w: show(need.blockWidthMm, 1), h: show(need.blockHeightMm, 1) })} />
              <NeedItem label={t('need.pixels')} value={`${sp.pxLong} × ${sp.pxShort} px`} note={t('need.megapixels', { mp: show(sp.megapixels, 2) })} />
              <NeedItem label={t('need.fps')} value={sp.fpsNeeded !== null ? `${show(sp.fpsNeeded, 2)} fps` : '—'} note={sp.fpsNeeded === null ? t('need.fpsMissing') : undefined} />
              <NeedItem label={t('need.exposure')} value={sp.exposureMaxUs !== null ? `${show(sp.exposureMaxUs, 0)} µs` : '—'} note={sp.exposureMaxUs === null ? t('need.exposureStatic') : t('need.exposureNote')} />
              <NeedItem
                label={t('need.strobe')}
                value={sp.exposureMaxUs === null ? '—' : sp.strobeRequired ? t('need.strobeYes') : t('need.strobeNo')}
                status={sp.exposureMaxUs === null ? undefined : sp.strobeRequired ? 'warn' : 'pass'}
              />
              {trig ? (
                <NeedItem label={t('need.trigger')} value={`±${show(trig.shiftMm, 2)} mm`} status={trig.over ? 'warn' : 'pass'} note={t('need.triggerNote', { margin: show(trig.shiftMm * 2, 2) })} />
              ) : null}
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              <Advice title={t('need.lightTitle')} text={t(`need.light.${need.light}`)} status="warn">
                <ActionLink href="/chon-den" variant="text">
                  {t('need.toLight')}
                </ActionLink>
              </Advice>
              <Advice title={t('need.algoTitle')} text={t(`need.algo.${need.algorithm}`)} status={need.algorithm === 'traditional' ? 'pass' : 'warn'} />
            </div>
            {form.mode === 'ocv' ? <p className={NOTE_CLASS}>{t('need.ocvNote')}</p> : null}
          </div>
        ) : (
          <p className={NOTE_CLASS}>{t('need.missing')}</p>
        )}
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
          id="ocr-list"
          title={t('list.title')}
          meta={t('list.meta', counts)}
          actions={
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="size-4 rounded border-slate-300 text-sky-600 dark:border-slate-600" />
              {t('list.showRejected')}
            </label>
          }
          bodyClassName={stale ? 'opacity-50 transition-opacity' : 'transition-opacity'}
        >
          {visible.length === 0 ? (
            <p className={`px-4 py-4 sm:px-5 ${NOTE_CLASS}`}>{t(all.length === 0 ? 'list.noCameras' : 'list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
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
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <CameraRow key={c.component.id} candidate={c} open={open === c.component.id} onToggle={() => setOpen(open === c.component.id ? null : c.component.id)} showFormulas={showFormulas} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visible.length > 0 ? <p className={`border-t border-slate-100 px-4 py-2 sm:px-5 dark:border-slate-800 ${NOTE_CLASS}`}>{t('list.foot')}</p> : null}
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

function Advice({ title, text, status, children }: { title: string; text: string; status: CheckStatus; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
        <StatusBadge status={status} />
        {title}
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}

/** Dòng camera — câu chữ phép kiểm dùng chung cameraSelector.* (cùng bộ kiểm trang Chọn camera). */
function CameraRow({ candidate: a, open, onToggle, showFormulas }: { candidate: AreaCandidate; open: boolean; onToggle: () => void; showFormulas: boolean }) {
  const t = useTranslations('ocr');
  const tc = useTranslations('cameraSelector');
  const tv = useTranslations('selector.vision');
  const spec = a.component.spec;
  const iface = a.camera.interfaceName ? `${a.camera.interfaceName}${(a.camera.lanes ?? 1) > 1 ? ` × ${a.camera.lanes}` : ''}` : '—';
  return (
    <Fragment>
      <tr className={a.status === 'fail' ? 'opacity-60' : undefined}>
        <td className="py-2 pl-4 pr-4">
          <button type="button" onClick={onToggle} aria-expanded={open} className="text-left font-medium text-slate-900 hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-400">
            {a.component.brand} {a.component.model}
          </button>
          {a.component.code !== a.component.model ? <div className={NOTE_CLASS}>{a.component.code}</div> : null}
        </td>
        <td className={cell}>{a.camera.widthPx && a.camera.heightPx ? `${a.camera.widthPx} × ${a.camera.heightPx}` : '—'}</td>
        <td className={cell}>{a.camera.pixelSizeUm !== null ? `${show(a.camera.pixelSizeUm, 2)} µm` : '—'}</td>
        <td className={cell}>{show(a.mmPerPx, 4)}</td>
        <td className={cell}>{a.margin !== null ? `${show(a.margin, 2)}×` : '—'}</td>
        <td className={cell}>
          {a.fpsReal !== null ? show(a.fpsReal, 1) : '—'}
          {a.fpsNeeded !== null ? <span className="text-slate-500"> / {show(a.fpsNeeded, 2)}</span> : null}
          {a.fpsLimiter !== null && a.fpsLimiter !== 'sensor' ? <div className={NOTE_CLASS}>{tc(`limiter.${a.fpsLimiter}`)}</div> : null}
        </td>
        <td className={cell}>{a.dataRateMBs !== null ? show(a.dataRateMBs, 1) : '—'}</td>
        <td className={cell}>{iface}</td>
        <td className={cell}>{specString(spec, 'shutter') ? tc(`shutter.${specString(spec, 'shutter')}`) : '—'}</td>
        <td className="py-2 pr-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={a.status} />
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
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-50/60 dark:bg-slate-900/60">
          <td colSpan={10} className="px-4 py-3">
            <p className={`mb-3 ${NOTE_CLASS}`}>{t('list.cameraHint')}</p>
            <ul className="space-y-2">
              {a.checks.map((check, i) => (
                <li key={`${check.key}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <StatusBadge status={check.status} />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{tc(`checks.${check.key}`)}</span>
                  {showFormulas ? <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{renderFormula(check.formula, (key) => tv(`formulaTerms.${key}`))}</span> : null}
                  {check.noteKey ? <span className="w-full text-sm text-slate-600 dark:text-slate-300">{tc(`notes.${check.noteKey}`, check.noteValues ?? {})}</span> : null}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <ActionLink href="/chon-ong-kinh" variant="text">
                {t('list.toLens')}
              </ActionLink>
              {a.component.datasheet_url ? (
                <ActionLink href={a.component.datasheet_url} external variant="text">
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
