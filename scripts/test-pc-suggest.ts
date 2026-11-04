/**
 * Test tab Gợi ý PC Vision (src/lib/pc/suggest.ts) bằng cách ĐỐI CHIẾU với chính logic của mẫu
 * đã duyệt (docs/pc-vision/1_mau_trang_pc_vision.html: tinh(), danhGia()).
 *
 * Script của mẫu chạy trong vm với `document` giả; bảng băng thông GT của mẫu được thay bằng
 * số ngưỡng engine (chốt Q2); 2026-11-04 bỏ "1 camera GigE đi LAN onboard" của mẫu (cổng LAN có sẵn để
 * cho mạng nhà máy; phép so dùng khung 1 LAN như mẫu nên không còn cổng dư); còn lại giữ nguyên.
 * Camera trong phép so đều đơn sắc (mẫu không có ô màu). Hai bên phải ra cùng: RAM cần, ảnh lưu,
 * số khe, tổng MB/s, và với từng khung — mức đánh giá, cấu hình được chọn, số lưu ý, thứ tự.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { readPcSeed } from '../src/lib/pc/devSeed';
import {
  PC_INTERFACE_KEYS,
  PC_RESOLUTION_KEYS,
  imageCapacityTb,
  interfaceBandwidth,
  framePower,
  mbInRam,
  mbPerFrame,
  suggestPc,
  type PcAiMode,
  type PcImageFormat,
  type PcInterface,
  type PcResolution,
  type PcSuggestInput,
} from '../src/lib/pc/suggest';
import { fpsTable } from '../src/lib/pc/fps';
import { PC_RESOLUTIONS, resolutionLabel } from '../src/lib/pc/options';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/lib/vision/engineParams';

// ── Nạp logic của mẫu ──
type MockCam = { ten: string; dp: string; bit: number; fps: number; gt: string; luu: number };
type MockChung = { ai: string; ca: boolean; luuAnh: boolean; gio: number; ng: number; ngNgay: number; ngNen: number; okNgay: number; okN: number; okNen: number };
type MockKq = { canRam: number; tb: number; khe: number; tongMbs: number };
type MockVerdict = { k: { id: string }; c: { ten: string }; can: string[]; muc: 'dat' | 'can' | 'khong' };

const MOCK_IFACE: Record<PcInterface, string> = {
  GigE: 'GigE', '2.5GigE': '2.5GigE', '5GigE': '5GigE', '10GigE': '10GigE', USB3: 'USB3',
  'CameraLink-Base': 'CL Base', 'CameraLink-Medium': 'CL Medium', 'CameraLink-Full': 'CL Full', 'CameraLink-Deca': 'CL Deca',
  'CXP-12x1': 'CXP-12 ×1', 'CXP-12x4': 'CXP-12 ×4',
};
/** Nhãn độ phân giải trong DP của mẫu — mẫu chỉ có 6 mức; loadMock() nạp đủ danh sách hiện tại vào DP. */
const MOCK_RES = (key: PcResolution) => resolutionLabel(key);
const MOCK_AI: Record<PcAiMode, string> = { none: 'khong', inference: 'suy_luan', training: 'huan_luyen' };
const MOCK_FMT: Record<PcImageFormat, number> = { raw: 1, png: 0.5, jpeg: 0.1 };

