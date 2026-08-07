export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SunoClient } from '@/lib/suno';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clipId = searchParams.get('clipId');

    if (!clipId) {
      return NextResponse.json({ error: 'Missing clipId parameter' }, { status: 400 });
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id;

    const waveform = await SunoClient.getWaveformAggregates(clipId, userId);
    return NextResponse.json({ clipId, waveform });
  } catch (error: any) {
    console.error('Waveform API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
