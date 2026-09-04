import { getTranslations } from 'next-intl/server';
import type { UserRole } from '@/lib/auth';

const ROLE_STYLES: Record<UserRole, string> = {
  registered: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  member: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  vip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
};

const ROLE_DOT: Record<UserRole, string> = {
  registered: 'bg-slate-400',
  member: 'bg-sky-500',
  vip: 'bg-amber-500',
  admin: 'bg-purple-500',
};

export async function RoleBadge({ role }: { role: UserRole }) {
  const t = await getTranslations('roles');

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[role]}`}
    >
      <span className={`size-1.5 rounded-full ${ROLE_DOT[role]}`} aria-hidden="true" />
      {t(role)}
    </span>
  );
}
