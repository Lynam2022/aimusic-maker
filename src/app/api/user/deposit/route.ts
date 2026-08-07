export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/user/deposit — simulates a VNĐ -> credits deposit
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { vndAmount } = await request.json();
  const amount = Number(vndAmount);

  if (!amount || amount < 10000) {
    return NextResponse.json({ error: 'Số tiền nạp tối thiểu là 10.000 VNĐ.' }, { status: 400 });
  }

  // 10,000 VNĐ = 10 Credits
  const creditsToAdd = Math.floor(amount / 1000);

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: session.user.id },
      data: {
        credits: { increment: creditsToAdd },
        totalEarned: { increment: creditsToAdd }
      }
    });

    await tx.transaction.create({
      data: {
        userId: session.user.id,
        type: 'deposit',
        amount: creditsToAdd,
        balance: user.credits,
        vndAmount: amount,
        note: `Nạp ${amount.toLocaleString('vi-VN')} VNĐ = ${creditsToAdd} Credits`
      }
    });

    return user;
  });

  return NextResponse.json({
    success: true,
    creditsAdded: creditsToAdd,
    newBalance: updatedUser.credits,
    message: `Đã nạp ${creditsToAdd} Credits thành công.`
  });
}
