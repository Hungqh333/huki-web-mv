import { INTERFACE_BANDWIDTH, specNumber, specString, type Component } from '@/lib/components/specs';
import {
  blockingResults,
  cameraFromComponent,
  evaluateConfiguration,
  lensFromComponent,
  pcFromComponent,
  uncheckedResults,
} from './configurationRules';
import { INTERFACE_MAX_SHARE, type RequirementAnalysis } from './requirementAnalysis';
import { toRuleResult, type Evidence, type RuleResult } from './rules';
import { fmt, round, type Check } from './types';
import { term } from './formulaTerms';

/**
 * Lọc cứng thiết bị — V1c mục C3 (spec V1.1 §8.1).
 *
 * Thiết bị vi phạm ràng buộc vật lý thì LOẠI khỏi danh sách, không cho điểm, và
 * luôn kèm lý do có mã luật để hiện ở mục "Đã loại — lý do". Xếp hạng mềm và ba
 * mức giải pháp là việc của C4; ở đây thứ tự chỉ để đọc cho dễ.
 *
 * Chốt 2026-09-17 (Q1–Q7 khi mở C3):
 * - Camera bị loại: thiếu pixel một trục (được xoay 90°), cần màu mà đơn sắc,
 *   chạy liên tục mà rolling shutter, giao tiếp quá 70% băng thông, cần trigger
 *   mà không có chân trigger. IP thấp / nhiệt độ thấp chỉ gắn cờ (thêm vỏ bảo vệ).
 * - Line scan: loại, V1c chưa hỗ trợ.
 * - Đèn: đúng loại gợi ý (hoặc phương án thay thế), đủ cỡ, chạy xung khi LGT-008.
 * - Máy tính: tính THR-004 theo camera đạt có độ phân giải thấp nhất.
 * - Thiếu thông số → không loại, gắn cờ "chưa kiểm được" (quyết định Q4 lúc mở V1c).
 *
 * Hàm thuần: vào là phân tích yêu cầu + catalog, ra là danh sách. Không đụng database.
 */

export type Candidate = {
  component: Component;
  /** Mọi kết quả luật đã chạy cho thiết bị này. */
  results: RuleResult[];
  /** FAIL — lý do loại. Rỗng = đạt. */
  reasons: RuleResult[];
  /** MARGINAL — đạt nhưng có điều kiện (vòng đệm, vỏ bảo vệ…). */
  warnings: RuleResult[];
  /** Thiếu thông số nên chưa kiểm được. */
  unchecked: RuleResult[];
  /** Thông số chưa đối chiếu datasheet (source = unverified). */
  unverified: boolean;
};

export type CameraCandidate = Candidate & {
  lenses: { accepted: Candidate[]; excluded: Candidate[]; best: Candidate | null };
};

export type EquipmentGroup<T extends Candidate = Candidate> = { accepted: T[]; excluded: Candidate[] };

export type EquipmentFilter = {
  /** false khi bảng Yêu cầu chưa đủ để lọc (chưa có số pixel cần). */
  ready: boolean;
  cameras: EquipmentGroup<CameraCandidate>;
  lights: EquipmentGroup & { wantedTypes: string[] };
  pcs: EquipmentGroup & { referenceCamera: Component | null };
};

/** Nhiệt độ vỏ camera tối thiểu nên có khi môi trường có "nhiệt độ cao". */
export const HIGH_TEMP_CAMERA_MIN_C = 50;

const IP_LEVEL: Record<string, number> = { ip54: 54, ip65: 65, ip67: 67 };
/** Đèn đo theo ĐƯỜNG CHÉO vùng nhìn (vòng sáng bao quanh); các loại khác đo theo cạnh dài. */
const DIAGONAL_LIGHTS = ['ring', 'dome', 'darkfield'];
/** Chuẩn cần frame grabber — mỗi card coi như 4 kênh khi tính khe PCIe cho máy tính. */
const GRABBER_INTERFACES = ['CXP-6', 'CXP-12', 'CameraLink-Base', 'CameraLink-Medium', 'CameraLink-Full', 'CameraLink-Deca'];

