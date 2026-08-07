export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SunoClient } from '@/lib/suno';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = session && (session.user.role === 'admin' || session.user.email?.toLowerCase().trim() === 'karaokestudio2026@gmail.com');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const balance = await SunoClient.getSunoBalance();
    if (!balance) {
      return NextResponse.json({ error: 'Không thể lấy số dư tài khoản Suno. Vui lòng kiểm tra cấu hình Cookie.' }, { status: 500 });
    }

    return NextResponse.json(balance);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('GET /api/admin/suno-balance error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
