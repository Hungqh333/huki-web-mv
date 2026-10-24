import type { Check } from './types';
import { COLORS, LIGHT_COLORS, type LightColor, type LightPurpose, type SurfaceColor } from './lightOptions';

export { LIGHT_COLORS, LIGHT_PURPOSES, COLORS, type LightColor, type LightPurpose, type SurfaceColor } from './lightOptions';

/**
 * Màu đèn / bước sóng — LGT-009…016. Bản 2, chốt 2026-10-22 (docs/NHAP_CHON_DEN_V2.md mục 5,
 * Hùng duyệt Đ toàn bộ): camera đơn sắc chọn màu đèn làm CHÊNH LỆCH độ sáng giữa chi tiết và
 * nền lớn nhất, theo bảng phản xạ 3 mức (0 tối · 1 vừa · 2 sáng) của 13 màu dưới đèn đỏ / lục /
 * lam; đèn trắng = trung bình ba kênh. Bảng sửa được qua admin (engineTables 'lightColor');
 * thứ tự xét luật nằm trong code.
 *
 * Nguồn nguyên lý: wenglor, Advanced Illumination (màu cùng → sáng, màu bù → tối).
 */
export const isLightColor = (value: unknown): value is LightColor => LIGHT_COLORS.includes(value as LightColor);

/**
 * Bước sóng đại diện (nm) — chỉ để ghi chú. Engine CHƯA dùng để tính nhiễu xạ: OPT-004 vẫn
 * lấy 550 nm (chốt 2026-10-22 Q2).
 */
export const LIGHT_WAVELENGTH_NM: Readonly<Record<LightColor, string | null>> = {
  white: null,
  red: '620–630',
  green: '520–530',
  blue: '450–470',
  ir: '850',
  uv: '365–395',
};

/** Hệ số phản xạ 3 mức dưới đèn đỏ / lục / lam. */
export type Reflectance = { r: number; g: number; b: number };
export const REFLECTANCE_LEVELS = [0, 1, 2] as const;

export const DEFAULT_REFLECTANCE: Readonly<Record<SurfaceColor, Reflectance>> = {
  white: { r: 2, g: 2, b: 2 },
  gray: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 2, g: 0, b: 0 },
  orange: { r: 2, g: 1, b: 0 },
  yellow: { r: 2, g: 2, b: 0 },
  green: { r: 0, g: 2, b: 0 },
  cyan: { r: 0, g: 2, b: 2 },
  blue: { r: 0, g: 0, b: 2 },
  purple: { r: 1, g: 0, b: 2 },
  magenta: { r: 2, g: 0, b: 2 },
  brown: { r: 1, g: 0, b: 0 },
  gold: { r: 2, g: 1, b: 0 },
};

/** Ba mục đích đặc biệt về bước sóng — màu đèn chính / thay thế. */
export const SPECIAL_ROW_KEYS = ['see_through', 'fluorescent', 'fine_detail'] as const;
export type SpecialRowKey = (typeof SPECIAL_ROW_KEYS)[number];
export type ColorRow = { color: LightColor; alternative: LightColor | null };
export const DEFAULT_SPECIAL_ROWS: Readonly<Record<SpecialRowKey, ColorRow>> = {
  // LGT-012: mực, thuốc nhuộm phần lớn trong suốt với IR.
  see_through: { color: 'ir', alternative: null },
  // LGT-014: kích thích huỳnh quang, chỉ phần phát sáng lọt qua lọc chặn UV.
  fluorescent: { color: 'uv', alternative: null },
  // LGT-013: bước sóng ngắn → đĩa Airy nhỏ hơn (chỉ ghi chú, OPT-004 chưa đổi).
  fine_detail: { color: 'blue', alternative: null },
};

/** Khoá dòng trong engine_tables: `refl_<màu>` (13) + 3 dòng đặc biệt. */
export const COLOR_ROW_KEYS = [...COLORS.map((c) => `refl_${c}` as const), ...SPECIAL_ROW_KEYS] as const;
export type ColorRowKey = (typeof COLOR_ROW_KEYS)[number];

