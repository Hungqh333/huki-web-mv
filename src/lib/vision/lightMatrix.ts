import { SILHOUETTE_FEATURES, type DentDepth, type LightFeature, type LightFinish, type LightShape, type LightTask, type LightTypeV2 } from './lightOptions';

/**
 * Chọn KIỂU đèn cho trang Chọn đèn — bản 2, chốt 2026-10-22 (docs/NHAP_CHON_DEN_V2.md mục 6–7,
 * Hùng duyệt Đ toàn bộ). Bảng (đèn chính / thay thế cho từng dòng) sửa được qua admin
 * (engineTables 'lightMatrix'); THỨ TỰ XÉT nằm trong code:
 *
 *   LGT-017  đo / căn chỉnh / có-không theo đường bao hoặc lỗ xuyên, đặt được đèn phía sau → đèn nền
 *   LGT-018  bề mặt trong suốt (kiểm lỗi): lỗi bên trong → đèn nền; lỗi trên mặt → góc thấp
 *   LGT-019  bóng phẳng như gương → đồng trục; xước / dị vật → góc thấp
 *   LGT-020  bóng cong → vòm; móp → nhiều hướng / đèn sọc
 *   LGT-021  nhiều bậc cao thấp (bản mạch) → vòm / vòng nhiều tầng; dấu định vị → đồng trục
 *   LGT-022  còn lại, kiểm lỗi → ma trận lỗi × bề mặt (mờ / bán bóng / có vân)
 *   LGT-023  còn lại, bài toán khác → bảng theo bài toán × cần thấy gì
 *
 * Nguồn: Opto Engineering, KEYENCE, Advanced Illumination, Edmund Optics (xem nháp).
 */

export type MatrixRow = { lightType: LightTypeV2; alternativeType: LightTypeV2 | null };

const row = (lightType: LightTypeV2, alternativeType: LightTypeV2 | null = null): MatrixRow => ({ lightType, alternativeType });

/** Lỗi trong ma trận (móp tách theo độ sâu). */
const MATRIX_DEFECTS = ['scratch', 'crack_chip', 'dent_bump', 'dent_shallow', 'burr', 'stain', 'particle', 'void', 'coating', 'print', 'wrinkle', 'solder'] as const;
/** Ba bề mặt của ma trận — bóng phẳng / bóng cong / trong suốt đã xét trước (LGT-018…020). */
const MATRIX_FINISHES = ['matte', 'semi_gloss', 'textured'] as const;

/** Mặc định = đúng bảng trong nháp đã duyệt. Khoá chỉ chữ + gạch dưới (ràng buộc row_key của engine_tables). */
export const DEFAULT_MATRIX_ROWS = {
  // ── Thứ tự xét 6.1–6.5 ──
  ovr_silhouette: row('backlight'),
  ovr_transparent_inside: row('backlight', 'darkfield'),
  ovr_transparent_surface: row('darkfield', 'backlight'),
  ovr_mirror_flat: row('coaxial', 'darkfield'),
  ovr_mirror_flat_bright: row('darkfield', 'coaxial'),
  ovr_mirror_curved: row('dome'),
  ovr_mirror_curved_dent: row('photometric_stereo', 'structured_stripe'),
  ovr_stepped: row('dome', 'multi_angle_ring'),
  ovr_stepped_fiducial: row('coaxial', 'ring'),

  // ── Ma trận lỗi × bề mặt (mục 7) ──
  m_scratch_matte: row('darkfield', 'bar'),
  m_scratch_semi_gloss: row('darkfield', 'dome'),
  m_scratch_textured: row('bar', 'dome'),
  m_crack_chip_matte: row('darkfield', 'ring'),
  m_crack_chip_semi_gloss: row('darkfield', 'coaxial'),
  m_crack_chip_textured: row('darkfield', 'dome'),
  m_dent_bump_matte: row('bar', 'photometric_stereo'),
  m_dent_bump_semi_gloss: row('dome', 'photometric_stereo'),
  m_dent_bump_textured: row('bar', 'photometric_stereo'),
  m_dent_shallow_matte: row('photometric_stereo'),
  m_dent_shallow_semi_gloss: row('photometric_stereo'),
  m_dent_shallow_textured: row('photometric_stereo'),
  m_burr_matte: row('backlight', 'darkfield'),
  m_burr_semi_gloss: row('backlight', 'darkfield'),
  m_burr_textured: row('backlight', 'darkfield'),
  m_stain_matte: row('dome', 'ring'),
  m_stain_semi_gloss: row('dome', 'coaxial'),
  m_stain_textured: row('dome', 'ring'),
  m_particle_matte: row('darkfield', 'ring'),
  m_particle_semi_gloss: row('darkfield', 'coaxial'),
  m_particle_textured: row('dome', 'darkfield'),
  m_void_matte: row('darkfield', 'ring'),
  m_void_semi_gloss: row('darkfield', 'dome'),
  m_void_textured: row('darkfield', 'dome'),
  m_coating_matte: row('ring', 'dome'),
  m_coating_semi_gloss: row('dome', 'ring'),
  m_coating_textured: row('dome', 'ring'),
  m_print_matte: row('ring', 'bar'),
  m_print_semi_gloss: row('dome', 'coaxial'),
  m_print_textured: row('dome', 'ring'),
  m_wrinkle_matte: row('bar', 'photometric_stereo'),
  m_wrinkle_semi_gloss: row('bar', 'dome'),
  m_wrinkle_textured: row('bar', 'photometric_stereo'),
  m_solder_matte: row('dome', 'multi_angle_ring'),
  m_solder_semi_gloss: row('dome', 'multi_angle_ring'),
  m_solder_textured: row('dome', 'multi_angle_ring'),

  // ── Bài toán khác (mục 2.2–2.6) ──
  t_presence_raised: row('bar', 'ring'),
  t_presence_flat_color: row('ring', 'dome'),
  t_presence_hole: row('coaxial', 'ring'),
  t_presence_transparent_part: row('darkfield', 'backlight'),
  t_presence_shiny_part: row('dome', 'ring'),
  t_presence_wire: row('ring', 'dome'),
  t_align_outline: row('ring', 'dome'),
  t_align_fiducial: row('coaxial', 'ring'),
  t_align_hole: row('coaxial', 'ring'),
  t_align_corner: row('darkfield', 'bar'),
  t_measure_outline: row('ring', 'coaxial'),
  t_measure_hole: row('coaxial', 'ring'),
  t_measure_surface_edge: row('bar', 'coaxial'),
  t_code_ink_label: row('ring', 'bar'),
  t_code_dpm: row('darkfield', 'dome'),
  t_code_curved_print: row('dome', 'ring'),
  t_color_color_match: row('dome', 'ring'),
  t_color_color_shading: row('dome', 'ring'),
} as const satisfies Record<string, MatrixRow>;

