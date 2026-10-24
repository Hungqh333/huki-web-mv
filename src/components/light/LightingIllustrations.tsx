'use client';

import type { ReactNode } from 'react';

/**
 * Hình minh hoạ trang Chọn đèn (chốt 2026-10-22, Q1–Q4): vẽ ở trình duyệt từ KẾT QUẢ máy chủ
 * trả về (kiểu đèn, màu, cỡ) — không chứa luật hay ngưỡng nào. Tất cả là hình MINH HOẠ, không
 * theo tỉ lệ (hình học lắp đèn chưa làm — Q3 trước đó).
 *
 *  A. LightingSection — mặt cắt nhìn ngang: camera, ống kính, đèn, vật, tia sáng.
 *  —  CameraView      — camera thấy gì (mô phỏng định tính, không phải ảnh chụp).
 *  C. TopView         — nhìn từ trên: khung vùng nhìn và vệt đèn đúng tỉ lệ với nhau.
 *  (B. xem trước camera đơn sắc là ô màu HTML trong LightSelector.)
 */

/** Màu tia theo màu đèn. Tia vào ống kính luôn xám nét đứt. */
export const RAY_HEX: Record<string, string> = {
  white: '#EF9F27',
  red: '#E24B4A',
  green: '#639922',
  blue: '#378ADD',
  ir: '#993556',
  uv: '#7F77DD',
};
const BACK = '#5F5E5A';

const ARROW = (id: string) => (
  <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </marker>
);

type Ray = [number, number, number, number, number?];

function Rays({ rays, color, marker, dashed = false }: { rays: Ray[]; color: string; marker: string; dashed?: boolean }) {
  return (
    <>
      {rays.map(([x1, y1, x2, y2, opacity = 0.9], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={dashed ? 1.2 : 1.4}
          strokeDasharray={dashed ? '4 3' : undefined}
          opacity={opacity}
          markerEnd={`url(#${marker})`}
        />
      ))}
    </>
  );
}

const Lamp = ({ x, y, w, h, rotate }: { x: number; y: number; w: number; h: number; rotate?: [number, number, number] }) => (
  <rect
    x={x}
    y={y}
    width={w}
    height={h}
    rx={2}
    transform={rotate ? `rotate(${rotate.join(' ')})` : undefined}
    className="fill-amber-200 stroke-amber-700 dark:fill-amber-700 dark:stroke-amber-300"
    strokeWidth={0.8}
  />
);

/* Toạ độ chung của mặt cắt (viewBox 360 × 240): trục ống kính x = 180, mặt vật y = 200. */
const AXIS = 180;
const TOP = 200;
/** Vùng camera nhìn trên mặt vật (minh hoạ). */
const FOV_L = 130;
const FOV_R = 230;

/**
 * Đèn dạng vòng nhìn nghiêng nhẹ: nửa sau mờ (sau trục ống kính), nửa trước đậm — đọc ra ngay
 * là MỘT vòng bao quanh trục, camera nhìn xuyên qua lỗ giữa. Trả điểm phát sáng mép trong
 * hai bên để vẽ tia.
 */
function RingLight({ cy, rx, ry = 6, width = 7, hex }: { cy: number; rx: number; ry?: number; width?: number; hex?: string }) {
  const l = AXIS - rx;
  const r = AXIS + rx;
  return (
    <>
      <path
        d={`M${l} ${cy} A${rx} ${ry} 0 0 1 ${r} ${cy}`}
        fill="none"
        className={hex ? undefined : 'stroke-amber-300 dark:stroke-amber-700'}
        stroke={hex}
        strokeOpacity={hex ? 0.45 : undefined}
        strokeWidth={width - 1}
      />
      <path d={`M${l} ${cy} A${rx} ${ry} 0 0 0 ${r} ${cy}`} fill="none" className={hex ? undefined : 'stroke-amber-500 dark:stroke-amber-400'} stroke={hex} strokeWidth={width} />
    </>
  );
}

