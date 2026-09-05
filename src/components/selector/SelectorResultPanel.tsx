'use client';

import { useLocale, useTranslations } from 'next-intl';
import { IconBadge, type BadgeTone, type IconName } from '@/components/ui/Icon';
import type { Component } from '@/lib/components/specs';
import type { SelectorInput, SelectorResult } from '@/lib/selector/types';
import { appearanceInputFromForm } from '@/lib/vision/fromInput';
import { ComponentPicker } from './ComponentPicker';

/**
 * Danh mục vật tư, xếp theo THỨ TỰ PHỤ THUỘC chứ không theo thói quen mua hàng.
 *
 * Chiếu sáng đứng đầu là có chủ đích: lỗi không hiện lên được thì camera nào
 * cũng vô nghĩa. Camera đứng TRƯỚC ống kính vì tiêu cự và vòng ảnh đều suy từ
 * cảm biến đã chọn — xếp ngược lại thì danh sách ống kính bị lọc theo một thứ
 * người dùng chưa chọn tới. Mỗi cụm kèm một dòng nhắc nó ràng buộc gì lên cụm
 * sau, để sự phụ thuộc hiện ra thay vì bị giấu.
 */
const BOM: {
  key: 'lighting' | 'camera' | 'lens' | 'processing' | 'accessories';
  icon: IconName;
  tone: BadgeTone;
}[] = [
  { key: 'lighting', icon: 'sun', tone: 'amber' },
  { key: 'camera', icon: 'camera', tone: 'sky' },
  { key: 'lens', icon: 'selector', tone: 'violet' },
  { key: 'processing', icon: 'monitor', tone: 'emerald' },
  { key: 'accessories', icon: 'rules', tone: 'slate' },
];

const APPROACH_STYLES: Record<string, string> = {
  rule_based: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  hybrid: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  deep_learning: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300',
};

export function SelectorResultPanel({
  result,
  input,
  components,
  historySaved,
  historyId,
  canExport,
}: {
  result: SelectorResult;
  input: SelectorInput;
  components: Component[];
  historySaved?: boolean;
  historyId?: string;
  canExport: boolean;
}) {
  const t = useTranslations('selector.result');
  const tApproach = useTranslations('selector.approach');
  const locale = useLocale();
  const pickNote = (note: { vi: string; en: string }) => (locale === 'en' ? note.en : note.vi);

  const valueOf = (key: (typeof BOM)[number]['key']) => result[key];

  /*
   * Có catalog thì phần chọn thiết bị đã liệt kê đúng những cụm này kèm mã hàng
   * thật, nên danh sách dạng chữ chỉ còn là bản lặp. Chỉ giữ lại khi catalog
   * rỗng — lúc đó nó là kết quả duy nhất.
   */
  const hasCatalog = components.length > 0;

  /* Khung kiểm tra khả thi đã trình bày lại các phép tính này theo mm/px và kèm
     PASS/FAIL, nên khối "Cách tính" cũ thành thừa. */
  const hasVisionChecks = appearanceInputFromForm(input) !== null;

  return (
    <section aria-live="polite" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            APPROACH_STYLES[result.approach] ?? APPROACH_STYLES.rule_based
          }`}
        >
          {tApproach(result.approach)}
        </span>
      </div>

      {result.noRuleMatched ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('noRuleMatched')}
        </p>
      ) : null}

      <div hidden={hasCatalog}>
        <h3 className="font-semibold">{t('bomTitle')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('bomHint')}</p>

        <ol className="mt-4 space-y-3">
          {BOM.map((item, index) => {
            const value = valueOf(item.key);
            return (
              <li
                key={item.key}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <IconBadge name={item.icon} tone={item.tone} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t(item.key)}
                      </h4>
                    </div>
                    <p className="mt-1 text-sm">
                      {value ?? <span className="text-slate-400">{t('notSpecified')}</span>}
                    </p>
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      {t(`constraints.${item.key}`)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {components.length > 0 ? (
        <ComponentPicker result={result} input={input} components={components} />
      ) : null}

      {result.approachReason ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{t('approachReason')}</h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {pickNote(result.approachReason)}
          </p>
        </div>
      ) : null}

      {result.derived.length > 0 && !hasVisionChecks ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{t('calculations')}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('calculationsHint')}</p>
          <ul className="mt-3 space-y-2">
            {result.derived.map((metric) => (
              <li key={metric.key} className="text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t(`metrics.${metric.key}`)}
                </span>
                <code className="mt-0.5 block overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {metric.formula}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.notes.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{t('notes')}</h3>
          <ul className="mt-3 space-y-3">
            {result.notes.map((note, index) => (
              <li key={`${note.ruleCode ?? 'note'}-${index}`} className="text-sm">
                <p className="text-slate-700 dark:text-slate-300">{pickNote(note)}</p>
                {note.ruleCode ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{note.ruleCode}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {canExport && historyId ? (
          <a
            href={`/api/bao-cao/${historyId}`}
            // Route trả Content-Disposition: attachment nên trình duyệt tải về
            // thay vì mở tab mới rồi bỏ trống.
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            {t('exportPdf')}
          </a>
        ) : (
          <button
            type="button"
            disabled
            title={canExport ? t('exportNeedsHistory') : t('exportVipOnly')}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-500 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-400"
          >
            {t('exportPdf')}
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
              VIP
            </span>
          </button>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {/* Chỉ khẳng định đã lưu khi thật sự biết là đã lưu. Trước đây
              undefined cũng báo "đã lưu". */}
          {historySaved === true ? t('historySaved') : t('historyNotSaved')}
        </p>
      </div>
    </section>
  );
}
