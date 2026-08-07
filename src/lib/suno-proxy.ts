/**
 * suno-proxy.ts
 * Proxy-aware fetch helper cho các HTTP request đến Suno API.
 *
 * Nếu env var SUNO_PROXY_URL được set (vd: http://user:pass@host:port hoặc socks5://...),
 * mọi call qua proxyFetch() sẽ đi qua proxy residential để bypass Cloudflare Turnstile.
 *
 * Nếu không có SUNO_PROXY_URL → fallback về native fetch bình thường.
 *
 * CHỈ chạy ở server-side (Node.js runtime). Không dùng ở Edge Runtime.
 */

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

let _proxyAgent: unknown = null;
let _proxyAgentInit = false;

/**
 * Khởi tạo ProxyAgent từ SUNO_PROXY_URL (lazy init, singleton).
 * Trả về null nếu không có proxy hoặc lỗi.
 */
async function getProxyAgent(): Promise<unknown> {
  if (_proxyAgentInit) return _proxyAgent;
  _proxyAgentInit = true;

  const proxyUrl = process.env.SUNO_PROXY_URL;
  if (!proxyUrl) {
    console.log('[SunoProxy] No SUNO_PROXY_URL set — using direct connection.');
    return null;
  }

  try {
    const { ProxyAgent } = await import('undici');
    _proxyAgent = new ProxyAgent(proxyUrl);
    // Log obfuscated URL (hide password)
    const obfuscated = proxyUrl.replace(/:([^@/]+)@/, ':***@');
    console.log('[SunoProxy] ✅ Proxy agent initialized:', obfuscated);
    return _proxyAgent;
  } catch (err) {
    console.error('[SunoProxy] Failed to create ProxyAgent:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch với proxy support.
 * Drop-in replacement cho fetch() dùng trong suno.ts.
 *
 * @example
 * // Thay:  const res = await fetch(url, options);
 * // Bằng: const res = await proxyFetch(url, options);
 */
export async function proxyFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const agent = await getProxyAgent();

  if (!agent) {
    // Không có proxy — dùng native fetch bình thường
    return fetch(input, init);
  }

  // Dùng undici fetch với dispatcher = ProxyAgent
  try {
    const { fetch: undiciFetch } = await import('undici');
    return await undiciFetch(input as string | URL, {
      ...(init as Record<string, unknown>),
      dispatcher: agent as import('undici').Dispatcher,
    }) as unknown as Response;
  } catch (err) {
    // Fallback về native fetch nếu undici lỗi
    console.warn('[SunoProxy] undici fetch failed, falling back to native:', err instanceof Error ? err.message : err);
    return fetch(input, init);
  }
}

/**
 * Lấy thông tin proxy hiện tại để hiển thị trong Admin UI.
 */
export function getProxyInfo(): { enabled: boolean; url: string | null; display: string } {
  const proxyUrl = process.env.SUNO_PROXY_URL;
  if (!proxyUrl) {
    return { enabled: false, url: null, display: 'Không có proxy (Direct IP)' };
  }
  // Ẩn password
  const display = proxyUrl.replace(/:([^@/]+)@/, ':***@');
  return { enabled: true, url: proxyUrl, display };
}
