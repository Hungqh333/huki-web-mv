import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const TABS = [
  { href: '/admin/chi-tieu', key: 'problemTypes' },
  { href: '/admin/chi-tieu/he-so', key: 'modifiers' },
  { href: '/admin/chi-tieu/tham-so', key: 'parameters' },
] as const;

export async function KpiAdminNav({ active }: { active: string }) {
  const t = await getTranslations('admin.kpi.nav');

  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={
            active === tab.key
              ? 'border-b-2 border-sky-600 px-3 py-2 text-sm font-medium text-sky-700 dark:text-sky-400'
              : 'px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}

/** Nhãn nguồn gốc số liệu — cho biết dòng đó đã hiệu chỉnh bằng dự án thật chưa. */
export async function DataSourceBadge({ source }: { source: string }) {
  const t = await getTranslations('admin.kpi.dataSource');

  const styles: Record<string, string> = {
    estimate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    project_history: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    vendor_spec: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
        styles[source] ?? styles.estimate
      }`}
    >
      {t(source)}
    </span>
  );
}
