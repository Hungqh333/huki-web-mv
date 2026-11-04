/**
 * PC Vision — tab Bảng fps (gói bàn giao 03/11/2026 mục 5, tab 3; mẫu veFps()).
 *
 * Ma trận 6 độ phân giải × 11 giao tiếp: fps tối đa theo DÂY CÁP cho ảnh 8 bit
 * = ⌊băng thông ÷ MB mỗi khung⌋. Có thời gian phơi sáng thì chặn thêm ⌊1000 ÷ exposure(ms)⌋
 * (phơi sáng chồng lấn). Tính ở máy chủ; trang chỉ nhận số.
 */

import type { EngineParams } from '@/lib/vision/engineParams';
import { PC_INTERFACE_KEYS, PC_RESOLUTION_KEYS, type PcInterface, type PcResolution } from './options';
import { interfaceBandwidth, mbPerFrame } from './suggest';

export type FpsBand = 'low' | 'mid' | 'high';

export type FpsTable = {
  interfaces: { key: PcInterface; mbps: number }[];
  rows: {
    resolution: PcResolution;
    mbPerFrame: number;
    cells: { fps: number; cableFps: number; limitedByExposure: boolean; band: FpsBand }[];
  }[];
  /** Trần do phơi sáng; null = không xét. */
  exposureCap: number | null;
  bands: { low: number; high: number };
};

/** PC-FPS: phơi sáng chồng lấn — fps ≤ ⌊1000 ÷ exposure(ms)⌋. */
export function exposureFpsCap(exposureMs: number): number | null {
  return exposureMs > 0 ? Math.floor(1000 / exposureMs) : null;
}

/** Màu ô: < ngưỡng thấp đỏ, ngưỡng thấp–cao vàng, > ngưỡng cao xanh. */
export function fpsBand(params: EngineParams, fps: number): FpsBand {
  return fps < params.pcFpsLow ? 'low' : fps <= params.pcFpsHigh ? 'mid' : 'high';
}

export function fpsTable(params: EngineParams, exposureMs: number): FpsTable {
  const cap = exposureFpsCap(exposureMs);
  const interfaces = PC_INTERFACE_KEYS.map((key) => ({ key, mbps: interfaceBandwidth(params, key) }));
  return {
    interfaces,
    rows: PC_RESOLUTION_KEYS.map((resolution) => {
      const mb = mbPerFrame(resolution, 8);
      return {
        resolution,
        mbPerFrame: mb,
        cells: interfaces.map(({ mbps }) => {
          const cableFps = Math.floor(mbps / mb);
          const fps = cap === null ? cableFps : Math.min(cableFps, cap);
          return { fps, cableFps, limitedByExposure: fps < cableFps, band: fpsBand(params, fps) };
        }),
      };
    }),
    exposureCap: cap,
    bands: { low: params.pcFpsLow, high: params.pcFpsHigh },
  };
}
