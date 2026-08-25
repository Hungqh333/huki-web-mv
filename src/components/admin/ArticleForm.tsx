'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { saveArticleAction, type AdminState } from '@/app/actions/admin';
import { RichTextEditor } from './RichTextEditor';
import type { AccessTier } from '@/lib/auth';

const TIERS: AccessTier[] = ['public', 'registered', 'member', 'vip'];

export type ArticleDraft = {
  id: string | null;
  slug: string;
  title_vi: string;
  title_en: string;
  content_vi: string;
  content_en: string;
  category_id: string | null;
  access_tier: AccessTier;
  cover_image: string | null;
  published: boolean;
};

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function ArticleForm({
  draft,
  categories,
}: {
  draft: ArticleDraft;
  categories: { id: string; name_vi: string }[];
}) {
  const t = useTranslations('admin.articles');
  const tTiers = useTranslations('handbook.tiers');
  const [state, formAction, pending] = useActionState<AdminState, FormData>(saveArticleAction, {});

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
        <Field label={t('fieldSlug')} error={err('slug')} hint={t('slugHint')}>
          <input name="slug" defaultValue={draft.slug} required className={inputClass} />
        </Field>

        <Field label={t('fieldTier')} error={err('access_tier')}>
          <select name="access_tier" defaultValue={draft.access_tier} className={inputClass}>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tTiers(tier)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fieldTitleVi')} error={err('title_vi')}>
          <input name="title_vi" defaultValue={draft.title_vi} required className={inputClass} />
        </Field>

        <Field label={t('fieldTitleEn')} error={err('title_en')}>
          <input name="title_en" defaultValue={draft.title_en} required className={inputClass} />
        </Field>

        <Field label={t('fieldCategory')}>
          <select name="category_id" defaultValue={draft.category_id ?? ''} className={inputClass}>
            <option value="">—</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name_vi}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fieldCover')}>
          <input name="cover_image" defaultValue={draft.cover_image ?? ''} className={inputClass} />
        </Field>
      </div>

      <RichTextEditor name="content_vi" label={t('fieldContentVi')} defaultValue={draft.content_vi} />
      <RichTextEditor name="content_en" label={t('fieldContentEn')} defaultValue={draft.content_en} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="publish"
          defaultChecked={draft.published}
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
        />
        {t('publishLabel')}
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
          href="/admin/bai-viet"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('cancel')}
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {children}
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
