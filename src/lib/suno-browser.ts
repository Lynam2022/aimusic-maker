/**
 * SunoBrowserClient - Dùng Chrome DevTools Protocol (CDP) qua WebSocket
 * để tạo nhạc trong context browser thật (bypass Cloudflare Turnstile).
 *
 * Chrome đang chạy với --remote-debugging-port=9222.
 * CHỈ chạy trên server-side (Node.js) qua dynamic import.
 */
import * as http from 'http';
import * as net from 'net';
import * as crypto from 'crypto';

interface ChromeTarget {
  id: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
  type: string;
}

const CDP_PORT = process.env.CHROME_DEBUG_PORT ? parseInt(process.env.CHROME_DEBUG_PORT) : 9222;
const CDP_HOST = process.env.CHROME_DEBUG_HOST || '127.0.0.1';

/**
 * Liệt kê Chrome tabs qua HTTP
 */
async function getChromeTargets(): Promise<ChromeTarget[]> {
  // Trên Render cloud: không có CDP Chrome, dùng Playwright thay thế
  if (process.env.RENDER || process.env.RENDER_SERVICE_NAME || process.env.RENDER_INSTANCE_ID) {
    return []; // getChromeTargets không dùng trên Render — generateViaBrowser sẽ redirect sang Playwright
  }
  return new Promise((resolve) => {
    const req = http.get(
      { host: CDP_HOST, port: CDP_PORT, path: '/json/list', timeout: 3000 },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve([]); }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

/**
 * Lấy tab suno.com đang mở (ưu tiên /create)
 */
async function getSunoTab(): Promise<ChromeTarget | null> {
  const targets = await getChromeTargets();
  const sunoTabs = targets.filter(
    (t) => t.type === 'page' && t.url.includes('suno.com') && t.webSocketDebuggerUrl
  );
  if (sunoTabs.length === 0) return null;
  return sunoTabs.find((t) => t.url.includes('/create')) || sunoTabs[0];
}

/**
 * WebSocket client tối giản dùng Node.js net.Socket (không cần package ws)
 */
function sendCDPCommand(
  wsUrl: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Parse WebSocket URL
    const url = new URL(wsUrl.replace('ws://', 'http://'));
    const host = url.hostname;
    const port = parseInt(url.port || '80');
    const path = url.pathname;

    const msgId = Math.floor(Math.random() * 100000) + 1;
    const message = JSON.stringify({ id: msgId, method, params });

    // WebSocket handshake key
    const wsKey = crypto.randomBytes(16).toString('base64');

    const socket = new net.Socket();
    let buffer = '';
    let handshakeDone = false;
    let resolved = false;

    const fail = (err: Error) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(err);
      }
    };

    const done = (value: unknown) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(value);
      }
    };

    const timeout = setTimeout(() => fail(new Error(`CDP timeout for ${method}`)), 25000);

    socket.connect(port, host, () => {
      // Send HTTP Upgrade request
      const upgrade = [
        `GET ${path} HTTP/1.1`,
        `Host: ${host}:${port}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `\r\n`,
      ].join('\r\n');
      socket.write(upgrade);
    });

    socket.on('data', (chunk: Buffer) => {
      if (!handshakeDone) {
        buffer += chunk.toString('binary');
        if (buffer.includes('\r\n\r\n')) {
          handshakeDone = true;
          buffer = '';
          // Send CDP command as WebSocket text frame
          const msgBuf = Buffer.from(message, 'utf8');
          const frameLen = msgBuf.length;
          let header: Buffer;
          if (frameLen <= 125) {
            header = Buffer.alloc(6);
            header[0] = 0x81; // FIN + text
            header[1] = 0x80 | frameLen; // MASK + len
          } else if (frameLen <= 65535) {
            header = Buffer.alloc(8);
            header[0] = 0x81;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(frameLen, 2);
          } else {
            header = Buffer.alloc(14);
            header[0] = 0x81;
            header[1] = 0x80 | 127;
            header.writeBigUInt64BE(BigInt(frameLen), 2);
          }
          // Masking key (4 random bytes)
          const mask = crypto.randomBytes(4);
          mask.copy(header, header.length - 4);
          // Mask the payload
          const masked = Buffer.alloc(frameLen);
          for (let i = 0; i < frameLen; i++) {
            masked[i] = msgBuf[i] ^ mask[i % 4];
          }
          socket.write(Buffer.concat([header, masked]));
          return;
        }
      } else {
        // Parse WebSocket frame
        try {
          let offset = 0;
          const data = chunk;
          if (data.length < 2) return;
          const opcode = data[0] & 0x0f;
          if (opcode === 0x8) { // close
            fail(new Error('WebSocket closed by server'));
            return;
          }
          const masked = (data[1] & 0x80) !== 0;
          let payloadLen = data[1] & 0x7f;
          offset = 2;
          if (payloadLen === 126) { payloadLen = data.readUInt16BE(2); offset = 4; }
          else if (payloadLen === 127) { payloadLen = Number(data.readBigUInt64BE(2)); offset = 10; }
          if (masked) offset += 4;
          const payload = data.slice(offset, offset + payloadLen);
          const text = payload.toString('utf8');
          const msg = JSON.parse(text) as { id?: number; result?: unknown; error?: { message: string } };
          if (msg.id === msgId) {
            clearTimeout(timeout);
            if (msg.error) fail(new Error(`CDP error: ${msg.error.message}`));
            else done(msg.result);
          }
        } catch { /* ignore parse errors for non-target messages */ }
      }
    });

    socket.on('error', (err) => { clearTimeout(timeout); fail(err); });
    socket.on('close', () => { clearTimeout(timeout); fail(new Error('Socket closed')); });
  });
}

/**
 * Thực thi JavaScript trong tab Chrome với un-throttling & auto-retry reload
 */
async function evaluateInTab(wsUrl: string, expression: string): Promise<unknown> {
  // Bring tab to front để un-throttle JS execution trong Chrome
  try {
    await sendCDPCommand(wsUrl, 'Page.bringToFront', {});
  } catch (_) {}

  try {
    const result = await sendCDPCommand(wsUrl, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 25000,
    }) as { result?: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description: string } } };

    if (result?.exceptionDetails) {
      const errMsg = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(`JS exception: ${errMsg}`);
    }
    return result?.result?.value;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('CDP timeout')) {
      console.warn('[SunoBrowser] Runtime.evaluate timed out. Attempting Page.reload and retrying...');
      try {
        await sendCDPCommand(wsUrl, 'Page.reload', { ignoreCache: false });
        await new Promise(r => setTimeout(r, 4000)); // Chờ 4s để tab load xong
        await sendCDPCommand(wsUrl, 'Page.bringToFront', {});

        const retryResult = await sendCDPCommand(wsUrl, 'Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
          timeout: 25000,
        }) as { result?: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description: string } } };

        if (retryResult?.exceptionDetails) {
          const errMsg = retryResult.exceptionDetails.exception?.description || retryResult.exceptionDetails.text;
          throw new Error(`JS exception after reload: ${errMsg}`);
        }
        return retryResult?.result?.value;
      } catch (retryErr) {
        throw retryErr;
      }
    }
    throw err;
  }
}

/**
 * Kiểm tra xem Chrome debugging port có sẵn không
 */
export async function isChromeDebugAvailable(): Promise<boolean> {
  const targets = await getChromeTargets();
  return targets.length > 0;
}

/**
 * Trích xuất Cookie tươi từ tab Chrome Suno đang mở và tự động lưu vào DB (prisma.systemConfig 'suno_cookie')
 */
export async function syncCookieFromBrowser(): Promise<{ success: boolean; cookie?: string; message?: string }> {
  try {
    const sunoTab = await getSunoTab();
    if (!sunoTab) {
      return { success: false, message: 'Không tìm thấy tab suno.com trong trình duyệt Chrome' };
    }

    const wsUrl = sunoTab.webSocketDebuggerUrl;
    const jsCode = `
      (() => {
        try {
          return JSON.stringify({
            cookie: document.cookie || '',
            url: window.location.href,
            title: document.title
          });
        } catch(e) {
          return JSON.stringify({ error: String(e) });
        }
      })()
    `;

    const rawResult = await evaluateInTab(wsUrl, jsCode) as string;
    if (!rawResult) return { success: false, message: 'Browser không trả về dữ liệu cookie' };

    const parsed = JSON.parse(rawResult);
    if (parsed.error || !parsed.cookie) {
      return { success: false, message: parsed.error || 'Cookie rỗng trong browser' };
    }

    const browserCookie = parsed.cookie as string;
    if (!browserCookie.includes('__client') && !browserCookie.includes('__session')) {
      return { success: false, message: 'Cookie trong browser chưa đăng nhập Suno (thiếu __client / __session)' };
    }

    // Cập nhật cookie mới vào Database
    const { prisma } = await import('@/lib/db');
    await prisma.systemConfig.upsert({
      where: { key: 'suno_cookie' },
      update: { value: browserCookie },
      create: { key: 'suno_cookie', value: browserCookie }
    });

    console.log(`[SunoBrowser] ✅ Auto-synced fresh Suno Cookie from Chrome tab to DB! Length: ${browserCookie.length}`);
    return { success: true, cookie: browserCookie };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[SunoBrowser] Auto-sync cookie failed:', msg);
    return { success: false, message: msg };
  }
}

/**
 * Tạo nhạc trực tiếp trong browser (bypass Cloudflare Turnstile)
 */
export async function generateViaBrowser(params: {
  model: string;
  customMode: boolean;
  lyrics?: string;
  tags?: string;
  title?: string;
  makeInstrumental?: boolean;
}): Promise<{ taskId: string }> {
  // Trên Render: dùng Playwright (có Chromium cài trong Docker) thay vì CDP local
  if (process.env.RENDER || process.env.RENDER_SERVICE_NAME || process.env.RENDER_INSTANCE_ID) {
    console.log('[SunoBrowser] Render env detected → routing to Playwright Chromium...');
    const { generateViaPlaywright } = await import('./suno-playwright');
    return generateViaPlaywright(params);
  }

  const sunoTab = await getSunoTab();
  if (!sunoTab) {
    throw new Error('BROWSER_NOT_AVAILABLE');
  }

  const wsUrl = sunoTab.webSocketDebuggerUrl;
  console.log(`[SunoBrowser] Found suno.com tab: ${sunoTab.url}`);

  // Tự động sync cookie tươi trong background
  syncCookieFromBrowser().catch(() => {});

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

  const jsCode = `
    (async () => {
      try {
        const body = ${JSON.stringify(body)};
        
        // 1. Lấy fresh JWT từ Clerk
        let jwt = null;
        try {
          if (window.Clerk && window.Clerk.session) {
            jwt = await window.Clerk.session.getToken();
          }
        } catch(e) {}

        // 2. Lấy Turnstile token từ suno.com page (token này hợp lệ vì đúng domain)
        let browserToken = null;
        try {
          if (window.turnstile) {
            // Cách 1: getResponse() không cần widgetId (lấy widget đầu tiên)
            try { browserToken = window.turnstile.getResponse(); } catch(e) {}

            // Cách 2: tìm widgetId từ DOM và getResponse(id)
            if (!browserToken) {
              const widgetEls = document.querySelectorAll('[data-turnstile-widget-id], .cf-turnstile');
              for (const el of widgetEls) {
                const wid = el.getAttribute('data-turnstile-widget-id') || el.id;
                if (!wid) continue;
                try {
                  const r = window.turnstile.getResponse(wid);
                  if (r) { browserToken = r; break; }
                } catch(e) {}
              }
            }

            // Cách 3: nếu không có response, gọi execute() để auto-solve lại
            if (!browserToken) {
              const solved = await new Promise((res) => {
                try {
                  window.__cdpTurnstileToken = null;
                  const widgetEl = document.querySelector('[data-turnstile-widget-id]');
                  const wid = widgetEl?.getAttribute('data-turnstile-widget-id');
                  window.turnstile.execute(wid || undefined, {
                    callback: (token) => { window.__cdpTurnstileToken = token; res(token); }
                  });
                  setTimeout(() => res(window.__cdpTurnstileToken || null), 6000);
                } catch(e) { res(null); }
              });
              if (solved) browserToken = solved;
            }

            // Cách 4: check hidden input (Turnstile fills this automatically)
            if (!browserToken) {
              const hiddenInput = document.querySelector('input[name="cf-turnstile-response"]');
              if (hiddenInput && hiddenInput.value) browserToken = hiddenInput.value;
            }
          }
        } catch(e) {}

        const headers = { 'Content-Type': 'application/json' };
        if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
        if (browserToken) {
          headers['browser-token'] = browserToken;
        }

        const res = await fetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(body),
        });

        const text = await res.text();
        return JSON.stringify({
          status: res.status,
          body: text.substring(0, 2000),
          hadToken: !!browserToken,
          tokenLength: browserToken?.length || 0,
          cookie: document.cookie || ''
        });
      } catch(e) {
        return JSON.stringify({ error: String(e) });
      }
    })()
  `;

  console.log('[SunoBrowser] Executing generate in browser context (Turnstile handled by browser)...');
  const rawResult = await evaluateInTab(wsUrl, jsCode) as string;

  if (!rawResult || typeof rawResult !== 'string') {
    throw new Error('Browser returned empty result');
  }

  let parsed: { status?: number; body?: string; error?: string; hadToken?: boolean; tokenLength?: number; cookie?: string };
  try { parsed = JSON.parse(rawResult); } catch {
    throw new Error(`Invalid browser response: ${rawResult.substring(0, 200)}`);
  }

  console.log(`[SunoBrowser] CDP result: status=${parsed.status}, hadToken=${parsed.hadToken}, tokenLength=${parsed.tokenLength || 0}`);

  // Cập nhật cookie mới vào DB nếu có
  if (parsed.cookie && (parsed.cookie.includes('__client') || parsed.cookie.includes('__session'))) {
    try {
      const { prisma } = await import('@/lib/db');
      await prisma.systemConfig.upsert({
        where: { key: 'suno_cookie' },
        update: { value: parsed.cookie },
        create: { key: 'suno_cookie', value: parsed.cookie }
      });
      console.log('[SunoBrowser] ✅ Updated suno_cookie in DB after generate call.');
    } catch (_) {}
  }

  if (parsed.error) throw new Error(`Browser JS error: ${parsed.error}`);

  if (parsed.status === 429) throw new Error(`rate_limited via browser: ${parsed.body?.substring(0, 100)}`);
  if (parsed.status === 422) throw new Error(`token_validation_failed via browser: ${parsed.body?.substring(0, 200)}`);
  if (!parsed.status || (parsed.status !== 200 && parsed.status !== 201)) {
    throw new Error(`Browser generate error (status ${parsed.status}): ${parsed.body?.substring(0, 200)}`);
  }

  let data: { clips?: Array<{ id: string }> };
  try { data = JSON.parse(parsed.body || '{}'); } catch {
    throw new Error(`Cannot parse generate response: ${parsed.body?.substring(0, 200)}`);
  }

  const clips = data?.clips;
  if (!clips || !Array.isArray(clips) || clips.length === 0) {
    throw new Error('Browser generate: no clips returned');
  }

  const clipIds = clips.map((c) => c.id).join(',');
  console.log(`[SunoBrowser] ✅ Generate succeeded via browser! clips: ${clipIds}`);
  return { taskId: `sunocookie-${clipIds}` };
}
