export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteCache } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = session && (session.user.role === 'admin' || session.user.email?.toLowerCase().trim() === 'karaokestudio2026@gmail.com');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const transactions = await prisma.transaction.findMany({
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

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('GET /api/admin/transactions error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = session && (session.user.role === 'admin' || session.user.email?.toLowerCase().trim() === 'karaokestudio2026@gmail.com');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, amount, vndAmount, note } = body;

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'userId and positive amount are required' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          credits: { increment: amount },
          totalEarned: { increment: amount }
        }
      });

      return await tx.transaction.create({
        data: {
          userId,
          type: 'deposit',
          amount,
          balance: updatedUser.credits,
          vndAmount: vndAmount ? parseInt(vndAmount) : undefined,
          note: note || `Admin deposit: +${amount} credits`
        }
      });
    });

    // Invalidate Redis cache
    await deleteCache(`user:credits:${userId}`).catch(console.error);

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: any) {
    console.error('POST /api/admin/transactions error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
