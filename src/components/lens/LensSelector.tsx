'use client';

import { ActionLink } from '@/components/ui/ActionLink';
import { Icon } from '@/components/ui/Icon';
import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { MOUNTS, SENSOR_FORMAT_KEYS, sensorDiagonalMm, specNumber, specString, type Component } from '@/lib/components/specs';
import { cameraFromComponent, lensFromComponent, type ConfigCamera } from '@/lib/vision/configurationRules';
import {
  STANDARD_CONVERTER_FACTORS,
  STANDARD_TUBE_LENGTHS_MM,
  activeFixedAccessory,
  lensNeed,
  selectLenses,
  solveGeometry,
  type GeometryMode,
  type LensCandidate,
  type LensKindFilter,
  type LensParams,
  type LensSelectorInput,
} from '@/lib/vision/lensSelector';
import { renderFormula } from '@/lib/vision/formulaTerms';
import type { CheckStatus } from '@/lib/vision/types';
import { useShowFormulas } from '@/components/ui/FormulaVisibility';
import { LensDiagram, type AccessoryKind, type DiagramAccessory, type DiagramField } from './LensDiagram';

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
const EMPTY_ACCESSORY = { tube: '', converter: '' };

/** Giá trị phụ kiện có trong kho (khác nhau, tăng dần) — chọn nhanh trong ô Phụ kiện. */
function stockValues(components: Component[], kind: 'tube' | 'converter'): number[] {
  const key = kind === 'tube' ? 'length_mm' : 'factor';
  const values = components
    .filter((c) => c.kind === kind)
    .map((c) => specNumber(c.spec, key))
    .filter((v): v is number => v !== null && (kind === 'tube' ? v > 0 : v > 1));
  return [...new Set(values)].sort((a, b) => a - b);
}

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

/** Ô "WD thật" (OPT-012): khoảng cách để ống vừa khít vùng nhìn cần; chênh so với WD đã nhập; vượt MOD / dải ống nối thì chữ đỏ. */
function RealWdCell({ realWd }: { realWd: LensCandidate['realWd'] }) {
  const t = useTranslations('lensSelector.list');
  if (!realWd) return <>—</>;
  if (realWd.kind === 'fixed') {
    return (
      <>
        {realWd.minMm === realWd.maxMm ? `${show(realWd.minMm, 0)} mm` : `${show(realWd.minMm, 0)}–${show(realWd.maxMm, 0)} mm`}
        <div className={NOTE_CLASS}>{t('realWdFixed')}</div>
      </>
    );
  }
  const delta = realWd.deltaMm;
  return (
    <>
      {/* Engine đã làm tròn LÊN (1 mm, chụp cận 0,1 mm) — hiện đúng số đó, không làm tròn lại. */}
      ≈ {show(realWd.mm, 1)} mm
      {delta !== null && Math.round(delta) !== 0 ? <div className={NOTE_CLASS}>{t('realWdDelta', { delta: `${delta > 0 ? '+' : '−'}${show(Math.abs(delta), 0)}` })}</div> : null}
      {delta !== null && Math.round(delta) === 0 ? <div className={NOTE_CLASS}>{t('realWdSame')}</div> : null}
      {realWd.belowModMm !== null ? <div className="text-xs font-medium text-red-700 dark:text-red-400">{t('realWdBelowMod', { mod: show(realWd.belowModMm, 0) })}</div> : null}
      {realWd.outsideTube ? (
        <div className="text-xs font-medium text-red-700 dark:text-red-400">
          {t('realWdOutsideTube', {
            min: realWd.outsideTube.minMm !== null ? show(realWd.outsideTube.minMm, 0) : '?',
            max: Number.isFinite(realWd.outsideTube.maxMm) ? show(realWd.outsideTube.maxMm, 0) : '∞',
          })}
        </div>
      ) : null}
    </>
  );
}

/** Dòng thông tin về phụ kiện người dùng tự khai: không phải phép kiểm, ghi "Đã khai" thay cho "Chưa kiểm được". */
const DECLARED_NOTES = new Set(['tubeManual', 'converterManual']);

function StatusBadge({ status, declared = false }: { status: CheckStatus; declared?: boolean }) {
  const t = useTranslations('lensSelector.status');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}>{t(declared ? 'declared' : status)}</span>;
}

