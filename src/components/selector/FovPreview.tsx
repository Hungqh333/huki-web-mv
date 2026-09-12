'use client';

import { useTranslations } from 'next-intl';

/**
 * Sơ đồ khung hình vẽ theo đúng số đang nhập.
 *
 * Lý do có nó: form đang hỏi "chiều rộng FOV", "lỗi nhỏ nhất cần thấy" như
 * những con số trần, không nói lên điều gì. Kỹ sư phải tự hình dung trong đầu
 * một cái lỗi 0,2 mm nằm giữa khung 100 mm thì nhỏ đến mức nào — và chính chỗ
 * đó là nơi hay nhận nhầm dự án.
 *
 * Sơ đồ vẽ lỗi ĐÚNG TỶ LỆ trong khung. Với FOV 100 mm và lỗi 0,2 mm thì chấm
 * đỏ chỉ chiếm 0,2% bề rộng — nhìn gần như không thấy, và đó chính là thông
 * tin cần truyền đạt. Kèm một vòng phóng to bên cạnh theo đúng lối "detail
 * view" của bản vẽ kỹ thuật, để vẫn thấy được hình dạng.
 *
 * Không dùng ảnh sản phẩm nào: toàn bộ là SVG sinh từ số người dùng gõ.
 */

type Props = {
  widthMm: number | null;
  heightMm: number | null;
  defectMm: number | null;
  workingDistanceMm: number | null;
};

/** Khung vẽ. Toạ độ SVG, không phải pixel màn hình. */
const BOX = { x: 56, y: 34, w: 300, h: 210 };
const DETAIL = { cx: 452, cy: 132, r: 56 };

const fmt = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

