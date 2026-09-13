/**
 * Điểm vào của Vision Engineer ở trang chủ (spec V1.1 §10.1, V1a hạng mục 1–2).
 *
 * Trang chủ có hai cách bắt đầu: gõ bài toán bằng lời, hoặc bấm một thẻ ứng
 * dụng. Cả hai đổ về CÙNG một payload để bước sau (parser, requirement summary)
 * chỉ có một cửa vào — spec cấm dựng kiến trúc riêng cho từng ứng dụng.
 *
 * File thuần TypeScript: không import React, không import tầng AI.
 */

/** 8 giá trị `Requirement.applicationType`, đúng thứ tự khai báo ở spec §3. */
export const APPLICATION_TYPES = [
  'AppearanceInspection',
  'Measurement',
  'OCR',
  '3D',
  'RobotGuidance',
  'AIInspection',
  'AssemblyInspection',
  'Other',
] as const;

export type ApplicationType = (typeof APPLICATION_TYPES)[number];

/** Thứ tự thẻ trên trang chủ, theo sơ đồ §10.1 (khác thứ tự khai báo type). */
export const APPLICATION_SHORTCUT_ORDER: readonly ApplicationType[] = [
  'Measurement',
  'AppearanceInspection',
  'AIInspection',
  '3D',
  'RobotGuidance',
  'OCR',
  'AssemblyInspection',
  'Other',
];

export type VisionEntrySource = 'freeText' | 'applicationCard';

export interface VisionEntryPayload {
  source: VisionEntrySource;
  /** Văn bản người dùng gõ, đã trim. `null` khi vào từ thẻ ứng dụng. */
  rawText: string | null;
  /**
   * Chọn từ thẻ thì biết ngay. Gõ tự do thì `null` — việc nhận ra loại ứng
   * dụng là của parser, trang chủ không đoán.
   */
  applicationType: ApplicationType | null;
}

/** `null` khi chỉ có khoảng trắng: không có gì để phân tích. */
export function freeTextEntry(text: string): VisionEntryPayload | null {
  const rawText = text.trim();
  if (!rawText) return null;
  return { source: 'freeText', rawText, applicationType: null };
}

export function applicationCardEntry(applicationType: ApplicationType): VisionEntryPayload {
  return { source: 'applicationCard', rawText: null, applicationType };
}
