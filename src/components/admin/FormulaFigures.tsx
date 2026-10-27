import type { ReactNode } from 'react';
import type { FormulaFigureKey } from '@/lib/formulaBook/book';

/**
 * Hình minh hoạ cho Sổ tay công thức — sơ đồ SVG tự vẽ (không dùng ảnh của hãng).
 * Server component, không có JavaScript gửi xuống trình duyệt; màu theo `currentColor` +
 * lớp Tailwind nên đúng cả nền sáng và tối.
 *
 * Chuẩn trình bày (chốt 2026-10-27, lần 2):
 * - Khung rộng 480; chỉ HAI cỡ chữ — nhãn 11, ghi chú phụ 10.
 * - Trong hình chỉ có ký hiệu (≤ khoảng 6 nhãn); công thức đã có trong khung phía trên,
 *   ví dụ số nằm ở dòng chú thích.
 * - Đường kích thước = vạch mảnh màu xám, gạch ngắn hai đầu, KHÔNG mũi tên; mũi tên chỉ
 *   dùng cho chiều chạy / dòng chảy.
 * - Màu: xanh = tia / vùng; cam = phần cần chú ý; xanh lá / đỏ = đạt / không đạt.
 *
 * `uid` = mã mục: một hình có thể nằm ở nhiều mục trên cùng trang, id marker phải khác nhau.
 */

const W = 480;
const ACCENT = 'stroke-sky-600 dark:stroke-sky-400';
const ACCENT_FILL = 'fill-sky-500/15 dark:fill-sky-400/20';
const WARN = 'stroke-amber-600 dark:stroke-amber-400';
const WARN_FILL = 'fill-amber-500/25 dark:fill-amber-400/25';
const WARN_TEXT = 'fill-amber-700 dark:fill-amber-300';
const OK = 'stroke-emerald-600 dark:stroke-emerald-400';
const OK_FILL = 'fill-emerald-500/15 dark:fill-emerald-400/20';
const OK_TEXT = 'fill-emerald-700 dark:fill-emerald-300';
const BAD = 'stroke-red-600 dark:stroke-red-400';
const BAD_FILL = 'fill-red-500/15 dark:fill-red-400/20';
const BAD_TEXT = 'fill-red-700 dark:fill-red-300';
const MUTED = 'stroke-slate-400 dark:stroke-slate-500';
const SOLID = 'fill-slate-600 dark:fill-slate-400';

function Svg({ h, label, children }: { h: number; label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} className="h-auto w-full" fontFamily="ui-sans-serif, system-ui, sans-serif">
      {children}
    </svg>
  );
}

/** Đầu mũi tên — chỉ dùng cho chiều chạy / dòng chảy. */
function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <marker id={`${uid}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="currentColor" />
      </marker>
    </defs>
  );
}

/** Nhãn: cỡ 11; `sub` = ghi chú phụ cỡ 10, màu nhạt. */
function Txt({ x, y, children, a = 'middle', sub = false, cls = '' }: { x: number; y: number; children: ReactNode; a?: 'start' | 'middle' | 'end'; sub?: boolean; cls?: string }) {
  return (
    <text x={x} y={y} fontSize={sub ? 10 : 11} textAnchor={a} fill="currentColor" className={cls || (sub ? 'fill-slate-500 dark:fill-slate-400' : '')}>
      {children}
    </text>
  );
}

/** Đường kích thước: vạch mảnh xám, gạch ngắn vuông góc ở hai đầu. */
function Dim({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * 4;
  const ny = ((x2 - x1) / len) * 4;
  return (
    <g strokeWidth={0.8} className={MUTED}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} />
      <line x1={x2 - nx} y1={y2 - ny} x2={x2 + nx} y2={y2 + ny} />
    </g>
  );
}

/** Mũi tên chiều chạy / dòng chảy. */
function Flow({ uid, x1, y1, x2, y2 }: { uid: string; x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1.2} markerEnd={`url(#${uid}-a)`} />;
}

function Camera({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} className={SOLID}>
      <rect x={-14} y={-20} width={28} height={18} rx={2} />
      <rect x={-7} y={-2} width={14} height={9} />
    </g>
  );
}

/** Hộp chữ cho sơ đồ dòng chảy. */
function Box({ x, y, w, h = 30, children, cls = `${ACCENT} ${ACCENT_FILL}` }: { x: number; y: number; w: number; h?: number; children: ReactNode; cls?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} strokeWidth={1} className={cls} />
      <Txt x={x + w / 2} y={y + h / 2 + 4}>{children}</Txt>
    </g>
  );
}

// ═══════════════════════════════════════════════════════ 14 hình đợt 1 (sửa) ══

/** RES-001: lỗi nhỏ nhất phủ N px theo độ tương phản. */
function PxPerDefect() {
  const panel = (x0: number, n: number, label: string) => {
    const cell = 14;
    const cells = 7;
    const cx = x0 + (cells * cell) / 2;
    const top = 28;
    const cy = top + (cells * cell) / 2;
    return (
      <g key={label}>
        {Array.from({ length: cells + 1 }, (_, i) => (
          <g key={i} strokeWidth={0.5} className={MUTED}>
            <line x1={x0 + i * cell} y1={top} x2={x0 + i * cell} y2={top + cells * cell} />
            <line x1={x0} y1={top + i * cell} x2={x0 + cells * cell} y2={top + i * cell} />
          </g>
        ))}
        <circle cx={cx} cy={cy} r={(n * cell) / 2} strokeWidth={1.2} className={`${WARN} ${WARN_FILL}`} />
        <Dim x1={cx - (n * cell) / 2} y1={top + cells * cell + 10} x2={cx + (n * cell) / 2} y2={top + cells * cell + 10} />
        <Txt x={cx} y={top + cells * cell + 26}>{`${n} px`}</Txt>
        <Txt x={cx} y={18} sub>{label}</Txt>
      </g>
    );
  };
  return (
    <Svg h={160} label="Số pixel phủ lên lỗi nhỏ nhất theo độ tương phản">
      {panel(40, 3, 'tương phản cao')}
      {panel(191, 4, 'trung bình')}
      {panel(342, 5, 'thấp / chưa rõ')}
    </Svg>
  );
}

/** RES-005 / LSC-001: chia vùng nhìn cho nhiều camera, có chồng lấn. */
function Tiles() {
  return (
    <Svg h={150} label="Chia vùng nhìn cho hai camera có phần chồng lấn">
      <Dim x1={30} y1={30} x2={450} y2={30} />
      <Txt x={240} y={22} sub>vùng nhìn cả vật</Txt>
      <rect x={30} y={44} width={420} height={70} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={30} y={50} width={240} height={58} strokeWidth={1.2} className={`${ACCENT} ${ACCENT_FILL}`} />
      <rect x={210} y={50} width={240} height={58} strokeWidth={1.2} className={`${OK} ${OK_FILL}`} />
      <rect x={210} y={50} width={60} height={58} className={WARN_FILL} />
      <Txt x={120} y={83}>camera 1</Txt>
      <Txt x={360} y={83}>camera 2</Txt>
      <Txt x={240} y={134} cls={WARN_TEXT}>chồng lấn</Txt>
    </Svg>
  );
}

