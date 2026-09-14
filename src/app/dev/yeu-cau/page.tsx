import { notFound } from 'next/navigation';
import { RequirementSummary } from '@/components/requirement/RequirementSummary';
import { isApplicationType } from '@/lib/requirement/draft';

/**
 * Xem trước bảng tóm tắt yêu cầu — CHỈ CHẠY Ở MÁY LOCAL, không cần đăng nhập.
 *
 * Trang thật /thiet-ke-he-thong/yeu-cau nằm sau cổng Member. Component giống
 * hệt, không đọc database; bản nháp chỉ ở sessionStorage của trình duyệt.
 * Thử: /dev/yeu-cau?app=AppearanceInspection
 */
export default async function DevRequirementPreviewPage({ searchParams }: PageProps<'/dev/yeu-cau'>) {
  // Chặn ở production. Trang này là công cụ phát triển, không phải tính năng.
  if (process.env.NODE_ENV === 'production') notFound();

  const { app } = await searchParams;
  const appParam = Array.isArray(app) ? app[0] : app;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-6 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local. Không cần đăng nhập, không đọc database.
      </p>
      <RequirementSummary initialApp={isApplicationType(appParam) ? appParam : null} />
    </section>
  );
}