/** Số card giao tiếp máy tính cần cho n camera cùng chuẩn: grabber 4 kênh; GigE/USB3 cắm thẳng bo mạch = 0. */
export function interfaceCardsFor(interfaceName: string | null, cameraCount: number): number {
  return interfaceName && GRABBER_INTERFACES.includes(interfaceName) ? Math.ceil(Math.max(1, cameraCount) / 4) : 0;
}

const make = (ruleId: string, check: Check, evidence: Evidence, equipment: Record<string, unknown>, marginRatio: number | null = null): RuleResult =>
  toRuleResult(ruleId, check, {
    evidence,
    marginRatio,
    inputsUsed: Object.entries(equipment)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([path, value]) => ({ path, value })),
  });

function candidate(component: Component, results: RuleResult[]): Candidate {
  return {
    component,
    results,
    reasons: blockingResults(results),
    warnings: results.filter((r) => r.status === 'warn'),
    unchecked: uncheckedResults(results),
    unverified: component.source === 'unverified',
  };
}

const split = <T extends Candidate>(items: T[]) => ({
  accepted: items.filter((item) => item.reasons.length === 0),
  excluded: items.filter((item) => item.reasons.length > 0),
});

/** Kiểm một camera theo bảng Yêu cầu — chưa cần ống kính. */
export function cameraRequirementChecks(analysis: RequirementAnalysis, component: Component): RuleResult[] {
  const results: RuleResult[] = [];
  const spec = component.spec;
  const camera = cameraFromComponent(component);

  if (camera.cameraType === 'line') {
    results.push(make('RES-004', { key: 'cameraFit', status: 'fail', formula: 'line scan', noteKey: 'lineScanNotSupported' }, 'rule-of-thumb', { 'camera.camera_type': 'line' }));
    return results;
  }

  // RES-004: đủ pixel trên cả hai trục, được xoay camera 90°.
  const need = analysis.pixelsPerCamera;
  if (need) {
    const { widthPx: w, heightPx: h } = camera;
    const fits = (w >= need.nx && h >= need.ny) || (w >= need.ny && h >= need.nx);
    results.push(
      make(
        'RES-004',
        {
          key: 'cameraFit',
          status: fits ? 'pass' : 'fail',
          formula: `${w} × ${h} px ${fits ? '≥' : '<'} ${need.nx} × ${need.ny} px`,
          noteKey: fits ? undefined : 'cameraPixelsShort',
          noteValues: { need: `${need.nx} × ${need.ny}`, have: `${w} × ${h}` },
        },
        'calculated',
        { 'camera.resolution_w_px': w, 'camera.resolution_h_px': h },
        // Biên thật của độ phân giải nằm ở OPT-001 (theo ống kính); ở đây chỉ đạt / không đạt.
        null
      )
    );
  }

  // LGT-006: cần phân biệt màu thì camera màu.
  if (analysis.fieldInputs['object.colorInspection']?.value === true && specString(spec, 'color') === 'mono') {
    results.push(make('LGT-006', { key: 'cameraFit', status: 'fail', formula: 'mono', noteKey: 'cameraNeedsColor' }, 'calculated', { 'camera.color': 'mono' }));
  }

  // THR-005: sản phẩm chạy liên tục → global shutter.
  const moving = analysis.fieldInputs['production.motion']?.value === 'continuous';
  const shutter = specString(spec, 'shutter');
  if (moving) {
    if (shutter === 'rolling') {
      results.push(make('THR-005', { key: 'cameraFit', status: 'fail', formula: 'rolling shutter', noteKey: 'cameraRollingShutter' }, 'calculated', { 'camera.shutter': shutter }));
    } else if (shutter === null) {
      results.push(make('THR-005', { key: 'cameraFit', status: 'info', formula: '—', noteKey: 'cameraShutterUnknown' }, 'unknown', {}));
    }
  }

  // LGT-008 / chạy liên tục: cần trigger phần cứng.
  const needsTrigger = moving || analysis.results.some((r) => r.ruleId === 'LGT-008');
  const trigger = specString(spec, 'trigger_io');
  if (needsTrigger) {
    if (trigger === 'no') {
      results.push(make('LGT-008', { key: 'cameraFit', status: 'fail', formula: 'trigger IO: no', noteKey: 'cameraNoTrigger' }, 'calculated', { 'camera.trigger_io': trigger }));
    } else if (trigger === null) {
      results.push(make('LGT-008', { key: 'cameraFit', status: 'info', formula: '—', noteKey: 'cameraTriggerUnknown' }, 'unknown', {}));
    }
  }

  // THR-002: băng thông THẬT của camera này (pixel của nó, không phải pixel cần).
  const ppm = analysis.partsPerMinute;
  if (ppm !== null && ppm > 0 && camera.interfaceName) {
    const capacity = INTERFACE_BANDWIDTH[camera.interfaceName];
    const rate = ((camera.widthPx * camera.heightPx * camera.bytesPerPx) / 1e6) * (ppm / 60);
    if (capacity !== undefined) {
      const ok = rate <= capacity * INTERFACE_MAX_SHARE;
      results.push(
        make(
          'THR-002',
          {
            key: 'cameraFit',
            status: ok ? 'pass' : 'fail',
            formula: `${fmt(rate, 1)} MB/s ${ok ? '≤' : '>'} ${INTERFACE_MAX_SHARE * 100}% × ${capacity} MB/s (${camera.interfaceName})`,
            noteKey: ok ? undefined : 'cameraInterfaceSlow',
            noteValues: { rate: round(rate, 1), capacity, name: camera.interfaceName },
          },
          'calculated',
          { 'camera.interface': camera.interfaceName },
          null
        )
      );
    }
  }

  // ENV-001: cấp IP — chỉ gắn cờ, vỏ bảo vệ đi vào danh mục vật tư.
  const ipNeed = IP_LEVEL[String(analysis.fieldInputs['environment.ipRequirement']?.value ?? '')];
  if (ipNeed) {
    const ipHave = Number(/^IP(\d{2})$/i.exec(specString(spec, 'ip_rating') ?? '')?.[1] ?? 0);
    if (ipHave < ipNeed) {
      results.push(
        make('ENV-001', { key: 'cameraFit', status: 'warn', formula: `IP${ipHave || '?'} < IP${ipNeed}`, noteKey: 'cameraNeedsHousing', noteValues: { need: `IP${ipNeed}` } }, 'rule-of-thumb', {
          'camera.ip_rating': specString(spec, 'ip_rating'),
        })
      );
    }
  }

  // ENV-002: môi trường nóng.
  const conditions = analysis.fieldInputs['environment.conditions']?.value;
  if (Array.isArray(conditions) && conditions.includes('highTemp')) {
    const temp = specNumber(spec, 'temp_max_c');
    if (temp === null) {
      results.push(make('ENV-002', { key: 'cameraFit', status: 'info', formula: '—', noteKey: 'cameraTempUnknown' }, 'unknown', {}));
    } else if (temp < HIGH_TEMP_CAMERA_MIN_C) {
      results.push(
        make('ENV-002', { key: 'cameraFit', status: 'warn', formula: `${temp} °C < ${HIGH_TEMP_CAMERA_MIN_C} °C`, noteKey: 'cameraTempLow', noteValues: { temp } }, 'rule-of-thumb', {
          'camera.temp_max_c': temp,
        })
      );
    }
  }

  return results;
}

