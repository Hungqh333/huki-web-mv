import { getLocale, getTranslations } from 'next-intl/server';
import { NOTE_CLASS, PanelHeader } from '@/components/ui/PanelHeader';
import { PC_CHECKLIST } from '@/lib/pc/checklist';
import { PrintButton } from './PrintButton';

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
        <table className="w-full text-sm">
          {PC_CHECKLIST.map((group) => (
            <tbody key={group.vi} className="break-inside-avoid">
              <tr className="border-t border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/50">
                <td colSpan={3} className="px-3 py-2 font-semibold">
                  {en ? group.en : group.vi}
                </td>
              </tr>
              {group.items.map((item, i) => (
                <tr key={item.vi} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className={`w-8 px-3 py-1.5 ${NOTE_CLASS}`}>{i + 1}</td>
                  <td className="px-3 py-1.5">{en ? item.en : item.vi}</td>
                  <td className="w-28 px-3 py-1.5">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-px text-[11px] font-medium ${
                        item.required
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                      }`}
                    >
                      {item.required ? t('required') : t('recommended')}
                    </span>
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
