import { Track } from '@/store/musicStore';
import { prisma } from './db';
import { proxyFetch } from './suno-proxy';
// generateViaBrowser is dynamically imported inside the generate() method to avoid Next.js bundler issues

export const SUNO_PRESET_MODELS = [
  { id: 'chirp-v3-5', label: 'v3.5' },
  { id: 'chirp-v4', label: 'v4' },
  { id: 'chirp-auk-turbo', label: 'v4.5' },
  { id: 'chirp-v5', label: 'v5' },
  { id: 'chirp-fenix', label: 'v5.5' },
] as const;

export const SUNO_API_MODEL_MAP: Record<string, string> = {
  'chirp-v3-5': 'V3_5',
  'chirp-v4': 'V4',
  'chirp-auk-turbo': 'V4_5ALL',
  'chirp-v5': 'V5',
  'chirp-fenix': 'V5_5',
};

export function cleanChords(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[[^\]]+\]/g, (match) => {
      const content = match.slice(1, -1).trim().toLowerCase();
      const preserveKeywords = [
        'verse', 'chorus', 'pre-chorus', 'bridge', 'outro', 'intro', 'drop', 'hook',
        'build-up', 'breakdown', 'flow', 'rap', 'hip-hop', 'hiphop', 'solo',
        'rubato', 'vibrato', 'voice crack', 'vocal', 'giọng', 'male', 'female'
      ];
      if (preserveKeywords.some(kw => content.includes(kw))) {
        return match;
      }
      return '';
    })
    .replace(/-{2,}/g, '-')
    .replace(/:\s*-+/g, ':')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export { parseSunoError } from './suno-error';

export function obfuscateLyrics(text: string): string {
  if (!text) return '';

  // 1. Strip chord bracket notations (e.g. [Am7], [Cmaj7], [G/B]) so Suno doesn't try to sing them
  const cleanText = cleanChords(text);

  // 2. Safe Cyrillic / Homoglyph mapping that doesn't break Suno audio pronunciation
  const homoglyphMap: Record<string, string> = {
    'a': '\u0430', 'e': '\u0435', 'o': '\u043e', 'p': '\u0440',
    'A': '\u0410', 'E': '\u0415', 'O': '\u041e', 'P': '\u0420'
  };

  // 3. Process line by line: convert spaces between words to underscores '_' (e.g. bàn_tay_cao)
  // while preserving structural tags like [Verse], [Chorus], [Intro], etc.
  return cleanText.split('\n').map(line => {
    const trimmed = line.trim();
    // Keep section bracket headers unchanged (e.g. [Verse 1], [Chorus])
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed;
    }

    return line.split(' ').map(word => {
      // Don't modify bracketed tokens inside lines
      if (word.startsWith('[') && word.endsWith(']')) {
        return word;
      }
      // Apply homoglyph substitution on regular word characters
      return word.split('').map(char => homoglyphMap[char] || char).join('');
    }).filter(Boolean).join('_');
  }).join('\n');
}

export type PresetSunoModel = (typeof SUNO_PRESET_MODELS)[number]['id'];

export interface GenerateParams {
  prompt?: string;
  lyrics?: string;
  bypassLyrics?: boolean;
  mode: 'describe' | 'lyrics';
  outputType: 'vocal' | 'instrumental';
  vocalGender: 'auto' | 'female' | 'male';
  style?: string;
  title?: string;
  styleWeight?: number;
  creativity?: number;
  audioQuality?: number;
  negativeTags?: string;
  sunoModel?: string;
  userId?: string;
  referenceFile?: { data: string; name: string; type: string };
  referenceFileId?: string;
  referenceFileType?: string;
  referenceMode?: 'cover' | 'extend' | 'style';
  continueAt?: number;
}

const referenceFileMap = new Map<string, string>();

function applyAdvancedSettings(
  style: string,
  prompt: string,
  styleWeight: number = 0.5,
  creativity: number = 0.3,
  audioQuality: number = 0.5,
  negativeTags: string = ''
): { style: string; prompt: string } {
  let finalStyle = style || '';
  let finalPrompt = prompt || '';

  // 1. Process Negative Tags (filter out words from style and prompt)
  if (negativeTags) {
    const negWords = negativeTags
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);

    if (negWords.length > 0) {
      if (finalStyle) {
        let styleParts = finalStyle.split(',').map(s => s.trim());
        styleParts = styleParts.filter(part => {
          const partLower = part.toLowerCase();
          return !negWords.some(negWord => partLower.includes(negWord));
        });
        finalStyle = styleParts.join(', ');
      }
      if (finalPrompt) {
        let promptParts = finalPrompt.split(',').map(p => p.trim());
        promptParts = promptParts.filter(part => {
          const partLower = part.toLowerCase();
          return !negWords.some(negWord => partLower.includes(negWord));
        });
        finalPrompt = promptParts.join(', ');
      }
    }
  }

  // 2. Process Audio Quality
  if (audioQuality > 0.6) {
    const qualityTags = ['studio master', 'high fidelity', 'clear mix'];
    for (const tag of qualityTags) {
      if (!finalStyle.toLowerCase().includes(tag)) {
        finalStyle = finalStyle ? `${finalStyle}, ${tag}` : tag;
      }
    }
  } else if (audioQuality < 0.4) {
    const loFiTags = ['lo-fi', 'vintage tape warmth'];
    for (const tag of loFiTags) {
      if (!finalStyle.toLowerCase().includes(tag)) {
        finalStyle = finalStyle ? `${finalStyle}, ${tag}` : tag;
      }
    }
  }

  // 3. Process Creativity
  if (creativity > 0.6) {
    const creativeTags = ['experimental arrangement', 'unconventional melody'];
    for (const tag of creativeTags) {
      if (!finalStyle.toLowerCase().includes(tag)) {
        finalStyle = finalStyle ? `${finalStyle}, ${tag}` : tag;
      }
    }
  } else if (creativity < 0.4) {
    const standardTags = ['melodic', 'standard arrangement', 'catchy hook'];
    for (const tag of standardTags) {
      if (!finalStyle.toLowerCase().includes(tag)) {
        finalStyle = finalStyle ? `${finalStyle}, ${tag}` : tag;
      }
    }
  }

  // 4. Process Style Weight
  if (styleWeight > 0.7) {
    let styleParts = finalStyle.split(',').map(s => s.trim()).filter(Boolean);
    if (styleParts.length > 0) {
      styleParts.unshift(`pure ${styleParts[0]}`);
      finalStyle = styleParts.join(', ');
    }
  } else if (styleWeight < 0.4) {
    const diluteTags = ['balanced mix', 'smooth transitions'];
    for (const tag of diluteTags) {
      if (!finalStyle.toLowerCase().includes(tag)) {
        finalStyle = finalStyle ? `${finalStyle}, ${tag}` : tag;
      }
    }
  }

  // Trim style to 1000 characters limit for modern models (v4/v5/v5.5/remix)
  const maxLimit = 1000;
  if (finalStyle.length > maxLimit) {
    const parts = finalStyle.split(',');
    let currentStyle = '';
    for (const part of parts) {
      const candidate = currentStyle ? `${currentStyle},${part}` : part;
      if (candidate.length <= maxLimit) {
        currentStyle = candidate;
      } else {
        break;
      }
    }
    finalStyle = currentStyle || finalStyle.substring(0, maxLimit);
  }

  return {
    style: finalStyle,
    prompt: finalPrompt,
  };
}

