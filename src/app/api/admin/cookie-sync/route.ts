export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { syncCookieFromBrowser } from '@/lib/suno-browser';

export async function GET() {
  try {
    const result = await syncCookieFromBrowser();
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Đã tự động đồng bộ Cookie Suno mới nhất từ Chrome tab vào hệ thống thành công!',
        cookieLength: result.cookie?.length || 0,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message || 'Không thể lấy Cookie từ trình duyệt. Hãy chắc chắn tab suno.com/create đang mở trên Chrome.',
      }, { status: 400 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
