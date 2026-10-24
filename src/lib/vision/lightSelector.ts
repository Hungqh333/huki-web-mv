import { specNumber, specString, type Component } from '../components/specs';
import { DEFAULT_ENGINE_TABLES, type EngineTables } from './engineTables';
import { colorTableFromRows, suggestLightColor, LIGHT_WAVELENGTH_NM, type ColorPreview } from './lightColor';
import { minLightSizeMm } from './lighting';
import { pickLightType, type MatrixRowKey } from './lightMatrix';
import type { DentDepth, LightColor, LightFeature, LightFinish, LightMaterial, LightPurpose, LightShape, LightTask, SurfaceColor } from './lightOptions';
import { term } from './formulaTerms';
import type { SampleMatch } from './sampleMatch';
import { fmt, round, type CheckStatus } from './types';

/**
 * Bộ chọn đèn — trang /chon-den, bản 2 (chốt 2026-10-22, docs/NHAP_CHON_DEN_V2.md). Hàm thuần,
 * CHỈ chạy trên máy chủ (Q1): server action gọi rồi trả kết quả; dòng công thức chỉ gửi admin.
 *
 *   1. Kiểu đèn — thứ tự xét + ma trận + bảng theo bài toán (lightMatrix.ts, LGT-017…023)
 *   2. Màu đèn — chênh lệch chi tiết / nền (lightColor.ts, LGT-009…016)
 *   3. Cỡ đèn tối thiểu theo vùng nhìn — cùng phép tính bước lọc của Thiết kế hệ thống
 * rồi lọc kho đèn theo kiểu, màu, cỡ. Hình học lắp đèn (góc chiếu, khoảng cách) CHƯA làm.
 */

export type LightSelectorInput = {
  task: LightTask | null;
  feature: LightFeature | null;
  dentDepth: DentDepth | null;
  backlightable: boolean;
  /** Vật liệu chỉ để nhắc (cao su đen…) — luật đọc bề mặt / hình dạng / màu. */
  material: LightMaterial | null;
  finish: LightFinish | null;
  shape: LightShape | null;
  cameraColor: 'color' | 'mono' | null;
  featureColor: SurfaceColor | null;
  backgroundColor: SurfaceColor | null;
  purpose: LightPurpose | null;
  fineDetail: boolean;
  ambientVaries: boolean;
  fovWidthMm: number | null;
  fovHeightMm: number | null;
};

/** Một dòng kiểm — giống Check của engine, kèm mã luật. */
export type LightCheck = {
  ruleId: string;
  key: string;
  status: CheckStatus;
  /** Công thức đã thay số — server xoá (null) khi người xem không phải admin. */
  formula: string | null;
  noteKey?: string;
  noteValues?: Record<string, string | number>;
};

export type LightCandidate = {
  id: string;
  brand: string;
  model: string;
  code: string;
  lightType: string | null;
  color: string | null;
  sizeMm: number | null;
  sizeShortMm: number | null;
  strobe: string | null;
  datasheetUrl: string | null;
  status: CheckStatus;
  checks: LightCheck[];
};

export type LightSelection = {
  /** Kiểu đèn gợi ý; null = chưa chọn bài toán / cần thấy gì. */
  type: { ruleId: string; rowKey: MatrixRowKey; reasonKey: string; lightType: string; alternativeType: string | null } | null;
  color: { ruleId: string | null; color: LightColor; alternative: LightColor | null; wavelengthNm: string | null };
  /** Cỡ đèn tối thiểu theo từng kiểu gợi ý (mm); rỗng khi chưa nhập vùng nhìn. */
  sizes: { lightType: string; mm: number; diagonal: boolean }[];
  /** Các dòng kiểm chung (kiểu, màu, cảnh báo) theo thứ tự hiển thị. */
  checks: LightCheck[];
  candidates: LightCandidate[];
  /** Hình B — camera đơn sắc: độ sáng chi tiết / nền dưới từng màu đèn. */
  preview: ColorPreview | null;
  /**
   * Ảnh mẫu tự chụp của phòng Vision cho "cần thấy gì" đang chọn (khung D). Hàm thuần luôn trả
   * rỗng — server action điền link ký tên từ Supabase Storage.
   */
  samples: {
    id: string;
    lightType: string;
    url: string;
    caption: string | null;
    match: SampleMatch;
    labels: { task: string | null; feature: string | null; material: string | null; finish: string | null; shape: string | null; featureColor: string | null; backgroundColor: string | null };
    settings: {
      lightColor: string | null;
      lightModel: string | null;
      angle: string | null;
      distanceMm: number | null;
      exposureUs: number | null;
      camera: string | null;
      lens: string | null;
    };
    source: string | null;
  }[];
  /**
   * Dự án thực nghiệm của phòng Vision khớp bài toán (chốt 2026-10-24). Hàm thuần luôn trả rỗng —
   * server action điền từ database (RLS: Member+ thấy bản đã công bố).
   */
  experiments: {
    /** Huy hiệu cạnh kiểu đèn gợi ý / thay thế: hạng mục trùng "cần thấy gì" đã thử đúng kiểu đèn đó. */
    verified: { lightType: string; pass: number; conditional: number; fail: number }[];
    /** Số dự án có hạng mục trùng "cần thấy gì" — hiện trên nút "Dự án thực nghiệm". */
    matched: number;
  };
  /** Kho có bao nhiêu đèn đúng kiểu / đúng màu — để báo "kho chưa có". */
  stock: { total: number; typeMatch: number; colorMatch: number; both: number };
};

