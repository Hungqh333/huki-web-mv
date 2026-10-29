/**
 * Chu trình kiểm tra tự động trang Chọn ống kính (2026-10-29).
 *
 *   npm run verify:lens                         kho mẫu + kho thật (nếu có file Excel)
 *   npm run verify:lens -- --n 5000 --seed 7    nhiều ca hơn / hạt giống khác
 *   npm run verify:lens -- --catalog docs/NHAP_THIET_BI_2026-10-16_v5.xlsx
 *
 * Khác test đơn vị (scripts/test-lens-selector.ts — vài ca tính tay): ở đây sinh HÀNG NGHÌN
 * ca ngẫu nhiên có hạt giống (chạy lại ra đúng ca cũ) và kiểm bốn lớp:
 *
 *   A. Đối chiếu độc lập — tính lại β, vùng nhìn, mm/px, F#max, F đặt, WD thật và kết luận
 *      từng phép kiểm bằng công thức VIẾT LẠI ở file này (không gọi hàm engine), so với engine.
 *   B. Tính chất phải luôn đúng — trạng thái gộp, thứ tự xếp, không NaN, mỗi ống đúng một tab,
 *      đặt ống ở WD thật thì vừa khít, WD tăng không làm mất vùng nhìn, nới mm/px không làm
 *      ống đang đạt thành loại, đổi thứ tự kho không đổi kết quả, biết 2 trong 3 quay vòng.
 *   C. Phụ kiện — ống nối / bộ nhân engine gợi ý phải thật sự cứu được ống.
 *   D. Kho thật — chất lượng dữ liệu ống kính, quét bài toán điển hình, thời gian chạy.
 *
 * Ghi kết quả ra docs/kiem-tra/chon-ong-kinh-ket-qua.md. Còn lỗi → mã thoát 1.
 * Ca nằm sát ngưỡng (chênh < 0,1 %) do engine làm tròn kích thước cảm biến 3 chữ số được tách
 * riêng thành "sát ngưỡng", không tính lỗi.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import { SENSOR_FORMATS, type Component } from '../src/lib/components/specs';
import { cameraFromComponent, type ConfigCamera } from '../src/lib/vision/configurationRules';
import { DEFAULT_ENGINE_PARAMS } from '../src/lib/vision/engineParams';
import {
  evaluateLens,
  lensNeed,
  selectLenses,
  solveGeometry,
  type LensCandidate,
  type LensCheckKey,
  type LensKindFilter,
  type LensSelectorInput,
} from '../src/lib/vision/lensSelector';
import { parseWorkbook } from './lib/components-io';
import { readWorkbook } from './lib/components-workbook';

// ───────────────────────────────────────────── tham số dòng lệnh ──
const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const N = Number(arg('n', '3000'));
const SEED = Number(arg('seed', '20261029'));
const CATALOG_FILE = arg('catalog', 'docs/NHAP_THIET_BI_2026-10-16_v5.xlsx');
const OUT_FILE = arg('out', 'docs/kiem-tra/chon-ong-kinh-ket-qua.md');
const P = DEFAULT_ENGINE_PARAMS;

// ───────────────────────────────────────────── số ngẫu nhiên có hạt giống ──
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
const range = (min: number, max: number) => min + rnd() * (max - min);
const chance = (p: number) => rnd() < p;
const r1 = (x: number) => Math.round(x * 10) / 10;

// ───────────────────────────────────────────── sổ ghi kết quả ──
type Outcome = { pass: number; fail: number; boundary: number; samples: string[] };
const results = new Map<string, Outcome>();
const SECTION: Record<string, string> = {};
function record(section: string, name: string, ok: boolean | 'boundary', detail?: () => string) {
  const key = `${section} · ${name}`;
  SECTION[key] = section;
  const r = results.get(key) ?? { pass: 0, fail: 0, boundary: 0, samples: [] };
  if (ok === 'boundary') r.boundary++;
  else if (ok) r.pass++;
  else {
    r.fail++;
    if (r.samples.length < 5 && detail) r.samples.push(detail());
  }
  results.set(key, r);
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
/** So số engine đã làm tròn `digits` chữ số với số tính lại. */
const sameRounded = (engine: number | null, exact: number | null, digits: number) => {
  if (engine === null || exact === null) return engine === exact;
  return Math.abs(engine - exact) <= 0.5 * 10 ** -digits + 1e-9 * Math.max(1, Math.abs(exact));
};

// ───────────────────────────────────────────── công thức viết lại (độc lập engine) ──
const LAMBDA_UM = 0.55; // OPT-004, ánh sáng xanh lục
const COC_PX = 2; // vòng mờ cho phép = 2 pixel (OPT-005)
const formatDiag = (format: string | null | undefined) => {
  const f = format ? SENSOR_FORMATS[format] : undefined;
  return f ? Math.hypot(f.widthMm, f.heightMm) : null;
};

type Oracle = {
  sensorLong: number;
  sensorShort: number;
  sensorDiag: number;
  needBeta: number;
};

function oracleSensor(camera: ConfigCamera): { long: number; short: number; diag: number } | null {
  const line = camera.cameraType === 'line';
  if (camera.pixelSizeUm !== null && camera.widthPx > 0) {
    const a = (camera.widthPx * camera.pixelSizeUm) / 1000;
    const b = line ? 0 : (camera.heightPx * camera.pixelSizeUm) / 1000;
    const diag = formatDiag(camera.sensorFormat) ?? Math.hypot(a, b);
    return { long: Math.max(a, b), short: Math.min(a, b), diag };
  }
  const f = camera.sensorFormat ? SENSOR_FORMATS[camera.sensorFormat] : undefined;
  if (!f) return null;
  const long = Math.max(f.widthMm, f.heightMm);
  const short = line ? 0 : Math.min(f.widthMm, f.heightMm);
  return { long, short, diag: formatDiag(camera.sensorFormat) ?? Math.hypot(long, short) };
}

function oracleNeed(input: LensSelectorInput): Oracle | null {
  const s = oracleSensor(input.camera);
  if (!s) return null;
  const line = input.camera.cameraType === 'line';
  const fL = Math.max(input.fovWidthMm, input.fovHeightMm);
  const fS = Math.min(input.fovWidthMm, input.fovHeightMm);
  const needBeta = line ? s.long / input.fovWidthMm : s.short > 0 ? Math.min(s.long / fL, s.short / fS) : s.long / fL;
  return { sensorLong: s.long, sensorShort: s.short, sensorDiag: s.diag, needBeta };
}

type Status = 'pass' | 'warn' | 'fail' | 'info';
const WORST: Status[] = ['fail', 'warn', 'pass', 'info'];
const worst = (list: Status[]): Status | null => (list.length === 0 ? null : WORST.find((s) => list.includes(s))!);

