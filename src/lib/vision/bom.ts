import { accessoryQty, pickRuleAccessories } from '@/lib/components/accessories';
import { listAccessories, pickCameraCable, pickCameraPowerCable, pickInterfaceCard, pickLightCable, pickLightController, pickSoftware, lightControllerUnits } from '@/lib/components/match';
import { cardUnits } from '@/lib/components/pc';
import { SPEC_FIELDS, SUMMARY_KEYS, type Component } from '@/lib/components/specs';
import { cameraFromComponent } from './configurationRules';
import { filterEquipment, interfaceCardsFor } from './equipmentFilter';
import { assessFeasibility, type FeasibilityStatus } from './feasibility';
import { analyseRequirement, type RequirementAnalysis } from './requirementAnalysis';
import type { Requirement } from '@/lib/requirement/types';
import type { BomSelection } from './bomSelection';
import { buildSolutionLevels, type SolutionLevelKey, type Solutions } from './solutionLevels';

export { emptySelection, isBomSelection, type BomSelection } from './bomSelection';

/**
 * Danh mục vật tư (BOM) — V1c mục C5 (spec V1.1 §11.2, UI_CONTENT màn 7).
 *
 * Dựng từ MỘT mức giải pháp đã chọn (C4) + các món phải mua kèm mà mua hàng hay
 * trả lại vì thiếu: cáp, card giao tiếp, bộ điều khiển đèn, phụ kiện theo luật,
 * vật chuẩn hiệu chuẩn, gá camera. Mỗi dòng ghi mã luật biện luận.
 *
 * Chốt 2026-09-18 (Q1–Q7 khi mở C5):
 * - Trình duyệt chỉ giữ LỰA CHỌN (BomSelection). Server gọi lại đúng hàm này
 *   với catalog đọc từ database rồi lưu ẢNH CHỤP (BomSnapshot) vào revision —
 *   giá lúc lưu nằm trong ảnh chụp để báo giá cũ tái lập được.
 * - Sửa được số lượng, bỏ / thêm dòng phụ kiện; chưa đổi được camera / ống.
 * - Món kho chưa có (vật chuẩn, gá) vẫn thành dòng "cần báo giá", không bỏ.
 *
 * Hàm thuần: không đụng database, không đụng React.
 */

/** Phiên bản bộ luật — ghi vào revision (spec §11.3). Đổi khi đổi luật / ngưỡng. */
export const RULESET_VERSION = 'v1c-2026.09.18';

export const BOM_CATEGORIES = ['vision', 'lighting', 'cabling', 'computing', 'software', 'accessory', 'mechanical'] as const;
export type BomCategory = (typeof BOM_CATEGORIES)[number];

/** Món không có loại tương ứng trong kho — thành dòng "cần báo giá". */
export const BOM_PLACEHOLDERS = ['calibrationTarget', 'cameraBracket'] as const;
export type BomPlaceholder = (typeof BOM_PLACEHOLDERS)[number];

/** Loại trừ cố định của báo giá (chốt Q6). */
export const BOM_EXCLUSIONS = ['frame', 'climateControl', 'sampleTesting', 'training'] as const;


export type BomLine = {
  /** Ổn định giữa các lần dựng: 'camera', 'accessory:<code>', 'placeholder:calibrationTarget'… */
  key: string;
  category: BomCategory;
  /** null = dòng "cần báo giá", kho chưa có. */
  code: string | null;
  kind: Component['kind'] | null;
  brand: string | null;
  model: string | null;
  placeholder: BomPlaceholder | null;
  summary: string;
  qty: number;
  /** Số lượng máy tính ra, trước khi người dùng sửa — để hiện "đã sửa". */
  suggestedQty: number;
  unitPrice: number | null;
  leadTimeDays: number | null;
  supplier: string | null;
  unverified: boolean;
  /** Mã luật biện luận vì sao có dòng này. */
  ruleIds: string[];
  /** Người dùng bỏ được (phụ kiện, dòng cần báo giá) — thiết bị chính thì không. */
  removable: boolean;
  /** true = người dùng tự thêm. */
  manual: boolean;
};

export type BomSnapshot = {
  version: 1;
  rulesetVersion: string;
  selection: BomSelection;
  level: SolutionLevelKey;
  margin: number | null;
  lines: BomLine[];
  total: number | null;
  missingPrices: number;
  /** Ô đang giả định trong bảng Yêu cầu lúc dựng BOM — khối Giả định & Loại trừ. */
  assumptions: { path: string; value: unknown }[];
  exclusions: string[];
  feasibility: FeasibilityStatus;
};

