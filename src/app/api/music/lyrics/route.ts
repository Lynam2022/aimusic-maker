/**
 * ──────────────────────────────────────────────────────────────
 *  route.ts — Lyrics Generation API Handler
 *
 *  Đây là file điều phối chính. Logic đã được tách ra:
 *  ├── _templates.ts  ← static lyrics templates (fallback)
 *  ├── _genres.ts     ← genre profiles (structure, styleHint, vibe)
 *  ├── _prompts.ts    ← Gemini prompt per genre (rap/hiphop/ballad/generic)
 *  └── _utils.ts      ← sanitize / validate / format lyrics
 *
 *  Để sửa prompt từng thể loại → mở _prompts.ts
 *  Để sửa cấu trúc thể loại   → mở _genres.ts
 *  Để thêm template fallback   → mở _templates.ts
 * ──────────────────────────────────────────────────────────────
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkIpRateLimit } from '@/lib/security';

import { VIETNAMESE_LYRICS_TEMPLATES, ENGLISH_LYRICS_TEMPLATES, getTemplateByGenre } from './_templates';
import { resolveGenreProfile } from './_genres';
import { buildLyricsPrompt } from './_prompts';
import { sanitizeLyrics, isValidLyricsStructure, formatLyrics, sanitizeSongTitle } from './_utils';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function detectCountryByIp(ip: string): Promise<string> {
  const cleanIp = ip.split(',')[0].trim();
  if (
    !cleanIp ||
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.16.') ||
    cleanIp.startsWith('127.')
  ) {
    return 'VN';
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.countryCode) {
        return data.countryCode.toUpperCase();
      }
    }
  } catch (err) {
    console.error('[detectCountryByIp] Error checking IP location:', err);
  }
  return 'VN';
}

const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

async function callGeminiWithRetry(model: string, keys: string[], body: any, maxRetries?: number): Promise<Response> {
  const actualMaxRetries = maxRetries !== undefined ? maxRetries : Math.max(4, keys.length * 2);
  let attempt = 0;
  let currentModel = model;
  let keyIndex = Math.floor(Math.random() * keys.length);

  while (true) {
    if (keys.length === 0) {
      throw new Error('[Gemini API] No valid API keys available in the pool.');
    }
    const activeKey = keys[keyIndex];
    const maskedKey = activeKey ? `${activeKey.substring(0, 8)}...${activeKey.substring(activeKey.length - 4)}` : 'null';
    const currentUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${activeKey}`;

    try {
      const res = await fetch(currentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) return res;

      let errorText = '';
      try { errorText = await res.text(); } catch (_) { }
      console.error(`[Gemini API] Error from model ${currentModel} key ${maskedKey} (status ${res.status}):`, errorText);

      if (res.status === 400 && (errorText.includes('API_KEY_INVALID') || errorText.includes('API key not valid'))) {
        console.warn(`[Gemini API] Key ${maskedKey} invalid — pruned from pool.`);
        keys.splice(keyIndex, 1);
        if (keys.length === 0) { console.error('[Gemini API] No keys left.'); return res; }
        keyIndex = keyIndex % keys.length;
        continue;
      }

      // If 404 or 429 Quota Exceeded → immediately switch to next model in fallback chain
      if (res.status === 404 || res.status === 429) {
        const chainIndex = MODEL_FALLBACK_CHAIN.indexOf(currentModel);
        if (chainIndex !== -1 && chainIndex < MODEL_FALLBACK_CHAIN.length - 1) {
          const nextModel = MODEL_FALLBACK_CHAIN[chainIndex + 1];
          console.warn(`[Gemini API] Model ${currentModel} (status ${res.status}). Switching immediately to fallback model ${nextModel}...`);
          currentModel = nextModel;
          attempt = 0;
          continue;
        }
      }

      if (res.status === 503 || res.status >= 500) {
        attempt++;
        if (attempt <= actualMaxRetries) {
          keyIndex = (keyIndex + 1) % keys.length;
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.warn(`[Gemini API] Status ${res.status}. Retrying ${attempt}/${actualMaxRetries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      return res;
    } catch (err) {
      attempt++;
      if (attempt <= actualMaxRetries) {
        keyIndex = (keyIndex + 1) % keys.length;
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.warn(`[Gemini API] Fetch failed. Retrying ${attempt}/${actualMaxRetries} in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit ────────────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = await checkIpRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Tai khoan hoac IP cua ban tam thoi bi khoa truy cap do gui qua nhieu yeu cau. Vui long thu lai sau ${rateCheck.blockDuration} giay.` },
        { status: 429 }
      );
    }

    // ── Country / Language detection ──────────────────────────────────────
    const countryHeader = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country');
    let countryCode = countryHeader ? countryHeader.toUpperCase() : null;
    if (!countryCode) countryCode = await detectCountryByIp(ip);

    const body = await request.json();
    const { prompt, style: inputStyle, title: inputTitle, mood, weather, theme, vocalGender, lyricsGenre } = body;

    // VN IP or Vietnamese chars in text → Vietnamese lyrics
    const langQuery = [prompt, inputTitle, mood, theme].filter(Boolean).join(' ');
    const VN_CHARS = /[\u00c0-\u024f\u1e00-\u1ef9\u0300-\u036f]/;
    const isVnCountry = countryCode === 'VN';
    const hasVietnameseChars = VN_CHARS.test(langQuery);
    const isEnglishLyrics = !isVnCountry && !hasVietnameseChars;

    console.log(`[Lyrics] country=${countryCode}, isVN=${isVnCountry}, hasViChars=${hasVietnameseChars}, genre=${lyricsGenre}, isEnglish=${isEnglishLyrics}`);

    const query = [prompt, inputStyle, inputTitle, mood, weather, theme, lyricsGenre].filter(Boolean).join(' ').toLowerCase();

    const vocalHint = vocalGender === 'female' ? 'female vocal'
      : vocalGender === 'male' ? 'male vocal'
      : 'male or female vocal';

    // ── Load Gemini API Keys ──────────────────────────────────────────────
    const PLACEHOLDER_PATTERN = /^[•*x]+$/i;
    let apiKeys: string[] = [];

    try {
      const dbConfig = await prisma.systemConfig.findUnique({ where: { key: 'gemini_api_key' } });
      if (dbConfig?.value) {
        const dbKeys = dbConfig.value
          .split(/[\n,;]/)
          .map(k => k.trim())
          .filter(k => k && !PLACEHOLDER_PATTERN.test(k) && k.startsWith('AIza'));
        apiKeys.push(...dbKeys);
        console.log(`[Gemini API] Loaded ${dbKeys.length} key(s) from DB.`);
      }
    } catch (err) {
      console.error('[Gemini API] Failed to fetch API keys from DB:', err);
    }

    if (process.env.GEMINI_API_KEY) {
      const envKeys = process.env.GEMINI_API_KEY
        .split(/[\n,;]/)
        .map(k => k.trim())
        .filter(k => k && !PLACEHOLDER_PATTERN.test(k) && k.startsWith('AIza'));
      for (const k of envKeys) {
        if (!apiKeys.includes(k)) apiKeys.push(k);
      }
      console.log(`[Gemini API] Total keys after merging ENV: ${apiKeys.length}`);
    }

    if (apiKeys.length === 0) {
      console.warn('[Gemini API] No valid API keys found. Will use local template fallback.');
    }

    let generatedTitle = inputTitle || '';
    let generatedStyle = inputStyle || '';
    let generatedLyrics = '';

    // ── Gemini Generation ─────────────────────────────────────────────────
    if (apiKeys.length > 0) {
      const genreId = (lyricsGenre || '').toLowerCase();
      const selectedProfile = resolveGenreProfile(lyricsGenre, inputStyle);

      const isRapOrHiphop = genreId === 'rap' || genreId === 'hiphop' || genreId === 'hip-hop' || genreId.includes('trap') || genreId.includes('hip hop');

      const styleBase = inputStyle
        ? `${inputStyle}, ${vocalHint}`
        : `${selectedProfile.styleHint}, ${vocalHint}`;

      const languageInstruction = isEnglishLyrics
        ? 'Write ALL lyrics in ENGLISH. All section headers, chord names, and every lyric line must be in English.'
        : 'Viet TOAN BO loi bai hat bang TIENG VIET CO DAU CHUAN MUC (a, a, a, a, a, e, e, e, o, o, u, u...), co day du dau cau (dau phay, dau cham, dau ba cham...). TUYET DOI KHONG VIET KHONG DAU HOAC THIEU DAU.';

      const randomScenarios = isEnglishLyrics ? [
        'A bittersweet reunion after years apart, finding love again.',
        'Chasing dreams in a city that never sleeps, feeling lost but hopeful.',
        'A quiet coffee shop moment, two strangers becoming something more.',
        'Standing at a crossroads, choosing between comfort and adventure.',
        'Late night drives, windows down, singing to the radio.',
      ] : [
        'Mot chut gian doi vu vo khi di duoi mua roi tu trach voi vang, sau do hoa giai ngot ngao.',
        'Chiec o che chung chieu mua pho quen, doi ban tre rut re tho lo tinh cam.',
        'Cuoc hen tai quan ca phe goc pho, ngoi lai trai long sau nhung hieu nham nho.',
        'Chuyen di da ngoai cung nhau, ngam hoang hon va mim cuoi tran trong tinh yeu.',
        'Khoanh khac lang nghe nhip dap con tim, tu nhin lai ban than va tran trong doi phuong.',
      ];
      const randomIdea = randomScenarios[Math.floor(Math.random() * randomScenarios.length)];

      // Build prompt dựa theo thể loại (xem _prompts.ts)
      const systemPrompt = buildLyricsPrompt({
        genreId,
        selectedProfile,
        prompt,
        inputStyle,
        vocalHint,
        styleBase,
        isEnglishLyrics,
        languageInstruction,
        randomIdea,
        mood,
        theme,
      });

      const geminiBody = {
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 1.0,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      };

      try {
        const geminiRes = await callGeminiWithRetry('gemini-2.5-flash', apiKeys, geminiBody);
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const finishReason: string = geminiData?.candidates?.[0]?.finishReason || '';
          console.log('[Gemini API] Raw response length:', rawText.length, '| finishReason:', finishReason);

          if (rawText && rawText.length > 50) {
            // Parse TITLE:
            const titleMatch = rawText.match(/^TITLE:\s*(.+)/m);
            if (titleMatch?.[1]?.trim()) {
              generatedTitle = sanitizeSongTitle(titleMatch[1].trim(), isEnglishLyrics);
            }

            // Parse STYLE:
            const styleMatch = rawText.match(/^STYLE:\s*(.+)/m);
            if (styleMatch?.[1]?.trim()) {
              generatedStyle = styleMatch[1].trim().replace(/^["']|["']$/g, '');
              // Dedup for rap/hiphop
              if (isRapOrHiphop) {
                const parts = generatedStyle.split(',').map((s: string) => s.trim()).filter(Boolean);
                const seen = new Set<string>();
                const deduped: string[] = [];
                for (const p of parts) {
                  const key = p.toLowerCase().replace(/\s+/g, '');
                  if (!seen.has(key)) { seen.add(key); deduped.push(p); }
                }
                generatedStyle = deduped.join(', ');
              }
            }

            // Parse LYRICS:
            const lyricsMatch = rawText.match(/^LYRICS:\s*\r?\n([\s\S]+)/m);
            if (lyricsMatch?.[1]?.trim()) {
              generatedLyrics = sanitizeLyrics(lyricsMatch[1].trim());
            } else {
              // Fallback: detect first section header
              const sectionMatch = rawText.match(/(\[(?:Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Hook|Drop|Build|Breakdown|Rap|Flow|Solo|Section|Rising|Climax|Resolution|Coda|Theme|Lời|Điệp)[^\]]*\][\s\S]+)/i);
              if (sectionMatch?.[1]) {
                generatedLyrics = sanitizeLyrics(sectionMatch[1].trim());
              }
            }

            if (!generatedLyrics && rawText.length > 100) {
              generatedLyrics = sanitizeLyrics(rawText);
            }

            // Validate — nếu lyrics bị cắt/malformed → fallback to template
            if (generatedLyrics && !isValidLyricsStructure(generatedLyrics)) {
              console.warn('[Gemini API] Lyrics failed structure validation (finishReason=' + finishReason + '). Falling back to template.');
              generatedLyrics = '';
            }
          }
        }
      } catch (geminiErr) {
        console.error('Gemini lyrics generation failed, falling back to local template:', geminiErr);
      }
    }

    // ── Template Fallback ─────────────────────────────────────────────────
    if (!generatedLyrics) {
      const matchedTemplate = getTemplateByGenre(lyricsGenre, query, isEnglishLyrics);

      generatedLyrics = matchedTemplate.lyrics;
      generatedTitle = inputTitle || matchedTemplate.title;
      generatedStyle = inputStyle || matchedTemplate.style;

      if (prompt && prompt.trim().length > 3) {
        const words = prompt.trim().split(' ');
        if (words.length <= 4) generatedTitle = prompt.trim();
      }
    }

    const bpms = ['72 BPM', '76 BPM', '80 BPM', '84 BPM', '88 BPM', '92 BPM', '96 BPM'];
    const instruments = [
      'warm acoustic piano, uplifting strings',
      'cheerful acoustic guitar, gentle piano melody',
      'soft electric piano, subtle synth pads',
      'melodic grand piano, cello ensemble',
      'fingerpicked acoustic guitar, smooth bassline',
      'sparkling piano keys, warm ambient pads',
      'acoustic guitar strumming, lush violins'
    ];
    const moods = [
      'romantic sweet storytelling',
      'heartwarming nostalgic memories',
      'peaceful rainy day vibe',
      'cheerful sunrise warmth',
      'intimate late-night confession',
      'uplifting emotional journey',
      'tender romantic feeling'
    ];
    const vocals = [
      'sweet female vocal',
      'warm expressive male vocal',
      'intimate romantic voice',
      'gentle emotional vocal',
      'bright expressive singing'
    ];
    const vocalEffects = [
      'Rubato verse, rapid light melisma, fast legato pre-chorus, driving chorus, vocal sigh, pause, preserve lyrics, clean endings',
      'Rubato verse, smooth melisma, fast legato, driving beat, vocal sigh, preserve lyrics, clean endings',
      'Rubato verse, rapid light melisma, pause, driving chorus, preserve lyrics, clean endings',
      'Rubato verse, smooth melisma, fast legato pre-chorus, vocal sigh, preserve lyrics, clean endings'
    ];
    const productions = [
      'full length 3-4 minutes, studio master quality',
      'full length 3-4 minutes, crystal clear production',
      'full length 3-4 minutes, polished sound'
    ];

    const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const selectedVocal = vocalHint && vocalHint !== 'male or female vocal' ? vocalHint : pickRandom(vocals);
    const selectedBpm = pickRandom(bpms);
    const selectedInst = pickRandom(instruments);
    const selectedEffect = pickRandom(vocalEffects);

    let rawStyle = generatedStyle;
    if (!rawStyle || rawStyle === 'bright modern pop ballad') {
      rawStyle = `bright modern pop ballad, ${selectedBpm}, ${selectedVocal}, ${selectedInst}, ${selectedEffect}`;
    }

    // Clean and deduplicate tags (remove duplicate BPMs, duplicate tags, and crisp cutoff)
    const rawTags = rawStyle.split(',').map((t: string) => t.trim()).filter(Boolean);
    const cleanedTags: string[] = [];
    let hasBpm = false;

    for (const tag of rawTags) {
      if (tag.toLowerCase() === 'crisp cutoff') continue;
      if (/^\d+\s*BPM$/i.test(tag)) {
        if (hasBpm) continue;
        hasBpm = true;
      }
      if (!cleanedTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
        cleanedTags.push(tag);
      }
    }

    if (!hasBpm) {
      cleanedTags.splice(1, 0, selectedBpm);
    }
    if (!cleanedTags.some(t => t.toLowerCase().includes('rubato'))) {
      cleanedTags.push('Rubato');
    }

    generatedStyle = cleanedTags.join(', ');

    const generatedDescribePrompt = body.mode === 'describe'
      ? `${generatedStyle}, ${pickRandom(moods)}, ${pickRandom(productions)}`
      : (generatedStyle || generatedTitle || '');

    return NextResponse.json({
      success: true,
      prompt: generatedDescribePrompt,
      title: sanitizeSongTitle(generatedTitle, isEnglishLyrics),
      style: generatedStyle,
      lyrics: formatLyrics(generatedLyrics),
    });

  } catch (error: unknown) {
    console.error('POST /api/music/lyrics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Khong the tao loi bai hat luc nay. Vui long thu lai.' },
      { status: 500 }
    );
  }
}
