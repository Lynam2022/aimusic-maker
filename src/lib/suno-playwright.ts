/**
 * suno-playwright.ts
 * Bypass Cloudflare Turnstile trên Render bằng Playwright Chromium headless.
 *
 * Thay vì gọi Suno API trực tiếp (bị block bởi Turnstile từ server IP),
 * ta launch một browser thật → mở suno.com/create → lấy Turnstile token hợp lệ
 * → gọi API từ browser context → nhạc được tạo.
 *
 * CHỈ chạy server-side. Browser được reuse nếu đang active (browser pool đơn giản).
 */

import { prisma } from './db';

// ─────────────────── Browser Pool (singleton) ───────────────────
// Giữ 1 browser instance alive để tránh cold start mỗi request
let _browser: import('playwright-core').Browser | null = null;
let _lastUsed = 0;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // đóng browser sau 5 phút không dùng

// Queue đơn giản: chỉ 1 generate chạy tại một thời điểm (tránh OOM)
let _generateQueue: Promise<unknown> = Promise.resolve();

/** Đường dẫn Chromium tùy môi trường */
function getChromiumPath(): string | undefined {
  // Ưu tiên env var (Docker hoặc Render env var manual)
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  // Kiểm tra system chromium (Docker/apt-get install)
  const fs = require('fs') as typeof import('fs');
  const systemPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];
  for (const p of systemPaths) {
    if (fs.existsSync(p)) {
      console.log(`[SunoPlaywright] Found system Chromium at: ${p}`);
      return p;
    }
  }

  // Không tìm thấy — Playwright tự dùng browser đã download qua `playwright install chromium`
  console.log('[SunoPlaywright] No system Chromium found, using Playwright downloaded browser.');
  return undefined;
}

/** Launch hoặc reuse browser */
async function getBrowser(): Promise<import('playwright-core').Browser> {
  const { chromium } = await import('playwright-core');

  // Nếu browser đang chạy → reuse
  if (_browser && _browser.isConnected()) {
    _lastUsed = Date.now();
    return _browser;
  }

  // Đóng browser cũ nếu có
  if (_browser) {
    try { await _browser.close(); } catch { /* ignore */ }
    _browser = null;
  }

  const execPath = getChromiumPath();
  console.log(`[SunoPlaywright] Launching Chromium... execPath=${execPath ?? 'playwright-default'}`);

  _browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  _lastUsed = Date.now();
  console.log('[SunoPlaywright] ✅ Chromium launched successfully.');

  // Tự động đóng browser sau BROWSER_IDLE_TIMEOUT không dùng
  const checkIdle = setInterval(async () => {
    if (Date.now() - _lastUsed > BROWSER_IDLE_TIMEOUT && _browser) {
      console.log('[SunoPlaywright] Closing idle browser...');
      clearInterval(checkIdle);
      try { await _browser.close(); } catch { /* ignore */ }
      _browser = null;
    }
  }, 60 * 1000);

  return _browser;
}


/** Lấy cookie Suno từ DB hoặc ENV */
async function getSunoCookie(): Promise<string> {
  try {
    const cfg = await prisma.systemConfig.findUnique({ where: { key: 'suno_cookie' } });
    if (cfg?.value) return cfg.value;
  } catch { /* ignore */ }
  const env = process.env.SUNO_COOKIE;
  if (env) return env;
  throw new Error('SUNO_COOKIE chưa được cấu hình.');
}

/** Parse cookie string → mảng { name, value, domain, path } cho Playwright */
function parseCookieString(cookieStr: string, domain = 'suno.com'): Array<{
  name: string; value: string; domain: string; path: string; httpOnly?: boolean; secure?: boolean;
}> {
  return cookieStr.split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;
      const name = pair.substring(0, idx).trim();
      const value = pair.substring(idx + 1).trim();
      if (!name) return null;
      return {
        name,
        value,
        domain: `.${domain}`,
        path: '/',
        httpOnly: name.startsWith('__'),
        secure: true,
      };
    })
    .filter(Boolean) as Array<{ name: string; value: string; domain: string; path: string }>;
}

/**
 * Tạo nhạc qua Playwright (bypass Cloudflare Turnstile).
 * Chạy trong queue để tránh nhiều browser chạy đồng thời.
 */
export async function generateViaPlaywright(params: {
  model: string;
  customMode: boolean;
  lyrics?: string;
  tags?: string;
  title?: string;
  makeInstrumental?: boolean;
}): Promise<{ taskId: string }> {
  // Queue: chờ request trước xong rồi mới chạy
  const result = await new Promise<{ taskId: string }>((resolve, reject) => {
    _generateQueue = _generateQueue.then(async () => {
      try {
        const r = await _doGenerate(params);
        resolve(r);
      } catch (err) {
        reject(err);
      }
    });
  });
  return result;
}

