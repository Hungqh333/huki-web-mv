import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { SupabaseNotConfigured } from '@/components/auth/SupabaseNotConfigured';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { PROJECTS_ROUTE, type ProjectStatus } from '@/lib/projects/model';
import { isApplicationType } from '@/lib/requirement/draft';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

type ProjectListRow = {
  id: string;
  name: string;
  application_type: string;
  status: ProjectStatus;
  updated_at: string;
  project_revisions: { rev_label: string; locked_at: string | null; created_at: string }[];
};

/**
 * Danh sách dự án của người dùng (V1a hạng mục 7).
 *
 * Quyền: Member trở lên, giống bước Yêu cầu. RLS chỉ trả dự án của chính mình
 * (admin đọc được mọi dự án, nên lọc thêm theo user để trang này luôn là "của tôi").
 */
export default async function ProjectsPage() {
  if (!hasSupabaseEnv()) return <SupabaseNotConfigured />;

  const session = await getSessionContext();
  if (!session) redirect('/dang-nhap');
  if (!canUseSelector(session.profile?.role ?? null)) redirect('/cong-cu-chon-thiet-bi');

  const t = await getTranslations('projects');
  const tApps = await getTranslations('home.entry.apps');
  const format = await getFormatter();

  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, name, application_type, status, updated_at, project_revisions(rev_label, locked_at, created_at)')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });
  const projects = (data ?? []) as unknown as ProjectListRow[];

  const currentLabel = (row: ProjectListRow) => {
    const open = row.project_revisions.find((rev) => rev.locked_at === null);
    if (open) return open.rev_label;
    const latest = [...row.project_revisions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return latest?.rev_label ?? null;
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('list.title')}</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">{t('list.subtitle')}</p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          {t('list.newProject')}
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {t('list.empty')}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t('list.columns.name')}</th>
                <th scope="col" className="w-48 px-4 py-3 font-semibold">{t('list.columns.application')}</th>
                <th scope="col" className="w-32 px-4 py-3 font-semibold">{t('list.columns.status')}</th>
                <th scope="col" className="w-28 px-4 py-3 font-semibold">{t('list.columns.revision')}</th>
                <th scope="col" className="w-44 px-4 py-3 font-semibold">{t('list.columns.updated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.map((row) => {
                const label = currentLabel(row);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`${PROJECTS_ROUTE}/${row.id}`}
                        className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {isApplicationType(row.application_type) ? tApps(`${row.application_type}.title`) : row.application_type}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t(`status.${row.status}`)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {label ? t('list.currentRevision', { label }) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                      {format.dateTime(new Date(row.updated_at), { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
