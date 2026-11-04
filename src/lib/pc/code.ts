/**
 * PC Vision — mã vật tư PC (chốt 2026-11-03, đã gửi hãng AAEON).
 *
 *   <PN chassis>-<CPU>-G<GPU>-P<W>-R<GB><I|C>-S<SSD><I|C>-<ổ dữ liệu>-<HĐH>
 *   RT-661R-Q670-A10-0001-I9-14900-G5070V12-P1000-R64I-S2TI-D0-W11P
 *
 * Mã do hệ thống ghép từ các trường, không gõ tay. Nguồn sự thật là trigger trong CSDL
 * (migration 20261103000001_pc_vision.sql: pc_compose_code); file này ghép y hệt để form
 * hiện mã ngay khi chọn, và để máy chủ kiểm trước khi gửi xuống CSDL. Test
 * scripts/test-pc-code.ts giữ hai bên khớp nhau trên 13 cấu hình của gói bàn giao.
 *
 * File này được form phía trình duyệt import, nên không chứa con số kỹ thuật nào: phép
 * ước tải đỉnh duy nhất (estimatePeakLoadW) nhận số từ máy chủ, và máy chủ chỉ gửi số
 * đó cho Admin (pc/power.ts).
 */

export type PcLine = 'I' | 'C' | '?';
export type PcStatus = 'active' | 'retired';

export const PC_TIERS = ['A', 'B', 'C', 'D', 'P'] as const;
export const PC_OS = ['W11P', 'W11L', 'LNX', 'NOS'] as const;
export const PC_GPUS = ['0', '5060', '5060TI', '5070', '5070TI', '5080', '5090', '4070S'] as const;
export const PC_VRAM_GB = [0, 8, 12, 16, 24, 32] as const;
export const PC_PSU_W = [250, 450, 500, 650, 850, 1000, 1200, 1300, 1600] as const;
export const PC_RAM_GB = [8, 16, 32, 64, 128] as const;
export const PC_SSD_GB = [256, 512, 1024, 2048] as const;
/** Ổ dữ liệu: D = SSD, H = HDD + dung lượng GB. */
export const PC_DATA_DRIVE_CODES = ['D512', 'D1024', 'D2048', 'D4096', 'H2048', 'H4096'] as const;
/** Lựa chọn trên form: null = không có (D0). */
export const PC_DATA_DRIVES = [null, ...PC_DATA_DRIVE_CODES] as const;

/** Phần cố định của mã — đủ để nhận ra cấu hình thuộc khung nào. */
export type PcFrameKey = {
  chassisPn: string;
  cpu: string;
  gpu: string;
  vramGb: number;
  psuW: number;
  os: string;
  ramLine: PcLine;
  ssdLine: PcLine;
};

export type PcFrame = PcFrameKey & {
  id: string;
  slug: string;
  tier: string;
  nameVi: string;
  nameEn: string | null;
  cardSlots: number;
  lanPorts: number;
  peakLoadW: number;
  useForVi: string | null;
  useForEn: string | null;
  notForVi: string | null;
  notForEn: string | null;
  noteVi: string | null;
  noteEn: string | null;
  status: PcStatus;
  sortOrder: number;
};

/** Phần thay theo dự án: RAM – SSD hệ thống – ổ dữ liệu. */
export type PcConfigParts = {
  ramGb: number;
  ssdGb: number;
  /** D = SSD, H = HDD, null = không có. */
  dataKind: 'D' | 'H' | null;
  dataGb: number | null;
  dataLine: 'I' | 'C' | null;
};

export type PcConfig = PcConfigParts & {
  id: string;
  frameId: string;
  shortName: string;
  code: string;
  status: PcStatus;
};

/** Regex của quy tắc mã (gói bàn giao mục 2). Mã có '?' cố ý không qua. */
export const PC_CODE_REGEX =
  /^[A-Z0-9][A-Z0-9-]*-(I[3579]|U[579]|RZ[3579])-\d{3,5}[A-Z]{0,2}-G(0|\d{4}(TI|S)?V\d{1,2})-P\d{3,4}-R\d{1,3}[IC]-S(\d{3}|\d{1,2}T)[IC]-(D0|[DH](\d{3}|\d{1,2}T)[IC])-(W11[PL]|LNX|NOS)$/;
export const PC_PN_REGEX = /^[A-Z0-9][A-Z0-9-]{0,59}$/;
export const PC_CPU_REGEX = /^(I[3579]|U[579]|RZ[3579])-\d{3,5}[A-Z]{0,2}$/;

/** 512 → "512", 1024 → "1T". Cùng quy tắc với pc_size_token trong CSDL. */
export function sizeToken(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}T` : String(gb);
}

/** 512 → "512GB", 2048 → "2TB" — để hiển thị. */
export function sizeLabel(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`;
}

export function gpuToken(frame: Pick<PcFrameKey, 'gpu' | 'vramGb'>): string {
  return frame.gpu === '0' ? 'G0' : `G${frame.gpu}V${frame.vramGb}`;
}