/** A — mặt cắt theo kiểu đèn. Chưa có kiểu → chỉ camera và vật. */
export function LightingSection({ lightType, lightColor, idPrefix }: { lightType: string | null; lightColor: string; idPrefix: string }) {
  const ray = RAY_HEX[lightColor] ?? RAY_HEX.white;
  const mLight = `${idPrefix}-l`;
  const mBack = `${idPrefix}-b`;
  const back = <Rays rays={[[AXIS, TOP - 2, AXIS, 74]]} color={BACK} marker={mBack} dashed />;
  const backlit = lightType === 'backlight';

  let drawing: ReactNode = null;
  switch (lightType) {
    case 'ring':
      // Vòng đèn ngay dưới ống kính, chiếu xiên xuống phủ cả vùng nhìn; vật mờ tán xạ ánh sáng vào ống.
      drawing = (
        <>
          <RingLight cy={104} rx={50} />
          <Rays rays={[[134, 111, 150, 197], [136, 111, 206, 197, 0.45], [226, 111, 210, 197], [224, 111, 154, 197, 0.45]]} color={ray} marker={mLight} />
          {back}
        </>
      );
      break;
    case 'bar':
      drawing = (
        <>
          {/* Thanh xoay cho MẶT đèn hướng vào giữa vùng nhìn; chùm sáng phủ cả vùng nhìn từ một phía. */}
          <Lamp x={62} y={136} w={64} h={11} rotate={[-55, 94, 141]} />
          <Rays rays={[[87, 166, 135, 197, 0.6], [99, 150, 180, 197], [111, 134, 225, 197, 0.6]]} color={ray} marker={mLight} />
          {back}
        </>
      );
      break;
    case 'coaxial':
      // Hộp đồng trục: gương bán phản xạ 45° phủ HẾT vùng nhìn; đèn bên hông chiếu ngang, gương bẻ
      // thành chùm song song đi xuống đúng trục camera; ánh sáng phản xạ đi ngược lên xuyên gương vào ống.
      drawing = (
        <>
          <rect x={128} y={76} width={104} height={102} rx={2} fill="none" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={0.8} />
          <line x1={130} y1={176} x2={230} y2={76} className="stroke-sky-500" strokeWidth={1.4} />
          <Lamp x={234} y={84} w={9} h={86} />
          <Rays rays={[[233, 100, 208, 100], [233, 126, 182, 126], [233, 152, 156, 152]]} color={ray} marker={mLight} />
          <Rays rays={[[206, 101, 206, 197], [180, 127, 180, 197], [154, 153, 154, 197]]} color={ray} marker={mLight} />
          <Rays rays={[[192, TOP - 2, 192, 74]]} color={BACK} marker={mBack} dashed />
        </>
      );
      break;
    case 'dome':
      drawing = (
        <>
          <path d="M80 200 A100 100 0 0 1 168 100.7" fill="none" className="stroke-amber-500" strokeWidth={4} />
          <path d="M192 100.7 A100 100 0 0 1 280 200" fill="none" className="stroke-amber-500" strokeWidth={4} />
          {/* LED ở vành đáy chiếu NGƯỢC lên mặt trong vòm; mặt vòm trắng khuếch tán xuống đều. */}
          <Lamp x={80} y={188} w={14} h={7} />
          <Lamp x={266} y={188} w={14} h={7} />
          <Rays rays={[[88, 187, 104, 140, 0.45], [272, 187, 256, 140, 0.45]]} color={ray} marker={mLight} />
          <Rays rays={[[112, 128, 150, 196, 0.7], [140, 110, 166, 196, 0.7], [220, 110, 194, 196, 0.7], [248, 128, 210, 196, 0.7]]} color={ray} marker={mLight} />
          {back}
        </>
      );
      break;
    case 'backlight':
      drawing = (
        <>
          <Lamp x={80} y={222} w={200} h={8} />
          <Rays rays={[[104, 220, 166, 74, 0.8], [256, 220, 194, 74, 0.8]]} color={ray} marker={mLight} />
        </>
      );
      break;
    case 'darkfield':
      // Vòng đèn sát mặt vật, chiếu gần song song: phản xạ gương đi ra phía đối diện (không vào ống
      // → nền tối); vết xước / dị vật tán xạ lên ống (sáng).
      drawing = (
        <>
          <RingLight cy={174} rx={96} ry={4} width={5} />
          <Rays rays={[[88, 177, 150, 198], [272, 177, 210, 198]]} color={ray} marker={mLight} />
          <Rays rays={[[150, 198, 214, 177, 0.35], [210, 198, 146, 177, 0.35]]} color={ray} marker={mLight} />
          <circle cx={AXIS} cy={TOP} r={3.5} className="fill-red-500" />
          {back}
        </>
      );
      break;
    case 'multi_angle_ring':
      // Ba vòng đèn ở ba góc chiếu (thường mỗi tầng một màu R / G / B): mặt nghiêng khác nhau sáng màu khác nhau.
      drawing = (
        <>
          {/* Tầng trên đỏ (chiếu dốc), giữa lục, dưới lam (chiếu thấp) — mặt phẳng hiện đỏ, mặt dốc hiện lam. */}
          <RingLight cy={112} rx={44} hex={RAY_HEX.red} />
          <RingLight cy={146} rx={66} hex={RAY_HEX.green} />
          <RingLight cy={178} rx={86} ry={5} hex={RAY_HEX.blue} />
          <Rays rays={[[140, 118, 166, 197], [220, 118, 194, 197]]} color={RAY_HEX.red} marker={mLight} />
          <Rays rays={[[118, 151, 160, 197], [242, 151, 200, 197]]} color={RAY_HEX.green} marker={mLight} />
          <Rays rays={[[98, 182, 154, 198], [262, 182, 206, 198]]} color={RAY_HEX.blue} marker={mLight} />
          {back}
        </>
      );
      break;
    case 'structured_stripe':
      // Màn sọc đặt ở góc phản xạ gương: camera nhìn ảnh phản chiếu của sọc trên mặt bóng — móp làm sọc cong.
      drawing = (
        <>
          <g transform="rotate(-28 92 112)">
            <rect x={52} y={104} width={80} height={16} rx={2} className="fill-white stroke-slate-500 dark:fill-slate-800" strokeWidth={0.8} />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={56 + i * 20} y={106} width={10} height={12} className="fill-slate-700 dark:fill-slate-300" />
            ))}
          </g>
          <Rays rays={[[112, 126, 176, 197]]} color={ray} marker={mLight} />
          <Rays rays={[[182, TOP - 2, 182, 74]]} color={BACK} marker={mBack} dashed />
        </>
      );
      break;
    case 'line':
      // Đèn line hội tụ thành một vạch sáng hẹp ngay dưới camera line scan; vật chạy qua vạch.
      drawing = (
        <>
          <Lamp x={96} y={150} w={44} h={10} rotate={[-40, 118, 155]} />
          <Rays rays={[[132, 166, 178, 198], [124, 172, 176, 199, 0.6], [140, 160, 180, 197, 0.6]]} color={ray} marker={mLight} />
          <line x1={110} y1={228} x2={250} y2={228} className="stroke-slate-500" strokeWidth={1} markerEnd={`url(#${mBack})`} />
          {back}
        </>
      );
      break;
    case 'photometric_stereo':
      drawing = (
        <>
          <Lamp x={86} y={146} w={26} h={9} />
          <Lamp x={248} y={146} w={26} h={9} />
          <Lamp x={110} y={112} w={26} h={9} />
          <Lamp x={224} y={112} w={26} h={9} />
          {[
            [99, 140, '1'],
            [261, 140, '2'],
            [123, 106, '3'],
            [237, 106, '4'],
          ].map(([x, y, n]) => (
            <text key={n} x={x} y={y} textAnchor="middle" className="fill-slate-500 text-[11px] dark:fill-slate-400">
              {n}
            </text>
          ))}
          <Rays rays={[[110, 156, 166, 197]]} color={ray} marker={mLight} />
          <Rays rays={[[250, 156, 196, 197, 0.25], [130, 122, 170, 197, 0.25], [230, 122, 190, 197, 0.25]]} color={ray} marker={mLight} />
          {back}
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 360 240" className="mx-auto w-full max-w-md" role="img" aria-hidden="true">
      <defs>
        {ARROW(mLight)}
        {ARROW(mBack)}
      </defs>
      {/* Camera + ống kính */}
      <rect x={155} y={8} width={50} height={36} rx={4} className="fill-slate-200 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400" strokeWidth={0.8} />
      <rect x={166} y={44} width={28} height={28} rx={2} className="fill-slate-300 stroke-slate-500 dark:fill-slate-600 dark:stroke-slate-400" strokeWidth={0.8} />
      {/* Vật: tấm đế + chi tiết. Đèn nền: không đế, chi tiết hiện thành bóng. */}
      {backlit ? null : <rect x={60} y={212} width={240} height={10} className="fill-stone-300 stroke-stone-500 dark:fill-stone-600 dark:stroke-stone-400" strokeWidth={0.6} />}
      <rect
        x={backlit ? 130 : 110}
        y={TOP}
        width={backlit ? 100 : 140}
        height={12}
        className={backlit ? 'fill-stone-700 dark:fill-stone-900' : 'fill-stone-200 stroke-stone-500 dark:fill-stone-500 dark:stroke-stone-300'}
        strokeWidth={0.6}
      />
      {/* Vùng camera nhìn — nón nét chấm và vạch xanh trên mặt vật. */}
      <line x1={AXIS} y1={74} x2={FOV_L} y2={TOP - 1} className="stroke-sky-400" strokeWidth={0.8} strokeDasharray="1.5 3" />
      <line x1={AXIS} y1={74} x2={FOV_R} y2={TOP - 1} className="stroke-sky-400" strokeWidth={0.8} strokeDasharray="1.5 3" />
      <line x1={FOV_L} y1={TOP - 0.5} x2={FOV_R} y2={TOP - 0.5} className="stroke-sky-500" strokeWidth={2} />
      {drawing}
    </svg>
  );
}

