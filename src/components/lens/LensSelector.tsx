'use client';

import { ActionLink } from '@/components/ui/ActionLink';
import { Icon } from '@/components/ui/Icon';
import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FIELD_CELL, FIELD_GRID, FIELD_LABEL, NOTE_CLASS } from '@/components/ui/PanelHeader';
import { MOUNTS, SENSOR_FORMAT_KEYS, sensorDiagonalMm, specNumber, specString, type Component } from '@/lib/components/specs';
import { cameraFromComponent, lensFromComponent, type ConfigCamera } from '@/lib/vision/configurationRules';
import {
  STANDARD_CONVERTER_FACTORS,
  STANDARD_TUBE_LENGTHS_MM,
  activeFixedAccessory,
  cameraSensorMm,
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
import { LensDiagram, type AccessoryKind, type DiagramAccessory } from './LensDiagram';
import { ConditionFigure, FigureField } from './ConditionFigure';
import { buildScene } from './conditionScene';
import { mountCheckHref } from '@/lib/vision/mountCheckOptions';

/**
 * Giao diện Bộ chọn ống kính. Không tính gì ở đây — mọi con số đến từ
 * `@/lib/vision/lensSelector` (dùng chung công thức với OPT-001…005).
 *
 * Chốt 2026-10-18: ba tab theo họ ống (FA / telecentric / M12), ống thường và M12
 * nhập "biết 2 trong 3" (tiêu cự, khoảng cách, vùng nhìn), sơ đồ sống sáng nhãn
 * theo ô đang nhập, góc nhìn tính tại WD.
 */

// Ô nhập kiểu Hik (chốt 2026-11-28): viền xám #B3B3B3, góc 2 px, cao 32 px, viền cam khi chọn.
const inputClass =
  'h-8 w-full rounded-[2px] border border-[#B3B3B3] bg-white px-2 text-sm text-slate-900 outline-none focus:border-[#F76A05] focus:ring-2 focus:ring-[#F76A05]/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200';
/** Nhãn ô bước 1: theo form chung của web (chốt 2026-11-28). */
const hikLabel = labelClass;

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  info: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  fail: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
};

const PAGE = 30;
const TABS: LensKindFilter[] = ['fixed', 'telecentric', 'm12'];
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

/** Số cho ô trên hình: chưa có thì để trống (không ghi "—"). */
const cellValue = (value: number | null | undefined, digits: number) => (value === null || value === undefined ? '' : show(value, digits));

/* ── Cách trình bày theo Lens Selector Hikrobot (chốt 2026-11-28 Q1–Q7) ── */

/** Ba đại lượng "biết 2 trong 3" của ống thường / M12. */
type GeoField = 'f' | 'wd' | 'fov';

/** Hai ô gõ gần nhất quyết định kiểu bài toán (Q1-A): ô thứ ba là số máy tính ra. */
function modeFrom(entered: GeoField[]): GeometryMode {
  const has = (k: GeoField) => entered.includes(k);
  if (has('f') && has('wd')) return 'focal-wd';
  if (has('f') && has('fov')) return 'focal-fov';
  return 'fov-wd';
}

/** Chỗ đặt ô trên hình: tính từ cảnh 3D (cạnh đúng nét ô nói tới). */
const POS_BY_KIND = { fixed: buildScene(false).anchors, telecentric: buildScene(true).anchors };

const HIK_BUTTON =
  'inline-flex h-10 items-center justify-center rounded-[2px] bg-linear-to-b from-[#F76A05] to-[#F75200] px-5 text-sm font-medium text-white hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F76A05]';