/** OPT-009: camera nghiêng θ — vùng nhìn dài ra 1 ÷ cos θ. */
function Tilt() {
  return (
    <Svg h={200} label="Camera nghiêng làm vùng nhìn dài ra">
      <line x1={30} y1={150} x2={450} y2={150} stroke="currentColor" strokeWidth={1.2} />
      <Camera x={200} y={50} rot={-16} />
      <line x1={200} y1={56} x2={200} y2={150} strokeDasharray="3 3" strokeWidth={0.8} className={MUTED} />
      <line x1={202} y1={58} x2={232} y2={150} strokeDasharray="5 3" strokeWidth={0.8} className={MUTED} />
      <line x1={202} y1={58} x2={130} y2={150} strokeWidth={1} className={ACCENT} />
      <line x1={202} y1={58} x2={340} y2={150} strokeWidth={1} className={ACCENT} />
      <line x1={130} y1={150} x2={340} y2={150} strokeWidth={3.5} className={WARN} />
      <path d="M200 92 A 36 36 0 0 0 211 91" fill="none" stroke="currentColor" strokeWidth={0.9} />
      <Txt x={214} y={104} a="start">θ</Txt>
      <Dim x1={130} y1={168} x2={340} y2={168} />
      <Txt x={235} y={188}>L ÷ cos θ</Txt>
    </Svg>
  );
}

/** OPT-008: sai số phối cảnh e. */
function Perspective() {
  return (
    <Svg h={225} label="Sai số phối cảnh do chiều cao vật thay đổi">
      <Camera x={150} y={36} />
      <line x1={150} y1={44} x2={150} y2={160} strokeDasharray="3 3" strokeWidth={0.8} className={MUTED} />
      <line x1={30} y1={160} x2={380} y2={160} stroke="currentColor" strokeWidth={1.2} />
      <line x1={30} y1={130} x2={380} y2={130} strokeDasharray="5 3" strokeWidth={1} className={WARN} />
      <line x1={150} y1={44} x2={330} y2={160} strokeWidth={1} className={ACCENT} />
      <circle cx={330} cy={160} r={3} fill="currentColor" />
      <circle cx={283.4} cy={130} r={3} className="fill-amber-600 dark:fill-amber-400" />
      <line x1={283.4} y1={130} x2={283.4} y2={160} strokeWidth={0.8} className={WARN} />
      <Dim x1={283.4} y1={176} x2={330} y2={176} />
      <Txt x={306.7} y={193} cls={WARN_TEXT}>e</Txt>
      <Dim x1={150} y1={205} x2={330} y2={205} />
      <Txt x={240} y={220}>r</Txt>
      <Dim x1={60} y1={44} x2={60} y2={160} />
      <Txt x={70} y={106} a="start">WD</Txt>
      <Dim x1={400} y1={130} x2={400} y2={160} />
      <Txt x={410} y={149} a="start">Δh</Txt>
    </Svg>
  );
}

/** OPT-006 / OPT-007: ống thường (tia toả) và telecentric (tia song song). */
function Telecentric() {
  return (
    <Svg h={210} label="Tia sáng ống kính thường và ống telecentric">
      <line x1={240} y1={14} x2={240} y2={200} strokeWidth={0.6} className={MUTED} />
      <Txt x={120} y={18}>ống thường</Txt>
      <rect x={104} y={30} width={32} height={26} rx={3} className={SOLID} />
      <line x1={120} y1={56} x2={40} y2={170} strokeWidth={1} className={ACCENT} />
      <line x1={120} y1={56} x2={200} y2={170} strokeWidth={1} className={ACCENT} />
      <line x1={68} y1={130} x2={172} y2={130} strokeWidth={3} className={WARN} />
      <line x1={40} y1={170} x2={200} y2={170} strokeWidth={3} stroke="currentColor" />
      <Txt x={120} y={194} sub cls={WARN_TEXT}>vật cao lên → ảnh to ra</Txt>
      <Txt x={360} y={18}>telecentric</Txt>
      <rect x={280} y={30} width={160} height={26} rx={3} className={SOLID} />
      <Txt x={360} y={47} sub cls="fill-white dark:fill-slate-900">ống trước</Txt>
      <line x1={290} y1={56} x2={290} y2={170} strokeWidth={1} className={ACCENT} />
      <line x1={430} y1={56} x2={430} y2={170} strokeWidth={1} className={ACCENT} />
      <line x1={290} y1={130} x2={430} y2={130} strokeWidth={3} className={OK} />
      <line x1={290} y1={170} x2={430} y2={170} strokeWidth={3} stroke="currentColor" />
      <Txt x={360} y={194} sub cls={OK_TEXT}>kích thước không đổi</Txt>
    </Svg>
  );
}

/** OPT-001 / LNS-002 / OPT-012: β = f ÷ (WD − sF), WD tính từ mặt trước ống. */
function LensGeometry() {
  return (
    <Svg h={200} label="Hình học ống kính: tiêu điểm trước, khoảng làm việc, vùng nhìn">
      <line x1={14} y1={100} x2={466} y2={100} strokeDasharray="4 3" strokeWidth={0.6} className={MUTED} />
      <line x1={30} y1={82} x2={30} y2={118} strokeWidth={5} className={ACCENT} />
      <Txt x={30} y={140} sub>cảm biến</Txt>
      <rect x={50} y={74} width={90} height={52} rx={4} className="fill-slate-500/25 dark:fill-slate-400/25" />
      <line x1={140} y1={66} x2={140} y2={134} stroke="currentColor" strokeWidth={1.4} />
      <Txt x={140} y={58} sub>mặt trước ống</Txt>
      <circle cx={168} cy={100} r={3} className="fill-amber-600 dark:fill-amber-400" />
      <Txt x={168} y={90} cls={WARN_TEXT}>F</Txt>
      <line x1={168} y1={100} x2={430} y2={36} strokeWidth={1} className={ACCENT} />
      <line x1={168} y1={100} x2={430} y2={164} strokeWidth={1} className={ACCENT} />
      <line x1={430} y1={36} x2={430} y2={164} strokeWidth={3} stroke="currentColor" />
      <Dim x1={452} y1={36} x2={452} y2={164} />
      <Txt x={430} y={26} sub>vùng nhìn</Txt>
      <Dim x1={140} y1={152} x2={168} y2={152} />
      <Txt x={154} y={170}>sF</Txt>
      <Dim x1={140} y1={180} x2={430} y2={180} />
      <Txt x={285} y={196}>WD</Txt>
    </Svg>
  );
}

