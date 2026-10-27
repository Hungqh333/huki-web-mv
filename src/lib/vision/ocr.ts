import type { Component } from '@/lib/components/specs';
import { areaNeed, selectAreaCameras, type AreaCameraInput, type AreaCandidate, type AreaNeed } from './cameraSelector';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from './engineParams';
import type { TriggerSource } from './highSpeed';

/**
 * Bộ chọn camera OCR / OCV — trang /chon-ocr (chốt 2026-10-27, Q5–Q7). Hàm thuần.
 *
 * - OCR-001: mm/px cần = min(chiều cao ký tự ÷ px/chiều cao, độ dày nét ÷ px/nét) — lấy
 *   số chặt hơn; vùng nhìn = khối chữ + 2 × dung sai vị trí.
 * - OCR-002: kiểu in quyết định đèn (in phun / laser / in nhiệt → vòm hoặc vòng; dập nổi /
 *   khắc → chiếu nghiêng góc thấp) — gợi ý, phải chụp mẫu.
 * - OCR-003: truyền thống trước (CLAUDE.md §4); chỉ báo cân nhắc học sâu khi nền phức tạp
 *   hoặc font thay đổi; ký tự in phun chấm rời thì lưu ý nối chấm.
 * - Camera dùng lại đúng bộ kiểm của trang Chọn camera (CAM-001/002).
 */

export type PrintType = 'inkjet' | 'laser' | 'thermal' | 'embossed';
export const PRINT_TYPES: readonly PrintType[] = ['inkjet', 'laser', 'thermal', 'embossed'];
export type OcrMode = 'ocr' | 'ocv';
export type OcrBackground = 'plain' | 'complex';
export type OcrFont = 'fixed' | 'varies';

/** Khoảng cách dòng mặc định khi chưa nhập: 1,5 × chiều cao ký tự. */
export const DEFAULT_LINE_SPACING_FACTOR = 1.5;

export type OcrInput = {
  mode: OcrMode;
  printType: PrintType;
  charHeightMm: number;
  /** Độ dày nét (mm); null = chỉ tính theo chiều cao ký tự. */
  strokeMm: number | null;
  /** Chiều dài dòng chữ dài nhất (mm). */
  textWidthMm: number;
  lines: number;
  /** Khoảng cách giữa hai đường chân dòng (mm); null = 1,5 × chiều cao ký tự. */
  lineSpacingMm: number | null;
  toleranceXMm: number;
  toleranceYMm: number;
  background: OcrBackground;
  font: OcrFont;
  speedMmS: number | null;
  partsPerMinute: number | null;
  triggerSource: TriggerSource;
};

export type LightAdvice = 'domeOrRing' | 'lowAngle';
export type AlgorithmAdvice = 'traditional' | 'dotJoin' | 'deepLearning';

export type OcrNeed = {
  pxPerChar: number;
  pxPerStroke: number;
  mmPerPxByHeight: number;
  mmPerPxByStroke: number | null;
  /** 'height' | 'stroke' — trục nào quyết định mm/px. */
  governedBy: 'height' | 'stroke';
  mmPerPx: number;
  blockWidthMm: number;
  blockHeightMm: number;
  fovWidthMm: number;
  fovHeightMm: number;
  light: LightAdvice;
  algorithm: AlgorithmAdvice;
  /** Bảng tính tốc độ cao của trang Camera cho vùng nhìn này. */
  speed: AreaNeed;
};

export function ocrNeed(input: OcrInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): OcrNeed {
  const pxPerChar = params.ocrPxPerCharHeight;
  const pxPerStroke = params.ocrPxPerStroke;
  const mmPerPxByHeight = input.charHeightMm / pxPerChar;
  const mmPerPxByStroke = input.strokeMm !== null && input.strokeMm > 0 ? input.strokeMm / pxPerStroke : null;
  const governedBy = mmPerPxByStroke !== null && mmPerPxByStroke < mmPerPxByHeight ? 'stroke' : 'height';
  const mmPerPx = governedBy === 'stroke' ? mmPerPxByStroke! : mmPerPxByHeight;
  const lines = Math.max(1, Math.round(input.lines));
  const spacing = input.lineSpacingMm ?? DEFAULT_LINE_SPACING_FACTOR * input.charHeightMm;
  const blockWidthMm = input.textWidthMm;
  const blockHeightMm = input.charHeightMm + (lines - 1) * spacing;
  const fovWidthMm = blockWidthMm + 2 * input.toleranceXMm;
  const fovHeightMm = blockHeightMm + 2 * input.toleranceYMm;
  const light: LightAdvice = input.printType === 'embossed' ? 'lowAngle' : 'domeOrRing';
  const algorithm: AlgorithmAdvice = input.background === 'complex' || input.font === 'varies' ? 'deepLearning' : input.printType === 'inkjet' ? 'dotJoin' : 'traditional';
  return {
    pxPerChar,
    pxPerStroke,
    mmPerPxByHeight,
    mmPerPxByStroke,
    governedBy,
    mmPerPx,
    blockWidthMm,
    blockHeightMm,
    fovWidthMm,
    fovHeightMm,
    light,
    algorithm,
    speed: areaNeed(cameraInputForOcr(input, { fovWidthMm, fovHeightMm, mmPerPx }), params),
  };
}

/** Đầu vào trang Chọn camera tương ứng — OCR là bài phát hiện (nhoè 1 px), 1 ảnh mỗi sản phẩm. */
export function cameraInputForOcr(input: OcrInput, geometry: { fovWidthMm: number; fovHeightMm: number; mmPerPx: number }): AreaCameraInput {
  return {
    fovWidthMm: geometry.fovWidthMm,
    fovHeightMm: geometry.fovHeightMm,
    targetMmPerPx: geometry.mmPerPx,
    color: 'any',
    measuring: false,
    speedMmS: input.speedMmS,
    partsPerMinute: input.partsPerMinute,
    imagesPerPart: 1,
    triggerSource: input.triggerSource,
    sensorResponseMs: null,
    sampleExposureMs: null,
    overlapped: true,
  };
}

export function selectOcrCameras(components: Component[], input: OcrInput, params: EngineParams = DEFAULT_ENGINE_PARAMS): { need: OcrNeed; candidates: AreaCandidate[] } {
  const need = ocrNeed(input, params);
  const { candidates } = selectAreaCameras(components, cameraInputForOcr(input, need), params);
  return { need, candidates };
}
