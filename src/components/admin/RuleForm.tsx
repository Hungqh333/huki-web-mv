'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminField } from './AdminField';
import { saveRuleAction, type AdminState } from '@/app/actions/admin';
import { validateCondition } from '@/lib/selector/conditions';
import type { SolutionApproach } from '@/lib/selector/types';

const APPROACHES: SolutionApproach[] = ['rule_based', 'hybrid', 'deep_learning'];

export type RuleDraft = {
  id: string | null;
  code: string;
  task_type_id: string;
  condition_json: string;
  recommended_camera: string;
  recommended_lighting: string;
  recommended_lens: string;
  ai_or_rule_based: SolutionApproach;
  notes_vi: string;
  notes_en: string;
  priority: number;
  is_active: boolean;
};

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function RuleForm({
  draft,
  taskTypes,
  knownFields,
}: {
  draft: RuleDraft;
  taskTypes: { id: string; name_vi: string }[];
  knownFields: string[];
}) {
  const t = useTranslations('admin.rules');
  const tApproach = useTranslations('selector.approach');
  const [state, formAction, pending] = useActionState<AdminState, FormData>(saveRuleAction, {});
  const [condition, setCondition] = useState(draft.condition_json);

  // Kiểm tra ngay khi gõ để admin thấy lỗi trước lúc bấm lưu.
  // Server vẫn kiểm lại lần nữa — đây chỉ là tiện lợi, không phải chốt chặn.
  const localProblems = (() => {
    if (condition.trim() === '') return [];
    try {
      const parsed = JSON.parse(condition);
      const problems = validateCondition(parsed);
      const used: string[] = Array.isArray(parsed?.all)
        ? parsed.all
            .map((p: { field?: unknown }) => (typeof p?.field === 'string' ? p.field : null))
            .filter((f: string | null): f is string => f !== null)
        : [];
      const unknown = used.filter((field) => !knownFields.includes(field));
      if (unknown.length > 0) problems.push(t('unknownFields', { fields: unknown.join(', ') }));
      return problems;
    } catch {
      return [t('invalidJson')];
    }
  })();

  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="space-y-6">
      {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label={t('fieldCode')} hint={t('codeHint')}>
          <input name="code" defaultValue={draft.code} className={inputClass} />
        </AdminField>

        <AdminField label={t('fieldTaskType')} error={err('task_type_id')}>
          <select name="task_type_id" defaultValue={draft.task_type_id} className={inputClass}>
            {taskTypes.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name_vi}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField label={t('fieldPriority')} error={err('priority')} hint={t('priorityHint')}>
          <input
            name="priority"
            type="number"
            min={0}
            step={1}
            defaultValue={draft.priority}
            className={inputClass}
          />
        </AdminField>

        <AdminField label={t('fieldApproach')} error={err('ai_or_rule_based')}>
          <select
            name="ai_or_rule_based"
            defaultValue={draft.ai_or_rule_based}
            className={inputClass}
          >
            {APPROACHES.map((approach) => (
              <option key={approach} value={approach}>
                {tApproach(approach)}
              </option>
            ))}
          </select>
        </AdminField>
      </div>

      <AdminField label={t('fieldCondition')} error={err('condition_json')} hint={t('conditionHint')}>
        <textarea
          name="condition_json"
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          rows={6}
          spellCheck={false}
          className={`${inputClass} font-mono text-xs`}
        />
      </AdminField>

      {localProblems.length > 0 ? (
        <ul className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {localProblems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : condition.trim() !== '' ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('conditionOk')}</p>
      ) : null}

      <details className="rounded-md border border-slate-200 p-3 text-xs dark:border-slate-800">
        <summary className="cursor-pointer font-medium">{t('fieldsHelpTitle')}</summary>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('fieldsHelpBody')}</p>
        <p className="mt-2 font-mono text-slate-500 dark:text-slate-400">{knownFields.join(', ')}</p>
      </details>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField label={t('fieldCamera')}>
          <input name="recommended_camera" defaultValue={draft.recommended_camera} className={inputClass} />
        </AdminField>
        <AdminField label={t('fieldLighting')}>
          <input name="recommended_lighting" defaultValue={draft.recommended_lighting} className={inputClass} />
        </AdminField>
        <AdminField label={t('fieldLens')}>
          <input name="recommended_lens" defaultValue={draft.recommended_lens} className={inputClass} />
        </AdminField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label={t('fieldNotesVi')}>
          <textarea name="notes_vi" rows={4} defaultValue={draft.notes_vi} className={inputClass} />
        </AdminField>
        <AdminField label={t('fieldNotesEn')}>
          <textarea name="notes_en" rows={4} defaultValue={draft.notes_en} className={inputClass} />
        </AdminField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={draft.is_active}
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
        />
        {t('activeLabel')}
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? t('saving') : t('save')}
        </button>
        <Link
          href="/admin/luat-goi-y"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('cancel')}
        </Link>
      </div>
    </form>
  );
}

