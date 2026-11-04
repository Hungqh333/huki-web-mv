/**
 * Test tab Gợi ý PC Vision (src/lib/pc/suggest.ts) bằng cách ĐỐI CHIẾU với chính logic của mẫu
 * đã duyệt (docs/pc-vision/1_mau_trang_pc_vision.html: tinh(), danhGia()).
 *
 * Script của mẫu chạy trong vm với `document` giả; bảng băng thông GT của mẫu được thay bằng
 * số ngưỡng engine (chốt Q2), còn lại giữ nguyên. Hai bên phải ra cùng: RAM cần, ảnh lưu,
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
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
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
const slugOf = new Map(seed.frames.map((f) => [f.id, f.slug]));
const nameOf = new Map(seed.configs.map((c) => [c.id, c.shortName]));

test('khớp mẫu đã duyệt trên ví dụ mặc định của mẫu (2 cam GigE, AI suy luận, 24/7)', () => {
  const input: PcSuggestInput = {
    cameras: [
      { resolution: '2448x2048', bit: 8, fps: 10, iface: 'GigE', inspectPerSec: 2 },
      { resolution: '4096x3000', bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 },
    ],
    ai: 'inference',
    line247: true,
    storage: null,
  };
  const out = suggestPc(input, seed.frames, seed.configs, P);
  assert.equal(Math.ceil(out.ramGb), 21);
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
    const mine = suggestPc(input, seed.frames, seed.configs, P);
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
    { cameras: [{ resolution: '1280x1024', bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 }], ai: 'none', line247: true, storage: null },
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
    { cameras: [{ resolution: '2448x2048', bit: 8, fps: 10, iface: 'GigE', inspectPerSec: 1 }], ai: 'inference', line247: true, storage: null },
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
    { cameras: [{ resolution: '1280x1024', bit: 8, fps: 5, iface: 'GigE', inspectPerSec: 1 }], ai: 'none', line247: true, storage: null },
    seed.frames.map((f) => (f.slug === 'A' ? { ...f, ramLine: '?' as const, ssdLine: '?' as const } : f)),
    seed.configs,
    P
  );
  const a = out.frames.find((f) => slugOf.get(f.frameId) === 'A')!;
  assert.deepEqual(a.warn.map((w) => w.key), ['line247Unknown']);
});
