/**
 * Danh sách lựa chọn của trang Chọn đèn — CHỈ tên khoá và gợi ý điền sẵn, không có luật hay bảng tra.
 * Giao diện (chạy ở trình duyệt) chỉ được import file này; bảng và cách chọn nằm ở lightMatrix.ts /
 * lightColor.ts / lightSelector.ts và chỉ chạy trên máy chủ (chốt 2026-10-22 Q1).
 *
 * Bản 2 — chốt 2026-10-22 (docs/NHAP_CHON_DEN_V2.md, Hùng duyệt Đ toàn bộ): nhập 5 bước
 * bài toán → cần thấy gì → vật liệu → bề mặt + hình dạng → màu chi tiết + màu nền.
 * Chỉ trang Chọn đèn dùng; bảng Yêu cầu / bộ chọn cũ giữ danh sách cũ (lighting.ts, Q6).
 */

/** Bước 1 — bài toán. */
export const LIGHT_TASKS = ['inspect', 'presence', 'align', 'measure', 'code', 'color'] as const;
export type LightTask = (typeof LIGHT_TASKS)[number];

/** Bước 2 — cần thấy gì, theo bài toán (mục 2 của nháp). */
export const TASK_FEATURES = {
  inspect: ['scratch', 'crack_chip', 'dent_bump', 'burr', 'stain', 'particle', 'void', 'coating', 'print', 'wrinkle', 'solder'],
  presence: ['raised', 'flat_color', 'hole', 'transparent_part', 'shiny_part', 'wire'],
  align: ['outline', 'fiducial', 'hole', 'corner'],
  measure: ['outline', 'hole', 'surface_edge'],
  code: ['ink_label', 'dpm', 'curved_print'],
  color: ['color_match', 'color_shading'],
} as const satisfies Record<LightTask, readonly string[]>;
export type LightFeature = (typeof TASK_FEATURES)[LightTask][number];
export const ALL_FEATURES = [...new Set(Object.values(TASK_FEATURES).flat())] as LightFeature[];

/** Đường bao / lỗ xuyên: đặt được đèn phía sau vật thì đèn nền thắng (bước 6.1 của nháp). */
export const SILHOUETTE_FEATURES: readonly string[] = ['outline', 'hole'];

/** Móp / lõm: độ sâu (mục 2.1b). */
export const DENT_DEPTHS = ['visible', 'shallow'] as const;
export type DentDepth = (typeof DENT_DEPTHS)[number];

/** Bước 4.1 — độ bóng. */
export const LIGHT_FINISHES = ['matte', 'semi_gloss', 'mirror_flat', 'mirror_curved', 'textured', 'transparent', 'translucent'] as const;
export type LightFinish = (typeof LIGHT_FINISHES)[number];

/** Bước 4.2 — hình dạng. */
export const LIGHT_SHAPES = ['flat', 'curved', 'stepped'] as const;
export type LightShape = (typeof LIGHT_SHAPES)[number];

/** Bước 5 — 13 màu cho chi tiết và nền (mục 5). */
export const COLORS = ['white', 'gray', 'black', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'brown', 'gold'] as const;
export type SurfaceColor = (typeof COLORS)[number];

/** Mục đích đặc biệt về bước sóng (IR nhìn xuyên lớp in, UV huỳnh quang). */
export const LIGHT_PURPOSES = ['seeThrough', 'fluorescent'] as const;
export type LightPurpose = (typeof LIGHT_PURPOSES)[number];

/** Màu đèn — đúng khoá `color` của đèn trong kho thiết bị (specs.ts). */
export const LIGHT_COLORS = ['white', 'red', 'green', 'blue', 'ir', 'uv'] as const;
export type LightColor = (typeof LIGHT_COLORS)[number];

/**
 * Bước 3 — vật liệu và gợi ý điền sẵn (mục 3 của nháp). Gợi ý chỉ điền ô CÒN TRỐNG / vừa đổi
 * vật liệu; người dùng sửa lại được. Không phải luật — luật chỉ đọc bề mặt, hình dạng, màu.
 */
export const MATERIALS = {
  metal_machined: { finish: 'textured', shape: null, color: 'gray' },
  metal_cast: { finish: 'matte', shape: null, color: 'gray' },
  metal_sheet: { finish: 'semi_gloss', shape: 'flat', color: 'gray' },
  metal_polished: { finish: 'mirror_flat', shape: null, color: 'gray' },
  aluminum_anodized: { finish: 'matte', shape: null, color: null },
  copper_gold: { finish: 'mirror_flat', shape: null, color: 'gold' },
  plastic_matte: { finish: 'matte', shape: null, color: null },
  plastic_glossy: { finish: 'semi_gloss', shape: null, color: null },
  plastic_clear: { finish: 'transparent', shape: null, color: null },
  plastic_translucent: { finish: 'translucent', shape: null, color: 'white' },
  rubber: { finish: 'matte', shape: null, color: 'black' },
  pcb: { finish: 'semi_gloss', shape: 'stepped', color: 'green' },
  glass: { finish: 'transparent', shape: 'flat', color: null },
  ceramic: { finish: 'semi_gloss', shape: null, color: 'white' },
  film_foil: { finish: 'semi_gloss', shape: 'flat', color: null },
  paper_label: { finish: 'matte', shape: 'flat', color: 'white' },
  fabric: { finish: 'textured', shape: null, color: null },
  wood: { finish: 'textured', shape: null, color: 'brown' },
  painted: { finish: 'semi_gloss', shape: null, color: null },
  wafer: { finish: 'mirror_flat', shape: 'flat', color: 'gray' },
} as const satisfies Record<string, { finish: LightFinish; shape: LightShape | null; color: SurfaceColor | null }>;
export type LightMaterial = keyof typeof MATERIALS;
export const LIGHT_MATERIALS = Object.keys(MATERIALS) as LightMaterial[];

/** Kiểu đèn của trang Chọn đèn — 7 kiểu cũ + 3 kiểu thêm (Q4): vòng nhiều tầng góc, đèn sọc, đèn line. */
export const LIGHT_TYPES_V2 = [
  'ring',
  'dome',
  'backlight',
  'bar',
  'coaxial',
  'darkfield',
  'photometric_stereo',
  'multi_angle_ring',
  'structured_stripe',
  'line',
] as const;
export type LightTypeV2 = (typeof LIGHT_TYPES_V2)[number];
