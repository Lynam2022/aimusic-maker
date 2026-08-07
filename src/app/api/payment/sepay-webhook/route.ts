export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deleteCache } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    // ── Get the authorization header or query parameters ───────────────────────────
    const authHeader = request.headers.get('authorization') || '';
    
    // Retrieve SePay config
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['sepay_api_key', 'credits_per_1000_vnd'] }
      }
    });
    
    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const expectedApiKey = configMap.sepay_api_key || '';
    const creditsPer1000Vnd = Number(configMap.credits_per_1000_vnd || '9');

    // ── Xác thực SePay API Key ──────────────────────────────────────────────
    // SePay gửi header: "Authorization: Apikey <key>"
    if (!expectedApiKey) {
      // Chưa cấu hình API key → từ chối để tránh fake webhook
      console.warn('[SePay Webhook] API key chưa được cấu hình trong admin. Từ chối request.');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const cleanToken = authHeader.replace(/^Apikey\s+/i, '').trim();
    const tokenMatch = cleanToken === expectedApiKey || authHeader.trim() === expectedApiKey;
    if (!tokenMatch) {
      console.warn('[SePay Webhook] Unauthorized request. Token mismatch. Header:', authHeader.substring(0, 30));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    console.log('[SePay Webhook] Received payload:', payload);

    // SePay thực tế gửi: transferType, transferAmount, content, code, id
    // (không phải transactionContent)
    const { 
      transferType, 
      transferAmount, 
      content: transactionContent,   // SePay field: "content"
      code: sepaySenderCode,         // SePay field: "code" (e.g. "LYDNGSYTY")
      id: sepayTxId 
    } = payload;

    // Check if it's an incoming money transaction
    if (transferType !== 'in') {
      return NextResponse.json({ success: true, message: 'Not an incoming transfer' });
    }

    const amount = Number(transferAmount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Parse user code: ưu tiên field "code" (LYDXXXXXX), fallback sang "content"
    let userCode: string | null = null;

    // Thử từ field "code" trực tiếp (e.g. "LYDNGSYTY")
    const codeMatch = sepaySenderCode?.match(/LYD([A-Z0-9]{6})/i);
    if (codeMatch) {
      userCode = codeMatch[1].toLowerCase();
    }

    // Fallback: parse từ nội dung giao dịch
    if (!userCode) {
      const contentMatch = transactionContent?.match(/LYD([A-Z0-9]{6})/i);
      if (contentMatch) {
        userCode = contentMatch[1].toLowerCase();
      }
    }

    if (!userCode) {
      console.warn('[SePay Webhook] No matching user code. code:', sepaySenderCode, '| content:', transactionContent);
      return NextResponse.json({ error: 'User code not found in memo' }, { status: 400 });
    }

    console.log('[SePay Webhook] Parsed user code:', userCode);

    // Find the user whose ID ends with this 6-character suffix
    const user = await prisma.user.findFirst({
      where: {
        id: {
          endsWith: userCode
        }
      }
    });

    if (!user) {
      console.error('[SePay Webhook] No user found matching code:', userCode);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Deduplicate transaction to avoid double crediting
    const existingTx = await prisma.transaction.findFirst({
      where: {
        note: {
          contains: `SePay ID: ${sepayTxId}`
        }
      }
    });

    if (existingTx) {
      console.log('[SePay Webhook] Transaction already processed:', sepayTxId);
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Calculate credits: amount / 1000 * credits_per_1000_vnd (rounded to nearest integer)
    const creditsToAdd = Math.round((amount / 1000) * creditsPer1000Vnd);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { increment: creditsToAdd },
          totalEarned: { increment: creditsToAdd }
        }
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount: creditsToAdd,
          balance: u.credits,
          vndAmount: amount,
          note: `Nạp tự động SePay. Số tiền: ${amount.toLocaleString('vi-VN')} VNĐ. SePay ID: ${sepayTxId}`
        }
      });

      return u;
    });

    // Invalidate Redis user credits cache
    await deleteCache(`user:credits:${user.id}`);

    console.log(`[SePay Webhook] Successfully credited user ${user.email} with ${creditsToAdd} Credits.`);
    return NextResponse.json({ success: true, message: 'Successfully credited' });

  } catch (error: any) {
    console.error('[SePay Webhook] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