/** Kết luận từng phép kiểm của MỘT ống trơn (không phụ kiện) — viết lại theo sổ tay công thức. */
function oracleLens(input: LensSelectorInput, o: Oracle, c: Component) {
  const s = c.spec as Record<string, unknown>;
  const num = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : null);
  const str = (k: string) => (typeof s[k] === 'string' ? (s[k] as string) : null);
  const tele = str('lens_type') === 'telecentric';
  const f = num('focal_length_mm');
  const mag = num('magnification');
  const sF = num('front_focal_mm') ?? 0;
  const mod = num('wd_min_mm');
  const wdMax = num('wd_max_mm');
  const fMin = num('f_number_min');
  const fMax = num('f_number_max');
  const lp = num('resolution_lp_mm');
  const circle = num('image_circle_mm') ?? formatDiag(str('image_circle'));
  const mount = str('mount');
  const cam = input.camera;
  const pitch = cam.pixelSizeUm;
  const wd = input.workingDistanceMm;
  const line = cam.cameraType === 'line';
  const out: Partial<Record<LensCheckKey, Status>> = {};
  /** Biên độ (tương đối) tới ngưỡng gần nhất — < 1e-3 coi là sát ngưỡng. */
  const margins: number[] = [];

  // Ngàm
  if (mount === null || cam.mount === null) out.mount = 'info';
  else out.mount = mount === cam.mount ? 'pass' : mount === 'C' && cam.mount === 'CS' ? 'warn' : 'fail';

  // Vòng ảnh — so đường chéo cảm biến, cho phép thiếu imageCircleTolerance
  if (circle === null) out.imageCircle = 'info';
  else {
    const limit = o.sensorDiag * (1 - P.imageCircleTolerance);
    out.imageCircle = circle >= limit ? 'pass' : 'fail';
    margins.push(rel(circle, limit));
  }

  // Khoảng cách làm việc + β (Newton: β = f ÷ (WD − sF))
  let beta: number | null = null;
  const fixedMag = tele || (f === null && mag !== null);
  if (fixedMag) {
    beta = mag;
    if (mod === null && wdMax === null) out.workingDistance = 'info';
    else if (wd === null) out.workingDistance = 'info';
    else {
      // Q2 2026-10-29: trong dải → đạt; lệch ≤ ±dung sai → cảnh báo; xa hơn → loại
      const lo = mod ?? wdMax!;
      const hi = wdMax ?? mod!;
      const tol = P.telecentricWdTolerance;
      out.workingDistance = wd >= lo && wd <= hi ? 'pass' : wd >= lo * (1 - tol) && wd <= hi * (1 + tol) ? 'warn' : 'fail';
      margins.push(rel(wd, lo), rel(wd, hi), rel(wd, lo * (1 - tol)), rel(wd, hi * (1 + tol)));
    }
  } else if (f !== null && wd === null) out.workingDistance = 'info';
  else if (f !== null && wd !== null) {
    const x = wd - sF;
    beta = f > 0 && x > 0 ? f / x : null;
    if (beta === null) out.workingDistance = 'fail';
    else if (mod !== null) {
      out.workingDistance = wd >= mod ? 'pass' : 'fail';
      margins.push(rel(wd, mod));
    } else out.workingDistance = 'info';
  } else out.fov = 'info';

  let fovL: number | null = null;
  let fovS: number | null = null;
  let mmPerPx: number | null = null;
  if (beta !== null && beta > 0) {
    fovL = o.sensorLong / beta;
    fovS = o.sensorShort / beta;
    const needL = line ? input.fovWidthMm : Math.max(input.fovWidthMm, input.fovHeightMm);
    const needS = Math.min(input.fovWidthMm, input.fovHeightMm);
    const covers = fovL >= needL && (line || fovS >= needS);
    margins.push(rel(fovL, needL));
    if (!line) margins.push(rel(fovS, needS));
    const excess = line ? fovL / needL : Math.min(fovL / needL, fovS / needS);
    const tooWide = covers && excess > P.lensFovMaxRatio;
    if (covers) margins.push(rel(excess, P.lensFovMaxRatio));
    out.fov = covers && !tooWide ? 'pass' : 'fail';
    if (pitch !== null) {
      mmPerPx = pitch / 1000 / beta;
      if (input.targetMmPerPx !== null) {
        out.pixel = mmPerPx <= input.targetMmPerPx ? 'pass' : 'fail';
        margins.push(rel(mmPerPx, input.targetMmPerPx));
      }
    }
  }

  // Độ phân giải ống — Nyquist 1 ÷ (2 × pitch)
  if (pitch !== null && pitch > 0) {
    const need = 1 / (2 * (pitch / 1000));
    if (lp !== null) {
      out.resolution = lp >= need ? 'pass' : 'warn';
      margins.push(rel(lp, need));
    } else out.resolution = pitch < 3 ? 'warn' : 'info';
  }

  // Nhiễu xạ — F#max hiệu dụng = 2·pitch ÷ (2,44·λ), trên vòng khẩu chia (1 + β) (ống thường)
  let fMaxRing: number | null = null;
  if (pitch !== null) {
    const factor = tele || beta === null || !(beta > 0) ? 1 : 1 + beta;
    fMaxRing = (2 * pitch) / (2.44 * LAMBDA_UM) / factor;
    if (fMin !== null) {
      // Q3 2026-10-29: telecentric vượt ≤ ngưỡng lần → cảnh báo
      out.diffraction = fMin <= fMaxRing ? 'pass' : tele && fMin <= fMaxRing * P.telecentricDiffractionTolerance ? 'warn' : 'fail';
      margins.push(rel(fMin, fMaxRing), rel(fMin, fMaxRing * P.telecentricDiffractionTolerance));
    } else out.diffraction = 'info';
  }

  // Độ sâu ↔ nhiễu xạ — F cần = Δh·β² ÷ (2·c·(1 + β)), telecentric nhân (1 + β)
  let fSet: number | null = null;
  const dh = input.heightVariationMm;
  if (dh !== null && dh > 0 && beta !== null && beta > 0 && pitch !== null && fMaxRing !== null) {
    const coc = (COC_PX * pitch) / 1000;
    let fNeed = (dh * beta ** 2) / (2 * coc * (1 + beta));
    if (tele) fNeed *= 1 + beta;
    const ratio = fNeed / fMaxRing;
    fSet = Math.max(fNeed, fMin ?? 1);
    margins.push(rel(ratio, P.dofDiffractionTolerance), rel(ratio, 1));
    if (fMax !== null) margins.push(rel(fNeed, fMax));
    out.depth = ratio > P.dofDiffractionTolerance ? 'warn' : fMax !== null && fNeed > fMax ? 'fail' : ratio > 1 ? 'warn' : 'pass';
  }

  // WD thật (OPT-012): WD = f ÷ β_vừa + sF
  let realWd: number | null = null;
  if (!fixedMag && f !== null) {
    const needL = line ? input.fovWidthMm : Math.max(input.fovWidthMm, input.fovHeightMm);
    const needS = Math.min(input.fovWidthMm, input.fovHeightMm);
    const fit = line || !(o.sensorShort > 0) ? o.sensorLong / needL : Math.min(o.sensorLong / needL, o.sensorShort / needS);
    // Q1 2026-10-29: làm tròn LÊN tới 1 mm (0,1 mm khi WD − sF < 50 mm)
    const exact = f / fit + sF;
    realWd = exact - sF >= 50 ? Math.ceil(exact - 1e-6) : Math.round(Math.ceil(exact * 10 - 1e-6)) / 10;
  }

  const judged = (Object.values(out) as Status[]).filter((x) => x !== 'info');
  const overall: Status = beta === null && !judged.includes('fail') ? 'info' : (worst(judged) ?? 'info');
  return { checks: out, overall, beta, fovL, fovS, mmPerPx, fSet, realWd, nearBoundary: margins.some((m) => m < 1e-3) };
}

// ───────────────────────────────────────────── sinh dữ liệu giả lập ──
const FORMATS = Object.keys(SENSOR_FORMATS);
let nextId = 0;
const component = (kind: string, spec: Record<string, unknown>): Component =>
  ({
    id: `syn-${String(nextId).padStart(5, '0')}`,
    code: `SYN-${nextId++}`,
    kind,
    brand: 'Syn',
    model: `M${nextId}`,
    spec,
    price_vnd: null,
    datasheet_url: null,
    source: 'manual',
    notes_vi: null,
    notes_en: null,
    is_active: true,
    sort_order: 0,
  }) as unknown as Component;

