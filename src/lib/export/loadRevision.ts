import 'server-only';

import { getFormatter, getTranslations } from 'next-intl/server';
import { canUseSelector, getSessionContext, hasAdvancedFeatures } from '@/lib/auth';
import { revisionToDraft } from '@/lib/projects/model';
import { createClient } from '@/lib/supabase/server';
import type { BomSnapshot } from '@/lib/vision/bom';
import { buildConceptDocument, type ConceptDocument, type Translate } from './conceptDocument';

/**
 * Đọc MỘT revision đã lưu để xuất (V1c C6) — dùng chung cho route Excel và PDF.
 *
 * Bảo mật: đọc lại từ database theo id, không nhận nội dung từ trình duyệt. RLS
 * chỉ trả dự án của chính người đang đăng nhập (và admin), nên đoán id cũng
 * không lấy được file của người khác. Quyền theo định dạng: Excel Member+,
 * PDF VIP+ (chốt Q5).
 */

export type LoadResult =
  | { ok: true; doc: ConceptDocument; t: Translate; fileStem: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

type ProjectRow = { id: string; name: string };
type RevisionRow = {
  id: string;
  rev_label: string;
  requirement: unknown;
  raw_text: string | null;
  schema_version: number;
  locked_at: string | null;
  updated_at: string;
  bom: unknown;
  rule_version: string | null;
};

const isSnapshot = (value: unknown): value is BomSnapshot =>
  !!value && typeof value === 'object' && (value as BomSnapshot).version === 1 && Array.isArray((value as BomSnapshot).lines);

export async function loadRevisionForExport(projectId: string, revisionId: string, format: 'xlsx' | 'pdf'): Promise<LoadResult> {
  const session = await getSessionContext();
  if (!session) return { ok: false, status: 401, error: 'unauthenticated' };
  const role = session.profile?.role;
  if (format === 'pdf' ? !hasAdvancedFeatures(role) : !canUseSelector(role)) {
    return { ok: false, status: 403, error: format === 'pdf' ? 'vip_required' : 'member_required' };
  }

  const supabase = await createClient();
  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle<ProjectRow>();
  if (!project) return { ok: false, status: 404, error: 'not_found' };

  const { data: row } = await supabase
    .from('project_revisions')
    .select('id, rev_label, requirement, raw_text, schema_version, locked_at, updated_at, bom, rule_version')
    .eq('id', revisionId)
    .eq('project_id', projectId)
    .maybeSingle<RevisionRow>();
  if (!row) return { ok: false, status: 404, error: 'not_found' };

  // Đi qua đúng đường mở revision trên giao diện: schema cũ được chuyển đổi.
  const draft = revisionToDraft(project, row);
  if (!draft?.requirement) return { ok: false, status: 404, error: 'unreadable' };

  const translate = await getTranslations();
  const t: Translate = (key, values) => translate(key as never, values as never);
  const formatter = await getFormatter();

  const doc = buildConceptDocument({
    projectName: project.name,
    revision: {
      rev_label: row.rev_label,
      requirement: draft.requirement,
      bom: isSnapshot(row.bom) ? row.bom : null,
      rule_version: row.rule_version,
      locked_at: row.locked_at,
      updated_at: row.updated_at,
    },
    author: session.profile?.email ?? session.user.email ?? '',
    now: new Date(),
    formatDate: (date) => formatter.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' }),
    t,
  });

  // Tên file chỉ ký tự an toàn: tên dự án có dấu tiếng Việt, khoảng trắng.
  const slug = project.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'du-an';
  return { ok: true, doc, t, fileStem: `${slug}-rev-${row.rev_label}` };
}
