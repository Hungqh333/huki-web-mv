import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { SupabaseNotConfigured } from '@/components/auth/SupabaseNotConfigured';
import { getSessionContext } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default async function SignUpPage() {
  const t = await getTranslations('auth.signUp');

  if (!hasSupabaseEnv()) return <SupabaseNotConfigured />;

  const session = await getSessionContext();
  if (session) redirect('/tai-khoan');

  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-8">
        <SignUpForm />
      </div>

      <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        {t('roleNotice')}
      </p>

      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        {t('haveAccount')}{' '}
        <Link href="/dang-nhap" className="font-medium text-sky-700 hover:underline dark:text-sky-400">
          {t('goToSignIn')}
        </Link>
      </p>
    </section>
  );
}
