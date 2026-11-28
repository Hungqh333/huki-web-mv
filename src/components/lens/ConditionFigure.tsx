'use client';

import type { CSSProperties, ReactNode } from 'react';
import { buildScene } from './conditionScene';

/**
 * Hình bước 2 "Điều kiện làm việc" của trang Chọn ống kính: camera → ống kính → vùng nhìn,
 * các ô nhập đặt NGAY TRÊN hình (cách trình bày theo Lens Selector của Hikrobot, chốt
 * 2026-11-28 Q1–Q7). Hình vẽ lại bằng SVG — không dùng ảnh hay logo của hãng.
 *
 * Màn rộng (≥ lg): ô đặt tuyệt đối theo % trên khung tỉ lệ 1200 × 540.
 * Màn hẹp: hình thu nhỏ ở trên, ô xếp lưới bên dưới (Q7-A).
 */

/** Tông ô theo Hik: cam = phía ống kính, xanh = phía vật, trắng = số camera/khoảng cách, xám = chỉ xem. */
export type FieldTone = 'lens' | 'object' | 'plain' | 'info';

const TONE: Record<FieldTone, { box: string; label: string }> = {
  lens: {
    box: 'border-[#B01300] bg-[#FFD8C1] dark:border-[#E0703A] dark:bg-[#4A2412]',
    label: 'text-[#BE4C00] dark:text-[#FFB48A]',
  },
  object: {
    box: 'border-[#0045AE] bg-[#D2EBFF] dark:border-[#4B8FD6] dark:bg-[#0D2A45]',
    label: 'text-[#005493] dark:text-[#9CCBFF]',
  },
  plain: {
    box: 'border-[#B3B3B3] bg-white dark:border-slate-600 dark:bg-slate-900',
    label: 'text-[#4D4D4D] dark:text-slate-300',
  },
  info: {
    box: 'border-[#A4A4A4] bg-[#F0F0F0] dark:border-slate-600 dark:bg-slate-800',
    label: 'text-[#4D4D4D] dark:text-slate-300',
  },
};

/** Vị trí ô trên khung rộng, % theo chiều ngang / dọc của hình. */
export type FieldPos = { x: number; y: number };

export function FigureField({
  id,
  label,
  value,
  tone,
  pos,
  typed = false,
  readOnly = false,
  onChange,
  title,
}: {
  id: string;
  label: string;
  value: string;
  tone: FieldTone;
  pos: FieldPos;
  /** Số anh gõ (chữ đậm) — ngược lại là số máy tính ra (chữ nghiêng, nhạt). */
  typed?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  title?: string;
}) {
  const style = { '--fx': `${pos.x}%`, '--fy': `${pos.y}%` } as CSSProperties;
  const text = typed
    ? 'font-semibold text-slate-900 dark:text-slate-50'
    : 'italic text-slate-500 dark:text-slate-400';
  return (
    <div style={style} className="lg:absolute lg:left-[var(--fx)] lg:top-[var(--fy)] lg:w-[11.7%]">
      <label htmlFor={id} className={`block text-sm font-medium leading-tight lg:whitespace-nowrap ${TONE[tone].label}`}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        readOnly={readOnly}
        title={title}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        // Ô đang hiện số tính ra: bấm vào là chọn hết, gõ đè luôn (giống Hik).
        onFocus={(e) => {
          if (!readOnly && !typed) e.currentTarget.select();
        }}
        className={`mt-1 h-8 w-full rounded-[2px] border px-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#F76A05]/40 ${TONE[tone].box} ${readOnly ? 'cursor-default' : ''} ${text}`}
      />
    </div>
  );
}

const SCENE = { fixed: buildScene(false), telecentric: buildScene(true) };

const FACE_FILL: Record<'top' | 'front' | 'side' | 'back', string> = {
  top: '#4A4A4A',
  front: 'url(#cf-face)',
  side: '#1C1C1C',
  back: '#2C2C2C',
};

