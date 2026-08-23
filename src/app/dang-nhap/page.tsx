import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SignInForm } from '@/components/auth/SignInForm';
import { SupabaseNotConfigured } from '@/components/auth/SupabaseNotConfigured';
import { getSessionContext } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default async function SignInPage({ searchParams }: PageProps<'/dang-nhap'>) {
  const t = await getTranslations('auth.signIn');
  const tErrors = await getTranslations('auth.errors');

  if (!hasSupabaseEnv()) return <SupabaseNotConfigured />;

  const session = await getSessionContext();
  if (session) redirect('/tai-khoan');

  const { error } = await searchParams;

  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <div className="mt-8">
        <SignInForm initialError={error === 'auth_callback' ? tErrors('callbackFailed') : undefined} />
      </div>

      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        {t('noAccount')}{' '}
        <Link href="/dang-ky" className="font-medium text-sky-700 hover:underline dark:text-sky-400">
          {t('goToSignUp')}
        </Link>
      </p>
    </section>
  );
}