/** "5060TI" → "RTX 5060 Ti", "4070S" → "RTX 4070 Super". */
export function gpuLabel(gpu: string): string {
  const m = /^(\d{4})(TI|S)?$/.exec(gpu);
  if (!m) return gpu;
  return `RTX ${m[1]}${m[2] === 'TI' ? ' Ti' : m[2] === 'S' ? ' Super' : ''}`;
}

/** Phần đầu mã: PN-CPU-G…-P… (in mờ trên danh mục). */
export function frameCodeHead(frame: PcFrameKey): string {
  return [frame.chassisPn, frame.cpu, gpuToken(frame), `P${frame.psuW}`].join('-');
}

/** Phần giữa mã: R…-S…-D… (in đậm trên danh mục). */
export function configCodeMiddle(frame: Pick<PcFrameKey, 'ramLine' | 'ssdLine'>, parts: PcConfigParts): string {
  const data = parts.dataKind === null || parts.dataGb === null ? 'D0' : `${parts.dataKind}${sizeToken(parts.dataGb)}${parts.dataLine ?? ''}`;
  return [`R${parts.ramGb}${frame.ramLine}`, `S${sizeToken(parts.ssdGb)}${frame.ssdLine}`, data].join('-');
}

export function composePcCode(frame: PcFrameKey, parts: PcConfigParts): string {
  return [frameCodeHead(frame), configCodeMiddle(frame, parts), frame.os].join('-');
}

/** Khoá so khung: pn, cpu, gpu, vram, nguồn, HĐH, dòng RAM, dòng SSD. */
export function frameKeyString(frame: PcFrameKey): string {
  return [frame.chassisPn, frame.cpu, frame.gpu, frame.vramGb, frame.psuW, frame.os, frame.ramLine, frame.ssdLine].join('|');
}

export function findFrame<F extends PcFrameKey>(frames: readonly F[], key: PcFrameKey): F | undefined {
  const wanted = frameKeyString(key);
  return frames.find((frame) => frameKeyString(frame) === wanted);
}

/** "D2048" → { kind: 'D', gb: 2048 }; null → không có ổ dữ liệu. */
export function parseDataDrive(value: string | null): { kind: 'D' | 'H'; gb: number } | null {
  if (value === null) return null;
  const m = /^([DH])(\d+)$/.exec(value);
  return m ? { kind: m[1] as 'D' | 'H', gb: Number(m[2]) } : null;
}

export type PcCodeError = 'pn' | 'cpu' | 'gpuNoVram' | 'vramNoGpu' | 'regex' | 'duplicate';

/**
 * Lỗi phải hiện ngay trên form (gói bàn giao mục 5, tab 1). Máy chủ chạy lại đúng hàm này,
 * rồi CSDL kiểm lần nữa bằng CHECK + trigger.
 * `existingCodes` là mã của mọi cấu hình khác (khi sửa thì đã bỏ chính dòng đang sửa).
 */
export function pcCodeErrors(frame: PcFrameKey, parts: PcConfigParts, existingCodes: Iterable<string> = []): PcCodeError[] {
  const errors: PcCodeError[] = [];
  if (!PC_PN_REGEX.test(frame.chassisPn) || frame.chassisPn.endsWith('-')) errors.push('pn');
  if (!PC_CPU_REGEX.test(frame.cpu)) errors.push('cpu');
  if (frame.gpu !== '0' && frame.vramGb === 0) errors.push('gpuNoVram');
  if (frame.gpu === '0' && frame.vramGb !== 0) errors.push('vramNoGpu');
  const code = composePcCode(frame, parts);
  if (!code.includes('?') && !PC_CODE_REGEX.test(code)) errors.push('regex');
  for (const other of existingCodes) {
    if (other === code) {
      errors.push('duplicate');
      break;
    }
  }
  return errors;
}

/** Trong một khung, cấu hình xếp từ nhỏ đến lớn: RAM, rồi tổng dung lượng ổ. */
export function compareConfigs(a: PcConfigParts, b: PcConfigParts): number {
  return a.ramGb - b.ramGb || a.ssdGb + (a.dataGb ?? 0) - (b.ssdGb + (b.dataGb ?? 0));
}

/** Mô hình ước tải đỉnh (server dựng từ ngưỡng engine, xem pc/power.ts). */
export type PcPowerModel = {
  gpuW: Readonly<Record<string, number>>;
  gpuFallbackW: number;
  cpuW: number;
  baseW: number;
  /** Tải đỉnh / công suất nguồn tối đa, vd 0,7. */
  maxShare: number;
};

/** PC-PSU: tải đỉnh ước tính = W GPU + W CPU + phần còn lại của máy (chưa tính PoE). */
export function estimatePeakLoadW(model: PcPowerModel, gpu: string): number {
  return (gpu === '0' ? 0 : (model.gpuW[gpu] ?? model.gpuFallbackW)) + model.cpuW + model.baseW;
}
