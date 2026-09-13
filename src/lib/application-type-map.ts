/**
 * Thẻ ứng dụng ở trang chủ → bài toán có sẵn của bộ chọn thiết bị.
 *
 * Nguồn DUY NHẤT của mapping này. 8 `ApplicationType` của spec không khớp 1-1
 * với 7 dòng `task_types`: slug dưới đây đã đối chiếu với bảng task_types thật
 * trên Supabase (2026-09-13), không suy từ tên.
 *
 * - `null` = chưa có bài toán tương ứng → thẻ hiện "Sắp có", không điều hướng.
 * - OCR / Code trỏ `ocr-ocv`; `barcode-reading` vẫn vào được từ lưới bài toán.
 * - `alignment` không có thẻ ở trang chủ, vẫn nằm trên lưới bài toán.
 *
 * Không thêm task_type mới ở đây — thêm bài toán là việc của database.
 * File thuần TypeScript: không import React, không import tầng AI.
 */
import type { ApplicationType } from './visionEntry';

export const APPLICATION_TASK_SLUG: Readonly<Record<ApplicationType, string | null>> = {
  Measurement: '2d-measurement',
  AppearanceInspection: 'appearance-inspection',
  '3D': '3d-measurement',
  RobotGuidance: 'robot-guidance',
  OCR: 'ocr-ocv',
  AIInspection: null,
  AssemblyInspection: null,
  Other: null,
};

/** Đường vào bộ chọn cho một thẻ, hoặc `null` nếu thẻ đó chưa có bài toán. */
export function selectorHrefFor(type: ApplicationType): string | null {
  const slug = APPLICATION_TASK_SLUG[type];
  return slug ? `/cong-cu-chon-thiet-bi/${slug}` : null;
}
