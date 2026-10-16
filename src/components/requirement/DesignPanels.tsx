'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { explainSolutionAction, type ExplainResult } from '@/app/actions/explainSolution';
import { listAccessories } from '@/lib/components/match';
import type { Component } from '@/lib/components/specs';
import type { Requirement } from '@/lib/requirement/types';
import { buildBom } from '@/lib/vision/bom';
import { emptySelection, type BomSelection } from '@/lib/vision/bomSelection';
import { filterEquipment } from '@/lib/vision/equipmentFilter';
import { analyseRequirement } from '@/lib/vision/requirementAnalysis';
import { buildSolutionLevels, type SolutionLevelKey } from '@/lib/vision/solutionLevels';
import { fmt } from '@/lib/vision/types';
import { buildWhyFacts, type WhyFacts } from '@/lib/vision/whyFacts';
import { Panel } from '@/components/ui/PanelHeader';
import { buildArchitecture } from '@/lib/vision/architecture';
import type { RuleResult } from '@/lib/vision/rules';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import { BomPanel } from './BomPanel';
import { SolutionPanel } from './SolutionPanel';
import type { Explainer } from './WhyPanel';
import { DEFAULT_ENGINE_PARAMS, type EngineParams } from '@/lib/vision/engineParams';
import { DEFAULT_ENGINE_TABLES, type EngineTables } from '@/lib/vision/engineTables';

/**
 * Phương án (C4) → BOM (C5) → Thiết bị phù hợp (C3), dưới Phân tích kỹ thuật.
 *
 * Tính một lần rồi chia cho các khối: Phương án chỉ xếp hạng trên đúng kết quả
 * lọc cứng mà khối Thiết bị phù hợp đang hiện, và BOM dựng từ đúng phương án
 * đang hiện — không thể lệch nhau.
 */