function summarise(component: Component): string {
  const keys = SUMMARY_KEYS[component.kind] ?? [];
  return (SPEC_FIELDS[component.kind] ?? [])
    .filter((field) => keys.includes(field.key))
    .map((field) => {
      const value = component.spec[field.key];
      if (value === undefined || value === null || value === '') return null;
      return `${value}${field.unit ? ` ${field.unit}` : ''}`;
    })
    .filter(Boolean)
    .join(' · ');
}

const componentLine = (
  key: string,
  category: BomCategory,
  component: Component,
  qty: number,
  ruleIds: string[],
  removable = false,
  manual = false
): BomLine => ({
  key,
  category,
  code: component.code,
  kind: component.kind,
  brand: component.brand,
  model: component.model,
  placeholder: null,
  summary: summarise(component),
  qty,
  suggestedQty: qty,
  unitPrice: component.price_vnd,
  leadTimeDays: component.lead_time_days ?? null,
  supplier: component.supplier ?? null,
  unverified: component.source === 'unverified',
  ruleIds,
  removable,
  manual,
});

const placeholderLine = (placeholder: BomPlaceholder, qty: number, ruleIds: string[]): BomLine => ({
  key: `placeholder:${placeholder}`,
  category: 'mechanical',
  code: null,
  kind: null,
  brand: null,
  model: null,
  placeholder,
  summary: '',
  qty,
  suggestedQty: qty,
  unitPrice: null,
  leadTimeDays: null,
  supplier: null,
  unverified: false,
  ruleIds,
  removable: true,
  manual: false,
});

/**
 * Dựng BOM cho mức đã chọn. `null` khi mức đó không có cấu hình (rỗng / bị chặn)
 * — không dựng BOM cho phương án hệ thống đã từ chối đề xuất.
 */