function synLens(): Component {
  const kind = rnd();
  const spec: Record<string, unknown> = {};
  const maybe = (key: string, value: unknown, p = 0.85) => {
    if (chance(p)) spec[key] = value;
  };
  if (kind < 0.55) {
    spec.lens_type = chance(0.1) ? 'macro' : 'fixed';
    maybe('focal_length_mm', pick([4, 6, 8, 12, 16, 25, 35, 50, 75, 100]), 0.95);
    maybe('mount', pick(['C', 'C', 'C', 'CS', 'F', 'M42']), 0.95);
    maybe('wd_min_mm', pick([30, 50, 100, 150, 200, 300, 500, 1000]));
    maybe('front_focal_mm', r1(range(-20, 40)), 0.4);
  } else if (kind < 0.75) {
    spec.lens_type = 'fixed';
    spec.mount = 'M12';
    maybe('focal_length_mm', pick([2.8, 4, 6, 8, 12, 16, 25]), 0.95);
    maybe('wd_min_mm', pick([20, 50, 100]), 0.6);
  } else {
    spec.lens_type = 'telecentric';
    maybe('magnification', pick([0.05, 0.1, 0.16, 0.25, 0.5, 1, 2]), 0.95);
    maybe('mount', pick(['C', 'M42', 'M58']), 0.95);
    const nominal = pick([65, 110, 160, 220, 300, 450]);
    if (chance(0.9)) {
      const tol = chance(0.5) ? 0 : pick([2, 5, 10]);
      spec.wd_min_mm = nominal - tol;
      if (chance(0.8)) spec.wd_max_mm = nominal + tol;
    }
  }
  if (chance(0.7)) spec.image_circle_mm = pick([6, 8, 11, 16, 17.6, 22, 28, 43, 56]);
  else maybe('image_circle', pick(FORMATS), 0.7);
  maybe('f_number_min', pick([1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8]));
  maybe('f_number_max', pick([11, 16, 22, 32]), 0.7);
  maybe('resolution_lp_mm', pick([60, 90, 120, 160, 200, 300]), 0.5);
  return component('lens', spec);
}

function synCamera(): ConfigCamera {
  if (chance(0.15)) {
    return { cameraType: 'line', widthPx: pick([2048, 4096, 8192, 16384]), heightPx: 1, pixelSizeUm: pick([3.5, 5, 7, 7.04, 10, 14]), sensorFormat: null, mount: pick(['M42', 'M72', 'F', 'C']), interfaceName: 'GigE', maxFps: null, bytesPerPx: 1 };
  }
  if (chance(0.1)) {
    // Camera nhập tay: chỉ cỡ danh nghĩa, chưa có pitch
    return { cameraType: 'area', widthPx: 0, heightPx: 0, pixelSizeUm: null, sensorFormat: pick(FORMATS), mount: pick(['C', 'CS']), interfaceName: null, maxFps: null, bytesPerPx: 1 };
  }
  const [w, h] = pick([[640, 480], [1440, 1080], [2448, 2048], [4096, 3000], [5472, 3648], [8192, 5460], [2592, 1944], [1280, 1024]]);
  return {
    cameraType: 'area',
    widthPx: w,
    heightPx: h,
    pixelSizeUm: pick([1.1, 1.85, 2.4, 2.74, 3.45, 4.5, 5.5, 7.4]),
    sensorFormat: chance(0.6) ? pick(FORMATS) : null,
    mount: pick(['C', 'C', 'CS', 'M12', 'M42', 'M58']),
    interfaceName: 'GigE',
    maxFps: null,
    bytesPerPx: 1,
  };
}

function synInput(camera: ConfigCamera): LensSelectorInput {
  const fovW = r1(range(5, 600));
  const fovH = chance(0.3) ? fovW : r1(fovW * range(0.3, 1.5));
  const lensKind: LensKindFilter = pick(['fixed', 'fixed', 'telecentric', 'm12']);
  const wd = lensKind === 'telecentric' && chance(0.4) ? null : Math.round(range(30, 2000));
  const accessory = lensKind === 'fixed' && chance(0.15) ? { tubeMm: chance(0.6) ? pick([1, 5, 10, 20]) : null, converterFactor: chance(0.5) ? pick([1.4, 2]) : null } : null;
  return {
    camera,
    fovWidthMm: fovW,
    fovHeightMm: fovH,
    workingDistanceMm: wd,
    heightVariationMm: chance(0.4) ? r1(range(0.1, 40)) : null,
    targetMmPerPx: chance(0.4) ? Math.round(range(0.005, 0.5) * 1000) / 1000 : null,
    lensKind,
    fixedAccessory: accessory,
  };
}

// ───────────────────────────────────────────── các lớp kiểm tra ──
const finite = (x: unknown) => x === null || x === undefined || (typeof x === 'number' && Number.isFinite(x));
const describeInput = (input: LensSelectorInput) =>
  `cam ${input.camera.cameraType} ${input.camera.widthPx}×${input.camera.heightPx} p${input.camera.pixelSizeUm ?? '?'} ${input.camera.sensorFormat ?? '-'} ${input.camera.mount ?? '-'} · FOV ${input.fovWidthMm}×${input.fovHeightMm} · WD ${input.workingDistanceMm ?? '-'} · Δh ${input.heightVariationMm ?? '-'} · mm/px ${input.targetMmPerPx ?? '-'} · tab ${input.lensKind}`;
const describeLens = (c: Component) => `${c.code} ${JSON.stringify(c.spec)}`;

/** Lớp A: so một ống trơn với công thức viết lại. */
function checkOracle(section: string, input: LensSelectorInput, catalogLenses: Component[]) {
  const need = lensNeed(input);
  const o = oracleNeed(input);
  if (!need || !o) return;
  record(section, 'A1 β cần = min(cạnh cảm biến ÷ cạnh vùng nhìn)', sameRounded(need.beta, o.needBeta, 5), () => `${describeInput(input)} → engine ${need.beta}, tính lại ${o.needBeta}`);
  if (input.camera.pixelSizeUm !== null) {
    const mmpp = input.camera.pixelSizeUm / 1000 / o.needBeta;
    record(section, 'A2 mm/px cần = pitch ÷ β', sameRounded(need.mmPerPx, mmpp, 5), () => `${describeInput(input)} → ${need.mmPerPx} vs ${mmpp}`);
  }
  for (const lens of catalogLenses) {
    const e = evaluateLens(input, need, lens);
    const x = oracleLens(input, o, lens);
    const byKey: Partial<Record<LensCheckKey, Status>> = {};
    for (const key of Object.keys(x.checks) as LensCheckKey[]) {
      const list = e.checks.filter((c) => c.key === key).map((c) => c.status as Status);
      byKey[key] = worst(list) ?? undefined;
    }
    const keyOk = (Object.keys(x.checks) as LensCheckKey[]).every((k) => byKey[k] === x.checks[k]);
    const overallOk = e.status === x.overall;
    const verdict = keyOk && overallOk ? true : x.nearBoundary ? 'boundary' : false;
    record(section, 'A3 kết luận từng phép kiểm (ngàm, vòng ảnh, WD, vùng nhìn, mm/px, lp/mm, nhiễu xạ, độ sâu)', verdict, () => {
      const diff = (Object.keys(x.checks) as LensCheckKey[]).filter((k) => byKey[k] !== x.checks[k]).map((k) => `${k}: engine ${byKey[k] ?? '—'} / tính lại ${x.checks[k]}`);
      return `${describeInput(input)} · ${describeLens(lens)} → ${diff.join('; ') || `tổng: engine ${e.status} / tính lại ${x.overall}`}`;
    });
    if (x.beta !== null && e.beta !== null) {
      const exact = sameRounded(e.beta, x.beta, 5) && sameRounded(e.fovLongMm, x.fovL, 1) && sameRounded(e.fovShortMm, x.fovS, 1);
      // Engine làm tròn kích thước cảm biến 3 chữ số trước khi chia β → lệch tối đa 0,0005 mm ÷ cạnh cảm biến.
      // Tính lại với cảm biến làm tròn 3 chữ số như engine: khớp thì lệch chỉ do làm tròn.
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const nearly = sameRounded(e.beta, x.beta, 5) && sameRounded(e.fovLongMm, r3(o.sensorLong) / x.beta, 1) && sameRounded(e.fovShortMm, r3(o.sensorShort) / x.beta, 1);
      record(section, 'A4 β ống = f ÷ (WD − sF), vùng nhìn = cảm biến ÷ β', exact ? true : nearly ? 'boundary' : false, () => `${describeLens(lens)} · ${describeInput(input)} → β ${e.beta}/${x.beta}, FOV ${e.fovLongMm}×${e.fovShortMm} / ${x.fovL}×${x.fovS}`);
    } else record(section, 'A4 β ống = f ÷ (WD − sF), vùng nhìn = cảm biến ÷ β', (x.beta === null) === (e.beta === null), () => `${describeLens(lens)} → engine β ${e.beta}, tính lại ${x.beta}`);
    if (x.mmPerPx !== null) record(section, 'A5 mm/px của ống', sameRounded(e.mmPerPx, x.mmPerPx, 5), () => `${describeLens(lens)} → ${e.mmPerPx} vs ${x.mmPerPx}`);
    if (x.fSet !== null) record(section, 'A6 F nên đặt = max(F cần cho độ sâu, F nhỏ nhất của ống)', sameRounded(e.fSet, x.fSet, 1), () => `${describeInput(input)} · ${describeLens(lens)} → ${e.fSet} vs ${x.fSet}`);
    if (x.realWd !== null) {
      const ok = e.realWd?.kind === 'focal' && Math.abs(e.realWd.mm - x.realWd) < 1e-9;
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const lineCam = input.camera.cameraType === 'line';
      const needL = lineCam ? input.fovWidthMm : Math.max(input.fovWidthMm, input.fovHeightMm);
      const needS = Math.min(input.fovWidthMm, input.fovHeightMm);
      const fitR = lineCam || !(o.sensorShort > 0) ? r3(o.sensorLong) / needL : Math.min(r3(o.sensorLong) / needL, r3(o.sensorShort) / needS);
      const f = lens.spec.focal_length_mm as number;
      const sF = typeof lens.spec.front_focal_mm === 'number' ? lens.spec.front_focal_mm : 0;
      // Số thực sát số nguyên (vd 240,0000002): ceil hai phía có thể chênh 1 mm
      const nearly = e.realWd?.kind === 'focal' && Math.abs(e.realWd.mm - (f / fitR + sF)) < 1 + 1e-6 && Math.abs(f / fitR + sF - Math.round(f / fitR + sF)) < 1e-5;
      record(section, 'A7 WD thật = f ÷ β_vừa + sF', ok ? true : nearly ? 'boundary' : false, () => `${describeLens(lens)} · ${describeInput(input)} → ${JSON.stringify(e.realWd)} vs ${x.realWd}`);
    }
  }
}

