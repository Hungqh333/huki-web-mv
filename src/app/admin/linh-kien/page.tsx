import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { deleteComponentAction } from '@/app/actions/components';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { COMPONENT_KINDS, SPEC_FIELDS, type Component } from '@/lib/components/specs';
import { createClient } from '@/lib/supabase/server';

const SOURCE_STYLES: Record<string, string> = {
  unverified: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  datasheet: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  measured: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
};

export default async function AdminComponentsPage({
  searchParams,
}: PageProps<'/admin/linh-kien'>) {
  const t = await getTranslations('admin.components');
  const tSpec = await getTranslations('admin.components.spec');
  const { saved, deleted, kind } = await searchParams;

  const activeKind = typeof kind === 'string' && COMPONENT_KINDS.includes(kind as never) ? kind : null;

  const supabase = await createClient();
  let query = supabase
    .from('components')
    .select('id, code, kind, brand, model, spec, price_vnd, source, is_active, sort_order')
    .order('kind')
    .order('sort_order');

  if (activeKind) query = query.eq('kind', activeKind);

  const { data, error } = await query;
  const components = (data ?? []) as Component[];

  /** Tóm tắt thông số: lấy các trường bắt buộc của loại đó, đủ để nhận ra thiết bị. */
  const summarise = (component: Component) => {
    const fields = SPEC_FIELDS[component.kind] ?? [];
    return fields
      .filter((field) => field.required)
      .map((field) => {
        const value = component.spec[field.key];
        if (value === undefined || value === null || value === '') return null;
        return `${tSpec(field.key)} ${value}${field.unit ? ` ${field.unit}` : ''}`;
      })
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/linh-kien/moi"
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('new')}
        </Link>
      </div>

      {saved ? <Flash tone="ok" text={t('saved')} /> : null}
      {deleted ? <Flash tone="ok" text={t('deleted')} /> : null}
      {error ? <Flash tone="error" text={error.message} /> : null}

      <nav aria-label={t('filterLabel')} className="mt-6 flex flex-wrap gap-2">
        <FilterChip href="/admin/linh-kien" active={!activeKind} label={t('allKinds')} />
        {COMPONENT_KINDS.map((value) => (
          <FilterChip
            key={value}
            href={`/admin/linh-kien?kind=${value}`}
            active={activeKind === value}
            label={t(`kinds.${value}`)}
          />
        ))}
      </nav>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colCode')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colKind')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colDevice')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colSpec')}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t('colSource')}</th>
              <th scope="col" className="py-2 font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {components.map((component) => (
              <tr key={component.id} className={component.is_active ? '' : 'opacity-50'}>
                <td className="py-3 pr-3">
                  <Link
                    href={`/admin/linh-kien/${component.id}`}
                    className="font-mono text-xs hover:text-sky-700 dark:hover:text-sky-400"
                  >
                    {component.code}
                  </Link>
                  {component.is_active ? null : (
                    <span className="ml-2 text-xs text-slate-400">{t('inactive')}</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-xs">{t(`kinds.${component.kind}`)}</td>
                <td className="py-3 pr-3">
                  <span className="font-medium">{component.brand}</span>{' '}
                  <span className="text-slate-600 dark:text-slate-400">{component.model}</span>
                </td>
                <td className="py-3 pr-3 text-xs text-slate-600 dark:text-slate-400">
                  {summarise(component) || '—'}
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      SOURCE_STYLES[component.source] ?? SOURCE_STYLES.unverified
                    }`}
                  >
                    {t(`sources.${component.source}`)}
                  </span>
                </td>
                <td className="py-3">
                  <DeleteButton
                    action={deleteComponentAction}
                    id={component.id}
                    itemName={`${component.brand} ${component.model}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {components.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
        ) : null}
      </div>
    </section>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-sky-600 px-3 py-1.5 text-sm font-medium text-white'
          : 'rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-sky-500 dark:border-slate-700 dark:text-slate-300'
      }
    >
      {label}
    </Link>
  );
}

function Flash({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  return (
    <p
      className={
        tone === 'ok'
          ? 'mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
      }
    >
      {text}
    </p>
  );
}
