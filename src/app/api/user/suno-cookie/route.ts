export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cookie, browserToken } = await request.json();
  if (!cookie || typeof cookie !== 'string') {
    return NextResponse.json({ error: 'Cookie không hợp lệ.' }, { status: 400 });
  }

  const expiresAt: Date | null = null;
  const sunoEmail = extractEmailFromSession(cookie);

  const updateData: Record<string, string | Date | null> = {
    sunoCookie: cookie,
    sunoCookieEmail: sunoEmail,
    sunoCookieExpiresAt: expiresAt,
  };

  if (browserToken && typeof browserToken === 'string') {
    updateData.sunoBrowserToken = browserToken;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    email: sunoEmail || null,
    message: sunoEmail
      ? `Đã kết nối tài khoản Suno: ${sunoEmail}`
      : 'Đã lưu Suno cookie. Không thể xác minh email.',
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { sunoCookie: true, sunoCookieEmail: true, sunoCookieExpiresAt: true, sunoBrowserToken: true },
  });

  const hasCookie = !!user?.sunoCookie;
  const isExpired = user?.sunoCookieExpiresAt
    ? new Date(user.sunoCookieExpiresAt) < new Date()
    : null;

  return NextResponse.json({
    connected: hasCookie,
    email: user?.sunoCookieEmail || null,
    expiresAt: user?.sunoCookieExpiresAt || null,
    isExpired,
    hasBrowserToken: !!user?.sunoBrowserToken,
  });
}

function extractEmailFromSession(cookie: string): string | null {
  const m = cookie.match(/__session=([^;]+)/);
  if (!m) return null;
  try {
    const payload = JSON.parse(atob(m[1].split('.')[1]));
    return payload['suno.com/claims/email'] || null;
  } catch {
    return null;
  }
}