const RANK = (c: LensCandidate) => (c.status === 'pass' ? 0 : c.status === 'warn' ? (c.accessory ? 2 : 1) : c.status === 'info' ? 3 : 4);

/** Lớp B + C: tính chất của cả danh sách. */
function checkProperties(section: string, input: LensSelectorInput, catalog: Component[]) {
  const { need, candidates } = selectLenses(input, catalog);
  if (!need) return;

  // B1 trạng thái gộp đúng từ các phép kiểm
  for (const c of candidates) {
    const judged = c.checks.filter((k) => k.status !== 'info').map((k) => k.status);
    const expected = c.beta === null && !judged.includes('fail') ? 'info' : judged.includes('fail') ? 'fail' : judged.includes('warn') || c.accessory ? 'warn' : judged.length ? 'pass' : 'info';
    record(section, 'B1 trạng thái ống gộp đúng từ các phép kiểm', c.status === expected, () => `${c.component.code}: ${c.status} ≠ ${expected}`);
    // B3 không NaN / vô cực lọt ra màn hình
    const numbers = [c.beta, c.fovLongMm, c.fovShortMm, c.mmPerPx, c.pixelUse, c.fSet, c.realWd?.kind === 'focal' ? c.realWd.mm : null];
    const text = c.checks.map((k) => `${k.formula} ${JSON.stringify(k.noteValues ?? {})}`).join(' ');
    record(section, 'B3 không có NaN / undefined / Infinity trong số và công thức', numbers.every(finite) && !/NaN|undefined|Infinity/.test(text), () => `${c.component.code}: ${numbers.join(', ')} · ${text.slice(0, 200)}`);
    // Làm tròn 3 chữ số: ống rộng gấp nhiều lần vật cho 0 (ống đó đã bị LNS-005 loại).
    if (c.pixelUse !== null) record(section, 'B3b phần pixel dùng ∈ [0; 1]', c.pixelUse >= 0 && c.pixelUse <= 1 + 1e-9 && (c.pixelUse > 0 || c.status === 'fail'), () => `${c.component.code}: ${c.pixelUse} (${c.status})`);
  }
  // B2 thứ tự xếp: đạt → cảnh báo → đạt nhờ phụ kiện → chưa kiểm được → loại; cùng nhóm thì pixel dùng giảm dần
  let sorted = true;
  for (let i = 1; i < candidates.length; i++) {
    const a = candidates[i - 1];
    const b = candidates[i];
    if (RANK(a) > RANK(b) || (RANK(a) === RANK(b) && (a.pixelUse ?? -1) < (b.pixelUse ?? -1) - 1e-12)) sorted = false;
  }
  record(section, 'B2 thứ tự xếp hạng', sorted, () => describeInput(input));

  // B6 đổi thứ tự kho không đổi kết quả
  const shuffled = [...catalog].sort(() => rnd() - 0.5);
  const again = selectLenses(input, shuffled).candidates;
  record(section, 'B6 đảo thứ tự kho → cùng danh sách, cùng thứ tự', again.map((c) => `${c.component.id}:${c.status}`).join() === candidates.map((c) => `${c.component.id}:${c.status}`).join(), () => describeInput(input));

  const fixed = !input.fixedAccessory || input.lensKind !== 'fixed';
  for (const c of candidates) {
    if (!fixed || c.accessory) continue;
    const fovOk = c.checks.filter((k) => k.key === 'fov').every((k) => k.status === 'pass');
    // B4 đặt ống ở WD thật → vùng nhìn vừa khít (phủ được, không rộng quá)
    if (c.realWd?.kind === 'focal' && c.realWd.mm > 0 && input.lensKind !== 'telecentric') {
      const at = { ...input, workingDistanceMm: c.realWd.mm };
      const n2 = lensNeed(at);
      if (n2) {
        const e2 = evaluateLens(at, n2, c.component);
        const fovChecks = e2.checks.filter((k) => k.key === 'fov');
        const ok = fovChecks.length > 0 && fovChecks.every((k) => k.status === 'pass');
        // WD thật lưu làm tròn 0,1 mm → hụt vùng nhìn ≤ 0,05 mm ÷ WD (tương đối): sát ngưỡng
        const needL = input.camera.cameraType === 'line' ? input.fovWidthMm : Math.max(input.fovWidthMm, input.fovHeightMm);
        const needS = Math.min(input.fovWidthMm, input.fovHeightMm);
        const shortfall = Math.max(e2.fovLongMm !== null ? 1 - e2.fovLongMm / needL : 0, input.camera.cameraType === 'line' || e2.fovShortMm === null ? 0 : 1 - e2.fovShortMm / needS);
        // Lệch 0,05 mm trên WD thật nhỏ (vd 16 mm) đã là 0,3 % vùng nhìn
        const x = c.realWd.mm - (c.lens.frontFocalMm ?? 0);
        const tiny = fovChecks.some((k) => k.noteKey === 'fovTooSmall') && shortfall < 0.06 / Math.max(x, 1e-3) + 2e-3;
        record(section, 'B4 đặt ống đúng WD thật (0,1 mm) → vùng nhìn vừa khít', ok ? true : tiny ? 'boundary' : false, () => `${describeLens(c.component)} · ${describeInput(input)} → WD thật ${c.realWd && c.realWd.kind === 'focal' ? c.realWd.mm : '-'}: ${fovChecks.map((k) => k.formula).join(' | ')}`);
        // B11 phía người dùng: bảng hiện "≈ N mm" — nhập đúng số đó thì không được loại vì vùng nhìn hẹp.
        const shown = Number.isInteger(c.realWd.mm) ? c.realWd.mm : Math.round(c.realWd.mm * 10) / 10;
        const atShown = { ...input, workingDistanceMm: shown };
        const n3 = lensNeed(atShown);
        if (n3) {
          const e3 = evaluateLens(atShown, n3, c.component);
          const narrow = e3.checks.find((k) => k.key === 'fov' && k.noteKey === 'fovTooSmall');
          record(section, 'B11 nhập đúng "WD thật ≈ N mm" đang hiển thị → ống không bị loại vì vùng nhìn hẹp', !narrow, () => `${c.component.code} f ${c.lens.focalLengthMm} · ${describeInput(input)} → WD thật ${c.realWd && c.realWd.kind === 'focal' ? c.realWd.mm : '-'} hiện "≈ ${shown} mm"; nhập ${shown}: ${narrow?.formula}`);
        }
      }
    }
    // B5 xa hơn 10 % → vùng nhìn chỉ rộng ra (ống đang phủ được vẫn phủ được)
    if (fovOk && c.beta !== null && input.workingDistanceMm !== null && input.lensKind !== 'telecentric') {
      const far = { ...input, workingDistanceMm: input.workingDistanceMm * 1.1 };
      const n2 = lensNeed(far);
      if (n2) {
        const e2 = evaluateLens(far, n2, c.component);
        const stillCovers = !e2.checks.some((k) => k.key === 'fov' && k.noteKey === 'fovTooSmall');
        record(section, 'B5 WD tăng 10 % không làm ống mất vùng nhìn', stillCovers, () => `${describeLens(c.component)} · ${describeInput(input)}`);
      }
    }
  }
  // B7 nới mm/px cần (× 2) → ống đang đạt không thành loại
  if (input.targetMmPerPx !== null) {
    const relaxed = selectLenses({ ...input, targetMmPerPx: input.targetMmPerPx * 2 }, catalog).candidates;
    const status = new Map(relaxed.map((c) => [c.component.id, c.status]));
    for (const c of candidates) {
      if (c.status !== 'pass') continue;
      record(section, 'B7 nới mm/px cần không làm ống đang đạt bị loại', status.get(c.component.id) !== 'fail', () => `${c.component.code} · ${describeInput(input)}`);
    }
  }
  // B8 nới ngưỡng "vùng nhìn rộng quá" (LNS-005) không làm thêm ống bị loại
  const loose = selectLenses(input, catalog, { ...P, lensFovMaxRatio: P.lensFovMaxRatio * 2 }).candidates;
  const looseFails = loose.filter((c) => c.status === 'fail').length;
  record(section, 'B8 nới ngưỡng LNS-005 không làm thêm ống bị loại', looseFails <= candidates.filter((c) => c.status === 'fail').length, () => describeInput(input));

  // C phụ kiện engine tự gợi ý
  for (const c of candidates) {
    const acc = c.accessory;
    if (!acc) continue;
    if (acc.kind === 'tube') {
      const inRange = acc.totalMm >= acc.needMinMm - 1e-6 && acc.totalMm <= acc.needMaxMm + 1e-6;
      const wd = input.workingDistanceMm!;
      const reach = wd >= acc.wdMinMm - 1e-6 && wd <= acc.wdMaxMm + 1e-6;
      record(section, 'C1 ống nối gợi ý: tổng chiều dài trong dải cần và WD nằm trong dải lấy nét mới', inRange && reach, () => `${describeLens(c.component)} · ${describeInput(input)} → ${JSON.stringify(acc)}`);
      // Khai tay đúng ống nối đó → WD phải đạt
      const manual = { ...input, fixedAccessory: { tubeMm: acc.totalMm, converterFactor: null } };
      const n2 = lensNeed(manual)!;
      const again2 = selectLenses(manual, [c.component]).candidates[0];
      const wdOk = again2 && again2.checks.filter((k) => k.key === 'workingDistance').every((k) => k.status === 'pass');
      record(section, 'C2 khai tay đúng ống nối gợi ý → WD đạt', !!wdOk && !!n2, () => `${describeLens(c.component)} · ${describeInput(input)} → ${again2?.checks.filter((k) => k.key === 'workingDistance').map((k) => k.formula).join(' | ')}`);
    } else {
      const okFactor = acc.factor >= acc.needFactor - 1e-6 && acc.factor <= P.converterMaxFactor + 1e-6;
      const pixelOk = input.targetMmPerPx === null || c.mmPerPx === null || c.mmPerPx <= input.targetMmPerPx * (1 + 1e-9);
      record(section, 'C3 bộ nhân gợi ý: k ≥ k cần, ≤ k tối đa, sau khi lắp mm/px đạt', okFactor && pixelOk, () => `${describeLens(c.component)} · ${describeInput(input)} → ${JSON.stringify(acc)} mm/px ${c.mmPerPx}`);
    }
    record(section, 'C4 không gợi ý phụ kiện cho telecentric', c.lens.lensType !== 'telecentric', () => c.component.code);
  }
}

