import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnvOptional } from './env';

/**
 * Làm mới access token của Supabase trên mỗi request và ghi cookie mới vào
 * response. Không có bước này, session sẽ hết hạn giữa chừng ở Server Component.
 *
 * Lưu ý: middleware KHÔNG phải là lớp phân quyền. Việc chặn truy cập nằm ở RLS
 * trong database (xem supabase/migrations). Ở đây chỉ giữ session cho đúng.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const env = getSupabaseEnvOptional();

  // Chưa cấu hình Supabase -> bỏ qua, để app vẫn chạy được ở chế độ khách.
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Bắt buộc gọi getUser() (không phải getSession()) để token thực sự được
  // xác thực lại với server Supabase.
  await supabase.auth.getUser();

  return response;
}
