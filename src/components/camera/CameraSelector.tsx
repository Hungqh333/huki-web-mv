'use client';

import { ActionLink } from '@/components/ui/ActionLink';
import { Icon } from '@/components/ui/Icon';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { useShowFormulas } from '@/components/ui/FormulaVisibility';
import { specString, type Component } from '@/lib/components/specs';
import {
  LINE_EXPOSURE_BRIGHT_US,
  areaNeed,
  selectAreaCameras,
  selectLineCameras,
  targetMmPerPx,
  type AreaCameraInput,
  type AreaCandidate,
  type CameraColorFilter,
  type CameraParams,
  type LineCameraInput,
  type LineCandidate,
} from '@/lib/vision/cameraSelector';
import { renderFormula } from '@/lib/vision/formulaTerms';
import type { TriggerSource } from '@/lib/vision/highSpeed';
import type { Check, CheckStatus } from '@/lib/vision/types';

/**
 * Giao diện Bộ chọn camera (chốt 2026-10-27, Q1–Q8). Không tính gì ở đây — mọi con số
 * đến từ `@/lib/vision/cameraSelector`. Luồng giống trang Chọn ống kính: nhập → khung
 * "Thông số cần" tính ngay → bấm "Hiển thị kết quả" mới lọc kho. Đợt 2 tốc độ cao (Q1–Q7):
 * tab Area có Bảng tính tốc độ cao, fps thật, độ nhạy sáng; tab Line có TDI.
 */

type Tab = 'area' | 'line';
type Contrast = 'high' | 'medium' | 'low' | 'unknown';
type Purpose = 'detect' | 'measure';

/** Q7: chỉ dẫn link, không chép nội dung. */
const BASLER_FPS_CALCULATOR = 'https://www.baslerweb.com/en/tools/frame-rate-calculator/';

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
const CONTRASTS: Contrast[] = ['high', 'medium', 'low', 'unknown'];
const COLORS: CameraColorFilter[] = ['any', 'mono', 'color'];
const PURPOSES: Purpose[] = ['detect', 'measure'];
const TRIGGERS: TriggerSource[] = ['photoSensor', 'software', 'encoder'];
const EMPTY = {
  fovW: '',
  fovH: '',
  width: '',
  mmpx: '',
  defect: '',
  contrast: 'unknown' as Contrast,
  color: 'any' as CameraColorFilter,
  purpose: 'detect' as Purpose,
  speed: '',
  ppm: '',
  images: '1',
  trigger: 'photoSensor' as TriggerSource,
  sensorMs: '',
  sampleMs: '',
  overlapped: 'yes' as 'yes' | 'no',
  encoder: '',
};

const num = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const show = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : String(Math.round(value * 10 ** digits) / 10 ** digits);

function StatusBadge({ status }: { status: CheckStatus }) {
  const t = useTranslations('cameraSelector.status');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>{t(status)}</span>;
}