/** OPT-002: vòng ảnh phủ đường chéo cảm biến. */
function ImageCircle() {
  const sensor = (cx: number) => <rect x={cx - 50} y={62} width={100} height={75} fill="none" stroke="currentColor" strokeWidth={1.3} />;
  return (
    <Svg h={185} label="Vòng ảnh của ống kính so với đường chéo cảm biến">
      <Txt x={130} y={20} cls={OK_TEXT}>đạt</Txt>
      <circle cx={130} cy={100} r={68} strokeWidth={1.2} className={`${OK} ${OK_FILL}`} />
      {sensor(130)}
      <line x1={80} y1={137} x2={180} y2={62} strokeDasharray="3 2" strokeWidth={0.8} className={MUTED} />
      <Txt x={130} y={182} sub>đường chéo ≤ vòng ảnh</Txt>
      <Txt x={350} y={20} cls={BAD_TEXT}>tối góc</Txt>
      <circle cx={350} cy={100} r={50} strokeWidth={1.2} className={`${BAD} ${BAD_FILL}`} />
      {sensor(350)}
      {[
        [300, 62],
        [400, 62],
        [300, 137],
        [400, 137],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={8} className="fill-slate-900/60 dark:fill-black/70" />
      ))}
      <Txt x={350} y={182} sub>vòng ảnh nhỏ hơn đường chéo</Txt>
    </Svg>
  );
}

/** OPT-005: độ sâu trường ảnh — F nhỏ nón rộng (nông), F lớn nón hẹp (sâu). */
function Dof() {
  const row = (y0: number, open: number, depth: number, label: string) => {
    const end = (sign: 1 | -1) => y0 - sign * open + ((sign * open) * (420 - 48)) / (300 - 48);
    return (
      <g>
        <Txt x={40} y={y0 - open - 12} a="start" sub>{label}</Txt>
        <rect x={30} y={y0 - open - 4} width={18} height={2 * open + 8} rx={2} className={SOLID} />
        <line x1={48} y1={y0 - open} x2={420} y2={end(1)} strokeWidth={1} className={ACCENT} />
        <line x1={48} y1={y0 + open} x2={420} y2={end(-1)} strokeWidth={1} className={ACCENT} />
        <rect x={300 - depth} y={y0 - 5} width={2 * depth} height={10} className={WARN_FILL} />
        <line x1={300} y1={y0 - 16} x2={300} y2={y0 + 16} stroke="currentColor" strokeWidth={1} />
      </g>
    );
  };
  return (
    <Svg h={200} label="Độ sâu trường ảnh theo khẩu độ">
      {row(64, 30, 12, 'F nhỏ (mở khẩu)')}
      {row(150, 12, 36, 'F lớn (khép khẩu)')}
      <Txt x={300} y={192} sub cls={WARN_TEXT}>vùng tô = độ sâu trường ảnh</Txt>
    </Svg>
  );
}

/** THR-005: nhoè — vật dịch v × t trong lúc phơi. */
function MotionBlur({ uid }: { uid: string }) {
  const cell = 32;
  const x0 = 48;
  const e0 = x0 + 5 * cell;
  return (
    <Svg h={150} label="Nhoè chuyển động trong thời gian phơi">
      <Defs uid={uid} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={x0 + i * cell} y={70} width={cell} height={34} fill="none" strokeWidth={0.6} className={MUTED} />
      ))}
      <rect x={e0} y={70} width={cell} height={34} className={WARN_FILL} />
      <line x1={e0} y1={62} x2={e0} y2={112} strokeWidth={2} stroke="currentColor" />
      <line x1={e0 + cell} y1={62} x2={e0 + cell} y2={112} strokeWidth={2} strokeDasharray="4 3" stroke="currentColor" />
      <Flow uid={uid} x1={e0} y1={52} x2={e0 + cell} y2={52} />
      <Txt x={e0 + cell / 2} y={40} cls={WARN_TEXT}>v × t</Txt>
      <Txt x={e0 - 6} y={130} a="end" sub>mép lúc bắt đầu phơi</Txt>
      <Txt x={e0 + cell + 6} y={130} a="start" sub>mép lúc kết thúc phơi</Txt>
    </Svg>
  );
}

/** THR-007: cảm biến quang → camera, vị trí chụp lệch ±Δx. */
function TriggerShift({ uid }: { uid: string }) {
  return (
    <Svg h={205} label="Lệch vị trí chụp do sai lệch thời điểm trigger">
      <Defs uid={uid} />
      <rect x={10} y={150} width={460} height={14} rx={7} className="fill-slate-400/30 dark:fill-slate-500/30" />
      <Flow uid={uid} x1={30} y1={186} x2={110} y2={186} />
      <Txt x={70} y={202} sub>chiều chạy (v)</Txt>
      <rect x={82} y={100} width={18} height={18} className={SOLID} />
      <line x1={91} y1={118} x2={91} y2={150} strokeDasharray="2 2" strokeWidth={1.2} className={WARN} />
      <Txt x={91} y={92} sub>cảm biến quang</Txt>
      <Camera x={300} y={36} />
      <line x1={300} y1={44} x2={230} y2={148} strokeWidth={1} className={ACCENT} />
      <line x1={300} y1={44} x2={370} y2={148} strokeWidth={1} className={ACCENT} />
      <rect x={266} y={124} width={68} height={26} className={WARN_FILL} />
      <rect x={276} y={124} width={48} height={26} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <Txt x={342} y={120} a="start" cls={WARN_TEXT}>±Δx</Txt>
    </Svg>
  );
}

/** LGT-024: xung strobe — độ rộng xung, chu kỳ, mức overdrive. */
function Strobe() {
  return (
    <Svg h={190} label="Xung đèn strobe: độ rộng, chu kỳ và mức sáng">
      <line x1={30} y1={150} x2={460} y2={150} stroke="currentColor" strokeWidth={1} />
      <line x1={30} y1={125} x2={460} y2={125} strokeDasharray="4 3" strokeWidth={0.8} className={MUTED} />
      <Txt x={110} y={118} a="start" sub>mức đèn liên tục</Txt>
      <path d="M30 150 H80 V50 H96 V150 H230 V50 H246 V150 H380 V50 H396 V150 H460" fill="none" strokeWidth={1.5} className={ACCENT} />
      <Txt x={102} y={62} a="start" sub>overdrive ×k</Txt>
      <Dim x1={88} y1={32} x2={238} y2={32} />
      <Txt x={163} y={24}>1 ÷ fps</Txt>
      <Dim x1={80} y1={166} x2={96} y2={166} />
      <Txt x={88} y={184}>t</Txt>
    </Svg>
  );
}

