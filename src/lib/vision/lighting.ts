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

/** Loại lỗi ngoại quan — dùng làm giá trị của trường nhập defect_type. */
export const DEFECT_TYPES = [
  'scratch',
  'glossy_curved',
  'print_color',
  'profile_hole_burr',
  'shallow_dent',
  'transparent',
] as const;

export type DefectType = (typeof DEFECT_TYPES)[number];

const BY_DEFECT: Record<DefectType, LightingSuggestion> = {
  scratch: { lightType: 'darkfield', reasonKey: 'scratch' },
  glossy_curved: { lightType: 'dome', reasonKey: 'glossy_curved' },
  print_color: { lightType: 'coaxial', reasonKey: 'print_color', alternativeType: 'bar' },
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
