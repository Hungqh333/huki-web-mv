/**
 * PC Vision — tab Gợi ý cấu hình (gói bàn giao 03/11/2026 mục 5, mẫu docs/pc-vision/1_mau_trang_pc_vision.html:
 * tinh(), danhGia()). Chỉ tính để xem, không lưu.
 *
 * Nhập camera của dự án → băng thông, RAM, ảnh lưu, khe card → với mỗi khung lấy cấu hình
 * NHỎ NHẤT đủ dùng, đánh giá Đạt / Đạt có lưu ý / Không hợp, xếp thứ tự.
 *
 * Chạy ở MÁY CHỦ (server action suggestPcAction) — file 'use client' không import file này.
 * Mọi hằng số là ngưỡng engine (nhóm `pc` + băng thông `interfaces`), sửa ở trang admin (Q5).
 * Thay đổi so với mẫu đã được chốt: băng thông lấy bảng engine (Q2), câu 24/7 dòng C (Q7);
 * 2026-11-04: camera màu nhân đệm RAM (pcRamColorFactor), cổng LAN có sẵn để cho mạng nhà máy —
 * camera GigE chỉ dùng số cổng LAN còn lại sau khi trừ pcLanReservedPorts, còn lại qua card PoE.
 */

import type { EngineParams } from '@/lib/vision/engineParams';
import { interfaceBandwidthFor } from '@/lib/vision/engineParams';
import { compareConfigs, type PcConfig, type PcFrame } from './code';
import { PC_RESOLUTIONS, type PcInterface, type PcResolution } from './options';

export { PC_INTERFACE_KEYS, PC_RESOLUTION_KEYS, type PcInterface, type PcResolution } from './options';

/** Giao tiếp → chuẩn trong bảng băng thông engine + số làn + nhóm tính khe. */
const PC_INTERFACES: Record<PcInterface, { bw: string; lanes: number; group: SlotGroup }> = {
  GigE: { bw: 'GigE', lanes: 1, group: 'gige' },
  '2.5GigE': { bw: '2.5GigE', lanes: 1, group: 'gige' },
  '5GigE': { bw: '5GigE', lanes: 1, group: 'gige' },
  '10GigE': { bw: '10GigE', lanes: 1, group: 'tenGige' },
  USB3: { bw: 'USB3', lanes: 1, group: 'usb' },
  'CameraLink-Base': { bw: 'CameraLink-Base', lanes: 1, group: 'clBase' },
  'CameraLink-Medium': { bw: 'CameraLink-Medium', lanes: 1, group: 'clOne' },
  'CameraLink-Full': { bw: 'CameraLink-Full', lanes: 1, group: 'clOne' },
  'CameraLink-Deca': { bw: 'CameraLink-Deca', lanes: 1, group: 'clOne' },
  'CXP-12x1': { bw: 'CXP-12', lanes: 1, group: 'cxp1' },
  'CXP-12x4': { bw: 'CXP-12', lanes: 4, group: 'cxp4' },
};
type SlotGroup = 'gige' | 'tenGige' | 'usb' | 'clBase' | 'clOne' | 'cxp1' | 'cxp4';

export type PcAiMode = 'none' | 'inference' | 'training';
export type PcImageFormat = 'raw' | 'png' | 'jpeg';

export type PcCameraInput = {
  resolution: PcResolution;
  bit: number;
  /** Camera màu: ảnh đệm sau giải Bayer nặng gấp pcRamColorFactor lần (chỉ ảnh hưởng RAM). */
  color: boolean;
  fps: number;
  iface: PcInterface;
  /** Ảnh kiểm mỗi giây — chỉ dùng khi bật tính lưu ảnh. */
  inspectPerSec: number;
};

export type PcStorageInput = {
  hoursPerDay: number;
  ngPercent: number;
  ngDays: number;
  ngFormat: PcImageFormat;
  okDays: number;
  okEveryN: number;
  okFormat: PcImageFormat;
};

export type PcSuggestInput = {
  cameras: PcCameraInput[];
  ai: PcAiMode;
  line247: boolean;
  /** null = không tính dung lượng lưu ảnh (mặc định). */
  storage: PcStorageInput | null;
};

/** Câu hiện trên thẻ: khoá dịch pcVision.suggest.notes.<key> + số điền vào. */
export type PcNote = { key: string; values?: Record<string, string | number> };
export type PcLevel = 'ok' | 'warn' | 'no';

export type PcFrameVerdict = {
  frameId: string;
  /** Cấu hình nhỏ nhất đủ dùng (hoặc gần nhất khi không đủ). null = khung không có cấu hình đang dùng. */
  configId: string | null;
  level: PcLevel;
  ok: PcNote[];
  warn: PcNote[];
  no: PcNote[];
  info: PcNote[];
};

export type PcCameraResult = {
  mbPerFrame: number;
  mbps: number;
  /** MB/s ÷ băng thông giao tiếp. */
  portShare: number;
  overShare: boolean;
  /** fps tối đa ở ngưỡng tỉ lệ cổng — chỉ khi vượt. */
  maxFps: number | null;
};

