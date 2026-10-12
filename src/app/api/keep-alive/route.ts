import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnvOptional } from '@/lib/supabase/env';

/**
 * Giữ database Supabase không bị tạm dừng.
 *
 * Gói miễn phí tự dừng dự án sau 7 ngày không có truy vấn nào — 2026-10-12 web mất
 * database đúng vì thế (lần cuối có hoạt động 2026-10-05). Vercel Cron gọi route này
 * mỗi ngày (vercel.json); một câu đọc nhẹ qua REST là đủ tính "có hoạt động".
 *
 * Chỉ đọc view công khai article_previews, giới hạn 1 dòng, bằng anon key — không lộ
 * gì hơn thứ trang cẩm nang vốn đã cho khách xem. Đặt CRON_SECRET trên Vercel thì
 * route chỉ nhận lời gọi kèm đúng mã đó (Vercel Cron tự gửi header Authorization).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const env = getSupabaseEnvOptional();
  if (!env) return NextResponse.json({ ok: false, error: 'no_supabase_env' }, { status: 500 });

  try {
    const response = await fetch(`${env.url}/rest/v1/article_previews?select=slug&limit=1`, {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    console.info('[keep-alive]', response.status);
    return NextResponse.json({ ok: response.ok, status: response.status }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    console.error('[keep-alive]', name);
    return NextResponse.json({ ok: false, error: name }, { status: 502 });
  }
}
