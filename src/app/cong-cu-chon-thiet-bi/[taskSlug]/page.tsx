import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { SelectorForm } from '@/components/selector/SelectorForm';
import { canUseSelector, getSessionContext, hasAdvancedFeatures } from '@/lib/auth';
import { getFieldDefs, getUnknownFieldKeys } from '@/lib/selector/fields';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

type TaskTypeRow = {
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
  input_fields: unknown;
};

export default async function SelectorTaskPage({
  params,
}: PageProps<'/cong-cu-chon-thiet-bi/[taskSlug]'>) {
  const { taskSlug } = await params;
  const t = await getTranslations('selector.task');
  const locale = await getLocale();

  if (!hasSupabaseEnv()) redirect('/cong-cu-chon-thiet-bi');

  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;

  // Chưa đủ quyền thì đẩy về trang giới thiệu, không cho vào form.
  // RLS vẫn là chốt chặn thật: không có luật nào đọc được thì engine không chạy.
  if (!canUseSelector(role)) redirect('/cong-cu-chon-thiet-bi');

  const supabase = await createClient();
  const { data: task } = await supabase
    .from('task_types')
    .select('slug, name_vi, name_en, description_vi, description_en, input_fields')
    .eq('slug', taskSlug)
    .eq('is_active', true)
    .maybeSingle<TaskTypeRow>();

  if (!task) notFound();

  const fields = getFieldDefs(task.input_fields);
  const unknownKeys = getUnknownFieldKeys(task.input_fields);

  const name = locale === 'en' ? task.name_en : task.name_vi;
  const description = (locale === 'en' ? task.description_en : task.description_vi) ?? '';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/cong-cu-chon-thiet-bi"
        className="text-sm text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-400"
      >
        ← {t('backToTasks')}
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight">{name}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">{description}</p>
      ) : null}

      {unknownKeys.length > 0 ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('unknownFields', { keys: unknownKeys.join(', ') })}
        </p>
      ) : null}

      <div className="mt-8">
        {fields.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {t('noFields')}
          </p>
        ) : (
          <SelectorForm
            taskSlug={task.slug}
            fields={fields}
            canExport={hasAdvancedFeatures(role)}
          />
        )}
      </div>
    </section>
  );
}
