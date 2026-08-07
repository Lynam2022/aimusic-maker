export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCached, setCache, CACHE_TTL } from '@/lib/redis';

// GET /api/user/profile — returns user profile + credits
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cacheKey = `user:credits:${session.user.id}`;
  
  // Try Redis cache first
  const cached = await getCached<{ credits: number }>(cacheKey);
  if (cached) {
    return NextResponse.json({ credits: cached.credits, fromCache: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, credits: true, totalEarned: true, totalSpent: true, createdAt: true }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await setCache(cacheKey, { credits: user.credits }, CACHE_TTL.userCredits);

  return NextResponse.json(user);
}
