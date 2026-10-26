'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { frontFocalFromDatasheet } from '@/lib/vision/configurationRules';

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

/**
 * Tính giúp sF (mặt trước ống → tiêu điểm trước) từ một cặp số trên datasheet — chốt 2026-10-26 Q2:
 * WD và độ phóng đại β ở WD đó, hoặc WD + vùng nhìn + cạnh cảm biến tương ứng (β = cảm biến ÷ vùng
 * nhìn). sF = WD − f ÷ β; bấm "Điền" ghi vào ô sF của form (vẫn phải bấm Lưu).
 */
export function FrontFocalHelper() {
  const t = useTranslations('admin.components.frontFocal');
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ wd: '', beta: '', fov: '', sensor: '' });
  const num = (s: string) => {
    const n = Number(s.replace(',', '.'));
    return s.trim() !== '' && Number.isFinite(n) ? n : null;
  };
  const form = () => box.current?.closest('form') ?? null;
  const focal = () => num((form()?.elements.namedItem('spec_focal_length_mm') as HTMLInputElement | null)?.value ?? '');

  const beta = num(v.beta) ?? (num(v.fov) && num(v.sensor) ? num(v.sensor)! / num(v.fov)! : null);
  const [result, setResult] = useState<number | null | 'noFocal'>(null);
  const compute = () => {
    const f = focal();
    const wd = num(v.wd);
    if (f === null) return setResult('noFocal');
    setResult(wd !== null && beta !== null ? frontFocalFromDatasheet(f, wd, beta) : null);
  };
  const fill = () => {
    const field = form()?.elements.namedItem('spec_front_focal_mm') as HTMLInputElement | null;
    if (field && typeof result === 'number') field.value = String(Math.round(result * 100) / 100);
  };
  const field = (key: keyof typeof v, label: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">{label}</span>
      <input type="number" step="any" value={v[key]} onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))} className={inputClass} />
    </label>
  );

  return (
    <div ref={box} className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{t('title')}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('hint')}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        {field('wd', t('wd'))}
        {field('beta', t('beta'))}
        {field('fov', t('fov'))}
        {field('sensor', t('sensor'))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={compute} className="rounded-md border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          {t('compute')}
        </button>
        {result === 'noFocal' ? <span className="text-red-700 dark:text-red-400">{t('noFocal')}</span> : null}
        {typeof result === 'number' ? (
          <>
            <span className="tabular-nums">sF = {Math.round(result * 100) / 100} mm</span>
            <button type="button" onClick={fill} className="rounded-md bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-700">
              {t('fill')}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
