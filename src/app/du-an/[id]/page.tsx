import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ExportLinks } from '@/components/projects/ExportLinks';
import { OpenRevisionButton } from '@/components/projects/OpenRevisionButton';
import { SupabaseNotConfigured } from '@/components/auth/SupabaseNotConfigured';
import { canUseSelector, getSessionContext, hasAdvancedFeatures } from '@/lib/auth';
import { PROJECTS_ROUTE, revisionToDraft, type ProjectStatus, type RevisionRow } from '@/lib/projects/model';
import { isApplicationType } from '@/lib/requirement/draft';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProjectRow = {
  id: string;
  name: string;
  application_type: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

type RevisionListRow = RevisionRow & { created_at: string; updated_at: string };

/**
 * Một dự án và các revision của nó (V1a hạng mục 7).
 *
 * Mở revision = nạp nội dung đã lưu vào bản nháp rồi sang bước Yêu cầu.
 * Revision đã khoá mở ở chế độ chỉ xem. Không đọc được (RLS trả rỗng, id sai,
 * không phải của mình) → 404, không phân biệt để khỏi lộ dự án người khác.
 */
export default async function ProjectPage({ params }: PageProps<'/du-an/[id]'>) {
  if (!hasSupabaseEnv()) return <SupabaseNotConfigured />;

  const session = await getSessionContext();
  if (!session) redirect('/dang-nhap');
  if (!canUseSelector(session.profile?.role ?? null)) redirect('/cong-cu-chon-thiet-bi');

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, application_type, status, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle<ProjectRow>();
  if (!project) notFound();

  const { data: revisionData } = await supabase
    .from('project_revisions')
    .select('id, rev_label, requirement, raw_text, schema_version, locked_at, bom, created_at, updated_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });
  const revisions = (revisionData ?? []) as RevisionListRow[];

  const t = await getTranslations('projects');
  const tApps = await getTranslations('home.entry.apps');
  const format = await getFormatter();
  const when = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href={PROJECTS_ROUTE}
        className="text-sm text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-400"
      >
        ← {t('detail.back')}
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">{project.name}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {isApplicationType(project.application_type) ? tApps(`${project.application_type}.title`) : project.application_type}
        {' · '}
        {t(`status.${project.status}`)}
      </p>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t('detail.revisions')}
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('detail.lockedHint')}</p>

      <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {revisions.map((revision) => {
          const draft = revisionToDraft(project, revision);
          const locked = revision.locked_at !== null;
          return (
            <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="tabular-nums">{t('list.currentRevision', { label: revision.rev_label })}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      locked
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
                    }`}
                  >
                    {locked ? t('detail.locked') : t('detail.editing')}
                  </span>
                </p>
                <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {locked
                    ? t('detail.lockedAt', { date: when(revision.locked_at!) })
                    : t('detail.updatedAt', { date: when(revision.updated_at) })}
                </p>
              </div>
              {draft ? (
                <OpenRevisionButton
                  draftJson={JSON.stringify(draft)}
                  label={locked ? t('detail.view') : t('detail.open')}
                />
              ) : (
                <p className="text-xs text-red-600 dark:text-red-400">{t('detail.unreadable')}</p>
              )}
              {draft ? (
                <div className="w-full">
                  <ExportLinks
                    projectId={project.id}
                    revisionId={revision.id}
                    canPdf={hasAdvancedFeatures(session.profile?.role ?? null)}
                    unsaved={false}
                    hasBom={revision.bom != null}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
