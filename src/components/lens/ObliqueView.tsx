'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FIELD_CELL, FIELD_GRID, FIELD_LABEL, NOTE_CLASS, Panel } from '@/components/ui/PanelHeader';
import { mountFit, maxRingFNumber } from '@/lib/vision/configurationRules';
import { DOF_BLUR_PRESETS } from '@/lib/vision/depthOfField';
import type { MountLensOption } from '@/lib/vision/mountCheckOptions';
import { OBLIQUE_DEFAULT_MARGIN, OBLIQUE_MAX_TILT_DEG, obliqueView, type GroundFov, type HeightSpan, type ObliqueResult } from '@/lib/vision/obliqueView';
import { Slider } from './TubeFigures';

/**
 * Camera nghiêng (OPT-014, chốt 2026-11-23 Q1-B / Q3 / Q4; vòng 2 cùng ngày: gộp vào Kiểm tra lắp đặt thành khung gập,
 * dùng chung camera + ống kính, WD lấy từ camera nghiêng, thanh góc nghiêng). Camera đặt chéo nhìn xuống mặt phẳng
 * ngang — vùng phủ hình thang, mm/px gần / xa, khẩu F cho cả vùng nét, gợi ý ống trong kho theo f tối đa.
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
/** Viền nền cho chữ đè lên vạch / vùng màu (dùng với paintOrder="stroke"). */
const HALO = 'stroke-white dark:stroke-slate-900';

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
/** FOV thực tế trên mặt phẳng (vòng 5, Q1-B): cạnh ảnh, ngang mép gần / xa sản phẩm, dọc giữa sản phẩm. */
function FovBlock({ fov }: { fov: GroundFov }) {
  const t = useTranslations('oblique.result');
  const mm = (v: number | null) => (v === null || !Number.isFinite(v) ? t('fovInf') : show(v, 0));
  // Rút gọn (2026-11-24): chỉ số, thiếu ghi dấu − (dòng đỏ) giống hình.
  const gap = (v: number) => (v < -0.5 ? `−${show(-v, 0)}` : Number.isFinite(v) ? show(Math.max(v, 0), 0) : t('fovInf'));
  const short = (s: { startMm: number; endMm: number } | null) => s !== null && (s.startMm < -0.5 || s.endMm < -0.5);
  // Cao tối đa còn trong ảnh; chân bị khuất → kèm phần chân khuất; không thấy đoạn nào → "không thấy".
  const height = (h: HeightSpan | null) =>
    h === null ? t('fovHeightNone') : h.lowMm > 0.5 ? t('fovHeightFrom', { lo: mm(h.lowMm), hi: mm(h.highMm) }) : t('fovHeightMm', { v: mm(h.highMm) });
  const lines: { text: string; bad: boolean }[] = [
    { text: t('fovEdges', { near: mm(fov.nearEdgeWidthMm), far: mm(fov.farEdgeWidthMm) }), bad: false },
    fov.atNear ? { text: t('fovAtNear', { w: mm(fov.atNear.widthMm), l: gap(fov.atNear.startMm), r: gap(fov.atNear.endMm) }), bad: short(fov.atNear) } : null,
    fov.atFar ? { text: t('fovAtFar', { w: mm(fov.atFar.widthMm), l: gap(fov.atFar.startMm), r: gap(fov.atFar.endMm) }), bad: short(fov.atFar) } : null,
    fov.along ? { text: t('fovAlong', { w: mm(fov.along.widthMm), a: gap(fov.along.startMm), b: gap(fov.along.endMm) }), bad: short(fov.along) } : null,
    {
      text: t('fovHeight', { n: height(fov.heightAtNear), f: height(fov.heightAtFar) }),
      bad: !fov.heightAtNear || !fov.heightAtFar || fov.heightAtNear.lowMm > 0.5 || fov.heightAtFar.lowMm > 0.5,
    },
  ].filter((l): l is { text: string; bad: boolean } => l !== null);
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('fov')}</p>
      <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm tabular-nums lg:grid-cols-2">
        {lines.map((l) => (
          <li key={l.text} className={l.bad ? TONE.bad : 'text-slate-900 dark:text-slate-100'}>
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Vòng 5 (2026-11-24): kích thước FOV thực tế trên hình Nhìn từ trên — chỉ ghi số (mm), nét mảnh.
 * Một màu xám cho mọi vạch đo và số; phần thiếu (FOV không phủ tới mép sản phẩm): vạch đỏ đậm + số đỏ dấu −.
 * Chuỗi bên phải: camera → cạnh gần ảnh → mép gần → mép xa → cạnh xa ảnh (đo theo phương xa dần camera).
 */
function FovDims({ res, areaW, areaL, X, Y, W }: { res: ObliqueResult; areaW: number; areaL: number; X: (x: number) => number; Y: (y: number) => number; W: number }) {
  const fov = res.groundFov;
  // Một màu xám cho mọi vạch đo và số; chỉ phần thiếu (FOV không phủ tới mép sản phẩm) đổi đỏ.
  const DIM = 'stroke-slate-500 dark:stroke-slate-400';
  const BAD = 'stroke-red-600 dark:stroke-red-400';
  const EXT = 'stroke-slate-300 dark:stroke-slate-600';
  const T_DIM = `fill-slate-700 dark:fill-slate-200 ${HALO}`;
  const T_BAD = `fill-red-600 dark:fill-red-400 ${HALO}`;
  const short = (v: number) => v < -0.5;
  const num = (v: number) => (short(v) ? `−${show(-v, 0)}` : show(Math.max(v, 0), 0));
  const gapTone = (v: number) => (short(v) ? T_BAD : T_DIM);
  const gapLine = (v: number) => (short(v) ? BAD : DIM);
  // Đoạn đo mảnh, gạch hai đầu ngắn (toạ độ màn hình).
  const dim = (key: string, x1: number, y1: number, x2: number, y2: number, cls = DIM) => {
    const horiz = Math.abs(y2 - y1) < Math.abs(x2 - x1);
    const tk = 2.5;
    const tick = (x: number, y: number) => (horiz ? <line x1={x} y1={y - tk} x2={x} y2={y + tk} /> : <line x1={x - tk} y1={y} x2={x + tk} y2={y} />);
    return (
      <g key={key} strokeWidth={cls === BAD ? 1.75 : 0.75} className={cls}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        {tick(x1, y1)}
        {tick(x2, y2)}
      </g>
    );
  };
  const label = (key: string, x: number, y: number, text: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'start', rotate = false) => (
    <text key={key} x={x} y={y} textAnchor={anchor} fontSize={9} strokeWidth={2.5} paintOrder="stroke" transform={rotate ? `rotate(-90 ${x} ${y})` : undefined} className={cls}>
      {text}
    </text>
  );
  const out: React.ReactNode[] = [];
  const fp = res.horizon ? [] : res.footprint;

  // Dư trái / phải tại mép gần (số trên vạch) và mép xa (số dưới vạch), sát góc sản phẩm.
  for (const { key, span, y, dy } of [
    { key: 'n', span: fov.atNear, y: 0, dy: -4 },
    { key: 'f', span: fov.atFar, y: areaL, dy: 10 },
  ]) {
    if (!span) continue;
    if (Number.isFinite(span.startMm)) {
      out.push(dim(`${key}l`, X(-areaW / 2), Y(y), X(-areaW / 2 - span.startMm), Y(y), gapLine(span.startMm)));
      out.push(label(`${key}lt`, X(-areaW / 2) - 6, Y(y) + dy, num(span.startMm), gapTone(span.startMm), 'end'));
    }
    if (Number.isFinite(span.endMm)) {
      out.push(dim(`${key}r`, X(areaW / 2), Y(y), X(areaW / 2 + span.endMm), Y(y), gapLine(span.endMm)));
      out.push(label(`${key}rt`, X(areaW / 2) + 6, Y(y) + dy, num(span.endMm), gapTone(span.endMm)));
    }
  }

  if (fov.along) {
    const a = fov.along;
    const camY = Y(res.cameraPos[1]);
    const yNear = Number.isFinite(a.startMm) ? Y(-a.startMm) : null;
    const yFar = Number.isFinite(a.endMm) ? Y(areaL + a.endMm) : null;
    // Chuỗi bên phải, chừa chỗ cho số dư sát góc phải sản phẩm (≈ 26 đơn vị hình), không quá mép hình.
    const xR = Math.min(Math.max(X(areaW / 2) + 30, X(res.cameraPos[0]) + 12, ...fp.map((p) => X(p.x))) + 8, W - 30);
    const ext: { y: number; xFrom: number }[] = [{ y: camY, xFrom: X(res.cameraPos[0]) + 9 }];
    if (yNear !== null) ext.push({ y: yNear, xFrom: fp.length >= 96 ? X(fp[24].x) + 2 : X(areaW / 2) });
    ext.push({ y: Y(0), xFrom: X(areaW / 2) + 2 }, { y: Y(areaL), xFrom: X(areaW / 2) + 2 });
    if (yFar !== null) ext.push({ y: yFar, xFrom: fp.length >= 96 ? X(fp[48].x) + 2 : X(areaW / 2) });
    ext.forEach((e, i) => out.push(<line key={`ext${i}`} x1={e.xFrom} y1={e.y} x2={xR + 3} y2={e.y} strokeWidth={0.5} strokeDasharray="2 2" className={EXT} />));
    const mid = (y1: number, y2: number) => (y1 + y2) / 2 + 3;
    if (yNear !== null) {
      // Camera → cạnh gần ảnh (nhìn từ trên, theo phương xa dần camera).
      out.push(dim('vc', xR, camY, xR, yNear));
      out.push(label('vct', xR + 5, mid(camY, yNear), show(-a.startMm - res.cameraPos[1], 0), T_DIM));
      out.push(dim('va', xR, yNear, xR, Y(0), gapLine(a.startMm)));
      out.push(label('vat', xR + 5, mid(yNear, Y(0)), num(a.startMm), gapTone(a.startMm)));
    }
    out.push(dim('vp', xR, Y(0), xR, Y(areaL)));
    out.push(label('vpt', xR + 5, mid(Y(0), Y(areaL)), show(areaL, 0), T_DIM));
    if (yFar !== null) {
      out.push(dim('vb', xR, Y(areaL), xR, yFar, gapLine(a.endMm)));
      out.push(label('vbt', xR + 5, mid(Y(areaL), yFar), num(a.endMm), gapTone(a.endMm)));
    }
    // Chiều dài FOV: vạch đứng bên trái biên FOV.
    if (yNear !== null && yFar !== null && fp.length > 0) {
      const xL = Math.max(14, Math.min(X(-areaW / 2) - 30, ...fp.map((p) => X(p.x))) - 8);
      out.push(dim('len', xL, yNear, xL, yFar));
      out.push(label('lent', xL - 4, (yNear + yFar) / 2, show(a.widthMm, 0), T_DIM, 'middle', true));
    }
  }

  // Bề rộng hai cạnh ảnh: số ngay ngoài cạnh.
  if (fp.length >= 96) {
    const nearMid = { x: (fp[0].x + fp[24].x) / 2, y: (fp[0].y + fp[24].y) / 2 };
    const farMid = { x: (fp[48].x + fp[72].x) / 2, y: (fp[48].y + fp[72].y) / 2 };
    if (fov.nearEdgeWidthMm !== null) out.push(label('en', X(nearMid.x) - 6, Y(nearMid.y) + 10, show(fov.nearEdgeWidthMm, 0), T_DIM, 'end'));
    if (fov.farEdgeWidthMm !== null) out.push(label('ef', X(farMid.x), Y(farMid.y) - 4, show(fov.farEdgeWidthMm, 0), T_DIM, 'middle'));
  }
  return <g>{out}</g>;
}

function TopView({ res, areaW, areaL, margin }: { res: ObliqueResult; areaW: number; areaL: number; margin: number }) {
  const t = useTranslations('oblique.result');
  // Vòng 6 (2026-11-24): rộng bằng hình Ảnh camera (420), cao co theo nội dung — hình to như hình bên cạnh.
  // Chừa hai bên (SIDE) cho vạch đo FOV và chữ.
  const W = 420;
  const pad = 22;
  const SIDE = 40;
  const cam = res.cameraPos;
  // Khung nhìn: sản phẩm + camera + cả FOV khi khép kín, nới 4 %.
  const fp = res.horizon ? [] : res.footprint;
  const xs = [-areaW / 2, areaW / 2, cam[0], ...fp.map((p) => p.x)];
  const ys = [0, areaL, cam[1], ...fp.map((p) => p.y)];
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const ex = (x1 - x0) * 0.04 + 1;
  const ey = (y1 - y0) * 0.04 + 1;
  x0 -= ex;
  x1 += ex;
  y0 -= ey;
  y1 += ey;
  // Theo bề rộng trước; vùng quá dài thì giới hạn cao 1,3 × rộng.
  const H_MAX = W * 1.3;
  let s = (W - 2 * pad - 2 * SIDE) / (x1 - x0);
  if ((y1 - y0) * s + 2 * pad > H_MAX) s = (H_MAX - 2 * pad) / (y1 - y0);
  const H = r1((y1 - y0) * s + 2 * pad);
  const ox = (W - (x1 - x0) * s) / 2;
  const oy = pad;
  const X = (x: number) => r1(ox + (x - x0) * s);
  const Y = (y: number) => r1(H - oy - (y - y0) * s);
  const poly = res.footprint.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
  // Tên sản phẩm chỉ ghi khi khối đủ chỗ (kích thước đã có ở ô nhập và vạch đo).
  const showName = areaL * s >= 30 && areaW * s >= 100;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('topTitle')}>
      <defs>
        <clipPath id="oblique-top-clip">
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <polygon points={poly} clipPath="url(#oblique-top-clip)" className="fill-sky-400/25 stroke-sky-600 dark:fill-sky-500/25 dark:stroke-sky-400" strokeWidth={1.5} />
      {/* Sản phẩm (B, 2026-11-23): khối màu có tên thay khung nét đứt. */}
      <rect x={X(-areaW / 2)} y={Y(areaL)} width={r1(areaW * s)} height={r1(areaL * s)} rx={2} strokeWidth={1.5} className="fill-teal-200/70 stroke-teal-700 dark:fill-teal-800/60 dark:stroke-teal-300" />
      {showName ? (
        <text x={X(0)} y={Y(areaL / 2) - 8} textAnchor="middle" fontSize={10} className="fill-teal-900 dark:fill-teal-100">
          {`${t('product')} ${show(areaW, 0)} × ${show(areaL, 0)}`}
        </text>
      ) : null}
      <line x1={X(cam[0])} y1={Y(cam[1])} x2={X(res.aimPoint[0])} y2={Y(res.aimPoint[1])} strokeDasharray="3 3" strokeWidth={1} className="stroke-violet-600 dark:stroke-violet-400" />
      <circle cx={X(res.aimPoint[0])} cy={Y(res.aimPoint[1])} r={3} className="fill-violet-600 dark:fill-violet-400" />
      {res.corners.map((c, i) => (
        <circle key={i} cx={X(c.x)} cy={Y(c.y)} r={5} strokeWidth={1.5} className={DOT[cornerTone(c.usage, margin)]} />
      ))}
      <rect x={X(cam[0]) - 7} y={Y(cam[1]) - 5} width={14} height={10} rx={2} className="fill-slate-800 dark:fill-slate-100" />
      <text x={X(cam[0])} y={Y(cam[1]) + 18} textAnchor="middle" fontSize={11} className="fill-slate-700 dark:fill-slate-200">
        {t('camera')}
      </text>
      <FovDims res={res} areaW={areaW} areaL={areaL} X={X} Y={Y} W={W} />
    </svg>
  );
}

/**
 * A (2026-11-23): "Ảnh camera nhìn thấy" — khung chữ nhật là cả bức ảnh (cảm biến), sản phẩm chiếu vào thành hình thang
 * đúng như ảnh chụp. Khung nét đứt bên trong = giới hạn đã chừa độ dư. Góc ra ngoài khung vẫn vẽ (đỏ) để thấy thiếu bao nhiêu.
 */
function CameraView({ res, areaW, areaL, margin }: { res: ObliqueResult; areaW: number; areaL: number; margin: number }) {
  const t = useTranslations('oblique.result');
  const hw = res.sensorHalfWidthMm;
  const hh = res.sensorHalfHeightMm;
  const visible = res.corners.every((c) => Number.isFinite(c.usage));
  const W = 420;
  const pad = 22;
  // Khung nhìn: cảm biến, nới ra nếu góc sản phẩm lọt ngoài (tối đa gấp đôi để hình không quá nhỏ).
  const ex = Math.min(Math.max(hw, ...(visible ? res.corners.map((c) => Math.abs(c.imageX)) : [hw])), 2 * hw) * 1.08;
  const ey = Math.min(Math.max(hh, ...(visible ? res.corners.map((c) => Math.abs(c.imageY)) : [hh])), 2 * hh) * 1.08;
  const s = (W - 2 * pad) / (2 * ex);
  const H = r1(2 * ey * s + 2 * pad);
  const X = (x: number) => r1(W / 2 + x * s);
  const Y = (y: number) => r1(H / 2 - y * s);
  const m = 1 - margin;
  const poly = res.corners.map((c) => `${X(c.imageX)},${Y(c.imageY)}`).join(' ');
  const cx = res.corners.reduce((a, c) => a + c.imageX, 0) / 4;
  const cy = res.corners.reduce((a, c) => a + c.imageY, 0) / 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('cameraTitle')}>
      <rect x={X(-hw)} y={Y(hh)} width={r1(2 * hw * s)} height={r1(2 * hh * s)} strokeWidth={1.5} className="fill-slate-50 stroke-slate-500 dark:fill-slate-950 dark:stroke-slate-400" />
      {margin > 0 ? <rect x={X(-hw * m)} y={Y(hh * m)} width={r1(2 * hw * m * s)} height={r1(2 * hh * m * s)} fill="none" strokeDasharray="4 3" strokeWidth={1} className="stroke-slate-400 dark:stroke-slate-500" /> : null}
      {visible ? (
        <>
          <polygon points={poly} strokeWidth={1.5} className="fill-teal-200/70 stroke-teal-700 dark:fill-teal-800/60 dark:stroke-teal-300" />
          <text x={X(cx)} y={Y(cy) - 18} textAnchor="middle" fontSize={11} className="fill-teal-900 dark:fill-teal-100">
            {`${t('product')} ${show(areaW, 0)} × ${show(areaL, 0)}`}
          </text>
          <text x={X((res.corners[0].imageX + res.corners[1].imageX) / 2)} y={Y((res.corners[0].imageY + res.corners[1].imageY) / 2) + 14} textAnchor="middle" fontSize={10} className="fill-slate-500 dark:fill-slate-400">
            {t('near')}
          </text>
          <text x={X((res.corners[2].imageX + res.corners[3].imageX) / 2)} y={Y((res.corners[2].imageY + res.corners[3].imageY) / 2) - 6} textAnchor="middle" fontSize={10} className="fill-slate-500 dark:fill-slate-400">
            {t('far')}
          </text>
          {res.corners.map((c, i) => (
            <circle key={i} cx={X(c.imageX)} cy={Y(c.imageY)} r={5} strokeWidth={1.5} className={DOT[cornerTone(c.usage, margin)]} />
          ))}
        </>
      ) : (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} className="fill-red-700 dark:fill-red-300">
          {t('cameraBehind')}
        </text>
      )}
      <line x1={X(0) - 6} y1={Y(0)} x2={X(0) + 6} y2={Y(0)} strokeWidth={1} className="stroke-violet-600 dark:stroke-violet-400" />
      <line x1={X(0)} y1={Y(0) - 6} x2={X(0)} y2={Y(0) + 6} strokeWidth={1} className="stroke-violet-600 dark:stroke-violet-400" />
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
      <HeightDims fov={res.groundFov} areaL={areaL} P={P} zTop={z1} />
    </svg>
  );
}

