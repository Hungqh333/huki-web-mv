'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signUpAction, type AuthFormState } from '@/app/actions/auth';
import { Field, FormMessage, SubmitButton } from '@/components/ui/Field';

export function SignUpForm() {
  const t = useTranslations('auth.signUp');
  const tField = useTranslations('auth.fields');
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error} notice={state.notice} />

      <Field label={tField('name')} name="name" type="text" autoComplete="name" />
      <Field label={tField('company')} name="company" type="text" autoComplete="organization" />
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
        autoComplete="new-password"
        required
        minLength={8}
        hint={tField('passwordHint')}
      />
      <Field
        label={tField('confirmPassword')}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />

      <SubmitButton label={pending ? t('submitting') : t('submit')} pending={pending} />
    </form>
  );
}