/** THR-003 / THR-008: chụp – truyền – xử lý gối nhau; độ trễ tới điểm gạt. */
function Pipeline() {
  const rows = [
    ['chụp', ACCENT_FILL, 0, 14],
    ['truyền', OK_FILL, 14, 20],
    ['xử lý', WARN_FILL, 34, 60],
  ] as const;
  const takt = 90;
  const x0 = 76;
  return (
    <Svg h={150} label="Biểu đồ thời gian chụp, truyền, xử lý và độ trễ tới điểm gạt">
      <Dim x1={x0} y1={24} x2={x0 + takt} y2={24} />
      <Txt x={x0 + takt / 2} y={16} sub>nhịp</Txt>
      {[0, 1, 2, 3, 4].map((p) => (
        <line key={p} x1={x0 + p * takt} y1={34} x2={x0 + p * takt} y2={112} strokeDasharray="2 3" strokeWidth={0.6} className={MUTED} />
      ))}
      {rows.map(([name, fill, offset, len], r) => (
        <g key={name}>
          <Txt x={66} y={50 + r * 24} a="end" sub>{name}</Txt>
          {[0, 1, 2, 3].map((p) => (
            <rect key={p} x={x0 + p * takt + offset} y={40 + r * 24} width={len} height={14} className={fill} stroke="currentColor" strokeWidth={0.4} />
          ))}
        </g>
      ))}
      <Dim x1={x0} y1={128} x2={x0 + 114} y2={128} />
      <Txt x={x0 + 122} y={132} a="start" sub cls={WARN_TEXT}>độ trễ sản phẩm 1 (gồm IO + cơ cấu gạt)</Txt>
    </Svg>
  );
}

/** CAM-002: đọc chồng phơi / không chồng; cắt ROI. */
function OverlapRoi() {
  const bar = (x: number, y: number, w: number, cls: string, label?: string) => (
    <g>
      <rect x={x} y={y} width={w} height={14} className={cls} stroke="currentColor" strokeWidth={0.4} />
      {label ? <Txt x={x + w / 2} y={y + 11} sub>{label}</Txt> : null}
    </g>
  );
  return (
    <Svg h={160} label="Đọc chồng phơi và không chồng phơi, cắt ROI">
      <Txt x={20} y={18} a="start">đọc chồng phơi</Txt>
      {[0, 1, 2].map((i) => (
        <g key={`o${i}`}>
          {bar(20 + i * 62, 28, 22, ACCENT_FILL, i === 0 ? 'phơi' : undefined)}
          {bar(42 + i * 62, 46, 58, OK_FILL, i === 0 ? 'đọc' : undefined)}
        </g>
      ))}
      <Txt x={20} y={96} a="start">không chồng</Txt>
      {[0, 1].map((i) => (
        <g key={`s${i}`}>
          {bar(20 + i * 82, 106, 22, ACCENT_FILL, i === 0 ? 'phơi' : undefined)}
          {bar(42 + i * 82, 106, 58, OK_FILL, i === 0 ? 'đọc' : undefined)}
        </g>
      ))}
      <rect x={300} y={24} width={160} height={106} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <rect x={300} y={62} width={160} height={30} strokeWidth={1.2} className={`${WARN} ${WARN_FILL}`} />
      <Txt x={380} y={81}>ROI</Txt>
      <Txt x={380} y={148} sub>cảm biến — chỉ đọc các hàng ROI</Txt>
    </Svg>
  );
}

/** COD-002: mã chạy qua khung — cửa sổ W, N lần chụp. */
function CodeWindow({ uid }: { uid: string }) {
  return (
    <Svg h={170} label="Cửa sổ đọc mã khi mã chạy qua khung">
      <Defs uid={uid} />
      <Txt x={240} y={20} sub>vùng nhìn theo chiều chạy</Txt>
      <Flow uid={uid} x1={380} y1={16} x2={440} y2={16} />
      <rect x={40} y={34} width={400} height={84} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <rect x={40} y={56} width={60} height={40} strokeWidth={1} className={`${ACCENT} ${ACCENT_FILL}`} />
      <rect x={380} y={56} width={60} height={40} strokeWidth={1} className={`${ACCENT} ${ACCENT_FILL}`} />
      <Txt x={70} y={80} sub>mã vào</Txt>
      <Txt x={410} y={80} sub>mã ra</Txt>
      {[160, 240, 320].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={40} x2={x} y2={112} strokeDasharray="3 3" strokeWidth={1} className={OK} />
          <Txt x={x} y={80} sub cls={OK_TEXT}>{`chụp ${i + 1}`}</Txt>
        </g>
      ))}
      <Dim x1={100} y1={136} x2={380} y2={136} />
      <Txt x={240} y={156}>W</Txt>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════ 18 hình mới — phần 2–9 ══

/** RES-002: chuỗi ngân sách sai số đo. */
function BudgetChain({ uid }: { uid: string }) {
  const steps = [
    ['± dung sai', 'yêu cầu'],
    ['T = 2 × dung sai', 'dải tổng'],
    ['U = T ÷ 10', 'ngân sách đo'],
    ['mm/px = U × 3', 'độ phân giải cần'],
  ];
  return (
    <Svg h={90} label="Chuỗi ngân sách sai số đo">
      <Defs uid={uid} />
      {steps.map(([label, note], i) => (
        <g key={label}>
          <Box x={6 + i * 120} y={16} w={104}>{label}</Box>
          <Txt x={58 + i * 120} y={70} sub>{note}</Txt>
          {i < 3 ? <Flow uid={uid} x1={112 + i * 120} y1={31} x2={124 + i * 120} y2={31} /> : null}
        </g>
      ))}
    </Svg>
  );
}

/** RES-003: hai nhánh độ phân giải — lấy nhánh chặt hơn (mm/px nhỏ hơn). */
function Governing() {
  return (
    <Svg h={120} label="Lấy nhánh có mm/px nhỏ hơn">
      <Txt x={110} y={36} a="end">nhánh phát hiện lỗi</Txt>
      <rect x={120} y={24} width={300} height={16} className={ACCENT_FILL} stroke="currentColor" strokeWidth={0.4} />
      <Txt x={110} y={72} a="end">nhánh đo lường</Txt>
      <rect x={120} y={60} width={240} height={16} strokeWidth={1.2} className={`${OK} ${OK_FILL}`} />
      <Txt x={370} y={72} a="start" cls={OK_TEXT}>← chọn</Txt>
      <Txt x={270} y={106} sub>thanh ngắn = mm/px nhỏ = mịn hơn → quyết định camera</Txt>
    </Svg>
  );
}