export function buildBom(
  analysis: RequirementAnalysis,
  solutions: Solutions,
  catalog: readonly Component[],
  selection: BomSelection
): BomSnapshot | null {
  const level = solutions.levels.find((l) => l.key === selection.level);
  if (!level || level.status !== 'ok' || !level.camera || !level.lens) return null;

  const components = catalog.filter((c) => c.is_active) as Component[];
  const n = Math.max(1, analysis.cameraCount ?? 1);
  const lightCount = level.light ? n : 0;
  const lightRule = analysis.lighting?.ruleId ?? 'LGT-001';
  const needsStrobe = analysis.results.some((r) => r.ruleId === 'LGT-008');
  const camera = level.camera.component;
  const lens = level.lens.component;
  const config = cameraFromComponent(camera);
  const lines: BomLine[] = [];

  // ─── Thiết bị chính: từ mức đã chọn ───
  lines.push(componentLine('camera', 'vision', camera, n, ['RES-004']));
  lines.push(componentLine('lens', 'vision', lens, n, ['OPT-001', 'OPT-002']));
  if (level.light) lines.push(componentLine('light', 'lighting', level.light.component, lightCount, [lightRule]));

  // ─── Cáp: theo chuẩn giao tiếp camera ───
  const dataCable = pickCameraCable(components, { interfaceName: config.interfaceName }).chosen;
  if (dataCable) lines.push(componentLine('cable:data', 'cabling', dataCable, n, ['THR-002']));
  const powerCable = pickCameraPowerCable(components).chosen;
  if (powerCable) lines.push(componentLine('cable:power', 'cabling', powerCable, n, ['THR-002']));
  if (lightCount > 0) {
    const lightCable = pickLightCable(components).chosen;
    if (lightCable) lines.push(componentLine('cable:light', 'cabling', lightCable, lightCount, [lightRule]));
    const controller = pickLightController(components, { lightCount, needsStrobe }).chosen;
    if (controller) {
      lines.push(componentLine('lightController', 'lighting', controller, lightControllerUnits(controller, lightCount), needsStrobe ? ['LGT-008'] : [lightRule]));
    }
  }

  // ─── Máy tính + card giao tiếp ───
  if (level.pc) {
    lines.push(componentLine('pc', 'computing', level.pc.component, 1, ['THR-004']));
    // Máy đạt THR-004 đã đủ cổng LAN cho camera cắm thẳng; card chỉ cần khi chuẩn cần grabber.
    if (interfaceCardsFor(config.interfaceName, n) > 0) {
      const card = pickInterfaceCard(components, { interfaceName: config.interfaceName, cameraCount: n }).chosen;
      if (card) lines.push(componentLine('interfaceCard', 'computing', card, cardUnits(card, n), ['THR-002', 'THR-004']));
    }
  }

  // ─── Phần mềm ───
  const software = pickSoftware(components, { needsDeepLearning: analysis.usesDeepLearning }).chosen;
  if (software) lines.push(componentLine('software', 'software', software, 1, [analysis.usesDeepLearning ? 'AI-002' : 'AI-001']));

  // ─── Phụ kiện theo luật (bộ chọn cũ, map sang từ vựng bảng Yêu cầu) ───
  const surface = analysis.fieldInputs['object.surface']?.value;
  const conditions = analysis.fieldInputs['environment.conditions']?.value;
  const conditionList = Array.isArray(conditions) ? (conditions as string[]) : [];
  const ip = analysis.fieldInputs['environment.ipRequirement']?.value;
  const accessories = pickRuleAccessories(components, {
    surface: surface === 'glossy' || surface === 'metallic' ? 'reflective' : typeof surface === 'string' ? surface : null,
    environment: [...(conditionList.includes('variableLight') ? ['ambient_light'] : []), ...(conditionList.includes('vibration') ? ['vibration'] : [])],
    ipRating: typeof ip === 'string' && ip !== 'none' ? ip : null,
    captureMode: analysis.fieldInputs['production.motion']?.value === 'continuous' ? 'moving_area' : 'static',
    cameraMount: config.mount,
    lensMount: typeof lens.spec.mount === 'string' ? lens.spec.mount : null,
    lightColor: level.light && typeof level.light.component.spec.color === 'string' ? level.light.component.spec.color : null,
  });
  const ACCESSORY_RULE: Record<string, string> = {
    reflective_surface: 'LGT-001',
    ambient_light: 'LGT-007',
    ip_rating: 'ENV-001',
    line_scan_encoder: 'THR-005',
    triggered_capture: 'THR-005',
    vibration: 'MEC-002',
    mount_mismatch: 'OPT-002',
  };
  for (const item of accessories) {
    lines.push(
      componentLine(
        `accessory:${item.component.code}`,
        'accessory',
        item.component,
        accessoryQty(item, { cameras: n, lights: lightCount }),
        [ACCESSORY_RULE[item.reason] ?? 'LGT-001'],
        true
      )
    );
  }

  // ─── Dòng cần báo giá (kho chưa có loại này) ───
  const measuring = analysis.uncertaintyBudgetMm !== null;
  if (measuring || n > 1) lines.push(placeholderLine('calibrationTarget', 1, measuring ? ['RES-002', 'MEC-003'] : ['RES-005']));
  if (conditionList.includes('vibration')) lines.push(placeholderLine('cameraBracket', n, ['MEC-002']));

  // ─── Phụ kiện tích tay ───
  const manual = listAccessories(components);
  for (const code of selection.added) {
    const component = manual.find((c) => c.code === code);
    if (component && !lines.some((l) => l.code === code)) {
      lines.push(componentLine(`accessory:${code}`, 'accessory', component, 1, [], true, true));
    }
  }

  // ─── Lựa chọn của người dùng: bỏ dòng, sửa số lượng ───
  const final = lines
    .filter((line) => !(line.removable && selection.removed.includes(line.key)))
    .map((line) => {
      const qty = selection.qty[line.key];
      return qty ? { ...line, qty } : line;
    });

  const priced = final.filter((line) => line.code !== null);
  const missingPrices = final.filter((line) => line.unitPrice == null).length;
  const total = missingPrices === 0 ? priced.reduce((sum, line) => sum + Number(line.unitPrice) * line.qty, 0) : null;

  return {
    version: 1,
    rulesetVersion: RULESET_VERSION,
    selection,
    level: level.key,
    margin: level.margin,
    lines: final,
    total,
    missingPrices,
    assumptions: Object.entries(analysis.fieldInputs)
      .filter(([, input]) => input.assumptionId)
      .map(([path, input]) => ({ path, value: input.value })),
    exclusions: [...BOM_EXCLUSIONS],
    feasibility: assessFeasibility(analysis.results).status,
  };
}

/**
 * Cả chuỗi Yêu cầu → phân tích → lọc → 3 mức → BOM, cho phía server: lưu revision
 * dựng lại BOM từ kho thật, không tin BOM trình duyệt gửi lên (chốt Q4).
 */
export function bomForRequirement(requirement: Requirement, catalog: readonly Component[], selection: BomSelection): BomSnapshot | null {
  const analysis = analyseRequirement(requirement);
  const solutions = buildSolutionLevels(analysis, filterEquipment(analysis, catalog), catalog);
  return buildBom(analysis, solutions, catalog, selection);
}
