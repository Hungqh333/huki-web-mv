'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FIELD_CELL, FIELD_GRID, FIELD_LABEL, NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { mountFit, maxRingFNumber } from '@/lib/vision/configurationRules';
import { DOF_BLUR_PRESETS } from '@/lib/vision/depthOfField';
import { sensorOf } from '@/lib/vision/lensSelector';
import type { MountCameraOption, MountLensOption } from '@/lib/vision/mountCheckOptions';
import { OBLIQUE_DEFAULT_MARGIN, obliqueView, type ObliqueResult } from '@/lib/vision/obliqueView';
import { Slider } from './TubeFigures';

/**
 * Trang Camera nghiêng (OPT-014, chốt 2026-11-23 Q1-B / Q2-A / Q3 / Q4 như đề xuất): camera đặt chéo nhìn xuống
 * mặt phẳng ngang — vùng phủ hình thang, mm/px gần / xa, khẩu F cho cả vùng nét, gợi ý ống trong kho theo f tối đa.
 * Không tính gì ở đây: mọi số từ `obliqueView` (obliqueView.ts) và OPT-004 / OPT-013.
 */

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200';

const parse = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
};
const positive = (value: string) => {
  const n = parse(value);
  return n !== null && n > 0 ? n : null;
};
const show = (v: number, digits = 2) => String(Math.round(v * 10 ** digits) / 10 ** digits);
const r1 = (v: number) => Math.round(v * 10) / 10;

function matches(label: string, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const text = label.toLowerCase();
  return words.every((w) => text.includes(w));
}

