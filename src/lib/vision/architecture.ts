import type { RequirementAnalysis } from './requirementAnalysis';
import type { RuleResult } from './rules';
import type { CheckStatus } from './types';

/**
 * Sơ đồ kiến trúc hệ thống — spec V1.1 §9. SINH từ kết quả engine, không vẽ cứng:
 *
 *   VẬT → CHIẾU SÁNG → ỐNG KÍNH → CAMERA → GIAO TIẾP → MÁY TÍNH → PHẦN MỀM → PLC
 *
 * Mỗi khối gắn các luật đã quyết định nó; trạng thái khối là trạng thái xấu nhất
 * của các luật đó. Khối máy tính (THR-004) và PLC (INT-001) cần thiết bị cụ thể
 * nên ở V1b là "chờ bước chọn thiết bị" — hiện ra để thấy toàn cảnh, không giả
 * vờ đã tính.
 *
 * Nhóm cơ khí/nhiệt/môi trường (MEC, ENV) gắn vào khối VẬT: sai số của chúng đến
 * từ chính sản phẩm và nơi đặt máy.
 */

export const ARCHITECTURE_NODES = ['product', 'lighting', 'lens', 'camera', 'interface', 'ipc', 'software', 'plc'] as const;
export type ArchitectureNodeId = (typeof ARCHITECTURE_NODES)[number];

export type ArchitectureNode = {
  id: ArchitectureNodeId;
  /** Khoá nhãn chi tiết (designer.requirement.architecture.details.<key>) kèm số. null = chưa có gì để nói. */
  detail: { key: string; values?: Record<string, string | number> } | null;
  results: RuleResult[];
  /** Trạng thái xấu nhất của các luật gắn vào khối; null khi chưa có luật nào. */
  status: CheckStatus | null;
  /** true = khối cần thiết bị cụ thể, làm ở V1c. */
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
  ['lighting', (id) => id.startsWith('LGT-')],
  ['lens', (id) => id.startsWith('OPT-')],
  ['camera', (id) => id.startsWith('RES-') || id === 'THR-005'],
  ['interface', (id) => id === 'THR-001' || id === 'THR-002'],
  ['software', (id) => id.startsWith('AI-')],
];

export function buildArchitecture(analysis: RequirementAnalysis): Architecture {
  const own = (id: ArchitectureNodeId) => {
    const match = OWNER.find(([node]) => node === id)?.[1];
    return match ? analysis.results.filter((result) => match(result.ruleId)) : [];
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
      default:
        return null;
    }
  };

  const nodes = ARCHITECTURE_NODES.map((id): ArchitectureNode => {
    const results = own(id);
    return { id, detail: detailOf(id), results, status: worst(results), pending: id === 'ipc' || id === 'plc' };
  });

  return { nodes, cameraCount: analysis.cameraCount };
}
