'use client';

import { useTranslations } from 'next-intl';
import { worstStatus, type AppearanceAnalysis, type Check, type CheckStatus } from '@/lib/vision';

/**
 * Hiển thị kết quả bộ tính toán bài ngoại quan.
 *
 * Giữ đúng cách trình bày đang dùng ở phần "Cách tính": tên bước + công thức đã
 * thay số. Khác ở chỗ mỗi bước có trạng thái rõ ràng, thay vì để kỹ sư tự đoán
 * con số vừa hiện ra là tốt hay xấu.
 *
 * Bố cục cố ý gọn: hai mươi phép kiểm mà mỗi phép một thẻ có viền riêng thì
 * khung kết quả dài gần 2000px, đọc rất mệt. Giờ mỗi nhóm là một khối gập được,
 * và CHỈ nhóm nào có cảnh báo mới mở sẵn — chỗ cần chú ý tự nổi lên, phần đạt
 * rồi thì nằm im.
 */

const STATUS_STYLES: Record<CheckStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  fail: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function StatusBadge({ status }: { status: CheckStatus }) {
  const t = useTranslations('selector.vision');
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

export function VisionChecks({
  analysis,
  hasCamera,
}: {
  analysis: AppearanceAnalysis;
  hasCamera: boolean;
}) {
  const t = useTranslations('selector.vision');

  const totalChecks = analysis.sections.reduce((sum, section) => sum + section.checks.length, 0);
  /* Mọi phép kiểm đều đạt thì gập cả khối lại. Đo được khối này cao 1228px —
     cao hơn cả bảng danh mục vật tư (824px), tức là phần KIỂM CHỨNG đang lấn
     át phần TRẢ LỜI. Có cảnh báo thì vẫn mở sẵn, không được giấu. */
  const needsAttention = analysis.overall === 'warn' || analysis.overall === 'fail';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t('title')}</h3>
        <StatusBadge status={analysis.overall} />
      </div>

      {/*
        Cảnh báo cố định: hiện dù mọi phép kiểm đều đạt. Đủ độ phân giải chỉ nói
        lỗi đủ lớn trong ảnh, không nói nó có nổi khỏi nền hay không — ranh giới
        mà không công thức nào vượt qua được. Nằm NGOÀI khối gập, nếu không nó
        biến mất đúng lúc mọi thứ đều đạt — tức là đúng lúc dễ chủ quan nhất.
      */}
      <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {t('contrastDisclaimer')}
      </p>

      {hasCamera ? null : (
        <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t('needCamera')}
        </p>
      )}

      <details open={needsAttention} className="mt-3">
        <summary className="cursor-pointer text-sm text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
          {t('checkCount', { count: totalChecks })}
        </summary>

      <div className="mt-3 space-y-2">
        {analysis.sections
          .filter((section) => section.checks.length > 0)
          .map((section) => {
            const status = worstStatus(section.checks);
            // Chỉ mở sẵn nhóm có chuyện cần xem. Nhóm đạt hết thì gập lại.
            const needsAttention = status === 'warn' || status === 'fail';

            return (
              <details
                key={section.key}
                open={needsAttention}
                className="rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5">
                  <span className="text-sm font-medium">{t(`sections.${section.key}`)}</span>
                  <StatusBadge status={status} />
                  <span className="ml-auto text-xs text-slate-400">
                    {t('checkCount', { count: section.checks.length })}
                  </span>
                </summary>

                <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                  {section.checks.map((check) => (
                    <CheckRow key={`${section.key}-${check.key}`} check={check} />
                  ))}
                </ul>
              </details>
            );
          })}
      </div>
      </details>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const t = useTranslations('selector.vision');

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">{t(`checks.${check.key}`)}</span>
        {/* Bước chỉ là số liệu thì không cần nhãn — đỡ một hàng nhãn xám vô nghĩa. */}
        {check.status === 'info' ? null : <StatusBadge status={check.status} />}
      </div>

      <code className="mt-1 block overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        {check.formula}
      </code>

      {check.noteKey ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {/* Khoá có dấu chấm là đường dẫn đầy đủ (ví dụ lightingReason.scratch);
              khoá trơn thì nằm trong nhóm notes. */}
          {check.noteKey.includes('.')
            ? t(check.noteKey, check.noteValues ?? {})
            : t(`notes.${check.noteKey}`, check.noteValues ?? {})}
        </p>
      ) : null}
    </li>
  );
}
