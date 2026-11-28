/**
 * Cảnh 3D cho hình bước 2 "Điều kiện làm việc" (Chọn ống kính) — chiếu phối cảnh từ một
 * điểm nhìn, để camera, ống kính, chùm tia và mặt vùng nhìn cùng một hình học (2026-11-28).
 *
 * Hệ trục (mm): X = trục quang (từ mặt trước ống kính tới vật), Y = lên, Z = về phía người xem.
 * Mặt trước ống kính ở X = 0, mặt vùng nhìn vuông góc trục quang ở X = D.
 * Điểm nhìn chỉnh để bố cục giống Lens Selector của Hikrobot (camera dưới-trái, vùng nhìn bên
 * phải, nhìn xiên). Chỉ là hình minh hoạ: số liệu thật nằm trong các ô, không đọc từ hình.
 * Góc nhìn và số nét vẽ theo Hik (đối chiếu lại 2026-11-28): 3 tia, cung góc ngang giữa 2 tia
 * tới cạnh trên, cung góc dọc giữa 2 tia tới cạnh phải.
 */

type V3 = [number, number, number];
type V2 = [number, number];

const EYE: V3 = [-728.5, 713.5, 1304.9];
const LOOK: V3 = [202.1, -15.4, -250.9];
const FOCAL = 2473.9;
const CENTER: V2 = [482.9, 256.5];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* Phối cảnh "ống dịch trục" (như ảnh kiến trúc): mặt ảnh đứng thẳng nên mọi cạnh thẳng đứng
   trong cảnh (cạnh cao vùng nhìn, mũi tên chiều cao, cạnh camera) lên hình vẫn thẳng đứng.
   Hướng nhìn vẫn từ EYE tới LOOK; LOOK vẫn rơi đúng CENTER, cỡ hình giữ như phối cảnh cũ.
   k > 1: lùi mắt ra xa k lần, tiêu cự nhân k — bố cục quanh LOOK giữ nguyên, phối cảnh nhẹ đi
   (dùng cho telecentric: đầu ống loe gần mắt không còn trông to hơn vùng nhìn nhiều). */
const UP: V3 = [0, 1, 0];
function makeView(k: number) {
  const eye: V3 = [LOOK[0] + k * (EYE[0] - LOOK[0]), LOOK[1] + k * (EYE[1] - LOOK[1]), LOOK[2] + k * (EYE[2] - LOOK[2])];
  const fwd = unit(sub(LOOK, eye));
  const fwdH = unit([fwd[0], 0, fwd[2]]);
  const right = unit(cross(fwdH, UP));
  const f = k * FOCAL * Math.hypot(fwd[0], fwd[2]);
  const look = sub(LOOK, eye);
  return { eye, fwdH, right, f, shiftY: (f * dot(look, UP)) / dot(look, fwdH) };
}
/** Phép chiếu đang dùng — buildScene đặt lại ở đầu hàm (chạy đồng bộ, lúc nạp module). */
let view = makeView(1);

