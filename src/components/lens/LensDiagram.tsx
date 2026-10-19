'use client';

import { useTranslations } from 'next-intl';

/**
 * Sơ đồ sống của Bộ chọn ống kính (chốt 2026-10-18, Q1): camera → ống → chóp nhìn →
 * vùng nhìn, nhãn ghi số đang tính; ô nào đang nhập thì nhãn tương ứng sáng lên.
 * Chỉ vẽ — không tính gì; số do LensSelector truyền vào (đã từ engine).
 * Hình học cố định (không vẽ theo tỉ lệ thật): mục đích là chỉ đúng đại lượng nào
 * nằm ở đâu, không phải bản vẽ cơ khí.
 */

export type DiagramField = 'f' | 'wd' | 'fov';

const fmt = (value: number | null, digits = 1) => (value === null ? '—' : String(Math.round(value * 10 ** digits) / 10 ** digits));

export function LensDiagram({
  sensorLongMm,
  sensorShortMm,
  focalMm,
  wdMm,
  fovLongMm,
  fovShortMm,
  aovDeg,
  telecentric,
  highlight,
}: {
  sensorLongMm: number | null;
  sensorShortMm: number | null;
  focalMm: number | null;
  wdMm: number | null;
  fovLongMm: number | null;
  fovShortMm: number | null;
  aovDeg: number | null;
  telecentric: boolean;
  highlight: DiagramField | null;
}) {
  const t = useTranslations('lensSelector.diagram');
  const label = (field: DiagramField) =>
    highlight === field ? 'fill-sky-600 font-semibold dark:fill-sky-400' : 'fill-slate-600 dark:fill-slate-300';
  const stroke = (field: DiagramField) => (highlight === field ? 'stroke-sky-500' : 'stroke-slate-400 dark:stroke-slate-500');

  const lensFront = telecentric ? 152 : 102;
  const planeTop = telecentric ? 62 : 26;
  const planeBottom = telecentric ? 168 : 204;
  const fov = fovLongMm === null ? '—' : fovShortMm === null ? `${fmt(fovLongMm)} mm` : `${fmt(fovLongMm)} × ${fmt(fovShortMm)} mm`;

  return (
    <svg viewBox="0 0 480 236" role="img" aria-label={t('aria')} className="h-auto w-full text-[15px]">
      {/* Camera + cảm biến */}
      <rect x="12" y="85" width="50" height="60" rx="5" className="fill-slate-200 stroke-slate-400 dark:fill-slate-700 dark:stroke-slate-500" strokeWidth="1" />
      <rect x="52" y="100" width="6" height="30" className="fill-indigo-400 dark:fill-indigo-500" />
      <text x="6" y="166" className="fill-slate-500 dark:fill-slate-400">
        {t('sensor')}
      </text>
      <text x="6" y="184" className="fill-slate-500 dark:fill-slate-400">
        {sensorLongMm === null ? '—' : `${fmt(sensorLongMm, 2)} × ${fmt(sensorShortMm, 2)}`}
      </text>

      {/* Ống kính */}
      {telecentric ? (
        <path d="M62 98 L62 132 L100 132 L152 166 L152 64 L100 98 Z" className="fill-slate-300 stroke-slate-500 dark:fill-slate-600 dark:stroke-slate-400" strokeWidth="1" />
      ) : (
        <rect x="62" y="94" width="40" height="42" rx="3" className="fill-slate-300 stroke-slate-500 dark:fill-slate-600 dark:stroke-slate-400" strokeWidth="1" />
      )}
      {!telecentric ? (
        <text x="82" y="82" textAnchor="middle" className={label('f')}>
          f {fmt(focalMm)} mm
        </text>
      ) : null}

      {/* Chùm tia */}
      {telecentric ? (
        <>
          <line x1="152" y1={planeTop + 4} x2="400" y2={planeTop + 4} strokeDasharray="4 3" className="stroke-pink-500" strokeWidth="1" />
          <line x1="152" y1={planeBottom - 4} x2="400" y2={planeBottom - 4} strokeDasharray="4 3" className="stroke-pink-500" strokeWidth="1" />
        </>
      ) : (
        <>
          <line x1="102" y1="115" x2="400" y2={planeTop} strokeDasharray="4 3" className="stroke-pink-500" strokeWidth="1" />
          <line x1="102" y1="115" x2="400" y2={planeBottom} strokeDasharray="4 3" className="stroke-pink-500" strokeWidth="1" />
          <path d="M140 104 A40 40 0 0 1 140 126" fill="none" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
          <text x="146" y="120" className="fill-slate-600 dark:fill-slate-300">
            {aovDeg === null ? '' : `${fmt(aovDeg)}°`}
          </text>
        </>
      )}

      {/* Vùng nhìn */}
      <rect
        x="400"
        y={planeTop}
        width="14"
        height={planeBottom - planeTop}
        className={`fill-sky-200/60 dark:fill-sky-900/60 ${stroke('fov')}`}
        strokeWidth={highlight === 'fov' ? 2 : 1}
      />
      <text x="414" y={planeTop - 8} textAnchor="end" className={label('fov')}>
        {t('fov')} {fov}
      </text>

      {/* Khoảng cách làm việc: từ mặt trước ống tới vật */}
      <line x1={lensFront} y1="222" x2="400" y2="222" className={stroke('wd')} strokeWidth={highlight === 'wd' ? 2 : 1} />
      <line x1={lensFront} y1="216" x2={lensFront} y2="228" className={stroke('wd')} strokeWidth="1" />
      <line x1="400" y1="216" x2="400" y2="228" className={stroke('wd')} strokeWidth="1" />
      <text x={(lensFront + 400) / 2} y="215" textAnchor="middle" className={label('wd')}>
        WD {wdMm === null ? (telecentric ? t('wdFromLens') : '—') : `${fmt(wdMm, 0)} mm`}
      </text>
    </svg>
  );
}
