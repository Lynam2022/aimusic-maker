export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s timeout cho Playwright

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { refreshCookieViaPlaywright } from '@/lib/suno-playwright';

/**
 * POST /api/admin/refresh-cookie
 * Dùng Playwright CDP để lấy toàn bộ cookie (kể cả HttpOnly __client)
 * từ suno.com sau khi Clerk tự refresh session.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    console.log('[API] /api/admin/refresh-cookie called');
    const result = await refreshCookieViaPlaywright();

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API] refresh-cookie error:', msg);
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
