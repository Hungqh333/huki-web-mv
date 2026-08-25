/**
 * Khung xương dùng cho các file loading.tsx.
 *
 * Mọi trang đều là server-rendered động (đọc cookie phiên đăng nhập), nên lần
 * tải đầu luôn có độ trễ chờ Supabase. Hiện khung xương thay vì để trang trắng.
 */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
      <SkeletonLine className="h-4 w-24" />
      <SkeletonLine className="h-5 w-3/4" />
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-5/6" />
    </div>
  );
}

export function SkeletonPage({ cards = 4 }: { cards?: number }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6" aria-busy="true">
      <SkeletonLine className="h-8 w-64" />
      <SkeletonLine className="mt-4 h-4 w-full max-w-xl" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: cards }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </section>
  );
}
