export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ history: [] });
    }

    // Automatically delete/cleanup songs that have been stuck in 'queued' or 'processing' for more than 5 minutes
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await prisma.song.deleteMany({
        where: {
          userId,
          status: { in: ['queued', 'processing'] },
          createdAt: { lt: fiveMinutesAgo }
        }
      });
    } catch (err) {
      console.error('Error cleaning up stuck songs:', err);
    }

    const songs = await prisma.song.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const history = songs.map((song) => {
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
        prompt: song.prompt || '',
        lyrics: song.lyrics || '',
        title: song.songTitle || '',
        style: song.musicStyle || '',
        mode: song.mode || 'describe',
        outputType: song.outputType || 'vocal',
        vocalGender: song.vocalGender || 'auto',
        status: song.status,
        tracks: tracks,
        createdAt: new Date(song.createdAt).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        creditsCost: song.creditsCost,
        error: song.errorMsg || undefined,
        taskId: song.taskId || undefined,
        sunoModel: song.sunoModel || undefined
      };
    });

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('GET /api/music/history error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ success: true, message: 'Guest delete ok' });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Ensure the song belongs to the current user
    const song = await prisma.song.findFirst({
      where: { id, userId }
    });

    if (song) {
      await prisma.song.delete({
        where: { id }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/music/history error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { songId, tracks } = body;

    if (!songId || !tracks) {
      return NextResponse.json({ error: 'songId and tracks are required' }, { status: 400 });
    }

    await prisma.song.updateMany({
      where: { id: songId, userId },
      data: {
        tracks: typeof tracks === 'string' ? tracks : JSON.stringify(tracks)
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/music/history error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