function NumberField({ id, label, hint, value, onChange, step = 'any' }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className={FIELD_CELL}>
      <label htmlFor={id} className={`${FIELD_LABEL} ${labelClass}`}>
        {label}
      </label>
      <input id={id} type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      {hint ? <p className={`mt-1 ${NOTE_CLASS}`}>{hint}</p> : <span />}
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
          className={`rounded px-2.5 py-1 font-medium disabled:opacity-40 ${value === o.value ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted';
const TONE: Record<Tone, string> = {
  ok: 'text-slate-900 dark:text-slate-100',
  warn: 'text-amber-700 dark:text-amber-300',
  bad: 'text-red-700 dark:text-red-300',
  muted: 'text-slate-500 dark:text-slate-400',
};
const DOT: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'fill-emerald-500 stroke-white dark:stroke-slate-900',
  warn: 'fill-amber-500 stroke-white dark:stroke-slate-900',
  bad: 'fill-red-600 stroke-white dark:stroke-slate-900',
};

function cornerTone(usage: number, margin: number): 'ok' | 'warn' | 'bad' {
  return usage <= 1 - margin + 1e-12 ? 'ok' : usage <= 1 + 1e-12 ? 'warn' : 'bad';
}

/** Hình nhìn từ trên: vùng kiểm tra (nét đứt), vùng phủ của ảnh (tô xanh), camera + điểm ngắm. Y xa dần lên trên. */
function TopView({ res, areaW, areaL, margin }: { res: ObliqueResult; areaW: number; areaL: number; margin: number }) {
  const t = useTranslations('oblique.result');
  const W = 420;
  const H = 360;
  const pad = 28;
  const cam = res.cameraPos;
  // Khung nhìn: vùng kiểm tra + camera, nới 25 %.
  const xs = [-areaW / 2, areaW / 2, cam[0]];
  const ys = [0, areaL, cam[1]];
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const ex = (x1 - x0) * 0.25 + 1;
  const ey = (y1 - y0) * 0.25 + 1;
  x0 -= ex;
  x1 += ex;
  y0 -= ey;
  y1 += ey;
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const ox = (W - (x1 - x0) * s) / 2;
  const oy = (H - (y1 - y0) * s) / 2;
  const X = (x: number) => r1(ox + (x - x0) * s);
  const Y = (y: number) => r1(H - oy - (y - y0) * s);
  const poly = res.footprint.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('topTitle')}>
      <defs>
        <clipPath id="oblique-top-clip">
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <polygon points={poly} clipPath="url(#oblique-top-clip)" className="fill-sky-400/25 stroke-sky-600 dark:fill-sky-500/25 dark:stroke-sky-400" strokeWidth={1.5} />
      <rect x={X(-areaW / 2)} y={Y(areaL)} width={r1(areaW * s)} height={r1(areaL * s)} fill="none" strokeDasharray="6 4" strokeWidth={1.5} className="stroke-slate-700 dark:stroke-slate-200" />
      <line x1={X(cam[0])} y1={Y(cam[1])} x2={X(res.aimPoint[0])} y2={Y(res.aimPoint[1])} strokeDasharray="3 3" strokeWidth={1} className="stroke-violet-600 dark:stroke-violet-400" />
      <circle cx={X(res.aimPoint[0])} cy={Y(res.aimPoint[1])} r={3} className="fill-violet-600 dark:fill-violet-400" />
      {res.corners.map((c, i) => (
        <circle key={i} cx={X(c.x)} cy={Y(c.y)} r={5} strokeWidth={1.5} className={DOT[cornerTone(c.usage, margin)]} />
      ))}
      <rect x={X(cam[0]) - 7} y={Y(cam[1]) - 5} width={14} height={10} rx={2} className="fill-slate-800 dark:fill-slate-100" />
      <text x={X(cam[0])} y={Y(cam[1]) + 18} textAnchor="middle" fontSize={11} className="fill-slate-700 dark:fill-slate-200">
        {t('camera')}
      </text>
      <text x={X(0)} y={Y(0) + 14} textAnchor="middle" fontSize={10} className="fill-slate-500 dark:fill-slate-400">
        {t('near')}
      </text>
      <text x={X(0)} y={Y(areaL) - 6} textAnchor="middle" fontSize={10} className="fill-slate-500 dark:fill-slate-400">
        {t('far')}
      </text>
    </svg>
  );
}

/** Hình nhìn ngang: mặt cắt dọc (trục Y – Z) qua camera. */
function SideView({ res, areaL }: { res: ObliqueResult; areaL: number }) {
  const t = useTranslations('oblique.result');
  const W = 420;
  const H = 260;
  const pad = 26;
  const cam = res.cameraPos;
  const farY = res.edgeFar?.y ?? Math.max(areaL, cam[1]) * 1.5;
  const ys = [0, areaL, cam[1], res.edgeNear?.y ?? 0, Math.min(farY, areaL * 2 + Math.abs(cam[1]))];
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const ey = (y1 - y0) * 0.08 + 1;
  y0 -= ey;
  y1 += ey;
  const z1 = cam[2] * 1.12;
  const s = Math.min((W - 2 * pad) / (y1 - y0), (H - 2 * pad) / z1);
  const ox = (W - (y1 - y0) * s) / 2;
  const P = (y: number, z: number): [number, number] => [r1(ox + (y - y0) * s), r1(H - pad - z * s)];
  const [cx, cy] = P(cam[1], cam[2]);
  const ground = P(y0, 0)[1];
  const ray = (p: { y: number } | null, far: boolean) => {
    if (p) return P(p.y, 0);
    // Quá chân trời: vẽ tới mép khung theo hướng tia mép ảnh (đi ngang).
    return far ? P(y1, cam[2] * 0.6) : P(y0, 0);
  };
  const [nx, ny] = ray(res.edgeNear, false);
  const [fx, fy] = ray(res.edgeFar, true);
  const [ax, ay] = P(res.aimPoint[1], 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('sideTitle')}>
      <line x1={0} y1={ground} x2={W} y2={ground} strokeWidth={1} className="stroke-slate-400 dark:stroke-slate-500" />
      <polygon points={`${cx},${cy} ${nx},${ny} ${fx},${fy}`} className="fill-sky-400/20 dark:fill-sky-500/20" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} strokeWidth={1.5} className="stroke-sky-600 dark:stroke-sky-400" />
      <line x1={cx} y1={cy} x2={fx} y2={fy} strokeWidth={1.5} className="stroke-sky-600 dark:stroke-sky-400" />
      <line x1={cx} y1={cy} x2={ax} y2={ay} strokeDasharray="4 3" strokeWidth={1} className="stroke-violet-600 dark:stroke-violet-400" />
      <line x1={P(0, 0)[0]} y1={ground} x2={P(areaL, 0)[0]} y2={ground} strokeWidth={5} className="stroke-slate-800 dark:stroke-slate-100" />
      <line x1={cx} y1={cy} x2={cx} y2={ground} strokeDasharray="2 3" strokeWidth={1} className="stroke-slate-400 dark:stroke-slate-500" />
      <rect x={cx - 8} y={cy - 6} width={16} height={12} rx={2} className="fill-slate-800 dark:fill-slate-100" />
      <text x={cx + 12} y={cy - 8} fontSize={11} className="fill-slate-700 dark:fill-slate-200">
        {`${t('camera')} · ${show(res.tiltDeg, 1)}°`}
      </text>
      <text x={(P(0, 0)[0] + P(areaL, 0)[0]) / 2} y={ground + 16} textAnchor="middle" fontSize={10} className="fill-slate-500 dark:fill-slate-400">
        {t('areaLabel')}
      </text>
      <text x={cx - 4} y={(cy + ground) / 2} textAnchor="end" fontSize={10} className="fill-slate-500 dark:fill-slate-400">
        {`${show(cam[2], 0)} mm`}
      </text>
    </svg>
  );
}

export function ObliqueView({ lenses, cameras, admin = false }: { lenses: MountLensOption[]; cameras: MountCameraOption[]; admin?: boolean }) {
  const t = useTranslations('oblique');
  const tm = useTranslations('mountCheck');

  // Mở trang với camera mẫu nhập tay để có hình ngay; chọn từ kho bằng nút Từ kho.
  const [camSource, setCamSource] = useState<'catalog' | 'manual'>('manual');
  const [camSearch, setCamSearch] = useState('');
  const [camId, setCamId] = useState('');
  const [manualCam, setManualCam] = useState({ w: '2448', h: '2048', px: '3.45' });

  // Số mẫu để trang có hình ngay — anh sửa theo dự án.
  const [area, setArea] = useState({ w: '1200', l: '800', aim: '0', margin: String(OBLIQUE_DEFAULT_MARGIN * 100), need: '' });
  const [pos, setPos] = useState({ height: 1500, setback: 600, side: 0, focal: 8 });
  const [longAcross, setLongAcross] = useState(true);

  const filteredCameras = useMemo(() => (camSearch.trim() ? cameras.filter((c) => matches(c.label, camSearch)) : cameras), [cameras, camSearch]);
  const pickedCam = camSource === 'catalog' ? (cameras.find((c) => c.id === camId) ?? null) : null;

  const camera = (() => {
    if (camSource === 'catalog') {
      if (!pickedCam || pickedCam.sensorShortMm === null || pickedCam.pixelUm === null) return null;
      return { longMm: pickedCam.sensorLongMm, shortMm: pickedCam.sensorShortMm, pixelUm: pickedCam.pixelUm, mount: pickedCam.mount };
    }
    const w = positive(manualCam.w);
    const h = positive(manualCam.h);
    const px = positive(manualCam.px);
    if (w === null || h === null || px === null) return null;
    const sensor = sensorOf({ cameraType: 'area', widthPx: Math.max(w, h), heightPx: Math.min(w, h), pixelSizeUm: px, sensorFormat: null, mount: null, interfaceName: null, maxFps: null, bytesPerPx: 1 });
    return sensor ? { longMm: sensor.longMm, shortMm: sensor.shortMm, pixelUm: px, mount: null } : null;
  })();

  const areaW = positive(area.w);
  const areaL = positive(area.l);
  const margin = Math.min(Math.max((parse(area.margin) ?? OBLIQUE_DEFAULT_MARGIN * 100) / 100, 0), 0.5);
  const needGsd = positive(area.need);
  const blurPx = DOF_BLUR_PRESETS.tight;

  const res =
    camera && areaW !== null && areaL !== null
      ? obliqueView({
          areaWidthMm: areaW,
          areaLengthMm: areaL,
          heightMm: pos.height,
          setbackMm: pos.setback,
          sideOffsetMm: pos.side,
          aimShiftMm: parse(area.aim) ?? 0,
          sensorLongMm: camera.longMm,
          sensorShortMm: camera.shortMm,
          pixelUm: camera.pixelUm,
          longAcross,
          focalMm: pos.focal,
          margin,
          blurPx,
        })
      : null;

  const fMaxRing = res?.depth && camera ? maxRingFNumber(camera.pixelUm, res.depth.beta) : null;
  const sensorDiag = camera ? Math.hypot(camera.longMm, camera.shortMm) : null;
  const suggestions = !res
    ? []
    : lenses
      .filter((l) => l.focalMm <= res.focalMaxMm + 1e-9)
      .sort((a, b) => b.focalMm - a.focalMm)
      .map((l) => ({
        lens: l,
        circleOk: l.imageCircleMm === null || sensorDiag === null ? null : l.imageCircleMm >= sensorDiag * 0.98,
        modOk: l.modMm === null ? null : l.modMm <= res.nearestMm,
        mountOk: l.mount === null || camera?.mount == null ? null : mountFit(l.mount, camera.mount) !== 'mismatch',
      }));
  const [showAll, setShowAll] = useState(false);
  const shownSuggestions = showAll ? suggestions : suggestions.slice(0, 10);

  const maxUsagePct = res ? res.maxUsage * 100 : 0;
  const coverage: { text: string; tone: Tone } | null = !res
    ? null
    : res.covers
      ? { text: t('result.coverOk', { u: show(maxUsagePct, 1) }), tone: 'ok' }
      : res.maxUsage <= 1 + 1e-12
        ? { text: t('result.coverLow', { u: show(maxUsagePct, 1), m: show(margin * 100, 0) }), tone: 'warn' }
        : { text: t('result.coverBad', { u: show(maxUsagePct, 1) }), tone: 'bad' };
  const gsdTone: Tone = res && needGsd !== null ? (res.worstGsdMm <= needGsd + 1e-12 ? 'ok' : 'bad') : 'ok';
  const depthBad = res?.depth && fMaxRing !== null && res.depth.fNumber > fMaxRing + 1e-9;
  const DT = 'text-xs font-medium text-slate-500 dark:text-slate-400';

  return (
    <div className="space-y-6">
      <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">{t('exampleNote')}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Camera ── */}
        <Panel
          id="oblique-camera"
          title={tm('camera.title')}
          actions={
            <Toggle
              value={camSource}
              onChange={setCamSource}
              options={[
                { value: 'catalog', label: tm('fromCatalog'), disabled: cameras.length === 0 },
                { value: 'manual', label: tm('camera.manual') },
              ]}
            />
          }
        >
          {camSource === 'catalog' ? (
            <div className="space-y-3">
              <input type="search" value={camSearch} onChange={(ev) => setCamSearch(ev.target.value)} placeholder={tm('camera.search')} aria-label={tm('camera.search')} className={inputClass} />
              <div>
                <label htmlFor="oblique-cam-pick" className={labelClass}>
                  {tm('camera.pick')} <span className={NOTE_CLASS}>{tm('camera.count', { shown: filteredCameras.length, total: cameras.length })}</span>
                </label>
                <select id="oblique-cam-pick" value={camId} onChange={(ev) => setCamId(ev.target.value)} className={`mt-1.5 ${inputClass}`}>
                  <option value="">{filteredCameras.length ? tm('camera.none') : tm('camera.noMatch')}</option>
                  {pickedCam && !filteredCameras.includes(pickedCam) ? <option value={pickedCam.id}>{pickedCam.label}</option> : null}
                  {filteredCameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {pickedCam ? (
                <p className={pickedCam.sensorShortMm === null || pickedCam.pixelUm === null ? 'text-sm text-amber-700 dark:text-amber-300' : NOTE_CLASS}>
                  {pickedCam.sensorShortMm === null ? t('cameraLine') : pickedCam.pixelUm === null ? tm('camera.summaryNoPixel') : tm('camera.summaryPixel', { px: show(pickedCam.pixelUm, 2) })}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className={`${FIELD_GRID} sm:grid-cols-3`}>
                <NumberField id="oblique-w" label={tm('camera.long')} value={manualCam.w} onChange={(v) => setManualCam({ ...manualCam, w: v })} step="1" />
                <NumberField id="oblique-h" label={tm('camera.short')} value={manualCam.h} onChange={(v) => setManualCam({ ...manualCam, h: v })} step="1" />
                <NumberField id="oblique-px" label={tm('camera.pixel')} value={manualCam.px} onChange={(v) => setManualCam({ ...manualCam, px: v })} step="0.01" />
              </div>
              {camera ? <p className={`mt-2 ${NOTE_CLASS}`}>{tm('camera.sizeMm', { long: show(camera.longMm, 3), short: show(camera.shortMm, 3) })}</p> : null}
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={labelClass}>{t('setup.rotate')}</span>
            <Toggle
              value={longAcross ? 'across' : 'along'}
              onChange={(v) => setLongAcross(v === 'across')}
              options={[
                { value: 'across', label: t('setup.rotateAcross') },
                { value: 'along', label: t('setup.rotateAlong') },
              ]}
            />
          </div>
        </Panel>

        {/* ── Vùng kiểm tra ── */}
        <Panel id="oblique-area" title={t('setup.title')}>
          <div className={`${FIELD_GRID} grid-cols-2 sm:grid-cols-3`}>
            <NumberField id="oblique-area-w" label={t('setup.areaW')} value={area.w} onChange={(v) => setArea({ ...area, w: v })} />
            <NumberField id="oblique-area-l" label={t('setup.areaL')} value={area.l} onChange={(v) => setArea({ ...area, l: v })} />
            <NumberField id="oblique-aim" label={t('setup.aim')} hint={t('setup.aimHint')} value={area.aim} onChange={(v) => setArea({ ...area, aim: v })} />
            <NumberField id="oblique-margin" label={t('setup.margin')} hint={t('setup.marginHint')} value={area.margin} onChange={(v) => setArea({ ...area, margin: v })} step="1" />
            <NumberField id="oblique-need" label={t('setup.needGsd')} value={area.need} onChange={(v) => setArea({ ...area, need: v })} step="0.01" />
          </div>
          <p className={`mt-3 ${NOTE_CLASS}`}>{t('setup.hint')}</p>
        </Panel>
      </div>

      {res && areaW !== null && areaL !== null ? (
        <section aria-label={t('result.title')} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          {/* Thanh trượt + số dính dưới menu khi cuộn (màn rộng), như Kiểm tra lắp đặt. */}
          <div className="space-y-3 border-b border-slate-200 bg-slate-50 pb-3 lg:sticky lg:top-[var(--header-h,0px)] lg:z-20 lg:pt-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.title')}</h3>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Slider id="oblique-sl-f" label={t('setup.focal')} value={pos.focal} min={2} max={Math.max(50, Math.ceil(res.focalMaxMm * 2))} step={0.1} accept="positive" onChange={(v) => setPos({ ...pos, focal: v })} note={null} />
              <Slider id="oblique-sl-h" label={t('setup.height')} value={pos.height} min={100} max={Math.max(3000, Math.ceil(pos.height * 1.5))} step={10} accept="positive" onChange={(v) => setPos({ ...pos, height: v })} note={null} />
              <Slider
                id="oblique-sl-setback"
                label={t('setup.setback')}
                value={pos.setback}
                min={-Math.ceil(areaL)}
                max={Math.max(3000, Math.ceil(pos.setback * 1.5))}
                step={10}
                accept="any"
                onChange={(v) => setPos({ ...pos, setback: v })}
                note={pos.setback < 0 ? t('setup.setbackHint') : null}
              />
              <Slider
                id="oblique-sl-side"
                label={t('setup.side')}
                value={pos.side}
                min={-Math.ceil(Math.max(areaW, Math.abs(pos.side)))}
                max={Math.ceil(Math.max(areaW, Math.abs(pos.side)))}
                step={10}
                accept="any"
                onChange={(v) => setPos({ ...pos, side: v })}
                note={null}
              />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 lg:grid-cols-5 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <dt className={DT}>{t('result.coverage')}</dt>
                <dd className={`min-h-[2.5rem] text-sm tabular-nums ${TONE[coverage!.tone]}`}>{coverage!.text}</dd>
              </div>
              <div>
                <dt className={DT}>{t('result.focalMax')}</dt>
                <dd className="min-h-[2.5rem] text-sm tabular-nums text-slate-900 dark:text-slate-100">{t('result.focalMaxValue', { f: show(res.focalMaxMm, 1), m: show(margin * 100, 0) })}</dd>
              </div>
              <div>
                <dt className={DT}>{t('result.gsd')}</dt>
                <dd className={`min-h-[2.5rem] text-sm tabular-nums ${TONE[gsdTone]}`}>
                  {t('result.gsdValue', { best: show(res.bestGsdMm, 3), worst: show(res.worstGsdMm, 3) })}
                  {needGsd !== null ? ` · ${gsdTone === 'ok' ? t('result.gsdNeedOk', { need: show(needGsd, 3) }) : t('result.gsdNeedBad', { need: show(needGsd, 3) })}` : ''}
                </dd>
              </div>
              <div>
                <dt className={DT}>{t('result.tilt')}</dt>
                <dd className="min-h-[2.5rem] text-sm tabular-nums text-slate-900 dark:text-slate-100">
                  {`${show(res.tiltDeg, 1)}°`} · {t('result.distanceValue', { near: show(res.nearestMm, 0), far: show(res.farthestMm, 0) })}
                </dd>
              </div>
              <div>
                <dt className={DT}>{t('result.depth')}</dt>
                <dd className={`min-h-[2.5rem] text-sm tabular-nums ${depthBad ? TONE.warn : TONE.ok}`}>
                  {res.depth ? t('result.depthValue', { f: show(res.depth.fNumber, 1), focus: show(res.depth.focusMm, 0) }) : '—'}
                  {res.depth && fMaxRing !== null ? ` · ${depthBad ? t('result.depthDiffraction', { fMax: show(fMaxRing, 1) }) : t('result.depthOk', { fMax: show(fMaxRing, 1) })}` : ''}
                </dd>
              </div>
            </dl>
            {res.horizon ? <p className="text-sm text-amber-700 dark:text-amber-300">{t('result.horizon')}</p> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <figure className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <figcaption className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.topTitle')}</figcaption>
              <TopView res={res} areaW={areaW} areaL={areaL} margin={margin} />
              <p className={`mt-1 ${NOTE_CLASS}`}>{t('result.topNote')}</p>
            </figure>
            <figure className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <figcaption className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.sideTitle')}</figcaption>
              <SideView res={res} areaL={areaL} />
              <p className={`mt-1 ${NOTE_CLASS}`}>{t('result.sideNote')}</p>
              {/* Bảng 4 góc: mức dùng cảm biến + mm/px. */}
              <table className="mt-3 w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="py-1 font-medium">{t('result.colCorner')}</th>
                    <th className="py-1 font-medium">{t('result.colUsage')}</th>
                    <th className="py-1 font-medium">{t('result.colGsd')}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.corners.map((c, i) => {
                    const tone = cornerTone(c.usage, margin);
                    return (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1">{t(`result.corner${i}`)}</td>
                        <td className={`py-1 ${TONE[tone === 'ok' ? 'ok' : tone]}`}>{Number.isFinite(c.usage) ? `${show(c.usage * 100, 1)} %` : '—'}</td>
                        <td className="py-1">{`${show(c.gsdAcrossMm, 3)} × ${show(c.gsdAlongMm, 3)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </figure>
          </div>
          <p className={NOTE_CLASS}>{t('result.modelNote')}</p>
          {admin ? <p className={NOTE_CLASS}>{t('result.adminNote', { v: show(res.imageDistanceMm, 3), d: show(res.distanceToAimMm, 0) })}</p> : null}

          {/* ── Gợi ý ống trong kho ── */}
          <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('lenses.title', { f: show(res.focalMaxMm, 1) })}</h4>
            {suggestions.length === 0 ? (
              <p className={`mt-2 ${NOTE_CLASS}`}>{t('lenses.none', { f: show(res.focalMaxMm, 1) })}</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-1.5 pr-4 font-medium">{t('lenses.colLens')}</th>
                      <th className="py-1.5 pr-4 font-medium">f</th>
                      <th className="py-1.5 pr-4 font-medium">{t('lenses.colAperture')}</th>
                      <th className="py-1.5 pr-4 font-medium">{t('lenses.colNotes')}</th>
                      <th className="py-1.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {shownSuggestions.map(({ lens, circleOk, modOk, mountOk }) => {
                      const notes = [circleOk === false ? t('lenses.circleBad') : null, modOk === false ? t('lenses.modBad') : null, mountOk === false ? t('lenses.mountBad') : null].filter(Boolean);
                      return (
                        <tr key={lens.id}>
                          <td className="py-1.5 pr-4">{lens.label}</td>
                          <td className="whitespace-nowrap py-1.5 pr-4 tabular-nums">{show(lens.focalMm, 1)} mm</td>
                          <td className="whitespace-nowrap py-1.5 pr-4 tabular-nums">{lens.fNumberMin !== null ? `F/${show(lens.fNumberMin, 1)}${lens.fNumberMax !== null ? `–${show(lens.fNumberMax, 0)}` : ''}` : '—'}</td>
                          <td className={`py-1.5 pr-4 text-xs ${notes.length ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{notes.length ? notes.join(' · ') : t('lenses.fits')}</td>
                          <td className="py-1.5 text-right">
                            <button type="button" onClick={() => setPos({ ...pos, focal: lens.focalMm })} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                              {t('lenses.use')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {suggestions.length > 10 ? (
                  <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
                    {showAll ? t('lenses.less') : t('lenses.more', { n: suggestions.length - 10 })}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{t('missing')}</p>
      )}
    </div>
  );
}