export function CameraSelector({ components, params, kind }: { components: Component[]; params?: CameraParams; kind: Tab }) {
  const t = useTranslations('cameraSelector');
  const showFormulas = useShowFormulas();
  const cameras = useMemo(() => components.filter((c) => c.kind === 'camera'), [components]);
  const lineCount = cameras.filter((c) => specString(c.spec, 'camera_type') === 'line').length;

  // Mỗi trang một họ camera (2026-10-27): area scan ở /chon-camera, line scan ở /chon-line-scan.
  const tab = kind;
  const [form, setForm] = useState(EMPTY);
  const [showRejected, setShowRejected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const target = targetMmPerPx({ mmPerPx: num(form.mmpx), defectMm: num(form.defect), contrast: form.contrast }, params);

  const areaInput = useMemo<AreaCameraInput | null>(() => {
    const fovW = num(form.fovW);
    const fovH = num(form.fovH);
    if (fovW === null || fovH === null || !target) return null;
    return {
      fovWidthMm: fovW,
      fovHeightMm: fovH,
      targetMmPerPx: target.mmPerPx,
      color: form.color,
      measuring: form.purpose === 'measure',
      speedMmS: num(form.speed),
      partsPerMinute: num(form.ppm),
      imagesPerPart: Math.max(1, Math.round(num(form.images) ?? 1)),
      triggerSource: form.trigger,
      sensorResponseMs: num(form.sensorMs),
      sampleExposureMs: num(form.sampleMs),
      overlapped: form.overlapped === 'yes',
    };
  }, [form, target]);
  const lineInput = useMemo<LineCameraInput | null>(() => {
    const width = num(form.width);
    const speed = num(form.speed);
    if (width === null || speed === null || !target) return null;
    return { widthMm: width, speedMmS: speed, targetMmPerPx: target.mmPerPx, color: form.color, encoderUm: num(form.encoder) };
  }, [form, target]);

  const input = tab === 'area' ? areaInput : lineInput;
  const inputKey = JSON.stringify({ tab, input });
  const [shown, setShown] = useState<{ key: string; tab: Tab; area: AreaCameraInput | null; line: LineCameraInput | null } | null>(null);
  const stale = shown !== null && shown.key !== inputKey;
  const showResults = () => {
    if (!input) return;
    setShown({ key: inputKey, tab, area: tab === 'area' ? areaInput : null, line: tab === 'line' ? lineInput : null });
    setLimit(PAGE);
    setOpen(null);
  };

  const areaResult = useMemo(() => (shown?.area ? selectAreaCameras(cameras, shown.area, params).candidates : null), [shown, cameras, params]);
  const lineResult = useMemo(() => (shown?.line ? selectLineCameras(cameras, shown.line, params) : null), [shown, cameras, params]);
  const all: (AreaCandidate | LineCandidate)[] = areaResult ?? lineResult ?? [];
  const counts = { pass: 0, warn: 0, info: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const c of all) counts[c.status]++;
  const visible = showRejected ? all : all.filter((c) => c.status !== 'fail');

  const need = areaInput && tab === 'area' ? areaNeed(areaInput, params) : null;
  const lineNeed = lineInput && tab === 'line' ? { rateKhz: lineInput.speedMmS / lineInput.targetMmPerPx / 1000, exposureUs: (lineInput.targetMmPerPx / lineInput.speedMmS) * 1e6, px: Math.ceil(lineInput.widthMm / lineInput.targetMmPerPx - 1e-9) } : null;

  const reset = () => {
    setForm(EMPTY);
    setShown(null);
    setShowRejected(false);
    setLimit(PAGE);
    setOpen(null);
  };

  return (
    <div className="space-y-6">
      {/* Hai trang riêng (chốt 2026-10-27): /chon-camera = area scan, /chon-line-scan = line scan — chuyển qua menu. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          ↺ {t('reset')}
        </button>
      </div>
      <p className={`-mt-3 ${NOTE_CLASS}`}>{t(`tabHint.${tab}`, { line: lineCount, area: cameras.length - lineCount })}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Vùng nhìn + độ phân giải ── */}
        <Panel id="camera-task" title={t('task.title')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {tab === 'area' ? (
              <>
                <NumberInput id="cam-fov-w" label={t('task.fovWidth')} value={form.fovW} onChange={set('fovW')} />
                <NumberInput id="cam-fov-h" label={t('task.fovHeight')} value={form.fovH} onChange={set('fovH')} />
              </>
            ) : (
              <NumberInput id="cam-width" label={t('task.lineWidth')} hint={t('task.lineWidthHint')} value={form.width} onChange={set('width')} />
            )}
            {tab === 'area' ? (
              <SelectInput id="cam-purpose" label={t('task.purpose')} value={form.purpose} options={PURPOSES} labelOf={(v) => t(`purpose.${v}`)} onChange={set('purpose')} />
            ) : null}
            <NumberInput id="cam-mmpx" label={t('task.mmPerPx')} hint={t('task.mmPerPxHint')} value={form.mmpx} onChange={set('mmpx')} step="0.001" />
            <NumberInput id="cam-defect" label={t('task.defect')} hint={t('task.defectHint')} value={form.defect} onChange={set('defect')} step="0.01" />
            <div>
              <label htmlFor="cam-contrast" className={labelClass}>{t('task.contrast')}</label>
              <select id="cam-contrast" value={form.contrast} onChange={(e) => set('contrast')(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                {CONTRASTS.map((c) => (
                  <option key={c} value={c}>{t(`contrast.${c}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cam-color" className={labelClass}>{t('task.color')}</label>
              <select id="cam-color" value={form.color} onChange={(e) => set('color')(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                {COLORS.map((c) => (
                  <option key={c} value={c}>{t(`color.${c}`)}</option>
                ))}
              </select>
            </div>
          </div>
          {target ? (
            <p className={`mt-3 ${NOTE_CLASS}`}>
              {target.pxPerDefect !== null
                ? t('task.targetFromDefect', { mmpx: show(target.mmPerPx, 4), n: target.pxPerDefect })
                : t('task.targetGiven', { mmpx: show(target.mmPerPx, 4) })}
            </p>
          ) : null}
        </Panel>

        {/* ── Tốc độ ── */}
        <Panel id="camera-speed" title={t(tab === 'area' ? 'speed.titleArea' : 'speed.titleLine')} note={tab === 'area' ? t('speed.areaNote') : undefined}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput id="cam-speed" label={t(tab === 'area' ? 'speed.speedOptional' : 'speed.speed')} hint={tab === 'area' ? t('speed.speedHint') : undefined} value={form.speed} onChange={set('speed')} />
            {tab === 'area' ? (
              <>
                <NumberInput id="cam-ppm" label={t('speed.ppm')} value={form.ppm} onChange={set('ppm')} />
                <NumberInput id="cam-images" label={t('speed.images')} hint={t('speed.imagesHint')} value={form.images} onChange={set('images')} step="1" />
                <SelectInput id="cam-trigger" label={t('speed.trigger')} value={form.trigger} options={TRIGGERS} labelOf={(v) => t(`trigger.${v}`)} onChange={set('trigger')} />
                {form.trigger !== 'encoder' ? (
                  <NumberInput id="cam-sensor-ms" label={t('speed.sensorMs')} hint={t('speed.sensorMsHint')} value={form.sensorMs} onChange={set('sensorMs')} step="0.01" />
                ) : null}
                <NumberInput id="cam-sample-ms" label={t('speed.sampleMs')} hint={t('speed.sampleMsHint')} value={form.sampleMs} onChange={set('sampleMs')} step="0.01" />
                <SelectInput id="cam-overlap" label={t('speed.overlapped')} hint={t('speed.overlappedHint')} value={form.overlapped} options={['yes', 'no']} labelOf={(v) => t(`overlapped.${v}`)} onChange={set('overlapped')} />
              </>
            ) : (
              <NumberInput id="cam-encoder" label={t('speed.encoder')} hint={t('speed.encoderHint')} value={form.encoder} onChange={set('encoder')} step="0.1" />
            )}
          </div>
        </Panel>
      </div>

      {/* ── Thông số cần ── */}
      <Panel id="camera-need" title={t(tab === 'area' && need?.exposureMaxUs != null ? 'need.titleSpeed' : 'need.title')}>
        {tab === 'area' && need ? (
          <>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              <NeedItem label={t('need.pixels')} value={`${need.pxLong} × ${need.pxShort} px`} note={t('need.megapixels', { mp: show(need.megapixels, 2) })} />
              <NeedItem label={t('need.fps')} value={need.fpsNeeded !== null ? `${show(need.fpsNeeded, 2)} fps` : '—'} note={need.fpsNeeded === null ? t('need.fpsMissing') : undefined} />
              {need.travelPerFrameMm !== null ? <NeedItem label={t('need.travel')} value={`${show(need.travelPerFrameMm, 1)} mm`} note={t('need.travelNote')} /> : null}
              <NeedItem
                label={t('need.exposure')}
                value={need.exposureMaxUs !== null ? `${show(need.exposureMaxUs, 0)} µs` : '—'}
                note={need.exposureMaxUs === null ? t('need.exposureStatic') : t('need.exposureNote', { px: need.blurPx })}
              />
              <NeedItem
                label={t('need.strobe')}
                value={need.exposureMaxUs === null ? '—' : need.strobeRequired ? t('need.strobeYes') : t('need.strobeNo')}
                status={need.exposureMaxUs === null ? undefined : need.strobeRequired ? 'warn' : 'pass'}
              />
              {need.trigger ? (
                need.trigger.source === 'encoder' ? (
                  <NeedItem label={t('need.trigger')} value={t('need.triggerEncoder')} status="pass" note={t('need.triggerEncoderNote')} />
                ) : (
                  <NeedItem
                    label={t('need.trigger')}
                    value={`±${show(need.trigger.shiftMm, 3)} mm (${show(need.trigger.px, 1)} px)`}
                    status={need.trigger.over ? 'warn' : 'pass'}
                    note={t('need.triggerNote', {
                      sensor: show(need.trigger.sensorMs, 3),
                      camera: show(need.trigger.cameraMs, 3),
                      share: show(need.trigger.share * 100, 1),
                      margin: show(need.trigger.shiftMm * 2, 2),
                      assumed: need.trigger.sensorAssumed ? t('need.assumed') : '',
                    })}
                  />
                )
              ) : null}
              {need.light ? (
                <NeedItem
                  label={t('need.light')}
                  value={`×${show(need.light.boost, 1)}`}
                  status={need.light.verdict === 'continuous' ? 'pass' : need.light.verdict === 'overdrive' ? 'warn' : need.light.verdict === 'dutyTooHigh' || !need.light.assumed ? 'fail' : 'warn'}
                  note={t(`need.lightNote.${need.light.verdict}`, {
                    sample: show(need.light.sampleMs, 3),
                    duty: need.light.duty === null ? '—' : need.light.duty * 100 < 0.01 ? '< 0.01' : show(need.light.duty * 100, 2),
                    assumed: need.light.assumed ? t('need.assumed') : '',
                  })}
                />
              ) : null}
            </dl>
            {need.trigger && need.trigger.source !== 'encoder' ? <p className={`mt-3 ${NOTE_CLASS}`}>{t('need.latencyNote')}</p> : null}
          </>
        ) : tab === 'line' && lineNeed ? (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <NeedItem label={t('need.linePx')} value={`${lineNeed.px} px`} note={t('need.linePxNote')} />
            <NeedItem label={t('need.lineRate')} value={`${show(lineNeed.rateKhz, 2)} kHz`} note={t('need.lineRateNote')} />
            <NeedItem label={t('need.lineExposure')} value={`${show(lineNeed.exposureUs, 1)} µs`} note={lineNeed.exposureUs < LINE_EXPOSURE_BRIGHT_US ? t('need.lineExposureNote') : undefined} />
          </dl>
        ) : (
          <p className={NOTE_CLASS}>{t(`need.missing.${tab}`)}</p>
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
          id="camera-list"
          title={t(shown.tab === 'area' ? 'list.titleArea' : 'list.titleLine')}
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
            <p className={`px-4 py-4 sm:px-5 ${NOTE_CLASS}`}>{t(all.length === 0 ? 'list.noneInStock' : 'list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {shown.tab === 'area' ? (
                    <tr>
                      <th scope="col" className={`min-w-48 pl-4 ${th}`}>{t('list.colCamera')}</th>
                      <th scope="col" className={th}>{t('list.colResolution')}</th>
                      <th scope="col" className={th}>{t('list.colPixel')}</th>
                      <th scope="col" className={th}>{t('list.colSensor')}</th>
                      <th scope="col" className={th}>{t('list.colMmPerPx')}</th>
                      <th scope="col" className={th}>{t('list.colMargin')}</th>
                      <th scope="col" className={th}>{t('list.colFps')}</th>
                      <th scope="col" className={th}>{t('list.colData')}</th>
                      <th scope="col" className={th}>{t('list.colInterface')}</th>
                      <th scope="col" className={th}>{t('list.colShutter')}</th>
                      <th scope="col" className={th} title={t('list.colSensitivityHint')}>{t('list.colSensitivity')}</th>
                      <th scope="col" className={th}>{t('list.colStatus')}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="col" className={`min-w-48 pl-4 ${th}`}>{t('list.colCamera')}</th>
                      <th scope="col" className={th}>{t('list.colLinePx')}</th>
                      <th scope="col" className={th}>{t('list.colPixel')}</th>
                      <th scope="col" className={th}>{t('list.colLineRate')}</th>
                      <th scope="col" className={th}>{t('list.colMmPerPx')}</th>
                      <th scope="col" className={th}>{t('list.colCount')}</th>
                      <th scope="col" className={th}>{t('list.colLineExposure')}</th>
                      <th scope="col" className={th}>{t('list.colData')}</th>
                      <th scope="col" className={th}>{t('list.colInterface')}</th>
                      <th scope="col" className={th}>{t('list.colMount')}</th>
                      <th scope="col" className={th}>{t('list.colStatus')}</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <CameraRow
                      key={c.component.id}
                      candidate={c}
                      kind={shown.tab}
                      open={open === c.component.id}
                      onToggle={() => setOpen(open === c.component.id ? null : c.component.id)}
                      showFormulas={showFormulas}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visible.length > 0 ? <p className={`border-t border-slate-100 px-4 py-2 sm:px-5 dark:border-slate-800 ${NOTE_CLASS}`}>{t(shown.tab === 'area' ? 'list.footArea' : 'list.footLine')}</p> : null}
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

function SelectInput<V extends string>({
  id,
  label,
  hint,
  value,
  options,
  labelOf,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: V;
  options: readonly V[];
  labelOf: (value: V) => string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`}>
        {options.map((o) => (
          <option key={o} value={o}>{labelOf(o)}</option>
        ))}
      </select>
      {hint ? <p className={`mt-1 ${NOTE_CLASS}`}>{hint}</p> : null}
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

function CheckList({ checks, showFormulas }: { checks: Check[]; showFormulas: boolean }) {
  const t = useTranslations('cameraSelector');
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

function CameraRow({
  candidate: c,
  kind,
  open,
  onToggle,
  showFormulas,
}: {
  candidate: AreaCandidate | LineCandidate;
  kind: Tab;
  open: boolean;
  onToggle: () => void;
  showFormulas: boolean;
}) {
  const t = useTranslations('cameraSelector');
  const spec = c.component.spec;
  const pitch = c.camera.pixelSizeUm;
  const iface = c.camera.interfaceName ? `${c.camera.interfaceName}${(c.camera.lanes ?? 1) > 1 ? ` × ${c.camera.lanes}` : ''}` : '—';
  const color = specString(spec, 'color');
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
      <div className={NOTE_CLASS}>{[c.component.code !== c.component.model ? c.component.code : null, color ? t(`color.${color}`) : null].filter(Boolean).join(' · ')}</div>
    </td>
  );

  let cells: ReactNode;
  let extra: ReactNode = null;
  if (kind === 'area') {
    const a = c as AreaCandidate;
    cells = (
      <>
        {name}
        <td className={cell}>{a.camera.widthPx && a.camera.heightPx ? `${a.camera.widthPx} × ${a.camera.heightPx}` : '—'}</td>
        <td className={cell}>{pitch !== null ? `${show(pitch, 2)} µm` : '—'}</td>
        <td className={cell}>{a.camera.sensorFormat ? `${a.camera.sensorFormat}"` : '—'}</td>
        <td className={cell}>{show(a.mmPerPx, 4)}</td>
        <td className={cell}>{a.margin !== null ? `${show(a.margin, 2)}×` : '—'}</td>
        <td className={cell}>
          {a.fpsReal !== null ? show(a.fpsReal, 1) : '—'}
          {a.fpsNeeded !== null ? <span className="text-slate-500"> / {show(a.fpsNeeded, 2)}</span> : null}
          {a.fpsRoi !== null ? <div className={NOTE_CLASS}>{t('list.roiFps', { fps: show(a.fpsRoi, 0) })}</div> : null}
          {a.fpsLimiter !== null && a.fpsLimiter !== 'sensor' ? <div className={NOTE_CLASS}>{t(`limiter.${a.fpsLimiter}`)}</div> : null}
        </td>
        <td className={cell}>{a.dataRateMBs !== null ? show(a.dataRateMBs, 1) : '—'}</td>
        <td className={cell}>{iface}</td>
        <td className={cell}>{specString(spec, 'shutter') ? t(`shutter.${specString(spec, 'shutter')}`) : '—'}</td>
        <td className={cell}>{a.sensitivityRel !== null ? `${Math.round(a.sensitivityRel * 100)}%` : '—'}</td>
        <td className="py-2 pr-4">{toggle}</td>
      </>
    );
    extra = (
      <>
        <DetailItem label={t('list.fpsDatasheet')} value={a.camera.maxFps !== null ? `${show(a.camera.maxFps, 1)} fps` : '—'} />
        {a.exposureMaxUs !== null ? <DetailItem label={t('list.exposureMax')} value={`${show(a.exposureMaxUs, 0)} µs`} /> : null}
        <DetailItem label={t('list.dynamicRange')} value={a.dynamicRangeDb !== null ? `${show(a.dynamicRangeDb, 1)} dB` : '—'} />
      </>
    );
  } else {
    const l = c as LineCandidate;
    cells = (
      <>
        {name}
        <td className={cell}>{l.camera.widthPx || '—'}</td>
        <td className={cell}>{pitch !== null ? `${show(pitch, 2)} µm` : '—'}</td>
        <td className={cell}>
          {l.maxLineRateHz !== null ? show(l.maxLineRateHz / 1000, 1) : '—'}
          {l.lineRateHz !== null ? <span className="text-slate-500"> / {show(l.lineRateHz / 1000, 2)}</span> : null}
        </td>
        <td className={cell}>{show(l.mmPerPx, 4)}</td>
        <td className={cell}>{l.cameraCount ?? '—'}</td>
        <td className={cell}>
          {l.exposureUs !== null ? show(l.exposureUs, 1) : '—'}
          {l.tdiStages !== null ? <div className={NOTE_CLASS}>{t('list.tdi', { n: l.tdiStages })}</div> : null}
        </td>
        <td className={cell}>{l.dataRateMBs !== null ? show(l.dataRateMBs, 1) : '—'}</td>
        <td className={cell}>{iface}</td>
        <td className={cell}>{l.camera.mount ?? '—'}</td>
        <td className="py-2 pr-4">{toggle}</td>
      </>
    );
    extra = (
      <>
        <DetailItem label={t('list.sensorLength')} value={l.sensorLengthMm !== null ? `${show(l.sensorLengthMm, 1)} mm` : '—'} />
        <DetailItem label={t('list.betaNeed')} value={l.beta !== null ? show(l.beta, 4) : '—'} />
        <DetailItem label={t('list.tileWidth')} value={l.tileWidthMm !== null ? `${show(l.tileWidthMm, 1)} mm` : '—'} />
      </>
    );
  }

  return (
    <Fragment>
      <tr className={c.status === 'fail' ? 'opacity-60' : undefined}>{cells}</tr>
      {open ? (
        <tr className="bg-slate-50/60 dark:bg-slate-900/60">
          <td colSpan={kind === 'area' ? 12 : 11} className="px-4 py-3">
            {extra ? <dl className="mb-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">{extra}</dl> : null}
            {kind === 'line' ? <p className={`mb-3 ${NOTE_CLASS}`}>{t('list.lensHint')}</p> : null}
            <CheckList checks={c.checks} showFormulas={showFormulas} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {kind === 'line' ? (
                <ActionLink href="/chon-ong-kinh" variant="text">
                  {t('list.toLens')}
                </ActionLink>
              ) : null}
              {kind === 'area' && (c as AreaCandidate).fpsRoi !== null ? (
                <ActionLink href={BASLER_FPS_CALCULATOR} external variant="text">
                  {t('list.roiCalculator')}
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