export type LightColorTable = Readonly<{ reflectance: Readonly<Record<SurfaceColor, Reflectance>>; special: Readonly<Record<SpecialRowKey, ColorRow>> }>;
export const DEFAULT_LIGHT_COLOR_TABLE: LightColorTable = { reflectance: DEFAULT_REFLECTANCE, special: DEFAULT_SPECIAL_ROWS };

/** Ba màu trung tính — màu đèn không tạo chênh lệch giữa chúng. */
const NEUTRAL: readonly SurfaceColor[] = ['white', 'gray', 'black'];
/** Thứ tự xét khi hoà: đỏ trước (LED hiệu suất cao, ít tán xạ hơn lam), trắng cuối. */
export const VISIBLE_LIGHTS = ['red', 'green', 'blue', 'white'] as const;
export type VisibleLight = (typeof VISIBLE_LIGHTS)[number];

/** Độ sáng (0–2) của một màu dưới một màu đèn nhìn thấy; trắng = trung bình ba kênh. */
export function levelUnder(color: SurfaceColor, light: VisibleLight, table: LightColorTable = DEFAULT_LIGHT_COLOR_TABLE): number {
  const { r, g, b } = table.reflectance[color];
  return light === 'red' ? r : light === 'green' ? g : light === 'blue' ? b : Math.round(((r + g + b) / 3) * 100) / 100;
}

export type LightColorInput = {
  cameraColor: 'color' | 'mono' | null;
  featureColor: SurfaceColor | null;
  backgroundColor: SurfaceColor | null;
  purpose: LightPurpose | null;
  /** Bài đo hoặc chi tiết rất nhỏ / xước mảnh. */
  fineDetail: boolean;
  /** Ánh sáng môi trường thay đổi (cửa sổ, đèn xưởng bật tắt). */
  ambientVaries: boolean;
};

export type ColorCheck = Check & { ruleId: string };

/** Hình B — từng màu đèn nhìn thấy: độ sáng chi tiết, nền, chênh lệch. */
export type ColorPreview = {
  feature: SurfaceColor;
  background: SurfaceColor | null;
  rows: { light: VisibleLight; feature: number; background: number | null; contrast: number | null }[];
};

export type LightColorResult = {
  color: LightColor;
  alternative: LightColor | null;
  /** Luật quyết định màu chính; null = không luật nào áp, mặc định trắng. */
  ruleId: string | null;
  checks: ColorCheck[];
  preview: ColorPreview | null;
};

const fmt = (v: number) => String(Math.round(v * 100) / 100);
const label = (color: LightColor, alternative: LightColor | null) => (alternative ? `${color} / ${alternative}` : color);

/**
 * Thứ tự xét (luật đầu tiên khớp chọn màu chính):
 *   1. Huỳnh quang → UV (LGT-014)        2. Nhìn xuyên lớp in → IR (LGT-012)
 *   3. Camera màu → trắng (LGT-009)
 *   4. Camera đơn sắc + màu chi tiết:
 *        có màu nền → đèn cho |chi tiết − nền| lớn nhất (LGT-010); bằng 0 hoặc cả hai trung tính → LGT-011
 *        chưa có màu nền → đèn làm chi tiết sáng nhất (LGT-010, nhắc khai màu nền)
 *   5. Camera đơn sắc + bài đo / chi tiết nhỏ → xanh lam (LGT-013)        6. Còn lại → trắng
 * Kèm theo: ánh sáng ngoài thay đổi → lọc băng hẹp (LGT-015); IR → kiểm camera (LGT-016); UV → lọc chặn UV.
 */
