import type { EngineParams } from './engineParams';

/**
 * Phép tính tốc độ cao dùng CHUNG cho Thiết kế hệ thống (requirementAnalysis.ts) và
 * trang Chọn camera (cameraSelector.ts) — đợt 2, chốt 2026-10-27 (Q1–Q7), đối chiếu
 * Vision-Doctor, VA Imaging, Basler, Allied Vision, Baumer, Balluff, Gardasoft.
 * Hàm thuần.
 */

/** THR-007: đáp ứng cảm biến quang khi chưa nhập (giả định ở bảng Yêu cầu và trang Camera). */
export const DEFAULT_SENSOR_RESPONSE_MS = 0.5;
/** LGT-024: phơi lúc chụp mẫu khi chưa nhập — ước tính 1 ms với đèn liên tục. */
export const DEFAULT_SAMPLE_EXPOSURE_MS = 1;

/** Nguồn trigger chụp. 'photoSensor' = cảm biến quang → chân trigger phần cứng camera. */
export type TriggerSource = 'photoSensor' | 'software' | 'encoder';

/** THR-005 (Q4): px nhoè cho phép — bài đo chặt hơn bài phát hiện lỗi (Vision-Doctor: 0,5–2 px mắt không thấy). */
export function blurPxFor(params: EngineParams, measuring: boolean): number {
  return measuring ? params.blurPxAllowed : params.blurPxDetect;
}

/** THR-005: phơi sáng tối đa (µs) = k_blur × mm/px ÷ v. */
export function maxExposureUs(blurPx: number, mmPerPx: number, speedMmS: number): number {
  return ((blurPx * mmPerPx) / speedMmS) * 1e6;
}

/**
 * THR-007 (Q3): độ lệch NGẪU NHIÊN của thời điểm chụp = đáp ứng cảm biến + jitter camera.
 * Trigger phần cứng lệch cỡ µs, trigger phần mềm cỡ ms (Baumer); encoder bám băng tải → null.
 * Độ trễ CỐ ĐỊNH (exposure start delay) không tính vào đây — bù được bằng trigger delay.
 */
export function triggerJitterMs(source: TriggerSource, sensorMs: number, params: EngineParams): { totalMs: number; cameraMs: number } | null {
  if (source === 'encoder') return null;
  const cameraMs = source === 'software' ? params.cameraJitterSoftwareMs : params.cameraJitterHardwareMs;
  return { totalMs: sensorMs + cameraMs, cameraMs };
}

export type StrobeVerdict = 'continuous' | 'overdrive' | 'boostTooHigh' | 'dutyTooHigh';

/**
 * LGT-024: hệ số sáng = phơi lúc chụp mẫu ÷ t_max; duty = t_max × số ảnh/giây.
 * Overdrive thường tới ~10× dòng định mức, duty 3–10 % (Gardasoft, Vision Systems Design).
 */
export function strobeLight(input: { sampleExposureMs: number; exposureMaxUs: number; fps: number | null; params: EngineParams }): {
  boost: number;
  duty: number | null;
  verdict: StrobeVerdict;
} {
  const boost = (input.sampleExposureMs * 1000) / input.exposureMaxUs;
  const duty = input.fps !== null ? input.exposureMaxUs * 1e-6 * input.fps : null;
  const verdict: StrobeVerdict =
    boost <= 1 ? 'continuous' : duty !== null && duty > input.params.strobeMaxDuty ? 'dutyTooHigh' : boost > input.params.strobeBoostMax ? 'boostTooHigh' : 'overdrive';
  return { boost, duty, verdict };
}

/** Duty rất nhỏ (xung µs, vài ảnh/giây) làm tròn ra "0" — ghi "< 0.01" cho khỏi hiểu nhầm là không chớp. */
export function dutyText(duty: number | null, fmt: (n: number, digits?: number) => string): string {
  return duty === null ? '—' : duty * 100 < 0.01 ? '< 0.01' : fmt(duty * 100, 2);
}

/**
 * CAM-002 (Q2): fps cảm biến khi tính cả thời gian phơi. Đọc chồng phơi (overlapped — hầu hết
 * CMOS global shutter): 1 ÷ max(t_đọc, t_phơi); không chồng: 1 ÷ (t_đọc + t_phơi) (Balluff, Teledyne).
 * t_đọc ≈ 1 ÷ fps tối đa của cảm biến (ở số hàng đang đọc).
 */
export function exposureLimitedFps(sensorFps: number, exposureUs: number | null, overlapped: boolean): number {
  if (exposureUs === null || !(exposureUs > 0)) return sensorFps;
  const readoutS = 1 / sensorFps;
  const exposureS = exposureUs / 1e6;
  // Phơi ngắn hơn thời gian đọc khi chồng phơi: trả đúng fps cảm biến — tránh 1 ÷ (1 ÷ f) lệch dấu phẩy động
  // làm giao diện ghi nhầm "giới hạn bởi thời gian phơi".
  if (overlapped) return exposureS <= readoutS ? sensorFps : 1 / exposureS;
  return 1 / (readoutS + exposureS);
}
