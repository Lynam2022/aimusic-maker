import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany();
    const users = await prisma.user.findMany();
    return NextResponse.json({ configs, users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
