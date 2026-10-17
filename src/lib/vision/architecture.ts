import type { RequirementAnalysis } from './requirementAnalysis';
import type { RuleResult } from './rules';
import type { CheckStatus } from './types';

/**
 * Sơ đồ kiến trúc hệ thống — spec V1.1 §9. SINH từ kết quả engine, không vẽ cứng:
 *
 *   VẬT → CAMERA → ỐNG KÍNH → CHIẾU SÁNG → GIAO TIẾP → MÁY TÍNH → PHẦN MỀM → PLC
 *
 * Camera → ống kính → đèn là thứ tự chọn thiết bị: camera quyết định cảm biến/ngàm,
 * ống kính theo cảm biến, đèn theo trường nhìn của ống kính (Hưng chốt 2026-10-17).
 *
 * Mỗi khối gắn các luật đã quyết định nó; trạng thái khối là trạng thái xấu nhất
 * của các luật đó.
 *
 * Hai tầng (2026-10-15): chưa chọn phương án → mức tối thiểu từ bảng Yêu cầu; đã
 * chọn → thêm thiết bị thật từ BOM và luật cấu hình của chính bộ thiết bị đó
 * (THR-003 nhịp, THR-004 máy tính… chỉ tính được khi có thiết bị). Màn hình và
 * Concept Report dùng CHUNG hàm này và NODE_EQUIPMENT — không thể lệch nhau.
 *
 * Nhóm cơ khí/nhiệt/môi trường (MEC, ENV) gắn vào khối VẬT: sai số của chúng đến
 * từ chính sản phẩm và nơi đặt máy.
 */

export const ARCHITECTURE_NODES = ['product', 'camera', 'lens', 'lighting', 'interface', 'ipc', 'software', 'plc'] as const;
export type ArchitectureNodeId = (typeof ARCHITECTURE_NODES)[number];

/** Dòng BOM nào thuộc khối nào — dùng chung cho màn hình và Concept Report. */
export const NODE_EQUIPMENT: Partial<Record<ArchitectureNodeId, readonly string[]>> = {
  camera: ['camera'],
  lens: ['lens'],
  lighting: ['light', 'lightController'],
  interface: ['interfaceCard', 'cable:data'],
  ipc: ['pc'],
  software: ['software'],
};

export type NodeEquipment = { qty: number; brand: string | null; model: string | null };

/** Phương án đã chọn: luật cấu hình của bộ thiết bị + các dòng BOM. */
export type ChosenSolution = {
  configResults: readonly RuleResult[];
  lines: readonly { key: string; qty: number; brand: string | null; model: string | null }[];
};

export type ArchitectureNode = {
  id: ArchitectureNodeId;
  /** Thiết bị thật của phương án đã chọn; rỗng khi chưa chọn. */
  equipment: NodeEquipment[];
  /** Khoá nhãn chi tiết (designer.requirement.architecture.details.<key>) kèm số. null = chưa có gì để nói. */
  detail: { key: string; values?: Record<string, string | number> } | null;
  results: RuleResult[];
  /** Trạng thái xấu nhất của các luật gắn vào khối; null khi chưa có luật nào. */
  status: CheckStatus | null;
  /** true = khối cần thiết bị cụ thể mà chưa có (chưa chọn phương án / chưa chọn giao tiếp PLC). */
  pending: boolean;
};

export type Architecture = {
  nodes: ArchitectureNode[];
  cameraCount: number | null;
};

const SEVERITY: Record<CheckStatus, number> = { info: 0, pass: 1, warn: 2, fail: 3 };

function worst(results: RuleResult[]): CheckStatus | null {
  if (results.length === 0) return null;
  return results.reduce<CheckStatus>((acc, result) => (SEVERITY[result.status] > SEVERITY[acc] ? result.status : acc), 'info');
}

const OWNER: Array<[ArchitectureNodeId, (ruleId: string) => boolean]> = [
  ['product', (id) => id.startsWith('MEC-') || id.startsWith('ENV-')],
  ['camera', (id) => id.startsWith('RES-') || id === 'THR-005'],
  ['lens', (id) => id.startsWith('OPT-')],
  ['lighting', (id) => id.startsWith('LGT-')],
  ['interface', (id) => id === 'THR-001' || id === 'THR-002'],
  // THR-003 (ngân sách nhịp: chụp + xử lý + truyền) và THR-004 (máy tính đủ sức) — chỉ có khi đã chọn thiết bị.
  ['ipc', (id) => id === 'THR-003' || id === 'THR-004'],
  ['software', (id) => id.startsWith('AI-')],
  ['plc', (id) => id.startsWith('INT-')],
];

