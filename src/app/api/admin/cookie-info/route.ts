export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getProxyInfo } from '@/lib/suno-proxy';

function parseJwtExpiry(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const jsonStr = typeof Buffer !== 'undefined'
      ? Buffer.from(b64, 'base64').toString('utf-8')
      : atob(b64);
    const payload = JSON.parse(jsonStr);
    return payload.exp ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

function analyzeCookie(cookie: string) {
  if (!cookie || cookie === '••••••••') return null;

  const hasClient = /__client\s*=/.test(cookie);
  const hasSession = /__session\s*=/.test(cookie);
  const hasSessionId = /sessionid\s*=/.test(cookie);

  // Extract __client token length
  const clientMatch = cookie.match(/(?:^|;)\s*__client\s*=\s*([^;]+)/);
  const clientLen = clientMatch ? clientMatch[1].trim().length : 0;

  // Extract __client ID from JWT payload
  let clientId: string | null = null;
  if (clientMatch) {
    try {
      const parts = clientMatch[1].trim().split('.');
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad) b64 += '='.repeat(4 - pad);
      const jsonStr = typeof Buffer !== 'undefined'
        ? Buffer.from(b64, 'base64').toString('utf-8')
        : atob(b64);
      const payload = JSON.parse(jsonStr);
      clientId = payload['suno.com/claims/client_id'] || null;
    } catch { }
  }

  // Extract __client expiry
  let clientExpiry: Date | null = null;
  if (clientMatch) {
    clientExpiry = parseJwtExpiry(clientMatch[1].trim());
  }

  // Extract __session expiry
  let sessionExpiry: Date | null = null;
  const sessionMatch = cookie.match(/(?:^|;)\s*__session\s*=\s*([^;]+)/);
  if (sessionMatch) {
    sessionExpiry = parseJwtExpiry(sessionMatch[1].trim());
  }

  // Extract sessionid
  const sessionIdMatch = cookie.match(/(?:^|;)\s*sessionid\s*=\s*([^;]+)/);
  const sessionId = sessionIdMatch ? sessionIdMatch[1].trim().substring(0, 8) + '...' : null;

  // Extract device ID
  const deviceMatch = cookie.match(/ajs_anonymous_id\s*=\s*([^;]+)/);
  const deviceId = deviceMatch ? deviceMatch[1].trim() : null;

  const now = new Date();
  const clientOk = clientExpiry ? clientExpiry > now : false;
  const sessionOk = sessionExpiry ? sessionExpiry > now : false;

  return {
    totalLength: cookie.length,
    hasClient,
    hasSession,
    hasSessionId,
    clientLen,
    clientId,
    clientExpiry: clientExpiry?.toISOString() || null,
    clientOk,
    sessionExpiry: sessionExpiry?.toISOString() || null,
    sessionOk,
    sessionId,
    deviceId,
    isSet: true,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    // Get cookie from DB (priority: systemConfig > ENV)
    let cookieSource = 'none';
    let cookieValue = '';

    const dbConfig = await prisma.systemConfig.findUnique({ where: { key: 'suno_cookie' } });
    if (dbConfig?.value) {
      cookieValue = dbConfig.value;
      cookieSource = 'database';
    } else if (process.env.SUNO_COOKIE) {
      cookieValue = process.env.SUNO_COOKIE;
      cookieSource = 'env';
    }

    const info = analyzeCookie(cookieValue);
    const proxy = getProxyInfo();

    return NextResponse.json({
      source: cookieSource,
      info: info || { isSet: false, totalLength: 0 },
      proxy,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