export function LensSelector({
  components,
  params,
}: {
  components: Component[];
  params?: LensParams;
}) {
  const t = useTranslations('lensSelector');
  const showFormulas = useShowFormulas();

  const cameras = useMemo(() => components.filter((c) => c.kind === 'camera'), [components]);
  // Ống kính + phụ kiện (ống nối, bộ nhân) — engine tự thử phụ kiện cho ống bị loại (OPT-010/011).
  const lenses = useMemo(() => components.filter((c) => c.kind === 'lens' || c.kind === 'tube' || c.kind === 'converter'), [components]);

  const [tab, setTab] = useState<LensKindFilter>('fixed');
  const [mode, setMode] = useState<GeometryMode>('fov-wd');
  const [source, setSource] = useState<'catalog' | 'manual'>(cameras.length > 0 ? 'catalog' : 'manual');
  const [search, setSearch] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [manual, setManual] = useState({ type: 'area' as 'area' | 'line', widthPx: '', heightPx: '', pitch: '', format: '', mount: 'C' });
  const [task, setTask] = useState(EMPTY_TASK);
  const [focus, setFocus] = useState<DiagramField | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [onlyAccessory, setOnlyAccessory] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  // Phụ kiện khai tay (chốt 2026-10-20, Q1–Q4): chỉ tab ống thường, để trống = không dùng.
  const [acc, setAcc] = useState(EMPTY_ACCESSORY);
  const [accOpen, setAccOpen] = useState(false);

  const tele = tab === 'telecentric';
  const tubeStock = useMemo(() => stockValues(components, 'tube'), [components]);
  const converterStock = useMemo(() => stockValues(components, 'converter'), [components]);

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
  const fixedAccessory = activeFixedAccessory({ lensKind: tab, fixedAccessory: { tubeMm: num(acc.tube), converterFactor: num(acc.converter) } });
  const accTube = fixedAccessory?.tubeMm ?? null;
  const accK = fixedAccessory?.converterFactor ?? null;

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
            converterFactor: accK,
          })
        : null,
    [camera, tele, mode, f, wd, fovW, fovH, accK]
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
      ? {
          camera,
          fovWidthMm: geometry.fovWidthMm,
          fovHeightMm: geometry.fovHeightMm,
          workingDistanceMm: geometry.workingDistanceMm,
          heightVariationMm: dh,
          targetMmPerPx: mmpx,
          lensKind: tab,
          fixedAccessory: accTube !== null || accK !== null ? { tubeMm: accTube, converterFactor: accK } : null,
        }
      : null;
  }, [camera, tele, line, geometry, fovW, fovH, wd, dh, mmpx, tab, accTube, accK]);

  /* Khung "Thông số cần" tính ngay khi nhập; BẢNG ống chỉ tính khi bấm "Hiển thị kết quả"
     (chốt 2026-10-26 Q2–Q3, theo luồng Lens Selector của Hikrobot). Đổi ô sau khi đã có bảng
     → bảng mờ đi, nhắc bấm lại; không tự xoá. */
  const need = useMemo(() => (input ? lensNeed(input) : null), [input]);
  const inputKey = useMemo(() => JSON.stringify(input), [input]);
  const [shown, setShown] = useState<{ key: string; input: LensSelectorInput } | null>(null);
  const stale = shown !== null && shown.key !== inputKey;
  const result = useMemo(() => (shown ? selectLenses(shown.input, lenses, params) : null), [shown, lenses, params]);
  const showResults = () => {
    if (!input) return;
    setShown({ key: inputKey, input });
    setLimit(PAGE);
    setOpen(null);
  };

  const all = result?.candidates ?? [];
  const counts = { pass: 0, warn: 0, info: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const c of all) counts[c.status]++;
  // Ống đạt nhờ phụ kiện (OPT-010/011) — đếm riêng và lọc riêng được (2026-10-20).
  const accessoryCount = all.filter((c) => c.accessory).length;
  const filterAccessory = onlyAccessory && accessoryCount > 0;
  const visible = filterAccessory ? all.filter((c) => c.accessory) : showRejected ? all : all.filter((c) => c.status !== 'fail');
  // Ống đang mở Chi tiết: có phụ kiện thì sơ đồ vẽ thêm ống nối / bộ nhân.
  const openCandidate = all.find((c) => c.component.id === open) ?? null;
  const openAccessory = openCandidate?.accessory ?? null;

  const tubeLabel = (mm: number) => t('diagram.tube', { mm: show(mm, 1) });
  const converterLabel = (k: number) => t('diagram.converter', { k: show(k, 2) });
  /* Sơ đồ: phụ kiện khai tay luôn vẽ (áp cho mọi ống); không khai thì vẽ phụ kiện gợi ý
     của ống đang mở Chi tiết. */
  const manualKinds: AccessoryKind[] = [...(accTube !== null ? (['tube'] as const) : []), ...(accK !== null ? (['converter'] as const) : [])];
  const manualDesc = [accTube !== null ? tubeLabel(accTube) : null, accK !== null ? converterLabel(accK) : null].filter(Boolean).join(' + ');
  const diagramAccessory: DiagramAccessory | null = fixedAccessory
    ? { kinds: manualKinds, labels: manualKinds.map((kind) => (kind === 'tube' ? tubeLabel(accTube!) : converterLabel(accK!))) }
    : openAccessory === null
      ? null
      : openAccessory.kind === 'tube'
        ? { kinds: ['tube'], labels: [tubeLabel(openAccessory.totalMm)] }
        : { kinds: ['converter'], labels: [converterLabel(openAccessory.factor)] };

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
    setOnlyAccessory(false);
    setAcc(EMPTY_ACCESSORY);
    setAccOpen(false);
    setLimit(PAGE);
    setOpen(null);
    setShown(null);
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
  /* Đang mở Chi tiết một ống: sơ đồ ghi số của CHÍNH ống đó (tiêu cự gốc, vùng nhìn thật kể cả
     khi có bộ nhân) thay cho số lý tưởng — để nhãn khớp với phụ kiện đang vẽ (2026-10-20). */
  if (openCandidate && openCandidate.fovLongMm !== null) {
    diagram.focalMm = tele ? null : openCandidate.lens.focalLengthMm;
    diagram.fovLongMm = openCandidate.fovLongMm;
    diagram.fovShortMm = line ? null : openCandidate.fovShortMm;
  }

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
          {tab === 'fixed' ? (
            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAccOpen(!accOpen)}
                aria-expanded={accOpen || fixedAccessory !== null}
                aria-controls="lens-accessory"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                <span>
                  {t('accessory.title')}
                  {fixedAccessory ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{manualDesc}</span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="text-xs text-slate-500">{accOpen || fixedAccessory ? '▲' : '▼'}</span>
              </button>
              {accOpen || fixedAccessory ? (
                <div id="lens-accessory" className="space-y-3 border-t border-slate-200 px-3 py-3 dark:border-slate-700">
                  <p className={NOTE_CLASS}>{t('accessory.intro')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <NumberInput id="lens-acc-tube" label={t('accessory.tube')} hint={t('accessory.tubeHint')} value={acc.tube} onChange={(v) => setAcc((prev) => ({ ...prev, tube: v }))} step="0.5" />
                      <QuickPick
                        values={tubeStock.length ? tubeStock : [...STANDARD_TUBE_LENGTHS_MM]}
                        fromStock={tubeStock.length > 0}
                        current={accTube}
                        format={(v) => `${show(v, 1)} mm`}
                        onPick={(v) => setAcc((prev) => ({ ...prev, tube: v === null ? '' : String(v) }))}
                      />
                    </div>
                    <div>
                      <NumberInput id="lens-acc-conv" label={t('accessory.converter')} hint={t('accessory.converterHint')} value={acc.converter} onChange={(v) => setAcc((prev) => ({ ...prev, converter: v }))} step="0.1" />
                      <QuickPick
                        values={converterStock.length ? converterStock : [...STANDARD_CONVERTER_FACTORS]}
                        fromStock={converterStock.length > 0}
                        current={accK}
                        format={(v) => `${show(v, 2)}×`}
                        onPick={(v) => setAcc((prev) => ({ ...prev, converter: v === null ? '' : String(v) }))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>

      {/* ── Sơ đồ + thông số cần ── */}
      <Panel id="lens-need" title={t('need.title')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <LensDiagram
            {...diagram}
            telecentric={tele}
            highlight={focus}
            accessory={diagramAccessory}
          />
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
                  formula={showFormulas ? need.betaFormula : undefined}
                  note={t(tele ? 'need.betaMaxNote' : 'need.betaNote')}
                />
                {!tele && geometry ? (
                  <NeedItem
                    label={t(mode === 'fov-wd' ? (accK ? 'need.focalPrime' : 'need.focal') : accK ? 'need.focalGivenPrime' : 'need.focalGiven')}
                    value={`${show(geometry.focalLengthMm, 1)} mm`}
                    formula={
                      !showFormulas || mode !== 'fov-wd'
                        ? undefined
                        : accK
                          ? `${show(geometry.workingDistanceMm, 0)} × (${show(need.beta, 4)} ÷ ${show(accK, 2)}) ÷ (1 + ${show(need.beta, 4)} ÷ ${show(accK, 2)})`
                          : `${show(geometry.workingDistanceMm, 0)} × ${show(need.beta, 4)} ÷ (1 + ${show(need.beta, 4)})`
                    }
                    note={accK ? t('need.focalPrimeNote', { k: show(accK, 2) }) : mode === 'fov-wd' ? t('need.focalNote') : undefined}
                  />
                ) : null}
                {!tele && geometry && mode === 'focal-fov' ? (
                  <NeedItem
                    label={t('need.wdComputed')}
                    value={`${show(geometry.workingDistanceMm, 0)} mm`}
                    formula={!showFormulas ? undefined : accK ? `${show(geometry.focalLengthMm, 1)} × (1 + ${show(accK, 2)} ÷ ${show(need.beta, 4)})` : `${show(geometry.focalLengthMm, 1)} × (1 + 1 ÷ ${show(need.beta, 4)})`}
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
                <NeedItem label={t('need.fMax')} value={need.fMaxRing !== null ? `F/${show(need.fMaxRing, 1)}` : '—'} note={tele ? t('need.fMaxNoteTele') : accK ? t('need.fMaxNotePrime', { k: show(accK, 2) }) : t('need.fMaxNote')} />
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

      {/* ── Nút Hiển thị kết quả (chốt 2026-10-26 Q2) ── */}
      {need ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={showResults}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            {t('list.showResults')}
          </button>
          {stale ? <span className="text-sm text-amber-700 dark:text-amber-300">{t('list.stale')}</span> : null}
        </div>
      ) : null}

      {/* ── Ống kính trong kho ── */}
      {result && shown ? (
        <Panel
          id="lens-list"
          title={t('list.title')}
          meta={`${t('list.meta', counts)}${accessoryCount > 0 ? ` · ${t('list.metaAccessory', { n: accessoryCount })}` : ''}`}
          note={fixedAccessory ? t('list.manualHint', { desc: manualDesc }) : all.some((c) => c.accessory) ? t('list.accessoryHint') : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {accessoryCount > 0 ? (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={onlyAccessory}
                    onChange={(e) => {
                      setOnlyAccessory(e.target.checked);
                      setLimit(PAGE);
                    }}
                    className="size-4 rounded border-amber-400 text-amber-600 dark:border-amber-700"
                  />
                  {t('list.onlyAccessory')}
                </label>
              ) : null}
              <label className={`inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 ${filterAccessory ? 'opacity-40' : ''}`}>
                <input type="checkbox" checked={showRejected} disabled={filterAccessory} onChange={(e) => setShowRejected(e.target.checked)} className="size-4 rounded border-slate-300 text-sky-600 dark:border-slate-600" />
                {t('list.showRejected')}
              </label>
            </div>
          }
          bodyClassName={stale ? 'opacity-50 transition-opacity' : 'transition-opacity'}
        >
          {visible.length === 0 ? (
            <p className={`px-4 py-4 sm:px-5 ${NOTE_CLASS}`}>{t('list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    {/* Cột theo bảng kết quả của Hikrobot (chốt 2026-10-26 Q1, Q4); F nên đặt chỉ khi có dải chiều cao vật. */}
                    <th scope="col" className="min-w-48 py-2 pl-4 pr-4 font-medium">{t('list.colLens')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colFocal')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colWd')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colBeta')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colTube')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colFovW')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colFovH')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colCircle')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colMount')}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colMmPerPx')}</th>
                    {shown.input.heightVariationMm !== null ? <th scope="col" className="py-2 pr-4 font-medium">{t('list.colFSet')}</th> : null}
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <LensRow
                      key={c.component.id}
                      candidate={c}
                      line={shown.input.camera.cameraType === 'line'}
                      wdMm={shown.input.workingDistanceMm}
                      manualTubeMm={shown.input.fixedAccessory?.tubeMm ?? null}
                      showFSet={shown.input.heightVariationMm !== null}
                      open={open === c.component.id}
                      onToggle={() => setOpen(open === c.component.id ? null : c.component.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visible.length > 0 ? <p className={`border-t border-slate-100 px-4 py-2 sm:px-5 dark:border-slate-800 ${NOTE_CLASS}`}>{t('list.footNote')}</p> : null}
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

/** Nút chọn nhanh phụ kiện: giá trị trong kho, kho chưa có thì mức chuẩn; kèm nút Không dùng. */
function QuickPick({
  values,
  fromStock,
  current,
  format,
  onPick,
}: {
  values: number[];
  fromStock: boolean;
  current: number | null;
  format: (value: number) => string;
  onPick: (value: number | null) => void;
}) {
  const t = useTranslations('lensSelector.accessory');
  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-xs font-medium ${active ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200' : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{t(fromStock ? 'fromStock' : 'standard')}</span>
      <button type="button" onClick={() => onPick(null)} aria-pressed={current === null} className={chip(current === null)}>
        {t('none')}
      </button>
      {values.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} aria-pressed={current !== null && Math.abs(current - v) < 1e-9} className={chip(current !== null && Math.abs(current - v) < 1e-9)}>
          {format(v)}
        </button>
      ))}
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

function LensRow({
  candidate: c,
  line,
  wdMm,
  manualTubeMm,
  showFSet,
  open,
  onToggle,
}: {
  candidate: LensCandidate;
  line: boolean;
  /** WD đang dùng để tính (nhập hoặc tự tính) — cột WD của bảng (Q1). */
  wdMm: number | null;
  /** Ống nối anh khai tay (áp cho mọi ống). */
  manualTubeMm: number | null;
  showFSet: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('lensSelector');
  const tv = useTranslations('selector.vision');
  const showFormulas = useShowFormulas();
  // Thông số hiển thị là của ống GỐC; c.lens đã nhân hệ số bộ nhân (nếu có) để kiểm.
  const lens = lensFromComponent(c.component);
  const acc = c.accessory;
  const fixedBeta = lens.lensType === 'telecentric' || (lens.focalLengthMm === null && lens.magnification !== null);
  const focal = fixedBeta ? '—' : lens.focalLengthMm !== null ? `${show(lens.focalLengthMm, 1)} mm${acc?.kind === 'converter' ? ` × ${show(acc.factor, 2)}` : ''}` : '—';
  // Telecentric chưa nhập WD → dải WD của hãng.
  const wd = wdMm !== null ? `${show(wdMm, 0)}` : c.realWd?.kind === 'fixed' ? (c.realWd.minMm === c.realWd.maxMm ? show(c.realWd.minMm, 0) : `${show(c.realWd.minMm, 0)}–${show(c.realWd.maxMm, 0)}`) : '—';
  const tube = acc?.kind === 'tube' ? acc.totalMm : manualTubeMm;
  const circleMm = lens.imageCircleMm ?? sensorDiagonalMm(lens.imageCircleFormat);
  const circle = circleMm !== null ? `Φ${show(circleMm, 1)} mm${lens.imageCircleFormat ? ` (${lens.imageCircleFormat}")` : ''}` : '—';
  // Ống chưa khai sF: vùng nhìn tính với sF = 0 → ghi "≈" (chốt 2026-10-26 Q3, lệch tới ±10 % so với dữ liệu hãng).
  const approx = !fixedBeta && lens.focalLengthMm !== null && (lens.frontFocalMm ?? null) === null && c.fovLongMm !== null ? '≈ ' : '';
  const cell = 'py-2 pr-4 whitespace-nowrap tabular-nums';
  return (
    <Fragment>
      <tr className={c.status === 'fail' ? 'opacity-60' : undefined}>
        <td className="py-2 pl-4 pr-4">
          <button type="button" onClick={onToggle} aria-expanded={open} className="text-left font-medium text-slate-900 hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-400">
            {c.component.brand} {c.component.model}
          </button>
          {lens.fNumberMin ? <div className={NOTE_CLASS}>F/{lens.fNumberMin}</div> : null}
        </td>
        <td className={cell}>
          {focal}
          {acc?.kind === 'converter' && !acc.inStock ? <div className={NOTE_CLASS}>{t('list.notInStock')}</div> : null}
        </td>
        <td className={cell}>{wd}</td>
        <td className={cell}>{c.beta !== null ? show(c.beta, 4) : '—'}</td>
        <td className={cell}>
          {tube !== null ? (acc?.kind === 'tube' && acc.pieces.length > 1 ? `${acc.pieces.map((p) => show(p.lengthMm, 1)).join(' + ')} = ${show(tube, 1)}` : show(tube, 1)) : '0'}
          {acc?.kind === 'tube' && !acc.inStock ? <div className={NOTE_CLASS}>{t('list.notInStock')}</div> : null}
        </td>
        <td className={cell} title={approx ? t('list.approxNote') : undefined}>
          {approx}
          {show(c.fovLongMm, 1)}
        </td>
        <td className={cell} title={approx ? t('list.approxNote') : undefined}>
          {line ? '—' : `${approx}${show(c.fovShortMm, 1)}`}
        </td>
        <td className={cell}>{circle}</td>
        <td className={cell}>{lens.mount ?? '—'}</td>
        <td className={cell}>{show(c.mmPerPx, 4)}</td>
        {showFSet ? <td className={cell}>{c.fSet === null ? '—' : `F/${show(c.fSet, 1)}`}</td> : null}
        <td className="py-2 pr-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            {/* Mở / đóng chi tiết: mũi tên thay chữ (2026-10-26). */}
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
          <td colSpan={showFSet ? 12 : 11} className="px-4 py-3">
            {/* Số chuyển từ bảng vào Chi tiết (Q1, Q4): WD thật, pixel dùng, F nên đặt. */}
            <dl className="mb-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('list.colRealWd')}</dt>
                <dd className="text-sm text-slate-900 dark:text-slate-100">
                  <RealWdCell realWd={c.realWd} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('list.colPixelUse')}</dt>
                <dd className="text-sm text-slate-900 dark:text-slate-100">{c.pixelUse === null ? '—' : `${Math.round(c.pixelUse * 100)}%`}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('list.colFSet')}</dt>
                <dd className="text-sm text-slate-900 dark:text-slate-100">{c.fSet === null ? t('list.fSetNeedDh') : `F/${show(c.fSet, 1)}`}</dd>
              </div>
            </dl>
            <p className={`mb-3 ${NOTE_CLASS}`}>{t('list.realWdNote')}</p>
            <ul className="space-y-2">
              {c.realWd?.kind === 'focal' && showFormulas ? (
                <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('list.colRealWd')} · OPT-012</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{renderFormula(c.realWd.formula, (key) => tv(`formulaTerms.${key}`))}</span>
                </li>
              ) : null}
              {c.checks.map((check, i) => (
                <li key={`${check.key}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <StatusBadge status={check.status} declared={check.status === 'info' && DECLARED_NOTES.has(check.noteKey ?? '')} />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t(`checks.${check.key}`)}</span>
                  {showFormulas ? <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{renderFormula(check.formula, (key) => tv(`formulaTerms.${key}`))}</span> : null}
                  {check.noteKey ? <span className="w-full text-sm text-slate-600 dark:text-slate-300">{t(`notes.${check.noteKey}`, check.noteValues ?? {})}</span> : null}
                </li>
              ))}
            </ul>
            {c.component.datasheet_url ? (
              <ActionLink href={c.component.datasheet_url} external variant="text" className="mt-3">
                {t('list.datasheet')}
              </ActionLink>
            ) : null}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