async function _doGenerate(params: {
  model: string;
  customMode: boolean;
  lyrics?: string;
  tags?: string;
  title?: string;
  makeInstrumental?: boolean;
}): Promise<{ taskId: string }> {
  const startMs = Date.now();
  console.log('[SunoPlaywright] Starting generate via Playwright...');

  const cookie = await getSunoCookie();
  const browser = await getBrowser();

  // Tạo context mới với cookie inject
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Inject cookies
  const cookies = parseCookieString(cookie);
  if (cookies.length > 0) {
    await context.addCookies(cookies);
    console.log(`[SunoPlaywright] Injected ${cookies.length} cookies.`);
  }

  // Ẩn webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    // Mở suno.com/create để Turnstile có thể load đúng domain
    console.log('[SunoPlaywright] Navigating to suno.com/create...');
    await page.goto('https://suno.com/create', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Chờ Clerk load (JWT sẵn sàng)
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(window as any).Clerk?.session;
    }, { timeout: 15000 }).catch(() => {
      console.warn('[SunoPlaywright] Clerk not ready — continuing anyway.');
    });

    // Chờ Turnstile widget render (nếu có)
    await page.waitForTimeout(2000);

    // Build request body
    const body: Record<string, unknown> = {
      mv: params.model || 'chirp-fenix',
      make_instrumental: params.makeInstrumental || false,
    };
    if (params.customMode) {
      body.custom_mode = true;
      body.prompt = params.lyrics || '';
      body.tags = (params.tags || '').substring(0, 200);
      body.title = params.title || '';
    } else {
      body.prompt = params.lyrics || '';
    }

    // Gọi API từ browser context (Turnstile token tự động có)
    const jsResult = await page.evaluate(async (reqBody: Record<string, unknown>) => {
      try {
        // Lấy JWT từ Clerk
        let jwt: string | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const clerk = (window as any).Clerk;
          if (clerk?.session?.getToken) {
            jwt = await clerk.session.getToken();
          }
        } catch { /* ignore */ }

        // Lấy Turnstile token
        let browserToken: string | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const turnstile = (window as any).turnstile;
          if (turnstile) {
            // Thử getResponse() trực tiếp
            try { browserToken = turnstile.getResponse(); } catch { /* ignore */ }

            // Thử tìm widget ID trong DOM
            if (!browserToken) {
              const widgets = document.querySelectorAll('[data-turnstile-widget-id], .cf-turnstile');
              for (const el of widgets) {
                const wid = el.getAttribute('data-turnstile-widget-id') || el.id;
                if (!wid) continue;
                try {
                  const r = turnstile.getResponse(wid);
                  if (r) { browserToken = r; break; }
                } catch { /* ignore */ }
              }
            }

            // Thử hidden input
            if (!browserToken) {
              const input = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
              if (input?.value) browserToken = input.value;
            }

            // Execute mới nếu chưa có token
            if (!browserToken) {
              browserToken = await new Promise<string | null>((res) => {
                try {
                  turnstile.execute(undefined, {
                    callback: (t: string) => res(t),
                  });
                  setTimeout(() => res(null), 8000);
                } catch { res(null); }
              });
            }
          }
        } catch { /* ignore */ }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
        if (browserToken) headers['browser-token'] = browserToken;

        const res = await fetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(reqBody),
        });

        const text = await res.text();
        return {
          status: res.status,
          body: text.substring(0, 3000),
          hadJwt: !!jwt,
          hadToken: !!browserToken,
          tokenLen: browserToken?.length || 0,
          cookieStr: document.cookie?.substring(0, 500),
        };
      } catch (e) {
        return { error: String(e), status: 0, body: '', hadJwt: false, hadToken: false, tokenLen: 0 };
      }
    }, body);

    console.log(`[SunoPlaywright] Result: status=${jsResult.status}, hadJwt=${jsResult.hadJwt}, hadToken=${jsResult.hadToken}, tokenLen=${jsResult.tokenLen}`);

    // Cập nhật cookie mới vào DB nếu có
    if (jsResult.cookieStr && (jsResult.cookieStr.includes('__client') || jsResult.cookieStr.includes('__session'))) {
      prisma.systemConfig.upsert({
        where: { key: 'suno_cookie' },
        update: { value: jsResult.cookieStr },
        create: { key: 'suno_cookie', value: jsResult.cookieStr },
      }).catch(() => { /* fire and forget */ });
    }

    if (jsResult.error) {
      throw new Error(`Playwright JS error: ${jsResult.error}`);
    }
    if (jsResult.status === 429) {
      throw new Error(`rate_limited: ${jsResult.body?.substring(0, 100)}`);
    }
    if (jsResult.status === 422 || jsResult.body?.includes('token_validation_failed')) {
      throw new Error(`token_validation_failed via Playwright: ${jsResult.body?.substring(0, 200)}`);
    }
    if (!jsResult.status || (jsResult.status !== 200 && jsResult.status !== 201)) {
      throw new Error(`Playwright generate error (status ${jsResult.status}): ${jsResult.body?.substring(0, 200)}`);
    }

    let data: { clips?: Array<{ id: string }> };
    try {
      data = JSON.parse(jsResult.body || '{}');
    } catch {
      throw new Error(`Cannot parse response: ${jsResult.body?.substring(0, 200)}`);
    }

    const clips = data?.clips;
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      throw new Error('Playwright generate: no clips returned');
    }

    const clipIds = clips.map(c => c.id).join(',');
    const elapsed = Date.now() - startMs;
    console.log(`[SunoPlaywright] ✅ Generate succeeded! clips=${clipIds}, elapsed=${elapsed}ms`);
    return { taskId: `sunocookie-${clipIds}` };

  } finally {
    // Đóng page và context sau mỗi request (giải phóng RAM)
    try { await page.close(); } catch { /* ignore */ }
    try { await context.close(); } catch { /* ignore */ }
    _lastUsed = Date.now();
  }
}
