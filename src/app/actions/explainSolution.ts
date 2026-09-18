'use server';

import { getLocale, getTranslations } from 'next-intl/server';
import { explainFacts, explainerConfigured } from '@/lib/ai/explainer';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import type { Component } from '@/lib/components/specs';
import { DRAFT_VERSION, parseDraft } from '@/lib/requirement/draft';
import { safeParseCode } from '@/lib/requirement/parseResult';
import { createClient } from '@/lib/supabase/server';
import { filterEquipment } from '@/lib/vision/equipmentFilter';
import { analyseRequirement } from '@/lib/vision/requirementAnalysis';
import { SOLUTION_LEVELS, buildSolutionLevels, type SolutionLevelKey } from '@/lib/vision/solutionLevels';
import { buildWhyFacts, whyFactsToText } from '@/lib/vision/whyFacts';

export type ExplainResult =
  | { status: 'ok'; paragraphs: string[] }
  | { status: 'denied' | 'unavailable' | 'invalid' | 'noSolution' }
  /** `detail` = mã lỗi ngắn hiện ra màn hình, như bộ đọc mô tả. */
  | { status: 'failed' | 'stray'; detail?: string };

/**
 * "Diễn giải bằng lời" cho một phương án — LLM điểm 2 (V1c C7, chốt Q4).
 *
 * Trình duyệt chỉ gửi bảng Yêu cầu + mức phương án. Server dựng lại phân tích, lọc
 * thiết bị và phương án từ kho thật, rồi dựng dữ kiện bằng CÙNG hàm với khối
 * hiển thị — không nhận dữ kiện hay chữ nào từ trình duyệt để gửi cho model.
 */
export async function explainSolutionAction(requirementJson: string, level: SolutionLevelKey): Promise<ExplainResult> {
  const session = await getSessionContext();
  if (!session || !canUseSelector(session.profile?.role)) return { status: 'denied' };
  if (!explainerConfigured()) return { status: 'unavailable' };

  const draft = typeof requirementJson === 'string' ? parseDraft(asDraft(requirementJson)) : null;
  if (!draft?.requirement || !SOLUTION_LEVELS.some((l) => l.key === level)) return { status: 'invalid' };

  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from('components')
    .select('id, code, kind, brand, model, spec, price_vnd, lead_time_days, supplier, used_in_projects, datasheet_url, source, notes_vi, notes_en, is_active, sort_order')
    .eq('is_active', true)
    .order('kind')
    .order('sort_order');
  const components = (catalog ?? []) as Component[];

  const analysis = analyseRequirement(draft.requirement);
  const solutions = buildSolutionLevels(analysis, filterEquipment(analysis, components), components);
  const chosen = solutions.levels.find((l) => l.key === level);

  const locale = await getLocale();
  const translate = await getTranslations();
  const t = (key: string, values?: Record<string, string | number>) => translate(key as never, values as never);
  const facts = chosen ? buildWhyFacts({ analysis, level: chosen, locale, t }) : null;
  if (!facts) return { status: 'noSolution' };

  const factsText = whyFactsToText(facts, (status) => t(`selector.vision.status.${status}`));
  const outcome = await explainFacts(factsText, locale);

  // Log vận hành: không ghi dữ kiện hay đoạn văn — chỉ kết quả, model, token.
  console.info(
    '[explainer]',
    JSON.stringify({
      ok: outcome.ok,
      reason: outcome.ok ? undefined : outcome.reason,
      detail: outcome.ok ? undefined : outcome.detail,
      model: outcome.model,
      usage: outcome.usage,
      chars: factsText.length,
    })
  );

  if (outcome.ok) return { status: 'ok', paragraphs: outcome.paragraphs };
  const detail = safeParseCode(`${outcome.detail ?? outcome.reason} · ${outcome.model}`);
  return { status: outcome.reason === 'stray' ? 'stray' : 'failed', detail };
}

/** Bọc bảng Yêu cầu thành bản nháp để kiểm bằng đúng parseDraft (cùng phép kiểm khi lưu dự án). */
function asDraft(requirementJson: string): string | null {
  try {
    return JSON.stringify({ version: DRAFT_VERSION, startedFrom: 'manual', rawText: null, revision: 0, requirement: JSON.parse(requirementJson) });
  } catch {
    return null;
  }
}