/**
 * Vòng 5 (2026-11-24, Q1–Q4 A): trên hình Nhìn ngang, vạch đứng tại mép gần / mép xa sản phẩm — vật đặt ở đó cao tới số ghi
 * vẫn nằm trọn trong ảnh (cả cảm biến). Vạch đỏ dấu −: phần chân nằm ngoài ảnh (tia biên dưới cắt qua).
 */
function HeightDims({ fov, areaL, P, zTop }: { fov: GroundFov; areaL: number; P: (y: number, z: number) => [number, number]; zTop: number }) {
  const out: React.ReactNode[] = [];
  const tk = 2.5;
  const bar = (key: string, x: number, ya: number, yb: number, bad: boolean) => (
    <g key={key} strokeWidth={bad ? 1.75 : 0.75} className={bad ? 'stroke-red-600 dark:stroke-red-400' : 'stroke-slate-500 dark:stroke-slate-400'}>
      <line x1={x} y1={ya} x2={x} y2={yb} />
      <line x1={x - tk} y1={ya} x2={x + tk} y2={ya} />
      <line x1={x - tk} y1={yb} x2={x + tk} y2={yb} />
    </g>
  );
  const label = (key: string, x: number, y: number, text: string, bad: boolean, anchor: 'start' | 'end') => (
    <text key={key} x={x} y={y} textAnchor={anchor} fontSize={9} strokeWidth={2.5} paintOrder="stroke" className={`${bad ? 'fill-red-600 dark:fill-red-400' : 'fill-slate-700 dark:fill-slate-200'} ${HALO}`}>
      {text}
    </text>
  );
  for (const { key, h, y, side } of [
    { key: 'hn', h: fov.heightAtNear, y: 0, side: -1 },
    { key: 'hf', h: fov.heightAtFar, y: areaL, side: 1 },
  ] as const) {
    if (!h) continue;
    const [x, yLow] = P(y, h.lowMm);
    const yHigh = P(y, Math.min(h.highMm, zTop))[1];
    const lx = x + side * 5;
    const anchor = side < 0 ? 'end' : 'start';
    out.push(bar(key, x, yLow, yHigh, false));
    out.push(label(`${key}t`, lx, (yLow + yHigh) / 2 + 3, Number.isFinite(h.highMm) ? show(h.highMm, 0) : '∞', false, anchor));
    if (h.lowMm > 0.5) {
      const yGround = P(y, 0)[1];
      out.push(bar(`${key}b`, x, yGround, yLow, true));
      out.push(label(`${key}bt`, lx, (yGround + yLow) / 2 + 3, `−${show(h.lowMm, 0)}`, true, anchor));
    }
  }
  return <g>{out}</g>;
}