/** Kiểm một đèn: loại theo gợi ý, cỡ phủ vùng nhìn, chạy xung khi cần. */
export function lightChecks(analysis: RequirementAnalysis, component: Component): RuleResult[] {
  const results: RuleResult[] = [];
  const spec = component.spec;
  const type = specString(spec, 'light_type');
  const ruleId = analysis.lighting?.ruleId ?? 'LGT-001';
  const wanted = analysis.lighting?.types ?? [];

  if (wanted.length > 0 && (type === null || !wanted.includes(type))) {
    results.push(
      make(ruleId, { key: 'lightFit', status: 'fail', formula: `${type ?? '?'} ∉ {${wanted.join(', ')}}`, noteKey: 'lightWrongType', noteValues: { wanted: wanted.join(' / ') } }, 'rule-of-thumb', {
        'light.light_type': type,
      })
    );
    return results;
  }

  const tile = analysis.tile;
  if (tile && type) {
    const diagonal = DIAGONAL_LIGHTS.includes(type);
    const needMm = diagonal ? 2 * tile.halfDiagonalMm : Math.max(tile.widthMm, tile.heightMm);
    const size = specNumber(spec, 'size_mm');
    if (size === null) {
      results.push(make(ruleId, { key: 'lightFit', status: 'info', formula: '—', noteKey: 'lightSizeUnknown', noteValues: { need: round(needMm, 0) } }, 'unknown', {}));
    } else {
      const ok = size >= needMm;
      results.push(
        make(
          ruleId,
          {
            key: 'lightFit',
            status: ok ? 'pass' : 'fail',
            formula: `${fmt(size)} mm ${ok ? '≥' : '<'} ${fmt(needMm, 1)} mm (${term(diagonal ? 'fovDiagonal' : 'fovLongSide')})`,
            noteKey: ok ? undefined : 'lightTooSmall',
            noteValues: { need: round(needMm, 0), have: size },
          },
          'calculated',
          { 'light.size_mm': size },
          null
        )
      );
    }
  }

  if (analysis.results.some((r) => r.ruleId === 'LGT-008')) {
    const strobe = specString(spec, 'strobe');
    if (strobe === 'no') {
      results.push(make('LGT-008', { key: 'lightFit', status: 'fail', formula: 'strobe: no', noteKey: 'lightNoStrobe' }, 'calculated', { 'light.strobe': strobe }));
    } else if (strobe === null) {
      results.push(make('LGT-008', { key: 'lightFit', status: 'info', formula: '—', noteKey: 'lightStrobeUnknown' }, 'unknown', {}));
    }
  }

  return results;
}

