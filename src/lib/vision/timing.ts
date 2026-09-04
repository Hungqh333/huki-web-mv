import { INTERFACE_BANDWIDTH } from '@/lib/components/specs';
import { fmt, round, type Check } from './types';

/**
 * Nhịp sản xuất, nhoè do chuyển động, và băng thông.
 *
 * Ba thứ này gắn chặt nhau nên để chung một file: thời gian phơi sáng bị chặn
 * trên bởi nhoè, thời gian truyền ảnh phụ thuộc băng thông, và cả hai phải nằm
 * gọn trong ngân sách thời gian một chu kỳ.
 */

/**
 * Số byte cho một pixel theo định dạng ảnh.
 *
 * Trước đây code lấy 3 byte/px khi cần phân biệt màu — sai với đa số hệ vision
 * công nghiệp: camera màu truyền ảnh Bayer THÔ 1 byte/px, việc nội suy ra RGB
 * làm ở máy tính. Lấy 3 byte/px là thổi phồng băng thông lên ba lần.
 */
export const PIXEL_FORMAT_BYTES: Record<string, number> = {
  Mono8: 1,
  BayerRG8: 1,
  Mono12packed: 1.5,
  Mono16: 2,
  RGB8: 3,
};

export const DEFAULT_PIXEL_FORMAT = 'Mono8';

/** Hệ số an toàn cho ngân sách thời gian: chỉ dùng 70% cửa sổ khả dụng. */
export const TIME_BUDGET_SAFETY = 0.7;

// ------------------------------------------------------------- BĂNG THÔNG --

export type FrameTransfer = {
  bytesPerPixel: number;
  frameSizeBytes: number;
  usableMbytesS: number;
  transferMs: number;
};

/**
 * Kích thước một ảnh và thời gian truyền nó.
 *
 * Cố ý KHÔNG dùng băng thông trung bình để chọn chuẩn giao tiếp: trung bình che
 * mất chuyện thật sự quyết định — ảnh phải truyền xong TRONG chu kỳ, không phải
 * trải đều cả phút.
 */
export function frameTransfer(input: {
  widthPx: number;
  heightPx: number;
  pixelFormat: string;
  interfaceName: string | null;
}): FrameTransfer | null {
  const bytesPerPixel = PIXEL_FORMAT_BYTES[input.pixelFormat];
  const usableMbytesS = input.interfaceName ? INTERFACE_BANDWIDTH[input.interfaceName] : undefined;
  if (bytesPerPixel === undefined || usableMbytesS === undefined) return null;
  if (input.widthPx <= 0 || input.heightPx <= 0) return null;

  const frameSizeBytes = input.widthPx * input.heightPx * bytesPerPixel;
  // MB ở đây là 10^6 byte, đúng quy ước ghi băng thông của nhà sản xuất.
  const transferMs = (frameSizeBytes / (usableMbytesS * 1e6)) * 1000;

  return {
    bytesPerPixel,
    frameSizeBytes,
    usableMbytesS,
    transferMs: round(transferMs, 3),
  };
}

/** Băng thông đỉnh tại máy tính khi nhiều camera truyền đồng thời. */
export function peakHostBandwidth(usableMbytesS: number, cameraCount: number): number {
  return round(usableMbytesS * Math.max(1, cameraCount), 1);
}

// -------------------------------------------------------- NHOÈ CHUYỂN ĐỘNG --

export type BlurLimit = {
  maxExposureMs: number;
  needsStrobe: boolean;
};

/**
 * Thời gian phơi sáng tối đa để vật không nhoè quá `blurPx` pixel:
 *
 *   t_expose ≤ (blur_px × mm/px) / v
 *
 * Đây là ràng buộc hay bị bỏ quên nhất. Cấu hình đủ độ phân giải trên giấy
 * nhưng phơi sáng dài hơn mức này thì lỗi bị kéo vệt và biến mất khỏi ảnh.
 */
export function maxExposureForBlur(input: {
  blurPx: number;
  mmPerPx: number;
  speedMmS: number;
}): BlurLimit | null {
  const { blurPx, mmPerPx, speedMmS } = input;
  if (blurPx <= 0 || mmPerPx <= 0 || speedMmS <= 0) return null;

  const maxExposureMs = ((blurPx * mmPerPx) / speedMmS) * 1000;
  return {
    maxExposureMs: round(maxExposureMs, 4),
    // Dưới 1 ms thì đèn thường không đủ sáng và rolling shutter sẽ xé hình.
    needsStrobe: maxExposureMs < 1,
  };
}

// ------------------------------------------------------ NGÂN SÁCH THỜI GIAN --

export type CycleBudget = {
  cycleMs: number;
  availableMs: number;
  consumedMs: number;
  perViewMs: number;
  fits: boolean;
};

/**
 * T_chu_kỳ = 60000 / nhịp ; T_khả_dụng = T_chu_kỳ × duty × 0,7
 * T_tiêu_thụ = n_view × (trigger + phơi sáng + đọc + truyền) + xử lý + xuất
 *
 * Thay cho chỉ số "nhịp ảnh cần thiết" cũ: 0,167 ảnh/giây không nói lên điều gì
 * về việc hệ thống có kịp hay không, vì phần lớn chu kỳ sản phẩm không nằm
 * trong tầm nhìn.
 */
