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

/**
 * Độ phân giải chọn được: khoá `rộngxcao` → [rộng, cao, MP danh định theo cách hãng gọi].
 * MP danh định dùng cho luật "ảnh từ 20MP chạy AI" (5472×3648 hãng gọi 20MP dù tính ra 19,96).
 *
 * 2026-11-04: bổ sung từ kho camera thật (NHAP_THIET_BI v5, 357 camera area scan) — lấy các
 * độ phân giải có từ 8 camera trở lên, cộng các loại cao cấp 31–151MP kho đang có. 6 mức
 * đầu tiên của mẫu đã duyệt (1.3 / 2.3 / 5 / 12 / 20 / 25MP) vẫn giữ nguyên.
 * 2026-11-04 (lần 2): thêm 8 mức của dòng Large Area Scan iRayple theo ảnh trang hãng Hùng gửi
 * (18 / 21 / 30 / 46 / 49 / 65 / 103MP và 14160×10640 của bản CameraLink).
 */
export const PC_RESOLUTIONS = {
  '720x540': [720, 540, 0.4],
  '800x600': [800, 600, 0.5],
  '1280x1024': [1280, 1024, 1.3],
  '1440x1080': [1440, 1080, 1.6],
  '1624x1240': [1624, 1240, 2],
  '1920x1200': [1920, 1200, 2.3],
  '2048x1200': [2048, 1200, 2.5],
  '2048x1536': [2048, 1536, 3.2],
  '2448x2048': [2448, 2048, 5],
  '2592x1944': [2592, 1944, 5],
  '2592x2048': [2592, 2048, 5.3],
  '3072x2048': [3072, 2048, 6.3],
  '4096x2160': [4096, 2160, 8.9],
  '4000x3000': [4000, 3000, 12],
  '4096x3000': [4096, 3000, 12],
  '4096x3072': [4096, 3072, 12.6],
  '4496x4096': [4496, 4096, 18],
  '5472x3648': [5472, 3648, 20],
  '5120x4096': [5120, 4096, 21],
  '5120x5120': [5120, 5120, 25],
  '6240x4848': [6240, 4848, 30],
  '6464x4852': [6464, 4852, 31],
  '9280x4992': [9280, 4992, 46],
  '9344x5000': [9344, 5000, 47],
  '7008x7000': [7008, 7000, 49],
  '9280x6992': [9280, 6992, 65],
  '9344x7000': [9344, 7000, 65],
  '11264x9200': [11264, 9200, 103],
  '14160x10640': [14160, 10640, 151],
  '14192x10640': [14192, 10640, 151],
} as const;
export type PcResolution = keyof typeof PC_RESOLUTIONS;
export const PC_RESOLUTION_KEYS = Object.keys(PC_RESOLUTIONS) as PcResolution[];

/** "5MP (2448×2048)" — tên hiện trên giao diện. */
export function resolutionLabel(key: PcResolution): string {
  const [w, h, mp] = PC_RESOLUTIONS[key];
  return `${mp}MP (${w}×${h})`;
}
export const PC_BITS = [8, 10, 12, 16] as const;
export const PC_IMAGE_FORMATS = ['raw', 'png', 'jpeg'] as const;
