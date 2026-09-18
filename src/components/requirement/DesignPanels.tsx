'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { listAccessories } from '@/lib/components/match';
import type { Component } from '@/lib/components/specs';
import type { Requirement } from '@/lib/requirement/types';
import { buildBom } from '@/lib/vision/bom';
import { emptySelection, type BomSelection } from '@/lib/vision/bomSelection';
import { filterEquipment } from '@/lib/vision/equipmentFilter';
import { analyseRequirement } from '@/lib/vision/requirementAnalysis';
import { buildSolutionLevels, type SolutionLevelKey } from '@/lib/vision/solutionLevels';
import { fmt } from '@/lib/vision/types';
import { BomPanel } from './BomPanel';
import { EquipmentPanel } from './EquipmentPanel';
import { SolutionPanel } from './SolutionPanel';

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
}: {
  requirement: Requirement;
  catalog: readonly Component[];
  selection: BomSelection | null;
  onSelectionChange: (next: BomSelection | undefined) => void;
  /** Revision đã khoá: xem được, không đổi được lựa chọn. */
  readOnly: boolean;
}) {
  const analysis = useMemo(() => analyseRequirement(requirement), [requirement]);
  const filter = useMemo(() => filterEquipment(analysis, catalog), [analysis, catalog]);
  const solutions = useMemo(() => buildSolutionLevels(analysis, filter, catalog), [analysis, filter, catalog]);
  const bom = useMemo(() => (selection ? buildBom(analysis, solutions, catalog, selection) : null), [analysis, solutions, catalog, selection]);
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
        selectedLevel={selection?.level ?? null}
        onSelect={readOnly ? null : select}
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
      <EquipmentPanel filter={filter} catalogEmpty={catalog.length === 0} />
    </>
  );
}
