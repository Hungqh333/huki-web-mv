import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16 đổi tên quy ước "middleware" thành "proxy".
 * Nhiệm vụ duy nhất ở đây: làm mới cookie session của Supabase.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Chạy trên mọi đường dẫn trừ file tĩnh và ảnh, để cookie session luôn
     * được làm mới trước khi Server Component đọc user.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
