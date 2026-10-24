/** Huy hiệu kết quả thực nghiệm (Đạt / Đạt có điều kiện / Chưa đạt / chưa đánh giá) — dùng ở trang Chọn đèn và trang thực nghiệm. */
const VERDICT_CLASS: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  conditional: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  fail: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  none: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function VerdictBadge({ verdict, label }: { verdict: string | null; label: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${VERDICT_CLASS[verdict ?? 'none'] ?? VERDICT_CLASS.none}`}>{label}</span>;
}
