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
 * 2026-11-04: camera màu nhân đệm RAM (pcRamColorFactor), RAM chia mức dùng tối đa (pcRamMaxUse),
 * ảnh 10–16 bit tính 2 byte/px trong RAM; nguồn camera chọn từng chiếc (GigE mặc định PoE qua card PoE,
 * USB3 lấy nguồn qua cáp USB, loại khác nguồn ngoài) và mỗi khung hiện công suất tổng (PC-POWER);
 * cổng LAN có sẵn để cho mạng nhà máy — phần dư sau pcLanReservedPorts chỉ nhận camera GigE nguồn
 * ngoài (cổng onboard không có PoE), camera PoE luôn đi card PoE.
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
  /** Cấp nguồn PoE từ card PoE trong máy — chỉ có nghĩa với GigE / 2.5G / 5G; loại khác không đọc trường này. */
  poe: boolean;
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
  /** Công suất tổng của khung với bộ camera đã nhập (PC-POWER). */
  power: PcFramePower;
};

export type PcFramePower = {
  peakW: number;
  cardsW: number;
  poeCameras: number;
  poeEachW: number;
  poeW: number;
  usbCameras: number;
  usbEachW: number;
  usbW: number;
  loadW: number;
  psuW: number;
  share: number;
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
  /** RAM cần (GB) = sum ÷ maxUse — đã gồm phần dự phòng. */
  ramGb: number;
  /** Các phần cộng lại của RAM cần (GB), để hiện chi tiết dưới ô RAM. */
  ram: { baseGb: number; bufferGb: number; aiGb: number; trainGb: number; sumGb: number; maxUse: number };
  storage: { ngTb: number; okTb: number; totalTb: number; rawTb: number } | null;
  /** Khe card cần khi mọi camera GigE đi card PoE (không dùng cổng LAN có sẵn). Từng khung tính lại theo số cổng LAN dư. */
  slots: number;
  gige: number;
  /** Camera GigE chọn PoE và W PoE (luôn qua card PoE trong máy). */
  poeCameras: number;
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

/** PC-RAM: MB một ảnh nằm trong RAM — 8 bit 1 byte/px, 10–16 bit 2 byte/px (phần mềm bung ra 16 bit), màu × hệ số màu. */
export function mbInRam(params: EngineParams, resolution: PcResolution, bit: number, color: boolean): number {
  const [w, h] = PC_RESOLUTIONS[resolution];
  return (w * h * (bit <= 8 ? 1 : 2) * (color ? params.pcRamColorFactor : 1)) / 1e6;
}

const formatRatio = (params: EngineParams, format: PcImageFormat) =>
  format === 'raw' ? 1 : format === 'png' ? params.pcPngRatio : params.pcJpegRatio;

/** PC-STORE: sức chứa ảnh của cấu hình (TB) — ổ dữ liệu × tỉ lệ dùng; không có ổ → phân vùng trên SSD. */
export function imageCapacityTb(params: EngineParams, config: Pick<PcConfig, 'ssdGb' | 'dataKind' | 'dataGb'>): number {
  if (config.dataKind !== null && config.dataGb !== null) return (config.dataGb / 1024) * params.pcDiskUsableShare;
  return Math.max(0, config.ssdGb * params.pcDiskUsableShare - params.pcSystemReserveGb) / 1024;
}

type Counts = Record<SlotGroup, number>;

/** PC-SLOT: số card từng loại, khi `onboard` camera GigE cắm thẳng cổng LAN có sẵn của máy. */
export function cardsNeeded(params: EngineParams, counts: Counts, onboard: number) {
  return {
    gige: Math.ceil(Math.max(0, counts.gige - onboard) / params.pcGigePortsPerCard),
    tenGige: Math.ceil(counts.tenGige / params.pcTenGigePortsPerCard),
    usb: Math.ceil(counts.usb / params.pcUsbPortsPerCard),
    cl: Math.ceil(counts.clBase / params.pcClBasePerGrabber) + counts.clOne,
    cxp: Math.ceil(counts.cxp1 / params.pcCxpLanesPerCard) + counts.cxp4,
  };
}

/** PC-SLOT: tổng khe card camera cần. */
export function cardSlots(params: EngineParams, counts: Counts, onboard: number): number {
  const c = cardsNeeded(params, counts, onboard);
  return c.gige + c.tenGige + c.usb + c.cl + c.cxp;
}

/** Nhóm GigE / 2.5GigE / 5GigE — loại duy nhất được cấp PoE từ card trong máy. */
export function isGigeFamily(iface: PcInterface): boolean {
  return PC_INTERFACES[iface].group === 'gige';
}

/**
 * PC-POWER: công suất tổng một khung = tải đỉnh khung + card camera + PoE + nguồn USB3 qua cáp.
 * Khung không có khe card thì không lắp được card (khung đó đã bị loại nếu cần card) — chỉ tính tải đỉnh.
 */
export function framePower(
  params: EngineParams,
  frame: Pick<PcFrame, 'peakLoadW' | 'psuW' | 'cardSlots'>,
  cards: ReturnType<typeof cardsNeeded>,
  poeCameras: number,
  usbCameras: number
): PcFramePower {
  const fits = frame.cardSlots > 0;
  const cardsW = fits
    ? cards.gige * params.pcCardGigePoeW + cards.tenGige * params.pcCardTenGigeW + cards.usb * params.pcCardUsbW +
      cards.cl * params.pcCardClW + cards.cxp * params.pcCardCxpW
    : 0;
  const poe = fits ? poeCameras : 0;
  const usb = fits ? usbCameras : 0;
  const poeW = poe * params.pcPoePerCameraW;
  const usbW = usb * params.pcUsbBusPowerW;
  const loadW = frame.peakLoadW + cardsW + poeW + usbW;
  return {
    peakW: frame.peakLoadW, cardsW, poeCameras: poe, poeEachW: params.pcPoePerCameraW, poeW,
    usbCameras: usb, usbEachW: params.pcUsbBusPowerW, usbW, loadW, psuW: frame.psuW, share: loadW / frame.psuW,
  };
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
  const bufferGb = rows.reduce((a, r) => a + mbInRam(params, r.cam.resolution, r.cam.bit, r.cam.color) * params.pcRamBufferFrames, 0) / 1024;
  const aiGb = input.ai !== 'none' ? params.pcRamAiGb : 0;
  const trainGb = input.ai === 'training' ? params.pcRamTrainGb : 0;
  const sumGb = params.pcRamBaseGb + bufferGb + aiGb + trainGb;
  const ram = { baseGb: params.pcRamBaseGb, bufferGb, aiGb, trainGb, sumGb, maxUse: params.pcRamMaxUse };
  const ramGb = sumGb / params.pcRamMaxUse;
  const gb1 = (gb: number) => (Math.ceil(gb * 10) / 10).toFixed(1);
  /** W hiện trên thẻ: số nguyên nếu tròn, không thì 1 chữ số (USB3 4,5 W). */
  const w1 = (w: number) => Math.round(w * 10) / 10;

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
  const poeCameras = rows.filter((r) => r.cam.poe && isGigeFamily(r.cam.iface)).length;
  const poeW = poeCameras * params.pcPoePerCameraW;
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

    // Cổng LAN có sẵn: trừ số cổng để cho mạng nhà máy; cổng dư (không có PoE) chỉ nhận camera GigE
    // nguồn ngoài. Camera PoE luôn đi card PoE.
    const onboard = Math.min(counts.gige - poeCameras, Math.max(0, frame.lanPorts - params.pcLanReservedPorts));
    const cards = cardsNeeded(params, counts, onboard);
    const need = cards.gige + cards.tenGige + cards.usb + cards.cl + cards.cxp;
    if (need > frame.cardSlots) no.push({ key: 'slots', values: { need, have: frame.cardSlots, lan: onboard } });
    else ok.push({ key: 'ports', values: { need, have: frame.cardSlots, lan: onboard } });

    const enoughRam = (c: PcConfig) => c.ramGb >= ramGb;
    const enoughSpace = (c: PcConfig) => !storage || imageCapacityTb(params, c) >= storage.totalTb;
    let config = list.find((c) => enoughRam(c) && enoughSpace(c)) ?? null;
    if (config) {
      ok.push({ key: 'ram', values: { need: gb1(ramGb), ram: config.ramGb } });
      if (storage)
        ok.push({ key: config.dataKind ? 'storageData' : 'storageSsd', values: { need: storage.totalTb.toFixed(2), cap: imageCapacityTb(params, config).toFixed(2) } });
    } else if (list.some(enoughRam)) {
      config = list.find(enoughRam)!;
      ok.push({ key: 'ram', values: { need: gb1(ramGb), ram: config.ramGb } });
      // Không cấu hình nào đủ chỗ: lấy cấu hình chứa được nhiều nhất trong số đủ RAM.
      config = list.filter(enoughRam).sort((a, b) => imageCapacityTb(params, b) - imageCapacityTb(params, a))[0];
      warn.push({ key: 'storageOver', values: { need: storage!.totalTb.toFixed(1), cap: imageCapacityTb(params, config).toFixed(1) } });
    } else if (list.length > 0) {
      config = list[list.length - 1];
      no.push({ key: 'ramShort', values: { need: gb1(ramGb), max: Math.max(...list.map((c) => c.ramGb)) } });
    } else {
      no.push({ key: 'noConfig' });
    }

    if (config && config.dataKind !== null && config.dataLine === 'C' && input.line247) info.push({ key: 'dataDriveC' });
    if (input.line247 && (frame.ramLine !== 'I' || frame.ssdLine !== 'I')) {
      warn.push({ key: frame.ramLine === '?' || frame.ssdLine === '?' ? 'line247Unknown' : 'line247Commercial' });
    }

    // PC-POWER: công suất tổng = tải đỉnh khung + card + PoE + USB3, so với nguồn.
    const power = framePower(params, frame, cards, poeCameras, counts.usb);
    const powerValues = {
      load: w1(power.loadW), peak: power.peakW, cards: w1(power.cardsW), n: power.poeCameras, w: power.poeEachW,
      usbN: power.usbCameras, usbW: power.usbEachW, psu: power.psuW, pct: Math.round(power.share * 100),
      max: Math.round(params.pcPsuMaxShare * 100),
    };
    if (power.share > params.pcPsuMaxShare) warn.push({ key: 'power', values: powerValues });
    else ok.push({ key: 'powerOk', values: powerValues });
    if (largestMp >= params.pcLargeImageMp && frame.tier !== 'D' && input.ai !== 'none') warn.push({ key: 'largeImageAi', values: { mp: params.pcLargeImageMp } });

    const level: PcLevel = no.length ? 'no' : warn.length ? 'warn' : 'ok';
    return { verdict: { frameId: frame.id, configId: config?.id ?? null, level, ok, warn, no, info, power }, index };
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
    ram,
    storage,
    slots: cardSlots(params, counts, 0),
    gige: counts.gige,
    poeCameras,
    poeW,
    frames: verdicts.map((v) => v.verdict),
  };
}
