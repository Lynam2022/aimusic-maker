export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCached, setCache, CACHE_TTL } from '@/lib/redis';
import { SunoClient } from '@/lib/suno';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
    }

    // ── Check Redis cache first ───────────────────────────
    const cacheKey = `song:status:${taskId}`;
    const cached = await getCached<{ status: string; tracks: unknown[] }>(cacheKey);
    if (cached?.status === 'completed') {
      return NextResponse.json(cached);
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id;

    const { status, tracks } = await SunoClient.checkStatus(taskId, userId);

    // ── If completed, persist to DB and cache ─────────────
    if (status === 'completed' && tracks) {
      let finalTracks = tracks;
      if (userId) {
        try {
          const { uploadTrackFiles } = await import('@/lib/storage');
          finalTracks = await uploadTrackFiles(tracks, userId);
        } catch (err) {
          console.error('[Status] Error persisting files to storage:', err);
        }

        await prisma.song.updateMany({
          where: { taskId, userId },
          data: {
            status: 'completed',
            tracks: JSON.stringify(finalTracks)
          }
        });
      }

      // Cache the completed result (no expiry needed for completed)
      await setCache(cacheKey, { status: 'completed', tracks: finalTracks }, CACHE_TTL.songStatus);

      return NextResponse.json({ status: 'completed', tracks: finalTracks });
    }

    if (status === 'failed') {
      if (userId) {
        await prisma.song.updateMany({
          where: { taskId, userId },
          data: { status: 'failed' }
        });
      }
      return NextResponse.json({ status: 'failed' });
    }

    if (status === 'processing' && tracks && tracks.length > 0) {
      if (userId) {
        await prisma.song.updateMany({
          where: { taskId, userId },
          data: {
            tracks: JSON.stringify(tracks)
          }
        });
      }
      return NextResponse.json({ status: 'processing', tracks });
    }

    return NextResponse.json({ status: 'processing' });

  } catch (error: unknown) {
    console.error('GET /api/music/status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