function loadMock() {
  const html = readFileSync('docs/pc-vision/1_mau_trang_pc_vision.html', 'utf8');
  const raw = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // Quy định 2026-11-04: không cắm camera vào cổng LAN có sẵn → mẫu tính khe với 0 camera đi LAN.
  const ONBOARD = 'Math.max(0, gige - 1)';
  assert.equal(raw.split(ONBOARD).length, 2, 'mẫu phải có đúng một chỗ trừ camera đi LAN onboard');
  // Chốt 2026-11-04 Q1–Q3: RAM 10–16 bit 2 byte/px, nền + mức dùng tối đa theo ngưỡng engine.
  const DEM = 'const dem = r.reduce((a, x) => a + x.mbk * 20, 0) / 1024;';
  const CAN = 'const canRam = dem + 12 + (CHUNG.ai !== "khong" ? 8 : 0) + (CHUNG.ai === "huan_luyen" ? 16 : 0);';
  for (const line of [DEM, CAN]) assert.equal(raw.split(line).length, 2, `mẫu phải có đúng một dòng: ${line}`);
  const script = raw
    .replace(ONBOARD, 'Math.max(0, gige - 0)')
    .replace(DEM, `const dem = r.reduce((a, x) => a + DP[x.dp][0] * DP[x.dp][1] * (x.bit <= 8 ? 1 : 2) / 1e6 * ${P.pcRamBufferFrames}, 0) / 1024;`)
    .replace(CAN, `const canRam = (dem + ${P.pcRamBaseGb} + (CHUNG.ai !== "khong" ? ${P.pcRamAiGb} : 0) + (CHUNG.ai === "huan_luyen" ? ${P.pcRamTrainGb} : 0)) / ${P.pcRamMaxUse};`);
  const element = () => ({ innerHTML: '', textContent: '', dataset: {}, onclick: null, classList: { add() {}, remove() {}, toggle() {} } });
  const document = { getElementById: element, querySelectorAll: () => [], documentElement: { dataset: {} } };
  const context = vm.createContext({ document });
  const api = vm.runInContext(
    `${script}
     ;({ KH, GT, DP, tinh, danhGia, set: (cam, chung) => { CAM = cam; CHUNG = chung; }, fps: (ms) => { PHOI = ms; return veFps(); } })`,
    context
  ) as {
    KH: { id: string }[];
    GT: Record<string, number>;
    DP: Record<string, [number, number]>;
    tinh: () => MockKq;
    danhGia: (k: unknown, kq: MockKq) => MockVerdict;
    set: (cam: MockCam[], chung: MockChung) => void;
    fps: (exposureMs: number) => string;
  };
  // Khung A: Hùng xác nhận RAM + SSD công nghiệp (2026-11-04) — mẫu vẫn ghi '?', chỉnh cho khớp danh mục.
  for (const k of api.KH as { id: string; rd: string; sd: string }[]) if (k.id === 'A') k.rd = k.sd = 'I';
  // 2026-11-04: danh sách độ phân giải mở rộng từ kho thật — thay DP của mẫu bằng đủ danh sách, đúng thứ tự.
  for (const key of Object.keys(api.DP)) delete api.DP[key];
  for (const key of PC_RESOLUTION_KEYS) api.DP[MOCK_RES(key)] = [PC_RESOLUTIONS[key][0], PC_RESOLUTIONS[key][1]];
  // Q2: băng thông theo bảng engine, không theo số của mẫu.
  for (const key of PC_INTERFACE_KEYS) api.GT[MOCK_IFACE[key]] = interfaceBandwidth(P, key);
  return api;
}

/** Mẫu: tinh() + danhGia() cho mọi khung, xếp như veGoiY(). */
function runMock(api: ReturnType<typeof loadMock>, input: PcSuggestInput) {
  const s = input.storage;
  api.set(
    input.cameras.map((c, i) => ({ ten: `Cam ${i}`, dp: MOCK_RES(c.resolution), bit: c.bit, fps: c.fps, gt: MOCK_IFACE[c.iface], luu: c.inspectPerSec })),
    {
      ai: MOCK_AI[input.ai], ca: input.line247, luuAnh: s !== null,
      gio: s?.hoursPerDay ?? 20, ng: s?.ngPercent ?? 1, ngNgay: s?.ngDays ?? 30, ngNen: MOCK_FMT[s?.ngFormat ?? 'png'],
      okNgay: s?.okDays ?? 7, okN: s?.okEveryN ?? 10, okNen: MOCK_FMT[s?.okFormat ?? 'jpeg'],
    }
  );
  const kq = api.tinh();
  const rank = { dat: 0, can: 1, khong: 2 };
  const frames = api.KH.map((k, i) => ({ ...api.danhGia(k, kq), i })).sort(
    (a, b) => rank[a.muc] - rank[b.muc] || a.can.length - b.can.length || a.i - b.i
  );
  return { kq, frames };
}