/** RES-004: số pixel cần mỗi trục = vùng nhìn ÷ mm/px. */
function PixelGrid() {
  return (
    <Svg h={175} label="Số pixel cần trên mỗi trục vùng nhìn">
      <rect x={90} y={30} width={320} height={110} strokeWidth={1.2} className={`${ACCENT} ${ACCENT_FILL}`} />
      {Array.from({ length: 15 }, (_, i) => (
        <line key={`v${i}`} x1={90 + (i + 1) * 20} y1={30} x2={90 + (i + 1) * 20} y2={140} strokeWidth={0.4} className={MUTED} />
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <line key={`h${i}`} x1={90} y1={30 + (i + 1) * 22} x2={410} y2={30 + (i + 1) * 22} strokeWidth={0.4} className={MUTED} />
      ))}
      <Dim x1={90} y1={156} x2={410} y2={156} />
      <Txt x={250} y={172}>nx px</Txt>
      <Dim x1={70} y1={30} x2={70} y2={140} />
      <Txt x={60} y={89} a="end">ny px</Txt>
      <Txt x={410} y={22} a="end" sub>1 ô = mm/px</Txt>
    </Svg>
  );
}

/** OPT-003: một cặp vạch = hai pixel. */
function LensResolution() {
  const x0 = 60;
  const px = 30;
  return (
    <Svg h={130} label="Độ phân giải ống kính: một cặp vạch trên hai pixel">
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={x0 + i * px} y={30} width={px} height={44} className={i % 2 === 0 ? 'fill-slate-700 dark:fill-slate-300' : 'fill-white dark:fill-slate-900'} stroke="currentColor" strokeWidth={0.3} />
      ))}
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1={x0 + i * px} y1={80} x2={x0 + i * px} y2={92} strokeWidth={0.8} className={MUTED} />
      ))}
      <Txt x={x0 + 6 * px} y={22} sub>vạch đen / trắng trên vật</Txt>
      <Dim x1={x0} y1={104} x2={x0 + 2 * px} y2={104} />
      <Txt x={x0 + px} y={122}>1 cặp vạch</Txt>
      <Txt x={x0 + 8 * px} y={122} sub>vạch xám dưới = biên pixel</Txt>
    </Svg>
  );
}

/** OPT-004: vệt nhiễu xạ (Airy) so với pixel. */
function Diffraction() {
  const panel = (cx: number, r: number, label: string, cls: string) => (
    <g>
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} strokeWidth={0.5} className={MUTED}>
          <line x1={cx - 60 + i * 24} y1={40} x2={cx - 60 + i * 24} y2={160} />
          <line x1={cx - 60} y1={40 + i * 24} x2={cx + 60} y2={40 + i * 24} />
        </g>
      ))}
      <circle cx={cx} cy={100} r={r} className="fill-amber-500/45 dark:fill-amber-400/45" />
      <circle cx={cx} cy={100} r={r * 1.6} fill="none" strokeWidth={1} className={WARN} />
      <Txt x={cx} y={24} cls={cls}>{label}</Txt>
    </g>
  );
  return (
    <Svg h={170} label="Vệt nhiễu xạ so với cỡ pixel">
      {panel(130, 8, 'F nhỏ: vệt gọn trong 1 px', OK_TEXT)}
      {panel(350, 22, 'F lớn: vệt loang nhiều px', BAD_TEXT)}
    </Svg>
  );
}

/** MEC-001: giãn nở nhiệt ΔL = α × L × ΔT. */
function Thermal() {
  return (
    <Svg h={120} label="Giãn nở nhiệt của chi tiết">
      <Txt x={30} y={34} a="start" sub>nhiệt độ chuẩn</Txt>
      <rect x={30} y={40} width={320} height={16} className="fill-slate-400/40 dark:fill-slate-500/40" />
      <Txt x={30} y={80} a="start" sub>nóng thêm ΔT</Txt>
      <rect x={30} y={86} width={320} height={16} className="fill-slate-400/40 dark:fill-slate-500/40" />
      <rect x={350} y={86} width={40} height={16} className={WARN_FILL} stroke="none" />
      <Txt x={400} y={98} a="start" cls={WARN_TEXT}>ΔL</Txt>
      <Dim x1={30} y1={66} x2={350} y2={66} />
      <Txt x={190} y={62} sub>L</Txt>
    </Svg>
  );
}

/** MEC-003: kích thước đo vắt qua đường ghép giữa hai camera. */
function Seam() {
  return (
    <Svg h={150} label="Sai số ghép ảnh giữa hai camera">
      <rect x={40} y={30} width={220} height={80} strokeWidth={1.1} className={`${ACCENT} ${ACCENT_FILL}`} />
      <rect x={220} y={30} width={220} height={80} strokeWidth={1.1} className={`${OK} ${OK_FILL}`} />
      <Txt x={120} y={24} sub>camera 1</Txt>
      <Txt x={360} y={24} sub>camera 2</Txt>
      <line x1={240} y1={30} x2={240} y2={110} strokeDasharray="4 3" strokeWidth={1.2} className={WARN} />
      <line x1={100} y1={70} x2={240} y2={70} stroke="currentColor" strokeWidth={1.4} />
      <line x1={240} y1={74} x2={380} y2={74} stroke="currentColor" strokeWidth={1.4} />
      <circle cx={100} cy={70} r={3} fill="currentColor" />
      <circle cx={380} cy={74} r={3} fill="currentColor" />
      <Txt x={240} y={132} cls={WARN_TEXT}>đường ghép: sai số hiệu chuẩn cộng vào kích thước</Txt>
    </Svg>
  );
}

/** LGT-008: rolling shutter làm méo vật đang chạy, global shutter thì không. */
function Shutter() {
  return (
    <Svg h={150} label="Rolling shutter và global shutter khi vật chạy">
      <Txt x={120} y={22} cls={BAD_TEXT}>rolling shutter</Txt>
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={40} y1={40 + i * 16} x2={200} y2={40 + i * 16} strokeWidth={0.4} className={MUTED} />
      ))}
      <path d="M80 40 L130 40 L160 120 L110 120 Z" strokeWidth={1.3} className={`${BAD} ${BAD_FILL}`} />
      <Txt x={120} y={140} sub>mỗi hàng đọc ở một thời điểm → méo</Txt>
      <Txt x={360} y={22} cls={OK_TEXT}>global shutter</Txt>
      <rect x={330} y={40} width={60} height={80} strokeWidth={1.3} className={`${OK} ${OK_FILL}`} />
      <Txt x={360} y={140} sub>mọi hàng phơi cùng lúc → đúng hình</Txt>
    </Svg>
  );
}

