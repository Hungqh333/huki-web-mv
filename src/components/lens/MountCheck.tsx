'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FIELD_CELL, FIELD_GRID, FIELD_LABEL, NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { useShowFormulas } from '@/components/ui/FormulaVisibility';
import type { MountCameraOption, MountCheckInitial, MountLensOption } from '@/lib/vision/mountCheckOptions';
import { DOF_BLUR_PRESETS, type DofBlurPreset } from '@/lib/vision/depthOfField';
import { TubeFigures } from './TubeFigures';

/**
 * Trang Kiểm tra lắp đặt ống kính (chốt 2026-11-11 vòng 3: Q1-B trang riêng, Q2-b mở từ dòng kết quả
 * Chọn ống kính hoặc tự chọn ống / camera trong kho hay nhập tay, Q3-a quyền như Q5, Q4-a menu nhóm Ống kính).
 * Không tính gì ở đây: số trong hình đến từ `tubeFigure` (lensSelector.ts, OPT-001/OPT-010) và DOF từ
 * depthOfField.ts (OPT-013, chốt 2026-11-21: cỡ điểm ảnh, dải khẩu F, ba mức độ nhòe + tự nhập).
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

function SourceToggle({ value, onChange, catalogDisabled, labels }: { value: 'catalog' | 'manual'; onChange: (v: 'catalog' | 'manual') => void; catalogDisabled: boolean; labels: { catalog: string; manual: string } }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
      {(['catalog', 'manual'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          disabled={v === 'catalog' && catalogDisabled}
          className={`rounded px-2.5 py-1 font-medium disabled:opacity-40 ${value === v ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

export function MountCheck({
  lenses,
  cameras,
  marginWarn,
  initial = {},
}: {
  lenses: MountLensOption[];
  cameras: MountCameraOption[];
  marginWarn: number;
  initial?: MountCheckInitial;
}) {
  const t = useTranslations('mountCheck');
  const admin = useShowFormulas();

  const initialLens = initial.lens && lenses.some((l) => l.id === initial.lens) ? initial.lens : '';
  const initialCam = initial.cam && cameras.some((c) => c.id === initial.cam) ? initial.cam : '';
  const prefilled = initialLens !== '';

  const [lensSource, setLensSource] = useState<'catalog' | 'manual'>(lenses.length > 0 ? 'catalog' : 'manual');
  const [lensSearch, setLensSearch] = useState('');
  const [lensId, setLensId] = useState(initialLens);
  const [manualLens, setManualLens] = useState({ f: '', sF: '', mod: '', fMin: '', fMax: '' });

  const [camSource, setCamSource] = useState<'catalog' | 'manual'>(initialCam || (!initial.sl && cameras.length > 0) ? 'catalog' : 'manual');
  const [camSearch, setCamSearch] = useState('');
  const [camId, setCamId] = useState(initialCam);
  const [manualCam, setManualCam] = useState({ long: initialCam ? '' : (initial.sl ?? ''), short: initialCam ? '' : (initial.ss ?? ''), px: initialCam ? '' : (initial.px ?? '') });
  const [blur, setBlur] = useState<{ preset: DofBlurPreset | 'custom'; custom: string }>({ preset: 'tight', custom: '' });

  const [setup, setSetup] = useState({ wd: initial.wd ?? '', e: initial.e ?? '', k: initial.k ?? '', fw: initial.fw ?? '', fh: initial.fh ?? '' });

  const filteredLenses = useMemo(() => (lensSearch.trim() ? lenses.filter((l) => matches(l.label, lensSearch)) : lenses), [lenses, lensSearch]);
  const filteredCameras = useMemo(() => (camSearch.trim() ? cameras.filter((c) => matches(c.label, camSearch)) : cameras), [cameras, camSearch]);

  const lens = useMemo(() => {
    if (lensSource === 'catalog') return lenses.find((l) => l.id === lensId) ?? null;
    const f = positive(manualLens.f);
    if (f === null) return null;
    return {
      focalMm: f,
      // sF nhập tay chỉ admin thấy (như thanh sF, Q3); người khác để 0 → hình ghi "ước tính".
      frontFocalMm: admin ? parse(manualLens.sF) : null,
      frontFocalApprox: false,
      modMm: positive(manualLens.mod),
      fNumberMin: positive(manualLens.fMin),
      fNumberMax: positive(manualLens.fMax),
    };
  }, [lensSource, lenses, lensId, manualLens, admin]);

  const camera = useMemo(() => {
    if (camSource === 'catalog') {
      const c = cameras.find((x) => x.id === camId);
      return c ? { sensorLongMm: c.sensorLongMm, sensorShortMm: c.sensorShortMm, pixelUm: c.pixelUm } : null;
    }
    const long = positive(manualCam.long);
    if (long === null) return null;
    const short = positive(manualCam.short);
    return { sensorLongMm: Math.max(long, short ?? 0), sensorShortMm: short === null ? null : Math.min(long, short), pixelUm: positive(manualCam.px) };
  }, [camSource, cameras, camId, manualCam]);

  const wd = positive(setup.wd);
  const e = parse(setup.e);
  const tube = e !== null && e > 0 ? e : 0;
  const k = positive(setup.k) ?? 1;
  const fw = positive(setup.fw);
  const fh = positive(setup.fh);
  const line = camera?.sensorShortMm === null;
  // Vùng nhìn cần: line scan chỉ bề rộng; area cần đủ hai cạnh, thiếu thì không vẽ H5.
  const need = line ? (fw !== null ? { long: fw, short: null } : null) : fw !== null && fh !== null ? { long: Math.max(fw, fh), short: Math.min(fw, fh) } : null;

  const figProps =
    lens && camera && wd !== null
      ? {
          focalMm: lens.focalMm,
          frontFocalMm: lens.frontFocalMm,
          frontFocalApprox: lens.frontFocalApprox,
          modMm: lens.modMm,
          wdMm: wd,
          tubeMm: tube,
          converterFactor: k,
          sensorLongMm: camera.sensorLongMm,
          sensorShortMm: camera.sensorShortMm,
          needLongMm: need?.long ?? null,
          needShortMm: need?.short ?? null,
          marginWarn,
          admin,
          pixelUm: camera.pixelUm,
          fNumberMin: lens.fNumberMin,
          fNumberMax: lens.fNumberMax,
          // F đặt mang từ Chọn ống kính chỉ áp cho đúng ống mở trang.
          fNumberInit: lensSource === 'catalog' && lensId === initialLens && initialLens !== '' ? positive(initial.n ?? '') : null,
        }
      : null;
  const blurPx = blur.preset === 'custom' ? (positive(blur.custom) ?? DOF_BLUR_PRESETS.tight) : DOF_BLUR_PRESETS[blur.preset];

  const pickedLens = lensSource === 'catalog' ? lenses.find((l) => l.id === lensId) : null;
  const pickedCam = camSource === 'catalog' ? cameras.find((c) => c.id === camId) : null;

  return (
    <div className="space-y-6">
      {prefilled ? <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">{t('fromSelector')}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Camera ── chọn trước, bên trái (2026-11-12 Q4) */}
        <Panel
          id="mount-camera"
          title={t('camera.title')}
          actions={<SourceToggle value={camSource} onChange={setCamSource} catalogDisabled={cameras.length === 0} labels={{ catalog: t('fromCatalog'), manual: t('camera.manual') }} />}
        >
          {camSource === 'catalog' ? (
            <div className="space-y-3">
              <input type="search" value={camSearch} onChange={(ev) => setCamSearch(ev.target.value)} placeholder={t('camera.search')} aria-label={t('camera.search')} className={inputClass} />
              <div>
                <label htmlFor="mount-cam-pick" className={labelClass}>
                  {t('camera.pick')} <span className={NOTE_CLASS}>{t('camera.count', { shown: filteredCameras.length, total: cameras.length })}</span>
                </label>
                <select id="mount-cam-pick" value={camId} onChange={(ev) => setCamId(ev.target.value)} className={`mt-1.5 ${inputClass}`}>
                  <option value="">{filteredCameras.length ? t('camera.none') : t('camera.noMatch')}</option>
                  {pickedCam && !filteredCameras.includes(pickedCam) ? <option value={pickedCam.id}>{pickedCam.label}</option> : null}
                  {filteredCameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {pickedCam ? (
                <p className={NOTE_CLASS}>{pickedCam.pixelUm !== null ? t('camera.summaryPixel', { px: show(pickedCam.pixelUm, 2) }) : t('camera.summaryNoPixel')}</p>
              ) : null}
            </div>
          ) : (
            <div className={`${FIELD_GRID} sm:grid-cols-2`}>
              <NumberField id="mount-sl" label={t('camera.long')} value={manualCam.long} onChange={(v) => setManualCam({ ...manualCam, long: v })} />
              <NumberField id="mount-ss" label={t('camera.short')} hint={t('camera.shortHint')} value={manualCam.short} onChange={(v) => setManualCam({ ...manualCam, short: v })} />
              <NumberField id="mount-px" label={t('camera.pixel')} hint={t('camera.pixelHint')} value={manualCam.px} onChange={(v) => setManualCam({ ...manualCam, px: v })} step="0.01" />
            </div>
          )}
        </Panel>

        {/* ── Ống kính ── */}
        <Panel
          id="mount-lens"
          title={t('lens.title')}
          actions={<SourceToggle value={lensSource} onChange={setLensSource} catalogDisabled={lenses.length === 0} labels={{ catalog: t('fromCatalog'), manual: t('manual') }} />}
        >
          {lensSource === 'catalog' ? (
            <div className="space-y-3">
              <input type="search" value={lensSearch} onChange={(ev) => setLensSearch(ev.target.value)} placeholder={t('lens.search')} aria-label={t('lens.search')} className={inputClass} />
              <div>
                <label htmlFor="mount-lens-pick" className={labelClass}>
                  {t('lens.pick')} <span className={NOTE_CLASS}>{t('lens.count', { shown: filteredLenses.length, total: lenses.length })}</span>
                </label>
                <select id="mount-lens-pick" value={lensId} onChange={(ev) => setLensId(ev.target.value)} className={`mt-1.5 ${inputClass}`}>
                  <option value="">{filteredLenses.length ? t('lens.none') : t('lens.noMatch')}</option>
                  {/* Ống đang chọn vẫn giữ trong danh sách khi ô tìm không khớp. */}
                  {pickedLens && !filteredLenses.includes(pickedLens) ? <option value={pickedLens.id}>{pickedLens.label}</option> : null}
                  {filteredLenses.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              {pickedLens ? (
                <p className={NOTE_CLASS}>
                  {pickedLens.modMm !== null ? t('lens.summary', { f: show(pickedLens.focalMm, 1), mod: show(pickedLens.modMm, 0) }) : t('lens.summaryNoMod', { f: show(pickedLens.focalMm, 1) })}
                  {pickedLens.fNumberMin !== null ? ` · ${t('lens.summaryF', { min: show(pickedLens.fNumberMin, 1), max: pickedLens.fNumberMax !== null ? show(pickedLens.fNumberMax, 1) : '?' })}` : ''}
                  {admin ? ` · ${pickedLens.frontFocalMm !== null ? t('lens.summarySf', { sF: show(pickedLens.frontFocalMm, 1) }) : t('lens.summaryNoSf')}` : ''}
                </p>
              ) : null}
            </div>
          ) : (
            <div className={`${FIELD_GRID} sm:grid-cols-2`}>
              <NumberField id="mount-f" label={t('lens.focal')} value={manualLens.f} onChange={(v) => setManualLens({ ...manualLens, f: v })} />
              <NumberField id="mount-mod" label={t('lens.mod')} hint={t('lens.modHint')} value={manualLens.mod} onChange={(v) => setManualLens({ ...manualLens, mod: v })} />
              <NumberField id="mount-fmin" label={t('lens.fMin')} value={manualLens.fMin} onChange={(v) => setManualLens({ ...manualLens, fMin: v })} step="0.1" />
              <NumberField id="mount-fmax" label={t('lens.fMax')} value={manualLens.fMax} onChange={(v) => setManualLens({ ...manualLens, fMax: v })} step="0.1" />
              {admin ? <NumberField id="mount-sf" label={t('lens.sF')} hint={t('lens.sFHint')} value={manualLens.sF} onChange={(v) => setManualLens({ ...manualLens, sF: v })} /> : null}
            </div>
          )}
        </Panel>

        {/* ── Lắp đặt ── */}
        <Panel id="mount-setup" title={t('setup.title')} className="lg:col-span-2">
          <div className={`${FIELD_GRID} grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`}>
            <NumberField id="mount-wd" label={t('setup.wd')} value={setup.wd} onChange={(v) => setSetup({ ...setup, wd: v })} />
            <NumberField id="mount-e" label={t('setup.tube')} value={setup.e} onChange={(v) => setSetup({ ...setup, e: v })} step="0.5" />
            <NumberField id="mount-k" label={t('setup.converter')} value={setup.k} onChange={(v) => setSetup({ ...setup, k: v })} step="0.1" />
            <NumberField id="mount-fw" label={t('setup.fovW')} value={setup.fw} onChange={(v) => setSetup({ ...setup, fw: v })} />
            {line ? null : <NumberField id="mount-fh" label={t('setup.fovH')} value={setup.fh} onChange={(v) => setSetup({ ...setup, fh: v })} />}
          </div>
          <p className={`mt-3 ${NOTE_CLASS}`}>{t('setup.hint')}</p>
          {/* Độ nhòe cho phép của DOF (OPT-013, Q2-A): ba mức + tự nhập. */}
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="mount-blur" className={labelClass}>
                {t('setup.blur')}
              </label>
              <select
                id="mount-blur"
                value={blur.preset}
                onChange={(ev) => setBlur({ ...blur, preset: ev.target.value as DofBlurPreset | 'custom' })}
                className={`mt-1.5 ${inputClass} sm:w-72`}
              >
                {(['tight', 'measure', 'defect'] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(`setup.blurPreset.${p}`, { px: DOF_BLUR_PRESETS[p] })}
                  </option>
                ))}
                <option value="custom">{t('setup.blurPreset.custom')}</option>
              </select>
            </div>
            {blur.preset === 'custom' ? (
              <div>
                <label htmlFor="mount-blur-px" className={labelClass}>
                  {t('setup.blurPx')}
                </label>
                <input
                  id="mount-blur-px"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={blur.custom}
                  onChange={(ev) => setBlur({ ...blur, custom: ev.target.value })}
                  placeholder={show(DOF_BLUR_PRESETS.tight, 1)}
                  className={`mt-1.5 ${inputClass} w-28`}
                />
              </div>
            ) : null}
          </div>
          <p className={`mt-2 ${NOTE_CLASS}`}>{t('setup.blurHint')}</p>
        </Panel>
      </div>

      {figProps ? (
        <section aria-label={t('resultLabel')} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          {/* Đổi ô nhập → vẽ lại từ đầu, thanh trượt về số mới. */}
          <div className="max-w-5xl">
            <TubeFigures key={JSON.stringify(figProps)} {...figProps} blurPx={blurPx} />
          </div>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{t('missing')}</p>
      )}
    </div>
  );
}