// ── Sinh bộ camera ngẫu nhiên có hạt giống (lặp lại được) ──
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
function randomInput(r: () => number): PcSuggestInput {
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  // Đa số GigE như dự án thật; thỉnh thoảng giao tiếp khác.
  const iface = (): PcInterface => (r() < 0.55 ? 'GigE' : pick(PC_INTERFACE_KEYS));
  const cameras = Array.from({ length: 1 + Math.floor(r() * 12) }, () => ({
    resolution: pick(PC_RESOLUTION_KEYS),
    color: false,
    poe: true,
    bit: pick([8, 8, 10, 12, 16]),
    fps: pick([1, 2, 5, 10, 15, 30, 60]),
    iface: iface(),
    inspectPerSec: pick([0.5, 1, 2, 5]),
  }));
  const formats: PcImageFormat[] = ['raw', 'png', 'jpeg'];
  return {
    cameras,
    ai: pick<PcAiMode>(['none', 'inference', 'training']),
    line247: r() < 0.7,
    storage:
      r() < 0.5
        ? null
        : {
            hoursPerDay: pick([8, 16, 20, 24]), ngPercent: pick([0.5, 1, 5]), ngDays: pick([7, 30, 90]), ngFormat: pick(formats),
            okDays: pick([0, 3, 7]), okEveryN: pick([1, 10, 50]), okFormat: pick(formats),
          },
  };
}

const seed = readPcSeed();
/** Khung như mẫu (1 LAN) — để so 1:1 với mẫu đã bỏ "camera đi LAN onboard". Danh mục thật có 2 LAN. */
const mockFrames = seed.frames.map((f) => (f.lanPorts > 0 ? { ...f, lanPorts: 1 } : f));
/** Mẫu không tính công suất bản thân card và USB3 qua cáp (PC-POWER, chốt 2026-11-04) — đặt 0 khi so với mẫu. */
const PM = { ...P, pcCardGigePoeW: 0, pcCardTenGigeW: 0, pcCardUsbW: 0, pcCardClW: 0, pcCardCxpW: 0, pcUsbBusPowerW: 0 };
const slugOf = new Map(seed.frames.map((f) => [f.id, f.slug]));
const nameOf = new Map(seed.configs.map((c) => [c.id, c.shortName]));

test('khớp mẫu đã duyệt trên ví dụ mặc định của mẫu (2 cam GigE, AI suy luận, 24/7)', () => {
  const input: PcSuggestInput = {
    cameras: [
      { resolution: '2448x2048', color: false, poe: true, bit: 8, fps: 10, iface: 'GigE', inspectPerSec: 2 },
      { resolution: '4096x3000', color: false, poe: true, bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 },
    ],
    ai: 'inference',
    line247: true,
    storage: null,
  };
  const out = suggestPc(input, seed.frames, seed.configs, P);
  assert.equal(Math.ceil(out.ramGb), 24); // (8 + đệm 0,6 + AI 8) ÷ 0,7 = 23,7 GB
  assert.equal(out.slots, 1);
  assert.equal(out.poeW, 26);
  assert.equal(Math.round(out.totalMbps), 112);
  assert.deepEqual(
    out.frames.map((f) => `${slugOf.get(f.frameId)}:${f.level}:${f.configId ? nameOf.get(f.configId) : '-'}`),
    ['Ct:ok:Ct1', 'C:ok:C1', 'D:ok:D1', 'A:no:A1', 'B:no:B2', 'P:no:P1']
  );
});

