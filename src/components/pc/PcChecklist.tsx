import { getLocale, getTranslations } from 'next-intl/server';
import { PanelHeader } from '@/components/ui/PanelHeader';
import { PC_CHECKLIST } from '@/lib/pc/checklist';
import { PrintButton } from './PrintButton';
import { PC_INFO_CLASS } from './styles';

/**
 * Tab "Checklist ổn định" (mẫu veCk()). Chỉ hiển thị. Nút In / tải PDF dùng hộp thoại in của
 * trình duyệt ("Lưu dưới dạng PDF"); khối `.pc-print-area` trong globals.css ẩn menu, tab, chân
 * trang và ép chữ đen nền trắng khi in, kể cả khi đang để giao diện tối.
 */
export async function PcChecklist() {
  const t = await getTranslations('pcVision.checklist');
  const en = (await getLocale()) === 'en';
  const total = PC_CHECKLIST.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="pc-print-area space-y-4">
      <p className="pc-print-hide max-w-4xl text-sm text-slate-600 dark:text-slate-400">
        {t.rich('intro', { b: (chunks) => <b className="text-slate-900 dark:text-slate-100">{chunks}</b> })}
      </p>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <PanelHeader title={t('title')} meta={t('meta', { n: total })} actions={<PrintButton label={t('print')} />} />
        <table className="w-full text-[13px]">
          {PC_CHECKLIST.map((group) => (
            <tbody key={group.vi} className="break-inside-avoid">
              <tr className="border-t border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/50">
                <td colSpan={3} className="px-3 py-2 font-semibold">
                  {en ? group.en : group.vi}
                </td>
              </tr>
              {group.items.map((item, i) => (
                <tr key={item.vi} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className={`w-8 px-3 py-1.5 ${PC_INFO_CLASS}`}>{i + 1}</td>
                  <td className="px-3 py-1.5">{en ? item.en : item.vi}</td>
                  {/* Bắt buộc: chữ đậm vừa; Khuyến nghị: chữ phụ mờ — không viên màu (đồng bộ 2026-11-04). */}
                  <td className={`w-28 whitespace-nowrap px-3 py-1.5 ${item.required ? 'text-xs font-medium text-slate-700 dark:text-slate-200' : PC_INFO_CLASS}`}>
                    {item.required ? t('required') : t('recommended')}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>
    </div>
  );
}
