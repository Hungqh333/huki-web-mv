import { FormulaBookView } from '@/components/admin/FormulaBookView';
import { loadEngineParams } from '@/lib/engineParamsLoad';
import { createClient } from '@/lib/supabase/server';

/**
 * Sổ tay công thức (chốt 2026-10-20) — mọi phép tính thiết bị trên MỘT trang, chỉ admin
 * (cổng ở admin/layout.tsx). Ngưỡng và bảng đọc giá trị ĐANG CHẠY.
 */
export default async function FormulaBookPage() {
  const supabase = await createClient();
  const loaded = await loadEngineParams(supabase);
  return <FormulaBookView loaded={loaded} />;
}
