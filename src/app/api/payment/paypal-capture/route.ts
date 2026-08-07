export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteCache } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, usdAmount } = body;

    if (!orderId || !usdAmount) {
      return NextResponse.json({ error: 'Missing orderId or usdAmount' }, { status: 400 });
    }

    // Retrieve PayPal keys & Exchange rate from settings
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['paypal_client_id', 'paypal_client_secret', 'paypal_mode', 'credits_per_1_usd'] }
      }
    });

    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const paypalClientId = configMap.paypal_client_id || 'sandbox';
    const paypalClientSecret = configMap.paypal_client_secret || '';
    const paypalMode = configMap.paypal_mode || 'sandbox';
    const creditsPerUsd = Number(configMap.credits_per_1_usd || '25');

    const creditsToAdd = Math.round(Number(usdAmount) * creditsPerUsd);

    // ── Call PayPal API to capture / verify the transaction ────────────────────────
    let captureSuccess = false;
    let transactionId = orderId;

    if (paypalClientSecret && paypalClientId && paypalClientId !== 'sandbox') {
      try {
        const isLive = paypalMode === 'live';

        // Authenticate with PayPal
        const authUrl = isLive
          ? 'https://api-m.paypal.com/v1/oauth2/token'
          : 'https://api-m.sandbox.paypal.com/v1/oauth2/token';

        const authResponse = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        });

        if (authResponse.ok) {
          const authData = await authResponse.json();
          const accessToken = authData.access_token;

          // Capture the order
          const captureUrl = isLive
            ? `https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`
            : `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`;

          const captureResponse = await fetch(captureUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (captureResponse.ok) {
            const captureData = await captureResponse.json();
            if (captureData.status === 'COMPLETED') {
              captureSuccess = true;
              transactionId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
            }
          } else {
            // Check if already captured
            const getOrderUrl = isLive
              ? `https://api-m.paypal.com/v2/checkout/orders/${orderId}`
              : `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`;

            const getOrderResponse = await fetch(getOrderUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });

            if (getOrderResponse.ok) {
              const orderData = await getOrderResponse.json();
              if (orderData.status === 'COMPLETED' || orderData.status === 'APPROVED') {
                captureSuccess = true;
              }
            }
          }
        }
      } catch (err) {
        console.error('[PayPal Capture] Failed to verify with PayPal API:', err);
      }
    } else {
      // Sandbox/Simulator mode (always succeeds for development convenience if credentials are not configured)
      console.log('[PayPal Capture] Simulated sandbox verification.');
      captureSuccess = true;
    }

    if (!captureSuccess) {
      return NextResponse.json({ error: 'Failed to verify PayPal transaction' }, { status: 400 });
    }

    // Deduplicate transaction to avoid double crediting
    const existingTx = await prisma.transaction.findFirst({
      where: {
        note: {
          contains: `PayPal Ref: ${transactionId}`
        }
      }
    });

    if (existingTx) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Update user credits
    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          credits: { increment: creditsToAdd },
          totalEarned: { increment: creditsToAdd }
        }
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'deposit',
          amount: creditsToAdd,
          balance: u.credits,
          vndAmount: Math.round(Number(usdAmount) * 25000), // Approximate VNĐ equivalent
          note: `Nạp PayPal. Số tiền: ${usdAmount} USD. PayPal Ref: ${transactionId}`
        }
      });

      return u;
    });

    // Invalidate Redis user credits cache
    await deleteCache(`user:credits:${userId}`);

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: updatedUser.credits
    });

  } catch (error: any) {
    console.error('[PayPal Capture] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