export class SunoClient {
  private static jwtCache = new Map<string, { jwt: string; expiresAt: number }>();
  private static pendingRefreshes = new Map<string, Promise<string>>();
  // Cache session_id từ Suno backend (TTL 25 phút)
  private static sessionTokenCache = new Map<string, { token: string; expiresAt: number }>();
  // Track last cookie persist time để debounce DB writes (key = first 40 chars of cookie)
  private static lastCookiePersist = new Map<string, number>();
  // UA khớp với browser thật (quan sát từ network tab)
  private static readonly UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

  private static getJwtExpiry(jwt: string): number {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return 0;
      let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const mod = payloadB64.length % 4;
      if (mod !== 0) payloadB64 += '='.repeat(4 - mod);
      const str = typeof Buffer !== 'undefined' ? Buffer.from(payloadB64, 'base64').toString('utf-8') : atob(payloadB64);
      const payload = JSON.parse(str);
      return payload.exp ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }


  private static parseSessionToken(cookieStr: string): string | null {
    const matches = [...cookieStr.matchAll(/(?:^|;)\s*__session\s*=\s*([^;]+)/g)];
    if (matches.length === 0) return null;
    let best = matches[0][1];
    let bestExp = 0;
    for (const m of matches) {
      try {
        const parts = m[1].split('.');
        let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const mod = payloadB64.length % 4;
        if (mod !== 0) payloadB64 += '='.repeat(4 - mod);
        const str = typeof Buffer !== 'undefined' ? Buffer.from(payloadB64, 'base64').toString('utf-8') : atob(payloadB64);
        const payload = JSON.parse(str);
        if (payload.exp && payload.exp > bestExp) {
          bestExp = payload.exp;
          best = m[1];
        }
      } catch { }
    }
    return best;
  }

  /** Thêm vào cookie string một __session mới, xóa các giá trị __session cũ */
  private static replaceCookieSession(cookieStr: string, newSession: string): string {
    // Xóa tất cả __session=... cũ (có thể có nhiều bản __session và __session_Jnxw-muT)
    let updated = cookieStr
      .replace(/(?:^|;)\s*__session\s*=[^;]*/g, '')
      .replace(/(?:^|;)\s*__session_[^=]+=?[^;]*/g, '')
      .replace(/^;\s*/, '').replace(/;\s*;/g, ';').trim();
    // Thêm __session mới vào đầu
    updated = `__session=${newSession}; ${updated}`;
    return updated;
  }

  /**
   * Tự động cập nhật cookie trong DB sau khi Clerk refresh thành công.
   * Debounce 55 phút — chỉ ghi DB tối đa mỗi 55 phút / cookie.
   * Chạy bất đồng bộ, không block luồng chính.
   */
  private static persistRefreshedCookie(originalCookie: string, newJwt: string): void {
    const cookieKey = originalCookie.substring(0, 40);
    const now = Date.now();
    const lastPersist = this.lastCookiePersist.get(cookieKey) ?? 0;
    // Debounce: chỉ ghi DB nếu đã quá 55 phút kể từ lần cuối
    if (now - lastPersist < 55 * 60 * 1000) return;
    this.lastCookiePersist.set(cookieKey, now);

    const updatedCookie = this.replaceCookieSession(originalCookie, newJwt);

    // Cập nhật bất đồng bộ (fire and forget) — không throw nếu lỗi
    Promise.resolve().then(async () => {
      try {
        // Cập nhật cookie trong system config (admin-level)
        await prisma.systemConfig.updateMany({
          where: { key: 'suno_cookie', value: { startsWith: originalCookie.substring(0, 30) } },
          data: { value: updatedCookie },
        });
        // Fallback: upsert nếu update không match
        const existing = await prisma.systemConfig.findUnique({ where: { key: 'suno_cookie' } });
        if (existing && existing.value?.substring(0, 30) !== originalCookie.substring(0, 30)) {
          // Cookie trong DB khác hoàn toàn — đã có người cập nhật mới, bỏ qua
          return;
        }
        // Invalidate JWT cache cho cookie cũ (key cũ không còn dùng)
        this.jwtCache.delete(originalCookie);
        // Cache JWT mới dưới key mới
        const expiresAt = this.getJwtExpiry(newJwt);
        if (expiresAt > 0) {
          this.jwtCache.set(updatedCookie, { jwt: newJwt, expiresAt });
        }
        console.log('[SunoCookie] ✅ Auto-refreshed __session in DB cookie. Next refresh in ~55min.');
      } catch (err) {
        // Không throw — chỉ log warning
        console.warn('[SunoCookie] Auto-refresh cookie persist failed (non-critical):', err instanceof Error ? err.message : err);
      }
    });
  }

  /** Lấy giá trị cookie __client để dùng làm Authorization cho Clerk calls */
  private static extractClientToken(cookieStr: string): string | null {
    const m = cookieStr.match(/(?:^|;)\s*__client\s*=\s*([^;]+)/);
    return m ? m[1].trim() : null;
  }