export type ObliqueState = {
  open: boolean;
  area: { w: string; l: string; margin: string; need: string };
  heightMm: number;
  setbackMm: number;
  sideMm: number;
  /** null = ngắm tâm vùng. */
  tiltDeg: number | null;
  /** null = dùng f của ống đã chọn ở trên (Q2). */
  focalMm: number | null;
  longAcross: boolean;
};

/** Số mẫu để mở khung là có hình ngay — anh sửa theo dự án. */
export function initialObliqueState(open: boolean): ObliqueState {
  return {
    open,
    area: { w: '1200', l: '800', margin: String(OBLIQUE_DEFAULT_MARGIN * 100), need: '' },
    heightMm: 1500,
    setbackMm: 600,
    sideMm: 0,
    tiltDeg: null,
    focalMm: null,
    longAcross: true,
  };
}

export type ObliqueCamera = { longMm: number; shortMm: number | null; pixelUm: number | null; mount: string | null };

export type ObliqueCalc = {
  res: ObliqueResult | null;
  focalMm: number;
  margin: number;
  needGsd: number | null;
  /** Lý do chưa tính được. */
  problem: 'camera' | 'line' | 'pixel' | 'area' | 'distance' | null;
};

/** Tính ở MountCheck (WD của hình bên dưới lấy từ đây — Q3), khung chỉ hiển thị. */
export function obliqueCalc(state: ObliqueState, camera: ObliqueCamera | null, lensFocalMm: number | null): ObliqueCalc {
  const focalMm = state.focalMm ?? lensFocalMm ?? 8;
  const margin = Math.min(Math.max((parse(state.area.margin) ?? OBLIQUE_DEFAULT_MARGIN * 100) / 100, 0), 0.5);
  const needGsd = positive(state.area.need);
  const base = { focalMm, margin, needGsd };
  if (!camera) return { ...base, res: null, problem: 'camera' };
  if (camera.shortMm === null) return { ...base, res: null, problem: 'line' };
  if (camera.pixelUm === null) return { ...base, res: null, problem: 'pixel' };
  const areaW = positive(state.area.w);
  const areaL = positive(state.area.l);
  if (areaW === null || areaL === null) return { ...base, res: null, problem: 'area' };
  const res = obliqueView({
    areaWidthMm: areaW,
    areaLengthMm: areaL,
    heightMm: state.heightMm,
    setbackMm: state.setbackMm,
    sideOffsetMm: state.sideMm,
    tiltDeg: state.tiltDeg,
    sensorLongMm: camera.longMm,
    sensorShortMm: camera.shortMm,
    pixelUm: camera.pixelUm,
    longAcross: state.longAcross,
    focalMm,
    margin,
    blurPx: DOF_BLUR_PRESETS.tight,
  });
  return { ...base, res, problem: res ? null : 'distance' };
}