export type MatrixRowKey = keyof typeof DEFAULT_MATRIX_ROWS;
export const MATRIX_ROW_KEYS = Object.keys(DEFAULT_MATRIX_ROWS) as MatrixRowKey[];
export type MatrixTable = Readonly<Record<MatrixRowKey, MatrixRow>>;

// Ma trận phải đủ ô — sai thì hỏng ngay khi nạp module, không đợi tới lúc người dùng chọn.
for (const d of MATRIX_DEFECTS) for (const f of MATRIX_FINISHES) if (!(`m_${d}_${f}` in DEFAULT_MATRIX_ROWS)) throw new Error(`lightMatrix thiếu m_${d}_${f}`);

export type LightTypeInput = {
  task: LightTask | null;
  feature: LightFeature | null;
  dentDepth: DentDepth | null;
  /** Đặt được đèn phía sau vật (soi xuyên) — chỉ có nghĩa với đường bao / lỗ xuyên. */
  backlightable: boolean;
  finish: LightFinish | null;
  shape: LightShape | null;
};

export type LightTypePick = MatrixRow & { ruleId: string; rowKey: MatrixRowKey };

/** Lỗi nằm BÊN TRONG vật trong suốt — soi xuyên thấy rõ nhất (LGT-018). */
const INSIDE_DEFECTS: readonly string[] = ['void', 'particle', 'crack_chip'];
/** Trên mặt bóng phẳng, xước / dị vật tán xạ sáng dưới góc thấp (LGT-019). */
const MIRROR_BRIGHT: readonly string[] = ['scratch', 'particle'];

/** Đi đúng thứ tự xét; trả dòng bảng và mã luật quyết định. Chưa chọn bài toán / cần thấy gì → null. */
export function pickLightType(input: LightTypeInput, table: MatrixTable = DEFAULT_MATRIX_ROWS): LightTypePick | null {
  const { task, feature, finish, shape } = input;
  if (!task || !feature) return null;
  const pick = (ruleId: string, rowKey: MatrixRowKey): LightTypePick => ({ ...table[rowKey], ruleId, rowKey });

  if (SILHOUETTE_FEATURES.includes(feature) && task !== 'inspect' && input.backlightable) return pick('LGT-017', 'ovr_silhouette');
  if (task === 'inspect' && (finish === 'transparent' || finish === 'translucent')) {
    if (INSIDE_DEFECTS.includes(feature)) return pick('LGT-018', 'ovr_transparent_inside');
    if (finish === 'transparent') return pick('LGT-018', 'ovr_transparent_surface');
  }
  if (finish === 'mirror_flat') return pick('LGT-019', task === 'inspect' && MIRROR_BRIGHT.includes(feature) ? 'ovr_mirror_flat_bright' : 'ovr_mirror_flat');
  if (finish === 'mirror_curved') return pick('LGT-020', feature === 'dent_bump' ? 'ovr_mirror_curved_dent' : 'ovr_mirror_curved');
  if (shape === 'stepped') return pick('LGT-021', feature === 'fiducial' ? 'ovr_stepped_fiducial' : 'ovr_stepped');

  if (task === 'inspect') {
    const defect = feature === 'dent_bump' && input.dentDepth === 'shallow' ? 'dent_shallow' : feature;
    // Mờ đục (không phải lỗi bên trong) và chưa chọn bề mặt → xét như mờ.
    const f = finish === 'semi_gloss' || finish === 'textured' ? finish : 'matte';
    return pick('LGT-022', `m_${defect}_${f}` as MatrixRowKey);
  }
  return pick('LGT-023', `t_${task}_${feature}` as MatrixRowKey);
}