function StepHeader({ n, title, underline = false }: { n: number; title: string; underline?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
        {n}. {title}
      </h2>
      {underline ? <div className="mt-3 h-[3px] w-24 bg-[#F75200]" /> : null}
    </div>
  );
}

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
  checkHref = '/kiem-tra-lap-dat',
}: {
  components: Component[];
  params?: LensParams;
  /** Trang Kiểm tra lắp đặt (trang xem trước local truyền /dev/…). */
  checkHref?: string;
}) {
  const t = useTranslations('lensSelector');
  const showFormulas = useShowFormulas();

  const cameras = useMemo(() => components.filter((c) => c.kind === 'camera'), [components]);
  // Ống kính + phụ kiện (ống nối, bộ nhân) — engine tự thử phụ kiện cho ống bị loại (OPT-010/011).
  const lenses = useMemo(() => components.filter((c) => c.kind === 'lens' || c.kind === 'tube' || c.kind === 'converter'), [components]);

  const [tab, setTab] = useState<LensKindFilter>('fixed');
  // Ô anh đã gõ, theo thứ tự (Q1-A): hai ô cuối quyết định kiểu bài toán.
  const [entered, setEntered] = useState<GeoField[]>([]);
  const mode = modeFrom(entered);
  const [source, setSource] = useState<'catalog' | 'manual'>(cameras.length > 0 ? 'catalog' : 'manual');
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [manual, setManual] = useState({ type: 'area' as 'area' | 'line', widthPx: '', heightPx: '', pitch: '', format: '', mount: 'C' });
  const [task, setTask] = useState(EMPTY_TASK);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [onlyAccessory, setOnlyAccessory] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  // Phụ kiện khai tay (chốt 2026-10-20, Q1–Q4): chỉ tab ống thường, để trống = không dùng.
  const [acc, setAcc] = useState(EMPTY_ACCESSORY);
  const [accOpen, setAccOpen] = useState(false);

  const tele = tab === 'telecentric';
  const POS = POS_BY_KIND[tele ? 'telecentric' : 'fixed'];
  const tubeStock = useMemo(() => stockValues(components, 'tube'), [components]);
  const converterStock = useMemo(() => stockValues(components, 'converter'), [components]);

  const brands = useMemo(() => [...new Set(cameras.map((c) => c.brand))].sort((a, b) => a.localeCompare(b)), [cameras]);
  const filteredCameras = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return cameras.filter((c) => {
      if (brand && c.brand !== brand) return false;
      const text = cameraLabel(c).toLowerCase() + ' ' + c.code.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [cameras, search, brand]);

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
  /* Gõ một cạnh vùng nhìn thì cạnh kia lấy theo tỉ lệ cảm biến (như Hik); line scan
     giữ cạnh dọc trống = chiều dài vật tuỳ chọn. */
  const sensor = camera ? cameraSensorMm(camera) : null;
  const aspect = sensor && !line && sensor.longMm > 0 ? sensor.shortMm / sensor.longMm : null;
  const typedFovW = num(task.fovW);
  const typedFovH = num(task.fovH);
  const fovW = typedFovW ?? (typedFovH !== null && aspect ? typedFovH / aspect : null);
  const fovH = typedFovH ?? (typedFovW !== null && aspect ? typedFovW * aspect : null);
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
  const [shown, setShown] = useState<{ key: string; input: LensSelectorInput; cameraId: string | null } | null>(null);
  const stale = shown !== null && shown.key !== inputKey;
  const result = useMemo(() => (shown ? selectLenses(shown.input, lenses, params) : null), [shown, lenses, params]);
  const showResults = () => {
    if (!input) return;
    setShown({ key: inputKey, input, cameraId: source === 'catalog' && cameraId ? cameraId : null });
    setLimit(PAGE);
    setOpen(null);
  };

  // Số chung cho link Kiểm tra lắp đặt trong Chi tiết (hình chuyển sang trang riêng — chốt 2026-11-11 vòng 3 Q1-B).
  const figureBase = useMemo<FigureBase | null>(() => {
    if (!shown) return null;
    const n = lensNeed(shown.input);
    if (!n) return null;
    const { fovWidthMm: w, fovHeightMm: h } = shown.input;
    const line = shown.input.camera.cameraType === 'line';
    const fa = activeFixedAccessory(shown.input);
    return {
      checkHref,
      cameraId: shown.cameraId,
      sensorLongMm: n.sensorLongMm,
      sensorShortMm: line ? null : n.sensorShortMm,
      needLongMm: line ? w : Math.max(w, h),
      needShortMm: line ? null : Math.min(w, h),
      manualTubeMm: fa?.tubeMm ?? null,
      manualConverter: fa?.converterFactor ?? null,
      pixelUm: shown.input.camera.pixelSizeUm,
      // Số pixel → trang Kiểm tra lắp đặt nhập camera tay theo pixel; camera chỉ khai cỡ danh định thì null.
      widthPx: shown.input.camera.pixelSizeUm !== null && shown.input.camera.widthPx > 0 ? shown.input.camera.widthPx : null,
      heightPx: shown.input.camera.pixelSizeUm !== null && !line && shown.input.camera.heightPx > 0 ? shown.input.camera.heightPx : null,
    };
  }, [shown, checkHref]);

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

  /* Ô trên hình (Q1-A): gõ ô nào cũng được. Ô gõ vào lên cuối danh sách "đã gõ"; quá hai
     đại lượng thì đại lượng gõ sớm nhất thành số máy tính ra (xoá số cũ của nó). */
  const geoKeys: Record<GeoField, (keyof typeof EMPTY_TASK)[]> = { f: ['f'], wd: ['wd'], fov: ['fovW', 'fovH'] };
  const setGeo = (key: 'f' | 'wd' | 'fovW' | 'fovH') => (value: string) => {
    const field: GeoField = key === 'fovW' || key === 'fovH' ? 'fov' : key;
    const next = { ...task, [key]: value };
    const stillTyped = geoKeys[field].some((k) => next[k].trim() !== '');
    let list = entered.filter((k) => k !== field);
    if (stillTyped && !tele) list.push(field);
    if (list.length > 2) {
      const dropped = list[0];
      list = list.slice(1);
      for (const k of geoKeys[dropped]) next[k] = '';
    }
    setTask(next);
    if (!tele) setEntered(list);
    setLimit(PAGE);
  };
  /** Ô đang hiện số anh gõ (true) hay số máy tính ra (false). */
  const isTyped = (key: 'f' | 'wd' | 'fovW' | 'fovH'): boolean => {
    if (tele) return task[key].trim() !== '';
    const field: GeoField = key === 'fovW' || key === 'fovH' ? 'fov' : key;
    return entered.includes(field) && task[key].trim() !== '';
  };
  const geoValue = (key: 'f' | 'wd' | 'fovW' | 'fovH'): string => {
    if (isTyped(key)) return task[key];
    if (tele) return key === 'fovW' ? cellValue(fovW, 1) : key === 'fovH' ? cellValue(line ? null : fovH, 1) : '';
    const fovTyped = entered.includes('fov');
    if (key === 'fovW') return fovTyped ? cellValue(fovW, 1) : cellValue(geometry?.fovWidthMm, 1);
    if (key === 'fovH') return line ? '' : fovTyped ? cellValue(fovH, 1) : cellValue(geometry?.fovHeightMm, 1);
    if (key === 'f') return cellValue(geometry?.focalLengthMm, 1);
    return cellValue(geometry?.workingDistanceMm, 0);
  };

  const reset = () => {
    setTask(EMPTY_TASK);
    setEntered([]);
    setSearch('');
    setBrand('');
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
    <div className="space-y-10">
      {/* ── Tab theo họ ống: gạch chân cam (Q3-A) ── */}
      <div>
        <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-x-8 border-b border-[#EBEBEB] dark:border-slate-800">
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
              className={`-mb-px border-b-[3px] pb-2 text-sm font-medium ${tab === value ? 'border-[#F75200] text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
            >
              {t(`tabs.${value}`)}
            </button>
          ))}
        </div>
        <p className={`mt-2 ${NOTE_CLASS}`}>{t(`tabHint.${tab}`)}</p>
      </div>

      {/* ── 1 Cảm biến ── */}
      <section aria-label={t('steps.sensor')} className="space-y-4">
        <StepHeader n={1} title={t('steps.sensor')} />
        <div role="radiogroup" aria-label={t('steps.sensor')} className="flex flex-wrap gap-x-12 gap-y-2">
          {(['catalog', 'manual'] as const).map((value) => (
            <label key={value} className={`inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 ${value === 'catalog' && cameras.length === 0 ? 'opacity-40' : ''}`}>
              <input
                type="radio"
                name="lens-source"
                checked={source === value}
                disabled={value === 'catalog' && cameras.length === 0}
                onChange={() => setSource(value)}
                className="size-4 accent-[#F75200]"
              />
              {t(value === 'catalog' ? 'steps.optCatalog' : 'steps.optManual')}
            </label>
          ))}
        </div>
        {source === 'catalog' ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <label htmlFor="lens-brand" className={hikLabel}>{t('steps.brand')}</label>
              <select id="lens-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={`mt-1 ${inputClass}`}>
                <option value="">{t('steps.brandAll')}</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lens-camera-search" className={hikLabel}>{t('steps.find')}</label>
              <input id="lens-camera-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('camera.search')} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label htmlFor="lens-camera-pick" className={hikLabel}>
                {t('steps.model')} <span className="text-xs">({t('camera.count', { shown: filteredCameras.length, total: cameras.length })})</span>
              </label>
              <select id="lens-camera-pick" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className={`mt-1 ${inputClass}`}>
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
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label htmlFor="lens-cam-type" className={hikLabel}>{t('camera.type')}</label>
              <select id="lens-cam-type" value={manual.type} onChange={(e) => setManual({ ...manual, type: e.target.value as 'area' | 'line' })} className={`mt-1 ${inputClass}`}>
                <option value="area">{t('camera.area')}</option>
                <option value="line">{t('camera.line')}</option>
              </select>
            </div>
            <HikNumber id="lens-cam-w" label={t('camera.widthPx')} value={manual.widthPx} onChange={(v) => setManual({ ...manual, widthPx: v })} />
            {manual.type === 'area' ? <HikNumber id="lens-cam-h" label={t('camera.heightPx')} value={manual.heightPx} onChange={(v) => setManual({ ...manual, heightPx: v })} /> : null}
            <HikNumber id="lens-cam-pitch" label={t('camera.pixelSize')} value={manual.pitch} onChange={(v) => setManual({ ...manual, pitch: v })} />
            <div>
              <label htmlFor="lens-cam-mount" className={hikLabel}>{t('camera.mount')}</label>
              <select id="lens-cam-mount" value={manual.mount} onChange={(e) => setManual({ ...manual, mount: e.target.value })} className={`mt-1 ${inputClass}`}>
                <option value="">{t('camera.mountUnknown')}</option>
                {MOUNTS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lens-cam-format" className={hikLabel}>{t('camera.sensorFormat')}</label>
              <select id="lens-cam-format" value={manual.format} onChange={(e) => setManual({ ...manual, format: e.target.value })} className={`mt-1 ${inputClass}`}>
                <option value="">{t('camera.sensorFormatAuto')}</option>
                {SENSOR_FORMAT_KEYS.map((fmt) => (
                  <option key={fmt} value={fmt}>{fmt}&quot;</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {camera && sensor ? (
          <p className={NOTE_CLASS}>
            {t('camera.summary', { w: camera.widthPx, h: camera.heightPx, pitch: show(camera.pixelSizeUm), sw: show(sensor.longMm), sh: show(sensor.shortMm) })}
          </p>
        ) : null}
      </section>

      {/* ── 2 Điều kiện làm việc: ô nhập đặt trên hình (Q1-A, Q2-A) ── */}
      <section aria-label={t('steps.conditions')} className="space-y-4">
        <StepHeader n={2} title={t('steps.conditions')} />
        <p className="text-sm text-slate-600 dark:text-slate-300">{t(tele ? 'steps.conditionsHintTele' : 'steps.conditionsHint')}</p>
        <div className="bg-[#F8F8F8] px-4 pb-5 pt-5 sm:px-6 dark:bg-slate-900/70">
          <button type="button" onClick={reset} className={HIK_BUTTON}>
            {t('steps.clear')}
          </button>
          <div className="mt-4">
            <ConditionFigure telecentric={tele} lineScan={line}>
              <FigureField
                id="lens-res"
                label={t('figure.res')}
                value={camera && camera.widthPx > 0 ? (line ? `${camera.widthPx} px` : `${camera.widthPx} × ${camera.heightPx}`) : ''}
                tone="plain"
                pos={POS.res}
                typed
                readOnly
              />
              {!tele ? <FigureField id="lens-f" label={t('task.focal')} value={geoValue('f')} typed={isTyped('f')} tone="lens" pos={POS.f} onChange={setGeo('f')} /> : null}
              {!tele ? <FigureField id="lens-aov-h" label={t('figure.aovH')} value={cellValue(need?.aovLongDeg, 1)} tone="lens" pos={POS.aovH} readOnly title={t('need.aovNote')} /> : null}
              {!tele && !line ? <FigureField id="lens-aov-v" label={t('figure.aovV')} value={cellValue(need?.aovShortDeg, 1)} tone="lens" pos={POS.aovV} readOnly title={t('need.aovNote')} /> : null}
              <FigureField id="lens-wd" label={t(tele ? 'figure.wdOptional' : 'figure.wd')} value={geoValue('wd')} typed={isTyped('wd')} tone="plain" pos={POS.wd} onChange={setGeo('wd')} title={t('task.wdHint')} />
              <FigureField id="lens-fov-w" label={t('figure.fovW')} value={geoValue('fovW')} typed={isTyped('fovW')} tone="object" pos={POS.fovW} onChange={setGeo('fovW')} />
              <FigureField id="lens-mmpx-now" label={t('figure.mmpx')} value={cellValue(need?.mmPerPx, 4)} tone="info" pos={POS.mmpx} readOnly />
              <FigureField id="lens-fov-h" label={t(line ? 'figure.fovHLine' : 'figure.fovH')} value={geoValue('fovH')} typed={isTyped('fovH')} tone="object" pos={POS.fovH} onChange={setGeo('fovH')} />
              <FigureField id="lens-beta" label={t(tele ? 'figure.betaMax' : 'figure.beta')} value={cellValue(need?.beta, 4)} tone="object" pos={POS.beta} readOnly />
            </ConditionFigure>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            ※ {!camera ? t('steps.needCamera') : !input ? t(tele ? 'need.missingTele' : `need.missing.${mode}`) : !need ? t('need.missingSensor') : t('steps.approx')}
          </p>
        </div>
        {need?.cameraTooCoarse ? (
          <p className="rounded-[2px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {t('need.cameraTooCoarse', { have: show(need.mmPerPx, 4), need: show(mmpx, 4) })}
          </p>
        ) : null}
        {need && !tele && need.fNeedDepth !== null && need.fMaxRing !== null && need.fNeedDepth > need.fMaxRing ? (
          <p className="rounded-[2px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t('need.fDepthConflict')}
          </p>
        ) : null}

        {/* Tuỳ chọn thêm — mở sẵn (Q3-A) */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('steps.extra')}</h3>
          <div className={`${FIELD_GRID} sm:grid-cols-2`}>
            <NumberInput id="lens-dh" label={t('task.heightVariation')} hint={t('task.heightVariationHint')} value={task.dh} onChange={setTaskValue('dh')} />
            <NumberInput id="lens-mmpx" label={t('task.targetMmPerPx')} hint={t('task.targetMmPerPxHint')} value={task.mmpx} onChange={setTaskValue('mmpx')} step="0.001" />
          </div>
          {tab === 'fixed' ? (
            <div className="rounded-[2px] border border-[#EBEBEB] dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAccOpen(!accOpen)}
                aria-expanded={accOpen || fixedAccessory !== null}
                aria-controls="lens-accessory"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-[#F8F8F8] dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                <span>
                  {t('accessory.title')}
                  {fixedAccessory ? (
                    <span className="ml-2 rounded-full bg-[#FFD8C1] px-2 py-0.5 text-xs font-medium text-[#8A3200] dark:bg-[#4A2412] dark:text-[#FFB48A]">{manualDesc}</span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="text-xs text-slate-500">{accOpen || fixedAccessory ? '▲' : '▼'}</span>
              </button>
              {accOpen || fixedAccessory ? (
                <div id="lens-accessory" className="space-y-3 border-t border-[#EBEBEB] px-3 py-3 dark:border-slate-700">
                  <p className={NOTE_CLASS}>{t('accessory.intro')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <NumberInput cell={false} id="lens-acc-tube" label={t('accessory.tube')} hint={t('accessory.tubeHint')} value={acc.tube} onChange={(v) => setAcc((prev) => ({ ...prev, tube: v }))} step="0.5" />
                      <QuickPick
                        values={tubeStock.length ? tubeStock : [...STANDARD_TUBE_LENGTHS_MM]}
                        fromStock={tubeStock.length > 0}
                        current={accTube}
                        format={(v) => `${show(v, 1)} mm`}
                        onPick={(v) => setAcc((prev) => ({ ...prev, tube: v === null ? '' : String(v) }))}
                      />
                    </div>
                    <div>
                      <NumberInput cell={false} id="lens-acc-conv" label={t('accessory.converter')} hint={t('accessory.converterHint')} value={acc.converter} onChange={(v) => setAcc((prev) => ({ ...prev, converter: v }))} step="0.1" />
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
        </div>

        {/* Chi tiết tính toán — gập sẵn (Q4-A) */}
        <div className="rounded-[2px] border border-[#EBEBEB] dark:border-slate-700">
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            aria-expanded={detailsOpen}
            aria-controls="lens-need"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-[#F8F8F8] dark:text-slate-200 dark:hover:bg-slate-800/60"
          >
            {t('steps.details')}
            <span aria-hidden="true" className="text-xs text-slate-500">{detailsOpen ? '▲' : '▼'}</span>
          </button>
          {detailsOpen ? (
            <div id="lens-need" className="grid gap-6 border-t border-[#EBEBEB] px-3 py-4 lg:grid-cols-2 dark:border-slate-700">
              <LensDiagram {...diagram} telecentric={tele} highlight={null} accessory={diagramAccessory} />
              {!need ? (
                <p className={`self-center ${NOTE_CLASS}`}>{t(tele ? 'need.missingTele' : `need.missing.${mode}`)}</p>
              ) : (
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
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── 3 Kết quả: nút Hiện kết quả (chốt 2026-10-26 Q2) ── */}
      <section aria-label={t('steps.result')} className="space-y-4">
        <StepHeader n={3} title={t('steps.result')} underline />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={showResults} className={HIK_BUTTON}>
            {t('list.showResults')}
          </button>
          {!need ? <span className="text-sm text-slate-500 dark:text-slate-400">{t('steps.needInput')}</span> : null}
          {stale ? <span className="text-sm text-amber-700 dark:text-amber-300">{t('list.stale')}</span> : null}
        </div>

        {/* ── Bảng ống trong kho: bảng phẳng kiểu Hik ── */}
        {result && shown ? (
        <div id="lens-list" className="border-t border-[#EBEBEB] dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('list.title')}</h3>
              <span className={NOTE_CLASS}>{`${t('list.meta', counts)}${accessoryCount > 0 ? ` · ${t('list.metaAccessory', { n: accessoryCount })}` : ''}`}</span>
            </div>
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
          </div>
          {fixedAccessory || all.some((c) => c.accessory) ? (
            <p className={`pb-3 ${NOTE_CLASS}`}>{fixedAccessory ? t('list.manualHint', { desc: manualDesc }) : t('list.accessoryHint')}</p>
          ) : null}
          <div className={stale ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          {visible.length === 0 ? (
            <p className={`py-4 ${NOTE_CLASS}`}>{t('list.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border border-[#EBEBEB] text-left text-sm text-slate-800 dark:border-slate-800 dark:text-slate-200">
                <thead className="bg-black/[0.08] text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300">
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
                    {shown.input.heightVariationMm !== null ? (
                      <th scope="col" className="py-2 pr-4 font-medium" title={t('list.dofNote')}>
                        {t('list.colDof')}
                      </th>
                    ) : null}
                    <th scope="col" className="py-2 pr-4 font-medium">{t('list.colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBEB] dark:divide-slate-800">
                  {visible.slice(0, limit).map((c) => (
                    <LensRow
                      key={c.component.id}
                      candidate={c}
                      line={shown.input.camera.cameraType === 'line'}
                      wdMm={shown.input.workingDistanceMm}
                      manualTubeMm={shown.input.fixedAccessory?.tubeMm ?? null}
                      showFSet={shown.input.heightVariationMm !== null}
                      figureBase={figureBase}
                      open={open === c.component.id}
                      onToggle={() => setOpen(open === c.component.id ? null : c.component.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visible.length > 0 ? <p className={`py-2 ${NOTE_CLASS}`}>※ {t('list.footNote')}</p> : null}
          {visible.length > limit ? (
            <div className="py-3">
              <button type="button" onClick={() => setLimit(limit + PAGE)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                {t('list.showMore', { n: Math.min(PAGE, visible.length - limit) })}
              </button>
            </div>
          ) : null}
          </div>
        </div>
        ) : null}
      </section>
    </div>
  );
}

function HikNumber({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={hikLabel}>{label}</label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 ${inputClass}`} />
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
  cell = true,
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
  /** false khi ô không đứng thẳng trong FIELD_GRID (ô phụ kiện có nút chọn nhanh bên dưới). */
  cell?: boolean;
}) {
  const t = useTranslations('lensSelector.task');
  return (
    <div className={cell ? FIELD_CELL : undefined}>
      <label htmlFor={id} className={cell ? `${FIELD_LABEL} ${labelClass}` : labelClass}>
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

type FigureBase = {
  checkHref: string;
  cameraId: string | null;
  sensorLongMm: number;
  sensorShortMm: number | null;
  needLongMm: number;
  needShortMm: number | null;
  manualTubeMm: number | null;
  manualConverter: number | null;
  /** Cỡ điểm ảnh camera (µm) → trang Kiểm tra lắp đặt tính DOF (OPT-013). */
  pixelUm: number | null;
  widthPx: number | null;
  heightPx: number | null;
};

function LensRow({
  candidate: c,
  line,
  wdMm,
  manualTubeMm,
  showFSet,
  figureBase,
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
  figureBase: FigureBase | null;
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
  // sF gần đúng (vd suy từ MOD + β tại MOD) cũng ghi "≈" (chốt 2026-11-10 Q5).
  const sFUncertain = (lens.frontFocalMm ?? null) === null || lens.frontFocalApprox === true;
  const approx = !fixedBeta && lens.focalLengthMm !== null && sFUncertain && c.fovLongMm !== null ? '≈ ' : '';
  const cell = 'py-2 pr-4 whitespace-nowrap tabular-nums';
  // Link Kiểm tra lắp đặt (ren cần vặn, dải nét, vùng nhìn thực): chỉ ống thường có tiêu cự, đã có WD.
  const checkLink =
    figureBase && wdMm !== null && lens.lensType === 'fixed' && lens.focalLengthMm !== null && lens.focalLengthMm > 0
      ? mountCheckHref(figureBase.checkHref, {
          lens: c.component.id,
          cam: figureBase.cameraId,
          w: figureBase.widthPx,
          h: figureBase.heightPx,
          sl: figureBase.widthPx === null ? figureBase.sensorLongMm : null,
          ss: figureBase.widthPx === null ? figureBase.sensorShortMm : null,
          wd: wdMm,
          e: acc?.kind === 'tube' ? acc.totalMm : figureBase.manualTubeMm,
          k: acc?.kind === 'converter' ? acc.factor : figureBase.manualConverter,
          fw: figureBase.needLongMm,
          fh: figureBase.needShortMm,
          px: figureBase.pixelUm,
          // F trên vòng ống gốc: F đặt tính trên cả hệ (× k bộ nhân).
          n: c.fSet !== null ? c.fSet / (acc?.kind === 'converter' ? acc.factor : (figureBase.manualConverter ?? 1)) : null,
        })
      : null;
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
        {showFSet ? <td className={cell}>{c.dof === null ? '—' : Number.isFinite(c.dof.totalMm) ? `${show(c.dof.totalMm, 2)} mm` : '∞'}</td> : null}
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
          <td colSpan={showFSet ? 13 : 11} className="px-4 py-3">
            {/* Bảng cuộn ngang: khung Chi tiết đứng yên bên trái, rộng không quá phần nhìn thấy. */}
            <div className="sticky left-4 max-w-[min(60rem,calc(100vw-6rem))]">
            {checkLink ? (
              <div className="mb-3">
                <ActionLink href={checkLink} variant="text" external>
                  {t('list.mountCheck')}
                </ActionLink>
              </div>
            ) : null}
            {/* Số chuyển từ bảng vào Chi tiết (Q1, Q4): WD thật, pixel dùng, F nên đặt. */}
            <dl className="mb-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
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
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('list.colDofDetail')}</dt>
                <dd className="text-sm tabular-nums text-slate-900 dark:text-slate-100">
                  {c.dof === null
                    ? t('list.fSetNeedDh')
                    : t('list.dofValue', {
                        front: show(c.dof.frontMm, 2),
                        back: Number.isFinite(c.dof.backMm) ? show(c.dof.backMm, 2) : '∞',
                        total: Number.isFinite(c.dof.totalMm) ? show(c.dof.totalMm, 2) : '∞',
                      })}
                </dd>
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
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
