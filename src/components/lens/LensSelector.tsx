'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { MOUNTS, SENSOR_FORMAT_KEYS, specNumber, specString, type Component } from '@/lib/components/specs';
import { cameraFromComponent, type ConfigCamera } from '@/lib/vision/configurationRules';
import {
  selectLenses,
  solveGeometry,
  type GeometryMode,
  type LensCandidate,
  type LensKindFilter,
  type LensSelectorInput,
} from '@/lib/vision/lensSelector';
import { renderFormula } from '@/lib/vision/formulaTerms';
import type { CheckStatus } from '@/lib/vision/types';
import { LensDiagram, type DiagramField } from './LensDiagram';

/**
 * Giao diện Bộ chọn ống kính. Không tính gì ở đây — mọi con số đến từ
 * `@/lib/vision/lensSelector` (dùng chung công thức với OPT-001…005).
 *
 * Chốt 2026-10-18: ba tab theo họ ống (FA / telecentric / M12), ống thường và M12
 * nhập "biết 2 trong 3" (tiêu cự, khoảng cách, vùng nhìn), sơ đồ sống sáng nhãn
 * theo ô đang nhập, góc nhìn tính tại WD.
 */

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:border-sky-200 disabled:bg-sky-50 disabled:font-semibold disabled:text-sky-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:border-sky-900 dark:disabled:bg-sky-950/40 dark:disabled:text-sky-300';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200';

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  info: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  fail: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
};

const PAGE = 30;
const TABS: LensKindFilter[] = ['fixed', 'telecentric', 'm12'];
const MODES: GeometryMode[] = ['fov-wd', 'focal-wd', 'focal-fov'];
const EMPTY_TASK = { f: '', wd: '', fovW: '', fovH: '', dh: '', mmpx: '' };

const num = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

const show = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : String(Math.round(value * 10 ** digits) / 10 ** digits);

function cameraLabel(component: Component): string {
  const s = component.spec;
  const w = specNumber(s, 'resolution_w_px') ?? specNumber(s, 'line_width_px');
  const h = specNumber(s, 'resolution_h_px');
  const pitch = specNumber(s, 'pixel_size_um');
  const parts = [w && h ? `${w}×${h}` : w ? `${w} px` : null, pitch ? `${pitch} µm` : null, specString(s, 'mount')].filter(Boolean);
  return `${component.brand} ${component.model}${parts.length ? ` · ${parts.join(' · ')}` : ''}`;
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const t = useTranslations('lensSelector.status');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>{t(status)}</span>;
}

