import type { Check } from './types';

/**
 * Bảng gợi ý chiếu sáng theo LOẠI LỖI và BỀ MẶT.
 *
 * Đây là bảng tra kinh nghiệm, không phải công thức. Nó thay cho việc đoán kiểu
 * đèn từ câu chữ tự do trong bảng luật — đoán từ khoá vốn là điểm yếu nhất của
 * phần chọn đèn hiện tại.
 *
 * Bề mặt được xét TRƯỚC loại lỗi ở hai trường hợp mà bề mặt lấn át tất cả: vật
 * trong suốt và bề mặt bóng/gương. Soi vết xước trên mặt gương bằng dark field
 * thông thường sẽ chỉ thấy loá.
 */

export type LightingSuggestion = {
  /** Khớp với khoá light_type trong catalog linh kiện. */
  lightType: string;
  /** Khoá i18n giải thích vì sao. */
  reasonKey: string;
  /** Kiểu đèn thay thế cũng dùng được. */
  alternativeType?: string;
  /** Câu lý do admin nhập (engineTables, 2026-10-16) — có thì thay cho reasonKey khi hiển thị. */
  customReason?: { vi: string; en: string };
};

/**
 * Loại lỗi ngoại quan của bảng Yêu cầu / bộ chọn cũ — giá trị trường defect_type. Trang Chọn đèn
 * dùng danh sách mới ở lightOptions.ts (chốt 2026-10-22); hai danh sách tách nhau tới khi chuyển
 * dữ liệu dự án cũ (Q6).
 */
export const DEFECT_TYPES = ['scratch', 'glossy_curved', 'print_color', 'profile_hole_burr', 'shallow_dent', 'transparent'] as const;
export type DefectType = (typeof DEFECT_TYPES)[number];

const BY_DEFECT: Record<DefectType, LightingSuggestion> = {
  scratch: { lightType: 'darkfield', reasonKey: 'scratch' },
  glossy_curved: { lightType: 'dome', reasonKey: 'glossy_curved' },
  /* Chốt 2026-10-22 (nháp F3): mực in / màu trên bề mặt mờ cần chiếu đều, khuếch tán — đồng trục
     không thêm tương phản mà dễ loá điểm. Đồng trục chỉ đúng cho mặt PHẲNG như gương (trang Chọn đèn có lựa chọn này). */
  print_color: { lightType: 'bar', reasonKey: 'print_color', alternativeType: 'ring' },
  profile_hole_burr: { lightType: 'backlight', reasonKey: 'profile_hole_burr' },
  // Lõm lồi rất nông: một hướng chiếu không đủ, cần chụp nhiều hướng rồi dựng
  // lại pháp tuyến bề mặt.
  shallow_dent: { lightType: 'photometric_stereo', reasonKey: 'shallow_dent' },
  transparent: { lightType: 'backlight', reasonKey: 'transparent' },
};

/** Bề mặt lấn át loại lỗi ở hai trường hợp này. */
const SURFACE_OVERRIDE: Record<string, LightingSuggestion> = {
  transparent: { lightType: 'backlight', reasonKey: 'surfaceTransparent' },
  /* Phương án thay thế: tấm đèn phẳng diện rộng (backlight) đặt ở GÓC PHẢN XẠ GƯƠNG
     — bề mặt bóng phản chiếu nền sáng đều vào camera, lỗi hiện thành chấm tối.
     Dự án thật GT-002 (bụi trên lớp mạ, 2025) đạt bằng cách này, không dùng dome. */
  reflective: { lightType: 'dome', reasonKey: 'surfaceReflective', alternativeType: 'backlight' },
};

/**
 * Dòng của bảng chiếu sáng sửa được qua admin (engineTables.ts): 6 loại lỗi + 2 bề
 * mặt lấn át. Khoá bề mặt có tiền tố `surface_` để không trùng khoá loại lỗi
 * (`transparent` có ở cả hai).
 */
