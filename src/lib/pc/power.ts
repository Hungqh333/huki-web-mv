import type { EngineParams } from '@/lib/vision/engineParams';
import type { PcPowerModel } from './code';

/**
 * PC-PSU — công suất card GPU (W) để ước tải đỉnh của khung mới trên form PC Vision.
 * Số theo mẫu đã duyệt trong gói bàn giao 03/11/2026 (công suất board của NVIDIA).
 * Chip không có trong bảng thì lấy GPU_FALLBACK_W.
 */
export const GPU_BOARD_POWER_W: Readonly<Record<string, number>> = {
  '5060': 150,
  '5060TI': 180,
  '5070': 250,
  '5070TI': 300,
  '5080': 360,
  '5090': 575,
  '4070S': 220,
};
export const GPU_FALLBACK_W = 300;

/**
 * Mô hình ước tải đỉnh — chỉ dựng ở máy chủ, chỉ gửi xuống trình duyệt của Admin.
 * Không đánh dấu 'server-only' vì test (tsx) và sổ tay công thức import file này;
 * file 'use client' không được import nó (chỉ import pc/code.ts).
 */
export function pcPowerModel(params: EngineParams): PcPowerModel {
  return {
    gpuW: GPU_BOARD_POWER_W,
    gpuFallbackW: GPU_FALLBACK_W,
    cpuW: params.pcCpuPeakW,
    baseW: params.pcBaseLoadW,
    maxShare: params.pcPsuMaxShare,
  };
}