/* ── Camera thấy gì (mô phỏng định tính) ── */

type ViewStyle = { bg: string; mark: string; markWidth: number; glare?: boolean; relief?: boolean; silhouette?: boolean; sideShade?: boolean; stripes?: boolean };

/** Nền và vết lỗi trông thế nào dưới từng kiểu đèn — theo tài liệu các hãng (xem phần tham khảo). */
const VIEW: Record<string, ViewStyle> = {
  darkfield: { bg: '#2C2C2A', mark: '#F1EFE8', markWidth: 2.4 },
  coaxial: { bg: '#F1EFE8', mark: '#2C2C2A', markWidth: 2.4 },
  dome: { bg: '#D3D1C7', mark: '#888780', markWidth: 2 },
  ring: { bg: '#B4B2A9', mark: '#5F5E5A', markWidth: 1.6, glare: true },
  bar: { bg: '#B4B2A9', mark: '#444441', markWidth: 2, sideShade: true },
  backlight: { bg: '#F1EFE8', mark: '#F1EFE8', markWidth: 2, silhouette: true },
  photometric_stereo: { bg: '#888780', mark: '#F1EFE8', markWidth: 2, relief: true },
  multi_angle_ring: { bg: '#C9C7BF', mark: '#2C2C2A', markWidth: 2 },
  structured_stripe: { bg: '#F1EFE8', mark: '#2C2C2A', markWidth: 2, stripes: true },
  line: { bg: '#B4B2A9', mark: '#2C2C2A', markWidth: 2, sideShade: true },
};

