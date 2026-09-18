import { V1A_FIELDS } from '@/lib/requirement/fields';
import { assessFeasibility } from './feasibility';
import { renderFormula } from './formulaTerms';
import type { Candidate } from './equipmentFilter';
import type { RequirementAnalysis } from './requirementAnalysis';
import { noteMessageKey, type RuleResult } from './rules';
import type { SolutionLevel } from './solutionLevels';
import { fmt, type CheckStatus } from './types';

/**
 * Khối "Vì sao chọn?" của một phương án — V1c mục C7 (spec V1.1 §8.2,
 * UI_CONTENT màn 6). Chốt Q1–Q10 ngày 2026-09-18.
 *
 * Toàn bộ dữ kiện đến từ engine: kết quả luật có mã, số đã tính, giả định,
 * trọng số xếp hạng. Không có AI ở đây. Cùng một hàm dựng khối hiển thị trên
 * trình duyệt VÀ dữ kiện gửi cho bộ diễn giải (lib/ai/explainer) ở server —
 * nên bộ kiểm số so đoạn văn với đúng những con số người dùng đang thấy.
 *
 * Không có giá, nhà cung cấp, tên dự án hay mô tả của khách (chốt Q3).
 * Hàm thuần: nhận sẵn hàm dịch (khoá đầy đủ), không đụng next-intl.
 */

export type WhyTranslate = (key: string, values?: Record<string, string | number>) => string;

export type WhyRow = {
  ruleId: string | null;
  status: CheckStatus | null;
  label: string;
  /** Công thức đã thay số, hoặc giá trị. */
  detail: string;
  note: string | null;
};

export const WHY_SECTIONS = ['requirement', 'camera', 'lens', 'light', 'pc', 'assumptions', 'limits', 'ranking'] as const;
export type WhySectionId = (typeof WHY_SECTIONS)[number];

export type WhySection = { id: WhySectionId; title: string; rows: WhyRow[] };

export type WhyFacts = { level: SolutionLevel['key']; title: string; sections: WhySection[] };

const WHY = 'designer.requirement.solutions.why';