export function suggestLightColor(input: LightColorInput, table: LightColorTable = DEFAULT_LIGHT_COLOR_TABLE): LightColorResult {
  const checks: ColorCheck[] = [];
  const mono = input.cameraColor === 'mono';
  const feature = input.featureColor;
  const background = input.backgroundColor;

  const preview: ColorPreview | null =
    mono && feature
      ? {
          feature,
          background,
          rows: VISIBLE_LIGHTS.map((light) => {
            const f = levelUnder(feature, light, table);
            const b = background ? levelUnder(background, light, table) : null;
            return { light, feature: f, background: b, contrast: b === null ? null : Math.round(Math.abs(f - b) * 100) / 100 };
          }),
        }
      : null;

  const decide = (ruleId: string, row: ColorRow, formula: string, noteKey: string, noteValues?: Check['noteValues'], status: Check['status'] = 'info') => {
    checks.push({ ruleId, key: 'lightColor', status, formula: `${formula} → ${label(row.color, row.alternative)}`, noteKey, noteValues });
    return { color: row.color, alternative: row.alternative, ruleId };
  };

  let chosen: { color: LightColor; alternative: LightColor | null; ruleId: string | null };
  if (input.purpose === 'fluorescent') {
    chosen = decide('LGT-014', table.special.fluorescent, 'fluorescent', 'colorFluorescent', { nm: LIGHT_WAVELENGTH_NM.uv ?? '' });
  } else if (input.purpose === 'seeThrough') {
    chosen = decide('LGT-012', table.special.see_through, 'seeThrough', 'colorSeeThrough', { nm: LIGHT_WAVELENGTH_NM.ir ?? '' });
  } else if (input.cameraColor === 'color') {
    chosen = decide('LGT-009', { color: 'white', alternative: null }, 'camera color', 'colorCameraWhite');
  } else if (mono && feature && preview) {
    if (background) {
      const best = Math.max(...preview.rows.map((r) => r.contrast ?? 0));
      const formula = `|${feature} − ${background}|: ${preview.rows.map((r) => `${r.light} ${fmt(r.contrast ?? 0)}`).join(' · ')}`;
      if (best === 0) {
        chosen = decide('LGT-011', { color: 'white', alternative: null }, formula, 'colorNoContrast', { feature, background }, 'warn');
      } else if (NEUTRAL.includes(feature) && NEUTRAL.includes(background)) {
        chosen = decide('LGT-011', { color: 'white', alternative: 'red' }, formula, 'colorNeutral', { feature, background });
      } else {
        // Hoà thì giữ đèn màu theo thứ tự đỏ, lục, lam; trắng chỉ thắng khi hơn hẳn mọi đèn màu.
        const winners = preview.rows.filter((r) => (r.contrast ?? 0) === best).map((r) => r.light);
        const colored = winners.filter((l) => l !== 'white');
        const main = (colored[0] ?? 'white') as LightColor;
        const alt = (colored[1] ?? null) as LightColor | null;
        const mainRow = preview.rows.find((r) => r.light === main)!;
        chosen = decide('LGT-010', { color: main, alternative: alt }, formula, 'colorContrast', {
          feature,
          background,
          contrast: fmt(best),
          f: fmt(mainRow.feature),
          b: fmt(mainRow.background ?? 0),
        });
      }
    } else if (NEUTRAL.includes(feature)) {
      chosen = decide('LGT-010', { color: 'white', alternative: null }, `${feature} (neutral)`, 'colorNoBackground', { feature });
    } else {
      const best = Math.max(...preview.rows.map((r) => r.feature));
      const winners = preview.rows.filter((r) => r.feature === best && r.light !== 'white').map((r) => r.light);
      chosen = decide(
        'LGT-010',
        { color: winners[0] as LightColor, alternative: (winners[1] ?? null) as LightColor | null },
        `${feature}: ${preview.rows.map((r) => `${r.light} ${fmt(r.feature)}`).join(' · ')}`,
        'colorNoBackground',
        { feature }
      );
    }
  } else if (mono && input.fineDetail) {
    chosen = decide('LGT-013', table.special.fine_detail, 'mono · fine', 'colorFineBlue', { nm: LIGHT_WAVELENGTH_NM.blue ?? '' });
  } else {
    chosen = { color: 'white', alternative: null, ruleId: null };
    checks.push({ ruleId: 'LGT-009', key: 'lightColor', status: 'info', formula: '— → white', noteKey: input.cameraColor === null ? 'colorCameraUnknown' : 'colorDefaultWhite' });
  }

  // Đơn sắc + chi tiết nhỏ mà màu chính đã do luật khác chọn: vẫn nhắc xanh lam là lựa chọn khi đo.
  if (mono && input.fineDetail && chosen.ruleId !== 'LGT-013' && !['blue', 'ir', 'uv'].includes(chosen.color)) {
    checks.push({ ruleId: 'LGT-013', key: 'lightColor', status: 'info', formula: 'mono · fine', noteKey: 'colorFineBlueAlso', noteValues: { nm: LIGHT_WAVELENGTH_NM.blue ?? '' } });
  }

  // LGT-015: ánh sáng ngoài thay đổi. Đèn đơn sắc → lọc băng hẹp cùng bước sóng; đèn trắng không lọc được.
  if (input.ambientVaries) {
    const narrow = chosen.color !== 'white';
    checks.push({
      ruleId: 'LGT-015',
      key: 'ambientFilter',
      status: 'warn',
      formula: narrow ? `bandpass ${LIGHT_WAVELENGTH_NM[chosen.color] ?? ''} nm` : 'white → no bandpass',
      noteKey: narrow ? 'ambientBandpass' : 'ambientWhite',
      noteValues: { nm: LIGHT_WAVELENGTH_NM[chosen.color] ?? '' },
    });
  }

  // LGT-016: IR — camera màu thường có lọc IR-cut; camera đơn sắc kiểm QE ở 850 nm.
  if (chosen.color === 'ir' || chosen.alternative === 'ir') {
    checks.push(
      input.cameraColor === 'color'
        ? { ruleId: 'LGT-016', key: 'irCamera', status: 'fail', formula: 'camera color + IR', noteKey: 'irColorCamera' }
        : { ruleId: 'LGT-016', key: 'irCamera', status: 'warn', formula: 'QE @ 850 nm', noteKey: 'irQe' }
    );
  }
  // UV: chỉ phần huỳnh quang được nhìn — cần lọc chặn UV trước ống.
  if (chosen.color === 'uv') {
    checks.push({ ruleId: 'LGT-014', key: 'uvFilter', status: 'warn', formula: 'UV-cut filter', noteKey: 'uvFilter' });
  }

  return { ...chosen, checks, preview };
}