/** Câu lý do theo dòng bảng: ma trận dùng câu theo lỗi, dòng khác dùng câu riêng của dòng. */
export function reasonKeyFor(rowKey: MatrixRowKey): string {
  const m = /^m_(.+)_(matte|semi_gloss|textured)$/.exec(rowKey);
  return m ? `defect_${m[1]}` : rowKey;
}

export function selectLights(input: LightSelectorInput, catalog: readonly Component[], tables: EngineTables = DEFAULT_ENGINE_TABLES): LightSelection {
  const checks: LightCheck[] = [];

  // ── 1. Kiểu đèn (LGT-017…023) ──
  const pick = pickLightType(
    { task: input.task, feature: input.feature, dentDepth: input.dentDepth, backlightable: input.backlightable, finish: input.finish, shape: input.shape },
    tables.lightMatrix
  );
  const type = pick
    ? { ruleId: pick.ruleId, rowKey: pick.rowKey, reasonKey: reasonKeyFor(pick.rowKey), lightType: pick.lightType, alternativeType: pick.alternativeType }
    : null;
  if (type) {
    const path = [input.task, input.feature, input.finish, input.shape].filter(Boolean).join(' · ');
    checks.push({
      ruleId: type.ruleId,
      key: 'lightType',
      status: 'warn',
      formula: `${path} → ${type.rowKey} → ${type.alternativeType ? `${type.lightType} / ${type.alternativeType}` : type.lightType}`,
      noteKey: 'typeNeedsSample',
    });
    // Đo bằng đèn nền: muốn chính xác thì đèn nền song song + ống telecentric (Edmund — silhouetting).
    if (input.task === 'measure' && type.rowKey === 'ovr_silhouette') {
      checks.push({ ruleId: 'LGT-017', key: 'measureSetup', status: 'info', formula: 'backlight + telecentric', noteKey: 'measureTelecentric' });
    }
    // Đo mà không soi xuyên được: biên phụ thuộc bề mặt và góc chiếu — kém chính xác hơn đèn nền.
    if (input.task === 'measure' && (type.rowKey === 't_measure_outline' || type.rowKey === 't_measure_hole')) {
      checks.push({ ruleId: 'LGT-023', key: 'measureSetup', status: 'warn', formula: 'no backlight', noteKey: 'measureNoBacklight' });
    }
  } else {
    checks.push({ ruleId: 'LGT-022', key: 'lightType', status: 'info', formula: '—', noteKey: 'typeMissing' });
  }
  // LGT-005: cao su / màu đen hấp thụ gần hết ánh sáng.
  if (input.material === 'rubber' || input.featureColor === 'black' || input.backgroundColor === 'black') {
    checks.push({ ruleId: 'LGT-005', key: 'blackSurface', status: 'warn', formula: '—', noteKey: 'blackSurface' });
  }

  // ── 2. Màu đèn (LGT-009…016) ──
  const colorResult = suggestLightColor(
    {
      cameraColor: input.cameraColor,
      featureColor: input.featureColor,
      backgroundColor: input.backgroundColor,
      purpose: input.purpose,
      fineDetail: input.fineDetail,
      ambientVaries: input.ambientVaries,
    },
    colorTableFromRows(tables.lightColor)
  );
  checks.push(...colorResult.checks.map((c): LightCheck => ({ ...c })));
  const colors = [colorResult.color, ...(colorResult.alternative ? [colorResult.alternative] : [])];

  // ── 3. Cỡ đèn tối thiểu ──
  const types: string[] = type ? [type.lightType, ...(type.alternativeType ? [type.alternativeType] : [])] : [];
  const fov = input.fovWidthMm !== null && input.fovHeightMm !== null && input.fovWidthMm > 0 && input.fovHeightMm > 0 ? { w: input.fovWidthMm, h: input.fovHeightMm } : null;
  const sizes = fov ? types.map((t) => ({ lightType: t, ...minLightSizeMm(t, fov.w, fov.h) })).map((s) => ({ ...s, mm: round(s.mm, 1) })) : [];

  // ── 4. Lọc kho ──
  const lights = catalog.filter((c) => c.kind === 'light' && c.is_active);
  const typeRule = type?.ruleId ?? 'LGT-022';
  const colorRule = colorResult.ruleId ?? 'LGT-009';
  const candidates = lights.map((component): LightCandidate => {
    const spec = component.spec;
    const lightType = specString(spec, 'light_type');
    const color = specString(spec, 'color');
    const sizeMm = specNumber(spec, 'size_mm');
    const own: LightCheck[] = [];
    if (types.length > 0) {
      const ok = lightType !== null && types.includes(lightType);
      own.push(
        lightType === null
          ? { ruleId: typeRule, key: 'fitType', status: 'info', formula: '—', noteKey: 'fitTypeUnknown' }
          : { ruleId: typeRule, key: 'fitType', status: ok ? 'pass' : 'fail', formula: `${lightType} ${ok ? '∈' : '∉'} {${types.join(', ')}}` }
      );
    }
    own.push(
      color === null
        ? { ruleId: colorRule, key: 'fitColor', status: 'info', formula: '—', noteKey: 'fitColorUnknown' }
        : colors.includes(color as LightColor)
          ? { ruleId: colorRule, key: 'fitColor', status: 'pass', formula: `${color} ∈ {${colors.join(', ')}}` }
          : { ruleId: colorRule, key: 'fitColor', status: 'fail', formula: `${color} ∉ {${colors.join(', ')}}` }
    );
    if (fov) {
      // Cỡ cần theo kiểu CỦA đèn này (đèn sai kiểu vẫn ghi cỡ để người xem so).
      const need = lightType ? (sizes.find((s) => s.lightType === lightType) ?? { lightType, ...minLightSizeMm(lightType, fov.w, fov.h) }) : null;
      if (need && sizeMm !== null) {
        const ok = sizeMm >= need.mm - 1e-9;
        own.push({
          ruleId: typeRule,
          key: 'fitSize',
          status: ok ? 'pass' : 'fail',
          formula: `${fmt(sizeMm)} mm ${ok ? '≥' : '<'} ${fmt(need.mm, 1)} mm (${term(need.diagonal ? 'fovDiagonal' : 'fovLongSide')})`,
          noteKey: ok ? undefined : 'fitSizeSmall',
          noteValues: { need: Math.ceil(need.mm), have: sizeMm },
        });
      } else if (need) {
        own.push({ ruleId: typeRule, key: 'fitSize', status: 'info', formula: '—', noteKey: 'fitSizeUnknown', noteValues: { need: Math.ceil(need.mm) } });
      }
    }
    const judged = own.filter((c) => c.status !== 'info').map((c) => c.status);
    const status: CheckStatus = judged.includes('fail') ? 'fail' : own.some((c) => c.status === 'info') ? 'info' : 'pass';
    return {
      id: component.id,
      brand: component.brand,
      model: component.model,
      code: component.code,
      lightType,
      color,
      sizeMm,
      sizeShortMm: specNumber(spec, 'size_short_mm'),
      strobe: specString(spec, 'strobe'),
      datasheetUrl: component.datasheet_url ?? null,
      status,
      checks: own,
    };
  });

  // Đạt → chưa kiểm được → loại; cùng nhóm: đúng kiểu chính trước, rồi cỡ nhỏ nhất vẫn đủ (gọn, rẻ hơn).
  const rank = (c: LightCandidate) => (c.status === 'pass' ? 0 : c.status === 'info' ? 1 : 2);
  candidates.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(b.lightType === type?.lightType) - Number(a.lightType === type?.lightType) ||
      (a.sizeMm ?? Infinity) - (b.sizeMm ?? Infinity) ||
      a.model.localeCompare(b.model)
  );

  const typeOk = (c: Component) => types.length === 0 || types.includes(specString(c.spec, 'light_type') ?? '');
  const colorOk = (c: Component) => colors.includes((specString(c.spec, 'color') ?? '') as LightColor);
  return {
    type,
    color: { ruleId: colorResult.ruleId, color: colorResult.color, alternative: colorResult.alternative, wavelengthNm: LIGHT_WAVELENGTH_NM[colorResult.color] },
    sizes,
    checks,
    candidates,
    preview: colorResult.preview,
    samples: [],
    experiments: { verified: [], matched: 0 },
    stock: {
      total: lights.length,
      typeMatch: lights.filter(typeOk).length,
      colorMatch: lights.filter(colorOk).length,
      both: lights.filter((c) => typeOk(c) && colorOk(c)).length,
    },
  };
}

/** Bỏ dòng công thức khỏi kết quả — người xem không phải admin (bảo vệ công thức, chốt 2026-10-21). */
export function withoutFormulas(selection: LightSelection): LightSelection {
  const strip = (c: LightCheck): LightCheck => ({ ...c, formula: null });
  return { ...selection, checks: selection.checks.map(strip), candidates: selection.candidates.map((c) => ({ ...c, checks: c.checks.map(strip) })) };
}
