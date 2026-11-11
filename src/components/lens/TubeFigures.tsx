"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NOTE_CLASS } from "@/components/ui/PanelHeader";
import {
  STANDARD_TUBE_LENGTHS_MM,
  tubeFigure,
  type TubeFigure,
} from "@/lib/vision/lensSelector";

/**
 * Hình kiểm tra lắp đặt (chốt 2026-11-11 Q5 vòng 2, Q1–Q6 như đề xuất; vòng 3 Q1-B: chuyển khỏi Chi tiết
 * của Chọn ống kính sang trang riêng /kiem-tra-lap-dat):
 *   H1 sơ đồ tia Newton, H2 thanh độ đẩy ra = ống nối + ren — chỉ admin (lộ mô hình Newton, Q2);
 *   H3 dải WD lấy nét, H5 vùng nhìn cần / thực, dòng "Ren cần vặn" — Member+.
 *   Thanh trượt WD, e cho mọi người xem trang; sF chỉ admin (Q3). Chỉ đổi hình trong khung này, không đổi ô nhập.
 *   H4 (bảng quét sF) bỏ, thay bằng dòng "ước tính" trên tiêu đề (Q5).
 * Không tính gì ở đây: số đến từ `tubeFigure` (lensSelector.ts, cùng công thức OPT-001/OPT-010).
 */