/** B9 biết 2 trong 3: ba chế độ quay vòng ra cùng hình học. */
function checkGeometry(section: string, camera: ConfigCamera) {
  const fw = r1(range(5, 600));
  const fh = camera.cameraType === 'line' ? null : r1(fw * range(0.3, 1.5));
  const wd = Math.round(range(50, 2000));
  const a = solveGeometry({ mode: 'fov-wd', camera, focalLengthMm: null, workingDistanceMm: wd, fovWidthMm: fw, fovHeightMm: fh });
  if (!a) return;
  const b = solveGeometry({ mode: 'focal-wd', camera, focalLengthMm: a.focalLengthMm, workingDistanceMm: wd, fovWidthMm: null, fovHeightMm: null });
  const c = solveGeometry({ mode: 'focal-fov', camera, focalLengthMm: a.focalLengthMm, workingDistanceMm: null, fovWidthMm: fw, fovHeightMm: fh });
  const ok = b !== null && c !== null && rel(b.beta, a.beta) < 1e-9 && rel(c.workingDistanceMm, wd) < 1e-9 && b.fovWidthMm >= Math.max(fw, fh ?? 0) * (1 - 1e-9);
  record(section, 'B9 biết 2 trong 3 (vùng nhìn+WD → f → ngược lại) quay vòng khớp', ok, () => `cam ${camera.widthPx}×${camera.heightPx} p${camera.pixelSizeUm} FOV ${fw}×${fh} WD ${wd} → ${JSON.stringify({ a, b, c })}`);
}

/** B10 mỗi ống thuộc đúng một tab (ống thường / telecentric / M12). */
function checkTabs(section: string, catalog: Component[], camera: ConfigCamera) {
  const base: LensSelectorInput = { camera, fovWidthMm: 50, fovHeightMm: 40, workingDistanceMm: 300, heightVariationMm: null, targetMmPerPx: null, lensKind: 'fixed' };
  const ids = (kind: LensKindFilter) => selectLenses({ ...base, lensKind: kind }, catalog).candidates.map((c) => c.component.id);
  const all = [...ids('fixed'), ...ids('telecentric'), ...ids('m12')];
  const lensCount = catalog.filter((c) => c.kind === 'lens').length;
  record(section, 'B10 mỗi ống thuộc đúng một tab', all.length === lensCount && new Set(all).size === lensCount, () => `${all.length} lượt / ${new Set(all).size} ống khác nhau / kho ${lensCount}`);
}