export function FovPreview({ widthMm, heightMm, defectMm, workingDistanceMm }: Props) {
  const t = useTranslations('selector.fovPreview');

  // Chưa đủ số thì không vẽ. Một cái khung rỗng còn khó hiểu hơn là không có gì.
  if (!widthMm || widthMm <= 0) return null;

  /* Giữ đúng tỷ lệ thật của khung hình. Không có chiều cao (line scan chẳng
     hạn) thì dùng 3:4 cho dễ nhìn, và nói rõ là chỉ minh hoạ. */
  const ratio = heightMm && heightMm > 0 ? heightMm / widthMm : 0.7;
  /* Khung gần vuông thì phải THU CẢ BỀ RỘNG lại chứ không được cắt chiều cao.
     Bản đầu kẹp chiều cao ở 210 nên khung 300 × 280 mm vẽ ra thành 300 × 210 —
     một sơ đồ kích thước nói sai tỷ lệ thì hỏng cả mục đích của nó. */
  let drawW = BOX.w;
  let drawH = drawW * ratio;
  if (drawH > BOX.h) {
    drawH = BOX.h;
    drawW = drawH / ratio;
  }
  const drawX = BOX.x + (BOX.w - drawW) / 2;
  const drawY = BOX.y + (BOX.h - drawH) / 2;

  // Lỗi vẽ đúng tỷ lệ so với bề rộng khung.
  const defectRatio = defectMm && defectMm > 0 ? defectMm / widthMm : null;
  const defectPx = defectRatio ? defectRatio * drawW : null;
  const cx = drawX + drawW / 2;
  const cy = drawY + drawH / 2;

  /* Độ phóng của vòng chi tiết: đưa lỗi lên khoảng 40% đường kính vòng. Chặn
     trên để tỷ lệ không thành con số vô nghĩa kiểu "×12000". */
  const zoom = defectPx && defectPx > 0 ? Math.min(4000, (DETAIL.r * 0.8) / defectPx) : null;
  const defectInDetail = defectPx && zoom ? Math.min(DETAIL.r * 1.2, defectPx * zoom) : null;

  const percentOfWidth = defectRatio ? defectRatio * 100 : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t('title')}
      </p>

      <svg
        viewBox="0 0 520 290"
        role="img"
        aria-label={t('alt', {
          width: fmt(widthMm),
          height: heightMm ? fmt(heightMm) : '—',
          defect: defectMm ? fmt(defectMm) : '—',
        })}
        /* Chặn bề rộng: thả tự do thì ở form 768px sơ đồ cao tới 409px, chiếm
           gần nửa màn hình cho một thứ chỉ để đối chiếu. */
        className="mt-2 w-full max-w-[520px]"
      >
        {/* --------------------------------------------------- KHUNG HÌNH -- */}
        <rect
          x={drawX}
          y={drawY}
          width={drawW}
          height={drawH}
          rx="3"
          className="fill-white stroke-slate-400 dark:fill-slate-950 dark:stroke-slate-600"
          strokeWidth="1.5"
        />

        {/* Bốn góc ngắm, để nó đọc ra là "khung hình camera" chứ không phải
            một cái hộp bất kỳ. */}
        {[
          [drawX, drawY, 1, 1],
          [drawX + drawW, drawY, -1, 1],
          [drawX, drawY + drawH, 1, -1],
          [drawX + drawW, drawY + drawH, -1, -1],
        ].map(([x, y, sx, sy]) => (
          <path
            key={`${x}-${y}`}
            d={`M ${x + sx * 16} ${y} L ${x} ${y} L ${x} ${y + sy * 16}`}
            className="stroke-sky-500"
            strokeWidth="2.5"
            fill="none"
          />
        ))}

        {/* ------------------------------------------------ ĐƯỜNG KÍCH THƯỚC -- */}
        <g className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1">
          <line x1={drawX} y1={drawY - 14} x2={drawX + drawW} y2={drawY - 14} />
          <line x1={drawX} y1={drawY - 19} x2={drawX} y2={drawY - 9} />
          <line x1={drawX + drawW} y1={drawY - 19} x2={drawX + drawW} y2={drawY - 9} />
        </g>
        <text
          x={cx}
          y={drawY - 20}
          textAnchor="middle"
          className="fill-slate-600 text-[13px] font-medium dark:fill-slate-300"
        >
          {fmt(widthMm)} mm
        </text>

        {heightMm && heightMm > 0 ? (
          <>
            <g className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1">
              <line x1={drawX - 14} y1={drawY} x2={drawX - 14} y2={drawY + drawH} />
              <line x1={drawX - 19} y1={drawY} x2={drawX - 9} y2={drawY} />
              <line x1={drawX - 19} y1={drawY + drawH} x2={drawX - 9} y2={drawY + drawH} />
            </g>
            <text
              x={drawX - 20}
              y={cy}
              textAnchor="middle"
              transform={`rotate(-90 ${drawX - 20} ${cy})`}
              className="fill-slate-600 text-[13px] font-medium dark:fill-slate-300"
            >
              {fmt(heightMm)} mm
            </text>
          </>
        ) : null}

        {/* ------------------------------------------- LỖI, ĐÚNG TỶ LỆ -- */}
        {defectPx !== null ? (
          <>
            {/* Vẽ tối thiểu 0,6px để không biến mất hẳn khỏi màn hình, nhưng
                vẫn phải nhỏ đến mức gây chú ý. */}
            <circle cx={cx} cy={cy} r={Math.max(0.3, defectPx / 2)} className="fill-red-500" />
            <line
              x1={cx}
              y1={cy}
              x2={DETAIL.cx - DETAIL.r}
              y2={DETAIL.cy}
              className="stroke-red-400"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Vòng phóng to — lối "detail view" của bản vẽ kỹ thuật. */}
            <circle
              cx={DETAIL.cx}
              cy={DETAIL.cy}
              r={DETAIL.r}
              className="fill-white stroke-slate-400 dark:fill-slate-950 dark:stroke-slate-600"
              strokeWidth="1.5"
            />
            {defectInDetail ? (
              <circle
                cx={DETAIL.cx}
                cy={DETAIL.cy}
                r={defectInDetail / 2}
                className="fill-red-500"
              />
            ) : null}
            <text
              x={DETAIL.cx}
              y={DETAIL.cy + DETAIL.r + 18}
              textAnchor="middle"
              className="fill-slate-600 text-[12px] dark:fill-slate-300"
            >
              {defectMm ? `${fmt(defectMm)} mm` : ''}
              {zoom && zoom > 1.5 ? ` · ×${Math.round(zoom)}` : ''}
            </text>
          </>
        ) : null}

        {/* --------------------------------------- KHOẢNG CÁCH LÀM VIỆC -- */}
        {workingDistanceMm && workingDistanceMm > 0 ? (
          <text
            x={drawX}
            y={drawY + drawH + 26}
            className="fill-slate-500 text-[12px] dark:fill-slate-400"
          >
            {t('workingDistance', { value: fmt(workingDistanceMm) })}
          </text>
        ) : null}
      </svg>

      {/* Con số đắt nhất của cả sơ đồ: lỗi chiếm bao nhiêu phần trăm khung. */}
      {percentOfWidth !== null ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('share', {
            percent: percentOfWidth < 0.01 ? '< 0.01' : fmt(percentOfWidth),
          })}
        </p>
      ) : null}

      {!heightMm || heightMm <= 0 ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('heightUnknown')}</p>
      ) : null}
    </div>
  );
}
