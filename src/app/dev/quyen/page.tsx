import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { PermissionMatrix } from '@/components/admin/PermissionMatrix';

/**
 * Xem trước bảng quyền của Admin → Người dùng ở máy local, không cần đăng nhập Admin.
 * Ô chọn mức chỉ đổi trên màn hình (preview), không lưu. Chữ 'admin' bị loại khỏi provider gốc
 * (chỉ layout Admin nạp) → trang này tự nạp phần bảng quyền.
 */
export default async function DevPermissionsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const messages = (await getMessages()) as Record<string, Record<string, unknown>>;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Trang xem trước chỉ có ở máy local — bảng quyền như trên Admin → Người dùng (ô chọn mức không lưu).
      </p>
      <NextIntlClientProvider messages={{ admin: { permissions: messages.admin.permissions }, roles: messages.roles }}>
        <PermissionMatrix preview />
      </NextIntlClientProvider>
    </main>
  );
}
