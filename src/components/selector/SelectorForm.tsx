'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { runSelectorAction, type SelectorState } from '@/app/actions/selector';
import type { FieldDef } from '@/lib/selector/fields';
import { SelectorField } from './SelectorField';
import { SelectorResultPanel } from './SelectorResultPanel';

export function SelectorForm({
  taskSlug,
  fields,
  canExport,
}: {
  taskSlug: string;
  fields: FieldDef[];
  canExport: boolean;
}) {
  const t = useTranslations('selector.form');
  const [state, formAction, pending] = useActionState<SelectorState, FormData>(
    runSelectorAction,
    {}
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="task_slug" value={taskSlug} />

        {state.error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        {fields.map((def) => (
          <SelectorField
            key={def.key}
            def={def}
            error={state.fieldErrors?.[def.key]}
            defaultValue={state.input?.[def.key]}
          />
        ))}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? t('submitting') : t('submit')}
        </button>
      </form>

      <div>
        {state.result ? (
          <SelectorResultPanel
            result={state.result}
            historySaved={state.historySaved}
            canExport={canExport}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('emptyState')}
          </p>
        )}
      </div>
    </div>
  );
}
