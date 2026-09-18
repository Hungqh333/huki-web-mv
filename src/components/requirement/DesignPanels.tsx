'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Component } from '@/lib/components/specs';
import type { Requirement } from '@/lib/requirement/types';
import { filterEquipment } from '@/lib/vision/equipmentFilter';
import { analyseRequirement } from '@/lib/vision/requirementAnalysis';
import { buildSolutionLevels } from '@/lib/vision/solutionLevels';
import { fmt } from '@/lib/vision/types';
import { EquipmentPanel } from './EquipmentPanel';
import { SolutionPanel } from './SolutionPanel';

/**
 * Khối Phương án (C4) + Thiết bị phù hợp (C3) dưới Phân tích kỹ thuật.
 *
 * Tính một lần rồi chia cho hai khối: Phương án chỉ xếp hạng trên đúng kết quả
 * lọc cứng mà khối Thiết bị phù hợp đang hiện — không thể lệch nhau.
 */
export function DesignPanels({ requirement, catalog }: { requirement: Requirement; catalog: readonly Component[] }) {
  const analysis = useMemo(() => analyseRequirement(requirement), [requirement]);
  const filter = useMemo(() => filterEquipment(analysis, catalog), [analysis, catalog]);
  const solutions = useMemo(() => buildSolutionLevels(analysis, filter, catalog), [analysis, filter, catalog]);

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
  return (
    <>
      <SolutionPanel solutions={solutions} requirementLine={parts.join(' · ')} ready={ready} />
      <EquipmentPanel filter={filter} catalogEmpty={catalog.length === 0} />
    </>
  );
}
