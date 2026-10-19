'use client';

import { useTranslations } from 'next-intl';

/**
 * Sơ đồ phối cảnh của Bộ chọn ống kính (chốt 2026-10-19, cách A — SVG, không thư viện 3D).
 *
 * Mọi điểm đi qua MỘT phép chiếu xiên duy nhất `P(x, y, z)`:
 *   x — ngang mặt vùng nhìn, y — dọc (xuống), z — trục quang học (từ camera ra vật).
 * Nhờ vậy mặt trước ống kính, khung cảm biến và mặt vùng nhìn cùng một hướng, ống
 * chĩa đúng tâm vùng nhìn, và tia telecentric song song thật. Bản mẫu đầu vẽ từng
 * phần bằng tay nên ống lệch trục và hai tia đè lên mũi tên WD (Hưng phát hiện).
 *
 * Góc chiếu chọn để 4 tia cách trục ≥ 55 px trên mặt vùng nhìn — đường chéo của
 * mặt (P2–P4) không được trùng hướng trục, nếu không tia đè lên mũi tên WD.
 *
 * Hình minh hoạ, KHÔNG theo tỉ lệ: số thật nằm trên nhãn. Vẽ đúng tỉ lệ thì WD
 * 300 mm với ống 16 mm biến vùng nhìn thành một chấm.
 *
 * Chỉ vẽ — không tính gì; số do LensSelector truyền vào (đã từ engine).
 */

export type DiagramField = 'f' | 'wd' | 'fov';

type Pt = readonly [number, number];

// ── Phép chiếu trục đo (orthographic) ──
// Quay quanh trục dọc góc YAW (nhìn chéo từ bên trái) rồi cúi xuống PITCH (nhìn hơi từ
// trên): mặt vùng nhìn và mặt trước ống cùng bị nén theo một hướng, ống chĩa đúng tâm
// vùng nhìn. Bản trước giữ nguyên hình mặt vùng nhìn nên miệng ống thành hình tròn quay
// ra người xem — trông như ống chĩa vào mặt mình (Hưng phát hiện 2026-10-19).
const YAW = (55 * Math.PI) / 180;
const PITCH = (22 * Math.PI) / 180;
const EX: Pt = [Math.cos(YAW), Math.sin(YAW) * Math.sin(PITCH)]; // 1 đơn vị x (ngang vùng nhìn)
const EY: Pt = [0, Math.cos(PITCH)]; // 1 đơn vị y (dọc, xuống)
const EZ: Pt = [Math.sin(YAW), -Math.cos(YAW) * Math.sin(PITCH)]; // 1 đơn vị z (trục quang học)
/* Làm tròn: sin/cos trên máy chủ và trình duyệt lệch ở chữ số thứ 14 → React báo lệch
   hydration (thuộc tính SVG khác nhau) nếu để nguyên số thực. Mọi toạ độ ra hình đều qua r1. */
const r1 = (v: number) => Math.round(v * 10) / 10;
const AXIS_DEG = Math.round(((Math.atan2(EZ[1], EZ[0]) * 180) / Math.PI) * 100) / 100;
const WD_LEN = 330; // độ dài trục (đơn vị thế giới)
const C: Pt = [470, 165]; // tâm mặt vùng nhìn trên hình
const A: Pt = [r1(C[0] - WD_LEN * EZ[0]), r1(C[1] - WD_LEN * EZ[1])]; // tâm mặt trước ống (z = 0)

/** Điểm 3D → toạ độ hình. Gốc ở tâm mặt trước ống kính. */
const P = (x: number, y: number, z: number): Pt => [r1(A[0] + x * EX[0] + y * EY[0] + z * EZ[0]), r1(A[1] + x * EX[1] + y * EY[1] + z * EZ[1])];
const at = (p: Pt) => `${p[0]},${p[1]}`;
const poly = (pts: readonly Pt[]) => pts.map(at).join(' ');

/** Vòng tròn bán kính r vuông góc trục ở độ sâu z (hiện ra thành elip xiên). */
const circle = (r: number, z: number, n = 48): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return P(r * Math.cos(t), r * Math.sin(t), z);
  });

