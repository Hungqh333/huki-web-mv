import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { canUseSelector, getSessionContext } from '@/lib/auth';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { contactMailto } from '@/lib/contact';
import { Icon, IconBadge, type BadgeTone } from '@/components/ui/Icon';

// Xoay vòng tông màu cho huy hiệu icon để danh sách bài toán không đơn điệu.
const TASK_TONES: BadgeTone[] = ['violet', 'sky', 'emerald', 'amber'];

type TaskTypeRow = {
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
};

type RecentTask = { slug: string; name_vi: string; name_en: string };

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

/**
 * Bài toán người dùng mở gần đây, lấy từ selector_history.
 *
 * RLS chỉ trả lịch sử của chính user và chỉ khi Member+, nên không cần lọc lại
 * quyền ở đây. Lấy dư rồi gộp trùng theo slug để "5 bài gần nhất" là 5 bài KHÁC
 * nhau, không phải cùng một bài chạy 5 lần.
 */
async function getRecentTasks(): Promise<RecentTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('selector_history')
    .select('created_at, task_types(slug, name_vi, name_en)')
    .order('created_at', { ascending: false })
    .limit(30);

  const rows = (data ?? []) as unknown as { task_types: RecentTask | null }[];
  const seen = new Set<string>();
  const recent: RecentTask[] = [];
  for (const row of rows) {
    const task = row.task_types;
    if (!task || seen.has(task.slug)) continue;
    seen.add(task.slug);
    recent.push(task);
    if (recent.length >= 5) break;
  }
  return recent;
}

export default async function SelectorHomePage() {
  const t = await getTranslations('selector.landing');
  const locale = await getLocale();

  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = canUseSelector(role);

  // task_types đọc công khai nên trang giới thiệu vẫn liệt kê được tên bài toán
  // cho khách và Registered — phục vụ mục tiêu marketing. Bảng luật thì không.
  const [taskTypes, recentTasks] = await Promise.all([
    getTaskTypes(),
    allowed ? getRecentTasks() : Promise.resolve<RecentTask[]>([]),
  ]);
  const pickName = (row: { name_vi: string; name_en: string }) =>
    locale === 'en' ? row.name_en : row.name_vi;
  const pickDesc = (row: TaskTypeRow) =>
    (locale === 'en' ? row.description_en : row.description_vi) ?? '';

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      {allowed ? (
        // Cột chính (lưới bài toán) + cột phụ (hướng dẫn, bài toán vừa dùng).
        // Dưới xl cột phụ tự xuống dưới lưới; không có màn nào bị bỏ trống.
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('pickTask')}</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
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

            {/* Máy tính không phải một "bài toán" mà là thứ dùng chung cho cả
                dự án, nên tách thành nhóm riêng chứ không xếp lẫn vào lưới
                trên — xếp lẫn thì đọc như bài toán thứ tư. */}
            <p className="mt-8 text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('sharedTitle')}
            </p>
            <Link
              href="/cong-cu-may-tinh"
              className="group mt-4 flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <IconBadge name="selector" tone="emerald" />
              <span className="mt-4 font-semibold">{t('pcCardTitle')}</span>
              <span className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {t('pcCardDesc')}
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-700 dark:text-sky-400">
                {t('openTask')}
                <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            {/* Bài toán vừa dùng — chỉ hiện khi có lịch sử, khỏi chiếm chỗ vô ích */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <IconBadge name="clock" tone="amber" className="size-8" />
                <h2 className="font-semibold">{t('recentTitle')}</h2>
              </div>
              {recentTasks.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {recentTasks.map((task) => (
                    <li key={task.slug}>
                      <Link
                        href={`/cong-cu-chon-thiet-bi/${task.slug}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span aria-hidden="true" className="text-slate-400">
                          →
                        </span>
                        {pickName(task)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('recentEmpty')}</p>
              )}
            </div>

            {/* Hướng dẫn cách công cụ chọn — luôn có, không bao giờ trống */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900 dark:bg-sky-950/30">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Icon name="shield" className="size-[18px]" />
                </span>
                <h2 className="font-semibold text-sky-900 dark:text-sky-200">{t('guideTitle')}</h2>
              </div>
              <p className="mt-3 text-sm text-sky-900/80 dark:text-sky-300/90">{t('guideIntro')}</p>
              <ol className="mt-2 space-y-1 text-sm text-sky-900/90 dark:text-sky-200/90">
                {(t.raw('guidePriority') as string[]).map((label, index) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-200 text-xs font-semibold text-sky-800 dark:bg-sky-500/25 dark:text-sky-200">
                      {index + 1}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
              <p className="mt-3 border-t border-sky-200 pt-3 text-xs leading-relaxed text-sky-900/75 dark:border-sky-900 dark:text-sky-300/80">
                {t('guideRuleFirst')}
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {taskTypes.map((task) => (
              <li
                key={task.slug}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="font-semibold">{pickName(task)}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{pickDesc(task)}</p>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
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