export type TubeFiguresProps = {
  focalMm: number;
  /** sF đã khai; null = chưa khai (hình dùng 0, ghi "ước tính"). */
  frontFocalMm: number | null;
  frontFocalApprox: boolean;
  modMm: number | null;
  wdMm: number;
  tubeMm: number;
  converterFactor: number;
  sensorLongMm: number;
  sensorShortMm: number | null;
  /** Vùng nhìn cần; null = chưa nhập → không vẽ H5. */
  needLongMm: number | null;
  needShortMm: number | null;
  /** Ngưỡng độ dư lấy nét đang chạy (tubeFocusMarginWarn). */
  marginWarn: number;
  /** Admin: thấy H1, H2 và thanh sF. */
  admin: boolean;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const show = (v: number, digits = 1) =>
  String(Math.round(v * 10 ** digits) / 10 ** digits);
const TEXT = "fill-slate-700 dark:fill-slate-200";
const MUTED = "fill-slate-500 dark:fill-slate-400";
const HALO = "stroke-white dark:stroke-slate-900";
const DIM = "stroke-slate-500 dark:stroke-slate-400";
const FONT = 11;
/** Ước lượng bề rộng chữ cỡ 11 (px) — đủ để quyết định nhãn nằm trong hay ra ngoài đoạn. */
const textWidth = (s: string) => s.length * 6.2;

function Label({
  x,
  y,
  children,
  anchor = "middle",
  className = TEXT,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
  className?: string;
}) {
  return (
    <text
      x={r1(x)}
      y={r1(y)}
      textAnchor={anchor}
      fontSize={FONT}
      strokeWidth={3}
      paintOrder="stroke"
      strokeLinejoin="round"
      className={`${className} ${HALO}`}
    >
      {children}
    </text>
  );
}

/** Đường kích thước không mũi tên, hai vạch đầu (chuẩn hình sổ tay). Nhãn không vừa thì xuống hàng dự phòng. */
function Dim({
  x1,
  x2,
  y,
  label,
  spareY,
  width,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  spareY: number;
  width: number;
}) {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  const w = textWidth(label);
  const fits = b - a >= w + 6;
  const cx = fits
    ? (a + b) / 2
    : Math.min(Math.max((a + b) / 2, w / 2 + 2), width - w / 2 - 2);
  return (
    <g>
      <line
        x1={r1(a)}
        y1={y}
        x2={r1(b)}
        y2={y}
        strokeWidth={1}
        className={DIM}
      />
      <line
        x1={r1(a)}
        y1={y - 4}
        x2={r1(a)}
        y2={y + 4}
        strokeWidth={1}
        className={DIM}
      />
      <line
        x1={r1(b)}
        y1={y - 4}
        x2={r1(b)}
        y2={y + 4}
        strokeWidth={1}
        className={DIM}
      />
      <Label x={cx} y={fits ? y - 4 : spareY}>
        {label}
      </Label>
    </g>
  );
}

/** Đường cắt gấp khúc dọc từ y1 xuống y2 tại x. */
function zigzag(x: number, y1: number, y2: number): string {
  let d = `M${x} ${y1}`;
  for (let y = y1, i = 0; y < y2; y += 8, i++) d += ` L${i % 2 === 0 ? x + 4 : x} ${Math.min(y + 8, y2)}`;
  return d;
}

/** H1 — tia Newton. Trục ngang đúng tỉ lệ mm; phía vật dài quá thì cắt (ký hiệu ≈). Thân ống, khoảng H–H′ minh hoạ. */
function NewtonFigure({
  fig,
  f,
  sF,
  wd,
}: {
  fig: TubeFigure;
  f: number;
  sF: number;
  wd: number;
}) {
  const t = useTranslations("lensSelector.figures");
  const W = 640;
  const AXIS = 92;
  const hGap = 0.2 * f; // khoảng H–H′ minh hoạ
  // Toạ độ mm dọc trục, gốc tại vật.
  const F = fig.xMm;
  const glass = wd;
  const H = F + f;
  const H2 = H + hGap;
  const F2 = H2 + f;
  const sensor = F2 + fig.xPrimeMm;
  const lensLeft = Math.min(F, glass);
  const imgSpan = sensor - lensLeft;
  const broken = fig.xMm > 1.2 * imgSpan;
  const start = broken ? lensLeft - 0.12 * imgSpan : 0;
  const breakL = 66;
  const breakR = 84;
  const x0 = broken ? breakR + 8 : 28;
  const right = W - 64; // chừa chỗ thân camera
  const s = (right - x0) / (sensor - start);
  const X = (mm: number) => (broken && mm < start ? 28 : x0 + (mm - start) * s);
  const objX = 28;
  const Y = 46 / Math.max(1, fig.beta); // chiều cao vật (px), ảnh = β × Y
  const img = fig.beta * Y;
  // Tia 1: vật → F → song song sau H. Tia 2: song song tới H′ → qua F′ → cảm biến.
  // Trục cắt: trước chỗ cắt tia nhắm thẳng F trên hình, sau chỗ cắt đúng độ cao thật — chỗ cắt che bằng nền.
  const h1At = (mm: number) => (Y * (fig.xMm - mm)) / fig.xMm;
  const preBreak = (px: number) => (Y * (X(F) - px)) / (X(F) - objX);
  const ray1 = broken
    ? [
        [objX, AXIS - Y],
        [breakL + 4, AXIS - preBreak(breakL + 4)],
        [breakR, AXIS - h1At(start - (x0 - breakR) / s)],
        [X(F), AXIS],
        [X(H), AXIS + img],
        [X(sensor), AXIS + img],
      ]
    : [
        [objX, AXIS - Y],
        [X(F), AXIS],
        [X(H), AXIS + img],
        [X(sensor), AXIS + img],
      ];
  const ray2 = [
    [objX, AXIS - Y],
    [X(H2), AXIS - Y],
    [X(F2), AXIS],
    [X(sensor), AXIS + img],
  ];
  const pts = (p: number[][]) =>
    p.map(([a, b]) => `${r1(a)},${r1(b)}`).join(" ");
  const bodyL = X(glass);
  const bodyR = Math.max(X(glass + 0.3 * f), X(F2 - 0.45 * f));
  const point = (mm: number, name: string, below = true) => (
    <g>
      <circle
        cx={r1(X(mm))}
        cy={AXIS}
        r={2.5}
        className="fill-slate-800 dark:fill-slate-100"
      />
      <Label x={X(mm) + 4} y={below ? AXIS + 14 : AXIS - 6} anchor="start">
        {name}
      </Label>
    </g>
  );
  const sFLabel = `sF ${show(sF)}`;
  return (
    <svg
      viewBox={`0 0 ${W} 252`}
      className="h-auto w-full min-w-[34rem]"
      role="img"
      aria-label={t("h1Title")}
    >
      {/* thân ống minh hoạ */}
      <rect
        x={r1(bodyL)}
        y={AXIS - 30}
        width={r1(Math.max(bodyR - bodyL, 6))}
        height={60}
        rx={4}
        className="fill-slate-300/40 stroke-slate-400 dark:fill-slate-600/40 dark:stroke-slate-500"
        strokeWidth={1}
      />
      <line
        x1={r1(bodyL)}
        y1={AXIS - 30}
        x2={r1(bodyL)}
        y2={AXIS + 30}
        strokeWidth={2.5}
        className="stroke-sky-500"
      />
      {/* camera + cảm biến */}
      <rect
        x={r1(X(sensor))}
        y={AXIS - 34}
        width={44}
        height={68}
        rx={3}
        className="fill-slate-200 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400"
        strokeWidth={1}
      />
      <line
        x1={r1(X(sensor))}
        y1={AXIS - 30}
        x2={r1(X(sensor))}
        y2={AXIS + 30}
        strokeWidth={3}
        className="stroke-indigo-500"
      />
      {/* trục */}
      <line
        x1={20}
        y1={AXIS}
        x2={W - 16}
        y2={AXIS}
        strokeDasharray="4 3"
        strokeWidth={1}
        className="stroke-slate-400 dark:stroke-slate-500"
      />
      {/* mặt chính H, H′ */}
      {[
        [H, "H"],
        [H2, "H′"],
      ].map(([mm, name]) => (
        <g key={name as string}>
          <line
            x1={r1(X(mm as number))}
            y1={AXIS - 52}
            x2={r1(X(mm as number))}
            y2={AXIS + 52}
            strokeDasharray="3 3"
            strokeWidth={1}
            className="stroke-slate-500 dark:stroke-slate-400"
          />
          <Label x={X(mm as number)} y={AXIS - 56}>
            {name as string}
          </Label>
        </g>
      ))}
      {/* vật, ảnh */}
      <line
        x1={objX}
        y1={AXIS}
        x2={objX}
        y2={r1(AXIS - Y)}
        strokeWidth={2}
        className="stroke-slate-800 dark:stroke-slate-100"
      />
      <Label x={objX} y={AXIS - Y - 6}>
        {t("object")}
      </Label>
      <line
        x1={r1(X(sensor))}
        y1={AXIS}
        x2={r1(X(sensor))}
        y2={r1(AXIS + img)}
        strokeWidth={2}
        className="stroke-slate-800 dark:stroke-slate-100"
      />
      <Label x={X(sensor) + 22} y={AXIS - 40}>
        {t("sensor")}
      </Label>
      {/* tia */}
      <polyline
        points={pts(ray1)}
        fill="none"
        strokeWidth={1.5}
        className="stroke-emerald-600 dark:stroke-emerald-400"
      />
      <polyline
        points={pts(ray2)}
        fill="none"
        strokeWidth={1.5}
        className="stroke-orange-500 dark:stroke-orange-400"
      />
      {broken ? (
        <g>
          <rect x={breakL + 4} y={AXIS - 60} width={breakR - breakL - 4} height={114} className="fill-white dark:fill-slate-900" />
          <path d={zigzag(breakL + 4, AXIS - 60, AXIS + 54)} fill="none" strokeWidth={1} className={DIM} />
          <path d={zigzag(breakR, AXIS - 60, AXIS + 54)} fill="none" strokeWidth={1} className={DIM} />
        </g>
      ) : null}
      {point(F, "F")}
      {point(F2, "F′")}
      {/* kích thước: hàng 1 x, f, f, x′; hàng 2 WD, sF; nhãn không vừa xuống hàng 3 */}
      <Dim
        x1={objX}
        x2={X(F)}
        y={168}
        spareY={244}
        width={W}
        label={`x ${show(fig.xMm)}`}
      />
      <Dim
        x1={X(F)}
        x2={X(H)}
        y={168}
        spareY={244}
        width={W}
        label={`f ${show(f)}`}
      />
      <Dim
        x1={X(H2)}
        x2={X(F2)}
        y={168}
        spareY={244}
        width={W}
        label={`f ${show(f)}`}
      />
      <Dim
        x1={X(F2)}
        x2={X(sensor)}
        y={168}
        spareY={244}
        width={W}
        label={`x′ ${show(fig.xPrimeMm)}`}
      />
      <Dim
        x1={objX}
        x2={X(glass)}
        y={196}
        spareY={244}
        width={W}
        label={`WD ${show(wd)}`}
      />
      {Math.abs(sF) > 1e-9 ? (
        <Dim
          x1={X(glass)}
          x2={X(F)}
          y={220}
          spareY={244}
          width={W}
          label={sFLabel}
        />
      ) : null}
    </svg>
  );
}

/** H2 — độ đẩy ra x′ = ống nối e + ren; vạch e + ren tối đa; đỏ khi thừa / thiếu. */
function PushFigure({ fig, e }: { fig: TubeFigure; e: number }) {
  const t = useTranslations("lensSelector.figures");
  const W = 640;
  const L = 20;
  const R = W - 20;
  const reach = fig.ringMaxMm !== null ? e + fig.ringMaxMm : null;
  const max = Math.max(fig.xPrimeMm, e, reach ?? 0) * 1.08 || 1;
  const X = (mm: number) => L + ((R - L) * mm) / max;
  const top = 36;
  const h = 20;
  const ringEnd =
    fig.ringStatus === "high" && reach !== null ? reach : fig.xPrimeMm;
  const seg = (a: number, b: number, cls: string, label: string | null) => {
    if (!(b - a > 1e-9)) return null;
    const w = X(b) - X(a);
    return (
      <g>
        <rect
          x={r1(X(a))}
          y={top}
          width={r1(w)}
          height={h}
          strokeWidth={1}
          className={cls}
        />
        {label && w > textWidth(label) + 6 ? (
          <Label x={(X(a) + X(b)) / 2} y={top + 14}>
            {label}
          </Label>
        ) : null}
      </g>
    );
  };
  const RED =
    "fill-red-300/70 stroke-red-600 dark:fill-red-800/70 dark:stroke-red-400";
  const tubeLabel = t("pushTube", { v: show(e) });
  const ringLabel = t("pushRing", { v: show(Math.max(fig.ringMm, 0)) });
  return (
    <svg
      viewBox={`0 0 ${W} 104`}
      className="h-auto w-full min-w-[34rem]"
      role="img"
      aria-label={t("h2Title")}
    >
      <line
        x1={L}
        y1={top - 8}
        x2={L}
        y2={top + h + 8}
        strokeWidth={1.5}
        className="stroke-slate-700 dark:stroke-slate-200"
      />
      {seg(
        0,
        Math.min(e, fig.xPrimeMm),
        "fill-amber-300 stroke-amber-700 dark:fill-amber-700 dark:stroke-amber-300",
        tubeLabel,
      )}
      {fig.ringStatus === "low" ? seg(fig.xPrimeMm, e, RED, null) : null}
      {fig.ringMm > 0
        ? seg(
            e,
            ringEnd,
            "fill-sky-300 stroke-sky-700 dark:fill-sky-700 dark:stroke-sky-300",
            ringLabel,
          )
        : null}
      {fig.ringStatus === "high" && reach !== null
        ? seg(reach, fig.xPrimeMm, RED, null)
        : null}
      {/* x′ cần */}
      <line
        x1={r1(X(fig.xPrimeMm))}
        y1={top - 12}
        x2={r1(X(fig.xPrimeMm))}
        y2={top + h + 4}
        strokeWidth={2}
        className="stroke-slate-900 dark:stroke-slate-50"
      />
      <Label
        x={X(fig.xPrimeMm)}
        y={top - 16}
        anchor={X(fig.xPrimeMm) > W - 80 ? "end" : "middle"}
      >
        {t("pushNeed", { v: show(fig.xPrimeMm) })}
      </Label>
      {reach !== null ? (
        <g>
          <line
            x1={r1(X(reach))}
            y1={top - 4}
            x2={r1(X(reach))}
            y2={top + h + 12}
            strokeDasharray="3 2"
            strokeWidth={1.5}
            className="stroke-sky-700 dark:stroke-sky-300"
          />
          <Label
            x={X(reach)}
            y={top + h + 26}
            anchor={
              X(reach) > W - 120 ? "end" : X(reach) < 120 ? "start" : "middle"
            }
            className={MUTED}
          >
            {t("pushReach", { v: show(reach) })}
          </Label>
        </g>
      ) : null}
      <Label x={L} y={top + h + 26} anchor="start" className={MUTED}>
        {"0 (F′)"}
      </Label>
    </svg>
  );
}

/** H3 — trục WD: dải nét không ống (xám), có ống (xanh), vạch đỏ tại WD. */
function FocusFigure({
  fig,
  e,
  wd,
  mod,
}: {
  fig: TubeFigure;
  e: number;
  wd: number;
  mod: number | null;
}) {
  const t = useTranslations("lensSelector.figures");
  const W = 440;
  const L = 20;
  const R = W - 20;
  const focus = fig.focus!;
  const D = Math.max(wd * 1.8, focus.wdMinMm * 1.15, (mod ?? 0) * 1.15);
  const X = (mm: number) => L + ((R - L) * Math.min(mm, D)) / D;
  const band = (
    y: number,
    a: number,
    b: number,
    cls: string,
    label: string,
  ) => {
    const x1 = X(a);
    const x2 = X(b);
    const w = textWidth(label);
    const inside = x2 - x1 >= w + 8;
    const lx = inside ? (x1 + x2) / 2 : x1 - 6 > w ? x1 - 6 : x2 + 6;
    return (
      <g>
        <rect
          x={r1(x1)}
          y={y}
          width={r1(Math.max(x2 - x1, 2))}
          height={18}
          rx={3}
          className={cls}
        />
        <Label
          x={lx}
          y={y + 13}
          anchor={inside ? "middle" : x1 - 6 > w ? "end" : "start"}
        >
          {label}
        </Label>
      </g>
    );
  };
  const far = (v: number) => (Number.isFinite(v) ? show(v) : "∞");
  const wdX = X(wd);
  return (
    <svg
      viewBox={`0 0 ${W} 112`}
      className="h-auto w-full min-w-[26rem]"
      role="img"
      aria-label={t("h3Title")}
    >
      {mod !== null
        ? band(
            10,
            mod,
            Infinity,
            "fill-slate-300 dark:fill-slate-600",
            t("focusNoTube", { mod: show(mod), far: "∞" }),
          )
        : null}
      {e > 0
        ? band(
            36,
            focus.wdMinMm,
            focus.wdMaxMm,
            "fill-sky-300 dark:fill-sky-700",
            t("focusTube", {
              e: show(e),
              near: show(focus.wdMinMm),
              far: far(focus.wdMaxMm),
            }),
          )
        : null}
      <line x1={L} y1={70} x2={R} y2={70} strokeWidth={1} className={DIM} />
      <Label x={L} y={86} anchor="start" className={MUTED}>
        0
      </Label>
      <Label x={R} y={86} anchor="end" className={MUTED}>
        {`${show(D, 0)} mm →`}
      </Label>
      <line
        x1={r1(wdX)}
        y1={4}
        x2={r1(wdX)}
        y2={76}
        strokeWidth={2}
        className="stroke-red-600 dark:stroke-red-400"
      />
      <Label
        x={wdX}
        y={100}
        anchor={wdX > W - 60 ? "end" : wdX < 60 ? "start" : "middle"}
        className="fill-red-700 dark:fill-red-300"
      >
        {`WD ${show(wd)}`}
      </Label>
    </svg>
  );
}

/** H5 — khung vùng nhìn cần (nét đứt) chồng khung vùng nhìn thực (nét liền). Line scan: chỉ bề rộng. */
function FovFigure({
  fig,
  needLong,
  needShort,
}: {
  fig: TubeFigure;
  needLong: number;
  needShort: number | null;
}) {
  const t = useTranslations("lensSelector.figures");
  const W = 300;
  const H = 150;
  const line = fig.fovShortMm === null || needShort === null;
  const maxW = Math.max(fig.fovLongMm, needLong);
  const maxH = line ? 1 : Math.max(fig.fovShortMm!, needShort!);
  const s = line ? 260 / maxW : Math.min(260 / maxW, 110 / maxH);
  const rect = (w: number, h: number, cls: string, dash?: string) => (
    <rect
      x={r1((W - w * s) / 2)}
      y={r1(line ? 60 - h / 2 : (124 - h * s) / 2 + 4)}
      width={r1(w * s)}
      height={r1(line ? h : h * s)}
      fill="none"
      strokeWidth={dash ? 1.5 : 2}
      strokeDasharray={dash}
      className={cls}
    />
  );
  const actualCls = fig.fovTooSmall
    ? "stroke-red-600 dark:stroke-red-400"
    : "stroke-sky-600 dark:stroke-sky-400";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-sm"
      role="img"
      aria-label={t("h5Title")}
    >
      {line
        ? rect(fig.fovLongMm, 24, actualCls)
        : rect(fig.fovLongMm, fig.fovShortMm!, actualCls)}
      {line
        ? rect(needLong, 12, "stroke-slate-700 dark:stroke-slate-200", "5 3")
        : rect(
            needLong,
            needShort!,
            "stroke-slate-700 dark:stroke-slate-200",
            "5 3",
          )}
      <Label
        x={W / 2}
        y={H - 18}
        className={
          fig.fovTooSmall
            ? "fill-red-700 dark:fill-red-300"
            : "fill-sky-700 dark:fill-sky-300"
        }
      >
        {line
          ? t("fovActualLine", { w: show(fig.fovLongMm) })
          : t("fovActual", {
              w: show(fig.fovLongMm),
              h: show(fig.fovShortMm!),
            })}
      </Label>
      <Label x={W / 2} y={H - 4}>
        {line
          ? t("fovNeedLine", { w: show(needLong) })
          : t("fovNeed", { w: show(needLong), h: show(needShort!) })}
      </Label>
    </svg>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  list,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  list?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        <span>{label}</span>
        <span className="tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
          {show(value)}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        list={list}
        onChange={(ev) => onChange(Number(ev.target.value))}
        className="mt-1 w-full accent-sky-600"
      />
    </div>
  );
}