/**
 * Nửa vòng tròn THẤY ĐƯỢC trên thân trụ: điểm (cos t, sin t) có pháp tuyến thân ống hướng
 * về người xem — sinYAW·cosPITCH·cos t − sinPITCH·sin t > 0. Nửa còn lại khuất sau thân.
 */
const visibleArc = (r: number, z: number, n = 48): Pt[] => {
  const delta = Math.atan2(Math.sin(PITCH), Math.sin(YAW) * Math.cos(PITCH));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = -Math.PI / 2 - delta + (Math.PI * i) / n;
    return P(r * Math.cos(t), r * Math.sin(t), z);
  });
};

/** Bao lồi (monotone chain) — thân ống = bao của vòng sau và vòng trước. */
function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Hình dạng ống theo hãng (mm thật ≈ đơn vị hình), từ ngàm ra mặt trước (z = 0).
 * - Ống thường C-mount: thân Ø40, cổ ngàm Ø34, hai vòng chỉnh (lấy nét, khẩu).
 * - Telecentric (dòng TC Opto Engineering / Edmund): khối trụ trước to — Ø ≈ 1,3 ×
 *   cạnh dài vùng nhìn vì phải hứng tia song song — rồi côn thu về ống sau nhỏ gắn
 *   ngàm C. Bản trước vẽ côn loe như cái loa (Hưng phát hiện 2026-10-19).
 * Mỗi đoạn là [mặt sau, mặt trước]: { z, r }.
 */
type Station = { z: number; r: number };
const LENS_SHAPE: Record<'fixed' | 'telecentric', { segments: [Station, Station][]; rings: number[] }> = {
  fixed: {
    segments: [
      [{ z: -72, r: 17 }, { z: -60, r: 17 }],
      [{ z: -60, r: 20 }, { z: 0, r: 20 }],
    ],
    rings: [-44, -24],
  },
  telecentric: {
    segments: [
      [{ z: -170, r: 15 }, { z: -125, r: 15 }],
      [{ z: -125, r: 15 }, { z: -88, r: 58 }],
      [{ z: -88, r: 58 }, { z: 0, r: 58 }],
    ],
    rings: [-30],
  },
};

/** Camera + ống ở một chế độ. Hướng nhìn của phép chiếu thấy các mặt +x, −y, −z của hộp. */
function rig(telecentric: boolean) {
  const shape = LENS_SHAPE[telecentric ? 'telecentric' : 'fixed'];
  const front = shape.segments[shape.segments.length - 1][1];
  const length = -shape.segments[0][0].z;
  // Camera công nghiệp ~29 × 29 mm, dài ~40 mm — cỡ ngang đường kính ống thường.
  const box = { half: 15, z0: -(length + 42), z1: -length };
  const b = (x: number, y: number, z: number) => P(x * box.half, y * box.half, z);
  return {
    lens: { rFront: front.r, length },
    // Vẽ từ đoạn xa người xem (z lớn) tới đoạn gần: đoạn gần đè lên đoạn xa.
    barrel: [...shape.segments].reverse().map(([back, fr]) => hull([...circle(back.r, back.z), ...circle(fr.r, fr.z)])),
    rings: shape.rings.map((z) => visibleArc(front.r, z)),
    rim: visibleArc(front.r, 0),
    back: [b(-1, -1, box.z0), b(1, -1, box.z0), b(1, 1, box.z0), b(-1, 1, box.z0)],
    top: [b(-1, -1, box.z0), b(-1, -1, box.z1), b(1, -1, box.z1), b(1, -1, box.z0)],
    side: [b(1, -1, box.z0), b(1, -1, box.z1), b(1, 1, box.z1), b(1, 1, box.z0)],
    backCenter: P(0, 0, box.z0),
  };
}

const RIGS = { fixed: rig(false), telecentric: rig(true) };

/** Mặt vùng nhìn: nửa rộng × nửa cao (đơn vị hình) tại z = WD_LEN. */
const PLANE = { fixed: { hw: 120, hh: 95 }, telecentric: { hw: 45, hh: 35 } };
const corners = (hw: number, hh: number, z: number): Pt[] => [P(-hw, -hh, z), P(hw, -hh, z), P(hw, hh, z), P(-hw, hh, z)];