export function buildWhyFacts(input: {
  analysis: RequirementAnalysis;
  level: SolutionLevel;
  locale: string;
  t: WhyTranslate;
}): WhyFacts | null {
  const { analysis, level, t } = input;
  if (level.status !== 'ok' || !level.camera || !level.lens) return null;

  const ruleRow = (result: RuleResult): WhyRow => ({
    ruleId: result.ruleId,
    status: result.status,
    label: t(`selector.vision.checks.${result.key}`),
    detail: result.formula === '—' ? '' : renderFormula(result.formula, (key) => t(`selector.vision.formulaTerms.${key}`)),
    note: result.noteKey ? t(`selector.vision.${noteMessageKey(result.noteKey)}`, result.noteValues ?? {}) : null,
  });
  const nameOf = (candidate: Candidate) => `${candidate.component.brand} ${candidate.component.model}`;
  const headRow = (label: string, detail: string): WhyRow => ({ ruleId: null, status: null, label, detail, note: null });
  const deviceRows = (candidate: Candidate | null, head: string) =>
    candidate ? [headRow(nameOf(candidate), head), ...candidate.results.map(ruleRow)] : [];

  const camera = level.camera.component.spec;
  const target = level.mmPerPx !== null && level.margin !== null ? level.mmPerPx * level.margin : null;
  const cameraHead =
    level.mmPerPx !== null && level.margin !== null && target !== null
      ? t(`${WHY}.cameraHead`, {
          w: String(camera.resolution_w_px ?? '?'),
          h: String(camera.resolution_h_px ?? '?'),
          mmPerPx: fmt(level.mmPerPx, 4),
          margin: fmt(level.margin, 2),
          target: fmt(target, 5),
        })
      : '';

  // Giả định: nhãn ô trên bảng Yêu cầu, giá trị kèm đơn vị, câu giải thích của giả định.
  const assumptionRows = analysis.assumptions.map((a): WhyRow => {
    const def = a.path ? V1A_FIELDS.find((item) => item.path === a.path) : undefined;
    const label = def
      ? t(`designer.requirement.fields.${def.section}.${def.key}`)
      : (a.title?.[input.locale === 'en' ? 'en' : 'vi'] ?? '');
    const one = (v: unknown) => (def?.optionsKey ? t(`designer.requirement.options.${def.optionsKey}.${String(v)}`) : String(v));
    const value =
      a.value === undefined ? '' : typeof a.value === 'boolean' ? t(a.value ? 'export.yes' : 'export.no') : `${one(a.value)}${a.unit ? ` ${a.unit}` : ''}`;
    return { ruleId: a.ruleIds.join(', ') || null, status: null, label, detail: value, note: input.locale === 'en' ? a.en : a.vi };
  });

  // Yếu tố giới hạn: FAIL/WARN của bảng Yêu cầu + rủi ro của cấu hình này (chưa kiểm được, sát ngưỡng).
  const feasibility = assessFeasibility(analysis.results);
  const configRisks = level.risks.filter((r) => !analysis.results.includes(r));
  const limitRows = [
    ...(feasibility.limitingFactors.length > 0
      ? [headRow(t(`${WHY}.limiting`), feasibility.limitingFactors.map((d) => t(`designer.requirement.analysis.dimensions.${d}`)).join(', '))]
      : []),
    ...analysis.results.filter((r) => r.status === 'warn' || r.status === 'fail').map(ruleRow),
    ...configRisks.map(ruleRow),
  ];

  const rankingRows = level.score
    ? [
        headRow(t(`${WHY}.scoreTotal`), t(`${WHY}.scoreValue`, { score: level.score.total })),
        ...level.score.parts.map((part) =>
          headRow(
            t(`designer.requirement.solutions.criteria.${part.criterion}`),
            part.hasData
              ? t(`${WHY}.scorePart`, { value: fmt(part.value, 2), weight: fmt(part.weight, 2) })
              : t(`${WHY}.scoreNoData`, { weight: fmt(part.weight, 2) })
          )
        ),
      ]
    : [];

  const sections: WhySection[] = [
    { id: 'requirement', rows: analysis.results.filter((r) => r.ruleId.startsWith('RES-')).map(ruleRow) },
    { id: 'camera', rows: deviceRows(level.camera, cameraHead) },
    { id: 'lens', rows: deviceRows(level.lens, '') },
    { id: 'light', rows: deviceRows(level.light, '') },
    { id: 'pc', rows: deviceRows(level.pc, '') },
    { id: 'assumptions', rows: assumptionRows },
    { id: 'limits', rows: limitRows },
    { id: 'ranking', rows: rankingRows },
  ]
    .filter((section) => section.rows.length > 0)
    .map((section) => ({ ...section, id: section.id as WhySectionId, title: t(`${WHY}.sections.${section.id}`) }));

  return {
    level: level.key,
    title: t(`${WHY}.title`, { level: t(`designer.requirement.solutions.levels.${level.key}`) }),
    sections,
  };
}

/**
 * Dữ kiện dạng chữ — đúng thứ gửi cho bộ diễn giải và đúng tập số bộ kiểm số
 * được phép thấy trong đoạn văn trả về.
 */
export function whyFactsToText(facts: WhyFacts, statusLabel: (status: CheckStatus) => string): string {
  const lines = [facts.title];
  for (const section of facts.sections) {
    lines.push('', `## ${section.title}`);
    for (const row of section.rows) {
      const head = [row.ruleId ? `[${row.ruleId}]` : null, row.status ? `(${statusLabel(row.status)})` : null, row.label].filter(Boolean).join(' ');
      lines.push(`- ${[head, row.detail, row.note].filter(Boolean).join(' — ')}`);
    }
  }
  return lines.join('\n');
}
