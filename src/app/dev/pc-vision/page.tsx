import { notFound } from 'next/navigation';
import { suggestPcDevAction } from '@/app/actions/pcSuggest';
import { PcCatalog } from '@/components/pc/PcCatalog';
import { PcChecklist } from '@/components/pc/PcChecklist';
import { PcFpsTable } from '@/components/pc/PcFpsTable';
import { PcSuggest } from '@/components/pc/PcSuggest';
import { readPcSeed } from '@/lib/pc/devSeed';
import { fpsTable } from '@/lib/pc/fps';
import { pcPowerModel } from '@/lib/pc/power';
import { DEFAULT_ENGINE_PARAMS } from '@/lib/vision/engineParams';

/**
 * Xem trước tab Danh mục và Gợi ý của PC Vision — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập, dữ liệu
 * đọc từ supabase/seed_pc.sql. Nút Lưu ở đây không ghi được (không có phiên Admin). Trang thật
 * /cong-cu-may-tinh nằm sau cổng Member và đọc bảng pc_frames / pc_configs.
 */
export default async function DevPcVisionPage({ searchParams }: PageProps<'/dev/pc-vision'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const member = query.xem === 'member';
  const tab = query.tab;
  const exposure = Number(query.phoi) > 0 ? Number(query.phoi) : 0;
  const { frames, configs } = readPcSeed();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Dữ liệu từ seed_pc.sql, nút Lưu không ghi được.
      </p>
      <p className="-mt-2 mb-6 text-xs text-slate-500 dark:text-slate-400">
        <a href="?" className="text-sky-700 hover:underline dark:text-sky-400">Danh mục (Admin)</a>
        {' · '}
        <a href="?xem=member" className="text-sky-700 hover:underline dark:text-sky-400">Danh mục (Member)</a>
        {' · '}
        <a href="?tab=goi-y" className="text-sky-700 hover:underline dark:text-sky-400">Gợi ý cấu hình</a>
        {' · '}
        <a href="?tab=fps" className="text-sky-700 hover:underline dark:text-sky-400">Bảng fps</a>
        {' · '}
        <a href="?tab=checklist" className="text-sky-700 hover:underline dark:text-sky-400">Checklist</a>
      </p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">PC Vision</h1>
      {tab === 'goi-y' ? (
        <PcSuggest frames={frames} configs={configs} run={suggestPcDevAction} />
      ) : tab === 'fps' ? (
        <PcFpsTable table={fpsTable(DEFAULT_ENGINE_PARAMS, exposure)} exposureMs={exposure} />
      ) : tab === 'checklist' ? (
        <PcChecklist />
      ) : (
        <PcCatalog
          frames={frames}
          configs={configs}
          admin={!member}
          power={member ? null : pcPowerModel(DEFAULT_ENGINE_PARAMS)}
          issuedCodes={configs.map((c) => c.code)}
        />
      )}
    </section>
  );
}