export function ConditionFigure({ telecentric, lineScan, children }: { telecentric: boolean; lineScan: boolean; children: ReactNode }) {
  // Cảnh 3D chiếu phối cảnh (conditionScene): camera nằm trên trục quang, tự nghiêng theo hướng chiếu.
  const sc = SCENE[telecentric ? 'telecentric' : 'fixed'];
  return (
    <div className="relative lg:aspect-[1200/540]">
      <svg viewBox="0 70 1200 540" className="mx-auto block w-full max-w-xl lg:absolute lg:inset-0 lg:h-full lg:max-w-none" aria-hidden="true">
        <defs>
          <marker id="cf-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 1 L10 5 L0 9 z" fill="#1C8BE6" />
          </marker>
          <marker id="cf-wd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 1 L10 5 L0 9 z" className="fill-slate-800 dark:fill-slate-200" />
          </marker>
          <marker id="cf-arc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#F06A0F" />
          </marker>
          <linearGradient id="cf-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3A3A3A" />
            <stop offset="1" stopColor="#202020" />
          </linearGradient>
          {sc.lens.parts.map((part, i) => (
            <linearGradient key={i} id={`cf-barrel-${i}`} gradientUnits="userSpaceOnUse" {...part.shade}>
              <stop offset="0" stopColor="#5A5A5A" />
              <stop offset="0.35" stopColor="#2E2E2E" />
              <stop offset="1" stopColor="#111111" />
            </linearGradient>
          ))}
        </defs>

        {/* Chùm tia: nền cam nhạt + 3 tia (cách vẽ của Hik) */}
        <path d={sc.beam} fill="#F76A05" fillOpacity="0.14" />
        {/* Mặt vùng nhìn — vuông góc trục quang; vẽ sau nền chùm tia, trước 3 tia (như Hik) */}
        <path d={sc.plane} className="fill-[#4F647D] dark:fill-[#6B829C]" />
        <g stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="5 5" fill="none">
          <path d={sc.cross[0]} />
          <path d={sc.cross[1]} />
        </g>
        {lineScan ? <path d={sc.lineScan} stroke="#F76A05" strokeWidth="4" fill="none" /> : null}

        <g stroke="#F07A2A" strokeWidth="1.5" fill="none">
          {sc.rays.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* Góc ngang: giữa 2 tia tới cạnh trên; góc dọc: giữa 2 tia tới cạnh phải */}
        {!telecentric ? (
          <g stroke="#F06A0F" strokeWidth="2.5" fill="none" strokeLinecap="round" markerStart="url(#cf-arc)" markerEnd="url(#cf-arc)">
            <path d={sc.angleH} />
            <path d={sc.angleV} />
          </g>
        ) : null}

        {/* Kích thước vùng nhìn: rộng theo cạnh trên, cao theo cạnh phải */}
        <g stroke="#1C8BE6" strokeWidth="2" fill="none">
          <path d={sc.widthDim} markerStart="url(#cf-dim)" markerEnd="url(#cf-dim)" />
          <path d={sc.heightDim} markerStart="url(#cf-dim)" markerEnd="url(#cf-dim)" />
          {[...sc.widthTicks, ...sc.heightTicks].map((d, i) => (
            <path key={i} d={d} strokeWidth="1.2" />
          ))}
        </g>

        {/* Khoảng cách làm việc: mặt trước ống → mặt vật, dưới trục quang */}
        <g className="stroke-slate-800 dark:stroke-slate-200" strokeWidth="1.3" fill="none">
          <path d={sc.wdDim} markerStart="url(#cf-wd)" markerEnd="url(#cf-wd)" />
          {sc.wdTicks.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <path d={sc.wdGuide} strokeDasharray="3 4" strokeOpacity="0.6" />
        </g>

        {/* Ống kính (vẽ trước thân camera) — tự vẽ, không chữ, không logo */}
        {sc.lens.parts.map((part, i) => (
          <path key={i} d={part.outline} fill={`url(#cf-barrel-${i})`} stroke="#0E0E0E" strokeWidth="0.8" strokeLinejoin="round" />
        ))}
        <g stroke="#0A0A0A" strokeWidth="3" fill="none">
          {sc.lens.rings.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <path d={sc.lens.rim} stroke="#6A6A6A" strokeWidth="2" fill="none" />
        {/* Thân camera — gần mắt hơn ống kính nên vẽ sau (che chân ống) */}
        {sc.faces.map((f, i) => (
          <path key={i} d={f.d} fill={FACE_FILL[f.tone]} stroke="#111" strokeWidth="0.8" strokeLinejoin="round" />
        ))}
        <path d={sc.frontBezel} fill="none" stroke="#4E4E4E" strokeWidth="1.5" />
        {sc.connectors.map((d, i) => (
          <path key={i} d={d} fill="#0E0E0E" stroke="#5A5A5A" strokeWidth="1.2" />
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-0 lg:block">{children}</div>
    </div>
  );
}
