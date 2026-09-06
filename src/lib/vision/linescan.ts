import { INTERFACE_BANDWIDTH } from '@/lib/components/specs';
import { PIXEL_FORMAT_BYTES } from './timing';
import { fmt, round, type Check } from './types';

/**
 * Bộ tính riêng cho camera quét dòng (line scan).
 *
 * Line scan KHÔNG phải "một loại camera khác" — nó đổi cả bộ công thức:
 *
 *   - Cảm biến chỉ có một hàng pixel. Độ phân giải NGANG do cảm biến quyết
 *     định, nhưng độ phân giải DỌC đường chạy = tốc độ ÷ tần số dòng.
 *   - Muốn pixel vuông thì hai con số đó phải bằng nhau. Đây là ràng buộc
 *     trung tâm, và là chỗ dự án line scan hay hỏng nhất.
 *   - Thời gian phơi sáng mỗi dòng nhiều nhất bằng 1 ÷ tần số dòng. Ở vài nghìn
 *     dòng/giây, con số đó là vài trăm micro giây — nên đèn dòng cường độ cao
 *     là bắt buộc, không phải tuỳ chọn.
 */

export type LineScanNeed = {
  /** Số dòng mỗi giây cần đạt để pixel vuông. */
  lineRateHz: number;
  /** Thời gian phơi sáng tối đa cho một dòng (ms). */
  maxExposureMs: number;
  /** Băng thông sinh ra (MB/s). */
  dataRateMbytesS: number;
};

/**
 * Tần số dòng cần thiết để pixel vuông:
 *
 *   tần_số_dòng = tốc_độ / kích_thước_pixel_ngang
 *
 * Chạy chậm hơn thì ảnh bị kéo dãn theo chiều chạy, nhanh hơn thì bị nén — cả
 * hai đều làm lỗi biến dạng và thuật toán đo sai.
 */
export function lineScanNeed(input: {
  speedMmS: number;
  mmPerPxCross: number;
  lineWidthPx: number;
  bytesPerPixel: number;
}): LineScanNeed | null {
  const { speedMmS, mmPerPxCross, lineWidthPx, bytesPerPixel } = input;
  if (speedMmS <= 0 || mmPerPxCross <= 0 || lineWidthPx <= 0 || bytesPerPixel <= 0) return null;

  const lineRateHz = speedMmS / mmPerPxCross;
  return {
    lineRateHz: round(lineRateHz, 1),
    maxExposureMs: round(1000 / lineRateHz, 4),
    dataRateMbytesS: round((lineWidthPx * lineRateHz * bytesPerPixel) / 1e6, 2),
  };
}

/**
 * Encoder có đủ mịn để phát xung cho từng dòng không.
 *
 * Không có encoder, hoặc encoder thô hơn một pixel, thì mỗi lần băng tải trôi
 * tốc độ là ảnh dãn/nén theo — không phát hiện ra bằng mắt cho tới khi đo sai.
 */
export function encoderFineEnough(encoderUm: number, mmPerPxCross: number): boolean {
  return encoderUm / 1000 <= mmPerPxCross;
}

export function lineScanChecks(input: {
  speedMmS: number | null;
  mmPerPxCross: number | null;
  lineWidthPx: number | null;
  maxLineRateKhz: number | null;
  pixelFormat: string;
  interfaceName: string | null;
  encoderResolutionUm: number | null;
}): Check[] {
  const checks: Check[] = [];
  const bytes = PIXEL_FORMAT_BYTES[input.pixelFormat];

  if (
    input.speedMmS === null ||
    input.mmPerPxCross === null ||
    input.lineWidthPx === null ||
    bytes === undefined
  ) {
    return checks;
  }

  const need = lineScanNeed({
    speedMmS: input.speedMmS,
    mmPerPxCross: input.mmPerPxCross,
    lineWidthPx: input.lineWidthPx,
    bytesPerPixel: bytes,
  });
  if (!need) return checks;

  checks.push({
    key: 'lineRateRequired',
    status: 'info',
    formula: `${fmt(input.speedMmS)} mm/s ÷ ${fmt(input.mmPerPxCross, 5)} mm/px = ${fmt(need.lineRateHz, 0)} dòng/s`,
    noteKey: 'lineRateSquarePixel',
  });

  if (input.maxLineRateKhz !== null) {
    const maxHz = input.maxLineRateKhz * 1000;
    const fits = need.lineRateHz <= maxHz;
    checks.push({
      key: 'lineRateFits',
      status: fits ? 'pass' : 'fail',
      formula: `${fmt(need.lineRateHz, 0)} dòng/s ${fits ? '≤' : '>'} ${fmt(maxHz, 0)} dòng/s của camera`,
      noteKey: fits ? undefined : 'lineRateTooHigh',
    });
  }

  checks.push({
    key: 'lineExposure',
    status: need.maxExposureMs < 0.1 ? 'warn' : 'pass',
    formula: `1000 ÷ ${fmt(need.lineRateHz, 0)} = ${fmt(need.maxExposureMs, 4)} ms mỗi dòng`,
    noteKey: 'lineNeedsBrightLight',
  });

  const capacity = input.interfaceName ? INTERFACE_BANDWIDTH[input.interfaceName] : undefined;
  const carries = capacity !== undefined && capacity >= need.dataRateMbytesS;
  checks.push({
    key: 'lineDataRate',
    status: capacity === undefined ? 'info' : carries ? 'pass' : 'fail',
    formula:
      `${input.lineWidthPx} px × ${fmt(need.lineRateHz, 0)} dòng/s × ${bytes} byte = ` +
      `${fmt(need.dataRateMbytesS, 1)} MB/s` +
      (capacity !== undefined ? ` ${carries ? '≤' : '>'} ${capacity} MB/s` : ''),
    noteKey: capacity !== undefined && !carries ? 'lineBandwidthTooHigh' : undefined,
  });

  if (input.encoderResolutionUm !== null) {
    const fine = encoderFineEnough(input.encoderResolutionUm, input.mmPerPxCross);
    checks.push({
      key: 'encoder',
      status: fine ? 'pass' : 'warn',
      formula: `${fmt(input.encoderResolutionUm)} µm/xung ${fine ? '≤' : '>'} ${fmt(input.mmPerPxCross * 1000, 1)} µm/px`,
      noteKey: fine ? undefined : 'encoderTooCoarse',
    });
  } else {
    checks.push({
      key: 'encoder',
      status: 'warn',
      formula: '—',
      noteKey: 'encoderMissing',
    });
  }

  return checks;
}
