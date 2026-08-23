import { getTranslations } from 'next-intl/server';
import { signOutAction } from '@/app/actions/auth';

export async function SignOutButton({ className }: { className?: string }) {
  const t = await getTranslations('nav');

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={
          className ??
          'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
        }
      >
        {t('signOut')}
      </button>
    </form>
  );
}
