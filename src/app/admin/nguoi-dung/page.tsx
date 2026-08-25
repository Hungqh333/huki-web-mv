import { getFormatter, getTranslations } from 'next-intl/server';
import { RoleSelect } from '@/components/admin/RoleSelect';
import { getSessionContext, type Profile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function AdminUsersPage() {
  const t = await getTranslations('admin.users');
  const format = await getFormatter();

  const session = await getSessionContext();
  const supabase = await createClient();

  // RLS cho phép admin đọc toàn bộ profiles (policy profiles_select_own_or_admin).
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, company, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  const users = (data ?? []) as Profile[];

  return (
    <section>
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error.message}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colEmail')}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colName')}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colCompany')}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{t('colCreated')}</th>
              <th scope="col" className="py-2 font-medium">{t('colRole')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="py-3 pr-4">{user.email}</td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{user.name ?? '—'}</td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                  {user.company ?? '—'}
                </td>
                <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                  {format.dateTime(new Date(user.created_at), { dateStyle: 'short' })}
                </td>
                <td className="py-3">
                  <RoleSelect
                    userId={user.id}
                    role={user.role}
                    isSelf={user.id === session?.user.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
        ) : null}
      </div>
    </section>
  );
}