/** THR-001 / THR-002: lưu lượng dữ liệu so với 70 % băng thông cổng. */
function DataPipe() {
  return (
    <Svg h={110} label="Lưu lượng dữ liệu so với băng thông cổng giao tiếp">
      <rect x={30} y={34} width={420} height={26} rx={4} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <rect x={30} y={34} width={230} height={26} rx={4} className={ACCENT_FILL} />
      <line x1={324} y1={26} x2={324} y2={68} strokeDasharray="4 3" strokeWidth={1.2} className={WARN} />
      <Txt x={324} y={20} cls={WARN_TEXT}>70 %</Txt>
      <Txt x={145} y={51}>MB/s camera sinh ra</Txt>
      <Txt x={450} y={86} a="end" sub>toàn bộ băng thông cổng (GigE, USB3, CXP…)</Txt>
    </Svg>
  );
}

/** THR-006: số ảnh/giây = n ảnh mỗi sản phẩm × sản lượng. */
function FramesPerTakt() {
  const takt = 110;
  const x0 = 40;
  return (
    <Svg h={110} label="Số ảnh mỗi sản phẩm trong một nhịp">
      <line x1={x0} y1={60} x2={x0 + 4 * takt} y2={60} stroke="currentColor" strokeWidth={1} />
      {[0, 1, 2, 3].map((p) => (
        <g key={p}>
          <rect x={x0 + p * takt + 10} y={44} width={34} height={16} rx={3} className="fill-slate-400/40 dark:fill-slate-500/40" />
          {[0, 1, 2].map((k) => (
            <line key={k} x1={x0 + p * takt + 16 + k * 11} y1={64} x2={x0 + p * takt + 16 + k * 11} y2={76} strokeWidth={1.6} className={ACCENT} />
          ))}
        </g>
      ))}
      <Dim x1={x0 + 10} y1={92} x2={x0 + takt + 10} y2={92} />
      <Txt x={x0 + 10 + takt / 2} y={106} sub>nhịp = 60 ÷ sản lượng</Txt>
      <Txt x={x0 + 2 * takt + 30} y={34} sub cls="fill-sky-700 dark:fill-sky-300">vạch xanh = ảnh chụp (n = 3)</Txt>
    </Svg>
  );
}

/** LGT-001..004 / LGT-017..023: bốn kiểu đèn hay dùng. */
function LightTypes() {
  const obj = (cx: number) => <rect x={cx - 26} y={120} width={52} height={10} className={SOLID} />;
  const cam = (cx: number) => <Camera x={cx} y={30} />;
  const panel = (cx: number, label: string, body: ReactNode) => (
    <g>
      {cam(cx)}
      {body}
      {obj(cx)}
      <Txt x={cx} y={150} sub>{label}</Txt>
    </g>
  );
  return (
    <Svg h={160} label="Bốn kiểu đèn: vòm, đồng trục, chiếu nghiêng, đèn nền">
      {panel(
        60,
        'vòm',
        <>
          <path d="M14 120 A 46 46 0 0 1 106 120" fill="none" strokeWidth={3} className={WARN} />
          {[30, 60, 90].map((x) => (
            <line key={x} x1={x} y1={x === 60 ? 76 : 88} x2={60} y2={118} strokeWidth={0.8} strokeDasharray="2 2" className={WARN} />
          ))}
        </>
      )}
      {panel(
        180,
        'đồng trục',
        <>
          <line x1={160} y1={60} x2={200} y2={92} strokeWidth={1.4} className={MUTED} />
          <rect x={212} y={66} width={10} height={20} className="fill-amber-500 dark:fill-amber-400" />
          <line x1={212} y1={76} x2={180} y2={76} strokeWidth={0.9} strokeDasharray="2 2" className={WARN} />
          <line x1={180} y1={76} x2={180} y2={118} strokeWidth={0.9} strokeDasharray="2 2" className={WARN} />
        </>
      )}
      {panel(
        300,
        'chiếu nghiêng góc thấp',
        <>
          <rect x={248} y={104} width={14} height={8} className="fill-amber-500 dark:fill-amber-400" />
          <rect x={338} y={104} width={14} height={8} className="fill-amber-500 dark:fill-amber-400" />
          <line x1={262} y1={110} x2={290} y2={120} strokeWidth={0.9} strokeDasharray="2 2" className={WARN} />
          <line x1={338} y1={110} x2={310} y2={120} strokeWidth={0.9} strokeDasharray="2 2" className={WARN} />
        </>
      )}
      {panel(
        420,
        'đèn nền',
        <>
          <rect x={380} y={134} width={80} height={6} className="fill-amber-500 dark:fill-amber-400" />
          <line x1={400} y1={132} x2={400} y2={46} strokeWidth={0.9} strokeDasharray="2 2" className={WARN} />
          <line x1={440} y1={132} x2={440} y2={46} strokeWidth={0.9} strokeDasharray="2 2" className={WARN} />
        </>
      )}
    </Svg>
  );
}

/** EXP-001..002: bảng kết luận — bỏ sót (NG lọt) và hao phí (OK bị loại). */
function Confusion() {
  const cell = (x: number, y: number, label: string, cls: string, textCls = '') => (
    <g>
      <rect x={x} y={y} width={130} height={44} strokeWidth={1} className={cls} />
      <Txt x={x + 65} y={y + 26} cls={textCls}>{label}</Txt>
    </g>
  );
  return (
    <Svg h={160} label="Bảng kết luận: bỏ sót và hao phí">
      <Txt x={285} y={18} sub>máy kết luận</Txt>
      <Txt x={220} y={38}>OK</Txt>
      <Txt x={350} y={38}>NG</Txt>
      <Txt x={60} y={20} sub>thực tế</Txt>
      <Txt x={130} y={74} a="end">OK</Txt>
      <Txt x={130} y={122} a="end">NG</Txt>
      {cell(155, 48, 'đúng', `${OK} ${OK_FILL}`)}
      {cell(285, 48, 'hao phí (FP)', `${WARN} ${WARN_FILL}`, WARN_TEXT)}
      {cell(155, 96, 'bỏ sót (FN)', `${BAD} ${BAD_FILL}`, BAD_TEXT)}
      {cell(285, 96, 'đúng', `${OK} ${OK_FILL}`)}
    </Svg>
  );
}

/** AI-001/002: truyền thống hay học sâu theo biến động ngoại hình lỗi. */
function DecisionFlow({ uid }: { uid: string }) {
  return (
    <Svg h={150} label="Chọn xử lý ảnh truyền thống hay học sâu">
      <Defs uid={uid} />
      <Box x={10} y={58} w={150} cls={`stroke-slate-500 fill-slate-400/15`}>biến động lỗi?</Box>
      <Flow uid={uid} x1={160} y1={66} x2={250} y2={26} />
      <Flow uid={uid} x1={160} y1={73} x2={250} y2={73} />
      <Flow uid={uid} x1={160} y1={80} x2={250} y2={120} />
      <Txt x={200} y={36} sub>thấp / TB</Txt>
      <Txt x={205} y={68} sub>cao</Txt>
      <Txt x={200} y={112} sub>chưa rõ</Txt>
      <Box x={254} y={10} w={216} cls={`${OK} ${OK_FILL}`}>xử lý ảnh truyền thống</Box>
      <Box x={254} y={58} w={216} cls={`${WARN} ${WARN_FILL}`}>ứng viên học sâu — chụp mẫu</Box>
      <Box x={254} y={106} w={216} cls={`${ACCENT} ${ACCENT_FILL}`}>truyền thống, cần xác nhận</Box>
    </Svg>
  );
}

