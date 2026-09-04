import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { contactMailto } from '@/lib/contact';
import { IconBadge, type BadgeTone } from '@/components/ui/Icon';

// Xoay vòng tông màu cho huy hiệu icon để danh sách bài toán không đơn điệu.
const TASK_TONES: BadgeTone[] = ['violet', 'sky', 'emerald', 'amber'];

type TaskTypeRow = {
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
};

async function getTaskTypes(): Promise<TaskTypeRow[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('task_types')
    .select('slug, name_vi, name_en, description_vi, description_en')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Danh sách bài toán trống vì lỗi kết nối trông giống hệt "chưa cấu hình bài
  // toán nào". Ném lỗi để error boundary phân biệt giúp người dùng.
  if (error) throw new Error(`Không tải được danh sách bài toán: ${error.message}`);

  return (data ?? []) as TaskTypeRow[];
}

export default async function SelectorHomePage() {
  const t = await getTranslations('selector.landing');
  const locale = await getLocale();

  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = canUseSelector(role);

  // task_types đọc công khai nên trang giới thiệu vẫn liệt kê được tên bài toán
  // cho khách và Registered — phục vụ mục tiêu marketing. Bảng luật thì không.
  const taskTypes = await getTaskTypes();
  const pickName = (row: TaskTypeRow) => (locale === 'en' ? row.name_en : row.name_vi);
  const pickDesc = (row: TaskTypeRow) =>
    (locale === 'en' ? row.description_en : row.description_vi) ?? '';

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      {allowed ? (
        <>
          <p className="mt-8 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('pickTask')}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {taskTypes.map((task, index) => (
              <li key={task.slug}>
                <Link
                  href={`/cong-cu-chon-thiet-bi/${task.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <IconBadge name="selector" tone={TASK_TONES[index % TASK_TONES.length]} />
                  <span className="mt-4 font-semibold">{pickName(task)}</span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {pickDesc(task)}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-700 dark:text-sky-400">
                    {t('openTask')}
                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-10 space-y-8">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {taskTypes.map((task) => (
              <li
                key={task.slug}
                className="rounded-lg border border-slate-200 p-5 dark:border-slate-800"
              >
                <p className="font-semibold">{pickName(task)}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{pickDesc(task)}</p>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
            <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">
              {t('lockedTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-sky-900/80 dark:text-sky-300/90">
              {session ? t('lockedForRegistered') : t('lockedForGuest')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={contactMailto('Machine Vision Hub - Yeu cau tu van')}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                {t('contactCta')}
              </a>
              {session ? null : (
                <Link
                  href="/dang-nhap"
                  className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
                >
                  {t('signInCta')}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
