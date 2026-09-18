import { V1A_FIELDS, fieldsFor, readField } from '@/lib/requirement/fields';
import type { Requirement } from '@/lib/requirement/types';
import { buildArchitecture, type ArchitectureNodeId } from '@/lib/vision/architecture';
import { BOM_EXCLUSIONS, RULESET_VERSION, type BomSnapshot } from '@/lib/vision/bom';
import { assessFeasibility } from '@/lib/vision/feasibility';
import { analyseRequirement } from '@/lib/vision/requirementAnalysis';
import { FEASIBILITY_DIMENSIONS, noteMessageKey, type RuleResult } from '@/lib/vision/rules';

/**
 * Nội dung xuất của MỘT revision đã lưu — V1c mục C6 (spec V1.1 §11.1, §11.2).
 *
 * Một mô hình, hai định dạng: file Excel BOM (bomWorkbook.ts) và PDF Concept
 * Report (pdf/ConceptReport.tsx) cùng đọc từ đây, để hai file không thể kể hai
 * câu chuyện khác nhau về cùng một revision.
 *
 * Chốt 2026-09-18 (Q1–Q7 khi mở C6):
 * - Chỉ xuất từ revision ĐÃ LƯU. BOM lấy nguyên ảnh chụp; phân tích tính lại
 *   bằng engine hiện tại, lệch phiên bản luật thì ghi rõ.
 * - Thiết bị chưa kiểm chứng đánh dấu * kèm chú thích.
 *
 * Hàm thuần: nhận sẵn hàm dịch, không đụng next-intl hay database.
 */

/** Hàm dịch với khoá đầy đủ ('designer.requirement.fields.object.sizeX'). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type ExportRow = { label: string; value: string };

export type ConceptDocument = {
  projectName: string;
  revLabel: string;
  locked: boolean;
  savedAt: string;
  generatedAt: string;
  author: string;
  applicationLabel: string;
  rulesetSaved: string | null;
  rulesetNow: string;
  /** Phiên bản luật lúc lưu khác bây giờ → báo cáo ghi rõ phân tích tính lại. */
  rulesetChanged: boolean;
  requirement: (ExportRow & { assumed: boolean })[];
  assumptions: ExportRow[];
  analysis: { dimension: string; rows: { ruleId: string; check: string; status: string; formula: string; note: string | null }[] }[];
  feasibility: { status: string; overall: number | null; limiting: string; blockers: { ruleId: string; text: string }[] };
  warnings: { ruleId: string; status: string; text: string }[];
  architecture: { node: string; detail: string; equipment: string | null }[];
  bom: null | {
    level: string;
    margin: number | null;
    lines: {
      category: string;
      code: string;
      name: string;
      summary: string;
      qty: number;
      unitPrice: number | null;
      amount: number | null;
      leadTime: string;
      supplier: string;
      rules: string;
      unverified: boolean;
      placeholder: boolean;
    }[];
    total: number | null;
    missingPrices: number;
  };
  validationPlan: string[];
  exclusions: string[];
  hasUnverified: boolean;
};

export type RevisionForExport = {
  rev_label: string;
  requirement: Requirement;
  bom: BomSnapshot | null;
  rule_version: string | null;
  locked_at: string | null;
  updated_at: string;
};

/** Khối kiến trúc ↔ nhóm dòng BOM chứa thiết bị của khối đó. */
const NODE_EQUIPMENT: Partial<Record<ArchitectureNodeId, string[]>> = {
  lighting: ['light'],
  lens: ['lens'],
  camera: ['camera'],
  interface: ['interfaceCard', 'cable:data'],
  ipc: ['pc'],
  software: ['software'],
};