export function LensSelector({
  components,
  params,
}: {
  components: Component[];
  params?: { imageCircleTolerance: number; dofDiffractionTolerance: number };
}) {
  const t = useTranslations('lensSelector');

  const cameras = useMemo(() => components.filter((c) => c.kind === 'camera'), [components]);
  const lenses = useMemo(() => components.filter((c) => c.kind === 'lens'), [components]);

  const [tab, setTab] = useState<LensKindFilter>('fixed');
  const [mode, setMode] = useState<GeometryMode>('fov-wd');
  const [source, setSource] = useState<'catalog' | 'manual'>(cameras.length > 0 ? 'catalog' : 'manual');
  const [search, setSearch] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [manual, setManual] = useState({ type: 'area' as 'area' | 'line', widthPx: '', heightPx: '', pitch: '', format: '', mount: 'C' });
  const [task, setTask] = useState(EMPTY_TASK);
  const [focus, setFocus] = useState<DiagramField | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const tele = tab === 'telecentric';

  const filteredCameras = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return cameras;
    return cameras.filter((c) => {
      const text = cameraLabel(c).toLowerCase() + ' ' + c.code.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [cameras, search]);

  const camera: ConfigCamera | null = useMemo(() => {
    if (source === 'catalog') {
      const picked = cameras.find((c) => c.id === cameraId);
      return picked ? cameraFromComponent(picked) : null;
    }
    const widthPx = num(manual.widthPx);
    const heightPx = manual.type === 'line' ? 1 : num(manual.heightPx);
    const pitch = num(manual.pitch);
    if (!manual.format && (widthPx === null || heightPx === null || pitch === null)) return null;
    return {
      cameraType: manual.type,
      widthPx: widthPx ?? 0,
      heightPx: heightPx ?? 0,
      pixelSizeUm: pitch,
      sensorFormat: manual.format || null,
      mount: manual.mount || null,
      interfaceName: null,
      maxFps: null,
      bytesPerPx: 1,
    };
  }, [source, cameras, cameraId, manual]);

  const line = camera?.cameraType === 'line';
  const f = num(task.f);
  const wd = num(task.wd);
  const fovW = num(task.fovW);
  const fovH = num(task.fovH);
  const dh = num(task.dh);
  const mmpx = num(task.mmpx);

  /* Ống thường / M12: "biết 2 trong 3" quy về một cặp (vùng nhìn, WD). Telecentric:
     vùng nhìn + WD tuỳ chọn, không có tiêu cự. */
  const geometry = useMemo(
    () =>
      camera && !tele
        ? solveGeometry({
            mode,
            camera,
            focalLengthMm: mode === 'fov-wd' ? null : f,
            workingDistanceMm: mode === 'focal-fov' ? null : wd,
            fovWidthMm: mode === 'focal-wd' ? null : fovW,
            fovHeightMm: mode === 'focal-wd' ? null : fovH,
          })
        : null,
    [camera, tele, mode, f, wd, fovW, fovH]
  );

  const input = useMemo<LensSelectorInput | null>(() => {
    if (!camera) return null;
    if (tele) {
      const h = fovH ?? (line ? fovW : null);
      return fovW !== null && h !== null
        ? { camera, fovWidthMm: fovW, fovHeightMm: h, workingDistanceMm: wd, heightVariationMm: dh, targetMmPerPx: mmpx, lensKind: tab }
        : null;
    }
    return geometry
      ? { camera, fovWidthMm: geometry.fovWidthMm, fovHeightMm: geometry.fovHeightMm, workingDistanceMm: geometry.workingDistanceMm, heightVariationMm: dh, targetMmPerPx: mmpx, lensKind: tab }
      : null;
  }, [camera, tele, line, geometry, fovW, fovH, wd, dh, mmpx, tab]);

  const result = useMemo(() => (input ? selectLenses(input, lenses, params) : null), [input, lenses, params]);

  const need = result?.need ?? null;
  const all = result?.candidates ?? [];
  const counts = { pass: 0, warn: 0, info: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const c of all) counts[c.status]++;
  const visible = showRejected ? all : all.filter((c) => c.status !== 'fail');

  const setTaskValue = (key: keyof typeof task) => (value: string) => {
    setTask((prev) => ({ ...prev, [key]: value }));
    setLimit(PAGE);
  };

  /** Ô đang là kết quả tính ra (khoá lại, hiện số tính). */
  const computed = (field: 'f' | 'wd' | 'fov'): boolean =>
    !tele && ((field === 'f' && mode === 'fov-wd') || (field === 'wd' && mode === 'focal-fov') || (field === 'fov' && mode === 'focal-wd'));
  const computedValue = (field: 'f' | 'wdField' | 'fovW' | 'fovH'): string => {
    if (!geometry) return '';
    if (field === 'f') return show(geometry.focalLengthMm, 1);
    if (field === 'wdField') return show(geometry.workingDistanceMm, 0);
    return show(field === 'fovW' ? geometry.fovWidthMm : geometry.fovHeightMm, 1);
  };

  const reset = () => {
    setTask(EMPTY_TASK);
    setMode('fov-wd');
    setSearch('');
    setCameraId('');
    setManual({ type: 'area', widthPx: '', heightPx: '', pitch: '', format: '', mount: 'C' });
    setShowRejected(false);
    setLimit(PAGE);
    setOpen(null);
  };

  // Số cho sơ đồ: vùng nhìn THẬT của β lý tưởng (≥ vật), WD và tiêu cự đang dùng.
  const diagram = {
    sensorLongMm: need?.sensorLongMm ?? null,
    sensorShortMm: need?.sensorShortMm ?? null,
    widthPx: camera && camera.widthPx > 0 ? camera.widthPx : null,
    heightPx: camera && camera.heightPx > 0 ? camera.heightPx : null,
    pixelUm: camera?.pixelSizeUm ?? null,
    lineScan: line,
    focalMm: tele ? null : (geometry?.focalLengthMm ?? f),
    wdMm: tele ? wd : (geometry?.workingDistanceMm ?? wd),
    fovLongMm: need?.fovLongMm ?? null,
    fovShortMm: line ? null : (need?.fovShortMm ?? null),
  };

  return (
    <div className="space-y-6">
      {/* ── Tab theo họ ống ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t('tabs.label')} className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
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
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === value ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {t(`tabs.${value}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          ↺ {t('reset')}
        </button>
      </div>
      <p className={`-mt-3 ${NOTE_CLASS}`}>{t(`tabHint.${tab}`)}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Camera ── */}
        <Panel
          id="lens-camera"
          title={t('camera.title')}
          actions={
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
              {(['catalog', 'manual'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSource(value)}
                  disabled={value === 'catalog' && cameras.length === 0}
                  className={`rounded px-2.5 py-1 font-medium disabled:opacity-40 ${source === value ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  {t(value === 'catalog' ? 'camera.fromCatalog' : 'camera.manual')}
                </button>
              ))}
            </div>
          }
        >
          {source === 'catalog' ? (
            <div className="space-y-3">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('camera.search')} className={inputClass} aria-label={t('camera.search')} />
              <div>
                <label htmlFor="lens-camera-pick" className={labelClass}>
                  {t('camera.pick')} <span className={NOTE_CLASS}>{t('camera.count', { shown: filteredCameras.length, total: cameras.length })}</span>
                </label>
                <select id="lens-camera-pick" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                  <option value="">{filteredCameras.length ? t('camera.none') : t('camera.noMatch')}</option>
                  {filteredCameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {cameraLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="lens-cam-type" className={labelClass}>{t('camera.type')}</label>
                <select id="lens-cam-type" value={manual.type} onChange={(e) => setManual({ ...manual, type: e.target.value as 'area' | 'line' })} className={`mt-1.5 ${inputClass}`}>
                  <option value="area">{t('camera.area')}</option>
                  <option value="line">{t('camera.line')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="lens-cam-mount" className={labelClass}>{t('camera.mount')}</label>
                <select id="lens-cam-mount" value={manual.mount} onChange={(e) => setManual({ ...manual, mount: e.target.value })} className={`mt-1.5 ${inputClass}`}>
                  <option value="">{t('camera.mountUnknown')}</option>
                  {MOUNTS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <NumberInput id="lens-cam-w" label={t('camera.widthPx')} value={manual.widthPx} onChange={(v) => setManual({ ...manual, widthPx: v })} step="1" />
              {manual.type === 'area' ? (
                <NumberInput id="lens-cam-h" label={t('camera.heightPx')} value={manual.heightPx} onChange={(v) => setManual({ ...manual, heightPx: v })} step="1" />
              ) : null}
              <NumberInput id="lens-cam-pitch" label={t('camera.pixelSize')} value={manual.pitch} onChange={(v) => setManual({ ...manual, pitch: v })} step="0.01" />
              <div>
                <label htmlFor="lens-cam-format" className={labelClass}>{t('camera.sensorFormat')}</label>
                <select id="lens-cam-format" value={manual.format} onChange={(e) => setManual({ ...manual, format: e.target.value })} className={`mt-1.5 ${inputClass}`}>
                  <option value="">{t('camera.sensorFormatAuto')}</option>
                  {SENSOR_FORMAT_KEYS.map((fmt) => (
                    <option key={fmt} value={fmt}>{fmt}&quot;</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {camera && need ? (
            <p className={`mt-3 ${NOTE_CLASS}`}>
              {t('camera.summary', { w: camera.widthPx, h: camera.heightPx, pitch: show(camera.pixelSizeUm), sw: show(need.sensorLongMm), sh: show(need.sensorShortMm) })}
            </p>
          ) : null}
        </Panel>

        {/* ── Bài toán ── */}
        <Panel
          id="lens-task"
          title={t('task.title')}
          note={tele ? undefined : t('task.computedNote')}
        >
          {!tele ? (
            <div className="mb-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('mode.label')}>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('mode.label')}:</span>
              {MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${mode === value ? 'border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300' : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  {t(`mode.${value}`)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {!tele ? (
              <NumberInput
                id="lens-f"
                label={t('task.focal')}
                value={computed('f') ? computedValue('f') : task.f}
                computed={computed('f')}
                onChange={setTaskValue('f')}
                onFocus={() => setFocus('f')}
                onBlur={() => setFocus(null)}
                step="0.1"
              />
            ) : null}
            <NumberInput
              id="lens-wd"
              label={t(tele ? 'task.wdOptional' : 'task.wd')}
              hint={t('task.wdHint')}
              value={computed('wd') ? computedValue('wdField') : task.wd}
              computed={computed('wd')}
              onChange={setTaskValue('wd')}
              onFocus={() => setFocus('wd')}
              onBlur={() => setFocus(null)}
            />
            <NumberInput
              id="lens-fov-w"
              label={t('task.fovWidth')}
              value={computed('fov') ? computedValue('fovW') : task.fovW}
              computed={computed('fov')}
              onChange={setTaskValue('fovW')}
              onFocus={() => setFocus('fov')}
              onBlur={() => setFocus(null)}
            />
            <NumberInput
              id="lens-fov-h"
              label={t(line ? 'task.fovHeightLine' : 'task.fovHeight')}
              value={computed('fov') ? (line ? '' : computedValue('fovH')) : task.fovH}
              computed={computed('fov')}
              onChange={setTaskValue('fovH')}
              onFocus={() => setFocus('fov')}
              onBlur={() => setFocus(null)}
            />
            <NumberInput id="lens-dh" label={t('task.heightVariation')} hint={t('task.heightVariationHint')} value={task.dh} onChange={setTaskValue('dh')} />
            <NumberInput id="lens-mmpx" label={t('task.targetMmPerPx')} hint={t('task.targetMmPerPxHint')} value={task.mmpx} onChange={setTaskValue('mmpx')} step="0.001" />
          </div>
        </Panel>
      </div>

      {/* ── Sơ đồ + thông số cần ── */}
      <Panel id="lens-need" title={t('need.title')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <LensDiagram {...diagram} telecentric={tele} highlight={focus} />
          {!input ? (
            <p className={`self-center ${NOTE_CLASS}`}>{t(tele ? 'need.missingTele' : `need.missing.${mode}`)}</p>
          ) : !need ? (
            <p className="self-center text-sm text-amber-800 dark:text-amber-300">{t('need.missingSensor')}</p>
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <NeedItem
                  label={t(tele ? 'need.betaMax' : 'need.beta')}
                  value={show(need.beta, 4)}
                  formula={need.betaFormula}
                  note={t(tele ? 'need.betaMaxNote' : 'need.betaNote')}
                />
                {!tele && geometry ? (
                  <NeedItem
                    label={t(mode === 'fov-wd' ? 'need.focal' : 'need.focalGiven')}
                    value={`${show(geometry.focalLengthMm, 1)} mm`}
                    formula={mode === 'fov-wd' ? `${show(geometry.workingDistanceMm, 0)} × ${show(need.beta, 4)} ÷ (1 + ${show(need.beta, 4)})` : undefined}
                    note={mode === 'fov-wd' ? t('need.focalNote') : undefined}
                  />
                ) : null}
                {!tele && geometry && mode === 'focal-fov' ? (
                  <NeedItem
                    label={t('need.wdComputed')}
                    value={`${show(geometry.workingDistanceMm, 0)} mm`}
                    formula={`${show(geometry.focalLengthMm, 1)} × (1 + 1 ÷ ${show(need.beta, 4)})`}
                    note={t('need.wdComputedNote')}
                  />
                ) : null}
                <NeedItem label={t('need.fov')} value={line ? `${show(need.fovLongMm, 1)} mm` : `${show(need.fovLongMm, 1)} × ${show(need.fovShortMm, 1)} mm`} />
                {need.aovLongDeg !== null ? (
                  <NeedItem
                    label={t('need.aov')}
                    value={need.aovShortDeg !== null ? `${show(need.aovLongDeg, 1)}° × ${show(need.aovShortDeg, 1)}°` : `${show(need.aovLongDeg, 1)}°`}
                    note={t('need.aovNote')}
                  />
                ) : null}
                <NeedItem label={t('need.mmPerPx')} value={show(need.mmPerPx, 4)} />
                <NeedItem label={t('need.fMax')} value={need.fMaxRing !== null ? `F/${show(need.fMaxRing, 1)}` : '—'} note={t(tele ? 'need.fMaxNoteTele' : 'need.fMaxNote')} />
                <NeedItem label={t('need.lp')} value={need.lpPerMm !== null ? `${show(need.lpPerMm, 0)} lp/mm` : '—'} />
                <NeedItem label={t('need.circle')} value={`Ø ${show(need.sensorDiagonalMm, 1)} mm`} note={t('need.circleNote')} />
                {need.fNeedDepth !== null && !tele ? (
                  <NeedItem label={t('need.fDepth')} value={`F/${show(need.fNeedDepth, 1)}`} note={t('need.fDepthNote')} />
                ) : null}
                {need.telecentricFrontMm !== null ? (
                  <NeedItem
                    label={t('need.tele')}
                    value={`Ø ≈ ${show(need.telecentricFrontMm, 0)} mm`}
                    note={t(need.telecentricStatus === 'pass' ? 'need.telePass' : need.telecentricStatus === 'warn' ? 'need.teleWarn' : 'need.teleFail')}
                    status={need.telecentricStatus ?? undefined}
                  />
                ) : null}
              </dl>
              {need.cameraTooCoarse ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {t('need.cameraTooCoarse', { have: show(need.mmPerPx, 4), need: show(mmpx, 4) })}
                </p>
              ) : null}
              {!tele && need.fNeedDepth !== null && need.fMaxRing !== null && need.fNeedDepth > need.fMaxRing ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {t('need.fDepthConflict')}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Panel>

      {/* ── Ống kính trong kho ── */}
      {need ? (
        <Panel
          id="lens-list"
          title={t('list.title')}
          meta={t('list.meta', counts)}
          actions={
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="size-4 rounded border-slate-300 text-sky-600 dark:border-slate-600" />
              {t('list.showRejected')}
            </label>
          }
          bodyClassName=""
        >
          {visible.length === 0 ? (
            <p className={`px-4 py-4 sm:px-5 ${NOTE_CLASS}`}>{t('list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="py-2 pl-4 pr-3 font-medium">{t('list.colLens')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colOptic')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colFov')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colMmPerPx')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colPixelUse')}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{t('list.colFSet')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <LensRow key={c.component.id} candidate={c} line={line} open={open === c.component.id} onToggle={() => setOpen(open === c.component.id ? null : c.component.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

function NumberInput({
  id,
  label,
  hint,
  value,
  onChange,
  onFocus,
  onBlur,
  computed = false,
  step = 'any',
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Ô là kết quả tính ra: khoá lại, nền xanh. */
  computed?: boolean;
  step?: string;
}) {
  const t = useTranslations('lensSelector.task');
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {computed ? <span className="ml-2 text-xs font-normal text-sky-700 dark:text-sky-400">{t('computed')}</span> : null}
      </label>
      <input
        id={id}
        type={computed ? 'text' : 'number'}
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        disabled={computed}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`mt-1.5 ${inputClass}`}
      />
      {hint ? <p className={`mt-1 ${NOTE_CLASS}`}>{hint}</p> : null}
    </div>
  );
}

function NeedItem({ label, value, formula, note, status }: { label: string; value: string; formula?: string; note?: string; status?: CheckStatus }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
        {value}
        {status ? <StatusBadge status={status} /> : null}
      </dd>
      {formula ? <dd className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formula}</dd> : null}
      {note ? <dd className={`mt-0.5 ${NOTE_CLASS}`}>{note}</dd> : null}
    </div>
  );
}

function LensRow({ candidate: c, line, open, onToggle }: { candidate: LensCandidate; line: boolean; open: boolean; onToggle: () => void }) {
  const t = useTranslations('lensSelector');
  const tv = useTranslations('selector.vision');
  const lens = c.lens;
  const optic =
    lens.lensType === 'telecentric' || (lens.focalLengthMm === null && lens.magnification !== null)
      ? `${show(lens.magnification, 3)}×`
      : lens.focalLengthMm !== null
        ? `${show(lens.focalLengthMm, 1)} mm`
        : '—';
  return (
    <Fragment>
      <tr className={c.status === 'fail' ? 'opacity-60' : undefined}>
        <td className="py-2 pl-4 pr-3">
          <button type="button" onClick={onToggle} aria-expanded={open} className="text-left font-medium text-slate-900 hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-400">
            {c.component.brand} {c.component.model}
          </button>
          <div className={NOTE_CLASS}>
            {[lens.mount, lens.imageCircleFormat ? `${lens.imageCircleFormat}"` : lens.imageCircleMm ? `Ø${lens.imageCircleMm}` : null, lens.fNumberMin ? `F/${lens.fNumberMin}` : null]
              .filter(Boolean)
              .join(' · ')}
            {c.unknownCount > 0 ? ` · ${t('list.unknownCount', { n: c.unknownCount })}` : ''}
          </div>
        </td>
        <td className="py-2 pr-3 tabular-nums">
          {optic}
          {c.beta !== null && lens.lensType !== 'telecentric' && lens.focalLengthMm !== null ? <div className={NOTE_CLASS}>β {show(c.beta, 4)}</div> : null}
        </td>
        <td className="py-2 pr-3 tabular-nums">{c.fovLongMm === null ? '—' : line ? `${show(c.fovLongMm, 1)} mm` : `${show(c.fovLongMm, 1)} × ${show(c.fovShortMm, 1)}`}</td>
        <td className="py-2 pr-3 tabular-nums">{show(c.mmPerPx, 4)}</td>
        <td className="py-2 pr-3 tabular-nums">{c.pixelUse === null ? '—' : `${Math.round(c.pixelUse * 100)}%`}</td>
        <td className="py-2 pr-3 tabular-nums">{c.fSet === null ? '—' : `F/${show(c.fSet, 1)}`}</td>
        <td className="py-2 pr-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            <button type="button" onClick={onToggle} className="text-xs text-sky-700 hover:underline dark:text-sky-400">
              {open ? t('list.hide') : t('list.details')}
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-50/60 dark:bg-slate-900/60">
          <td colSpan={7} className="px-4 py-3">
            <ul className="space-y-2">
              {c.checks.map((check, i) => (
                <li key={`${check.key}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <StatusBadge status={check.status} />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t(`checks.${check.key}`)}</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{renderFormula(check.formula, (key) => tv(`formulaTerms.${key}`))}</span>
                  {check.noteKey ? <span className="w-full text-sm text-slate-600 dark:text-slate-300">{t(`notes.${check.noteKey}`, check.noteValues ?? {})}</span> : null}
                </li>
              ))}
            </ul>
            {c.component.datasheet_url ? (
              <a href={c.component.datasheet_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-sky-700 hover:underline dark:text-sky-400">
                {t('list.datasheet')} ↗
              </a>
            ) : null}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
