/**
 * PC Vision — dòng cho list thiết bị theo form PC gốc (4_Pc_goc.xlsx), chốt 2026-11-07:
 * Tên vật tư · Loại vật tư (mã đầy đủ) · Maker · Thông số kỹ thuật (tiếng Anh, mỗi ý một dòng "-…").
 *
 * Số (W nguồn, GB RAM / SSD / ổ dữ liệu, CPU, GPU, HĐH) lấy từ mã để không bao giờ lệch với mã;
 * chữ cố định của khung (vỏ, kiểu nguồn, kiểu + hãng RAM / SSD, model GPU, I/O, maker) lấy ở
 * `frame.spec`, Admin sửa trong "Sửa khung". Chỉ là dữ liệu danh mục, không có công thức —
 * file 'use client' import được.
 */

import { gpuLabel, type PcConfig, type PcFrame } from './code';

/** Chữ cố định của một khung — mọi khoá đều có thể vắng. */
export type PcFrameSpec = {
  maker?: string;
  chassis?: string;
  mainboard?: string;
  psu?: string;
  cpuSuffix?: string;
  memory?: string;
  memoryBrand?: string;
  ssd?: string;
  ssdBrand?: string;
  dataBrand?: string;
  gpu?: string;
  io?: string;
};

export const PC_SPEC_KEYS = [
  'maker', 'chassis', 'mainboard', 'psu', 'cpuSuffix', 'memory', 'memoryBrand', 'ssd', 'ssdBrand', 'dataBrand', 'gpu', 'io',
] as const satisfies readonly (keyof PcFrameSpec)[];

/** Đọc cột jsonb `spec`: chỉ nhận khoá đã biết, giá trị là chữ khác rỗng. */
export function parsePcFrameSpec(value: unknown): PcFrameSpec {
  const out: PcFrameSpec = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const key of PC_SPEC_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

const OS_NAME: Record<string, string> = {
  W11P: 'Windows 11 Pro 64-bit',
  W11L: 'Windows 11 IoT Enterprise LTSC 64-bit',
  LNX: 'Linux',
  NOS: 'No OS',
};

/** "I7-14700" → "Intel Core i7-14700"; mã khác (Ultra, Ryzen) giữ nguyên. */
export function cpuName(cpu: string): string {
  const m = /^I([3579])-(.+)$/.exec(cpu);
  return m ? `Intel Core i${m[1]}-${m[2]}` : cpu;
}

/** 512 → "512GB", 2048 → "2TB" (cách viết của form: số liền đơn vị). */
const size = (gb: number) => (gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`);
const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' ');

export type PcSpecRow = { name: string; model: string; maker: string; spec: string };

/** Một dòng list thiết bị cho cấu hình `config` của khung `frame`. */
export function pcSpecRow(frame: Pick<PcFrame, 'cpu' | 'gpu' | 'vramGb' | 'psuW' | 'os' | 'spec'>, config: Pick<PcConfig, 'code' | 'ramGb' | 'ssdGb' | 'dataKind' | 'dataGb'>): PcSpecRow {
  const s = frame.spec;
  // RAM luôn 2 thanh cùng lô (Checklist, chốt Q3) — ghi như form: "16GB Kingston Industrial (2*8GB)".
  const half = config.ramGb / 2;
  const sticks = Number.isInteger(half) ? ` (2*${half}GB)` : '';
  const data =
    config.dataKind !== null && config.dataGb !== null
      ? ` & ${join(config.dataKind === 'H' ? 'HDD' : 'SSD', size(config.dataGb), s.dataBrand)}`
      : '';
  const lines = [
    s.chassis && `-Chassis: ${s.chassis}`,
    s.mainboard && `-Motherboard: ${s.mainboard}`,
    `-Power Supply: ${s.psu ? `${s.psu}, ` : ''}${frame.psuW} W`,
    `-CPU: ${join(cpuName(frame.cpu), s.cpuSuffix)}`,
    `-Memory: ${s.memory ? `${s.memory}, ` : ''}${join(size(config.ramGb), s.memoryBrand)}${sticks}`,
    `-Storage: ${s.ssd ? `${s.ssd}, ` : ''}${join(size(config.ssdGb), s.ssdBrand)}${data}`,
    frame.gpu !== '0' && `-GPU: ${s.gpu ?? `NVIDIA GeForce ${gpuLabel(frame.gpu)} ${frame.vramGb}GB`}`,
    `-OS: ${OS_NAME[frame.os] ?? frame.os}`,
    s.io && `-I/O Interface: ${s.io}`,
  ].filter((l): l is string => Boolean(l));
  return { name: 'PC', model: config.code, maker: s.maker ?? '', spec: lines.join('\n') };
}