export function DesignPanels({
  requirement,
  catalog,
  selection,
  onSelectionChange,
  readOnly,
  explainAvailable = false,
  engineParams = DEFAULT_ENGINE_PARAMS,
  engineTables = DEFAULT_ENGINE_TABLES,
}: {
  /** Ngưỡng engine đang dùng (admin). */
  engineParams?: EngineParams;
  /** Bảng chiếu sáng + giả định mặc định (admin). */
  engineTables?: EngineTables;
  requirement: Requirement;
  /** Server có key AI → hiện nút "Diễn giải bằng lời" (C7). */
  explainAvailable?: boolean;
  catalog: readonly Component[];
  selection: BomSelection | null;
  onSelectionChange: (next: BomSelection | undefined) => void;
  /** Revision đã khoá: xem được, không đổi được lựa chọn. */
  readOnly: boolean;
}) {
  const analysis = useMemo(() => analyseRequirement(requirement, engineParams, engineTables), [requirement, engineParams, engineTables]);
  const filter = useMemo(() => filterEquipment(analysis, catalog), [analysis, catalog]);
  const solutions = useMemo(() => buildSolutionLevels(analysis, filter, catalog), [analysis, filter, catalog]);
  const bom = useMemo(() => (selection ? buildBom(analysis, solutions, catalog, selection) : null), [analysis, solutions, catalog, selection]);
  // Khối "Vì sao chọn?" (C7): cùng hàm dựng với dữ kiện server gửi cho bộ diễn giải.
  const locale = useLocale();
  const translate = useTranslations();
  const why = useMemo(() => {
    const t = (key: string, values?: Record<string, string | number>) => translate(key as never, values as never);
    const out: Partial<Record<SolutionLevelKey, WhyFacts>> = {};
    for (const level of solutions.levels) {
      const facts = buildWhyFacts({ analysis, level, locale, t });
      if (facts) out[level.key] = facts;
    }
    return out;
  }, [analysis, solutions, locale, translate]);
  // Đoạn diễn giải giữ tạm theo bảng Yêu cầu (chốt Q7): bảng đổi thì bỏ. Chỉ giữ kết quả thành công.
  const explainer = useMemo<Explainer | null>(() => {
    if (!explainAvailable) return null;
    const requirementJson = JSON.stringify(requirement);
    const cache = new Map<SolutionLevelKey, ExplainResult>();
    return {
      cached: (level) => cache.get(level),
      run: async (level) => {
        const hit = cache.get(level);
        if (hit) return hit;
        const result = await explainSolutionAction(requirementJson, level).catch((): ExplainResult => ({ status: 'failed', detail: 'network' }));
        if (result.status === 'ok') cache.set(level, result);
        return result;
      },
    };
  }, [explainAvailable, requirement]);
  /* Sơ đồ hệ thống (tách khỏi Phân tích, 2026-10-15): có phương án đã chọn thì
     vẽ thiết bị thật + luật cấu hình của chính bộ thiết bị đó. */
  const chosenLevel = selection && bom ? solutions.levels.find((l) => l.key === selection.level) ?? null : null;
  const architecture = useMemo(
    () =>
      buildArchitecture(
        analysis,
        chosenLevel && bom
          ? {
              configResults: [chosenLevel.camera, chosenLevel.lens, chosenLevel.light, chosenLevel.pc].flatMap((c) => c?.results ?? []),
              lines: bom.lines,
            }
          : null
      ),
    [analysis, chosenLevel, bom]
  );
  const tv = useTranslations('selector.vision');
  const tArch = useTranslations('designer.requirement.architecture');
  const tSolutions = useTranslations('designer.requirement.solutions');
  const noteOf = (result: RuleResult) =>
    result.noteKey
      ? result.noteKey.includes('.')
        ? tv(result.noteKey, result.noteValues ?? {})
        : tv(`notes.${result.noteKey}`, result.noteValues ?? {})
      : null;
  /* Không mức nào dựng được → 3 lý do loại phổ biến nhất (camera, ống kính, đèn, máy tính),
     thay cho khối "Thiết bị phù hợp" đã bỏ. */
  const noSolutionReasons = useMemo(() => {
    if (!filter.ready || solutions.levels.some((l) => l.status === 'ok')) return [];
    const counts = new Map<string, number>();
    const excluded = [
      ...filter.cameras.excluded,
      ...filter.cameras.accepted.flatMap((c) => c.lenses.excluded),
      ...filter.lights.excluded,
      ...filter.pcs.excluded,
    ];
    for (const item of excluded) {
      for (const reason of item.reasons) {
        const label = `${reason.ruleId} · ${tv(`checks.${reason.key}`)}`;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, n]) => tSolutions('noSolutionReason', { label, count: n }));
  }, [filter, solutions, tv, tSolutions]);
  const accessories = useMemo(() => listAccessories(catalog.filter((c) => c.is_active) as Component[]), [catalog]);

  const t = useTranslations('designer.requirement.solutions.line');
  // Dòng "yêu cầu bắt buộc" của UI_CONTENT màn 5 — chỉ ghi thứ khách đã cho.
  const input = (path: string) => analysis.fieldInputs[path]?.value;
  const tolerance = input('measurement.0.tolerance');
  const defect = input('detection.0.minSize');
  const parts = [
    typeof tolerance === 'number' ? t('tolerance', { value: fmt(tolerance, 4) }) : null,
    typeof defect === 'number' ? t('defect', { value: fmt(defect, 4) }) : null,
    analysis.fovWidthMm !== null && analysis.fovHeightMm !== null
      ? t('object', { width: fmt(analysis.fovWidthMm, 1), height: fmt(analysis.fovHeightMm, 1) })
      : null,
    analysis.governingMmPerPx !== null ? t('resolution', { value: fmt(analysis.governingMmPerPx, 5) }) : null,
  ].filter(Boolean);

  const ready = filter.ready && catalog.length > 0;
  // Đổi mức thì bỏ chỉnh sửa BOM cũ: khoá dòng giữ nguyên nhưng số lượng đã sửa là cho thiết bị khác.
  const select = (level: SolutionLevelKey) => onSelectionChange(selection?.level === level ? selection : emptySelection(level));

  return (
    <>
      <SolutionPanel
        solutions={solutions}
        requirementLine={parts.join(' · ')}
        ready={ready}
        noSolutionReasons={noSolutionReasons}
        selectedLevel={selection?.level ?? null}
        onSelect={readOnly ? null : select}
        why={why}
        explainer={explainer}
      />
      {selection && ready ? (
        <BomPanel
          bom={bom}
          selection={selection}
          accessories={accessories}
          onChange={onSelectionChange}
          onClear={() => onSelectionChange(undefined)}
          readOnly={readOnly}
        />
      ) : null}
      <Panel id="architecture-title" title={tArch('title')} note={chosenLevel ? tArch('hint') : tArch('pickSolutionHint')}>
        <ArchitectureDiagram architecture={architecture} noteOf={noteOf} />
      </Panel>
    </>
  );
}
