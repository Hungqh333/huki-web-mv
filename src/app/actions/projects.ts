'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { parseDraft, type RequirementDraft } from '@/lib/requirement/draft';
import {
  PROJECTS_ROUTE,
  PROJECT_NAME_MAX,
  buildRevisionPayload,
  normalizeProjectName,
  type RevisionPayload,
} from '@/lib/projects/model';
import type { Component } from '@/lib/components/specs';
import { createClient } from '@/lib/supabase/server';
import { RULESET_VERSION, bomForRequirement, type BomSnapshot } from '@/lib/vision/bom';

/**
 * Lưu bảng tóm tắt yêu cầu thành dự án (V1a hạng mục 7).
 *
 * Chặn ở đây cho thông báo dễ hiểu. Chặn thật nằm ở RLS + hàm SQL chạy quyền
 * người gọi: không phải Member trở lên, hoặc revision không phải của mình /
 * đã khoá, thì database từ chối dù gọi thẳng REST API.
 *
 * Bản nháp gửi lên là chuỗi JSON và được kiểm lại bằng parseDraft; giả định tính
 * lại ở server, không tin danh sách giả định từ trình duyệt.
 */

export type SavedProjectLink = { id: string; name: string; revisionId: string; revLabel: string };

export type ProjectActionResult =
  | { ok: true; project: SavedProjectLink; lockedLabel?: string }
  | { ok: false; error: string };

type ProjectActionInput = { draftJson: string; name: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Translate = Awaited<ReturnType<typeof getTranslations<'projects.errors'>>>;

type Prepared =
  | { ok: false; error: string }
  | { ok: true; t: Translate; supabase: Supabase; draft: RequirementDraft; payload: RevisionPayload; name: string; bom: BomSnapshot | null };

async function prepare(input: ProjectActionInput): Promise<Prepared> {
  const t = await getTranslations('projects.errors');

  const session = await getSessionContext();
  if (!session) return { ok: false, error: t('notSignedIn') };
  if (!canUseSelector(session.profile?.role)) return { ok: false, error: t('notAllowed') };

  const draft = typeof input?.draftJson === 'string' ? parseDraft(input.draftJson) : null;
  if (!draft) return { ok: false, error: t('invalidDraft') };

  const payload = buildRevisionPayload(draft);
  if (!payload) return { ok: false, error: t('pickApplication') };

  const name = normalizeProjectName(input.name);
  if (!name) return { ok: false, error: t('nameRequired', { max: PROJECT_NAME_MAX }) };

  const supabase = await createClient();

  /* BOM (V1c C5): dựng lại ở server từ kho thật theo LỰA CHỌN trong bản nháp —
     giá, thời gian giao, nhà cung cấp chụp lại tại lúc lưu. RLS chỉ trả kho
     cho Member+, đúng quyền của hành động này. */
  let bom: BomSnapshot | null = null;
  if (draft.bom && draft.requirement) {
    const { data: catalog } = await supabase
      .from('components')
      .select('id, code, kind, brand, model, spec, price_vnd, lead_time_days, supplier, used_in_projects, datasheet_url, source, notes_vi, notes_en, is_active, sort_order')
      .eq('is_active', true);
    bom = bomForRequirement(draft.requirement, (catalog ?? []) as Component[], draft.bom);
  }

  return { ok: true, t, supabase, draft, payload, name, bom };
}

/** Mã lỗi Postgres → câu dễ hiểu. Chi tiết kỹ thuật chỉ ghi log phía server. */
function describeError(t: Translate, error: { code?: string; message?: string }): string {
  console.error('[projects]', error.code, error.message);
  if (error.code === 'P0002') return t('notEditable');
  if (error.code === '42501') return t('notAllowed');
  return t('saveFailed');
}

async function saveOpenRevision(
  prepared: Extract<Prepared, { ok: true }>,
  revisionId: string
): Promise<{ code?: string; message?: string } | null> {
  const { supabase, payload, name } = prepared;
  const { error } = await supabase.rpc('save_revision', {
    p_revision_id: revisionId,
    p_name: name,
    p_application_type: payload.applicationType,
    p_requirement: payload.requirement,
    p_assumptions: payload.assumptions,
    p_raw_text: payload.rawText,
    p_schema_version: payload.schemaVersion,
    p_bom: prepared.bom,
    p_rule_version: RULESET_VERSION,
  });
  return error;
}

function revalidateProject(id: string) {
  revalidatePath(PROJECTS_ROUTE);
  revalidatePath(`${PROJECTS_ROUTE}/${id}`);
}

/** Bản nháp chưa gắn dự án → tạo dự án + Rev A. Đã gắn → ghi đè revision đang sửa. */
export async function saveProjectAction(input: ProjectActionInput): Promise<ProjectActionResult> {
  const prepared = await prepare(input);
  if (!prepared.ok) return prepared;
  const { t, supabase, draft, payload, name } = prepared;

  const link = draft.project;
  if (link) {
    if (link.locked) return { ok: false, error: t('notEditable') };
    const error = await saveOpenRevision(prepared, link.revisionId);
    if (error) return { ok: false, error: describeError(t, error) };
    revalidateProject(link.id);
    return { ok: true, project: { id: link.id, name, revisionId: link.revisionId, revLabel: link.revLabel } };
  }

  const { data, error } = await supabase
    .rpc('create_project', {
      p_name: name,
      p_application_type: payload.applicationType,
      p_requirement: payload.requirement,
      p_assumptions: payload.assumptions,
      p_raw_text: payload.rawText,
      p_schema_version: payload.schemaVersion,
      p_bom: prepared.bom,
      p_rule_version: RULESET_VERSION,
    })
    .single<{ new_project_id: string; new_revision_id: string; new_rev_label: string }>();

  if (error || !data) return { ok: false, error: describeError(t, error ?? {}) };
  revalidateProject(data.new_project_id);
  return {
    ok: true,
    project: { id: data.new_project_id, name, revisionId: data.new_revision_id, revLabel: data.new_rev_label },
  };
}

/**
 * Lưu nội dung hiện tại vào revision đang sửa, rồi khoá nó và mở revision kế
 * tiếp (A → B). Khoá + mở là một transaction trong start_next_revision.
 */
export async function startNextRevisionAction(input: ProjectActionInput): Promise<ProjectActionResult> {
  const prepared = await prepare(input);
  if (!prepared.ok) return prepared;
  const { t, supabase, draft, name } = prepared;

  const link = draft.project;
  if (!link || link.locked) return { ok: false, error: t('notEditable') };

  const saveError = await saveOpenRevision(prepared, link.revisionId);
  if (saveError) return { ok: false, error: describeError(t, saveError) };

  const { data, error } = await supabase
    .rpc('start_next_revision', { p_project_id: link.id })
    .single<{ new_revision_id: string; new_rev_label: string; locked_rev_label: string }>();

  if (error || !data) return { ok: false, error: describeError(t, error ?? {}) };
  revalidateProject(link.id);
  return {
    ok: true,
    project: { id: link.id, name, revisionId: data.new_revision_id, revLabel: data.new_rev_label },
    lockedLabel: data.locked_rev_label,
  };
}