/** Hình "cần thấy gì" trong ô mô phỏng — nét đơn giản, đủ để nhận ra loại chi tiết. */
function FeatureMark({ feature, style }: { feature: string | null; style: ViewStyle }) {
  const c = style.mark;
  const w = style.markWidth;
  const line = { stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, fill: 'none' };
  switch (feature) {
    case 'scratch':
      return <path d="M54 96 L150 42" {...line} />;
    case 'crack_chip':
      return (
        <>
          <path d="M60 40 L78 58 L70 72 L90 92 L84 104" {...line} />
          <path d="M150 22 l12 0 l-6 12 z" fill={c} />
        </>
      );
    case 'dent_bump':
      return style.relief ? (
        <>
          <path d="M80 70 A20 20 0 0 1 120 70" stroke="#F1EFE8" strokeWidth={3} fill="none" />
          <path d="M80 70 A20 20 0 0 0 120 70" stroke="#2C2C2A" strokeWidth={3} fill="none" />
        </>
      ) : (
        <ellipse cx={100} cy={70} rx={22} ry={16} {...line} opacity={0.8} />
      );
    case 'burr':
      return <path d="M30 118 L170 118 M120 118 l6 -10 l6 10" {...line} />;
    case 'stain':
      return <ellipse cx={100} cy={70} rx={26} ry={16} fill={c} opacity={0.45} />;
    case 'particle':
      return (
        <>
          {[
            [70, 50],
            [112, 64],
            [96, 90],
            [134, 42],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill={c} />
          ))}
        </>
      );
    case 'void':
      return (
        <>
          {[
            [76, 56, 6],
            [110, 74, 9],
            [132, 50, 4],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} {...line} />
          ))}
        </>
      );
    case 'coating':
      return <path d="M70 50 Q90 40 110 54 T140 60 Q132 84 104 88 Q78 92 70 50 Z" fill={c} opacity={0.5} />;
    case 'print':
    case 'ink_label':
    case 'curved_print':
      return (
        <text x={100} y={80} textAnchor="middle" fontSize={30} fontWeight={700} fill={c} fontFamily="monospace">
          A1B2
        </text>
      );
    case 'wrinkle':
      return <path d="M40 60 q15 -12 30 0 t30 0 t30 0 t30 0 M40 84 q15 -12 30 0 t30 0 t30 0 t30 0" {...line} />;
    case 'solder':
      return (
        <>
          <rect x={60} y={58} width={80} height={24} rx={3} {...line} />
          <ellipse cx={56} cy={70} rx={10} ry={8} fill={c} />
          <ellipse cx={144} cy={70} rx={10} ry={8} fill={c} />
        </>
      );
    case 'raised':
    case 'flat_color':
    case 'shiny_part':
      return (
        <>
          <rect x={70} y={44} width={60} height={52} rx={4} fill={c} opacity={feature === 'flat_color' ? 0.6 : 0.9} />
          {feature === 'shiny_part' ? <ellipse cx={92} cy={58} rx={10} ry={5} fill="#FFFFFF" opacity={0.85} /> : null}
        </>
      );
    case 'hole':
      return <circle cx={100} cy={70} r={20} fill={style.silhouette ? '#F1EFE8' : c} />;
    case 'transparent_part':
      return <rect x={64} y={44} width={72} height={52} rx={10} {...line} />;
    case 'wire':
      return <path d="M30 100 C70 20, 130 120, 172 40" {...line} strokeWidth={w + 1.5} />;
    case 'outline':
      return style.silhouette ? null : <rect x={40} y={30} width={120} height={80} rx={4} {...line} />;
    case 'fiducial':
      return (
        <>
          <circle cx={100} cy={70} r={12} fill={c} />
          <circle cx={100} cy={70} r={22} {...line} />
        </>
      );
    case 'corner':
      return <path d="M60 40 L60 100 L140 100 M60 52 L72 40" {...line} />;
    case 'surface_edge':
      return <path d="M30 60 L100 60 L100 84 L170 84" {...line} />;
    case 'dpm':
      return (
        <>
          {Array.from({ length: 36 }, (_, i) => [i % 6, Math.floor(i / 6)])
            .filter(([x, y]) => (x * 7 + y * 3) % 4 !== 0)
            .map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={74 + x * 10} cy={44 + y * 10} r={3} fill={c} />
            ))}
        </>
      );
    case 'thread':
      // Ren nhìn dọc trục lỗ: các vòng đỉnh ren đồng tâm.
      return (
        <>
          {[30, 24, 18, 12].map((r) => (
            <circle key={r} cx={100} cy={70} r={r} {...line} />
          ))}
        </>
      );
    case 'color_match':
    case 'color_shading':
      return <rect x={56} y={40} width={88} height={60} rx={6} fill={c} opacity={0.35} />;
    default:
      return null;
  }
}

