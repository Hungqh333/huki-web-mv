'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { uploadLightingSampleAction } from '@/app/actions/lightingSamples';
import { parseSampleCsv, type SampleCsvError, type SampleCsvRow } from '@/lib/vision/sampleCsv';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

type Result = { file: string; status: 'ok' | 'error' | 'missing'; message?: string };

/**
 * Nhập hàng loạt ảnh mẫu (chốt 2026-10-23 Q4): chọn file nhãn CSV (cột như anh-tham-khao.csv) và
 * nhiều ảnh; mỗi dòng CSV ghép với ảnh cùng tên rồi gửi TỪNG ẢNH qua uploadLightingSampleAction —
 * cùng một chỗ kiểm nhãn với form một ảnh, không vượt giới hạn 4,5 MB mỗi lần gửi của Vercel.
 */
export function LightingSampleImport() {
  const t = useTranslations('admin.samples.import');
  const router = useRouter();
  const [rows, setRows] = useState<SampleCsvRow[]>([]);
  const [errors, setErrors] = useState<SampleCsvError[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  const ready = rows.filter((r) => byName.has(r.file.toLowerCase()));

  const readCsv = async (file: File | undefined) => {
    setResults([]);
    if (!file) return;
    const parsed = parseSampleCsv(await file.text());
    setRows(parsed.rows);
    setErrors(parsed.errors);
  };

  const run = async () => {
    setRunning(true);
    const out: Result[] = rows.filter((r) => !byName.has(r.file.toLowerCase())).map((r) => ({ file: r.file, status: 'missing' }));
    for (const r of ready) {
      const fd = new FormData();
      if (r.task && r.feature) fd.set('target', `${r.task}:${r.feature}`);
      fd.set('light_type', r.lightType);
      const set = (k: string, v: string | number | null) => v !== null && fd.set(k, String(v));
      set('material', r.material);
      set('finish', r.finish);
      set('shape', r.shape);
      set('feature_color', r.featureColor);
      set('background_color', r.backgroundColor);
      set('light_color', r.lightColor);
      set('light_model', r.lightModel);
      set('angle_note', r.angleNote);
      set('distance_mm', r.distanceMm);
      set('exposure_us', r.exposureUs);
      set('camera', r.camera);
      set('lens', r.lens);
      set('source', r.source);
      set('caption_vi', r.caption);
      fd.set('file', byName.get(r.file.toLowerCase())!);
      const res = await uploadLightingSampleAction({}, fd);
      out.push(res.saved ? { file: r.file, status: 'ok' } : { file: r.file, status: 'error', message: res.error });
      setResults([...out]);
    }
    setRunning(false);
    router.refresh();
  };

  const ok = results.filter((r) => r.status === 'ok').length;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t('intro')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('csv')}</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => readCsv(e.target.files?.[0])} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('images')}</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles([...(e.target.files ?? [])])} className={inputClass} />
        </label>
      </div>
      {rows.length > 0 || errors.length > 0 ? (
        <p className="text-sm text-slate-700 dark:text-slate-200">{t('summary', { rows: rows.length, ready: ready.length, errors: errors.length })}</p>
      ) : null}
      {errors.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto text-xs text-amber-800 dark:text-amber-300">
          {errors.map((e, i) => (
            <li key={i}>{t('rowError', { line: e.line, field: e.field })}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={running || ready.length === 0}
        onClick={run}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {running ? t('running', { done: results.length, total: rows.length }) : t('start', { n: ready.length })}
      </button>
      {results.length > 0 && !running ? (
        <div className="text-sm">
          <p className="font-medium text-slate-800 dark:text-slate-100">{t('done', { ok, total: results.length })}</p>
          <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
            {results
              .filter((r) => r.status !== 'ok')
              .map((r) => (
                <li key={r.file} className="text-red-700 dark:text-red-400">
                  {r.file}: {r.status === 'missing' ? t('missing') : r.message}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