// ───────────────────────────────────────────── D. kho thật ──
type Audit = { label: string; count: number; examples: string[] };
function auditCatalog(lenses: Component[]): Audit[] {
  const rows: Audit[] = [];
  const add = (label: string, list: Component[]) => rows.push({ label, count: list.length, examples: list.slice(0, 4).map((c) => c.code) });
  const n = (c: Component, k: string) => (typeof c.spec[k] === 'number' ? (c.spec[k] as number) : null);
  const s = (c: Component, k: string) => (typeof c.spec[k] === 'string' ? (c.spec[k] as string) : null);
  const tele = lenses.filter((c) => s(c, 'lens_type') === 'telecentric');
  const fixed = lenses.filter((c) => s(c, 'lens_type') !== 'telecentric');
  add('Ống thường thiếu tiêu cự', fixed.filter((c) => n(c, 'focal_length_mm') === null));
  add('Ống thường thiếu MOD (WD tối thiểu)', fixed.filter((c) => n(c, 'wd_min_mm') === null));
  add('Ống thường chưa khai sF (dùng sF = 0, có dấu ≈)', fixed.filter((c) => n(c, 'front_focal_mm') === null));
  add('Ống thiếu vòng ảnh (mm hoặc cỡ)', lenses.filter((c) => n(c, 'image_circle_mm') === null && formatDiag(s(c, 'image_circle')) === null));
  add('Ống thiếu F# nhỏ nhất', lenses.filter((c) => n(c, 'f_number_min') === null));
  add('Ống thiếu ngàm', lenses.filter((c) => s(c, 'mount') === null));
  add('Ống thiếu lp/mm', lenses.filter((c) => n(c, 'resolution_lp_mm') === null));
  add('Telecentric thiếu độ phóng đại', tele.filter((c) => n(c, 'magnification') === null));
  add('Telecentric thiếu dải WD', tele.filter((c) => n(c, 'wd_min_mm') === null && n(c, 'wd_max_mm') === null));
  add('Telecentric chỉ có MỘT giá trị WD (min = max hoặc chỉ một đầu) — nhập WD lệch 1 mm là loại', tele.filter((c) => {
    const lo = n(c, 'wd_min_mm');
    const hi = n(c, 'wd_max_mm');
    return (lo !== null || hi !== null) && (lo === null || hi === null || lo === hi);
  }));
  add('F# nhỏ nhất > F# lớn nhất', lenses.filter((c) => n(c, 'f_number_min') !== null && n(c, 'f_number_max') !== null && n(c, 'f_number_min')! > n(c, 'f_number_max')!));
  add('WD min > WD max', lenses.filter((c) => n(c, 'wd_min_mm') !== null && n(c, 'wd_max_mm') !== null && n(c, 'wd_min_mm')! > n(c, 'wd_max_mm')!));
  add('Vòng ảnh mm lệch > 10 % so với cỡ ghi kèm', lenses.filter((c) => {
    const mm = n(c, 'image_circle_mm');
    const fd = formatDiag(s(c, 'image_circle'));
    return mm !== null && fd !== null && rel(mm, fd) > 0.1;
  }));
  add('Giá trị lạ: tiêu cự ≤ 0, vòng ảnh < 3 mm hoặc > 100 mm, độ phóng đại ≤ 0', lenses.filter((c) => {
    const f = n(c, 'focal_length_mm');
    const ic = n(c, 'image_circle_mm');
    const m = n(c, 'magnification');
    return (f !== null && f <= 0) || (ic !== null && (ic < 3 || ic > 100)) || (m !== null && m <= 0);
  }));
  return rows;
}

type Sweep = { scenario: string; camera: string; pass: number; warn: number; info: number; fail: number; topFail: string; ms: number };

async function loadRealCatalog(): Promise<Component[] | null> {
  if (!existsSync(CATALOG_FILE)) return null;
  const { components, problems } = parseWorkbook(await readWorkbook(CATALOG_FILE));
  if (problems.length) console.warn(`Kho thật: ${problems.length} lỗi dữ liệu khi đọc — bỏ qua các dòng lỗi.`);
  return components.map((c, i) => ({ ...c, id: `real-${String(i).padStart(5, '0')}`, notes_en: null, is_active: true, sort_order: i }) as unknown as Component);
}

// ───────────────────────────────────────────── E. đối chiếu hãng ──
/*
 * Số của công cụ chọn ống kính của hãng (scripts/reference/<hãng>-lens-selector-<ngày>.json):
 *   chế độ 0 — vùng nhìn + WD → vùng nhìn từng ống ở WD đó;  chế độ 1 — tiêu cự + vùng nhìn → WD từng ống.
 * Hãng không công bố sF → lấy sF của từng ống từ MỘT lần xuất hiện (vùng nhìn lớn nhất, ít sai số làm
 * tròn nhất: sF = WD − f × vùng nhìn ÷ cảm biến), rồi dùng engine đoán MỌI lần xuất hiện còn lại — ở WD
 * khác, camera khác, chế độ khác, có ống nối. Khớp nghĩa là hãng dùng cùng mô hình Newton sF cố định và
 * engine tính vùng nhìn / WD thật giống hãng.
 */
type VendorRow = { model: string; f: number; img: string; mode: 0 | 1; wd: number; h: number; ring: number };
type VendorCase = { camera: string; sensor: [number, number, number, number, number]; task: string; fov: [number, number]; wd: number; rows: VendorRow[] };
type VendorDiff = { vendor: string; caseLabel: string; model: string; mode: 0 | 1; vendorValue: number; ours: number; deltaPct: number; ring: number };
type VendorSummary = {
  vendor: string;
  file: string;
  source: string;
  cases: number;
  lenses: number;
  compared: number;
  diffs: VendorDiff[];
  frontFocal: { model: string; f: number; sF: number; spread: number; n: number }[];
  /** Vùng nhìn nếu bỏ sF (sF = 0): lệch so với hãng, % — trung vị, lớn nhất, số lượt > 5 %. */
  zeroSf: { median: number; max: number; over5: number; n: number } | null;
};

const VENDOR_TOLERANCE = 0.01;

async function loadVendorCases(file: string): Promise<{ source: string; cases: VendorCase[] } | null> {
  if (!existsSync(file)) return null;
  const json = JSON.parse((await import('node:fs')).readFileSync(file, 'utf8')) as {
    source: string;
    cases: { camera: string; sensor: VendorCase['sensor']; task: string; fov: [number, number]; wd: number; lenses: (string | number | null)[][]; fitOnly: (string | number | null)[][] }[];
  };
  const cases = json.cases.map((c) => {
    const rows: VendorRow[] = [];
    for (const l of c.lenses) {
      const [model, f, , ring, wd, h, , img, , fitWd, fitH, , fitRing] = l as [string, number, number, number, number, number, number, string, string, number | null, number | null, number | null, number | null];
      rows.push({ model, f, img, mode: 0, wd, h, ring });
      if (fitWd !== null && fitH !== null) rows.push({ model, f, img, mode: 1, wd: fitWd, h: fitH, ring: fitRing ?? 0 });
    }
    for (const l of c.fitOnly) {
      const [model, f, wd, h, , ring, img] = l as [string, number, number, number, number, number, string];
      rows.push({ model, f, img, mode: 1, wd, h, ring });
    }
    return { camera: c.camera, sensor: c.sensor, task: c.task, fov: c.fov, wd: c.wd, rows };
  });
  return { source: json.source, cases };
}