export function buildConceptDocument(input: {
  projectName: string;
  revision: RevisionForExport;
  author: string;
  now: Date;
  formatDate: (date: Date) => string;
  t: Translate;
}): ConceptDocument {
  const { revision, t } = input;
  const requirement = revision.requirement;
  const analysis = analyseRequirement(requirement);
  const feasibility = assessFeasibility(analysis.results);
  const architecture = buildArchitecture(analysis);
  const bom = revision.bom;

  const fieldLabel = (path: string) => {
    const def = V1A_FIELDS.find((item) => item.path === path);
    return def ? t(`designer.requirement.fields.${def.section}.${def.key}`) : path;
  };
  const valueText = (path: string, value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return t(value ? 'export.yes' : 'export.no');
    const def = V1A_FIELDS.find((item) => item.path === path);
    const one = (v: unknown) => (def?.optionsKey ? t(`designer.requirement.options.${def.optionsKey}.${String(v)}`) : String(v));
    const text = Array.isArray(value) ? value.map(one).join(', ') : one(value);
    // Đơn vị '± mm' đặt dấu ± lên trước số: '±0.5 mm', không phải '0.5 ± mm'.
    if (def?.unit?.startsWith('± ')) return `±${text} ${def.unit.slice(2)}`;
    return def?.unit ? `${text} ${def.unit}` : text;
  };
  const noteOf = (result: RuleResult) =>
    result.noteKey ? t(`selector.vision.${noteMessageKey(result.noteKey)}`, result.noteValues ?? {}) : null;
  const textOf = (result: RuleResult) => noteOf(result) ?? t(`selector.vision.checks.${result.key}`);

  // Yêu cầu: ô đã nhập + ô đang giả định (đánh dấu), bỏ ô trống.
  const requirementRows = fieldsFor(requirement.applicationType)
    .map((def) => {
      const own = readField(requirement, def.path)?.value;
      const assumed = analysis.fieldInputs[def.path];
      if (own !== null && own !== undefined) return { label: fieldLabel(def.path), value: valueText(def.path, own), assumed: false };
      if (assumed?.assumptionId) return { label: fieldLabel(def.path), value: valueText(def.path, assumed.value), assumed: true };
      return null;
    })
    .filter((row): row is ExportRow & { assumed: boolean } => row !== null);

  // Giả định: ưu tiên ảnh chụp trong BOM (đúng lúc lưu); chưa có BOM thì tính lại.
  const assumed = bom?.assumptions ?? Object.entries(analysis.fieldInputs).filter(([, v]) => v.assumptionId).map(([path, v]) => ({ path, value: v.value }));

  const bomDoc: ConceptDocument['bom'] = bom
    ? {
        level: t(`designer.requirement.solutions.levels.${bom.level}`),
        margin: bom.margin,
        lines: bom.lines.map((line) => ({
          category: t(`designer.requirement.bom.categories.${line.category}`),
          code: line.code ?? '',
          name: line.placeholder ? t(`designer.requirement.bom.placeholders.${line.placeholder}`) : `${line.brand} ${line.model}`,
          summary: line.placeholder ? t('designer.requirement.bom.needsQuote') : line.summary,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: line.unitPrice != null ? line.unitPrice * line.qty : null,
          leadTime: line.leadTimeDays != null ? t('designer.requirement.bom.days', { days: line.leadTimeDays }) : '',
          supplier: line.supplier ?? '',
          rules: line.ruleIds.join(', ') || t('designer.requirement.bom.manual'),
          unverified: line.unverified,
          placeholder: line.placeholder !== null,
        })),
        total: bom.total,
        missingPrices: bom.missingPrices,
      }
    : null;

  // Kế hoạch xác nhận: luật cần chụp mẫu + thiết bị chưa đối chiếu datasheet + món cần báo giá.
  const validationPlan = [
    ...analysis.results
      .filter((r) => r.evidence === 'requires-sample-test')
      .map((r) => t('export.validation.sample', { rule: r.ruleId, check: t(`selector.vision.checks.${r.key}`) })),
    ...(bom?.lines.filter((l) => l.unverified).length
      ? [t('export.validation.datasheet', { items: bom.lines.filter((l) => l.unverified).map((l) => `${l.brand} ${l.model}`).join(', ') })]
      : []),
    ...(bom?.lines.filter((l) => l.placeholder).length
      ? [t('export.validation.quote', { items: bom.lines.filter((l) => l.placeholder).map((l) => t(`designer.requirement.bom.placeholders.${l.placeholder}`)).join(', ') })]
      : []),
  ];

  return {
    projectName: input.projectName,
    revLabel: revision.rev_label,
    locked: revision.locked_at !== null,
    savedAt: input.formatDate(new Date(revision.updated_at)),
    generatedAt: input.formatDate(input.now),
    author: input.author,
    applicationLabel: t(`home.entry.apps.${requirement.applicationType}.title`),
    rulesetSaved: revision.rule_version,
    rulesetNow: RULESET_VERSION,
    rulesetChanged: revision.rule_version !== null && revision.rule_version !== RULESET_VERSION,
    requirement: requirementRows,
    assumptions: assumed.map((a) => ({ label: fieldLabel(a.path), value: valueText(a.path, a.value) })),
    analysis: FEASIBILITY_DIMENSIONS.map((dimension) => ({
      dimension: t(`designer.requirement.analysis.dimensions.${dimension}`),
      rows: analysis.results
        .filter((r) => r.dimension === dimension)
        .map((r) => ({
          ruleId: r.ruleId,
          check: t(`selector.vision.checks.${r.key}`),
          status: t(`selector.vision.status.${r.status}`),
          formula: r.formula === '—' ? '' : r.formula,
          note: noteOf(r),
        })),
    })).filter((group) => group.rows.length > 0),
    feasibility: {
      status: t(`designer.requirement.analysis.status.${feasibility.status}`),
      overall: feasibility.overall,
      limiting: feasibility.limitingFactors.map((d) => t(`designer.requirement.analysis.dimensions.${d}`)).join(', '),
      blockers: feasibility.blockers.map((r) => ({ ruleId: r.ruleId, text: textOf(r) })),
    },
    warnings: analysis.results
      .filter((r) => r.status === 'warn' || r.status === 'fail')
      .map((r) => ({ ruleId: r.ruleId, status: t(`selector.vision.status.${r.status}`), text: textOf(r) })),
    architecture: architecture.nodes.map((node) => {
      const keys = NODE_EQUIPMENT[node.id] ?? [];
      const items = bom?.lines.filter((l) => keys.includes(l.key)).map((l) => `${l.qty} × ${l.brand} ${l.model}`) ?? [];
      return {
        node: t(`designer.requirement.architecture.nodes.${node.id}`),
        detail: node.detail ? t(`designer.requirement.architecture.details.${node.detail.key}`, node.detail.values ?? {}) : '',
        equipment: items.length > 0 ? items.join(' · ') : null,
      };
    }),
    bom: bomDoc,
    validationPlan,
    exclusions: (bom?.exclusions ?? [...BOM_EXCLUSIONS]).map((key) => t(`designer.requirement.bom.exclusions.${key}`)),
    hasUnverified: bom?.lines.some((l) => l.unverified) ?? false,
  };
}
