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

/**
 * Gọi Clerk API để lấy __session JWT mới, cập nhật vào DB.
 * Điều kiện: __client còn hợp lệ (dùng làm Authorization).
 */
async function autoRefreshSessionInDB(cookie: string): Promise<{
  refreshed: boolean;
  newSessionExpiry?: string;
  error?: string;
}> {
  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // Lấy __client token để dùng làm Authorization
    const clientMatch = cookie.match(/(?:^|;)\s*__client\s*=\s*([^;]+)/);
    const clientToken = clientMatch ? clientMatch[1].trim() : null;

    if (!clientToken) {
      return {
        refreshed: false,
        error: '__client token không tồn tại trong cookie — cần Auto-Refresh bằng Playwright.',
      };
    }

    const headers: Record<string, string> = {
      'Cookie': cookie,
      'User-Agent': ua,
      'Origin': 'https://suno.com',
      'Referer': 'https://suno.com/',
      'Authorization': clientToken,
      'accept': '*/*',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
    };

    // Thử auth.suno.com (mới) rồi fallback clerk.suno.com (cũ)
    const endpoints = [
      {
        client: `https://auth.suno.com/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=5.117.0`,
        token: (sid: string) =>
          `https://auth.suno.com/v1/client/sessions/${sid}/tokens?__clerk_api_version=2025-11-10&_clerk_js_version=5.117.0`,
        label: 'auth.suno.com',
      },
      {
        client: `https://clerk.suno.com/v1/client?_clerk_js_version=4.73.2`,
        token: (sid: string) =>
          `https://clerk.suno.com/v1/client/sessions/${sid}/tokens?_clerk_js_version=4.73.2`,
        label: 'clerk.suno.com',
      },
    ];

    let jwt: string | null = null;
    for (const ep of endpoints) {
      try {
        const clientRes = await fetch(ep.client, { headers });
        if (!clientRes.ok) {
          console.warn(`[CookieInfo] Clerk ${ep.label} client: ${clientRes.status}`);
          continue;
        }
        const clientData = await clientRes.json();
        const sessionId = clientData?.response?.last_active_session_id;
        if (!sessionId) {
          console.warn(`[CookieInfo] Clerk ${ep.label}: no active session_id`);
          continue;
        }

        const tokenRes = await fetch(ep.token(sessionId), { method: 'POST', headers });
        if (!tokenRes.ok) {
          console.warn(`[CookieInfo] Clerk ${ep.label} token: ${tokenRes.status}`);
          continue;
        }
        const tokenData = await tokenRes.json();
        jwt = tokenData?.jwt || tokenData?.response?.jwt;
        if (jwt) {
          console.log(`[CookieInfo] ✅ Clerk refresh OK via ${ep.label}`);
          break;
        }
      } catch (e) {
        console.warn(`[CookieInfo] Clerk ${ep.label} error:`, e instanceof Error ? e.message : e);
      }
    }

    if (!jwt) {
      return {
        refreshed: false,
        error: 'Clerk refresh thất bại ở tất cả endpoints. __client có thể đã hết hạn — dùng nút Auto-Refresh (Playwright).',
      };
    }

    // Build updated cookie: xóa __session cũ, thêm jwt mới vào đầu
    let updatedCookie = cookie
      .replace(/(?:^|;)\s*__session\s*=[^;]*/g, '')
      .replace(/(?:^|;)\s*__session_[^=]+=?[^;]*/g, '')
      .replace(/^;\s*/, '')
      .replace(/;\s*;/g, ';')
      .trim();
    updatedCookie = `__session=${jwt}; ${updatedCookie}`;

    // Lưu vào DB
    await prisma.systemConfig.upsert({
      where: { key: 'suno_cookie' },
      update: { value: updatedCookie },
      create: { key: 'suno_cookie', value: updatedCookie },
    });

    const newExpiry = parseJwtExpiry(jwt);
    console.log(`[CookieInfo] ✅ __session saved to DB. New expiry: ${newExpiry?.toISOString()}`);

    return {
      refreshed: true,
      newSessionExpiry: newExpiry?.toISOString() || undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[CookieInfo] autoRefreshSessionInDB error:', msg);
    return { refreshed: false, error: msg };
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    // Lấy cookie từ DB (ưu tiên) hoặc ENV
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

    let info = analyzeCookie(cookieValue);
    const proxy = getProxyInfo();
    let autoRefresh: { refreshed: boolean; newSessionExpiry?: string; error?: string } | null = null;

    // ✨ Auto-refresh: Nếu __session hết hạn/thiếu nhưng __client còn OK → refresh qua Clerk API
    if (cookieValue && info && !info.sessionOk && info.hasClient && info.clientOk) {
      console.log('[CookieInfo] __session expired/missing but __client valid → auto-refreshing via Clerk...');
      autoRefresh = await autoRefreshSessionInDB(cookieValue);

      if (autoRefresh.refreshed) {
        // Re-read cookie mới từ DB
        const updatedConfig = await prisma.systemConfig.findUnique({ where: { key: 'suno_cookie' } });
        if (updatedConfig?.value) {
          cookieValue = updatedConfig.value;
          info = analyzeCookie(cookieValue);
        }
      }
    }

    return NextResponse.json({
      source: cookieSource,
      info: info || { isSet: false, totalLength: 0 },
      proxy,
      autoRefresh,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