function compareVendor(vendor: string, file: string, data: { source: string; cases: VendorCase[] }): VendorSummary {
  const section = `Đối chiếu ${vendor}`;
  // sF từng ống: mọi lần xuất hiện cho một ước lượng; neo = lần có vùng nhìn lớn nhất
  const estimates = new Map<string, { f: number; sF: number; h: number; key: string }[]>();
  data.cases.forEach((c, ci) =>
    c.rows.forEach((r, ri) => {
      const sF = r.wd - (r.f * r.h) / c.sensor[0];
      const list = estimates.get(r.model) ?? [];
      list.push({ f: r.f, sF, h: r.h, key: `${ci}:${ri}` });
      estimates.set(r.model, list);
    })
  );
  const anchor = new Map([...estimates].map(([model, list]) => [model, list.reduce((a, b) => (b.h > a.h ? b : a))]));
  const diffs: VendorDiff[] = [];
  const zeroSf: number[] = [];
  let compared = 0;
  data.cases.forEach((c, ci) => {
    const [sw, sh, pxW, pxH, pitch] = c.sensor;
    const camera: ConfigCamera = { cameraType: 'area', widthPx: pxW, heightPx: pxH, pixelSizeUm: pitch, sensorFormat: null, mount: 'C', interfaceName: null, maxFps: null, bytesPerPx: 1 };
    const label = `${c.camera} · ${c.fov[0]} × ${c.fov[1]} mm · WD ${c.wd}`;
    c.rows.forEach((r, ri) => {
      const a = anchor.get(r.model)!;
      if (a.key === `${ci}:${ri}`) return;
      const circle = Number(/Φ\s*([\d.]+)/.exec(r.img)?.[1] ?? NaN);
      const lens = component('lens', { lens_type: 'fixed', focal_length_mm: r.f, front_focal_mm: a.sF, mount: 'C', ...(Number.isFinite(circle) ? { image_circle_mm: circle } : {}) });
      const input: LensSelectorInput = { camera, fovWidthMm: c.fov[0], fovHeightMm: c.fov[1], workingDistanceMm: r.mode === 0 ? r.wd : c.wd, heightVariationMm: null, targetMmPerPx: null, lensKind: 'fixed' };
      const need = lensNeed(input)!;
      const e = evaluateLens(input, need, lens);
      let ours: number;
      let tol: number;
      if (r.mode === 0) {
        // vùng nhìn rộng của ống ở WD hãng ghi (cạnh dài cảm biến = cạnh rộng)
        ours = e.fovLongMm ?? NaN;
        tol = Math.max(VENDOR_TOLERANCE * r.h, 0.15);
      } else {
        // WD để ống vừa khít vùng nhìn — số chưa làm tròn lên (bảng hiện số làm tròn lên ≤ 1 mm)
        ours = e.realWd?.kind === 'focal' ? (r.f / Math.min(sw / c.fov[0], sh / c.fov[1])) + a.sF : NaN;
        tol = Math.max(VENDOR_TOLERANCE * r.wd, 1);
        // Số hiện trên bảng phải ≥ số chưa làm tròn và lệch ≤ 1 mm (chụp cận 0,1 mm)
        if (e.realWd?.kind === 'focal') record(section, 'E3 WD thật hiện trên bảng = số tính, làm tròn lên ≤ 1 mm', e.realWd.mm >= ours - 1e-6 && e.realWd.mm - ours <= 1 + 1e-6, () => `${r.model} ${label}: hiện ${e.realWd && e.realWd.kind === 'focal' ? e.realWd.mm : '-'} / tính ${ours}`);
      }
      const vendorValue = r.mode === 0 ? r.h : r.wd;
      // Cùng ống nhưng chưa khai sF (engine lấy sF = 0, như 62/62 ống thường trong kho thật): lệch bao nhiêu
      if (r.mode === 0) zeroSf.push(Math.abs((sw * r.wd) / r.f - r.h) / r.h * 100);
      const ok = Number.isFinite(ours) && Math.abs(ours - vendorValue) <= tol;
      compared++;
      const deltaPct = ((ours - vendorValue) / vendorValue) * 100;
      diffs.push({ vendor, caseLabel: label, model: r.model, mode: r.mode, vendorValue, ours: round2(ours), deltaPct: round2(deltaPct), ring: r.ring });
      record(
        section,
        r.mode === 0 ? `E1 vùng nhìn từng ống ở WD cho trước (±${VENDOR_TOLERANCE * 100} %, tối thiểu 0,15 mm)` : `E2 WD từng ống để vừa vùng nhìn = WD thật (±${VENDOR_TOLERANCE * 100} %, tối thiểu 1 mm)`,
        ok,
        () => `${r.model} f ${r.f} sF ${a.sF.toFixed(2)} · ${label} · ống nối ${r.ring} mm → ${vendor} ${vendorValue}, engine ${ours.toFixed(2)} (${deltaPct.toFixed(2)} %)`
      );
    });
  });
  const frontFocal = [...estimates].map(([model, list]) => {
    const values = list.map((x) => x.sF);
    return { model, f: list[0].f, sF: round2(anchor.get(model)!.sF), spread: round2(Math.max(...values) - Math.min(...values)), n: list.length };
  }).sort((a, b) => a.f - b.f || a.model.localeCompare(b.model));
  const sorted = [...zeroSf].sort((a, b) => a - b);
  const zeroSfStat = sorted.length ? { median: round2(sorted[Math.floor(sorted.length / 2)]), max: round2(sorted[sorted.length - 1]), over5: sorted.filter((x) => x > 5).length, n: sorted.length } : null;
  return { vendor, file, source: data.source, cases: data.cases.length, lenses: estimates.size, compared, diffs, frontFocal, zeroSf: zeroSfStat };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

// ───────────────────────────────────────────── chạy ──
async function main() {
  const started = performance.now();
  // 1. Kho giả lập: 400 ống ngẫu nhiên, mỗi ca so toàn bộ
  const synCatalog = Array.from({ length: 400 }, synLens);
  for (let i = 0; i < N; i++) {
    const camera = synCamera();
    const input = synInput(camera);
    const plain = { ...input, fixedAccessory: null };
    checkOracle('Giả lập', plain, synCatalog.slice((i * 37) % 360, ((i * 37) % 360) + 40));
    if (i % 3 === 0) checkProperties('Giả lập', input, synCatalog.slice((i * 13) % 300, ((i * 13) % 300) + 100));
    checkGeometry('Giả lập', camera);
  }
  checkTabs('Giả lập', synCatalog, synCamera());

  // 2. Kho thật
  const real = await loadRealCatalog();
  let audit: Audit[] = [];
  const sweep: Sweep[] = [];
  let realLensCount = 0;
  let realCameraCount = 0;
  let timing = { avg: 0, max: 0, runs: 0 };
  if (real) {
    const lenses = real.filter((c) => c.kind === 'lens');
    const cameras = real.filter((c) => c.kind === 'camera');
    realLensCount = lenses.length;
    realCameraCount = cameras.length;
    audit = auditCatalog(lenses);
    const configCams = cameras.map((c) => ({ c, cam: cameraFromComponent(c) }));
    // Đối chiếu độc lập trên TOÀN BỘ ống thật với 300 ca ngẫu nhiên dùng camera thật
    for (let i = 0; i < 300; i++) {
      const { cam } = pick(configCams);
      const input = { ...synInput(cam), fixedAccessory: null };
      checkOracle('Kho thật', input, lenses);
      if (i % 10 === 0) checkProperties('Kho thật', input, real);
    }
    checkTabs('Kho thật', real, cameraFromComponent(cameras[0]));
    // Quét bài toán điển hình: camera phổ biến × vùng nhìn × WD
    const typicalCams = [
      ...configCams.filter(({ cam }) => cam.cameraType === 'area' && cam.mount === 'C' && cam.pixelSizeUm !== null).sort((a, b) => a.cam.widthPx * a.cam.heightPx - b.cam.widthPx * b.cam.heightPx),
    ];
    const chosen = [typicalCams[Math.floor(typicalCams.length * 0.1)], typicalCams[Math.floor(typicalCams.length * 0.5)], typicalCams[Math.floor(typicalCams.length * 0.9)]].filter(Boolean);
    const scenarios: { name: string; fov: [number, number]; wd: number | null; kind: LensKindFilter; dh?: number }[] = [
      { name: 'Linh kiện nhỏ 20×15, WD 150, ống thường', fov: [20, 15], wd: 150, kind: 'fixed' },
      { name: 'Bo mạch 100×80, WD 300, ống thường', fov: [100, 80], wd: 300, kind: 'fixed' },
      { name: 'Hộp 300×200, WD 800, ống thường', fov: [300, 200], wd: 800, kind: 'fixed' },
      { name: 'Đo 2D 30×25, telecentric, WD để trống', fov: [30, 25], wd: null, kind: 'telecentric' },
      { name: 'Bo mạch 100×80, WD 300, Δh 10 mm', fov: [100, 80], wd: 300, kind: 'fixed', dh: 10 },
    ];
    // WD danh định phổ biến nhất của các ống telecentric dùng được cho 30×25 (camera giữa) → thử đúng WD đó và lệch +1,5 %
    const mid = chosen[Math.floor(chosen.length / 2)];
    if (mid) {
      const usable = selectLenses({ camera: mid.cam, fovWidthMm: 30, fovHeightMm: 25, workingDistanceMm: null, heightVariationMm: null, targetMmPerPx: null, lensKind: 'telecentric' }, real).candidates.filter((x) => x.status !== 'fail' && x.realWd?.kind === 'fixed');
      const counts = new Map<number, number>();
      for (const x of usable) if (x.realWd?.kind === 'fixed') counts.set(x.realWd.minMm, (counts.get(x.realWd.minMm) ?? 0) + 1);
      const nominal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (nominal) {
        scenarios.push({ name: `Đo 2D 30×25, telecentric, WD ${nominal} (WD danh định phổ biến nhất)`, fov: [30, 25], wd: nominal, kind: 'telecentric' });
        scenarios.push({ name: `Đo 2D 30×25, telecentric, WD ${r1(nominal * 1.015)} (lệch +1,5 %)`, fov: [30, 25], wd: r1(nominal * 1.015), kind: 'telecentric' });
        scenarios.push({ name: `Đo 2D 30×25, telecentric, WD ${r1(nominal * 1.05)} (lệch +5 %)`, fov: [30, 25], wd: r1(nominal * 1.05), kind: 'telecentric' });
      }
    }
    let total = 0;
    for (const s of scenarios) {
      for (const { c, cam } of chosen) {
        const input: LensSelectorInput = { camera: cam, fovWidthMm: s.fov[0], fovHeightMm: s.fov[1], workingDistanceMm: s.wd, heightVariationMm: s.dh ?? null, targetMmPerPx: null, lensKind: s.kind };
        const t0 = performance.now();
        const { candidates } = selectLenses(input, real);
        const ms = performance.now() - t0;
        total += ms;
        timing = { avg: 0, max: Math.max(timing.max, ms), runs: timing.runs + 1 };
        const count = (st: string) => candidates.filter((x) => x.status === st).length;
        const reasons = new Map<string, number>();
        for (const x of candidates.filter((x) => x.status === 'fail')) {
          for (const k of x.checks.filter((k) => k.status === 'fail')) reasons.set(k.noteKey ?? k.key, (reasons.get(k.noteKey ?? k.key) ?? 0) + 1);
        }
        const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(', ');
        sweep.push({ scenario: s.name, camera: `${c.code} (${cam.widthPx}×${cam.heightPx}, ${cam.pixelSizeUm} µm, ${cam.sensorFormat ?? '?'})`, pass: count('pass'), warn: count('warn'), info: count('info'), fail: count('fail'), topFail: top || '—', ms: Math.round(ms) });
      }
    }
    timing.avg = total / timing.runs;
  }

  // 3. Đối chiếu hãng — mọi file scripts/reference/*-lens-selector-*.json
  const vendors: VendorSummary[] = [];
  const { readdirSync } = await import('node:fs');
  const refDir = 'scripts/reference';
  if (existsSync(refDir)) {
    for (const name of readdirSync(refDir).filter((n) => /-lens-selector-.*\.json$/.test(n)).sort()) {
      const data = await loadVendorCases(`${refDir}/${name}`);
      const vendor = name.split('-')[0].replace(/^./, (ch) => ch.toUpperCase());
      if (data) vendors.push(compareVendor(vendor, `${refDir}/${name}`, data));
    }
  }

  // ───────────────────────────────────────────── ghi báo cáo ──
  const elapsed = (performance.now() - started) / 1000;
  const failed = [...results.values()].reduce((s, r) => s + r.fail, 0);
  const lines: string[] = [];
  lines.push('# Kết quả chu trình kiểm tra — Chọn ống kính', '');
  lines.push(`> File này do \`npm run verify:lens\` sinh tự động — đừng sửa tay. Chạy lúc ${new Date().toISOString()}, hạt giống ${SEED}, ${N} ca giả lập, ${elapsed.toFixed(1)} s.`, '');
  lines.push(`**Tổng: ${failed === 0 ? 'ĐẠT — không có lỗi' : `${failed} lượt kiểm báo LỖI`}.**`, '');
  lines.push(`Kho thật: ${real ? `\`${CATALOG_FILE}\` — ${realLensCount} ống kính, ${realCameraCount} camera` : 'không tìm thấy file Excel, bỏ qua phần kho thật'}.`, '');
  for (const section of ['Giả lập', 'Kho thật', ...vendors.map((v) => `Đối chiếu ${v.vendor}`)]) {
    const rows = [...results.entries()].filter(([k]) => SECTION[k] === section);
    if (!rows.length) continue;
    lines.push(`## ${section}`, '', '| Phép kiểm | Đạt | Lỗi | Sát ngưỡng / do làm tròn |', '|---|---:|---:|---:|');
    for (const [key, r] of rows) lines.push(`| ${key.split(' · ')[1]} | ${r.pass} | ${r.fail ? `**${r.fail}**` : 0} | ${r.boundary} |`);
    lines.push('');
    for (const [key, r] of rows.filter(([, r]) => r.samples.length)) {
      lines.push(`### Lỗi mẫu — ${key.split(' · ')[1]} (${section})`, '');
      for (const s of r.samples) lines.push(`- \`${s.replace(/`/g, "'")}\``);
      lines.push('');
    }
  }
  if (audit.length) {
    lines.push('## Chất lượng dữ liệu ống kính (kho thật)', '', '| Mục | Số ống | Ví dụ |', '|---|---:|---|');
    for (const a of audit) lines.push(`| ${a.label} | ${a.count} | ${a.examples.join(', ') || '—'} |`);
    lines.push('');
  }
  if (sweep.length) {
    lines.push('## Quét bài toán điển hình (kho thật)', '', '| Bài toán | Camera | Đạt | Cảnh báo | Chưa kiểm được | Loại | Lý do loại nhiều nhất | ms |', '|---|---|---:|---:|---:|---:|---|---:|');
    for (const s of sweep) lines.push(`| ${s.scenario} | ${s.camera} | ${s.pass} | ${s.warn} | ${s.info} | ${s.fail} | ${s.topFail} | ${s.ms} |`);
    lines.push('', `Thời gian lọc cả kho: trung bình ${timing.avg.toFixed(0)} ms, lâu nhất ${timing.max.toFixed(0)} ms (${timing.runs} lượt, chạy trong Node trên máy này).`, '');
  }
  for (const v of vendors) {

    const byMode = (m: 0 | 1) => v.diffs.filter((d) => d.mode === m);
    const stat = (list: VendorDiff[]) => (list.length ? `${list.length} lượt, lệch trung bình ${(list.reduce((s, d) => s + Math.abs(d.deltaPct), 0) / list.length).toFixed(2)} %, lớn nhất ${Math.max(...list.map((d) => Math.abs(d.deltaPct))).toFixed(2)} %` : '—');
    lines.push(`## Chi tiết đối chiếu ${v.vendor}`, '');
    lines.push(`Nguồn: ${v.source}. File \`${v.file}\`: ${v.cases} ca, ${v.lenses} ống, ${v.compared} lượt so (không tính lượt neo sF).`, '');
    lines.push(`- Vùng nhìn ở WD cho trước: ${stat(byMode(0))}.`, `- WD để vừa vùng nhìn: ${stat(byMode(1))}.`, `- Lượt có ống nối (hãng thêm vòng nối): ${v.diffs.filter((d) => d.ring > 0).length}, lệch lớn nhất ${Math.max(0, ...v.diffs.filter((d) => d.ring > 0).map((d) => Math.abs(d.deltaPct))).toFixed(2)} %.`, '');
    if (v.zeroSf) lines.push(`- **Nếu ống chưa khai sF (engine lấy sF = 0):** vùng nhìn lệch so với ${v.vendor} trung vị ${v.zeroSf.median} %, lớn nhất ${v.zeroSf.max} %; ${v.zeroSf.over5}/${v.zeroSf.n} lượt lệch > 5 %.`, '');
    lines.push('Mười lượt lệch nhiều nhất:', '', '| Ca | Ống | Đại lượng | Hãng | Engine | Lệch | Ống nối |', '|---|---|---|---:|---:|---:|---:|');
    for (const d of [...v.diffs].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)).slice(0, 10)) {
      lines.push(`| ${d.caseLabel} | ${d.model} | ${d.mode === 0 ? 'vùng nhìn rộng (mm)' : 'WD (mm)'} | ${d.vendorValue} | ${d.ours} | ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(2)} % | ${d.ring} |`);
    }
    lines.push('', `sF suy từ số của hãng (mặt trước ống → tiêu điểm trước; "chênh" = khoảng dao động giữa các lần xuất hiện, do hãng làm tròn vùng nhìn 0,1 mm):`, '', '| Ống | f | sF (mm) | chênh | số lần |', '|---|---:|---:|---:|---:|');
    for (const s of v.frontFocal) lines.push(`| ${s.model} | ${s.f} | ${s.sF} | ${s.spread} | ${s.n} |`);
    lines.push('');

  }
  mkdirSync(OUT_FILE.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n') + '\n', 'utf8');
  console.log(`Đã ghi ${OUT_FILE} — ${failed === 0 ? 'ĐẠT' : `${failed} lỗi`} (${elapsed.toFixed(1)} s)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