/* ── Dạng lưu trong engine_tables (mỗi dòng một object) ↔ dạng engine dùng ── */

export type ColorTableRow = Reflectance | ColorRow;
export const isReflectanceKey = (key: string): key is `refl_${SurfaceColor}` => key.startsWith('refl_');

/** Bảng phẳng theo khoá dòng — mặc định đúng nháp đã duyệt. */
export const DEFAULT_COLOR_TABLE_ROWS: Readonly<Record<ColorRowKey, ColorTableRow>> = Object.fromEntries([
  ...COLORS.map((c) => [`refl_${c}`, DEFAULT_REFLECTANCE[c]]),
  ...SPECIAL_ROW_KEYS.map((k) => [k, DEFAULT_SPECIAL_ROWS[k]]),
]) as Record<ColorRowKey, ColorTableRow>;

export function colorTableFromRows(rows: Readonly<Record<ColorRowKey, ColorTableRow>>): LightColorTable {
  return {
    reflectance: Object.fromEntries(COLORS.map((c) => [c, rows[`refl_${c}`] as Reflectance])) as Record<SurfaceColor, Reflectance>,
    special: Object.fromEntries(SPECIAL_ROW_KEYS.map((k) => [k, rows[k] as ColorRow])) as Record<SpecialRowKey, ColorRow>,
  };
}
