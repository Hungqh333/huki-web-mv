'use client';

/** Mở hộp thoại in của trình duyệt — chọn "Lưu dưới dạng PDF" để tải PDF. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="pc-print-hide rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}
