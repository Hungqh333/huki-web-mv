'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { updateProfileAction, type AuthFormState } from '@/app/actions/auth';
import { Field, FormMessage, SubmitButton } from '@/components/ui/Field';

type ProfileFormProps = {
  name: string | null;
  company: string | null;
};

export function ProfileForm({ name, company }: ProfileFormProps) {
  const t = useTranslations('auth.account');
  const tField = useTranslations('auth.fields');
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    updateProfileAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error} notice={state.notice} />

      <Field label={tField('name')} name="name" type="text" defaultValue={name ?? ''} />
      <Field label={tField('company')} name="company" type="text" defaultValue={company ?? ''} />

      <div className="sm:w-40">
        <SubmitButton label={pending ? t('saving') : t('save')} pending={pending} />
      </div>
    </form>
  );
}
