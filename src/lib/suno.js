"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SunoClient = exports.SUNO_API_MODEL_MAP = exports.SUNO_PRESET_MODELS = void 0;
exports.cleanChords = cleanChords;
exports.obfuscateLyrics = obfuscateLyrics;
const db_1 = require("./db");
exports.SUNO_PRESET_MODELS = [
    { id: 'chirp-v3-5', label: 'v3.5' },
    { id: 'chirp-v4', label: 'v4' },
    { id: 'chirp-auk-turbo', label: 'v4.5' },
    { id: 'chirp-v5', label: 'v5' },
    { id: 'chirp-fenix', label: 'v5.5' },
];
exports.SUNO_API_MODEL_MAP = {
    'chirp-v3-5': 'V3_5',
    'chirp-v4': 'V4',
    'chirp-auk-turbo': 'V4_5ALL',
    'chirp-v5': 'V5',
    'chirp-fenix': 'V5_5',
};
function cleanChords(text) {
    if (!text)
        return '';
    return text
        .replace(/\[[^\]]+\]/g, (match) => {
            const content = match.slice(1, -1).trim().toLowerCase();
            const preserveKeywords = [
                'verse', 'chorus', 'pre-chorus', 'bridge', 'outro', 'intro', 'drop', 'hook',
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
function obfuscateLyrics(text) {
    if (!text)
        return '';
    // 1. Strip chord bracket notations (e.g. [Am7], [Cmaj7], [G/B]) so Suno doesn't try to sing them
    const cleanText = cleanChords(text);
    // 2. Safe Cyrillic / Homoglyph mapping that doesn't break Suno audio pronunciation
    const homoglyphMap = {
        'a': '\u0430', 'e': '\u0435', 'o': '\u043e', 'p': '\u0440',
        'A': '\u0410', 'E': '\u0415', 'O': '\u041e', 'P': '\u0420'
    };
    // 3. Process line by line: convert spaces between words to underscores '_' (e.g. bàn_tay_cao)
    // while preserving structural tags like [Verse], [Chorus], [Intro], etc.
    return cleanText.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            return trimmed;
        }
        return line.split(' ').map(word => {
            if (word.startsWith('[') && word.endsWith(']')) {
                return word;
            }
            return word.split('').map(char => homoglyphMap[char] || char).join('');
        }).filter(Boolean).join('_');
    }).join('\n');
}
const referenceFileMap = new Map();
function applyAdvancedSettings(style, prompt, styleWeight = 0.5, creativity = 0.3, audioQuality = 0.5, negativeTags = '') {
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
    }
    else if (audioQuality < 0.4) {
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
    }
    else if (creativity < 0.4) {
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
    }
    else if (styleWeight < 0.4) {
        const diluteTags = ['balanced mix', 'smooth transitions'];
        for (const tag of diluteTags) {
            if (!finalStyle.toLowerCase().includes(tag)) {
                finalStyle = finalStyle ? `${finalStyle}, ${tag}` : tag;
            }
        }
    }
    // Trim style to 200 characters limit
    if (finalStyle.length > 200) {
        const parts = finalStyle.split(',');
        let currentStyle = '';
        for (const part of parts) {
            const candidate = currentStyle ? `${currentStyle},${part}` : part;
            if (candidate.length <= 200) {
                currentStyle = candidate;
            }
            else {
                break;
            }
        }
        finalStyle = currentStyle || finalStyle.substring(0, 200);
    }
    return {
        style: finalStyle,
        prompt: finalPrompt,
    };
}
class SunoClient {
    static jwtCache = new Map();
    static pendingRefreshes = new Map();
    static getJwtExpiry(jwt) {
        try {
            const parts = jwt.split('.');
            if (parts.length < 2)
                return 0;
            let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const mod = payloadB64.length % 4;
            if (mod !== 0)
                payloadB64 += '='.repeat(4 - mod);
            const payload = JSON.parse(atob(payloadB64));
            return payload.exp ? payload.exp * 1000 : 0;
        }
        catch {
            return 0;
        }
    }
    static get sunoApiKey() {
        return process.env.SUNO_API_KEY || '';
    }
    static parseSessionToken(cookieStr) {
        const matches = [...cookieStr.matchAll(/(?:^|;)\s*__session\s*=\s*([^;]+)/g)];
        if (matches.length === 0)
            return null;
        let best = matches[0][1];
        let bestExp = 0;
        for (const m of matches) {
            try {
                const parts = m[1].split('.');
                let payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const mod = payloadB64.length % 4;
                if (mod !== 0)
                    payloadB64 += '='.repeat(4 - mod);
                const payload = JSON.parse(atob(payloadB64));
                if (payload.exp && payload.exp > bestExp) {
                    bestExp = payload.exp;
                    best = m[1];
                }
            }
            catch { }
        }
        return best;
    }
    static async getClerkJWT(cookie) {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        const headers = { Cookie: cookie, 'User-Agent': ua, Origin: 'https://suno.com', Referer: 'https://suno.com/' };
        try {
            const clientRes = await fetch('https://clerk.suno.com/v1/client?_clerk_js_version=4.73.2', { headers });
            const clientText = await clientRes.text();
            console.log('[SunoCookie] Clerk client response:', clientRes.status, clientText.substring(0, 300));
            if (!clientRes.ok)
                throw new Error(`Clerk client status ${clientRes.status}: ${clientText.substring(0, 200)}`);
            const clientData = JSON.parse(clientText);
            const sessionId = clientData?.response?.last_active_session_id;
            if (!sessionId)
                throw new Error('No active session in Clerk response');
            const tokenRes = await fetch(`https://clerk.suno.com/v1/client/sessions/${sessionId}/tokens?_clerk_js_version=4.73.2`, { method: 'POST', headers });
            const tokenText = await tokenRes.text();
            console.log('[SunoCookie] Clerk token response:', tokenRes.status, tokenText.substring(0, 300));
            if (!tokenRes.ok)
                throw new Error(`Clerk token status ${tokenRes.status}: ${tokenText.substring(0, 200)}`);
            const tokenData = JSON.parse(tokenText);
            const jwt = tokenData?.jwt || tokenData?.response?.jwt;
            if (!jwt)
                throw new Error('No JWT in Clerk token response');
            console.log('[SunoCookie] Clerk refresh OK, JWT length:', jwt.length);
            return jwt;
        }
        catch (err) {
            console.error('[SunoCookie] Clerk refresh error:', err instanceof Error ? err.message : err);
            throw err;
        }
    }
    static async getEffectiveCookie(userId) {
        if (userId) {
            try {
                const user = await db_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { sunoCookie: true },
                });
                if (user?.sunoCookie)
                    return user.sunoCookie;
            }
            catch { }
        }
        // Check general system config set by admin
        try {
            const config = await db_1.prisma.systemConfig.findUnique({
                where: { key: 'suno_cookie' }
            });
            if (config?.value)
                return config.value;
        }
        catch { }
        const env = process.env.SUNO_COOKIE;
        if (env)
            return env;
        throw new Error('SUNO_COOKIE chưa được cấu hình. Vui lòng liên hệ Admin hoặc tự cấu hình trong Settings.');
    }
    static async getEffectiveBrowserToken(userId) {
        if (userId) {
            try {
                const user = await db_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { sunoBrowserToken: true },
                });
                if (user?.sunoBrowserToken)
                    return user.sunoBrowserToken;
            }
            catch { }
        }
        // Check general system config set by admin
        try {
            const config = await db_1.prisma.systemConfig.findUnique({
                where: { key: 'suno_token' }
            });
            if (config?.value)
                return config.value;
        }
        catch { }
        return process.env.SUNO_TOKEN || '';
    }
    static async getEffectiveJWT(cookie) {
        const now = Date.now();
        const cached = this.jwtCache.get(cookie);
        if (cached && cached.expiresAt > now + 15000) {
            return cached.jwt;
        }
        let pending = this.pendingRefreshes.get(cookie);
        if (pending) {
            try {
                return await pending;
            }
            catch {
                // Fall through to retry or fallback below
            }
        }
        const refreshPromise = (async () => {
            const jwt = await this.getClerkJWT(cookie);
            const expiresAt = this.getJwtExpiry(jwt);
            if (expiresAt > 0) {
                this.jwtCache.set(cookie, { jwt, expiresAt });
            }
            return jwt;
        })();
        this.pendingRefreshes.set(cookie, refreshPromise);
        try {
            const jwt = await refreshPromise;
            return jwt;
        }
        catch (err) {
            const sessionToken = this.parseSessionToken(cookie);
            if (sessionToken) {
                console.warn('[SunoCookie] Clerk refresh failed, using cached __session as fallback.');
                return sessionToken;
            }
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            throw new Error(`Không thể lấy token xác thực mới từ Suno. (${errMsg})`);
        }
        finally {
            this.pendingRefreshes.delete(cookie);
        }
    }
    static generateBrowserTokenHeader(browserToken) {
        if (browserToken)
            return browserToken;
        const timestamp = Date.now();
        const payload = JSON.stringify({ timestamp });
        const b64 = Buffer.from(payload).toString('base64');
        return JSON.stringify({ token: b64 });
    }
    static extractDeviceId(cookieStr) {
        const m0 = cookieStr.match(/(?:^|;)\s*ajs_anonymous_id\s*=\s*([^;]+)/);
        if (m0)
            return m0[1];
        const m1 = cookieStr.match(/(?:^|;)\s*suno_device_id\s*=\s*([^;]+)/);
        if (m1)
            return m1[1];
        const m2 = cookieStr.match(/(?:^|;)\s*singular_device_id\s*=\s*([^;]+)/);
        if (m2)
            return m2[1];
        const m3 = cookieStr.match(/(?:^|;)\s*ab\.storage\.deviceId\.[^=]+=\s*([^;]+)/);
        if (m3)
            return m3[1].replace(/^%22/, '').replace(/%22$/, '');
        return 'suno-web-default';
    }
    static extractBrowserToken(cookieStr) {
        const m = cookieStr.match(/(?:^|;)\s*__client\s*=\s*([^;]+)/);
        return m ? m[1] : undefined;
    }
    static extractXAblyToken(cookieOrJwt) {
        let jwt = cookieOrJwt;
        if (cookieOrJwt.includes('=')) {
            const m = cookieOrJwt.match(/(?:^|;)\s*__session\s*=\s*([^;]+)/);
            if (!m)
                return null;
            jwt = m[1];
        }
        try {
            const parts = jwt.split('.');
            if (parts.length < 2)
                return null;
            let headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
            const mod = headerB64.length % 4;
            if (mod !== 0)
                headerB64 += '='.repeat(4 - mod);
            const header = JSON.parse(atob(headerB64));
            return header['x-ably-token'] || null;
        }
        catch {
            return null;
        }
    }
    static sunoHeaders() {
        return {
            Authorization: `Bearer ${this.sunoApiKey}`,
            'Content-Type': 'application/json',
        };
    }
    static async getSunoBalance(userId) {
        try {
            const sunoCookie = await this.getEffectiveCookie(userId).catch(() => null);
            if (!sunoCookie)
                return null;
            const jwt = await this.getEffectiveJWT(sunoCookie);
            const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(sunoCookie);
            const headers = {
                'Authorization': `Bearer ${jwt}`,
                'Cookie': sunoCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Origin': 'https://suno.com',
                'Referer': 'https://suno.com/',
                'device-id': deviceId,
            };
            const res = await fetch('https://studio-api-prod.suno.com/api/billing/info/', {
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
        }
        catch (err) {
            console.error('[SunoClient] Error fetching billing info:', err);
            return null;
        }
    }
    static async uploadReferenceFlow(ref, userId) {
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
    static async uploadReference(ref, cookie, jwt, deviceId, browserToken) {
        const isImage = ref.type.startsWith('image/');
        const typePath = isImage ? 'image' : 'audio';
        const extension = ref.name.split('.').pop()?.toLowerCase() || '';
        const headers = {
            'Authorization': `Bearer ${jwt}`,
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Origin': 'https://suno.com',
            'Referer': 'https://suno.com/',
            'device-id': deviceId,
            'Content-Type': 'application/json',
            'browser-token': this.generateBrowserTokenHeader(browserToken),
        };
        // 1. Initialize Upload on Suno
        const initUrl = `https://studio-api-prod.suno.com/api/uploads/${typePath}/`;
        const initBody = isImage ? { extension } : { extension, is_stem_mix: false };
        const initRes = await fetch(initUrl, {
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
            formData.append(k, v);
        }
        // S3 expects the 'file' key to be the last field in the form data
        formData.append('file', blob, ref.name);
        const s3Res = await fetch(s3Url, {
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
        const finishRes = await fetch(finishUrl, {
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
            const statusRes = await fetch(`https://studio-api-prod.suno.com/api/uploads/audio/${uploadId}/`, {
                headers,
            });
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                status = statusData.status;
                if (status === 'error') {
                    let errMsg = statusData.error_message || 'Không thể phân tích file.';
                    if (errMsg.includes('matches an existing recording in our catalog')) {
                        errMsg = 'File âm thanh trùng khớp với bản nhạc có bản quyền trong danh mục của Suno. Vui lòng thử lại với file khác.';
                    }
                    else if (errMsg.includes('too short')) {
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
        const initClipRes = await fetch(`https://studio-api-prod.suno.com/api/uploads/audio/${uploadId}/initialize-clip/`, {
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
    static async generate(params) {
        const sunoApiKey = this.sunoApiKey;
        const sunoCookie = await this.getEffectiveCookie(params.userId).catch(() => null);
        const customBrowserToken = await this.getEffectiveBrowserToken(params.userId).catch(() => '');
        if (!sunoApiKey && !sunoCookie) {
            throw new Error('Không có Suno cookie. Vui lòng kết nối tài khoản Suno trong Settings.');
        }
        // Apply Advanced Settings to style tags and prompt
        let { style: finalStyle, prompt: finalPrompt } = applyAdvancedSettings(params.style || '', params.prompt || '', params.styleWeight, params.creativity, params.audioQuality, params.negativeTags);

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
            }
            else if (gender === 'male') {
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
            
            // Clean opposing tag if present
            lyricText = lyricText.replace(new RegExp(opposingTag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '');
            
            // Prepend tag if not present
            if (!lyricText.toLowerCase().includes(genderTag.toLowerCase())) {
                lyricText = `${genderTag}\n${lyricText}`;
            }
            params.lyrics = lyricText;
        }

        params.style = finalStyle;
        params.prompt = finalPrompt;
        // Option A: Use User Browser Cookie if available and API Key is not set
        if (sunoCookie && !sunoApiKey) {
            const jwt = await this.getEffectiveJWT(sunoCookie);
            const isCustomMode = params.mode === 'lyrics';
            const model = params.sunoModel === 'remix' ? 'chirp-custom:d5c6a782-24f7-493f-a239-440980e6d32e' : (params.sunoModel || 'chirp-v3-5');
            let browserToken = customBrowserToken || jwt;
            const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(sunoCookie);
            if (!browserToken) {
                console.warn('[SunoCookie] No browser-token found. Suno API requires it. Trying without...');
            }
            // Upload reference file if provided
            let referenceFileId = params.referenceFileId || null;
            let referenceSkipped = false;
            if (params.referenceFile && !referenceFileId) {
                referenceFileId = await this.uploadReference(params.referenceFile, sunoCookie, jwt, deviceId, browserToken);
                if (!referenceFileId) {
                    referenceSkipped = true;
                    console.warn('[SunoCookie] Upload endpoints unavailable, skipping reference file.');
                }
            }
            const body = {
                mv: model,
                make_instrumental: params.outputType === 'instrumental',
            };
            // Cover mode: Suno requires custom_mode:true + lyrics (prompt) + tags
            // so the generated song uses YOUR lyrics over the reference melody.
            const isCoverWithLyrics = params.referenceMode === 'cover' && (params.lyrics || params.style);
            const effectiveCustomMode = isCustomMode || isCoverWithLyrics;
            if (effectiveCustomMode) {
                body.custom_mode = true; // ← required by Suno for Cover with custom lyrics
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
                body.tags = tags.substring(0, 200);
                body.title = params.title || '';
            }
            else {
                let promptText = params.prompt || '';
                if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto') {
                    const genderText = `${params.vocalGender} vocalist`;
                    if (!promptText.toLowerCase().includes('vocalist') && !promptText.toLowerCase().includes('vocals') && !promptText.toLowerCase().includes(params.vocalGender)) {
                        promptText = promptText ? `${promptText}, ${genderText}` : genderText;
                    }
                }
                body.prompt = promptText;
            }
            if (browserToken) {
                body.token = browserToken;
            }
            if (referenceFileId) {
                const fileType = params.referenceFileType || params.referenceFile?.type || '';
                const isImage = fileType.startsWith('image/');
                if (isImage) {
                    body.image_file_id = referenceFileId;
                }
                else {
                    if (params.referenceMode === 'cover') {
                        body.cover_clip_id = referenceFileId;
                    }
                    else if (params.referenceMode === 'extend') {
                        body.continue_clip_id = referenceFileId;
                        body.continue_at = params.continueAt ?? 30.0;
                    }
                    else {
                        body.audio_file_id = referenceFileId;
                    }
                }
            }
            const headers = {
                'Authorization': `Bearer ${jwt}`,
                'Cookie': sunoCookie,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Origin': 'https://suno.com',
                'Referer': 'https://suno.com/',
                'device-id': deviceId,
                'browser-token': this.generateBrowserTokenHeader(browserToken),
            };
            console.log('[SunoCookie] Request params:', {
                model,
                deviceId,
                hasBrowserToken: !!browserToken,
                jwtLength: jwt.length,
                custom_mode: body.custom_mode,
                cover_clip_id: body.cover_clip_id,
                audio_file_id: body.audio_file_id,
                has_lyrics: !!(body.prompt),
                tags_preview: typeof body.tags === 'string' ? body.tags.substring(0, 80) : undefined,
            });
            let res = await fetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                let errText = await res.text();
                console.error('[SunoCookie] Generate response error:', errText);
                // Auto-fallback for token validation: if custom token fails, retry once with freshly extracted token
                if (errText.includes('token_validation_failed') && customBrowserToken && sunoCookie) {
                    try {
                        const extractedToken = await this.getEffectiveJWT(sunoCookie);
                        if (extractedToken && extractedToken !== customBrowserToken) {
                            console.warn('[SunoCookie] Custom Browser Token validation failed. Retrying with freshly extracted Ably token...');
                            body.token = extractedToken;
                            browserToken = extractedToken;
                            headers['Authorization'] = `Bearer ${extractedToken}`;
                            res = await fetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
                                method: 'POST',
                                headers,
                                body: JSON.stringify(body)
                            });
                            if (!res.ok) {
                                errText = await res.text();
                                console.error('[SunoCookie] Retried generate response error:', errText);
                            }
                        }
                    }
                    catch (retryErr) {
                        console.error('[SunoCookie] Retry token extraction error:', retryErr);
                    }
                }
                // Auto-fallback: If selected model is invalid (e.g. Free Tier account trying to access chirp-fenix / chirp-v4)
                if (!res.ok && res.status === 400 && (errText.includes("The selected model isn't valid") || errText.includes("invalid_input")) && model !== 'chirp-v3-5') {
                    console.warn(`[SunoCookie] Model ${model} is not supported on this account. Falling back to chirp-v3-5...`);
                    body.mv = 'chirp-v3-5';
                    res = await fetch('https://studio-api-prod.suno.com/api/generate/v2-web/', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body)
                    });
                    if (!res.ok) {
                        errText = await res.text();
                        console.error('[SunoCookie] Fallback generate response error:', errText);
                    }
                }
                if (!res.ok) {
                    if (errText.includes('does not support')) {
                        throw new Error('Model này không hỗ trợ upload file reference. Vui lòng thử model khác (vd: v4 hoặc v5).');
                    }
                    if (!browserToken || errText.includes('token_validation_failed')) {
                        throw new Error(`Suno API yêu cầu Browser Token. Vui lòng: ` +
                            `1) Vào suno.com -> F12 -> Network -> Generate 1 bài -> ` +
                            `2) Click request đến studio-api.prod.suno.com -> Payload tab -> Copy field "token" -> ` +
                            `3) Vào Settings -> Kết Nối Suno -> Paste vào ô "Browser Token". ` +
                            `(${errText.substring(0, 200)})`);
                    }
                    throw new Error(`Lỗi sinh nhạc qua Suno.com Cookie (Status: ${res.status}): ${errText}`);
                }
            }
            const data = await res.json();
            const clips = data?.clips;
            if (!clips || !Array.isArray(clips) || clips.length === 0) {
                throw new Error('Không nhận được clip âm nhạc nào từ Suno Studio API.');
            }
            const clipIds = clips.map((c) => c.id).join(',');
            const sunocookieTaskId = `sunocookie-${clipIds}`;
            if (params.referenceFile) {
                if (!referenceSkipped) {
                    referenceFileMap.set(sunocookieTaskId, params.referenceFile.name);
                }
            }
            const result = { taskId: sunocookieTaskId };
            if (referenceSkipped) {
                result.warning = `Không thể upload "${params.referenceFile.name}" — Suno API upload hiện không khả dụng. Đã bỏ qua reference file.`;
            }
            return result;
        }
        // Option B: Use Third-party API Gateway (sunoapi.org)
        const isCustomMode = params.mode === 'lyrics';
        const endpoint = isCustomMode
            ? 'https://api.sunoapi.org/api/v1/custom_generate'
            : 'https://api.sunoapi.org/api/v1/generate';
        const modelParam = params.sunoModel === 'remix' ? 'chirp-custom:d5c6a782-24f7-493f-a239-440980e6d32e' : (params.sunoModel || 'chirp-v3-5');
        const body = {
            model: exports.SUNO_API_MODEL_MAP[modelParam] || modelParam || 'V3_5',
            make_instrumental: params.outputType === 'instrumental',
        };
        if (isCustomMode) {
            body.prompt = params.outputType === 'instrumental' ? '' : (params.lyrics || '');
            let tags = params.style || '';
            if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto') {
                const genderTag = `${params.vocalGender} vocalist`;
                if (!tags.toLowerCase().includes('vocalist') && !tags.toLowerCase().includes('vocals') && !tags.toLowerCase().includes(params.vocalGender)) {
                    tags = tags ? `${tags}, ${genderTag}` : genderTag;
                }
            }
            body.tags = tags.substring(0, 200);
            body.title = params.title || '';
        }
        else {
            let promptText = params.prompt || '';
            if (params.outputType === 'vocal' && params.vocalGender && params.vocalGender !== 'auto') {
                const genderText = `${params.vocalGender} vocalist`;
                if (!promptText.toLowerCase().includes('vocalist') && !promptText.toLowerCase().includes('vocals') && !promptText.toLowerCase().includes(params.vocalGender)) {
                    promptText = promptText ? `${promptText}, ${genderText}` : genderText;
                }
            }
            body.prompt = promptText;
        }
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: this.sunoHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`Lỗi API Suno: ${res.status}`);
        }
        const data = await res.json();
        if (data.code !== 200 || !data.data?.taskId) {
            throw new Error(data.msg || 'Không thể tạo tác vụ nhạc trên Suno API.');
        }
        return { taskId: `suno-${data.data.taskId}` };
    }
    static async checkStatus(taskId, userId) {
        const isSunoCookie = taskId.startsWith('sunocookie-');
        const isSuno = taskId.startsWith('suno-');
        const realTaskId = taskId.replace(/^(suno-|sunocookie-)/, '');
        // ── SUNO COOKIE STATUS CHECK ─────────────────────────────
        if (isSunoCookie) {
            try {
                const cookie = await this.getEffectiveCookie(userId).catch(() => process.env.SUNO_COOKIE || '');
                if (!cookie)
                    return { status: 'processing' };
                const jwt = await this.getEffectiveJWT(cookie);
                const deviceId = process.env.SUNO_DEVICE_ID || this.extractDeviceId(cookie);
                const headers = {
                    'Authorization': `Bearer ${jwt}`,
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Origin': 'https://suno.com',
                    'Referer': 'https://suno.com/',
                    'device-id': deviceId,
                    'browser-token': this.generateBrowserTokenHeader(),
                };
                const res = await fetch(`https://studio-api-prod.suno.com/api/feed/?ids=${realTaskId}`, {
                    headers
                });
                if (!res.ok)
                    return { status: 'processing' };
                const clips = await res.json();
                if (!Array.isArray(clips) || clips.length === 0)
                    return { status: 'processing' };
                const isAllComplete = clips.every((c) => c.status === 'complete');
                const hasFailed = clips.some((c) => c.status === 'failed' || c.status === 'error');
                if (hasFailed)
                    return { status: 'failed' };
                const sourceName = referenceFileMap.get(taskId) || undefined;
                const tracks = clips.map((item, idx) => {
                    const metadata = item.metadata;
                    return {
                        id: item.id || `${realTaskId}-track-${idx + 1}`,
                        title: item.title || `Suno Track ${idx + 1}`,
                        url: item.audio_url || '',
                        coverUrl: item.image_url || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop`,
                        duration: item.duration ? Math.floor(Number(item.duration)) : 0,
                        style: metadata?.tags || undefined,
                        lyrics: metadata?.prompt || undefined,
                        sourceName,
                        videoUrl: item.video_url || '',
                    };
                });
                if (isAllComplete) {
                    if (sourceName)
                        referenceFileMap.delete(taskId);
                    return { status: 'completed', tracks };
                }
                const playableTracks = tracks.filter(t => t.url);
                if (playableTracks.length > 0) {
                    return { status: 'processing', tracks: playableTracks };
                }
                return { status: 'processing' };
            }
            catch {
                return { status: 'processing' };
            }
        }
        // ── SUNO STATUS CHECK (API KEY) ──────────────────────────
        if (isSuno) {
            if (!this.sunoApiKey) {
                return { status: 'failed' };
            }
            const res = await fetch(`https://api.sunoapi.org/api/v1/record-info?taskId=${realTaskId}`, {
                headers: this.sunoHeaders(),
            });
            if (!res.ok)
                return { status: 'processing' };
            const data = await res.json();
            if (data.code !== 200 || !data.data)
                return { status: 'processing' };
            const status = data.data.status;
            if (status === 'FAILED' || status === 'SENSITIVE_WORD_ERROR' || status === 'GENERATE_LYRICS_FAILED') {
                return { status: 'failed' };
            }
            if (data.data.response?.data || data.data.response) {
                const rawResData = data.data.response?.data || data.data.response;
                const resultArr = Array.isArray(rawResData) ? rawResData : [rawResData];
                const tracks = resultArr.map((item, idx) => {
                    return {
                        id: item.id || `${realTaskId}-track-${idx + 1}`,
                        title: item.title || `Suno Track ${idx + 1}`,
                        url: item.audio_url || '',
                        coverUrl: item.image_url || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop`,
                        duration: item.duration ? Math.floor(Number(item.duration)) : 0,
                        style: item.tags || undefined,
                        lyrics: item.lyric || undefined,
                        videoUrl: item.video_url || '',
                    };
                });
                if (status === 'SUCCESS') {
                    return { status: 'completed', tracks };
                }
                const playableTracks = tracks.filter(t => t.url);
                if (playableTracks.length > 0) {
                    return { status: 'processing', tracks: playableTracks };
                }
            }
            return { status: 'processing' };
        }
        return { status: 'failed' };
    }
    static async getOrGenerateVideoUrl(clipId, userId) {
        try {
            const cookie = await this.getEffectiveCookie(userId).catch(() => process.env.SUNO_COOKIE || '');
            if (!cookie)
                return `https://cdn1.suno.ai/${clipId}.mp4`;
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
                const res = await fetch(statusUrl, { headers });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'complete' && data.video_url) {
                        videoUrl = data.video_url;
                        isComplete = true;
                        console.log(`[SunoClient] Video status check: complete, checking S3 link...`);
                    }
                    else if (data.status === 'processing') {
                        console.log(`[SunoClient] Video status check: processing, skipping trigger...`);
                    }
                }
            }
            catch (e) {
                console.error('[SunoClient] Error checking video status:', e);
            }
            // 1.1 Verify S3 file availability if complete
            if (isComplete && videoUrl) {
                try {
                    const checkRes = await fetch(videoUrl, {
                        method: 'HEAD',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
                        }
                    });
                    if (checkRes.status === 403 || checkRes.status === 404) {
                        console.warn(`[SunoClient] Video link returned ${checkRes.status} (Access Denied). Forcing regeneration trigger...`);
                        isComplete = false;
                    }
                    else {
                        console.log(`[SunoClient] Video is verified ready on S3: ${videoUrl}`);
                        return videoUrl;
                    }
                }
                catch (checkErr) {
                    console.error('[SunoClient] Error verifying S3 link:', checkErr);
                }
            }
            // 2. Trigger video generation if not ready/complete (or S3 file missing)
            if (!isComplete) {
                try {
                    console.log(`[SunoClient] Triggering video generation for clip: ${clipId}`);
                    const triggerUrl = `https://studio-api-prod.suno.com/api/video/generate/${clipId}/`;
                    const triggerRes = await fetch(triggerUrl, {
                        method: 'POST',
                        headers: {
                            ...headers,
                            'Content-Type': 'application/json',
                        },
                    });
                    if (!triggerRes.ok) {
                        console.warn(`[SunoClient] Trigger video generation failed: ${triggerRes.statusText}`);
                    }
                }
                catch (e) {
                    console.error('[SunoClient] Error triggering video generation:', e);
                }
                // 3. Poll for status (max 45 seconds because video rendering takes ~20s)
                const start = Date.now();
                while (Date.now() - start < 45000) {
                    try {
                        const res = await fetch(statusUrl, { headers });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.status === 'complete' && data.video_url) {
                                console.log(`[SunoClient] Video generation complete: ${data.video_url}`);
                                return data.video_url;
                            }
                            console.log(`[SunoClient] Video generation status: ${data.status} (${((Date.now() - start) / 1000).toFixed(0)}s elapsed)`);
                        }
                    }
                    catch (e) {
                        // Ignore poll error
                    }
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            else {
                return videoUrl;
            }
        }
        catch (error) {
            console.error('[SunoClient] Error in getOrGenerateVideoUrl:', error);
        }
        // Fallback default CDN path if it still hasn't completed
        return `https://cdn1.suno.ai/${clipId}.mp4`;
    }
    static async getOrGenerateWavUrl(clipId, userId) {
        try {
            const cookie = await this.getEffectiveCookie(userId).catch(() => process.env.SUNO_COOKIE || '');
            if (!cookie)
                return '';
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
                const res = await fetch(statusUrl, { headers });
                if (res.ok) {
                    const data = await res.json();
                    const url = data.url || data.wav_url || data.wavFile || data.wav;
                    if (url) {
                        wavUrl = url;
                        isComplete = true;
                        console.log(`[SunoClient] WAV file already exists: ${wavUrl}`);
                    }
                }
            }
            catch (e) {
                console.error('[SunoClient] Error checking WAV status:', e);
            }
            // 2. Trigger WAV conversion if not ready
            if (!isComplete) {
                try {
                    console.log(`[SunoClient] Triggering WAV conversion for clip: ${clipId}`);
                    const triggerUrl = `https://studio-api-prod.suno.com/api/gen/${clipId}/convert_wav/`;
                    const triggerRes = await fetch(triggerUrl, {
                        method: 'POST',
                        headers: {
                            ...headers,
                            'Content-Length': '0',
                        },
                    });
                    if (triggerRes.status !== 204 && !triggerRes.ok) {
                        console.warn(`[SunoClient] Trigger WAV conversion failed: ${triggerRes.statusText}`);
                    }
                }
                catch (e) {
                    console.error('[SunoClient] Error triggering WAV conversion:', e);
                }
                // 3. Poll for status (max 30 seconds)
                const start = Date.now();
                while (Date.now() - start < 30000) {
                    try {
                        const res = await fetch(statusUrl, { headers });
                        if (res.ok) {
                            const data = await res.json();
                            const url = data.url || data.wav_url || data.wavFile || data.wav;
                            if (url) {
                                console.log(`[SunoClient] WAV conversion complete: ${url}`);
                                return url;
                            }
                            console.log(`[SunoClient] WAV conversion status: polling... (${((Date.now() - start) / 1000).toFixed(0)}s elapsed)`);
                        }
                    }
                    catch (e) {
                        // Ignore poll error
                    }
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            else {
                return wavUrl;
            }
        }
        catch (error) {
            console.error('[SunoClient] Error in getOrGenerateWavUrl:', error);
        }
        return '';
    }
}
exports.SunoClient = SunoClient;