export function project(p: V3): V2 {
  const d = sub(p, view.eye);
  const z = dot(d, view.fwdH);
  return [CENTER[0] + (view.f * dot(d, view.right)) / z, CENTER[1] - (view.f * dot(d, UP)) / z + view.shiftY];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const xy = (p: V2) => `${r1(p[0])} ${r1(p[1])}`;
const poly = (pts: V2[]) => `M${pts.map(xy).join(' L')} Z`;
const line = (pts: V2[]) => `M${pts.map(xy).join(' L')}`;
/** Mặt nhìn thấy được từ điểm nhìn (pháp tuyến hướng về mắt). */
const facesEye = (center: V3, normal: V3) => dot(normal, sub(view.eye, center)) > 0;

/** Bao lồi (Andrew) — hình chiếu của khối lồi = bao lồi hình chiếu các đỉnh. */
function hull(points: V2[]): V2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V2[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Vòng tròn bán kính r quanh trục quang tại X = x. */
const ring = (x: number, r: number, n = 48): V3[] => Array.from({ length: n }, (_, i) => [x, r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);

/** Nửa vòng nhìn thấy được (pháp tuyến hướng ra ngoài trục, về phía mắt). */
function visibleArc(x: number, r: number): string {
  const n = 72;
  const out: string[] = [];
  let run: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    const p: V3 = [x, r * Math.cos(t), r * Math.sin(t)];
    if (facesEye(p, [0, Math.cos(t), Math.sin(t)])) run.push(project(p));
    else if (run.length) {
      if (run.length > 1) out.push(line(run));
      run = [];
    }
  }
  if (run.length > 1) out.push(line(run));
  return out.join(' ');
}

/** Ống trụ / nón cụt quanh trục quang: bao lồi hai vòng đầu + dải tô bóng vuông góc trục. */
function barrel(x0: number, r0: number, x1: number, r1_: number) {
  const outline = poly(hull([...ring(x0, r0), ...ring(x1, r1_)].map(project)));
  // Dải tô bóng: từ mép trên tới mép dưới của ống, ở giữa chiều dài.
  const xm = (x0 + x1) / 2;
  const rm = Math.max(r0, r1_);
  const a = project([xm, rm, 0]);
  const b = project([xm, -rm, 0]);
  return { outline, shade: { x1: r1(a[0]), y1: r1(a[1]), x2: r1(b[0]), y2: r1(b[1]) } };
}

export type ConditionScene = ReturnType<typeof buildScene>;

export function buildScene(telecentric: boolean) {
  view = makeView(telecentric ? 8 : 1);
  const D = telecentric ? 330 : 400;
  // Telecentric: đầu ống phải phủ hết vùng nhìn → vùng nhìn vẽ nhỏ hơn ống thường một chút.
  const s = telecentric ? 0.525 : 1;
  const W = 260 * s;
  const H = 195 * s;
  const plane = {
    tl: [D, H / 2, -W / 2] as V3,
    tr: [D, H / 2, W / 2] as V3,
    br: [D, -H / 2, W / 2] as V3,
    bl: [D, -H / 2, -W / 2] as V3,
  };
  const corners = [plane.tl, plane.tr, plane.br, plane.bl];
  const P = corners.map(project);

  /* Chùm tia theo cách vẽ của Hik: chỉ 3 tia, tới góc trên-trái, trên-phải, dưới-phải của vùng
     nhìn (góc dưới-trái khuất sau chùm). Ống thường: tia đi từ tâm mặt trước ống; telecentric:
     tia song song trục quang, đi từ mặt trước ống (đã đủ to). */
  const shown = [plane.tl, plane.tr, plane.br];
  const start = (c: V3): V3 => (telecentric ? [0, c[1], c[2]] : [0, 0, 0]);
  const beam = poly(hull([...corners.map(start), ...corners].map(project)));
  const rays = shown.map((c) => line([project(start(c)), project(c)]));

  const center = project([D, 0, 0]);
  const apex = project([0, 0, 0]);
  const cross1 = line([project([D, 0, -W * 0.3]), project([D, 0, W * 0.3])]);
  const cross2 = line([project([D, H * 0.3, 0]), project([D, -H * 0.3, 0])]);
  const lineScan = line([project([D, 0, -W / 2]), project([D, 0, W / 2])]);

  /* Ký hiệu góc theo Hik: một cung có mũi tên hai đầu, tâm ở mặt trước ống.
     Góc ngang = giữa 2 tia tới 2 đầu cạnh trên (cạnh chiều rộng);
     góc dọc = giữa 2 tia tới 2 đầu cạnh phải (cạnh chiều cao). Cung nằm trong mặt phẳng của
     hai tia (nội suy cầu giữa hai hướng), nên hai đầu cung nằm đúng trên hai tia. */
  const arcBetween = (a: V3, b: V3, R: number) => {
    const ua = unit(a);
    const ub = unit(b);
    const omega = Math.acos(Math.min(1, dot(ua, ub)));
    const pts: V2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const ka = Math.sin((1 - t) * omega) / Math.sin(omega);
      const kb = Math.sin(t * omega) / Math.sin(omega);
      pts.push(project([R * (ka * ua[0] + kb * ub[0]), R * (ka * ua[1] + kb * ub[1]), R * (ka * ua[2] + kb * ub[2])]));
    }
    return line(pts);
  };
  const RH = 85;
  const RV = 140;
  const angleH = arcBetween(plane.tl, plane.tr, RH);
  const angleV = arcBetween(plane.tr, plane.br, RV);

  // Kích thước vùng nhìn: rộng theo cạnh trên (nhấc lên 16 mm), cao theo cạnh phải (đẩy ra 16 mm).
  const lift = 16;
  const widthDim = line([project([D, H / 2 + lift, -W / 2]), project([D, H / 2 + lift, W / 2])]);
  const widthTicks = [-W / 2, W / 2].map((z) => line([project([D, H / 2 + 4, z]), project([D, H / 2 + lift + 10, z])]));
  const heightDim = line([project([D, H / 2, W / 2 + lift]), project([D, -H / 2, W / 2 + lift])]);
  const heightTicks = [H / 2, -H / 2].map((y) => line([project([D, y, W / 2 + 4]), project([D, y, W / 2 + lift + 10])]));

  // Telecentric: đầu ống phủ hết đường chéo vùng nhìn.
  const frontR = Math.hypot(W / 2, H / 2) + 2;

  /* Khoảng cách làm việc: từ mặt trước ống tới mặt vật, song song trục quang.
     Ống thường: mũi tên ngay dưới ống, đầu phải chạm mặt vật (như Hik).
     Telecentric: đầu ống to hơn vùng nhìn → mũi tên chạy ngoài vành ống, ở phía mép thấp nhất
     trên hình của vành (để không bị ống che), cách vành 22 mm; đường gióng: từ vành ống ra mũi
     tên, và từ mép dưới vùng nhìn tới đầu mũi tên (nằm trong mặt vật). */
  const wdY = -78;
  const wdDir: V3 = (() => {
    if (!telecentric) return [0, -1, 0];
    let best: V3 = [0, -1, 0];
    for (let i = -90; i <= 90; i++) {
      const t = (i * Math.PI) / 180;
      const u: V3 = [0, -Math.cos(t), Math.sin(t)];
      if (project([0, frontR * u[1], frontR * u[2]])[1] > project([0, frontR * best[1], frontR * best[2]])[1]) best = u;
    }
    return best;
  })();
  const wdR = telecentric ? frontR + 22 : -wdY;
  const wdAt = (x: number, r: number): V3 => [x, r * wdDir[1], r * wdDir[2]];
  const wdA = wdAt(0, wdR);
  const wdB = wdAt(D, wdR);
  const wdDim = line([project(wdA), project(wdB)]);
  const wdTicks = telecentric ? [] : [0, D].map((x) => line([project([x, wdY + 12, 0]), project([x, wdY - 12, 0])]));
  const wdGuide = telecentric
    ? [
        line([project(wdAt(0, frontR)), project(wdAt(0, wdR + 8))]),
        line([project([D, -H / 2, Math.min(Math.max(wdB[2], -W / 2), W / 2)]), project(wdAt(D, wdR + 8))]),
      ].join(' ')
    : line([project([0, -28, 0]), project([0, wdY - 12, 0])]);

  /* Camera: hộp vuông 73 mm, dài 77 mm, nằm sau ống; ống thường dài 91 mm (bằng 70 % bản đầu, to hơn thật
     cho dễ nhìn, giống tỉ lệ hình của Hik). */
  const lensBack = telecentric ? -133 : -91;
  const bx0 = lensBack - 77;
  const bx1 = lensBack;
  const half = 36.5;
  const box: V3[] = [
    [bx0, -half, -half],
    [bx1, -half, -half],
    [bx1, half, -half],
    [bx0, half, -half],
    [bx0, -half, half],
    [bx1, -half, half],
    [bx1, half, half],
    [bx0, half, half],
  ];
  const faceDefs: { idx: number[]; normal: V3; tone: 'top' | 'front' | 'side' | 'back' }[] = [
    { idx: [3, 2, 6, 7], normal: [0, 1, 0], tone: 'top' },
    { idx: [0, 1, 5, 4], normal: [0, -1, 0], tone: 'side' },
    { idx: [4, 5, 6, 7], normal: [0, 0, 1], tone: 'front' },
    { idx: [0, 1, 2, 3], normal: [0, 0, -1], tone: 'side' },
    { idx: [0, 4, 7, 3], normal: [-1, 0, 0], tone: 'back' },
    { idx: [1, 5, 6, 2], normal: [1, 0, 0], tone: 'side' },
  ];
  const faces = faceDefs
    .filter((f) => {
      const c = f.idx.reduce<V3>((acc, i) => [acc[0] + box[i][0] / 4, acc[1] + box[i][1] / 4, acc[2] + box[i][2] / 4], [0, 0, 0]);
      return facesEye(c, f.normal);
    })
    .map((f) => ({ d: poly(f.idx.map((i) => project(box[i]))), tone: f.tone }));
  // Viền trang trí trên mặt trước (+Z) và hai đầu nối ở mặt sau (−X).
  const inset = 7;
  const frontBezel = poly(
    ([
      [bx0 + inset, -half + inset, half],
      [bx1 - inset, -half + inset, half],
      [bx1 - inset, half - inset, half],
      [bx0 + inset, half - inset, half],
    ] as V3[]).map(project)
  );
  const connector = (y: number, z: number) =>
    poly(Array.from({ length: 20 }, (_, i) => project([bx0, y + 6.3 * Math.cos((2 * Math.PI * i) / 20), z + 6.3 * Math.sin((2 * Math.PI * i) / 20)])));
  const connectors = [connector(-15, -13), connector(-15, 13)];

  /* Ống kính: ống thường = trụ có vòng khía; telecentric = trụ nhỏ + nón loe + đầu to. */
  const lens = telecentric
    ? {
        parts: [barrel(-133, 22.5, -105, 22.5), barrel(-105, 22.5, -21, frontR), barrel(-21, frontR, 0, frontR)],
        rings: [visibleArc(-105, 23), visibleArc(-21, frontR + 0.5)],
        rim: visibleArc(0, frontR),
      }
    : {
        parts: [barrel(-91, 24, -83, 24), barrel(-83, 28, 0, 28)],
        rings: [-73, -65, -56, -48, -39].map((x) => visibleArc(x, 28.6)),
        rim: visibleArc(0, 28),
      };

  /* Chỗ đặt ô nhập (góc trên-trái ô, % khung 1200 × 540) — tính từ điểm trên hình, để ô luôn
     nằm cạnh đúng nét nó nói tới. Ô rộng ~140, nhãn + ô cao ~56. */
  const mid = (a: V3, b: V3) => project([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  const pct = (p: V2, dx: number, dy: number) => ({
    x: Math.round(Math.min(Math.max(((p[0] + dx) / 1200) * 100, 0), 88.3) * 10) / 10,
    y: Math.round(Math.min(Math.max(((p[1] + dy - 70) / 540) * 100, 0), 90) * 10) / 10,
  });
  // Điểm giữa hai cung góc.
  const arcMid = (a: V3, b: V3, R: number) => {
    const m = unit([unit(a)[0] + unit(b)[0], unit(a)[1] + unit(b)[1], unit(a)[2] + unit(b)[2]]);
    return project([R * m[0], R * m[1], R * m[2]]);
  };
  const hMid = arcMid(plane.tl, plane.tr, RH);
  const vMid = arcMid(plane.tr, plane.br, RV);
  const anchors = {
    fovW: pct(mid([D, H / 2 + lift, -W / 2], [D, H / 2 + lift, W / 2]), -23, telecentric ? -108 : -78),
    mmpx: pct(P[1], telecentric ? 46 : 26, telecentric ? -96 : -56),
    fovH: pct(mid([D, H / 2, W / 2 + lift], [D, -H / 2, W / 2 + lift]), 22, telecentric ? -39 : -64),
    beta: pct(P[2], telecentric ? 10 : -32, telecentric ? 40 : 20),
    wd: pct(mid(wdA, wdB), telecentric ? 10 : -60, telecentric ? 40 : 30),
    f: pct(project([lensBack / 2, 28, 0]), -25, 155),
    res: pct(project([bx0 + 38, half, 0]), -118, -87),
    aovH: pct(hMid, -32, -94),
    aovV: pct(vMid, 6, -46),
  };

  return {
    anchors,
    plane: poly(P),
    corners: { tl: P[0], tr: P[1], br: P[2], bl: P[3] },
    beam,
    rays,
    center,
    apex,
    cross: [cross1, cross2],
    lineScan,
    angleH,
    angleV,
    widthDim,
    widthTicks,
    heightDim,
    heightTicks,
    wdDim,
    wdTicks,
    wdGuide,
    faces,
    frontBezel,
    connectors,
    lens,
  };
}