function Frame({
  title,
  badge,
  children,
  note,
}: {
  title: string;
  badge?: string | null;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <figure className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <figcaption className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
        {badge ? (
          <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
            {badge}
          </span>
        ) : null}
      </figcaption>
      {/* Điện thoại: hình giữ cỡ chữ đọc được, cuộn ngang trong khung. */}
      <div className="overflow-x-auto">{children}</div>
      {note}
    </figure>
  );
}

export function TubeFigures(props: TubeFiguresProps) {
  const t = useTranslations("lensSelector.figures");
  const uid = useId();
  const sF0 = props.frontFocalMm ?? 0;
  const [wd, setWd] = useState(props.wdMm);
  const [e, setE] = useState(props.tubeMm);
  const [sF, setSF] = useState(sF0);
  const moved = wd !== props.wdMm || e !== props.tubeMm || sF !== sF0;
  const fig = tubeFigure({
    focalMm: props.focalMm,
    frontFocalMm: sF,
    modMm: props.modMm,
    wdMm: wd,
    tubeMm: e,
    converterFactor: props.converterFactor,
    sensorLongMm: props.sensorLongMm,
    sensorShortMm: props.sensorShortMm,
    // Chưa nhập vùng nhìn cần: 0 → không bao giờ "nhỏ hơn cần", H5 ẩn.
    needLongMm: props.needLongMm ?? 0,
    needShortMm: props.needLongMm === null ? null : props.needShortMm,
  });
  // "Ước tính" khi sF đang dùng không phải số khai thật (Q5).
  const badge =
    sF !== sF0
      ? t("trialSf", { v: show(sF) })
      : props.frontFocalMm === null
        ? t("estimate")
        : props.frontFocalApprox
          ? t("estimateApprox", { v: show(sF0) })
          : null;
  const wdStep = props.wdMm < 50 ? 0.5 : 1;
  const wdMin = Math.max(
    wdStep,
    Math.floor((props.wdMm * 0.5) / wdStep) * wdStep,
  );
  const wdMax = Math.ceil((props.wdMm * 2) / wdStep) * wdStep;
  const eMax = Math.max(props.focalMm, props.tubeMm);
  const tubeList = `${uid}-tubes`;
  const marginLow =
    fig?.margin !== null &&
    fig?.margin !== undefined &&
    fig.margin < props.marginWarn - 1e-9;
  const outside =
    fig !== null &&
    fig.focus !== null &&
    (wd < fig.focus.wdMinMm - 1e-9 || wd > fig.focus.wdMaxMm + 1e-9);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("title")}
        </h4>
        {moved ? (
          <button
            type="button"
            onClick={() => {
              setWd(props.wdMm);
              setE(props.tubeMm);
              setSF(sF0);
            }}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            {t("reset")}
          </button>
        ) : null}
      </div>
      <div
        className={`grid gap-x-6 gap-y-3 ${props.admin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <Slider
          id={`${uid}-wd`}
          label={t("sliderWd")}
          value={wd}
          min={wdMin}
          max={wdMax}
          step={wdStep}
          onChange={setWd}
        />
        <Slider
          id={`${uid}-e`}
          label={t("sliderTube")}
          value={e}
          min={0}
          max={eMax}
          step={0.5}
          list={tubeList}
          onChange={setE}
        />
        {props.admin ? (
          <Slider
            id={`${uid}-sf`}
            label={t("sliderSf")}
            value={sF}
            min={-props.focalMm}
            max={props.focalMm}
            step={0.5}
            onChange={setSF}
          />
        ) : null}
      </div>
      <datalist id={tubeList}>
        {STANDARD_TUBE_LENGTHS_MM.filter((v) => v <= eMax).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {moved ? <p className={NOTE_CLASS}>{t("trialNote")}</p> : null}
      {fig === null ? (
        <p className="text-sm text-red-700 dark:text-red-300">{t("e01")}</p>
      ) : (
        <>
          <dl className="grid gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 sm:grid-cols-3 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("ring")}
              </dt>
              <dd
                className={`text-sm tabular-nums ${fig.ringStatus === "low" || fig.ringStatus === "high" ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-slate-100"}`}
              >
                {fig.ringStatus === "unknown"
                  ? t("ringNoMod", { ring: show(fig.ringMm) })
                  : t("ringValue", {
                      ring: show(Math.max(fig.ringMm, 0)),
                      max: show(fig.ringMaxMm!),
                    })}
                {fig.ringStatus === "low"
                  ? ` · ${t("ringLow")}`
                  : fig.ringStatus === "high"
                    ? ` · ${t("ringHigh")}`
                    : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("betaSystem")}
              </dt>
              <dd className="text-sm tabular-nums text-slate-900 dark:text-slate-100">
                {show(fig.betaSystem, 4)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("fovReal")}
              </dt>
              <dd
                className={`text-sm tabular-nums ${fig.fovTooSmall ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-slate-100"}`}
              >
                {fig.fovShortMm === null
                  ? `${show(fig.fovLongMm)} mm`
                  : `${show(fig.fovLongMm)} × ${show(fig.fovShortMm)} mm`}
              </dd>
            </div>
          </dl>
          {props.admin ? (
            <>
              <Frame
                title={t("h1Title")}
                badge={badge}
                note={<p className={`mt-1 ${NOTE_CLASS}`}>{t("h1Note")}</p>}
              >
                <NewtonFigure fig={fig} f={props.focalMm} sF={sF} wd={wd} />
              </Frame>
              <Frame
                title={t("h2Title")}
                badge={badge}
                note={
                  <p
                    className={`mt-1 ${fig.ringStatus === "low" || fig.ringStatus === "high" ? "text-sm text-red-700 dark:text-red-300" : NOTE_CLASS}`}
                  >
                    {fig.ringStatus === "low"
                      ? t("pushTooLong", { v: show(-fig.ringMm) })
                      : fig.ringStatus === "high"
                        ? t("pushTooShort", {
                            v: show(fig.ringMm - fig.ringMaxMm!),
                          })
                        : fig.ringStatus === "unknown"
                          ? t("pushNoMod")
                          : t("pushOk", {
                              ring: show(fig.ringMm),
                              max: show(fig.ringMaxMm!),
                            })}
                  </p>
                }
              >
                <PushFigure fig={fig} e={e} />
              </Frame>
            </>
          ) : null}
          <div
            className={`grid gap-3 ${props.needLongMm !== null ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" : ""}`}
          >
            <Frame
              title={t("h3Title")}
              badge={badge}
              note={
                fig.focus === null ? null : (
                  <p
                    className={`mt-1 ${marginLow || outside ? "text-sm text-amber-700 dark:text-amber-300" : NOTE_CLASS}`}
                  >
                    {outside
                      ? t("focusOutside")
                      : fig.margin !== null
                        ? `${t("focusMargin", { m: show(fig.margin * 100), limit: show(props.marginWarn * 100, 0) })}${marginLow ? ` ${t("focusMarginWarn")}` : ""}`
                        : t("focusNoTubeNote")}
                  </p>
                )
              }
            >
              {fig.focus === null ? (
                <p className={NOTE_CLASS}>{t("focusNoMod")}</p>
              ) : (
                <FocusFigure fig={fig} e={e} wd={wd} mod={props.modMm} />
              )}
            </Frame>
            {props.needLongMm !== null ? (
              <Frame
                title={t("h5Title")}
                badge={badge}
                note={
                  fig.fovTooSmall ? (
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {t("fovTooSmall")}
                    </p>
                  ) : null
                }
              >
                <FovFigure
                  fig={fig}
                  needLong={props.needLongMm}
                  needShort={props.needShortMm}
                />
              </Frame>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
