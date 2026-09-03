'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { updateUserRoleAction, type AdminState } from '@/app/actions/admin';
import type { UserRole } from '@/lib/auth';

const ROLES: UserRole[] = ['registered', 'member', 'vip', 'admin'];

export function RoleSelect({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: UserRole;
  isSelf: boolean;
}) {
  const t = useTranslations('admin.users');
  const tRoles = useTranslations('roles');
  const [state, formAction, pending] = useActionState<AdminState, FormData>(
    updateUserRoleAction,
    {}
  );

  if (isSelf) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400" title={t('selfHint')}>
        {tRoles(role)} · {t('self')}
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={pending}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {tRoles(option)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {pending ? t('saving') : t('save')}
      </button>
      {state.error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      ) : null}
      {state.notice ? (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">{state.notice}</span>
      ) : null}
    </form>
  );
}
