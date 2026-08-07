export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json({ error: 'Email và mật khẩu là bắt buộc.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Định dạng email không hợp lệ.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return NextResponse.json({ error: 'Email này đã được đăng ký.' }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user + initial deposit transaction in a single DB transaction
    const initialCredits = Number(process.env.INITIAL_USER_CREDITS) || 20;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: name?.trim() || null,
          credits: initialCredits,
          totalEarned: initialCredits
        }
      });

      // Record the initial grant as a deposit transaction
      await tx.transaction.create({
        data: {
          userId: newUser.id,
          type: 'deposit',
          amount: initialCredits,
          balance: initialCredits,
          note: `Tặng ${initialCredits} credits khi đăng ký tài khoản mới`
        }
      });

      return newUser;
    });

    return NextResponse.json({
      success: true,
      message: 'Đăng ký thành công! Bạn được tặng 20 credits.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống. Vui lòng thử lại.' }, { status: 500 });
  }
}