export type PcSuggestResult = {
  cameras: PcCameraResult[];
  totalMbps: number;
  ramGb: number;
  storage: { ngTb: number; okTb: number; totalTb: number; rawTb: number } | null;
  /** Khe card cần khi mọi camera GigE đi card PoE (không dùng cổng LAN có sẵn). Từng khung tính lại theo số cổng LAN dư. */
  slots: number;
  gige: number;
  poeW: number;
  frames: PcFrameVerdict[];
};

/** PC-BW: MB mỗi khung = W × H × byte/px (8 bit 1 · 10/12 bit 1,5 · 16 bit 2) / 1e6. */
export function mbPerFrame(resolution: PcResolution, bit: number): number {
  const [w, h] = PC_RESOLUTIONS[resolution];
  return (w * h * (bit <= 8 ? 1 : bit <= 12 ? 1.5 : 2)) / 1e6;
}

/** Băng thông hữu dụng một camera (MB/s) theo ngưỡng engine; CXP nhân số làn. */
export function interfaceBandwidth(params: EngineParams, iface: PcInterface): number {
  const spec = PC_INTERFACES[iface];
  return (interfaceBandwidthFor(params)[spec.bw] ?? 0) * spec.lanes;
}

const formatRatio = (params: EngineParams, format: PcImageFormat) =>
  format === 'raw' ? 1 : format === 'png' ? params.pcPngRatio : params.pcJpegRatio;

/** PC-STORE: sức chứa ảnh của cấu hình (TB) — ổ dữ liệu × tỉ lệ dùng; không có ổ → phân vùng trên SSD. */
export function imageCapacityTb(params: EngineParams, config: Pick<PcConfig, 'ssdGb' | 'dataKind' | 'dataGb'>): number {
  if (config.dataKind !== null && config.dataGb !== null) return (config.dataGb / 1024) * params.pcDiskUsableShare;
  return Math.max(0, config.ssdGb * params.pcDiskUsableShare - params.pcSystemReserveGb) / 1024;
}

type Counts = Record<SlotGroup, number>;

/** PC-SLOT: khe card camera cần, khi `onboard` camera GigE cắm thẳng cổng LAN có sẵn của máy. */
export function cardSlots(params: EngineParams, counts: Counts, onboard: number): number {
  return (
    Math.ceil(Math.max(0, counts.gige - onboard) / params.pcGigePortsPerCard) +
    Math.ceil(counts.tenGige / params.pcTenGigePortsPerCard) +
    Math.ceil(counts.usb / params.pcUsbPortsPerCard) +
    Math.ceil(counts.clBase / params.pcClBasePerGrabber) +
    counts.clOne +
    Math.ceil(counts.cxp1 / params.pcCxpLanesPerCard) +
    counts.cxp4
  );
}

