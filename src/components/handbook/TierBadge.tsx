import { getTranslations } from 'next-intl/server';
import type { AccessTier } from '@/lib/auth';

const TIER_STYLES: Record<AccessTier, string> = {
  public: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  registered: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300',
  member: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
  vip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
};

export async function TierBadge({ tier, locked }: { tier: AccessTier; locked?: boolean }) {
  const t = await getTranslations('handbook.tiers');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_STYLES[tier]}`}
    >
      {locked ? <span aria-hidden="true">🔒</span> : null}
      {t(tier)}
    </span>
  );
}
