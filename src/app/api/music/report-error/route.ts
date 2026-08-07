export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await request.json();
    const { songTitle, musicStyle, errorMsg, sunoModel } = body;

    // Check if there is already a recent queued song for this user to update, or create a failed song record
    const recentSong = await prisma.song.findFirst({
      where: { userId, status: 'queued' },
      orderBy: { createdAt: 'desc' }
    });

    if (recentSong) {
      await prisma.song.update({
        where: { id: recentSong.id },
        data: {
          status: 'failed',
          errorMsg: errorMsg || 'Lỗi kết nối từ phía máy chủ / Phiên kết nối hết hạn'
        }
      });
    } else {
      await prisma.song.create({
        data: {
          userId,
          songTitle: songTitle || 'Mây Của Anh',
          musicStyle: musicStyle || 'Remix',
          status: 'failed',
          creditsCost: 10,
          errorMsg: errorMsg || 'Lỗi kết nối từ phía máy chủ / Phiên kết nối hết hạn',
          sunoModel: sunoModel || 'remix'
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/music/report-error error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
