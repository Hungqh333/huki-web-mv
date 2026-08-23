'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signInAction, type AuthFormState } from '@/app/actions/auth';
import { Field, FormMessage, SubmitButton } from '@/components/ui/Field';

export function SignInForm({ initialError }: { initialError?: string }) {
  const t = useTranslations('auth.signIn');
  const tField = useTranslations('auth.fields');
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error ?? initialError} notice={state.notice} />

      <Field
        label={tField('email')}
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="ten@congty.com"
      />
      <Field
        label={tField('password')}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <SubmitButton label={pending ? t('submitting') : t('submit')} pending={pending} />
    </form>
  );
}