/** Ô "camera thấy gì" cho một kiểu đèn + loại lỗi. Luôn ghi "mô phỏng" ngay dưới (ở LightSelector). */
export function CameraView({ lightType, feature, finish }: { lightType: string; feature: string | null; finish: string | null }) {
  const style = VIEW[lightType] ?? VIEW.ring;
  // Điểm loá chỉ có trên bề mặt bóng — vòng / thanh chiếu lên giấy, nhựa mờ thì sáng đều.
  const glossy = finish === 'semi_gloss' || finish === 'mirror_flat' || finish === 'mirror_curved';
  return (
    <svg viewBox="0 0 200 140" className="w-full rounded-md" role="img" aria-hidden="true">
      <rect width={200} height={140} rx={6} fill={style.bg} />
      {style.sideShade ? <rect width={70} height={140} rx={6} fill="#D3D1C7" opacity={0.6} /> : null}
      {style.glare && glossy ? <ellipse cx={100} cy={70} rx={30} ry={14} fill="#F1EFE8" opacity={0.75} /> : null}
      {style.stripes
        ? [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={i * 30} y={0} width={15} height={140} fill="#2C2C2A" opacity={0.85} />)
        : null}
      {style.silhouette ? <rect x={30} y={22} width={140} height={96} rx={4} fill="#2C2C2A" /> : null}
      <FeatureMark feature={feature} style={style} />
    </svg>
  );
}

