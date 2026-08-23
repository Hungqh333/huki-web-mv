import { getTranslations } from 'next-intl/server';
import type { UserRole } from '@/lib/auth';

const ROLE_STYLES: Record<UserRole, string> = {
  registered: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  member: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  vip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
};

export async function RoleBadge({ role }: { role: UserRole }) {
  const t = await getTranslations('roles');

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[role]}`}
    >
      {t(role)}
    </span>
  );
}
