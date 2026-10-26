'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { importFrontFocalAction, type FrontFocalImportResult } from '@/app/actions/frontFocal';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

/**
 * Nhập sF hàng loạt cho ống kính (chốt 2026-10-26 Q2) — dán CSV hoặc chọn file; mỗi dòng một ống.
 * Cột: ma (mã hoặc model) + sf_mm, hoặc wd_mm + beta, hoặc wd_mm + fov_mm + sensor_mm.
 */
export function FrontFocalImport() {
  const t = useTranslations('admin.components.frontFocalImport');
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FrontFocalImportResult | null>(null);

  const run = async () => {
    setBusy(true);
    const r = await importFrontFocalAction(text);
    setResult(r);
    setBusy(false);
    if ('updated' in r && r.updated.length > 0) router.refresh();
  };

  return (
    <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">{t('title')}</summary>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('hint')}</p>
      <pre className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t('example')}</pre>
      <div className="mt-3 space-y-2">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => setText((await e.target.files?.[0]?.text()) ?? '')} className="text-sm" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="ma,sf_mm" className={inputClass} />
        <button
          type="button"
          disabled={busy || text.trim() === ''}
          onClick={run}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {busy ? t('running') : t('start')}
        </button>
      </div>
      {result ? (
        'error' in result ? (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {t(`errors.${result.error}`)}
          </p>
        ) : (
          <div className="mt-3 text-sm">
            <p className="font-medium text-slate-800 dark:text-slate-100">{t('done', { ok: result.updated.length, skipped: result.skipped.length })}</p>
            {result.updated.length > 0 ? (
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-emerald-800 dark:text-emerald-300">
                {result.updated.map((u) => (
                  <li key={`${u.line}-${u.code}`}>
                    {u.code}: sF = {u.sF} mm
                  </li>
                ))}
              </ul>
            ) : null}
            {result.skipped.length > 0 ? (
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-amber-800 dark:text-amber-300">
                {result.skipped.map((s) => (
                  <li key={`${s.line}-${s.key}`}>{t('skippedLine', { line: s.line, key: s.key ?? '—', reason: t(`reasons.${s.reason}`) })}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : null}
    </details>
  );
}