// Đường kích thước WD: song song trục, hạ xuống dưới chóp nhìn (theo trục y thế giới).
const WD_DROP = 150;

const fmt = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : String(Math.round(value * 10 ** digits) / 10 ** digits);

// Ô phóng to cảm biến (góc trên trái).
const INSET = { x: 12, y: 12, w: 240, h: 160 };

export function LensDiagram({
  sensorLongMm,
  sensorShortMm,
  widthPx,
  heightPx,
  pixelUm,
  lineScan,
  focalMm,
  wdMm,
  fovLongMm,
  fovShortMm,
  telecentric,
  highlight,
}: {
  sensorLongMm: number | null;
  sensorShortMm: number | null;
  widthPx: number | null;
  heightPx: number | null;
  pixelUm: number | null;
  lineScan: boolean;
  focalMm: number | null;
  wdMm: number | null;
  fovLongMm: number | null;
  fovShortMm: number | null;
  telecentric: boolean;
  highlight: DiagramField | null;
}) {
  const t = useTranslations('lensSelector.diagram');
  const mode = telecentric ? 'telecentric' : 'fixed';
  const r = RIGS[mode];
  const { hw, hh } = PLANE[mode];
  const [p1, p2, p3, p4] = corners(hw, hh, WD_LEN);

  const on = (field: DiagramField) => highlight === field;
  const label = (field: DiagramField) => (on(field) ? 'fill-sky-600 font-semibold dark:fill-sky-400' : 'fill-slate-700 dark:fill-slate-200');
  const dim = (field: DiagramField) => (on(field) ? 'stroke-sky-500' : 'stroke-slate-500 dark:stroke-slate-400');
  // Viền nền quanh chữ: chữ không bao giờ bị nét khác che (paint-order: stroke).
  const halo = 'stroke-white dark:stroke-slate-900';

  // Tia: ống thường hội tụ tại tâm mặt trước; telecentric song song trục, xuất phát trên mặt trước.
  const rays: [Pt, Pt][] = telecentric
    ? [
        [P(-hw, -hh, 0), p1],
        [P(hw, -hh, 0), p2],
        [P(hw, hh, 0), p3],
        [P(-hw, hh, 0), p4],
      ]
    : [p1, p2, p3, p4].map((p) => [A, p] as [Pt, Pt]);

  // Kích thước vùng nhìn: cạnh trên (dài) và cạnh phải (ngắn), lệch ra ngoài 14.
  const topA = P(-hw, -hh - 14, WD_LEN);
  const topB = P(hw, -hh - 14, WD_LEN);
  const sideA = P(hw + 14, -hh, WD_LEN);
  const sideB = P(hw + 14, hh, WD_LEN);
  const topMid: Pt = [(topA[0] + topB[0]) / 2, Math.min(topA[1], topB[1]) - 10];
  const sideMid: Pt = [sideA[0] + 16, (sideA[1] + sideB[1]) / 2];

  // WD: từ mép dưới ống tới mặt vùng nhìn, đo song song trục, hạ xuống dưới chóp nhìn.
  const wdStart = P(0, r.lens.rFront + 6, 0);
  const wdA = P(0, WD_DROP, 0);
  const wdB = P(0, WD_DROP, WD_LEN);
  const wdMid = P(0, WD_DROP + 16, WD_LEN / 2);
  const planeBottom = P(0, hh, WD_LEN);

  // f: dưới thân ống, bên trái đường gióng WD — phía trên có đường nối ô cảm biến và tia A→P1.
  const fAnchor = P(0, r.lens.rFront + 42, -14);

  // Ô cảm biến: vẽ đúng tỉ lệ cạnh của cảm biến thật, tối đa 120 × 74.
  const ratio = sensorLongMm && sensorShortMm ? sensorShortMm / sensorLongMm : 0.75;
  const sw = Math.min(120, 74 / Math.max(ratio, 0.01));
  const sh = lineScan ? 4 : Math.max(4, sw * ratio);
  const sx = INSET.x + 30;
  const sy = INSET.y + 40;

  return (
    <svg viewBox="0 0 640 410" role="img" aria-label={t('aria')} className="h-auto w-full text-[15px]">
      <defs>
        <marker id="lens-dim-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* ── Mặt vùng nhìn (xa nhất, vẽ trước) ── */}
      <polygon
        points={poly([p1, p2, p3, p4])}
        className={`fill-sky-200/50 dark:fill-sky-900/50 ${on('fov') ? 'stroke-sky-500' : 'stroke-sky-600 dark:stroke-sky-400'}`}
        strokeWidth={on('fov') ? 2 : 1}
      />

      {/* ── Tia ── */}
      {rays.map(([from, to], i) => (
        <line key={i} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} strokeDasharray="5 4" className="stroke-pink-500" strokeWidth="1" />
      ))}
      {/* Trục quang học: mặt trước ống → tâm vùng nhìn */}
      <line x1={A[0]} y1={A[1]} x2={C[0]} y2={C[1]} strokeDasharray="2 3" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
      <circle cx={C[0]} cy={C[1]} r="2.5" className="fill-slate-500 dark:fill-slate-400" />

      {/* ── Ống kính: gần người xem hơn tia → vẽ sau tia (tia chui ra từ miệng ống); xa hơn hộp camera → vẽ trước hộp ── */}
      {r.barrel.map((segment, i) => (
        <polygon
          key={i}
          points={poly(segment)}
          className={`fill-slate-400 dark:fill-slate-500 ${on('f') ? 'stroke-sky-500' : 'stroke-slate-600 dark:stroke-slate-300'}`}
          strokeWidth={on('f') ? 2 : 1}
          strokeLinejoin="round"
        />
      ))}
      {/* Vòng chỉnh (chỉ nét, không tô) */}
      {r.rings.map((ring, i) => (
        <polyline key={i} points={poly(ring)} fill="none" className="stroke-slate-600 dark:stroke-slate-300" strokeWidth="0.75" />
      ))}
      {/* Miệng ống: mặt trước quay về phía vùng nhìn (người xem không thấy mặt kính) — chỉ vẽ vành. */}
      <polyline points={poly(r.rim)} fill="none" className="stroke-slate-700 dark:stroke-slate-200" strokeWidth="1.25" />

      {/* ── Hộp camera: mặt sau, mặt trên, mặt phải ── */}
      <polygon points={poly(r.top)} className="fill-slate-200 stroke-slate-500 dark:fill-slate-600 dark:stroke-slate-400" strokeWidth="1" />
      <polygon points={poly(r.side)} className="fill-slate-300 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400" strokeWidth="1" />
      <polygon points={poly(r.back)} className="fill-slate-100 stroke-slate-500 dark:fill-slate-500 dark:stroke-slate-400" strokeWidth="1" />
      <circle cx={r.backCenter[0]} cy={r.backCenter[1]} r="3" className="fill-indigo-500" />

      {/* ── Ô phóng to cảm biến ── */}
      <line
        x1={r.backCenter[0]}
        y1={INSET.y + INSET.h}
        x2={r.backCenter[0]}
        y2={r.backCenter[1] - 4}
        strokeDasharray="3 3"
        className="stroke-indigo-400 dark:stroke-indigo-300"
        strokeWidth="1"
      />
      <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="8" className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600" strokeWidth="1" />
      <rect x={sx} y={sy} width={sw} height={sh} className="fill-indigo-400/70 stroke-indigo-700 dark:fill-indigo-500/60 dark:stroke-indigo-300" strokeWidth="1" />
      <line x1={sx} y1={sy - 10} x2={sx + sw} y2={sy - 10} markerStart="url(#lens-dim-arrow)" markerEnd="url(#lens-dim-arrow)" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1" />
      <text x={sx + sw / 2} y={sy - 16} textAnchor="middle" fontSize="14" className="fill-slate-700 dark:fill-slate-200">
        {widthPx ? `${widthPx} px` : '—'}
      </text>
      {!lineScan ? (
        <>
          <line x1={sx + sw + 10} y1={sy} x2={sx + sw + 10} y2={sy + sh} markerStart="url(#lens-dim-arrow)" markerEnd="url(#lens-dim-arrow)" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1" />
          <text
            x={sx + sw + 26}
            y={sy + sh / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            transform={`rotate(-90 ${sx + sw + 26} ${sy + sh / 2})`}
            className="fill-slate-700 dark:fill-slate-200"
          >
            {heightPx ? `${heightPx} px` : '—'}
          </text>
        </>
      ) : null}
      <text x={INSET.x + 14} y={INSET.y + INSET.h - 29} fontSize="14" className="fill-slate-600 dark:fill-slate-300">
        {t('sensor')} {sensorLongMm === null ? '—' : lineScan ? `${fmt(sensorLongMm, 2)} mm` : `${fmt(sensorLongMm, 2)} × ${fmt(sensorShortMm, 2)} mm`}
      </text>
      <text x={INSET.x + 14} y={INSET.y + INSET.h - 10} fontSize="14" className="fill-slate-600 dark:fill-slate-300">
        {t('pixel')} {pixelUm ? `${fmt(pixelUm, 2)} µm` : '—'}
      </text>

      {/* ── Kích thước vùng nhìn ── */}
      <line x1={topA[0]} y1={topA[1]} x2={topB[0]} y2={topB[1]} markerStart="url(#lens-dim-arrow)" markerEnd="url(#lens-dim-arrow)" className={dim('fov')} strokeWidth={on('fov') ? 1.5 : 1} />
      <text x={topMid[0]} y={topMid[1]} textAnchor="middle" paintOrder="stroke" strokeWidth="4" strokeLinejoin="round" className={`${label('fov')} ${halo}`}>
        {t('fov')} {fovLongMm === null ? '—' : `${fmt(fovLongMm)} mm`}
      </text>
      {!lineScan ? (
        <>
          <line x1={sideA[0]} y1={sideA[1]} x2={sideB[0]} y2={sideB[1]} markerStart="url(#lens-dim-arrow)" markerEnd="url(#lens-dim-arrow)" className={dim('fov')} strokeWidth={on('fov') ? 1.5 : 1} />
          <text
            x={sideMid[0]}
            y={sideMid[1]}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(-90 ${sideMid[0]} ${sideMid[1]})`}
            paintOrder="stroke"
            strokeWidth="4"
            strokeLinejoin="round"
            className={`${label('fov')} ${halo}`}
          >
            {fovShortMm === null ? '—' : `${fmt(fovShortMm)} mm`}
          </text>
        </>
      ) : null}

      {/* ── Khoảng cách làm việc ── */}
      <line x1={wdStart[0]} y1={wdStart[1]} x2={wdA[0]} y2={wdA[1]} strokeDasharray="2 3" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
      <line x1={planeBottom[0]} y1={planeBottom[1]} x2={wdB[0]} y2={wdB[1]} strokeDasharray="2 3" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
      <line x1={wdA[0]} y1={wdA[1]} x2={wdB[0]} y2={wdB[1]} markerStart="url(#lens-dim-arrow)" markerEnd="url(#lens-dim-arrow)" className={dim('wd')} strokeWidth={on('wd') ? 1.5 : 1} />
      <text
        x={wdMid[0]}
        y={wdMid[1]}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${AXIS_DEG} ${wdMid[0]} ${wdMid[1]})`}
        paintOrder="stroke"
        strokeWidth="4"
        strokeLinejoin="round"
        className={`${label('wd')} ${halo}`}
      >
        WD {wdMm === null ? (telecentric ? t('wdFromLens') : '—') : `${fmt(wdMm, 0)} mm`}
      </text>

      {/* ── Tiêu cự ── */}
      {!telecentric ? (
        <text x={fAnchor[0]} y={fAnchor[1]} textAnchor="end" paintOrder="stroke" strokeWidth="4" strokeLinejoin="round" className={`${label('f')} ${halo}`}>
          f {fmt(focalMm)} mm
        </text>
      ) : null}
    </svg>
  );
}