export function cycleBudget(input: {
  throughputPpm: number;
  dutyRatio: number;
  nView: number;
  triggerMs: number;
  exposureMs: number;
  readoutMs: number;
  transferMs: number;
  processMs: number;
  outputMs: number;
}): CycleBudget | null {
  if (input.throughputPpm <= 0 || input.dutyRatio <= 0 || input.nView <= 0) return null;

  const cycleMs = 60000 / input.throughputPpm;
  const availableMs = cycleMs * input.dutyRatio * TIME_BUDGET_SAFETY;
  const perViewMs = input.triggerMs + input.exposureMs + input.readoutMs + input.transferMs;
  const consumedMs = input.nView * perViewMs + input.processMs + input.outputMs;

  return {
    cycleMs: round(cycleMs, 2),
    availableMs: round(availableMs, 2),
    consumedMs: round(consumedMs, 2),
    perViewMs: round(perViewMs, 2),
    fits: consumedMs <= availableMs,
  };
}

// --------------------------------------------------------------- CÁC BƯỚC --

export function timingChecks(input: {
  widthPx: number | null;
  heightPx: number | null;
  pixelFormat: string;
  interfaceName: string | null;
  cameraCount: number;
  throughputPpm: number | null;
  dutyRatio: number;
  nView: number;
  triggerMs: number;
  readoutMs: number;
  processMs: number;
  outputMs: number;
  exposureMs: number;
  speedMmS: number | null;
  blurPx: number;
  mmPerPx: number | null;
}): Check[] {
  const checks: Check[] = [];

  // --- Nhoè chuyển động: quyết định trần thời gian phơi sáng.
  let exposureMs = input.exposureMs;
  if (input.speedMmS !== null && input.mmPerPx !== null) {
    const blur = maxExposureForBlur({
      blurPx: input.blurPx,
      mmPerPx: input.mmPerPx,
      speedMmS: input.speedMmS,
    });
    if (blur) {
      // Phơi sáng thực tế không được vượt trần này — lấy luôn làm giá trị dùng
      // cho ngân sách thời gian bên dưới.
      exposureMs = Math.min(exposureMs, blur.maxExposureMs);
      checks.push({
        key: 'motionBlur',
        status: blur.needsStrobe ? 'warn' : 'pass',
        formula: `(${input.blurPx} px × ${fmt(input.mmPerPx, 5)} mm/px) ÷ ${fmt(input.speedMmS)} mm/s = ${fmt(blur.maxExposureMs, 4)} ms`,
        noteKey: blur.needsStrobe ? 'blurNeedsStrobe' : 'blurOk',
        noteValues: { maxExposure: blur.maxExposureMs },
      });
    }
  }

  // --- Băng thông: kích thước ảnh và thời gian truyền.
  let transferMs = 0;
  if (input.widthPx !== null && input.heightPx !== null) {
    const transfer = frameTransfer({
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      pixelFormat: input.pixelFormat,
      interfaceName: input.interfaceName,
    });
    if (transfer) {
      transferMs = transfer.transferMs;
      const megabytes = transfer.frameSizeBytes / 1e6;

      checks.push({
        key: 'frameSize',
        status: 'info',
        formula: `${input.widthPx} × ${input.heightPx} × ${transfer.bytesPerPixel} byte/px = ${fmt(megabytes, 2)} MB (${input.pixelFormat})`,
      });

      checks.push({
        key: 'transferTime',
        status: 'info',
        formula: `${fmt(megabytes, 2)} MB ÷ ${transfer.usableMbytesS} MB/s = ${fmt(transfer.transferMs, 2)} ms/ảnh`,
      });

      if (input.cameraCount > 1) {
        checks.push({
          key: 'peakBandwidth',
          status: 'info',
          formula: `${input.cameraCount} camera × ${transfer.usableMbytesS} MB/s = ${fmt(peakHostBandwidth(transfer.usableMbytesS, input.cameraCount), 1)} MB/s`,
          noteKey: 'peakBandwidthNote',
        });
      }
    }
  }

  // --- Ngân sách thời gian chu kỳ.
  if (input.throughputPpm !== null) {
    const budget = cycleBudget({
      throughputPpm: input.throughputPpm,
      dutyRatio: input.dutyRatio,
      nView: input.nView,
      triggerMs: input.triggerMs,
      exposureMs,
      readoutMs: input.readoutMs,
      transferMs,
      processMs: input.processMs,
      outputMs: input.outputMs,
    });

    if (budget) {
      checks.push({
        key: 'cycleTime',
        status: 'info',
        formula: `60000 ÷ ${fmt(input.throughputPpm)} sp/phút = ${fmt(budget.cycleMs, 1)} ms/sp`,
      });

      checks.push({
        key: 'timeAvailable',
        status: 'info',
        formula: `${fmt(budget.cycleMs, 1)} × ${input.dutyRatio} × ${TIME_BUDGET_SAFETY} = ${fmt(budget.availableMs, 1)} ms`,
      });

      checks.push({
        key: 'timeConsumed',
        status: budget.fits ? 'pass' : 'fail',
        formula:
          `${input.nView} × (${fmt(input.triggerMs, 2)} + ${fmt(exposureMs, 3)} + ${fmt(input.readoutMs, 2)} + ${fmt(transferMs, 2)}) ` +
          `+ ${fmt(input.processMs, 2)} + ${fmt(input.outputMs, 2)} = ${fmt(budget.consumedMs, 1)} ms ` +
          `${budget.fits ? '≤' : '>'} ${fmt(budget.availableMs, 1)} ms`,
        noteKey: budget.fits ? undefined : 'overTimeBudget',
        noteValues: { consumed: budget.consumedMs, available: budget.availableMs },
      });
    }
  }

  return checks;
}