/** LNS-001: trục giới hạn — tỉ lệ cảm biến khác tỉ lệ vùng nhìn. */
function LimitingAxis() {
  return (
    <Svg h={170} label="Trục giới hạn độ phóng đại">
      <rect x={90} y={30} width={300} height={113} fill="none" strokeWidth={1.3} strokeDasharray="5 3" className={ACCENT} />
      <rect x={90} y={52} width={300} height={70} strokeWidth={1.3} className={`${WARN} ${WARN_FILL}`} />
      <Txt x={240} y={92} cls={WARN_TEXT}>vùng cần (dài, hẹp)</Txt>
      <Txt x={240} y={24} sub cls="fill-sky-700 dark:fill-sky-300">vùng nhìn thật (theo tỉ lệ cảm biến 4 : 3)</Txt>
      <Dim x1={90} y1={158} x2={390} y2={158} />
      <Txt x={410} y={162} a="start">trục giới hạn</Txt>
    </Svg>
  );
}

/** LNS-003: góc nhìn tại WD. */
function AngleOfView() {
  return (
    <Svg h={160} label="Góc nhìn của ống kính tại khoảng làm việc">
      <rect x={30} y={62} width={50} height={36} rx={3} className={SOLID} />
      <line x1={80} y1={80} x2={420} y2={24} strokeWidth={1} className={ACCENT} />
      <line x1={80} y1={80} x2={420} y2={136} strokeWidth={1} className={ACCENT} />
      <line x1={420} y1={24} x2={420} y2={136} strokeWidth={3} stroke="currentColor" />
      <path d="M130 71.8 A 50 50 0 0 1 130 88.2" fill="none" stroke="currentColor" strokeWidth={0.9} />
      <Txt x={142} y={84} a="start">góc nhìn</Txt>
      <Dim x1={80} y1={150} x2={420} y2={150} />
      <Txt x={250} y={146} sub>WD</Txt>
      <Dim x1={442} y1={24} x2={442} y2={136} />
      <Txt x={436} y={16} sub>vùng nhìn</Txt>
    </Svg>
  );
}

/** LNS-005: vùng nhìn thật rộng quá so với vùng cần. */
function FovTooWide() {
  return (
    <Svg h={170} label="Vùng nhìn thật rộng hơn nhiều so với vùng cần">
      <rect x={60} y={20} width={360} height={130} strokeWidth={1.3} className={`${WARN} ${WARN_FILL}`} />
      <Txt x={240} y={40} cls={WARN_TEXT}>vùng nhìn thật</Txt>
      <rect x={180} y={66} width={120} height={52} strokeWidth={1.3} className={`${ACCENT} ${ACCENT_FILL}`} />
      <Txt x={240} y={96}>vùng cần</Txt>
      <Txt x={240} y={166} sub>phần lớn pixel nằm ngoài vật → loại khi dư quá ngưỡng</Txt>
    </Svg>
  );
}

/** OPT-010: ống nối đẩy ống kính ra xa cảm biến → lấy nét gần hơn MOD. */
function ExtensionTube() {
  const row = (y: number, tube: number, label: string) => (
    <g>
      <rect x={20} y={y - 16} width={40} height={32} rx={2} className={SOLID} />
      {tube > 0 ? <rect x={60} y={y - 12} width={tube} height={24} className="fill-amber-500/70 dark:fill-amber-400/70" /> : null}
      <rect x={60 + tube} y={y - 14} width={60} height={28} rx={3} className="fill-slate-500/40 dark:fill-slate-400/40" />
      <Txt x={130 + tube} y={y + 4} a="start" sub>{label}</Txt>
    </g>
  );
  return (
    <Svg h={140} label="Ống nối giúp lấy nét gần hơn">
      {row(38, 0, 'không ống nối: gần nhất = MOD')}
      {row(100, 40, 'có ống nối: lấy nét gần hơn, phóng đại lớn hơn')}
      <Txt x={80} y={132} sub cls={WARN_TEXT}>ống nối</Txt>
    </Svg>
  );
}

/** OPT-011: bộ nhân tiêu cự ×k — tiêu cự dài ra, vùng nhìn hẹp lại. */
function Converter() {
  const row = (y: number, k: boolean, spread: number, label: string) => (
    <g>
      <rect x={20} y={y - 16} width={40} height={32} rx={2} className={SOLID} />
      {k ? <rect x={60} y={y - 12} width={30} height={24} className="fill-amber-500/70 dark:fill-amber-400/70" /> : null}
      <rect x={k ? 90 : 60} y={y - 14} width={56} height={28} rx={3} className="fill-slate-500/40 dark:fill-slate-400/40" />
      <line x1={k ? 146 : 116} y1={y} x2={440} y2={y - spread} strokeWidth={1} className={ACCENT} />
      <line x1={k ? 146 : 116} y1={y} x2={440} y2={y + spread} strokeWidth={1} className={ACCENT} />
      <Txt x={k ? 156 : 126} y={y - 18} a="start" sub>{label}</Txt>
    </g>
  );
  return (
    <Svg h={150} label="Bộ nhân tiêu cự làm vùng nhìn hẹp lại">
      {row(40, false, 28, 'tiêu cự f')}
      {row(108, true, 14, 'f × k → vùng nhìn hẹp, mất sáng')}
      <Txt x={75} y={142} sub cls={WARN_TEXT}>bộ nhân ×k</Txt>
    </Svg>
  );
}

