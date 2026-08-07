export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteCache } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    // Auto-merge legacy admin@nhac.ai into karaokestudio2026@gmail.com
    const targetEmail = 'karaokestudio2026@gmail.com';
    const legacyAdmin = await prisma.user.findUnique({ where: { email: 'admin@nhac.ai' } });
    if (legacyAdmin) {
      let targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });
      if (!targetUser) {
        targetUser = await prisma.user.create({
          data: {
            email: targetEmail,
            password: legacyAdmin.password,
            name: 'System Admin',
            role: 'admin',
            credits: 0,
            totalEarned: 0,
            totalSpent: 0
          }
        });
      }

      await prisma.song.updateMany({
        where: { userId: legacyAdmin.id },
        data: { userId: targetUser.id }
      });
      await prisma.transaction.updateMany({
        where: { userId: legacyAdmin.id },
        data: { userId: targetUser.id }
      });

      await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          credits: targetUser.credits + legacyAdmin.credits,
          totalEarned: targetUser.totalEarned + legacyAdmin.totalEarned,
          totalSpent: targetUser.totalSpent + legacyAdmin.totalSpent,
          role: 'admin'
        }
      });

      await prisma.user.delete({ where: { id: legacyAdmin.id } });
      console.log(`[Admin Users API] Auto-merged admin@nhac.ai into ${targetEmail}`);
    }

    // Always enforce admin role, display name 'Admin' and clean zeroed financial metrics for karaokestudio2026@gmail.com in DB
    await prisma.user.updateMany({
      where: { email: 'karaokestudio2026@gmail.com' },
      data: { name: 'Admin', role: 'admin', totalEarned: 0, totalSpent: 0 }
    });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        credits: true,
        totalEarned: true,
        totalSpent: true,
        isActive: true,
        role: true,
        storagePath: true,
        storageLimit: true,
        createdAt: true,
        _count: {
          select: { songs: true }
        }
      }
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, isActive, role, creditsChange, storagePath, storageLimit } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.email.toLowerCase().trim() === 'karaokestudio2026@gmail.com') {
      if (role && role !== 'admin') {
        return NextResponse.json({ error: 'Tài khoản karaokestudio2026@gmail.com là Admin cố định của hệ thống, không thể đổi quyền!' }, { status: 400 });
      }
      if (isActive === false) {
        return NextResponse.json({ error: 'Tài khoản Admin cố định karaokestudio2026@gmail.com không thể bị vô hiệu hóa!' }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = !!isActive;
    if (role !== undefined) updateData.role = role;
    if (storagePath !== undefined) updateData.storagePath = storagePath;
    if (storageLimit !== undefined) updateData.storageLimit = typeof storageLimit === 'number' ? storageLimit : parseInt(storageLimit) || 999999;

    let finalCredits = targetUser.credits;

    const result = await prisma.$transaction(async (tx) => {
      if (creditsChange && typeof creditsChange === 'number') {
        const adjustment = creditsChange;
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            credits: { increment: adjustment },
            totalEarned: adjustment > 0 ? { increment: adjustment } : undefined
          }
        });

        finalCredits = updatedUser.credits;

        await tx.transaction.create({
          data: {
            userId,
            type: adjustment > 0 ? 'deposit' : 'debit',
            amount: Math.abs(adjustment),
            balance: finalCredits,
            note: `Cập nhật bởi Admin (${session.user.email}): ${adjustment > 0 ? '+' : ''}${adjustment} credits`
          }
        });
      }

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: updateData
        });
      }
    });

    // Invalidate Redis cache for user credits
    await deleteCache(`user:credits:${userId}`).catch(console.error);

    return NextResponse.json({ success: true, message: 'Thông tin người dùng đã được cập nhật.' });
  } catch (error: any) {
    console.error('PUT /api/admin/users error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await request.json();
    const { userIds, userId } = body;

    let idsToDelete: string[] = [];
    if (Array.isArray(userIds)) {
      idsToDelete = userIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    } else if (typeof userId === 'string' && userId.trim().length > 0) {
      idsToDelete = [userId.trim()];
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'Không có tài khoản nào được chọn để xóa.' }, { status: 400 });
    }

    // Inspect target users in DB to check roles
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: idsToDelete } },
      select: { id: true, role: true, email: true }
    });

    // Strictly exclude any account with role === 'admin'
    const nonAdminUsers = targetUsers.filter(u => u.role !== 'admin');
    const nonAdminUserIds = nonAdminUsers.map(u => u.id);

    if (nonAdminUserIds.length === 0) {
      return NextResponse.json({
        error: 'Tài khoản Admin quản trị hệ thống được bảo vệ, không thể xóa!'
      }, { status: 400 });
    }

    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: nonAdminUserIds }
      }
    });

    for (const id of nonAdminUserIds) {
      await deleteCache(`user:credits:${id}`).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      count: deleteResult.count,
      message: `Đã xóa ${deleteResult.count} tài khoản người dùng thành công.`
    });
  } catch (error: any) {
    console.error('DELETE /api/admin/users error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
