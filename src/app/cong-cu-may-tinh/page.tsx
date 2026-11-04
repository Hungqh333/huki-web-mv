import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PcCatalog } from '@/components/pc/PcCatalog';
import { PcChecklist } from '@/components/pc/PcChecklist';
import { PcFpsTable } from '@/components/pc/PcFpsTable';
import { PcHistory } from '@/components/pc/PcHistory';
import { PcSuggest, type PcSuggestPrefill } from '@/components/pc/PcSuggest';
import { suggestPcAction } from '@/app/actions/pcSuggest';
import { canUseSelector, getSessionContext, isAdmin } from '@/lib/auth';
import { contactMailto } from '@/lib/contact';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { loadIssuedCodes, loadPcCatalog, loadPcHistory } from '@/lib/pc/catalog';
import { PC_INTERFACE_KEYS, type PcInterface } from '@/lib/pc/options';
import { fpsTable } from '@/lib/pc/fps';
import { pcPowerModel } from '@/lib/pc/power';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * PC Vision — mục riêng trên menu (chốt 2026-11-03, Q1: thay nội dung trang Máy tính cũ,
 * giữ địa chỉ /cong-cu-may-tinh). Member trở lên xem (Q4), Admin thêm / sửa (Q3).
 *
 * Tab Danh mục cấu hình (đợt 1) và Gợi ý cấu hình (đợt 2, tính ở máy chủ — suggestPcAction).
 * Gợi ý thay công cụ cũ PcPlanner và vẫn nhận số camera / giao tiếp / băng thông bấm sang từ
 * bảng vật tư (?cameras=…&interface=…&rate=…&gpu=1). Tab Bảng fps (đợt 3, máy chủ tính, ô phơi
 * sáng đổi ?phoi=) và Checklist ổn định (đợt 3, chỉ hiển thị, In / tải PDF).
 */

const TABS = ['danh-muc', 'goi-y', 'fps', 'checklist'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL = { 'danh-muc': 'tabs.catalog', 'goi-y': 'tabs.suggest', fps: 'tabs.fps', checklist: 'tabs.checklist' } as const;

/** Chuẩn giao tiếp ghi trong kho / bảng vật tư → lựa chọn của tab Gợi ý. */
function toPcInterface(name: string | undefined): PcInterface {
  if (name === 'CXP-12' || name === 'CXP-6') return 'CXP-12x1';
  return PC_INTERFACE_KEYS.includes(name as PcInterface) ? (name as PcInterface) : 'GigE';
}

/** Điền sẵn camera khi người dùng bấm sang từ bảng vật tư của một bài toán. */
function seedFromQuery(params: Record<string, string | string[] | undefined>): PcSuggestPrefill | undefined {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const cameras = Number(one('cameras'));
  if (!Number.isFinite(cameras) || cameras <= 0) return undefined;

  const rate = Number(one('rate'));
  return {
    count: Math.min(64, Math.floor(cameras)),
    iface: toPcInterface(one('interface')),
    rate: Number.isFinite(rate) && rate > 0 ? Math.round(rate) : null,
    gpu: one('gpu') === '1',
  };
}

export default async function PcVisionPage({ searchParams }: PageProps<'/cong-cu-may-tinh'>) {
  const t = await getTranslations('pcVision');
  const tPc = await getTranslations('pcPlanner');
  const session = await getSessionContext();
  const role = session?.profile?.role ?? null;
  const allowed = hasSupabaseEnv() && canUseSelector(role);

  if (!allowed) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

        <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-200">{tPc('locked.title')}</h2>
          <p className="mt-2 text-sm text-sky-900/80 dark:text-sky-300/90">
            {session ? tPc('locked.bodyRegistered') : tPc('locked.bodyGuest')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {session ? null : (
              <Link href="/dang-nhap" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                {tPc('locked.signIn')}
              </Link>
            )}
            <a
              href={contactMailto('Machine Vision Hub - PC Vision')}
              className="rounded-md border border-sky-300 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              {tPc('locked.contact')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const params = await searchParams;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const seed = seedFromQuery(params);
  // Liên kết cũ từ bảng vật tư (?cameras=…) không có tab → mở thẳng tab Gợi ý.
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : seed ? 'goi-y' : 'danh-muc';
  const admin = isAdmin(role);
  const supabase = await createClient();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">{t('subtitle')}</p>

      <nav aria-label={t('tabs.label')} className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((value) => (
          <Link
            key={value}
            href={value === 'danh-muc' ? '/cong-cu-may-tinh' : `/cong-cu-may-tinh?tab=${value}`}
            aria-current={tab === value ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
              tab === value
                ? 'border-indigo-600 font-semibold text-slate-900 dark:text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t(TAB_LABEL[value])}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'danh-muc' ? (
          <CatalogTab admin={admin} supabase={supabase} />
        ) : tab === 'goi-y' ? (
          <SuggestTab supabase={supabase} seed={seed} />
        ) : tab === 'fps' ? (
          <FpsTab supabase={supabase} exposureMs={exposureFrom(params)} />
        ) : (
          <PcChecklist />
        )}
      </div>
    </section>
  );
}

async function CatalogTab({ admin, supabase }: { admin: boolean; supabase: Awaited<ReturnType<typeof createClient>> }) {
  const t = await getTranslations('pcVision.catalog');
  const [catalog, issuedCodes, history, engine] = await Promise.all([
    loadPcCatalog(supabase),
    admin ? loadIssuedCodes(supabase) : Promise.resolve([]),
    admin ? loadPcHistory(supabase) : Promise.resolve([]),
    // Số ước tải đỉnh chỉ gửi xuống trình duyệt của Admin (form chỉ Admin mở).
    admin ? loadEngineParams(supabase) : Promise.resolve(null),
  ]);

  if (catalog.error) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {t('loadError')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PcCatalog
        frames={catalog.frames}
        configs={catalog.configs}
        admin={admin}
        power={engine ? pcPowerModel(engine.params) : null}
        issuedCodes={issuedCodes}
      />
      {admin ? <PcHistory entries={history} /> : null}
    </div>
  );
}

async function SuggestTab({
  supabase,
  seed,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  seed: PcSuggestPrefill | undefined;
}) {
  const t = await getTranslations('pcVision.catalog');
  // Danh mục chỉ để vẽ tên khung / mã; phép tính chạy lại ở máy chủ trong suggestPcAction.
  const catalog = await loadPcCatalog(supabase);
  if (catalog.error) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {t('loadError')}
      </p>
    );
  }
  return <PcSuggest frames={catalog.frames} configs={catalog.configs} run={suggestPcAction} prefill={seed} />;
}

/** `?phoi=` — thời gian phơi sáng (ms) của tab Bảng fps; trống / sai = không xét. */
function exposureFrom(params: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(params.phoi) ? params.phoi[0] : params.phoi;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 && ms <= 100_000 ? ms : 0;
}

async function FpsTab({ supabase, exposureMs }: { supabase: Awaited<ReturnType<typeof createClient>>; exposureMs: number }) {
  const engine = await loadEngineParams(supabase);
  return <PcFpsTable table={fpsTable(engine.params, exposureMs)} exposureMs={exposureMs} />;
}