export const LIGHTING_ROW_KEYS = [...DEFECT_TYPES, 'surface_transparent', 'surface_reflective'] as const;
export type LightingRowKey = (typeof LIGHTING_ROW_KEYS)[number];
export const DEFAULT_LIGHTING_ROWS: Record<LightingRowKey, LightingSuggestion> = {
  ...BY_DEFECT,
  surface_transparent: SURFACE_OVERRIDE.transparent,
  surface_reflective: SURFACE_OVERRIDE.reflective,
};

/**
 * Mã luật của gợi ý kiểu đèn: bề mặt phản xạ → LGT-001 · trong suốt →
 * LGT-004 · biên dạng/lỗ/bavia → LGT-003 · xước, lõm nông → LGT-002 · còn lại → LGT-001.
 */
export function lightingRuleId(surfaceKey: string | null, suggestion: Pick<LightingSuggestion, 'reasonKey'>): string {
  if (surfaceKey === 'reflective') return 'LGT-001';
  if (surfaceKey === 'transparent' || suggestion.reasonKey === 'transparent') return 'LGT-004';
  if (suggestion.reasonKey === 'profile_hole_burr') return 'LGT-003';
  if (suggestion.reasonKey === 'scratch' || suggestion.reasonKey === 'shallow_dent') return 'LGT-002';
  return 'LGT-001';
}

/** Đèn chiếu từ quanh trục (vòng, vòm, góc thấp) phải phủ ĐƯỜNG CHÉO vùng nhìn; đèn khác phủ cạnh dài. */
export const DIAGONAL_LIGHT_TYPES: readonly string[] = ['ring', 'dome', 'darkfield', 'multi_angle_ring'];

/** Cỡ đèn tối thiểu (mm) cho một vùng nhìn — cùng phép tính bước lọc thiết bị (LGT-001…004). */
export function minLightSizeMm(lightType: string, widthMm: number, heightMm: number): { mm: number; diagonal: boolean } {
  const diagonal = DIAGONAL_LIGHT_TYPES.includes(lightType);
  return { mm: diagonal ? Math.hypot(widthMm, heightMm) : Math.max(widthMm, heightMm), diagonal };
}

/** Bảng admin truyền vào: chỉ cần đèn chính, đèn thay thế, câu lý do. */
export type LightingTable = Readonly<
  Record<LightingRowKey, { lightType: string; alternativeType: string | null; reasonVi: string | null; reasonEn: string | null }>
>;

export function suggestLighting(
  input: {
    defectType: string | null;
    surface: string | null;
  },
  table?: LightingTable
): LightingSuggestion | null {
  const rowKey: LightingRowKey | null =
    input.surface && SURFACE_OVERRIDE[input.surface]
      ? (`surface_${input.surface}` as LightingRowKey)
      : input.defectType && input.defectType in BY_DEFECT
        ? (input.defectType as DefectType)
        : null;
  if (!rowKey) return null;
  const base = DEFAULT_LIGHTING_ROWS[rowKey];
  const row = table?.[rowKey];
  if (!row) return base;
  // reasonKey giữ theo dòng: các luật LGT-002…004 chọn mã luật theo loại lỗi, không theo kiểu đèn.
  const custom = row.reasonVi || row.reasonEn ? { vi: row.reasonVi ?? row.reasonEn!, en: row.reasonEn ?? row.reasonVi! } : undefined;
  return {
    lightType: row.lightType,
    reasonKey: base.reasonKey,
    ...(row.alternativeType ? { alternativeType: row.alternativeType } : {}),
    ...(custom ? { customReason: custom } : {}),
  };
}

export function lightingChecks(input: {
  defectType: string | null;
  surface: string | null;
}): Check[] {
  const suggestion = suggestLighting(input);
  if (!suggestion) {
    return [
      {
        key: 'lightingSuggestion',
        status: 'warn',
        formula: '—',
        noteKey: 'lightingUnknown',
      },
    ];
  }

  return [
    {
      key: 'lightingSuggestion',
      status: 'info',
      formula: suggestion.alternativeType
        ? `${suggestion.lightType} / ${suggestion.alternativeType}`
        : suggestion.lightType,
      noteKey: `lightingReason.${suggestion.reasonKey}`,
    },
  ];
}
