export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const songs = await prisma.song.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    const parsedSongs = songs.map((song) => {
      let tracks = [];
      try {
        if (typeof song.tracks === 'string') {
          tracks = JSON.parse(song.tracks);
        } else if (Array.isArray(song.tracks)) {
          tracks = song.tracks;
        }
      } catch (err) {
        console.error('Error parsing song tracks JSON:', err);
      }

      return {
        id: song.id,
        userEmail: song.user?.email || 'Guest',
        userName: song.user?.name || 'Guest',
        prompt: song.prompt || '',
        lyrics: song.lyrics || '',
        title: song.songTitle || '',
        style: song.musicStyle || '',
        mode: song.mode || 'describe',
        outputType: song.outputType || 'vocal',
        vocalGender: song.vocalGender || 'auto',
        status: song.status,
        tracks: tracks,
        createdAt: song.createdAt,
        creditsCost: song.creditsCost,
        error: song.errorMsg || undefined,
        taskId: song.taskId || undefined,
        sunoModel: song.sunoModel || 'v5.5'
      };
    });

    return NextResponse.json({ songs: parsedSongs });
  } catch (error: any) {
    console.error('GET /api/admin/songs error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      await prisma.song.deleteMany({
        where: {
          OR: [
            { status: 'failed' },
            { errorMsg: { not: null } }
          ]
        }
      });
      return NextResponse.json({ success: true, message: 'Đã xóa tất cả nhật ký lỗi!' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID bài hát cần xóa.' }, { status: 400 });
    }

    await prisma.song.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Đã xóa nhật ký lỗi thành công.' });
  } catch (error: any) {
    console.error('DELETE /api/admin/songs error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