const FIGURES: Record<FormulaFigureKey, { render: (uid: string) => ReactNode; caption: string }> = {
  pxPerDefect: { render: () => <PxPerDefect />, caption: 'Ví dụ: lỗi 0,3 mm, tương phản trung bình → 0,3 ÷ 4 = 0,075 mm/px.' },
  tiles: { render: () => <Tiles />, caption: 'Ví dụ: vùng 400 mm, 2 camera → mỗi camera 200 + 20 = 220 mm (chồng lấn lấy số lớn hơn giữa 10 % và 20 px).' },
  tilt: { render: () => <Tilt />, caption: 'Ví dụ: θ = 30° → vùng nhìn theo chiều nghiêng dài × 1,15, số pixel cần nhân theo.' },
  perspective: { render: () => <Perspective />, caption: 'Ví dụ: Δh 2 mm, WD 300 mm, r 50 mm → e = 2 ÷ 300 × 50 = 0,33 mm.' },
  telecentric: { render: () => <Telecentric />, caption: 'Telecentric giữ kích thước khi vật lên xuống; vùng nhìn không lớn hơn ống trước.' },
  lensGeometry: { render: () => <LensGeometry />, caption: 'Ví dụ: f 25, WD 300, sF 5 → β = 25 ÷ 295 = 0,085; cảm biến 8,4 mm → vùng nhìn 99 mm. Chưa khai sF thì coi = 0.' },
  imageCircle: { render: () => <ImageCircle />, caption: 'Ví dụ: cảm biến 2/3" chéo 11 mm → cần vòng ảnh ≥ 11 mm (dung sai 2 %).' },
  dof: { render: () => <Dof />, caption: 'Khép khẩu (F lớn) tăng độ sâu, nhưng quá F#max thì nhiễu xạ làm mờ (OPT-004).' },
  motionBlur: { render: (uid) => <MotionBlur uid={uid} />, caption: 'Ví dụ: 0,05 mm/px, v 1000 mm/s, nhoè 1 px → t ≤ 50 µs. Bài đo nhoè 0,5 px.' },
  triggerShift: { render: (uid) => <TriggerShift uid={uid} />, caption: 'Ví dụ: v 2000 mm/s, cảm biến 0,5 + camera 0,01 ms → ±1,02 mm; vùng nhìn dư ≥ 2Δx. Phần trễ cố định bù bằng trigger delay.' },
  strobe: { render: () => <Strobe />, caption: 'Ví dụ: xung 25 µs × 20 ảnh/s → duty 0,05 %. Overdrive thường tới ~10×, duty 3–10 %.' },
  pipeline: { render: () => <Pipeline />, caption: 'Nhịp chỉ bị chặn bởi khâu chậm nhất (n × max); độ trễ là tổng nối tiếp và phải ≤ khoảng cách tới điểm gạt ÷ v.' },
  overlapRoi: { render: () => <OverlapRoi />, caption: 'Ví dụ: 23 fps, phơi 50 ms → chồng phơi 20 fps, không chồng 10,7 fps. Cắt ROI: fps ≈ fps × hàng cảm biến ÷ hàng ROI.' },
  codeWindow: { render: (uid) => <CodeWindow uid={uid} />, caption: 'Ví dụ: W 46 mm, 3 lần chụp, v 500 mm/s → 3 × 500 ÷ 46 = 32,6 lần/s.' },
  budgetChain: { render: (uid) => <BudgetChain uid={uid} />, caption: 'Ví dụ: ±0,1 mm → T 0,2 → U 0,02 → 0,06 mm/px (÷ 10 Gage R&R, × 3 subpixel).' },
  governing: { render: () => <Governing />, caption: 'Ví dụ: phát hiện 0,075 mm/px, đo 0,06 mm/px → lấy 0,06 (nhánh đo chặt hơn 1,25×).' },
  pixelGrid: { render: () => <PixelGrid />, caption: 'Ví dụ: vùng 120 × 80 mm, 0,06 mm/px → 2000 × 1334 px = 2,67 MP mỗi camera.' },
  lensResolution: { render: () => <LensResolution />, caption: 'Ví dụ: pixel 3,45 µm → cần ≥ 1 ÷ (2 × 0,00345) = 145 lp/mm phía cảm biến.' },
  diffraction: { render: () => <Diffraction />, caption: 'Vệt Airy ≈ 2,44 × λ × F#; khép khẩu quá F#max thì vệt lớn hơn pixel, ảnh mờ dù lấy nét đúng.' },
  thermal: { render: () => <Thermal />, caption: 'Ví dụ: nhôm α 23 µm/(m·K), L 100 mm, ΔT 5 K → ΔL = 11,5 µm.' },
  seam: { render: () => <Seam />, caption: 'Kích thước vắt qua đường ghép mang thêm sai số hiệu chuẩn giữa hai camera (MEC-003).' },
  shutter: { render: () => <Shutter />, caption: 'Vật chạy khi chụp → bắt buộc global shutter; phơi rất ngắn thì thêm đèn strobe (LGT-008).' },
  dataPipe: { render: () => <DataPipe />, caption: 'Ví dụ: 5 MP × 1 byte × 10 ảnh/s = 50 MB/s ≤ 70 % × 110 MB/s (GigE) → đạt.' },
  framesPerTakt: { render: () => <FramesPerTakt />, caption: 'Ví dụ: 600 sản phẩm/phút × 3 ảnh = 30 ảnh/s mỗi camera.' },
  lightTypes: { render: () => <LightTypes />, caption: 'Bốn kiểu đèn hay gặp; bảng chọn theo bề mặt / loại lỗi xem ở trang Chọn đèn — luôn cần chụp mẫu.' },
  confusion: { render: () => <Confusion />, caption: 'Bỏ sót = FN ÷ tổng (ngưỡng 1 %), hao phí = FP ÷ tổng (ngưỡng 5 %).' },
  decisionFlow: { render: (uid) => <DecisionFlow uid={uid} />, caption: 'Rule-based trước (CLAUDE.md §4); chỉ đề xuất học sâu khi biến động ngoại hình lỗi cao.' },
  limitingAxis: { render: () => <LimitingAxis />, caption: 'Vùng cần dài hơn tỉ lệ cảm biến → cạnh dài quyết định β; cạnh ngắn còn dư.' },
  angleOfView: { render: () => <AngleOfView />, caption: 'Góc nhìn = 2 · atan(vùng nhìn ÷ 2 ÷ WD) — đối chiếu với góc ghi trên datasheet ống.' },
  fovTooWide: { render: () => <FovTooWide />, caption: 'Ví dụ: cần 100 × 75, ống cho 365 × 267 → dư 3,6× > 1,5× → loại (LNS-005).' },
  extensionTube: { render: () => <ExtensionTube />, caption: 'Ống nối giúp ống lấy nét gần hơn MOD; tăng phóng đại nhưng mất sáng và giảm chất lượng ở rìa.' },
  converter: { render: () => <Converter />, caption: 'Ví dụ: f 25 mm × 2 = 50 mm → vùng nhìn còn một nửa, mất khoảng 2 stop sáng.' },
};

export function FormulaFigure({ figure, uid }: { figure: FormulaFigureKey; uid: string }) {
  const f = FIGURES[figure];
  return (
    <figure className="max-w-[480px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      {f.render(uid.replace(/[^a-zA-Z0-9-]/g, '-'))}
      <figcaption className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{f.caption}</figcaption>
    </figure>
  );
}
