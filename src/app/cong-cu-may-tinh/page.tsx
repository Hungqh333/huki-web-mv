import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PcPlanner } from '@/components/pc/PcPlanner';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { contactMailto } from '@/lib/contact';
import type { Component } from '@/lib/components/specs';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Cấu hình máy tính dùng chung — trang riêng, tách khỏi bộ chọn từng bài toán.
 *
 * Vì sao tách hẳn ra đây: một dự án thật hay có nhiều bài toán chạy trên CÙNG
 * một máy. Khi máy tính còn nằm trong bảng vật tư của từng bài toán thì ba bài
 * toán ra ba dòng máy tính, và người lên báo giá phải tự nhớ gộp lại.
 *
 * Trang này đi ngược lại: nhập từng bài toán một dòng, cộng số camera và băng
 * thông, rồi mới chọn máy — và chỉ khi đó mới biết được cần một máy hay hai.
 */

/** Điền sẵn dòng đầu khi người dùng bấm sang từ bảng vật tư của một bài toán. */
function seedFromQuery(params: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const cameras = Number(one('cameras'));
  if (!Number.isFinite(cameras) || cameras <= 0) return undefined;

  const rate = Number(one('rate'));
  return [
    {
      label: one('label') ?? '',
      cameraCount: Math.floor(cameras),
      interfaceName: one('interface') ?? 'GigE',
      dataRateMbytesS: Number.isFinite(rate) && rate > 0 ? rate : null,
      needsGpu: one('gpu') === '1',
    },
  ];
}

async function getComponents(): Promise<Component[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  // RLS lo phần quyền: không phải Member+ thì truy vấn này trả rỗng.
  const { data } = await supabase
    .from('components')
    .select(
      'id, code, kind, brand, model, spec, price_vnd, datasheet_url, source, notes_vi, notes_en, is_active, sort_order'
    )
    .eq('is_active', true)
    .order('kind')
    .order('sort_order');
  return (data ?? []) as Component[];
}

export default async function PcToolPage({
  searchParams,
}: PageProps<'/cong-cu-may-tinh'>) {
  const t = await getTranslations('pcPlanner');
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && canUseSelector(role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">
            {t('locked.title')}
          </h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">
            {session ? t('locked.bodyRegistered') : t('locked.bodyGuest')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link
                href="/dang-nhap"
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                {t('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - Cau hinh may tinh')}
              className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              {t('locked.contact')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const [components, params] = await Promise.all([getComponents(), searchParams]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <p className="mt-4 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {t('why')}
      </p>

      <div className="mt-8">
        {components.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t('emptyCatalog')}
          </p>
        ) : (
          <PcPlanner components={components} initialLines={seedFromQuery(params)} />
        )}
      </div>
    </section>
  );
}