export function suggestPc(input: PcSuggestInput, frames: readonly PcFrame[], configs: readonly PcConfig[], params: EngineParams): PcSuggestResult {
  // ── Từng camera: MB/khung, MB/s, % cổng ──
  const rows = input.cameras.map((cam) => {
    const mbk = mbPerFrame(cam.resolution, cam.bit);
    const bw = interfaceBandwidth(params, cam.iface);
    const mbps = mbk * cam.fps;
    const portShare = bw > 0 ? mbps / bw : Infinity;
    const overShare = portShare > params.interfaceMaxShare;
    return { cam, mbk, result: { mbPerFrame: mbk, mbps, portShare, overShare, maxFps: overShare ? Math.floor((bw * params.interfaceMaxShare) / mbk) : null } };
  });
  const totalMbps = rows.reduce((a, r) => a + r.result.mbps, 0);

  // ── PC-RAM ──
  const bufferGb = rows.reduce((a, r) => a + r.mbk * params.pcRamBufferFrames * (r.cam.color ? params.pcRamColorFactor : 1), 0) / 1024;
  const ramGb = bufferGb + params.pcRamBaseGb + (input.ai !== 'none' ? params.pcRamAiGb : 0) + (input.ai === 'training' ? params.pcRamTrainGb : 0);

  // ── PC-STORE ──
  let storage: PcSuggestResult['storage'] = null;
  if (input.storage) {
    const s = input.storage;
    const mbDay = rows.reduce((a, r) => a + r.mbk * r.cam.inspectPerSec, 0) * 3600 * s.hoursPerDay;
    const ng = s.ngPercent / 100;
    const ngTb = (mbDay * ng * formatRatio(params, s.ngFormat) * s.ngDays) / 1e6;
    const okTb = (mbDay * (1 - ng) * formatRatio(params, s.okFormat) * s.okDays) / Math.max(1, s.okEveryN) / 1e6;
    storage = { ngTb, okTb, totalTb: ngTb + okTb, rawTb: (mbDay * Math.max(s.ngDays, s.okDays)) / 1e6 };
  }

  // ── PC-SLOT, PoE ──
  const counts: Counts = { gige: 0, tenGige: 0, usb: 0, clBase: 0, clOne: 0, cxp1: 0, cxp4: 0 };
  for (const r of rows) counts[PC_INTERFACES[r.cam.iface].group]++;
  const poeW = counts.gige * params.pcPoePerCameraW;
  const largestMp = Math.max(0, ...rows.map((r) => PC_RESOLUTIONS[r.cam.resolution][2]));

  // ── PC-RANK: đánh giá từng khung ──
  const activeFrames = frames.filter((f) => f.status === 'active');
  const verdicts = activeFrames.map((frame, index) => {
    const ok: PcNote[] = [], warn: PcNote[] = [], no: PcNote[] = [], info: PcNote[] = [];
    const list = configs.filter((c) => c.frameId === frame.id && c.status === 'active').sort(compareConfigs);

    if (frame.cardSlots === 0 && frame.lanPorts === 0) no.push({ key: 'aux' });
    if (input.ai !== 'none' && frame.gpu === '0') no.push({ key: 'noGpu' });
    if (input.ai === 'training' && frame.gpu !== '0' && frame.vramGb < params.pcTrainMinVramGb)
      warn.push({ key: 'trainVram', values: { vram: frame.vramGb, min: params.pcTrainMinVramGb } });

    // Cổng LAN có sẵn: trừ số cổng để cho mạng nhà máy, phần dư mới cắm camera GigE; còn lại qua card.
    const onboard = Math.min(counts.gige, Math.max(0, frame.lanPorts - params.pcLanReservedPorts));
    const need = cardSlots(params, counts, onboard);
    if (need > frame.cardSlots) no.push({ key: 'slots', values: { need, have: frame.cardSlots, lan: onboard } });
    else ok.push({ key: 'ports', values: { need, have: frame.cardSlots, lan: onboard } });

    const enoughRam = (c: PcConfig) => c.ramGb >= ramGb;
    const enoughSpace = (c: PcConfig) => !storage || imageCapacityTb(params, c) >= storage.totalTb;
    let config = list.find((c) => enoughRam(c) && enoughSpace(c)) ?? null;
    if (config) {
      ok.push({ key: 'ram', values: { need: Math.ceil(ramGb), ram: config.ramGb } });
      if (storage)
        ok.push({ key: config.dataKind ? 'storageData' : 'storageSsd', values: { need: storage.totalTb.toFixed(2), cap: imageCapacityTb(params, config).toFixed(2) } });
    } else if (list.some(enoughRam)) {
      config = list.find(enoughRam)!;
      ok.push({ key: 'ram', values: { need: Math.ceil(ramGb), ram: config.ramGb } });
      // Không cấu hình nào đủ chỗ: lấy cấu hình chứa được nhiều nhất trong số đủ RAM.
      config = list.filter(enoughRam).sort((a, b) => imageCapacityTb(params, b) - imageCapacityTb(params, a))[0];
      warn.push({ key: 'storageOver', values: { need: storage!.totalTb.toFixed(1), cap: imageCapacityTb(params, config).toFixed(1) } });
    } else if (list.length > 0) {
      config = list[list.length - 1];
      no.push({ key: 'ramShort', values: { need: Math.ceil(ramGb), max: Math.max(...list.map((c) => c.ramGb)) } });
    } else {
      no.push({ key: 'noConfig' });
    }

    if (config && config.dataKind !== null && config.dataLine === 'C' && input.line247) info.push({ key: 'dataDriveC' });
    if (input.line247 && (frame.ramLine !== 'I' || frame.ssdLine !== 'I')) {
      warn.push({ key: frame.ramLine === '?' || frame.ssdLine === '?' ? 'line247Unknown' : 'line247Commercial' });
    }

    // PC-PSU: PoE cấp từ card trong máy (khung có khe card).
    const load = frame.peakLoadW + (frame.cardSlots > 0 ? poeW : 0);
    if (load / frame.psuW > params.pcPsuMaxShare)
      warn.push({ key: 'power', values: { load, pct: Math.round((load / frame.psuW) * 100), poe: poeW, max: Math.round(params.pcPsuMaxShare * 100) } });
    if (largestMp >= params.pcLargeImageMp && frame.tier !== 'D' && input.ai !== 'none') warn.push({ key: 'largeImageAi', values: { mp: params.pcLargeImageMp } });

    const level: PcLevel = no.length ? 'no' : warn.length ? 'warn' : 'ok';
    return { verdict: { frameId: frame.id, configId: config?.id ?? null, level, ok, warn, no, info }, index };
  });

  // Đạt → Đạt có lưu ý (ít lưu ý trước) → Không hợp; cùng mức giữ thứ tự danh mục.
  const rank = { ok: 0, warn: 1, no: 2 } as const;
  verdicts.sort(
    (a, b) => rank[a.verdict.level] - rank[b.verdict.level] || a.verdict.warn.length - b.verdict.warn.length || a.index - b.index
  );

  return {
    cameras: rows.map((r) => r.result),
    totalMbps,
    ramGb,
    storage,
    slots: cardSlots(params, counts, 0),
    gige: counts.gige,
    poeW,
    frames: verdicts.map((v) => v.verdict),
  };
}