test('khớp logic mẫu trên 300 bộ camera ngẫu nhiên', () => {
  const api = loadMock();
  const r = rng(20261103);
  const seen = new Map<string, number>();
  for (let n = 0; n < 300; n++) {
    const input = randomInput(r);
    const mine = suggestPc(input, mockFrames, seed.configs, PM);
    const mock = runMock(api, input);
    const label = `ca ${n}: ${JSON.stringify(input)}`;

    assert.ok(Math.abs(mine.ramGb - mock.kq.canRam) < 1e-9, `${label} — RAM`);
    assert.ok(Math.abs(mine.totalMbps - mock.kq.tongMbs) < 1e-9, `${label} — MB/s`);
    assert.equal(mine.slots, mock.kq.khe, `${label} — số khe`);
    assert.ok(Math.abs((mine.storage?.totalTb ?? 0) - mock.kq.tb) < 1e-9, `${label} — ảnh lưu`);
    const got = mine.frames.map((f) => [slugOf.get(f.frameId), f.level, f.configId ? nameOf.get(f.configId) : null, f.warn.length]);
    // Mảng tạo trong vm thuộc realm khác — qua JSON để so giá trị, không so prototype.
    const want = JSON.parse(JSON.stringify(mock.frames.map((f) => [f.k.id, { dat: 'ok', can: 'warn', khong: 'no' }[f.muc], f.c.ten, f.can.length])));
    assert.deepEqual(got, want, `${label}\n  ra:   ${JSON.stringify(got)}\n  mẫu:  ${JSON.stringify(want)}`);
    for (const f of mine.frames) for (const key of [f.level, ...f.warn.map((w) => w.key)]) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  // Bộ ngẫu nhiên phải chạm đủ ba mức và mọi loại lưu ý, nếu không phép so khớp chưa nói được gì.
  // line247Unknown: danh mục không còn khung '?' — kiểm riêng ở test dưới.
  for (const key of ['ok', 'warn', 'no', 'trainVram', 'storageOver', 'line247Commercial', 'power', 'largeImageAi']) {
    assert.ok((seen.get(key) ?? 0) > 0, `bộ ngẫu nhiên chưa có ca "${key}"`);
  }
});

test('công thức từng phần', () => {
  assert.equal(mbPerFrame('2448x2048', 8), 2448 * 2048 / 1e6);
  assert.equal(mbPerFrame('2448x2048', 12), (2448 * 2048 * 1.5) / 1e6);
  assert.equal(mbPerFrame('2448x2048', 16), (2448 * 2048 * 2) / 1e6);
  assert.equal(interfaceBandwidth(P, 'CXP-12x4'), 4 * P.bwCxpTwelve);
  assert.equal(interfaceBandwidth(P, '2.5GigE'), 280);
  const c3 = seed.configs.find((c) => c.shortName === 'C3')!;
  const c1 = seed.configs.find((c) => c.shortName === 'C1')!;
  assert.ok(Math.abs(imageCapacityTb(P, c3) - 1.8) < 1e-9, 'ổ 2TB × 90 %');
  assert.ok(Math.abs(imageCapacityTb(P, c1) - (1024 * 0.9 - 150) / 1024) < 1e-9, 'phân vùng trên SSD 1TB');
});

test('Q7: 24/7 trên khung dòng thường là LƯU Ý, không phải loại', () => {
  const out = suggestPc(
    { cameras: [{ resolution: '1280x1024', color: false, poe: true, bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 }], ai: 'none', line247: true, storage: null },
    seed.frames.map((f) => (f.slug === 'B' ? { ...f, ramLine: 'C' as const } : f)),
    seed.configs,
    P
  );
  const b = out.frames.find((f) => slugOf.get(f.frameId) === 'B')!;
  assert.equal(b.level, 'warn');
  assert.deepEqual(b.warn.map((w) => w.key), ['line247Commercial']);
});

test('khung / cấu hình ngừng dùng không được gợi ý', () => {
  const out = suggestPc(
    { cameras: [{ resolution: '2448x2048', color: false, poe: true, bit: 8, fps: 10, iface: 'GigE', inspectPerSec: 1 }], ai: 'inference', line247: true, storage: null },
    seed.frames.map((f) => (f.slug === 'Ct' ? { ...f, status: 'retired' as const } : f)),
    seed.configs.map((c) => (c.shortName === 'C1' ? { ...c, status: 'retired' as const } : c)),
    P
  );
  assert.ok(!out.frames.some((f) => slugOf.get(f.frameId) === 'Ct'));
  assert.equal(nameOf.get(out.frames[0].configId!), 'C2');
});

test('bảng fps khớp veFps() của mẫu: số, dấu * và màu, ở nhiều mức phơi sáng', () => {
  const api = loadMock();
  const band = { 'c-do': 'low', 'c-vang': 'mid', 'c-xanh': 'high' } as const;
  for (const exposure of [0, 0.5, 5, 20, 33.3, 100, 250]) {
    const html = api.fps(exposure);
    const want = [...html.matchAll(/<td class="so (c-do|c-vang|c-xanh)"[^>]*>(\d+)(\*?)<\/td>/g)].map((m) => [
      Number(m[2]),
      m[3] === '*',
      band[m[1] as keyof typeof band],
    ]);
    const got = fpsTable(P, exposure).rows.flatMap((row) => row.cells.map((c) => [c.fps, c.limitedByExposure, c.band]));
    assert.equal(want.length, PC_RESOLUTION_KEYS.length * 11, 'mẫu phải có đủ ô');
    assert.deepEqual(got, want, `exposure ${exposure} ms`);
  }
});

test('khung chưa rõ dòng RAM/SSD (?) trên dây chuyền 24/7 → lưu ý kiểm tra trước', () => {
  const out = suggestPc(
    { cameras: [{ resolution: '1280x1024', color: false, poe: true, bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 }], ai: 'none', line247: true, storage: null },
    seed.frames.map((f) => (f.slug === 'A' ? { ...f, ramLine: '?' as const, ssdLine: '?' as const } : f)),
    seed.configs,
    P
  );
  const a = out.frames.find((f) => slugOf.get(f.frameId) === 'A')!;
  assert.deepEqual(a.warn.map((w) => w.key), ['line247Unknown']);
});

test('cổng LAN có sẵn để cho mạng nhà máy; cổng dư chỉ nhận camera GigE nguồn ngoài, camera PoE luôn đi card PoE', () => {
  const gige = (n: number, poe: boolean) =>
    Array.from({ length: n }, () => ({ resolution: '2448x2048' as const, color: false, poe, bit: 8, fps: 5, iface: 'GigE' as const, inspectPerSec: 1 }));
  const run = (n: number, poe: boolean, frames = seed.frames, params = P) =>
    suggestPc({ cameras: gige(n, poe), ai: 'none', line247: false, storage: null }, frames, seed.configs, params);
  const frame = (out: ReturnType<typeof run>, slug: string) => out.frames.find((f) => slugOf.get(f.frameId) === slug)!;
  const ports = (out: ReturnType<typeof run>, slug: string) => frame(out, slug).ok.find((n) => n.key === 'ports')?.values;

  // Danh mục: khung A–D có 2 cổng LAN (Hùng xác nhận 2026-11-04), P giữ 0.
  assert.deepEqual(seed.frames.map((f) => `${f.slug}:${f.lanPorts}`), ['A:2', 'B:2', 'Ct:2', 'C:2', 'D:2', 'P:0']);
  // Ô tổng: mọi camera GigE qua card 4 cổng.
  assert.deepEqual([1, 4, 5, 8, 9].map((n) => run(n, true).slots), [1, 1, 2, 2, 3]);
  // Camera PoE: không cắm cổng LAN dư → 5 camera cần 2 khe trên khung B.
  assert.deepEqual(ports(run(5, true), 'B'), { need: 2, have: 3, lan: 0 });
  // Camera nguồn ngoài: 1 cắm cổng LAN dư, 4 qua card → 1 khe.
  assert.deepEqual(ports(run(5, false), 'B'), { need: 1, have: 3, lan: 1 });
  // Khung A (0 khe, 2 LAN): nhận 1 camera GigE nguồn ngoài; camera PoE thì cần card → không hợp.
  assert.deepEqual(ports(run(1, false), 'A'), { need: 0, have: 0, lan: 1 });
  assert.deepEqual(frame(run(1, true), 'A').no.map((n) => n.key), ['slots']);
  assert.deepEqual(frame(run(2, false), 'A').no.map((n) => n.key), ['slots']);
  // Khung chỉ 1 LAN: không còn cổng dư.
  assert.deepEqual(ports(run(5, false, mockFrames), 'B'), { need: 2, have: 3, lan: 0 });
  // Admin đặt 0 cổng để dành → cả 2 cổng nhận camera nguồn ngoài.
  assert.deepEqual(ports(run(5, false, seed.frames, { ...P, pcLanReservedPorts: 0 }), 'B'), { need: 1, have: 3, lan: 2 });
  // Khung P (0 khe, 0 LAN) vẫn là máy phụ trợ.
  assert.ok(frame(run(1, true), 'P').no.some((n) => n.key === 'aux'));
});

test('camera màu: đệm ảnh RAM nhân hệ số màu, băng thông không đổi', () => {
  const cam = (color: boolean) => ({ resolution: '5120x5120' as const, color, poe: true, bit: 8, fps: 5, iface: 'GigE' as const, inspectPerSec: 1 });
  const run = (color: boolean) => suggestPc({ cameras: [cam(color), cam(color)], ai: 'none', line247: false, storage: null }, seed.frames, seed.configs, P);
  const mono = run(false), color = run(true);
  const extra = (2 * mbPerFrame('5120x5120', 8) * P.pcRamBufferFrames * (P.pcRamColorFactor - 1)) / 1024;
  assert.ok(Math.abs(color.ram.bufferGb - mono.ram.bufferGb - extra) < 1e-9);
  assert.ok(Math.abs(color.ramGb - mono.ramGb - extra / P.pcRamMaxUse) < 1e-9);
  assert.equal(color.totalMbps, mono.totalMbps);
  assert.equal(P.pcRamColorFactor, 3);
});

test('RAM: mức dùng tối đa, 10–16 bit 2 byte/px trong RAM, các ví dụ trong sổ tay', () => {
  const run = (cameras: PcSuggestInput['cameras'], ai: PcAiMode) => suggestPc({ cameras, ai, line247: false, storage: null }, seed.frames, seed.configs, P);
  const cam = (resolution: PcResolution, color: boolean, bit = 8) => ({ resolution, color, poe: false, bit, fps: 1, iface: 'CXP-12x4' as const, inspectPerSec: 1 });
  assert.equal(P.pcRamBaseGb, 8);
  assert.equal(P.pcRamMaxUse, 0.7);
  // 10/12 bit: băng thông 1,5 byte, RAM 2 byte.
  assert.equal(mbInRam(P, '2448x2048', 12, false), (2448 * 2048 * 2) / 1e6);
  assert.equal(mbPerFrame('2448x2048', 12), (2448 * 2048 * 1.5) / 1e6);
  // 1 cam 5MP màu + AI: (8 + 0,29 + 8) ÷ 0,7 = 23,3 GB → khung C chọn 32 GB.
  const one = run([cam('2448x2048', true)], 'inference');
  assert.equal((Math.ceil(one.ramGb * 10) / 10).toFixed(1), '23.3');
  assert.ok(Math.abs(one.ram.sumGb - one.ramGb * 0.7) < 1e-9);
  // 2 cam 65MP màu + AI: 33,9 GB (làm tròn lên) → không còn chọn 32 GB.
  const big = run([cam('9344x7000', true), cam('9344x7000', true)], 'inference');
  assert.equal((Math.ceil(big.ramGb * 10) / 10).toFixed(1), '33.9');
  const d = big.frames.find((f) => slugOf.get(f.frameId) === 'D')!;
  assert.equal(nameOf.get(d.configId!), 'D1');
  assert.ok(seed.configs.find((c) => c.id === d.configId)!.ramGb >= 64);
  // Máy được chọn luôn còn ≥ 30 % dự phòng.
  for (const f of big.frames.filter((f) => f.level !== 'no')) assert.ok(big.ram.sumGb / seed.configs.find((c) => c.id === f.configId)!.ramGb <= 0.7);
});

test('công suất tổng = tải đỉnh + card + PoE + USB3; camera nguồn ngoài không tính', () => {
  const cam = (iface: PcInterface, poe: boolean) => ({ resolution: '2448x2048' as const, color: false, poe, bit: 8, fps: 5, iface, inspectPerSec: 1 });
  const run = (cameras: PcSuggestInput['cameras']) => suggestPc({ cameras, ai: 'none', line247: false, storage: null }, seed.frames, seed.configs, P);
  const frame = (out: ReturnType<typeof run>, slug: string) => out.frames.find((f) => slugOf.get(f.frameId) === slug)!;
  const note = (out: ReturnType<typeof run>, slug: string) =>
    [...frame(out, slug).ok, ...frame(out, slug).warn].find((n) => n.key === 'powerOk' || n.key === 'power')!.values!;
  assert.deepEqual([P.pcCardGigePoeW, P.pcCardTenGigeW, P.pcCardUsbW, P.pcCardClW, P.pcCardCxpW, P.pcUsbBusPowerW], [6, 12, 5, 10, 25, 4.5]);

  // Ví dụ trong sổ tay: khung C, 5 camera GigE PoE → 2 card PoE: 570 + 12 + 65 = 647 W = 65 %.
  const five = run(Array.from({ length: 5 }, () => cam('GigE', true)));
  assert.equal(five.poeCameras, 5);
  assert.deepEqual(frame(five, 'C').power, {
    peakW: 570, cardsW: 12, poeCameras: 5, poeEachW: 13, poeW: 65, usbCameras: 0, usbEachW: 4.5, usbW: 0, loadW: 647, psuW: 1000, share: 0.647,
  });
  assert.deepEqual(note(five, 'C'), { load: 647, peak: 570, cards: 12, n: 5, w: 13, usbN: 0, usbW: 4.5, psu: 1000, pct: 65, max: 70 });
  assert.deepEqual(frame(five, 'C').info, []);

  // Camera nguồn ngoài: không PoE, 1 cắm LAN dư → 1 card PoE (6 W).
  const external = run(Array.from({ length: 5 }, () => cam('GigE', false)));
  assert.equal(frame(external, 'C').power.loadW, 570 + 6);

  // USB3 qua cáp + card USB3; 10GigE, CXP nguồn ngoài nhưng card / frame grabber vẫn tính.
  const mixed = run([cam('USB3', false), cam('USB3', false), cam('10GigE', true), cam('CXP-12x4', true)]);
  assert.equal(mixed.poeCameras, 0);
  const d = frame(mixed, 'D').power;
  assert.equal(d.cardsW, 5 + 12 + 25);
  assert.equal(d.usbW, 2 * 4.5);
  assert.equal(d.loadW, 680 + 42 + 9);

  // Khung không có khe card: chỉ tải đỉnh.
  const none = framePower(P, { peakLoadW: 120, psuW: 250, cardSlots: 0 }, { gige: 1, tenGige: 0, usb: 0, cl: 0, cxp: 0 }, 1, 0);
  assert.equal(none.loadW, 120);
});