  private static async getClerkJWT(cookie: string): Promise<string> {
    // UA khớp với browser thật (Chrome 150, quan sát từ network tab)
    const ua = this.UA;

    // __client value dùng làm Authorization trực tiếp (không phải Bearer)
    // — đúng theo cách browser gọi Clerk (gcui-art: { Authorization: cookies.__client })
    const clientToken = this.extractClientToken(cookie);

    const baseHeaders: Record<string, string> = {
      'Cookie': cookie,
      'User-Agent': ua,
      'Origin': 'https://suno.com',
      'Referer': 'https://suno.com/',
      'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'accept': '*/*',
    };

    // Thêm Authorization = __client value nếu có (quan trọng cho auth.suno.com)
    if (clientToken) {
      baseHeaders['Authorization'] = clientToken;
      console.log('[SunoCookie] Using __client token as Authorization, length:', clientToken.length);
    } else {
      console.warn('[SunoCookie] No __client token found in cookie. Clerk call may fail.');
    }

    // Thử auth.suno.com trước (Clerk version mới 5.117.0), fallback về clerk.suno.com
    const clerkEndpoints = [
      {
        client: `https://auth.suno.com/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=5.117.0`,
        token: (sid: string) => `https://auth.suno.com/v1/client/sessions/${sid}/tokens?__clerk_api_version=2025-11-10&_clerk_js_version=5.117.0`,
        label: 'auth.suno.com (v5.117.0)',
      },
      {
        client: `https://clerk.suno.com/v1/client?_clerk_js_version=4.73.2`,
        token: (sid: string) => `https://clerk.suno.com/v1/client/sessions/${sid}/tokens?_clerk_js_version=4.73.2`,
        label: 'clerk.suno.com (v4.73.2 fallback)',
      },
    ];

    let lastError: unknown;
    for (const ep of clerkEndpoints) {
      try {
        const clientRes = await proxyFetch(ep.client, { headers: baseHeaders });
        const clientText = await clientRes.text();
        console.log(`[SunoCookie] Clerk client (${ep.label}):`, clientRes.status, clientText.substring(0, 200));
        if (!clientRes.ok) throw new Error(`Clerk client status ${clientRes.status}: ${clientText.substring(0, 200)}`);
        const clientData = JSON.parse(clientText);
        const sessionId = clientData?.response?.last_active_session_id;
        if (!sessionId) throw new Error('No active session in Clerk response');

        const tokenRes = await proxyFetch(ep.token(sessionId), { method: 'POST', headers: baseHeaders });
        const tokenText = await tokenRes.text();
        console.log(`[SunoCookie] Clerk token (${ep.label}):`, tokenRes.status, tokenText.substring(0, 200));
        if (!tokenRes.ok) throw new Error(`Clerk token status ${tokenRes.status}: ${tokenText.substring(0, 200)}`);
        const tokenData = JSON.parse(tokenText);
        const jwt = tokenData?.jwt || tokenData?.response?.jwt;
        if (!jwt) throw new Error('No JWT in Clerk token response');
        console.log(`[SunoCookie] Clerk refresh OK via ${ep.label}, JWT length:`, jwt.length);
        return jwt;
      } catch (err: unknown) {
        console.warn(`[SunoCookie] Clerk endpoint ${ep.label} failed:`, err instanceof Error ? err.message : err);
        lastError = err;
      }
    }
    console.error('[SunoCookie] All Clerk endpoints failed.');
    throw lastError;
  }


  /**
   * Lấy session_id thật từ Suno backend để dùng làm browser-token.
   * Cache 25 phút để tránh gọi quá nhiều.
   */
  private static async getSessionToken(
    jwt: string,
    deviceId: string,
    cookie: string
  ): Promise<string | null> {
    const cacheKey = `${deviceId}:${jwt.substring(jwt.length - 20)}`;
    const now = Date.now();
    const cached = this.sessionTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      console.log('[SunoCookie] Session token cache hit, reusing.');
      return cached.token;
    }

    try {
      const ua = this.UA;
      const res = await proxyFetch('https://studio-api.prod.suno.com/api/user/create_session_id/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Cookie': cookie,
          'Content-Type': 'application/json',
          'User-Agent': ua,
          'Origin': 'https://suno.com',
          'Referer': 'https://suno.com/',
          'device-id': deviceId,
        },
        body: JSON.stringify({
          session_properties: JSON.stringify({ deviceId }),
          session_type: 1,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[SunoCookie] create_session_id failed:', res.status, errText.substring(0, 200));
        return null;
      }

      const data = await res.json();
      const sessionId = data?.session_id || null;
      if (sessionId) {
        // Cache 25 phút
        this.sessionTokenCache.set(cacheKey, { token: sessionId, expiresAt: now + 25 * 60 * 1000 });
        console.log('[SunoCookie] Got session_id from Suno backend, length:', sessionId.length);
      }
      return sessionId;
    } catch (err: unknown) {
      console.warn('[SunoCookie] create_session_id error:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  private static async getEffectiveCookie(userId?: string): Promise<string> {
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sunoCookie: true },
        });
        if (user?.sunoCookie) return user.sunoCookie;
      } catch { }
    }