export function buildArchitecture(analysis: RequirementAnalysis, chosen?: ChosenSolution | null): Architecture {
  /* Luật cấu hình trùng (ruleId, key) với luật bảng Yêu cầu thì lấy bản cấu hình:
     nó tính trên thiết bị thật. */
  const configKeys = new Set((chosen?.configResults ?? []).map((r) => `${r.ruleId}|${r.key}`));
  const all = [
    ...analysis.results.filter((r) => !configKeys.has(`${r.ruleId}|${r.key}`)),
    ...(chosen?.configResults ?? []),
  ];
  const own = (id: ArchitectureNodeId) => {
    const match = OWNER.find(([node]) => node === id)?.[1];
    if (!match) return [];
    const seen = new Set<string>();
    return all.filter((result) => {
      if (!match(result.ruleId)) return false;
      const key = `${result.ruleId}|${result.key}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const equipmentOf = (id: ArchitectureNodeId): NodeEquipment[] => {
    const keys = NODE_EQUIPMENT[id] ?? [];
    return (chosen?.lines ?? []).filter((line) => keys.includes(line.key)).map(({ qty, brand, model }) => ({ qty, brand, model }));
  };
  const find = (ruleId: string) => analysis.results.find((result) => result.ruleId === ruleId);
  const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

  const detailOf = (id: ArchitectureNodeId): ArchitectureNode['detail'] => {
    switch (id) {
      case 'product':
        return analysis.fovWidthMm !== null && analysis.fovHeightMm !== null
          ? { key: 'productSize', values: { w: analysis.fovWidthMm, h: analysis.fovHeightMm } }
          : null;
      case 'lighting': {
        const suggestion = analysis.results.find((result) => result.ruleId.startsWith('LGT-') && result.key === 'lightingSuggestion');
        return suggestion ? { key: 'lightType', values: { type: suggestion.formula } } : null;
      }
      case 'lens': {
        const telecentric = find('OPT-007');
        if (telecentric) {
          return {
            key: telecentric.status === 'fail' ? 'lensTelecentricInfeasible' : telecentric.status === 'warn' ? 'lensTelecentricExpensive' : 'lensTelecentric',
          };
        }
        return find('OPT-008') ? { key: 'lensStandard' } : null;
      }
      case 'camera':
        if (analysis.cameraCount === null) return { key: 'cameraUnknown' };
        return analysis.megapixelsPerCamera !== null
          ? { key: 'cameraSpec', values: { count: analysis.cameraCount, mp: round(analysis.megapixelsPerCamera, 1) } }
          : { key: 'cameraCountOnly', values: { count: analysis.cameraCount } };
      case 'interface':
        return analysis.interfaceName !== null && analysis.dataRateTotalMBs !== null
          ? { key: 'interfaceSpec', values: { name: analysis.interfaceName, total: round(analysis.dataRateTotalMBs, 1) } }
          : null;
      case 'software': {
        if (find('AI-002')) return { key: 'softwareDeepLearning' };
        const traditional = find('AI-001');
        if (traditional) return { key: traditional.status === 'pass' ? 'softwareTraditional' : 'softwareUndecided' };
        return analysis.uncertaintyBudgetMm !== null ? { key: 'softwareTraditional' } : null;
      }
      case 'plc': {
        const integration = find('INT-001');
        return integration ? { key: 'plcInterface', values: { list: integration.formula } } : { key: 'plcUnknown' };
      }
      default:
        return null;
    }
  };

  const nodes = ARCHITECTURE_NODES.map((id): ArchitectureNode => {
    const results = own(id);
    const equipment = equipmentOf(id);
    const pending = (id === 'ipc' && equipment.length === 0) || (id === 'plc' && results.length === 0);
    return { id, equipment, detail: detailOf(id), results, status: worst(results), pending };
  });

  return { nodes, cameraCount: analysis.cameraCount };
}
