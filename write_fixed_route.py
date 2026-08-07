# -*- coding: utf-8 -*-
"""Script to rewrite the lyrics route.ts file fixing all bugs."""

CONTENT = r"""export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkIpRateLimit } from '@/lib/security';

// Bộ sinh lời bài hát thông minh hỗ trợ Tiếng Việt & Tiếng Anh theo phong cách nhạc
const VIETNAMESE_LYRICS_TEMPLATES = [
  {
    genres: ['pop', 'ballad', 'lofi', 'acoustic'],
    title: 'Góc Phố Và Nỗi Nhớ',
    style: 'Pop Ballad hiện đại, trữ tình nhẹ nhàng',
    lyrics: `[Rubato]
[Verse 1]
[C] Thật ra chiều nay cơn mưa ghé qua góc phố quen
[Am] Màn hình điện thoại hiện lên dòng tin nhắn cũ chưa bấm gửi
[F] Người qua đường vội vã che chiếc ô nghiêng
[G] Còn anh lặng nhìn ly cà phê đã nguội từ bao giờ.

[Pre-Chorus]
[F] Nhiều khi tự hỏi lòng mình đã quên hay chưa
[G] Kỷ niệm ngày ấy như bàn tay ai khẽ nắm giữa chiều mưa
[Em] Hóa ra nỗi nhớ vẫn nằm yên ở đấy
[Am] Chỉ là tự giấu đi giữa bộn bề âu lo.
[voice crack]

[Chorus 1]
[F] Nỗi nhớ như mưa rơi giữa đêm dài mênh mông [Vibrato]
[G] Để trái tim anh giật mình gọi tên em trong lặng im [Vibrato]
[Em] Nỗi nhớ kéo anh về những ngày ta chung lối [Vibrato]
[Am] Dẫu biết giờ đây hai chúng ta đã xa rồi [Vibrato].

[Verse 2]
[C] Tự nhiên đêm nay gió lùa qua căn phòng vắng
[Am] Góc bàn làm việc còn nguyên cuốn sách em lật dở
[F] Cánh hoa khô nằm ngoan giữa từng trang giấy
[G] Nhắc anh nhớ về một nụ cười ngập ngừng thuở ấy.

[Pre-Chorus]
[F] Nhiều khi tự hỏi lòng mình đã quên hay chưa
[G] Kỷ niệm ngày ấy như bàn tay ai khẽ nắm giữa chiều mưa
[Em] Hóa ra nỗi nhớ vẫn nằm yên ở đấy
[Am] Chỉ là tự giấu đi giữa bộn bề âu lo.
[voice crack]

[Chorus 2]
[F] Nỗi nhớ như mưa rơi giữa đêm dài mênh mông [Vibrato]
[G] Để trái tim anh giật mình gọi tên em trong lặng im [Vibrato]
[Em] Nỗi nhớ kéo anh về những ngày ta chung lối [Vibrato]
[Am] Dẫu biết giờ đây hai chúng ta đã xa rồi [Vibrato].

[OUTRO]
[F] Thật ra anh vẫn nhớ... [Vibrato]
[G] Giữa góc phố quen thuở nào...
[Am] Nỗi nhớ nhẹ nhàng tan vào đêm.`
  },
  {
    genres: ['rock', 'edm', 'dance', 'upbeat', 'pop rock'],
    title: 'Khát Vọng Bay Xa',
    style: 'Modern Rock sôi động, tràn đầy năng lượng',
    lyrics: `[Verse 1]
[Am] Bước trên con đường dài đầy những chông gai
[F] Tôi không hề run sợ trước những khó khăn ngày mai
[C] Ánh bình minh đang lên chiếu sáng muôn nơi
[G] Đánh thức con tim khát khao chạm tới chân trời.

[Pre-Chorus]
[F] Dẫu đôi chân mệt nhoài dẫu có đớn đau
[G] Niềm tin trong ta luôn rực cháy một màu
[Em] Hãy đập tan màn đêm bước qua nỗi sầu
[Am] Chặng đường vinh quang đang chờ đón phía sau.

[Chorus 1]
[F] Bay lên đi hỡi những cánh chim không mỏi
[G] Vượt qua bão giông chạm tới những vì sao sáng ngời
[Em] Hãy sống hết mình với đam mê rực cháy
[Am] Khát vọng bay xa tự do giữa cuộc đời này!

[Verse 2]
[Am] Từng bước chân đi qua những thăng trầm cuộc đời
[F] Giữ vững nụ cười nở trên môi người ơi
[C] Ngày mới đang lên với bao nhiêu niềm vui
[G] Xua tan đi bao nhiêu u tối ngậm ngùi.

[Pre-Chorus]
[F] Dẫu đôi chân mệt nhoài dẫu có đớn đau
[G] Niềm tin trong ta luôn rực cháy một màu
[Em] Hãy đập tan màn đêm bước qua nỗi sầu
[Am] Chặng đường vinh quang đang chờ đón phía sau.

[Chorus 2]
[F] Bay lên đi hỡi những cánh chim không mỏi
[G] Vượt qua bão giông chạm tới những vì sao sáng ngời
[Em] Hãy sống hết mình với đam mê rực cháy
[Am] Khát vọng bay xa tự do giữa cuộc đời này!

[BRIDGE (BUILD-UP)]
[Dm] Hãy giữ vững lòng tin vượt qua mọi bão giông
[Em] Để ngọn lửa nhiệt huyết mãi cháy trong lòng
[F] Đường tương lai rộng mở chào đón chúng ta
[G] Bay cao bay xa cùng những giấc mơ hồng.

[OUTRO]
[F] Khát vọng bay xa...
[G] Tự do giữa cuộc đời này...
[Am] Mãi mãi rực cháy.`
  },
  {
    genres: ['rap', 'hiphop', 'r&b'],
    title: 'Góc Phố Lên Đèn',
    style: 'Chill Rap, Hip-hop đường phố',
    lyrics: `[Verse 1]
[Am] Góc phố lên đèn cũng là lúc màn đêm buông
[F] Nhìn dòng người hối hả xuôi ngược những nỗi buồn
[C] Tao viết lên những vần thơ về cuộc đời đầy sương gió
[G] Nơi những giấc mơ vẫn đang ấp ủ từ thuở nhỏ

[Pre-Chorus]
[Dm] Có những đêm trắng dài suy nghĩ về ngày mai
[Em] Liệu con đường đang đi là đúng hay là sai
[F] Nhưng ta vẫn tin vào một ngày tương lai
[G] Ánh mặt trời sẽ chiếu rọi chuỗi ngày dài.

[Chorus 1]
[Am] Khi ánh đèn đường vụt sáng lung linh
[F] Ta nhìn thấy rõ bóng dáng của chính mình
[C] Trải qua bao thăng trầm vẫn giữ vững niềm tin
[G] Tìm lại tự do trong những thước phim.

[Verse 2]
[Am] Họ nói tao mơ mộng nói tao kẻ khờ khạo
[F] Nhưng âm nhạc cứu rỗi tâm hồn đầy hư hao
[C] Mỗi lời rap viết ra là một phần xương máu
[G] Không cần sự giả tạo không cần phải che giấu

[Pre-Chorus]
[Dm] Có những đêm trắng dài suy nghĩ về ngày mai
[Em] Liệu con đường đang đi là đúng hay là sai
[F] Nhưng ta vẫn tin vào một ngày tương lai
[G] Ánh mặt trời sẽ chiếu rọi chuỗi ngày dài.

[Chorus 2]
[Am] Khi ánh đèn đường vụt sáng lung linh
[F] Ta nhìn thấy rõ bóng dáng của chính mình
[C] Trải qua bao thăng trầm vẫn giữ vững niềm tin
[G] Tìm lại tự do trong những thước phim.

[BRIDGE (BUILD-UP)]
[Dm] Những lúc mỏi mệt muốn buông xuôi tất cả
[Em] Hãy nhớ lý do vì sao ta bắt đầu đi qua
[F] Dù thế giới ngoài kia có bao la gian trá
[G] Thì ta vẫn vững bước trên con đường của chúng ta.

[OUTRO]
[Am] Tìm lại tự do...
[F] Trong những thước phim...
[C] Của cuộc đời mình.`
  }
];

const ENGLISH_LYRICS_TEMPLATES = [
  {
    genres: ['pop', 'ballad', 'lofi', 'acoustic'],
    title: 'Neon Whispers',
    style: 'Aesthetic Lofi Pop with soothing vocals',
    lyrics: `[Verse 1]
[Am] Walking down the empty street at midnight
[F] Watching shadows play under the streetlights
[C] Raindrops falling slowly on my window pane
[G] Listening to the rhythm of the gentle rain.

[Pre-Chorus]
[Dm] I can still recall the warmth of your embrace
[Em] Every sweet memory time cannot erase
[F] Now I'm standing here all by myself again
[G] Trying to forget the love that had to end.

[Chorus 1]
[Am] Oh neon whispers in the quiet dark
[F] Tell me where did we lose that glowing spark?
[C] We were young and free running through the night
[G] Now we're just two stars fading out of sight.

[Verse 2]
[Am] The clock is ticking but the time stands still
[F] Looking at the empty coffee cup I fill
[C] Wondering if you ever think of me at all
[G] Or if I'm just a shadow written on the wall.

[Pre-Chorus]
[Dm] I can still recall the warmth of your embrace
[Em] Every sweet memory time cannot erase
[F] Now I'm standing here all by myself again
[G] Trying to forget the love that had to end.

[Chorus 2]
[Am] Oh neon whispers in the quiet dark
[F] Tell me where did we lose that glowing spark?
[C] We were young and free running through the night
[G] Now we're just two stars fading out of sight.

[BRIDGE (BUILD-UP)]
[Dm] Through the shadows and the endless night
[Em] I will keep searching for your guiding light
[F] Even if the stars begin to fade away
[G] I'll hold on to the hope of a brand new day.

[OUTRO]
[F] Neon whispers in the dark...
[G] Fading out of sight...
[Am] Fading out.`
  },
  {
    genres: ['rock', 'edm', 'dance', 'upbeat'],
    title: 'Electric Energy',
    style: 'High-energy Electronic Dance Pop',
    lyrics: `[Verse 1]
[Am] Feel the bass line pumping deep inside your veins
[F] Time to break the limits and forget the pain
[C] Turn the music up and let the speakers blow
[G] We are ready now to start the magic show.

[Pre-Chorus]
[Dm] Light up the dancefloor let the colors collide
[Em] No more fear or doubt we have nothing to hide
[F] Raise your hands up high and reach for the sky
[G] Tonight we are gonna fly!

[Chorus]
[Am] Electric energy burning through the night
[F] We are the fire, we are the light
[C] Feel the rhythm take control of your soul
[G] Together we are whole!

[Outro]
[F] Electric energy...
[G] Reach for the sky...
[Am] Tonight we fly.`
  }
];

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
  'gemini-3.1-flash-lite'
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
        body: JSON.stringify(body)
      });

      if (res.ok) {
        return res;
      }

      let errorText = '';
      try { errorText = await res.text(); } catch (_) { }
      console.error(`[Gemini API] Error response from model ${currentModel} using key ${maskedKey} (status ${res.status}):`, errorText);

      if (res.status === 400 && (errorText.includes('API_KEY_INVALID') || errorText.includes('API key not valid'))) {
        console.warn(`[Gemini API] Key ${maskedKey} is invalid and will be pruned from the active pool.`);
        keys.splice(keyIndex, 1);
        if (keys.length === 0) {
          console.error('[Gemini API] No keys left in pool after pruning.');
          return res;
        }
        keyIndex = keyIndex % keys.length;
        continue;
      }

      if (res.status === 404) {
        const chainIndex = MODEL_FALLBACK_CHAIN.indexOf(currentModel);
        if (chainIndex !== -1 && chainIndex < MODEL_FALLBACK_CHAIN.length - 1) {
          const nextModel = MODEL_FALLBACK_CHAIN[chainIndex + 1];
          console.warn(`[Gemini API] Model ${currentModel} returned 404. Falling back to ${nextModel}...`);
          currentModel = nextModel;
          attempt = 0;
          continue;
        }
      }

      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        attempt++;
        if (attempt <= actualMaxRetries) {
          keyIndex = (keyIndex + 1) % keys.length;
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.warn(`[Gemini API] Failed with status ${res.status}. Rotated key to next in pool and retrying attempt ${attempt}/${actualMaxRetries} in ${delay}ms...`);
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
        console.warn(`[Gemini API] Network error. Rotated key and retrying attempt ${attempt}/${actualMaxRetries} in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimitResult = await checkIpRateLimit(ip, 'lyrics', 10, 60);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Bạn đang tạo lời bài hát quá nhiều. Vui lòng chờ một chút.' },
        { status: 429 }
      );
    }

    const countryCode = await detectCountryByIp(ip);

    const body = await request.json();
    const { prompt, style: inputStyle, title: inputTitle, mood, weather, theme, mode, structure, vocalGender, lyricsGenre } = body;

    let geminiKeys: string[] = [];
    if (process.env.GEMINI_API_KEY) {
      geminiKeys = process.env.GEMINI_API_KEY.split(/[\s,;]+/).filter(Boolean);
    }
    try {
      const dbConfig = await prisma.systemConfig.findFirst({
        where: { key: 'gemini_api_key' }
      });
      if (dbConfig && dbConfig.value) {
        geminiKeys = dbConfig.value.split(/[\s,;]+/).filter(Boolean);
      }
    } catch (dbErr) {
      console.error('[Lyrics API] Failed to fetch gemini_api_key from DB:', dbErr);
    }
    if (geminiKeys.length === 0) {
      throw new Error('Hệ thống chưa cấu hình GEMINI_API_KEY. Vui lòng truy cập trang Quản trị để thiết lập.');
    }

    if (mode === 'describe') {
      try {
        const systemPrompt = `Bạn là một chuyên gia âm nhạc và chuyên gia thiết kế câu lệnh AI (Prompt Engineer) xuất sắc. Hãy viết một đoạn mô tả âm nhạc ngắn gọn, chi tiết và đầy cảm xúc (tối đa 100 từ) để người dùng gửi đến Suno để sinh nhạc.
Yêu cầu về ngôn ngữ và nhạc cụ:
- Ngôn ngữ viết đoạn mô tả: Dựa vào vị trí người dùng truy cập có mã quốc gia là ${countryCode}. Hãy viết đoạn mô tả âm nhạc bằng ngôn ngữ phổ biến của mã quốc gia này (Ví dụ VN: Tiếng Việt, US/GB/CA: Tiếng Anh, JP: Tiếng Nhật, KR: Tiếng Hàn, CN: Tiếng Trung, FR: Tiếng Pháp, ES: Tiếng Tây Ban Nha, v.v.). Nếu là mã quốc gia không phổ biến hoặc không xác định được ngôn ngữ, hãy viết bằng Tiếng Anh.
- Quy tắc tên nhạc cụ: Tên của toàn bộ nhạc cụ xuất hiện trong đoạn mô tả BẮT BUỘC PHẢI VIẾT BẰNG TIẾNG ANH (English), tuyệt đối không dịch tên nhạc cụ sang ngôn ngữ bản địa.

Yêu cầu cụ thể từ người dùng:
- Từ khóa/Gợi ý chủ đề: ${prompt || 'Nhạc ngẫu nhiên'}
- Trạng thái tâm trạng: ${mood || 'Tự nhiên'}
- Thời tiết: ${weather || 'Tự nhiên'}
- Chủ đề: ${theme || 'Tự nhiên'}
${vocalGender && vocalGender !== 'auto' ? `- Giọng ca sĩ (Vocal Gender): Bắt buộc phải là giọng ${vocalGender === 'male' ? 'Nam (male vocals)' : 'Nữ (female vocals)'}. Hãy thể hiện giọng hát ca sĩ này trong phần mô tả bằng từ tiếng Anh tương ứng.` : ''}

Trả về dữ liệu JSON có cấu trúc sau:
{
  "prompt": "Đoạn mô tả âm nhạc chi tiết tuân thủ quy tắc ngôn ngữ quốc gia ${countryCode} và tên nhạc cụ bằng tiếng Anh."
}`;

        const geminiResponse = await callGeminiWithRetry('gemini-2.5-flash', geminiKeys, {
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { prompt: { type: 'STRING' } },
              required: ['prompt']
            }
          }
        });

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            return NextResponse.json({ success: true, prompt: parsed.prompt });
          }
        }
      } catch (geminiErr) {
        console.error('Gemini API Describe prompt generation failed, falling back:', geminiErr);
      }

      // Fallback
      let promptText = `A premium quality track`;
      if (mood) promptText += `, with a ${mood.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()} vibe`;
      if (weather) promptText += `, evocative of a ${weather.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()} setting`;
      if (theme) promptText += `, capturing the theme of ${theme.toLowerCase()}`;
      if (prompt) promptText += `, inspired by: "${prompt}"`;
      promptText += `. Features professional production, beautiful instrumentation, and rich dynamics.`;

      return NextResponse.json({ success: true, prompt: promptText });
    }

    const query = (prompt || inputStyle || inputTitle || '').toLowerCase();

    // Call Gemini API to generate lyrics dynamically
    try {
      let structureInstruction = '';
      if (structure === 'pop_ballad') {
        structureInstruction = `
- Cấu trúc bài hát BẮT BUỘC theo công thức Pop Ballad hiện đại / V-Pop Ballad Trữ Tình:
  [Rubato] (Thẻ mở đầu ca sĩ hát tự do, ngắt nhịp nén chữ ngẫu hứng như thơ ca)
  [Verse 1] (Khởi đầu lời tự sự bối cảnh nhẹ nhàng, ngắt dòng chuẩn)
  [Pre-Chorus] (Đẩy nhịp cảm xúc dồn dập)
  [voice crack] (Đặt riêng 1 dòng ở cuối Pre-Chorus ép nốt vỡ giọng nghẹn ngào, xúc động mạnh)
  [Chorus] (Cao trào điệp khúc bắt tai với Hook lặp lại, kết bằng [Vibrato] ngân thanh Bằng)
  [Verse 2] (Phát triển góc nhìn / dòng tâm sự mới)
  [Pre-Chorus] (Dồn dập nhịp điệu)
  [voice crack] (Đặt riêng 1 dòng ở cuối Pre-Chorus ép nốt vỡ giọng nhẹ)
  [Chorus] (Điệp khúc bùng nổ, kết bằng [Vibrato] ngân thanh Bằng)
  [Outro] (Hạ nhiệt kết thúc tự sự).
- CẤM VIẾT LỜI HÁT TRONG THẺ [Intro]: Nếu có thẻ [Intro], thẻ [Intro] BẮT BUỘC phải là dạo nhạc không lời "[Intro] (Instrumental intro)". Tuyệt đối KHÔNG viết câu hát nào dưới [Intro]. Câu hát đầu tiên bắt đầu từ [Verse 1].
- HIỂN THỊ ĐÚNG CẤU TRÚC & XUỐNG DÒNG CHUẨN: Mỗi câu hát BẮT BUỘC trên 1 dòng riêng biệt. TUYỆT ĐỐI KHÔNG viết gộp nhiều câu hát trên cùng một dòng. Giữa các đoạn có 1 dòng trống phân cách.
`;
      } else if (structure === 'dance_edm') {
        structureInstruction = `
- Cấu trúc bài hát BẮT BUỘC theo công thức nhạc Dance / EDM / Pop Dance:
  [Rubato] -> [Verse 1] -> [Pre-Chorus] -> [voice crack] -> [Chorus] (Hook ngắn bắt tai) -> [Drop] -> [Verse 2] -> [Pre-Chorus] -> [voice crack] -> [Chorus] -> [Drop] -> [Outro].
- CẤM VIẾT LỜI HÁT TRONG THẺ [Intro]: Thẻ [Intro] phải là dạo nhạc không lời.
- HIỂN THỊ ĐÚNG CẤU TRÚC & XUỐNG DÒNG CHUẨN: Mỗi câu hát trên 1 dòng riêng biệt.
`;
      } else {
        structureInstruction = `
- Cấu trúc bài hát Tự do sáng tạo (Ballad Hiện Đại):
  [Rubato] -> [Verse 1] -> [Pre-Chorus] -> [voice crack] -> [Chorus] -> [Verse 2] -> [Pre-Chorus] -> [voice crack] -> [Chorus] -> [Outro].
- CẤM VIẾT LỜI HÁT TRONG THẺ [Intro]: Thẻ [Intro] phải là dạo nhạc không lời.
- HIỂN THỊ ĐÚNG CẤU TRÚC & XUỐNG DÒNG CHUẨN: Mỗi câu hát BẮT BUỘC nằm trên 1 dòng riêng biệt.
`;
      }

      let genreStyleInstruction = '';
      if (lyricsGenre === 'co_phong') {
        genreStyleInstruction = `
- PHONG CÁCH CỔ PHONG TRẦM MẶC (GUZHENG / PIPA / TRADITIONAL BALLAD):
  * Ngôn ngữ Hán Việt trữ tình, thanh tao mộng ảo, dùng các hình ảnh cổ điển thơ mộng (trà hoa, chén rượu, ánh nguyệt, cố nhân, sương khói, thuyền hoa, lá thu rơi, tiếng sáo chiều, lời hẹn ước trăm năm, phong sương, cố hương).
  * Giữ trọn vần điệu u uất lãng mạn, nhịp điệu thơ ca cổ truyền cảm nhưng không rườm rà.
`;
      } else if (lyricsGenre === 'ballad') {
        genreStyleInstruction = `
- PHONG CÁCH V-POP BALLAD TRỮ TÌNH (MODERN POP BALLAD):
  * Lời tự sự sâu lắng như dòng nhật ký, gần gũi như trò chuyện, hình ảnh góc phố quen, cơn mưa chiều, dòng tin nhắn ngập ngừng chưa gửi, nỗi nhớ dịu dàng tha thiết.
`;
      } else if (lyricsGenre === 'lofi') {
        genreStyleInstruction = `
- PHONG CÁCH LOFI CHILL & ACOUSTIC (CHILL LOFI POP):
  * Ngôn ngữ mộc mạc, nhẹ nhàng, bình yên, hình ảnh ly cà phê ấm, góc phòng nhỏ, mưa rơi bên hiên, mây trôi thong dong, nhịp điệu du dương êm ả.
`;
      } else if (lyricsGenre === 'rnb') {
        genreStyleInstruction = `
- PHONG CÁCH R&B & SOUL (R&B SOUL):
  * Lời bài hát phiêu du, mượt mà, quyến rũ, câu chữ ngắt nhịp mềm mại giúp ca sĩ luyến láy vocal runs, lướt qua cảm xúc nồng nàn dịu ngọt.
`;
      } else if (lyricsGenre === 'dance_edm') {
        genreStyleInstruction = `
- PHONG CÁCH POP DANCE / EDM / VINAHOUSE:
  * Nhịp điệu sôi động, bắt tai, dồn dập, gieo vần nảy căng, cụm Hook lặp lại bùng nổ năng lượng cuốn hút.
`;
      } else if (lyricsGenre === 'rap') {
        genreStyleInstruction = `
- PHONG CÁCH CHILL RAP & HIP-HOP TỰ SỰ:
  * Gieo vần đôi, vần ba tự nhiên, ngôn từ chân thật trải lòng về cuộc sống, góc nhìn phố thị suy tư và trải nghiệm cá nhân.
`;
      } else if (lyricsGenre === 'rock') {
        genreStyleInstruction = `
- PHONG CÁCH POP ROCK & METAL NĂNG LƯỢNG:
  * Lời ca rực cháy khát vọng, tinh thần tự do, vượt qua bão giông thử thách, giàu năng lượng truyền cảm hứng.
`;
      } else if (lyricsGenre === 'indie') {
        genreStyleInstruction = `
- PHONG CÁCH INDIE POP THƠ MỘNG:
  * Ngôn từ phá cách, thơ mộng, hình ảnh giàu chiều sâu triết lý cá tính, góc nhìn độc đáo tươi mới.
`;
      }

      const systemPrompt = `Bạn là một nhà biên kịch, nhạc sĩ kiêm chuyên gia ngôn ngữ học và sáng tác lời bài hát Ballad Trữ Tình Trẻ Trung (Modern V-Pop Ballad) hàng đầu. Hãy sáng tác lời bài hát và tiêu đề dựa trên gợi ý của người dùng theo phong cách nhạc cô đọng, giàu hình ảnh như thơ ca cho tình yêu và cảm xúc.

BẮT BUỘC THỰC HIỆN CÁC PHÂN TÍCH VÀ TUÂN THỦ NGUYÊN TẮC SAU:

${structureInstruction}
${genreStyleInstruction}

## PHẦN X: XỬ LÝ TỪ NGỮ TỰ NHIÊN NHƯ LỜI KỂ & VẦN ĐIỆU THƠ CA

1. TÍNH TỰ NHIÊN NHƯ LỜI KỂ:
   - Ngôn ngữ viết như lời tự sự, trò chuyện hoặc dòng tâm sự viết trong nhật ký/tin nhắn.
   - Kỹ thuật "Show, Don't Tell": Không diễn tả cảm xúc trực tiếp.

2. BẢO ĐẢM VẦN ĐIỆU THƠ CA TỰ NHIÊN:
   - ƯU TIÊN VẦN THÔNG / VẦN GẦN ĐÚNG (Near/Slant Rhymes).
   - TUYỆT ĐỐI CẤM "VẦN ÉP" (Forced Rhymes).

3. NHỊP ĐIỆU CÂU HÁT:
   - Độ dài các câu linh hoạt đan xen.
   - Tránh câu từ quá dài rườm rà.

## PHẦN Y: QUY TẮC GIỌNG HÁT & THẺ ĐIỀU KHIỂN ĐẶC BIỆT

1. CÁC THẺ ĐIỀU KHIỂN ÂM THANH:
   - [Rubato]: Đặt ở mở đầu bài hát (TRÊN MỘT DÒNG ĐỘC LẬP). TUYỆT ĐỐI KHÔNG dán câu hát liền đằng sau.
   - [voice crack]: Đặt ở cuối Pre-Chorus (TRÊN MỘT DÒNG ĐỘC LẬP). TUYỆT ĐỐI KHÔNG dán câu hát liền đằng sau.
   - [Vibrato]: Thẻ rung giọng đặt ở cuối Chorus hoặc sau từ ngắt nhịp.

2. CẤU TRÚC BÀI HÁT:
   [Rubato] -> [Verse 1] -> [Pre-Chorus] -> [voice crack] -> [Chorus] -> [Verse 2] -> [Pre-Chorus] -> [voice crack] -> [Chorus] -> [Outro]

3. PHÂN ĐOẠN & XUỐNG DÒNG:
   - BẮT BUỘC MỖI CÂU HÁT NẰM TRÊN MỘT DÒNG RIÊNG BIỆT.
   - Giữa các phân đoạn có 1 dòng trống phân cách.

4. LOẠI BỎ TỪ NGỮ AI RẬP KHUÔN:
   - CẤM các từ: "đắm chìm", "khắc khoải", "nồng nàn", "thiết tha", "mặn nồng", "xao xuyến", "ngây ngất".

5. TIÊU ĐỀ ("title"): Đặt tiêu đề tối đa 5 từ, tự nhiên, thơ mộng.

${vocalGender && vocalGender !== 'auto' ? `6. Quy định về đại từ xưng hô (Vocal Gender = ${vocalGender}):
   - ${vocalGender === 'male' ? 'Giọng Nam: Xưng "anh", gọi "em".' : 'Giọng Nữ: Xưng "em", gọi "anh".'}
` : ''}

Yêu cầu cụ thể từ người dùng:
- Thể loại Lời sáng tác (Lyrics Genre): ${lyricsGenre || 'auto'}
- Gợi ý chủ đề: ${prompt || 'Nhạc Ballad tình yêu lãng mạn và nỗi nhớ'}
- Phong cách nhạc: ${inputStyle || 'Pop Ballad hiện đại'}
- Tiêu đề đề xuất (nếu có): ${inputTitle || ''}
- Trạng thái tâm trạng: ${mood || 'Tự sự / Thơ mộng / Lãng mạn'}
- Thời tiết: ${weather || 'Mưa nhẹ / Chiều thu'}
- Chủ đề: ${theme || 'Tình yêu lãng mạn và nỗi nhớ thanh xuân'}`;

      const geminiResponse = await callGeminiWithRetry('gemini-2.5-flash', geminiKeys, {
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              lyrics: { type: 'STRING' },
              imagery_analysis: { type: 'STRING' },
              rhyme_analysis: { type: 'STRING' },
              musicality_analysis: { type: 'STRING' },
              artistic_analysis: { type: 'STRING' }
            },
            required: ['title', 'lyrics', 'imagery_analysis', 'rhyme_analysis', 'musicality_analysis', 'artistic_analysis']
          }
        }
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return NextResponse.json({
            success: true,
            title: parsed.title,
            style: inputStyle || 'Pop Ballad nhẹ nhàng, sâu lắng',
            lyrics: formatLyrics(parsed.lyrics)
          });
        }
      } else {
        console.error('Gemini API returned error status:', geminiResponse.status);
      }
    } catch (geminiErr) {
      console.error('Gemini API Lyrics generation failed, falling back to local template matching:', geminiErr);
    }

    // --- FALLBACK: ENGINE VIẾT LỜI THÔNG MINH ---
    const isEnglish = /[a-zA-Z]{4,}/.test(query) && !/[àáạảãâầấnẩẫậăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(query);
    const templates = isEnglish ? ENGLISH_LYRICS_TEMPLATES : VIETNAMESE_LYRICS_TEMPLATES;

    let matchedTemplate = templates[0];
    let maxMatchCount = 0;

    for (const temp of templates) {
      let matchCount = 0;
      for (const genre of temp.genres) {
        if (query.includes(genre)) matchCount++;
      }
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        matchedTemplate = temp;
      }
    }

    const generatedLyrics = matchedTemplate.lyrics;
    let songTitle = inputTitle || matchedTemplate.title;
    const songStyle = inputStyle || matchedTemplate.style;

    if (prompt && prompt.trim().length > 3) {
      const words = prompt.trim().split(' ');
      if (words.length <= 4) {
        songTitle = prompt.trim();
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      title: songTitle,
      style: songStyle,
      lyrics: formatLyrics(generatedLyrics)
    });

  } catch (error: unknown) {
    console.error('POST /api/music/lyrics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tạo lời bài hát lúc này. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}

function formatLyrics(rawLyrics: string): string {
  if (!rawLyrics) return '';

  let formatted = rawLyrics.replace(/\r\n/g, '\n');

  formatted = formatted.replace(/(\[[^\]]+\])([^\n\s])/g, '$1\n$2');
  formatted = formatted.replace(/([^\n\s])(\[[^\]]+\])/g, '$1\n$2');

  const lowercaseOrDots = 'a-zàáảãạâầấnẩẫậăằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũưừứựửữỳýỵỷỹđ\\d\\)\\!\\?\\.';
  const uppercaseLetters = 'A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẶẲẴÈÉẸẺẼỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕỒỐỘỔỖỜỚỢỞỠÙÚỤỦŨỪỨỰỬỮỲÝỴỶỸĐ';

  const stuckSentenceRegex = new RegExp(`([${lowercaseOrDots}])(?=[${uppercaseLetters}])`, 'g');
  formatted = formatted.replace(stuckSentenceRegex, '$1\n');

  const keywords = [
    'verse', 'chorus', 'pre-chorus', 'bridge', 'outro', 'intro', 'drop', 'hook',
    'rubato', 'voice crack', 'vibrato',
    'lời', 'điệp khúc', 'kết thúc', 'dạo nhạc'
  ];

  const regex = /\[([^\]]+)\]/g;

  formatted = formatted.replace(regex, (match, content) => {
    const cleanContent = content.trim().toLowerCase();
    const isHeader = keywords.some(keyword => cleanContent.includes(keyword));
    if (isHeader) {
      return `\n\n[${content.trim()}]\n`;
    }
    return match;
  });

  const lines = formatted.split('\n').map(line => line.trim());
  const cleanedLines: string[] = [];

  const sentenceSplitRegex = new RegExp(`([.,!?])\\s*(?=[${uppercaseLetters}])`, 'g');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line === '') {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
    } else {
      const isHeader = line.startsWith('[') && line.endsWith(']');
      if (!isHeader) {
        line = line.replace(sentenceSplitRegex, '$1\n');
        const subLines = line.split('\n').map(l => l.trim());
        cleanedLines.push(...subLines);
      } else {
        cleanedLines.push(line);
      }
    }
  }

  let result = cleanedLines.join('\n').trim();

  const finalLines = result.split('\n');
  const polishedLines: string[] = [];

  for (let i = 0; i < finalLines.length; i++) {
    const line = finalLines[i];
    const isHeader = line.startsWith('[') && line.endsWith(']') &&
      keywords.some(kw => line.toLowerCase().includes(kw));

    if (isHeader) {
      if (polishedLines.length > 0 && polishedLines[polishedLines.length - 1] !== '') {
        polishedLines.push('');
      }
      polishedLines.push(line);
      if (i + 1 < finalLines.length && finalLines[i + 1] === '') {
        i++;
      }
    } else {
      polishedLines.push(line);
    }
  }

  return polishedLines.join('\n').trim();
}
"""

output_path = r'd:\nhac-ai\src\app\api\music\lyrics\route.ts'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(CONTENT)

print(f"Done! Written {len(CONTENT)} chars to {output_path}")
