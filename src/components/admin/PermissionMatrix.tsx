import { getFormatter, getTranslations } from 'next-intl/server';
import { FeatureLevelSelect } from '@/components/admin/FeatureLevelSelect';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { loadFeatureLevels } from '@/lib/featureAccess';
import { FEATURE_KEYS, PERMISSION_GROUPS, PERMISSION_ROLES, roleAtLeast, type FeatureKey, type PermissionRole } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

const PANEL = 'mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const MUTED = 'text-xs text-slate-400 dark:text-slate-500';

type LogRow = { id: number; feature: string; old_min_role: string | null; new_min_role: string; actor_id: string | null; changed_at: string };

const isFeature = (key: string): key is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(key);

/** 10 lần đổi quyền gần nhất + email người đổi (RLS: chỉ Admin đọc). Lỗi / chưa dán SQL → rỗng. */
async function loadRecentChanges(): Promise<{ rows: LogRow[]; emails: Map<string, string> }> {
  const empty = { rows: [], emails: new Map<string, string>() };
  if (!hasSupabaseEnv()) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permission_log')
    .select('id, feature, old_min_role, new_min_role, actor_id, changed_at')
    .order('changed_at', { ascending: false })
    .limit(10);
  if (error || !data) return empty;
  const rows = data as LogRow[];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from('profiles').select('id, email').in('id', ids);
    for (const p of (people ?? []) as { id: string; email: string }[]) emails.set(p.id, p.email);
  }
  return { rows, emails };
}

/**
 * Bảng quyền theo vai trò (chốt 2026-11-07). 8 nhóm có ô chọn mức tối thiểu — đọc / ghi bảng
 * role_permissions, cùng nguồn với RLS has_feature(); các dòng khoá ghi lý do.
 * `preview`: trang xem trước local (/dev/quyen) — ô chọn chỉ đổi trên màn hình, không lưu, không có lịch sử.
 */
export async function PermissionMatrix({ preview = false }: { preview?: boolean }) {
  const t = await getTranslations('admin.permissions');
  const tRoles = await getTranslations('roles');
  const format = await getFormatter();
  const roleName = (role: PermissionRole) => (role === 'guest' ? t('guest') : tRoles(role));
  const levels = await loadFeatureLevels();
  const history = preview ? null : await loadRecentChanges();

  return (
    <section className={PANEL}>
      <PanelHeader title={t('title')} meta={t('meta')} />
      <p className={`px-4 pt-3 ${MUTED} sm:px-5`}>{t('intro')}</p>
      <div className="overflow-x-auto px-4 pb-4 pt-2 sm:px-5">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" className="py-2 pr-3">{t('colFeature')}</th>
              {PERMISSION_ROLES.map((role) => (
                <th key={role} scope="col" className="w-24 px-2 py-2 text-center">
                  {roleName(role)}
                </th>
              ))}
              <th scope="col" className="py-2 pl-3">{t('colEdit')}</th>
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((group) => (
            <tbody key={group.key} className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <th colSpan={PERMISSION_ROLES.length + 2} scope="colgroup" className="pb-1 pt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t(`groups.${group.key}`)}
                </th>
              </tr>
              {group.rows.map((row) => {
                const label = t(`rows.${row.key}` as 'rows.account');
                // Nhóm sửa được: mức đang lưu trong database; dòng khoá: mức cố định.
                const min = row.lock === null && isFeature(row.key) ? levels[row.key] : row.min;
                return (
                  <tr key={row.key}>
                    <td className="py-2 pr-3">{label}</td>
                    {PERMISSION_ROLES.map((role) => (
                      <td key={role} className="px-2 py-2 text-center">
                        {roleAtLeast(role, min) ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400" aria-label={t('yes')}>
                            ✓
                          </span>
                        ) : row.teaser ? (
                          <span className={MUTED}>{t('teaser')}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600" aria-label={t('no')}>
                            —
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="py-2 pl-3">
                      {row.lock === null && isFeature(row.key) ? (
                        <FeatureLevelSelect key={`${row.key}-${levels[row.key]}`} feature={row.key} level={levels[row.key]} featureLabel={label} preview={preview} />
                      ) : (
                        <span className={MUTED}>{t(`locks.${row.lock ?? 'account'}`)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
        <p className={`mt-3 ${MUTED}`}>{t('footnote')}</p>

        {history ? (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('historyTitle')}</p>
            {history.rows.length === 0 ? (
              <p className={`mt-1 ${MUTED}`}>{t('historyEmpty')}</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                {history.rows.map((r) => (
                  <li key={r.id}>
                    <span className="tabular-nums text-slate-400 dark:text-slate-500">
                      {format.dateTime(new Date(r.changed_at), { dateStyle: 'short', timeStyle: 'short' })}
                    </span>{' '}
                    {t('historyLine', {
                      feature: isFeature(r.feature) ? t(`rows.${r.feature}`) : r.feature,
                      from: r.old_min_role ? tRoles(r.old_min_role as 'member') : '—',
                      to: tRoles(r.new_min_role as 'member'),
                      who: r.actor_id ? (history.emails.get(r.actor_id) ?? t('unknownActor')) : t('sqlActor'),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