/**
 * Khung gập "Camera nghiêng" trong trang Kiểm tra lắp đặt (vòng 2 2026-11-23, Q1–Q4 như đề xuất): dùng chung camera
 * và ống kính đã chọn ở trên; thanh góc nghiêng thay ô dời điểm ngắm; bảng ống kho có nút "Dùng ống này".
 */
export function ObliquePanel({
  state,
  setState,
  calc,
  camera,
  lensFocalMm,
  lenses,
  onUseLens,
  admin,
}: {
  state: ObliqueState;
  setState: (s: ObliqueState) => void;
  calc: ObliqueCalc;
  camera: ObliqueCamera | null;
  lensFocalMm: number | null;
  lenses: MountLensOption[];
  onUseLens: (id: string) => void;
  admin: boolean;
}) {
  const t = useTranslations('oblique');
  const { res, focalMm, margin, needGsd } = calc;
  const areaW = positive(state.area.w);
  const areaL = positive(state.area.l);
  const set = (patch: Partial<ObliqueState>) => setState({ ...state, ...patch });
  const setArea = (patch: Partial<ObliqueState['area']>) => set({ area: { ...state.area, ...patch } });

  const fMaxRing = res?.depth && camera?.pixelUm ? maxRingFNumber(camera.pixelUm, res.depth.beta) : null;
  const sensorDiag = camera && camera.shortMm !== null ? Math.hypot(camera.longMm, camera.shortMm) : null;
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

  const coverage: { text: string; tone: Tone } | null = !res
    ? null
    : res.covers
      ? { text: t('result.coverOk', { u: show(res.maxUsage * 100, 1) }), tone: 'ok' }
      : res.maxUsage <= 1 + 1e-12
        ? { text: t('result.coverLow', { u: show(res.maxUsage * 100, 1), m: show(margin * 100, 0) }), tone: 'warn' }
        : { text: t('result.coverBad', { u: Number.isFinite(res.maxUsage) ? show(res.maxUsage * 100, 1) : '∞' }), tone: 'bad' };
  const gsdTone: Tone = res && needGsd !== null ? (res.worstGsdMm <= needGsd + 1e-12 ? 'ok' : 'bad') : 'ok';
  const depthBad = res?.depth && fMaxRing !== null && res.depth.fNumber > fMaxRing + 1e-9;
  const DT = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const smallBtn = 'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';

  return (
    <Panel
      id="mount-oblique"
      title={t('panelTitle')}
      actions={
        <button type="button" onClick={() => set({ open: !state.open })} aria-expanded={state.open} className={smallBtn}>
          {state.open ? t('close') : t('open')}
        </button>
      }
    >
      {!state.open ? (
        <p className={NOTE_CLASS}>{t('panelDesc')}</p>
      ) : (
        <div className="space-y-4">
          <div className={`${FIELD_GRID} grid-cols-2 sm:grid-cols-4`}>
            <NumberField id="oblique-area-w" label={t('setup.areaW')} value={state.area.w} onChange={(v) => setArea({ w: v })} />
            <NumberField id="oblique-area-l" label={t('setup.areaL')} value={state.area.l} onChange={(v) => setArea({ l: v })} />
            <NumberField id="oblique-margin" label={t('setup.margin')} hint={t('setup.marginHint')} value={state.area.margin} onChange={(v) => setArea({ margin: v })} step="1" />
            <NumberField id="oblique-need" label={t('setup.needGsd')} value={state.area.need} onChange={(v) => setArea({ need: v })} step="0.01" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={labelClass}>{t('setup.rotate')}</span>
            <Toggle
              value={state.longAcross ? 'across' : 'along'}
              onChange={(v) => set({ longAcross: v === 'across' })}
              options={[
                { value: 'across', label: t('setup.rotateAcross') },
                { value: 'along', label: t('setup.rotateAlong') },
              ]}
            />
          </div>

          {/* Thanh trượt LUÔN hiện khi đã có vùng + camera: số gõ dở (vd chiều cao "2") làm camera quá gần điểm ngắm
              thì chỉ phần kết quả đổi thành thông báo — ô đang gõ không bị gỡ khỏi trang (sửa 2026-11-23). */}
          {areaW === null || areaL === null || (res === null && calc.problem !== 'distance') ? (
            <p className="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">{t(`problem.${calc.problem ?? 'area'}`)}</p>
          ) : (
            <section aria-label={t('result.title')} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              {/* Không dính khi cuộn (Hùng 2026-11-23: cuộn trong khung khó nhìn). */}
              <div className="space-y-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.title')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {state.tiltDeg !== null ? (
                      <button type="button" onClick={() => set({ tiltDeg: null })} className={smallBtn}>
                        {t('resetTilt')}
                      </button>
                    ) : null}
                    {state.focalMm !== null && lensFocalMm !== null ? (
                      <button type="button" onClick={() => set({ focalMm: null })} className={smallBtn}>
                        {t('resetFocal', { f: show(lensFocalMm, 1) })}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Slider id="oblique-sl-tilt" label={t('setup.tilt')} value={state.tiltDeg ?? res?.tiltDeg ?? 0} min={0} max={OBLIQUE_MAX_TILT_DEG} step={0.1} accept="nonneg" onChange={(v) => set({ tiltDeg: v })} note={state.tiltDeg === null ? t('setup.tiltCentre') : null} />
                  <Slider id="oblique-sl-h" label={t('setup.height')} value={state.heightMm} min={100} max={Math.max(3000, Math.ceil(state.heightMm * 1.5))} step={10} accept="positive" onChange={(v) => set({ heightMm: v })} note={null} />
                  <Slider
                    id="oblique-sl-setback"
                    label={t('setup.setback')}
                    value={state.setbackMm}
                    min={-Math.ceil(areaL)}
                    max={Math.max(3000, Math.ceil(state.setbackMm * 1.5))}
                    step={10}
                    accept="any"
                    onChange={(v) => set({ setbackMm: v })}
                    note={state.setbackMm < 0 ? t('setup.setbackHint') : null}
                  />
                  <Slider
                    id="oblique-sl-side"
                    label={t('setup.side')}
                    value={state.sideMm}
                    min={-Math.ceil(Math.max(areaW, Math.abs(state.sideMm)))}
                    max={Math.ceil(Math.max(areaW, Math.abs(state.sideMm)))}
                    step={10}
                    accept="any"
                    onChange={(v) => set({ sideMm: v })}
                    note={null}
                  />
                  <Slider
                    id="oblique-sl-f"
                    label={t('setup.focal')}
                    value={focalMm}
                    min={2}
                    max={Math.max(50, Math.ceil((res?.focalMaxMm ?? 25) * 2), Math.ceil(focalMm))}
                    step={0.1}
                    accept="positive"
                    onChange={(v) => set({ focalMm: v })}
                    note={state.focalMm !== null && lensFocalMm !== null ? t('focalTrial') : lensFocalMm === null ? t('focalNoLens') : null}
                  />
                </div>
                {res ? (
                <>
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
                    <dt className={DT}>{t('result.distance')}</dt>
                    <dd className="min-h-[2.5rem] text-sm tabular-nums text-slate-900 dark:text-slate-100">
                      {t('result.distanceValue', { near: show(res.nearestMm, 0), far: show(res.farthestMm, 0), aim: show(res.distanceToAimMm, 0) })}
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
                <FovBlock fov={res.groundFov} />
                {res.horizon ? <p className="text-sm text-amber-700 dark:text-amber-300">{t('result.horizon')}</p> : null}
                </>
                ) : (
                  <p className="rounded-md border border-dashed border-amber-300 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-200">{t(`problem.${calc.problem ?? 'distance'}`)}</p>
                )}
              </div>

              {res ? (
              <>

              <div className="grid gap-4 lg:grid-cols-2">
                <figure className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <figcaption className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.cameraTitle')}</figcaption>
                  <CameraView res={res} areaW={areaW} areaL={areaL} margin={margin} />
                  {/* Chú thích sát đáy khung — cân với hình bên cạnh trong cùng hàng. */}
                  <p className={`mt-auto pt-1 ${NOTE_CLASS}`}>{t('result.cameraNote')}</p>
                </figure>
                <figure className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <figcaption className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.topTitle')}</figcaption>
                  <TopView res={res} areaW={areaW} areaL={areaL} margin={margin} />
                  {/* Chú thích sát đáy khung — cân với hình bên cạnh trong cùng hàng. */}
                  <p className={`mt-auto pt-1 ${NOTE_CLASS}`}>{t('result.topNote')}</p>
                </figure>
                <figure className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <figcaption className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.sideTitle')}</figcaption>
                  <SideView res={res} areaL={areaL} />
                  {/* Chú thích sát đáy khung — cân với hình bên cạnh trong cùng hàng. */}
                  <p className={`mt-auto pt-1 ${NOTE_CLASS}`}>{t('result.sideNote')}</p>
                </figure>
                <figure className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <figcaption className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('result.cornersTitle')}</figcaption>
                  <table className="w-full text-xs tabular-nums">
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
                            <td className={`py-1 ${TONE[tone]}`}>{Number.isFinite(c.usage) ? `${show(c.usage * 100, 1)} %` : '—'}</td>
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

              {/* ── Ống trong kho có f ≤ f tối đa ── */}
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
                                <button type="button" onClick={() => onUseLens(lens.id)} className={smallBtn}>
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
              </>
              ) : null}
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