const megapixelsOf = (component: Component) => {
  const camera = cameraFromComponent(component);
  return camera.widthPx * camera.heightPx;
};

export function filterEquipment(analysis: RequirementAnalysis, catalog: readonly Component[]): EquipmentFilter {
  const active = (kind: Component['kind']) =>
    catalog.filter((c) => c.is_active && c.kind === kind).sort((a, b) => a.sort_order - b.sort_order);
  const lenses = active('lens');

  const cameras: CameraCandidate[] = active('camera')
    .map((component) => {
      const base = candidate(component, cameraRequirementChecks(analysis, component));
      if (base.reasons.length > 0) return { ...base, lenses: { accepted: [], excluded: [], best: null } };

      const config = cameraFromComponent(component);
      const lensCandidates = lenses.map((lens) => {
        const all = evaluateConfiguration({ analysis, camera: config, lens: lensFromComponent(lens) });
        return candidate(lens, all);
      });
      const grouped = split(lensCandidates);
      /* Khớp nhất = không cảnh báo trước, rồi biên OPT-001 LỚN nhất: ống đã qua
         kiểm phủ đủ vùng nhìn, nên tiêu cự càng gần mức lý tưởng thì càng dùng
         hết pixel của camera — mm/px mịn nhất. */
      const fitMargin = (c: Candidate) => c.results.find((r) => r.ruleId === 'OPT-001')?.marginRatio ?? 0;
      const best =
        [...grouped.accepted].sort((a, b) => a.warnings.length - b.warnings.length || fitMargin(b) - fitMargin(a))[0] ?? null;
      return { ...base, lenses: { ...grouped, best } };
    })
    .sort((a, b) => megapixelsOf(a.component) - megapixelsOf(b.component));

  const cameraGroup = split(cameras);

  const lightGroup = split(active('light').map((component) => candidate(component, lightChecks(analysis, component))));

  // Máy tính: tính theo camera đạt nhỏ nhất (chốt Q5) — C4/C5 tính lại theo camera đã chọn.
  const reference = cameraGroup.accepted[0]?.component ?? null;
  const n = Math.max(1, analysis.cameraCount ?? 1);
  let pcGroup: EquipmentGroup = { accepted: [], excluded: [] };
  if (reference) {
    const config = cameraFromComponent(reference);
    const cards = interfaceCardsFor(config.interfaceName, n);
    pcGroup = split(
      active('controller').map((component) =>
        candidate(
          component,
          evaluateConfiguration({ analysis, camera: config, pc: pcFromComponent(component), interfaceCards: cards }).filter((r) => r.ruleId === 'THR-004')
        )
      )
    );
  }

  return {
    ready: analysis.pixelsPerCamera !== null,
    cameras: cameraGroup,
    lights: { ...lightGroup, wantedTypes: analysis.lighting?.types ?? [] },
    pcs: { ...pcGroup, referenceCamera: reference },
  };
}