    // Check general system config set by admin
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'suno_cookie' }
      });
      if (config?.value) return config.value;
    } catch { }

    const env = process.env.SUNO_COOKIE;
    if (env) return env;
    throw new Error('SUNO_COOKIE chưa được cấu hình. Vui lòng liên hệ Admin hoặc tự cấu hình trong Settings.');
  }

  private static async getEffectiveBrowserToken(userId?: string): Promise<string> {
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { sunoBrowserToken: true },
        });
        if (user?.sunoBrowserToken) return user.sunoBrowserToken;
      } catch { }
    }

    // Check general system config set by admin
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'suno_token' }
      });
      if (config?.value) return config.value;
    } catch { }

    return process.env.SUNO_TOKEN || '';
  }

  private static async getEffectiveJWT(cookie: string): Promise<string> {
    const now = Date.now();
    const cached = this.jwtCache.get(cookie);
    if (cached && cached.expiresAt > now + 15000) {
      return cached.jwt;
    }

    let pending = this.pendingRefreshes.get(cookie);
    if (pending) {
      try {
        return await pending;
      } catch {
        // Fall through to retry or fallback below
      }
    }

    const refreshPromise = (async () => {
      const jwt = await this.getClerkJWT(cookie);
      const expiresAt = this.getJwtExpiry(jwt);
      if (expiresAt > 0) {
        this.jwtCache.set(cookie, { jwt, expiresAt });
      }
      // ✨ Tự động cập nhật __session trong DB — cookie tự tái sinh
      this.persistRefreshedCookie(cookie, jwt);
      return jwt;
    })();

    this.pendingRefreshes.set(cookie, refreshPromise);

    try {
      const jwt = await refreshPromise;
      return jwt;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';

      // Fallback: thử dùng __session cũ nếu còn hạn
      const sessionToken = this.parseSessionToken(cookie);
      if (sessionToken) {
        const exp = this.getJwtExpiry(sessionToken);
        if (exp > Date.now() + 30000) {
          console.warn('[SunoCookie] Clerk refresh failed, using cached __session as fallback. Error:', errMsg);
          this.jwtCache.set(cookie, { jwt: sessionToken, expiresAt: exp });
          return sessionToken;
        }
      }

      // Phát hiện session bị revoke (Suno đăng xuất hoặc cookie hết hạn hoàn toàn)
      const isSessionRevoked = errMsg.includes('No active session') || errMsg.includes('401') || errMsg.includes('Unauthorized');
      if (isSessionRevoked) {
        // Trigger Playwright refresh trong background (non-blocking)
        console.warn('[SunoCookie] Session revoked/expired — triggering background Playwright cookie refresh...');
        Promise.resolve().then(async () => {
          try {
            const { refreshCookieViaPlaywright } = await import('./suno-playwright');
            const result = await refreshCookieViaPlaywright();
            if (result.success) {
              console.log('[SunoCookie] ✅ Background Playwright refresh succeeded. Cookie updated in DB.');
              // Clear cache để request tiếp theo dùng cookie mới
              this.jwtCache.clear();
            } else {
              console.warn('[SunoCookie] Background Playwright refresh failed:', result.message);
            }
          } catch (e) {
            console.warn('[SunoCookie] Background Playwright refresh error:', e instanceof Error ? e.message : e);
          }
        }).catch(() => {});

        throw new Error(
          'Hệ thống Suno đang tạm thời gián đoạn do phiên đăng nhập hết hạn. ' +
          'Hệ thống đang tự động làm mới — vui lòng thử lại sau 30 giây. ' +
          'Nếu lỗi tiếp tục, admin vui lòng nhấn nút Auto-Refresh trong trang /admin.'
        );
      }

      throw new Error(`Không thể lấy token xác thực từ Suno. Vui lòng thử lại hoặc liên hệ admin. (${errMsg})`);
    } finally {
      this.pendingRefreshes.delete(cookie);
    }
  }

  private static generateBrowserTokenHeader(token?: string | null): string {
    if (token && token.trim()) {
      if (token.trim().startsWith('{') && token.trim().endsWith('}')) {
        return token;
      }
      return JSON.stringify({ token });
    }
    const timestamp = Date.now();
    const payload = JSON.stringify({ timestamp });
    const b64 = Buffer.from(payload).toString('base64');
    return JSON.stringify({ token: b64 });
  }

  private static extractDeviceId(cookieStr: string): string {
    const m0 = cookieStr.match(/(?:^|;)\s*ajs_anonymous_id\s*=\s*([^;]+)/);
    if (m0) return m0[1];
    const m1 = cookieStr.match(/(?:^|;)\s*suno_device_id\s*=\s*([^;]+)/);
    if (m1) return m1[1];
    const m2 = cookieStr.match(/(?:^|;)\s*singular_device_id\s*=\s*([^;]+)/);
    if (m2) return m2[1];
    const m3 = cookieStr.match(/(?:^|;)\s*ab\.storage\.deviceId\.[^=]+=\s*([^;]+)/);
    if (m3) return m3[1].replace(/^%22/, '').replace(/%22$/, '');
    return 'suno-web-default';
  }

  private static extractBrowserToken(cookieStr: string): string | undefined {
    const m = cookieStr.match(/(?:^|;)\s*__client\s*=\s*([^;]+)/);
    return m ? m[1] : undefined;
  }

  private static extractXAblyToken(cookieOrJwt: string): string | null {
    let jwt = cookieOrJwt;
    if (cookieOrJwt.includes('=')) {
      const m = cookieOrJwt.match(/(?:^|;)\s*__session\s*=\s*([^;]+)/);
      if (!m) return null;
      jwt = m[1];
    }
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      let headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
      const mod = headerB64.length % 4;
      if (mod !== 0) headerB64 += '='.repeat(4 - mod);
      const str = typeof Buffer !== 'undefined' ? Buffer.from(headerB64, 'base64').toString('utf-8') : atob(headerB64);
      const header = JSON.parse(str);
      return header['x-ably-token'] || null;
    } catch {
      return null;
    }
  }


  public static async getSunoBalance(userId?: string): Promise<{ totalCreditsLeft: number } | null> {
    try {
      const sunoCookie = await this.getEffectiveCookie(userId).catch(() => null);
      if (!sunoCookie) return null;
      const jwt = await this.getEffectiveJWT(sunoCookie);
      const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(sunoCookie);

      const headers = {
        'Authorization': `Bearer ${jwt}`,
        'Cookie': sunoCookie,
        'User-Agent': this.UA,
        'Origin': 'https://suno.com',
        'Referer': 'https://suno.com/',
        'device-id': deviceId,
      };

      const res = await proxyFetch('https://studio-api-prod.suno.com/api/billing/info/', {
        headers,
      });

      if (!res.ok) {
        console.error('[SunoClient] Failed to fetch billing info:', res.status, await res.text());
        return null;
      }

      const data = await res.json();
      return {
        totalCreditsLeft: data?.total_credits_left ?? 0,
      };
    } catch (err) {
      console.error('[SunoClient] Error fetching billing info:', err);
      return null;
    }
  }

  public static async uploadReferenceFlow(
    ref: { data: string; name: string; type: string },
    userId?: string
  ): Promise<string> {
    const sunoCookie = await this.getEffectiveCookie(userId).catch(() => null);
    if (!sunoCookie) {
      throw new Error('Không có Suno cookie. Vui lòng kết nối tài khoản Suno.');
    }
    const jwt = await this.getEffectiveJWT(sunoCookie);
    const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(sunoCookie);

    const refId = await this.uploadReference(ref, sunoCookie, jwt, deviceId);
    if (!refId) {
      throw new Error('Suno từ chối upload file tham chiếu.');
    }
    return refId;
  }

  private static async uploadReference(
    ref: { data: string; name: string; type: string },
    cookie: string,
    jwt: string,
    deviceId: string,
    browserToken?: string
  ): Promise<string | null> {
    const isImage = ref.type.startsWith('image/');
    const typePath = isImage ? 'image' : 'audio';
    const extension = ref.name.split('.').pop()?.toLowerCase() || '';

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${jwt}`,
      'Cookie': cookie,
      'User-Agent': this.UA,
      'Origin': 'https://suno.com',
      'Referer': 'https://suno.com/',
      'device-id': deviceId,
      'Content-Type': 'application/json',
      'browser-token': this.generateBrowserTokenHeader(browserToken),
    };

    // 1. Initialize Upload on Suno
    const initUrl = `https://studio-api-prod.suno.com/api/uploads/${typePath}/`;
    const initBody = isImage ? { extension } : { extension, is_stem_mix: false };

    const initRes = await proxyFetch(initUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(initBody),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      if (errText.includes('does not support image input') || errText.includes('does not support')) {
        throw new Error(`Model hiện tại không hỗ trợ upload ${isImage ? 'hình ảnh' : 'audio'} làm reference. Vui lòng thử model khác.`);
      }
      throw new Error(`Khởi tạo upload ${isImage ? 'hình ảnh' : 'âm thanh'} thất bại: ${errText.substring(0, 200)}`);
    }

    const initData = await initRes.json();
    const uploadId = initData.id;
    const s3Url = initData.url;
    const s3Fields = initData.fields;

    // 2. Decode the base64 reference file and upload to S3
    const byteString = atob(ref.data.split(',')[1] || ref.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: ref.type });

    const formData = new FormData();
    for (const [k, v] of Object.entries(s3Fields)) {
      formData.append(k, v as string);
    }
    // S3 expects the 'file' key to be the last field in the form data
    formData.append('file', blob, ref.name);

    const s3Res = await proxyFetch(s3Url, {
      method: 'POST',
      body: formData,
    });

    if (!s3Res.ok) {
      const errText = await s3Res.text();
      throw new Error(`Upload file lên S3 thất bại: ${errText.substring(0, 200)}`);
    }

    // 3. Notify Suno that upload is finished
    const finishUrl = `https://studio-api.prod.suno.com/api/uploads/${typePath}/${uploadId}/upload-finish/`;
    const finishBody = isImage ? undefined : {
      upload_type: 'studio_file_upload',
      upload_filename: ref.name,
    };

    const finishRes = await proxyFetch(finishUrl, {
      method: 'POST',
      headers,
      body: finishBody ? JSON.stringify(finishBody) : undefined,
    });

    if (!finishRes.ok) {
      const errText = await finishRes.text();
      throw new Error(`Xác nhận hoàn tất upload thất bại: ${errText.substring(0, 200)}`);
    }

    // 4. For image, returning the uploadId directly is sufficient
    if (isImage) {
      return uploadId;
    }

    // 5. For audio, poll status until complete
    let status = 'processing';
    let attempts = 0;
    const maxAttempts = 150; // 150 * 2 = 300 seconds (5 minutes) to allow long high-fidelity files to process
    while (status !== 'complete' && attempts < maxAttempts) {
      attempts++;
      const statusRes = await proxyFetch(`https://studio-api-prod.suno.com/api/uploads/audio/${uploadId}/`, {
        headers,
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        status = statusData.status;
        if (status === 'error') {
          let errMsg = statusData.error_message || 'Không thể phân tích file.';
          if (errMsg.includes('matches an existing recording in our catalog')) {
            errMsg = 'File âm thanh trùng khớp với bản nhạc có bản quyền trong danh mục của Suno. Vui lòng thử lại với file khác.';
          } else if (errMsg.includes('too short')) {
            errMsg = 'File âm thanh quá ngắn. Vui lòng chọn file dài hơn.';
          }
          throw new Error(`Lỗi xử lý file âm thanh: ${errMsg}`);
        }
      }
      if (status !== 'complete') {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (status !== 'complete') {
      throw new Error('Hết thời gian chờ xử lý file âm thanh reference.');
    }

    // 6. Initialize audio reference clip to obtain clip_id
    const initClipRes = await proxyFetch(`https://studio-api-prod.suno.com/api/uploads/audio/${uploadId}/initialize-clip/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_reviewed_tags: true,
      }),
    });

    if (!initClipRes.ok) {
      const errText = await initClipRes.text();
      throw new Error(`Khởi tạo clip reference thất bại: ${errText.substring(0, 200)}`);
    }

    const clipData = await initClipRes.json();
    if (!clipData?.clip_id) {
      throw new Error('Không nhận được clip_id từ Suno.');
    }

    return clipData.clip_id;
  }

  static async generate(params: GenerateParams): Promise<{ taskId: string; warning?: string }> {
    const sunoCookie = await this.getEffectiveCookie(params.userId).catch(() => null);
    const customBrowserToken = await this.getEffectiveBrowserToken(params.userId).catch(() => '');

    if (!sunoCookie) {
      throw new Error('Không có Suno cookie. Vui lòng kết nối tài khoản Suno trong Settings.');
    }

    // Apply Advanced Settings to style tags and prompt
    let { style: finalStyle, prompt: finalPrompt } = applyAdvancedSettings(
      params.style || '',
      params.prompt || '',
      params.styleWeight,
      params.creativity,
      params.audioQuality,
      params.negativeTags
    );

    // Enforce correct Vocal Gender and remove conflicting gender tags
    if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto') {
      const gender = params.vocalGender; // 'female' | 'male'

      const maleRegexes = [
        /\bmale\s+vocals\b/gi, /\bmale\s+vocalist\b/gi, /\bmale\s+singer\b/gi, /\bmale\b/gi,
        /giọng\s+nam\s+ca\s+sĩ/gi, /giọng\s+nam\s+ca\s+si/gi, /nam\s+ca\s+sĩ/gi, /nam\s+ca\s+si/gi,
        /giọng\s+nam/gi, /vocal\s+nam/gi, /giọng\s+hát\s+nam/gi, /đơn\s+nam/gi, /song\s+ca\s+nam/gi
      ];

      const femaleRegexes = [
        /\bfemale\s+vocals\b/gi, /\bfemale\s+vocalist\b/gi, /\bfemale\s+singer\b/gi, /\bfemale\b/gi,
        /giọng\s+nữ\s+ca\s+sĩ/gi, /giọng\s+nữ\s+ca\s+si/gi, /nữ\s+ca\s+sĩ/gi, /nữ\s+ca\s+si/gi,
        /giọng\s+nữ/gi, /vocal\s+nữ/gi, /giọng\s+hát\s+nữ/gi, /đơn\s+nữ/gi, /song\s+ca\s+nữ/gi,
        /\bnữ\b/gi, /\bnu\b/gi
      ];

      if (gender === 'female') {
        maleRegexes.forEach(regex => {
          finalStyle = finalStyle.replace(regex, '');
        });
        if (!finalStyle.toLowerCase().includes('female') && !finalStyle.toLowerCase().includes('nữ')) {
          finalStyle = finalStyle ? `${finalStyle}, female vocalist, female vocals` : 'female vocalist, female vocals';
        }

        maleRegexes.forEach(regex => {
          finalPrompt = finalPrompt.replace(regex, '');
        });
        if (!finalPrompt.toLowerCase().includes('female') && !finalPrompt.toLowerCase().includes('nữ')) {
          finalPrompt = finalPrompt ? `${finalPrompt}, female vocals` : 'female vocals';
        }
      } else if (gender === 'male') {
        femaleRegexes.forEach(regex => {
          finalStyle = finalStyle.replace(regex, '');
        });
        if (!finalStyle.toLowerCase().includes('male') && !finalStyle.toLowerCase().includes('nam')) {
          finalStyle = finalStyle ? `${finalStyle}, male vocalist, male vocals` : 'male vocalist, male vocals';
        }

        femaleRegexes.forEach(regex => {
          finalPrompt = finalPrompt.replace(regex, '');
        });
        if (!finalPrompt.toLowerCase().includes('male') && !finalPrompt.toLowerCase().includes('nam')) {
          finalPrompt = finalPrompt ? `${finalPrompt}, male vocals` : 'male vocals';
        }
      }

      finalStyle = finalStyle.replace(/,\s*,/g, ',').replace(/^,/, '').replace(/,$/, '').trim();
      finalPrompt = finalPrompt.replace(/,\s*,/g, ',').replace(/^,/, '').replace(/,$/, '').trim();
    }

    // Prepend correct Vocal Voice tag to lyrics if not already present, and remove opposing tag
    if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto' && params.lyrics) {
      const genderTag = params.vocalGender === 'male' ? '[Male Vocal]' : '[Female Vocal]';
      const opposingTag = params.vocalGender === 'male' ? '[Female Vocal]' : '[Male Vocal]';
      let lyricText = params.lyrics;
      lyricText = lyricText.replace(new RegExp(opposingTag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '');
      if (!lyricText.toLowerCase().includes(genderTag.toLowerCase())) {
        lyricText = `${genderTag}\n${lyricText}`;
      }
      params.lyrics = lyricText;
    }

    params.style = finalStyle;
    params.prompt = finalPrompt;

    // Option A: Use User Browser Cookie (only method supported)
    // Trên Render cloud (không có Chrome, Turnstile block server-side requests):
    const isRenderEnv = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME || process.env.RENDER_INSTANCE_ID);

    if (sunoCookie) {
      const jwt = await this.getEffectiveJWT(sunoCookie);
      const isCustomMode = params.mode === 'lyrics';
      const model = params.sunoModel === 'remix' ? 'chirp-custom:d5c6a782-24f7-493f-a239-440980e6d32e' : (params.sunoModel || 'chirp-fenix');
      const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(sunoCookie);

      // Browser inspection: Suno frontend gửi token=null, Browser-Token header, metadata.create_session_token
      // Không cần Turnstile token - chỉ cần Browser-Token header đúng format
      console.log('[SunoCookie] Strategy: Browser-compatible request with Browser-Token header.');



      // Upload reference file if provided
      let referenceFileId: string | null = params.referenceFileId || null;
      let referenceSkipped = false;
      if (params.referenceFile && !referenceFileId) {
        referenceFileId = await this.uploadReference(params.referenceFile, sunoCookie, jwt, deviceId, undefined);
        if (!referenceFileId) {
          referenceSkipped = true;
          console.warn('[SunoCookie] Upload endpoints unavailable, skipping reference file.');
        }
      }

      const body: Record<string, unknown> = {
        mv: model,
        make_instrumental: params.outputType === 'instrumental',
      };

      // Cover mode: Suno requires custom_mode:true + lyrics (prompt) + tags
      // so the generated song uses YOUR lyrics over the reference melody.
      const isCoverWithLyrics = params.referenceMode === 'cover' && (params.lyrics || params.style);
      const effectiveCustomMode = isCustomMode || isCoverWithLyrics;

      if (effectiveCustomMode) {
        body.custom_mode = true;  // ← required by Suno for Cover with custom lyrics
        body.prompt = params.outputType === 'instrumental'
          ? ''
          : (params.bypassLyrics ? obfuscateLyrics(params.lyrics || '') : cleanChords(params.lyrics || ''));

        let tags = params.style || '';
        if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto') {
          const genderTag = `${params.vocalGender} vocalist`;
          if (!tags.toLowerCase().includes('vocalist') && !tags.toLowerCase().includes('vocals') && !tags.toLowerCase().includes(params.vocalGender)) {
            tags = tags ? `${tags}, ${genderTag}` : genderTag;
          }
        }
        const maxTagsLimit = (model.includes('v3-5') || model.includes('v3_5')) ? 200 : 1000;
        body.tags = tags.substring(0, maxTagsLimit);
        body.title = params.title || '';
      } else {
        let promptText = params.prompt || '';
        if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto') {
          const genderText = `${params.vocalGender} vocalist`;
          if (!promptText.toLowerCase().includes('vocalist') && !promptText.toLowerCase().includes('vocals') && !promptText.toLowerCase().includes(params.vocalGender)) {
            promptText = promptText ? `${promptText}, ${genderText}` : genderText;
          }
        }
        body.prompt = promptText;
      }

      // Không gửi body.token (browser Suno gửi token: null)
      body.token = null;
      body.token_provider = null;

      if (referenceFileId) {
        const fileType = params.referenceFileType || params.referenceFile?.type || '';
        const isImage = fileType.startsWith('image/');
        if (isImage) {
          body.image_file_id = referenceFileId;
        } else {
          if (params.referenceMode === 'cover') {
            body.cover_clip_id = referenceFileId;
          } else if (params.referenceMode === 'extend') {
            body.continue_clip_id = referenceFileId;
            body.continue_at = params.continueAt ?? 30.0;
          } else {
            body.audio_file_id = referenceFileId;
          }
        }
      }

      // Thêm metadata đúng format browser Suno (từ browser inspection)
      const createSessionToken = await this.getSessionToken(jwt, deviceId, sunoCookie);
      const transactionUuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      body.generation_type = isCustomMode ? 'TEXT' : 'TEXT';
      body.transaction_uuid = transactionUuid;
      body.metadata = {
        web_client_pathname: '/create',
        is_max_mode: false,
        is_mumble: false,
        create_mode: isCustomMode ? 'custom' : 'simple',
        create_session_token: createSessionToken ?? transactionUuid,
        disable_volume_normalization: false,
      };
      body.override_fields = [];

      // Browser-Token header: base64 JSON chứa timestamp (từ browser inspection)
      const browserTokenHeader = Buffer.from(JSON.stringify({ token: `ts:${Date.now()}`, ts: Date.now() })).toString('base64');

      // Request headers khớp browser Suno
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${jwt}`,
        'Cookie': sunoCookie,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        'Origin': 'https://suno.com',
        'Referer': 'https://suno.com/',
        'device-id': deviceId,
        'Browser-Token': JSON.stringify({ token: browserTokenHeader }),
        'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'accept': '*/*',
        'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.6,en;q=0.5',
      };

      const tokenSource = createSessionToken ? 'session-id' : 'none';

      console.log('[SunoCookie] Request params:', {
        model,
        deviceId,
        tokenSource,
        createSessionTokenLength: createSessionToken?.length ?? 0,
        jwtLength: jwt.length,
        custom_mode: body.custom_mode,
        cover_clip_id: body.cover_clip_id,
        audio_file_id: body.audio_file_id,
        has_lyrics: !!(body.prompt),
        tags_preview: typeof body.tags === 'string' ? (body.tags as string).substring(0, 80) : undefined,
      });

      let res = await proxyFetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });


      if (!res.ok) {
        let errText = await res.text();
        console.error('[SunoCookie] Generate response error:', errText);

        // token_validation_failed = Cloudflare Turnstile block
        if (errText.includes('token_validation_failed')) {
          try {
            const { syncCookieFromBrowser } = await import('./suno-browser');
            const syncResult = await syncCookieFromBrowser();
            if (syncResult.success && syncResult.cookie) {
                console.log('[SunoCookie] ✅ Auto-synced fresh cookie from browser tab. Retrying generate call...');
                const freshClientToken = syncResult.cookie.match(/(?:^|;)\s*__client\s*=\s*([^;]+)/)?.[1]?.trim();
                const freshHeaders = { ...headers };
                if (freshClientToken) {
                  freshHeaders['Authorization'] = 'Bearer ' + freshClientToken;
                }
                freshHeaders['Cookie'] = syncResult.cookie;

                const retryRes = await proxyFetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
                  method: 'POST',
                  headers: freshHeaders,
                  body: JSON.stringify(body)
                });

                if (retryRes.ok) {
                  console.log('[SunoCookie] ✨ Retry with auto-synced cookie succeeded!');
                  res = retryRes;
                } else {
                  errText = await retryRes.text();
                }
              }
          } catch (syncErr) {
            console.warn('[SunoCookie] Auto-sync retry failed:', syncErr);
          }

          if (!res.ok) {
            console.warn('[SunoCookie] token_validation_failed. Throwing CDP_REQUIRED.');
            throw new Error(`CDP_REQUIRED:${errText.substring(0, 200)}`);
          }
        }

        // rate_limited: Suno throttle → báo user ngay
        if (errText.includes('rate_limited') || errText.includes('Too many requests')) {
          throw new Error('Suno đang giới hạn request. Vui lòng đợi 1-2 phút rồi thử lại.');
        }

        // Auto-fallback: nếu model không hỗ trợ → không retry (chỉ còn chirp-fenix)
        // (bỏ fallback chirp-v3-5 vì UI đã loại bỏ các model cũ)

        if (!res.ok) {
          if (errText.includes('does not support')) {
            throw new Error('Model này không hỗ trợ upload file reference. Vui lòng thử model khác (vd: v4 hoặc v5).');
          }
          throw new Error(`Lỗi sinh nhạc qua Suno.com Cookie (Status: ${res.status}): ${errText}`);
        }
      }
      const data = await res.json();
      const clips = data?.clips;
      if (!clips || !Array.isArray(clips) || clips.length === 0) {
        throw new Error('Không nhận được clip âm nhạc nào từ Suno Studio API.');
      }

      const clipIds = clips.map((c: { id: string }) => c.id).join(',');
      const sunocookieTaskId = `sunocookie-${clipIds}`;
      if (params.referenceFile) {
        if (!referenceSkipped) {
          referenceFileMap.set(sunocookieTaskId, params.referenceFile.name);
        }
      }
      const result: { taskId: string; warning?: string } = { taskId: sunocookieTaskId };
      if (referenceSkipped) {
        result.warning = `Không thể upload "${params.referenceFile!.name}" — Suno API upload hiện không khả dụng. Đã bỏ qua reference file.`;
      }
      return result;
    }

    // Nếu không có cookie (không nên xảy ra do đã check ở trên)
    throw new Error('Không có Suno cookie. Vui lòng kết nối tài khoản Suno trong Settings.');
  }

  static async checkStatus(taskId: string, userId?: string): Promise<{
    status: 'processing' | 'completed' | 'failed';
    tracks?: Track[];
  }> {
    const isSunoCookie = taskId.startsWith('sunocookie-');
    const realTaskId = taskId.replace(/^sunocookie-/, '');

    // ── SUNO COOKIE STATUS CHECK ─────────────────────────────
    if (isSunoCookie) {
      try {
        const cookie = await this.getEffectiveCookie(userId).catch(() => process.env.SUNO_COOKIE || '');
        if (!cookie) return { status: 'processing' };
        const jwt = await this.getEffectiveJWT(cookie);
        const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(cookie);
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${jwt}`,
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Origin': 'https://suno.com',
          'Referer': 'https://suno.com/',
          'device-id': deviceId,
          'browser-token': this.generateBrowserTokenHeader(),
        };

        const res = await proxyFetch(`https://studio-api-prod.suno.com/api/feed/?ids=${realTaskId}`, {
          headers
        });

        if (!res.ok) return { status: 'processing' };

        const clips = await res.json();
        if (!Array.isArray(clips) || clips.length === 0) return { status: 'processing' };

        const isAllComplete = clips.every((c: { status: string }) => c.status === 'complete');
        const hasFailed = clips.some((c: { status: string }) => c.status === 'failed' || c.status === 'error');

        if (hasFailed) return { status: 'failed' };

        const sourceName = referenceFileMap.get(taskId) || undefined;
        const tracks: Track[] = clips.map((item: Record<string, unknown>, idx: number) => {
          const metadata = item.metadata as Record<string, unknown> | undefined;
          return {
            id: (item.id as string) || `${realTaskId}-track-${idx + 1}`,
            title: (item.title as string) || `Suno Track ${idx + 1}`,
            url: (item.audio_url as string) || '',
            coverUrl: (item.image_url as string) || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop`,
            duration: item.duration ? Math.floor(Number(item.duration)) : 0,
            style: (metadata?.tags as string) || undefined,
            lyrics: (metadata?.prompt as string) || undefined,
            sourceName,
            videoUrl: (item.video_url as string) || '',
          };
        });

        if (isAllComplete) {
          if (sourceName) referenceFileMap.delete(taskId);
          return { status: 'completed', tracks };
        }

        const playableTracks = tracks.filter(t => t.url);
        if (playableTracks.length > 0) {
          return { status: 'processing', tracks: playableTracks };
        }

        return { status: 'processing' };
      } catch {
        return { status: 'processing' };
      }
    }

    return { status: 'failed' };
  }

  public static async getOrGenerateVideoUrl(clipId: string, userId?: string): Promise<string> {
    try {
      const cookie = await this.getEffectiveCookie(userId).catch(() => process.env.SUNO_COOKIE || '');
      if (!cookie) return `https://cdn1.suno.ai/${clipId}.mp4`;

      const jwt = await this.getEffectiveJWT(cookie);
      const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(cookie);
      const browserToken = await this.getEffectiveBrowserToken(userId).catch(() => '');

      const headers = {
        'Authorization': `Bearer ${jwt}`,
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Origin': 'https://suno.com',
        'Referer': 'https://suno.com/',
        'device-id': deviceId,
        'browser-token': this.generateBrowserTokenHeader(browserToken),
      };

      const statusUrl = `https://studio-api-prod.suno.com/api/video/generate/${clipId}/status/`;

      // 1. Check if video already exists or is generating
      let videoUrl = '';
      let isComplete = false;
      try {
        const res = await proxyFetch(statusUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'complete' && data.video_url) {
            videoUrl = data.video_url;
            isComplete = true;
            console.log(`[SunoClient] Video status check: complete, checking S3 link...`);
          } else if (data.status === 'processing') {
            console.log(`[SunoClient] Video status check: processing, skipping trigger...`);
          }
        }
      } catch (e) {
        console.error('[SunoClient] Error checking video status:', e);
      }

      // 1.1 Verify S3 file availability if complete
      if (isComplete && videoUrl) {
        try {
          const checkRes = await proxyFetch(videoUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
            }
          });
          if (checkRes.status === 403 || checkRes.status === 404) {
            console.warn(`[SunoClient] Video link returned ${checkRes.status} (Access Denied). Forcing regeneration trigger...`);
            isComplete = false;
          } else {
            console.log(`[SunoClient] Video is verified ready on S3: ${videoUrl}`);
            return videoUrl;
          }
        } catch (checkErr) {
          console.error('[SunoClient] Error verifying S3 link:', checkErr);
        }
      }

      // 2. Trigger video generation if not ready/complete (or S3 file missing)
      if (!isComplete) {
        try {
          console.log(`[SunoClient] Triggering video generation for clip: ${clipId}`);
          const triggerUrl = `https://studio-api-prod.suno.com/api/video/generate/${clipId}/`;
          const triggerRes = await proxyFetch(triggerUrl, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
          });

          if (!triggerRes.ok) {
            console.warn(`[SunoClient] Trigger video generation failed: ${triggerRes.statusText}`);
          }
        } catch (e) {
          console.error('[SunoClient] Error triggering video generation:', e);
        }

        // 3. Poll for status (max 45 seconds because video rendering takes ~20s)
        const start = Date.now();
        while (Date.now() - start < 45000) {
          try {
            const res = await proxyFetch(statusUrl, { headers });
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'complete' && data.video_url) {
                console.log(`[SunoClient] Video generation complete: ${data.video_url}`);
                return data.video_url;
              }
              console.log(`[SunoClient] Video generation status: ${data.status} (${((Date.now() - start) / 1000).toFixed(0)}s elapsed)`);
            }
          } catch (e) {
            // Ignore poll error
          }
          await new Promise(r => setTimeout(r, 3000));
        }
      } else {
        return videoUrl;
      }
    } catch (error) {
      console.error('[SunoClient] Error in getOrGenerateVideoUrl:', error);
    }

    // Fallback default CDN path if it still hasn't completed
    return `https://cdn1.suno.ai/${clipId}.mp4`;
  }

  public static async getOrGenerateWavUrl(clipId: string, userId?: string): Promise<string> {
    try {
      const cookie = await this.getEffectiveCookie(userId).catch(() => process.env.SUNO_COOKIE || '');
      if (!cookie) return '';

      const jwt = await this.getEffectiveJWT(cookie);
      const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(cookie);
      const browserToken = await this.getEffectiveBrowserToken(userId).catch(() => '');

      const headers = {
        'Authorization': `Bearer ${jwt}`,
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Origin': 'https://suno.com',
        'Referer': 'https://suno.com/',
        'device-id': deviceId,
        'browser-token': this.generateBrowserTokenHeader(browserToken),
      };

      const statusUrl = `https://studio-api-prod.suno.com/api/gen/${clipId}/wav_file/`;

      // 1. Check if wav already exists
      let wavUrl = '';
      let isComplete = false;
      try {
        const res = await proxyFetch(statusUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          const url = data.url || data.wav_url || data.wavFile || data.wav;
          if (url) {
            wavUrl = url;
            isComplete = true;
            console.log(`[SunoClient] WAV file already exists: ${wavUrl}`);
          }
        }
      } catch (e) {
        console.error('[SunoClient] Error checking WAV status:', e);
      }

      // 2. Trigger WAV conversion if not ready
      if (!isComplete) {
        try {
          console.log(`[SunoClient] Triggering WAV conversion for clip: ${clipId}`);
          const triggerUrl = `https://studio-api-prod.suno.com/api/gen/${clipId}/convert_wav/`;
          const triggerRes = await proxyFetch(triggerUrl, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Length': '0',
            },
          });

          if (triggerRes.status !== 204 && !triggerRes.ok) {
            console.warn(`[SunoClient] Trigger WAV conversion failed: ${triggerRes.statusText}`);
          }
        } catch (e) {
          console.error('[SunoClient] Error triggering WAV conversion:', e);
        }

        // 3. Poll for status (max 30 seconds)
        const start = Date.now();
        while (Date.now() - start < 30000) {
          try {
            const res = await proxyFetch(statusUrl, { headers });
            if (res.ok) {
              const data = await res.json();
              const url = data.url || data.wav_url || data.wavFile || data.wav;
              if (url) {
                console.log(`[SunoClient] WAV conversion complete: ${url}`);
                return url;
              }
              console.log(`[SunoClient] WAV conversion status: polling... (${((Date.now() - start) / 1000).toFixed(0)}s elapsed)`);
            }
          } catch (e) {
            // Ignore poll error
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      } else {
        return wavUrl;
      }
    } catch (error) {
      console.error('[SunoClient] Error in getOrGenerateWavUrl:', error);
    }

    return '';
  }

  /**
   * Fetches official audio waveform aggregates array for a given Suno clip ID
   */
  public static async getWaveformAggregates(clipId: string, userId?: string): Promise<number[]> {
    try {
      const cookie = await this.getEffectiveCookie(userId);
      const jwt = await this.getEffectiveJWT(cookie);
      const browserToken = await this.getEffectiveBrowserToken(userId);
      const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(cookie);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${jwt}`,
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Origin': 'https://suno.com',
        'Referer': 'https://suno.com/',
        'device-id': deviceId,
        'browser-token': this.generateBrowserTokenHeader(browserToken),
      };

      const url = `https://studio-api-prod.suno.com/api/gen/${clipId}/waveform-aggregates`;
      const res = await proxyFetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.waveform_aggregates)) {
          return data.waveform_aggregates;
        } else if (Array.isArray(data.waveform)) {
          return data.waveform;
        } else if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (err) {
      console.error('[SunoClient] Error fetching waveform aggregates:', err);
    }
    return [];
  }
}
