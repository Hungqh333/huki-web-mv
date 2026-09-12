'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { COMFORTABLE_MARGIN_PCT, type Variant } from '@/lib/components/variants';

/**
 * Vài phương án đặt cạnh nhau, khác nhau ở BIÊN DƯ thật.
 *
 * Khác hai chỗ so với bảng so sánh quen thuộc của các hãng:
 *
 *  - KHÔNG có cột nào chấm sao chi phí hay dán nhãn rủi ro "Cao/Thấp". Không
 *    có dữ liệu nào đằng sau những thứ đó, và một bảng trông có thẩm quyền mà
 *    đựng số bịa thì nguy hiểm hơn là không có bảng.
 *  - Chỉ liệt kê thứ THAY ĐỔI theo camera. Đèn, cáp đèn, bộ điều khiển đèn
 *    không phụ thuộc camera nên bày ba lần giống hệt nhau chỉ là nhiễu — chúng
 *    nằm ở bảng vật tư bên dưới.
 */

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function VariantCompare({
  variants,
  selectedCode,
  onSelect,
}: {
  variants: Variant[];
  /** Mã camera đang được dùng cho bảng vật tư bên dưới. */
  selectedCode: string | null;
  onSelect: (cameraCode: string) => void;
}) {
  const t = useTranslations('selector.variants');

  // Một phương án thì không có gì để so sánh.
  if (variants.length < 2) return null;

  const highlight = (variant: Variant) =>
    variant.camera.code === selectedCode ? 'bg-sky-50 dark:bg-sky-950/40' : '';

  /* Hàm thường trả JSX, KHÔNG phải component. React Compiler cấm định nghĩa
     component ngay trong lúc render: mỗi lần render lại sinh ra một kiểu mới
     và cả cây con bị tháo ra dựng lại. Gọi bằng row(...) nên không vướng. */
  const row = (label: string, render: (variant: Variant) => ReactNode) => (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <th
        scope="row"
        className="w-48 px-4 py-2.5 text-left align-top text-xs font-medium text-slate-500 dark:text-slate-400"
      >
        {label}
      </th>
      {variants.map((variant) => (
        <td
          key={variant.camera.code}
          className={`px-4 py-2.5 align-top text-sm ${highlight(variant)}`}
        >
          {render(variant)}
        </td>
      ))}
    </tr>
  );

  return (
    <div>
      <h3 className="font-semibold">{t('title')}</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{t('hint')}</p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900">
              <th className="w-48 px-4 py-3" />
              {variants.map((variant) => (
                <th
                  key={variant.camera.code}
                  scope="col"
                  className={`px-4 py-3 align-bottom ${highlight(variant)}`}
                >
                  {variant.key === 'balanced' ? (
                    <span className="mb-1 inline-block rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {t('recommended')}
                    </span>
                  ) : null}
                  <span className="block text-sm font-bold">{t(`keys.${variant.key}`)}</span>
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                    {t(`subs.${variant.key}`)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {row(t('rows.camera'), (v) => (
              <>
                <span className="block font-semibold text-slate-900 dark:text-slate-100">
                  {v.camera.model}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {v.camera.brand} · {v.widthPx} × {v.heightPx} px
                  {v.interfaceName ? ` · ${v.interfaceName}` : ''}
                </span>
              </>
            ))}

            {row(t('rows.lens'), (v) =>
              v.lens ? (
                <>
                  <span className="block font-semibold text-slate-900 dark:text-slate-100">
                    {v.lens.model}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {v.lens.brand}
                  </span>
                </>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">{t('noLens')}</span>
              )
            )}

            {/* Chỉ hiện khi có ít nhất một phương án cần vòng nối dài — không
                thì đây là một hàng "không cần / không cần / không cần". */}
            {variants.some((v) => v.needsTube)
              ? row(t('rows.tube'), (v) =>
                  v.needsTube ? (
                    <span>{v.tube?.model ?? t('noTube')}</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">{t('notNeeded')}</span>
                  )
                )
              : null}

            {row(t('rows.margin'), (v) =>
              v.marginPct === null ? (
                <span className="text-slate-400">—</span>
              ) : (
                <>
                  <span
                    className={`text-base font-bold ${
                      v.marginPct >= COMFORTABLE_MARGIN_PCT
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    +{v.marginPct}%
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {v.marginPct >= COMFORTABLE_MARGIN_PCT
                      ? t('marginOk')
                      : t('marginTight', { threshold: COMFORTABLE_MARGIN_PCT })}
                  </span>
                </>
              )
            )}

            {row(t('rows.mmPerPx'), (v) =>
              v.mmPerPx === null ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span className="tabular-nums">{round(v.mmPerPx)} mm/px</span>
              )
            )}

            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className="px-4 py-4" />
              {variants.map((variant) => {
                const active = variant.camera.code === selectedCode;
                return (
                  <td
                    key={variant.camera.code}
                    className={`px-4 py-4 align-top ${highlight(variant)}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(variant.camera.code)}
                      disabled={active}
                      className={`w-full rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'cursor-default border border-sky-300 bg-white text-sky-800 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300'
                          : 'bg-sky-600 text-white hover:bg-sky-700'
                      }`}
                    >
                      {active ? t('current') : t('choose')}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('foot')}</p>
    </div>
  );
}