/* ── C. Nhìn từ trên: vùng nhìn + vệt đèn cùng tỉ lệ ── */

/** Vẽ khung vùng nhìn W × H (nét đứt) và vệt đèn cỡ `lightMm` theo kiểu đèn, chung một tỉ lệ. */
export function TopView({
  lightType,
  lightMm,
  lightShortMm,
  fovW,
  fovH,
  lightColor,
}: {
  lightType: string;
  lightMm: number;
  lightShortMm: number | null;
  fovW: number;
  fovH: number;
  lightColor: string;
}) {
  const W = 360;
  const H = 220;
  const pad = 16;
  const round = ['ring', 'dome', 'darkfield', 'multi_angle_ring'].includes(lightType);
  const barLike = lightType === 'bar' || lightType === 'line';
  const barShort = lightShortMm ?? Math.max(10, lightMm * 0.15);
  // Khung bao cả vùng nhìn lẫn đèn (đèn thanh nằm sát cạnh trên vùng nhìn).
  const spanW = Math.max(fovW, lightMm);
  const spanH = barLike ? fovH + barShort * 2 + 8 : Math.max(fovH, round || lightType !== 'photometric_stereo' ? lightMm : fovH);
  // Nhiều hướng: 4 đèn nằm NGOÀI vùng nhìn — chừa thêm chỗ.
  const room = lightType === 'photometric_stereo' ? 1.35 : 1;
  const scale = Math.min((W - 2 * pad) / (spanW * room), (H - 2 * pad) / (spanH * room));
  const cx = W / 2;
  const cy = barLike ? H / 2 + (barShort * scale) / 2 : H / 2;
  const fw = fovW * scale;
  const fh = fovH * scale;
  const L = lightMm * scale;
  const hex = RAY_HEX[lightColor] ?? RAY_HEX.white;
  const r1 = (v: number) => Math.round(v * 10) / 10;

  let light: ReactNode;
  if (round) {
    const ringWidth = lightType === 'dome' ? 0 : Math.max(6, L * 0.08);
    light =
      lightType === 'dome' ? (
        <circle cx={cx} cy={cy} r={r1(L / 2)} fill={hex} opacity={0.18} stroke={hex} strokeWidth={1.5} />
      ) : (
        <circle cx={cx} cy={cy} r={r1(L / 2 - ringWidth / 2)} fill="none" stroke={hex} strokeWidth={r1(ringWidth)} opacity={0.75} />
      );
  } else if (barLike) {
    const bh = barShort * scale;
    light = <rect x={r1(cx - L / 2)} y={r1(cy - fh / 2 - bh - 4)} width={r1(L)} height={r1(bh)} rx={2} fill={hex} opacity={0.75} />;
  } else if (lightType === 'photometric_stereo') {
    const s = Math.max(fw, fh) / 2 + 10;
    light = (
      <>
        {[
          [cx - s - 6, cy - 14, 6, 28],
          [cx + s, cy - 14, 6, 28],
          [cx - 14, cy - s - 6, 28, 6],
          [cx - 14, cy + s, 28, 6],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={r1(x)} y={r1(y)} width={w} height={h} rx={2} fill={hex} opacity={0.75} />
        ))}
      </>
    );
  } else {
    // Đồng trục, đèn nền: ô sáng vuông cạnh L dưới / quanh vùng nhìn.
    light = <rect x={r1(cx - L / 2)} y={r1(cy - L / 2)} width={r1(L)} height={r1(L)} rx={3} fill={hex} opacity={0.18} stroke={hex} strokeWidth={1.5} />;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-md" role="img" aria-hidden="true">
      {light}
      <rect
        x={r1(cx - fw / 2)}
        y={r1(cy - fh / 2)}
        width={r1(fw)}
        height={r1(fh)}
        fill="none"
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeWidth={1.2}
        strokeDasharray="5 3"
      />
      <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} className="stroke-slate-500" strokeWidth={0.8} />
      <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} className="stroke-slate-500" strokeWidth={0.8} />
    </svg>
  );
}
