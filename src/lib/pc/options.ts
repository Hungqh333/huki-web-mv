/**
 * Lựa chọn trên tab Gợi ý PC Vision — chỉ là danh sách, không có công thức, nên form phía
 * trình duyệt import được. Công thức nằm ở pc/suggest.ts (chỉ máy chủ).
 */

/** Giao tiếp camera chọn được (mẫu đã duyệt, 11 loại). */
export const PC_INTERFACE_KEYS = [
  'GigE',
  '2.5GigE',
  '5GigE',
  '10GigE',
  'USB3',
  'CameraLink-Base',
  'CameraLink-Medium',
  'CameraLink-Full',
  'CameraLink-Deca',
  'CXP-12x1',
  'CXP-12x4',
] as const;
export type PcInterface = (typeof PC_INTERFACE_KEYS)[number];

/** Tên hiện trên giao diện. */
export const PC_INTERFACE_LABEL: Record<PcInterface, string> = {
  GigE: 'GigE',
  '2.5GigE': '2.5GigE',
  '5GigE': '5GigE',
  '10GigE': '10GigE',
  USB3: 'USB3',
  'CameraLink-Base': 'CL Base',
  'CameraLink-Medium': 'CL Medium',
  'CameraLink-Full': 'CL Full',
  'CameraLink-Deca': 'CL Deca',
  'CXP-12x1': 'CXP-12 ×1',
  'CXP-12x4': 'CXP-12 ×4',
};

/** Độ phân giải chọn được: [rộng, cao, MP danh định]. */
export const PC_RESOLUTIONS = {
  '1.3MP': [1280, 1024, 1.3],
  '2.3MP': [1920, 1200, 2.3],
  '5MP': [2448, 2048, 5],
  '12MP': [4096, 3000, 12],
  '20MP': [5472, 3648, 20],
  '25MP': [5120, 5120, 25],
} as const;
export type PcResolution = keyof typeof PC_RESOLUTIONS;
export const PC_RESOLUTION_KEYS = Object.keys(PC_RESOLUTIONS) as PcResolution[];
export const PC_BITS = [8, 10, 12, 16] as const;
export const PC_IMAGE_FORMATS = ['raw', 'png', 'jpeg'] as const;
