'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { locales, type Locale } from '@/i18n/config';
import { setUserLocale } from '@/i18n/locale';

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value as Locale;
          startTransition(() => {
            setUserLocale(next);
          });
        }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {t(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
