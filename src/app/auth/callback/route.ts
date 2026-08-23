import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Đích đến của link xác nhận email do Supabase gửi. Đổi `code` lấy session rồi
 * đưa người dùng về trang tài khoản.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/tai-khoan';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Chỉ cho phép redirect nội bộ, tránh open redirect.
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/tai-khoan';
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/dang-nhap?error=auth_callback`);
}
