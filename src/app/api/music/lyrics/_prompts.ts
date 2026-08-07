/**
 * ──────────────────────────────────────────────────────────────
 *  _prompts.ts — Gemini Prompt Builders per Genre
 *  - ĐẢM BẢO 100% MỖI LẦN TẠO LÀ MỘT BÀI HÁT MỚI ĐỘC ĐÁO HOÀN TOÀN (High Diversity)
 *  - TÍCH HỢP CÁC THẺ BIỂU CẢM CA HÁT & PHONG CÁCH ÂM NHẠC: (crisp cutoff, vocal sigh, pause, preserve lyrics, clean endings)
 *  - TÍCH HỢP THẺ DROP MELODY & GIAI ĐIỆU NHẠC CỤ NGẦM ([Melodic Drop], [Piano Solo], [Instrumental Break], [Strings Interlude])
 *  - SIẾT CHẶT ĐỘ DÀI CÂU: Bắt buộc từ 7 đến 8 âm tiết/câu (CẤM câu quá ngắn < 5 từ và CẤM câu quá dài > 9 từ)
 *  - GIEO VẦN THƠ CA CHUẨN MỰC (AABB / ABAB): Gieo vần mượt mà, ngân vang
 *  - Style prompt: Sinh ngẫu nhiên phù hợp BALLAD HIỆN ĐẠI TƯƠI SÁNG (Bright Modern Ballad)
 *  - Tiêu đề bài hát: BẮT BUỘC NGẪU NHIÊN 100% ĐỘC ĐÁO, CẤM RẬP KHUÔN "GÓC PHỐ"
 *  - Intro: 100% CHỈ CÓ NHẠC CỤ, KHÔNG GIỌNG HÁT / HÒ HÉT
 * ──────────────────────────────────────────────────────────────
 */

import type { GenreProfile } from './_genres';

export interface PromptContext {
  genreId: string;
  selectedProfile: GenreProfile;
  prompt: string | undefined;
  inputStyle: string | undefined;
  vocalHint: string;
  styleBase: string;
  isEnglishLyrics: boolean;
  languageInstruction: string;
  randomIdea: string;
  mood: string | undefined;
  theme: string | undefined;
}

const CREATIVE_ANGLES = [
  'Tự sự hoài niệm dưới nắng thu nhè nhẹ, phác họa khung cảnh bình yên.',
  'Dòng nhật ký ngọt ngào viết giữa đêm muộn khi nhớ về một nụ cười ấm áp.',
  'Cảm xúc rung động ngỡ ngàng khi tình cờ chạm ánh mắt ai đó giữa phố đông.',
  'Tách cà phê tỏa khói ban sáng, những câu chuyện thầm thì chưa hồi kết.',
  'Chiếc ôm siết chặt dưới cơn mưa rào mùa hạ, cảm giác an yên che chở.',
  'Chuyến đi xa cùng nhau, ngắm khoảng trời rộng mở và bình yên ở phía trước.',
  'Những mảnh kỷ niệm mộc mạc đời thường, sự trân trọng giản dị mỗi ngày.',
  'Lời hẹn ước ngọt ngào dịu êm dành cho người mình yêu thương nhất.',
];

function getRandomAngle(): string {
  const idx = Math.floor(Math.random() * CREATIVE_ANGLES.length);
  return CREATIVE_ANGLES[idx];
}

const ADVANCED_CONVERSATIONAL_PROSODY_RULES = `
## QUY TẮC NGHỆ THUẬT & YÊU CẦU SÁNG TẠO ĐỘC ĐÁO MỚI 100%:

1. ĐẢM BẢO MỖI LẦN SÁNG TÁC LÀ MỘT BÀI HÁT MỚI ĐỘC ĐÁO KHÁC NHAU HOÀN TOÀN:
   - MỖI LẦN VIẾT BẮT BUỘC TẠO RA Ý TƯỞNG, HÌNH ẢNH THƠ CA VÀ TỪ NGỮ HOÀN TOÀN MỚI 100%.
   - TUYỆT ĐỐI CẤM lặp lại mô-típ từ ngữ, lối ví von hay góc nhìn của lần sáng tác trước.
   - Linh hoạt tùy biến ngẫu nhiên cấu trúc gieo vần (chuyển đổi giữa sơ đồ AABB và ABAB).

2. QUY TẮC SIẾT CHẶT ĐỘ DÀI CÂU (CHUẨN 7-8 ÂM TIẾT/CÂU):
   - MỖI CÂU HÁT BẮT BUỘC DÀI CHÍNH XÁC TỪ 7 ĐẾN 8 ÂM TIẾT (TỪ).
   - TUYỆT ĐỐI CẤM VIẾT CÂU NGẮN VỤN 3-4 TỪ (❌ Cấm các câu ngắn vụn vặt như: "Màn đêm dịu dàng buông", "Nhớ anh lòng vẫn vương", "Nụ cười sao ấm áp").
   - TUYỆT ĐỐI CẤM VIẾT CÂU DÀI LÊ THÊ > 9 TỪ.
   - Ví dụ độ dài chuẩn 7-8 âm tiết mượt mà:
     ✅ "Màn đêm dịu dàng khẽ buông xuống phố," (7 từ)
     ✅ "Nhớ anh nhiều lòng vẫn mãi vương vương," (7 từ)
     ✅ "Nụ cười sao mà ấm áp dịu êm," (7 từ)
     ✅ "Vết son còn in trên tờ giấy trắng..." (7 từ)

3. QUY TẮC GIEO VẦN THƠ CA CHUẨN MỰC (AABB HOẶC ABAB):
   - TOÀN BỘ CÁC PHẦN (VERSE, PRE-CHORUS, CHORUS) BẮT BUỘC PHẢI GIEO VẦN MƯỢT MÀ, ỀM TAI BẰNG SƠ ĐỒ AABB HOẶC ABAB.
   - SƠ ĐỒ VẦN CẶP (AABB): Dòng 1 vần Dòng 2 (Vần A), Dòng 3 vần Dòng 4 (Vần B).
   - SƠ ĐỒ VẦN CÁCH (ABAB): Dòng 1 vần Dòng 3 (Vần A), Dòng 2 vần Dòng 4 (Vần B).
   - Ưu tiên các bộ vần BẰNG vương vần thông êm tai: (-yên / -hiên), (-ay / -ngày / -tay), (-thưa / -mưa / -xưa), (-trôi / -rồi / -môi / -đời), (-sau / -nhau / -đau), (-đêm / -êm / -mềm), (-sao / -trao / -cao).

4. KIỂM SOÁT GIỌNG HÁT & CAO ĐỘ:
   - Ngôn ngữ như lời tự sự, trò chuyện ngọt ngào (Conversational Lyricism: "Thật ra...", "Nhiều khi...", "Hóa ra...").
   - Kỹ thuật "Show, Don't Tell": Dùng hình ảnh vật lý cụ thể (Ví dụ: "Anh nhìn lại màn hình điện thoại, dòng tin nhắn cũ chưa bấm gửi").
   - GIỌNG HÁT VỪA PHẢI, TRÁNH HÉT CAO GIỌNG & CẤM HÁT NGANG NGA KÉO DÀI NỐT CAO. Cao trào dùng giả thanh (head voice/falsetto) dịu dàng hoặc thì thầm tự sự [Rubato].
   - Cuối dòng Chorus ưu tiên vần BẰNG để luyến láy ngân rung [Vibrato].

5. CẤU TRÚC BÀI HÁT BẮT BUỘC (VIẾT ĐẦY ĐỦ VÀ TRỌN VẸN TỪ INTRO ĐẾN OUTRO, CÓ THẺ DROP MELODY NHẠC CỤ):
   [Instrumental Intro]  -> CHỈ CÓ NHẠC CỤ CHƠI DẠO, CẤM HÒ HÉT / CÂU HÁT.
   [Verse 1]              -> Đủ 4 câu (mỗi câu 7-8 từ), gieo vần chuẩn AABB hoặc ABAB.
   [Pre-Chorus]           -> Đủ 4 câu (mỗi câu 7-8 từ), leo thang cảm xúc, chốt câu cuối bằng [voice crack].
   [Chorus]               -> Đủ 4 câu (mỗi câu 7-8 từ), Hook điệp từ/láy âm, câu cuối kết BẰNG gắn [Vibrato].
   [Melodic Drop] hoặc [Piano Solo] -> DẠO NHẠC CỤ PHIÊU BÙNG NỔ GIỮA BÀI (giai điệu piano/strings du dương).
   [Verse 2]              -> Đủ 4 câu (mỗi câu 7-8 từ), đổi góc nhìn / thời gian / chiều sâu tâm trạng.
   [Pre-Chorus]           -> Đủ 4 câu (mỗi câu 7-8 từ), chốt câu cuối bằng [voice crack].
   [Chorus]               -> Đủ 4 câu (mỗi câu 7-8 từ), ngân rung thăng hoa [Vibrato].
   [Instrumental Break] hoặc [Building Drop] -> ĐOẠN BÙNG NỔ CAO TRÀO NHẠC CỤ TRƯỚC OUTRO.
   [Outro]                -> Rút dần ngắn dần (dài -> vừa -> ngắn -> 2-3 chữ im lặng an yên).

6. LOẠI BỎ TỪ NGHỆ SÁO MÒN, HỢP ÂM & CÁC CON SỐ ĐẾM:
   - CẤM IN CÁC CON SỐ ĐẾM ÂM TIẾT NHƯ (7), (8), (4) Ở CUỐI CÂU HÁT.
   - CẤM IN CÁC SỐ THỨ TỰ NHƯ 1., 2., 3. Ở ĐẦU CÂU HÁT.
   - CẤM từ sáo mòn (❌ "dòng đời / tháng ngày trôi / ngát hương / gói lại yêu thương").
   - CẤM HỢP ÂM: Tuyệt đối không ghi [Am], [C], [F] trong lời bài hát.
   - DẤU CÂU: Mỗi câu hát BẮT BUỘC kết thúc bằng dấu phẩy ',', dấu chấm '.', hoặc dấu ba chấm '...'.

7. THẺ MUSIC STYLE TÍCH HỢP CÁC KỸ THUẬT BIỂU CẢM CA HÁT CAO CẤP:
   - Thẻ Style Tags (ô MUSIC STYLE) sinh ra BẮT BUỘC tích hợp đầy đủ các thẻ kỹ thuật như:
     "Rubato verse, rapid light melisma, fast legato pre-chorus, driving chorus, vocal sigh, pause, preserve lyrics, clean endings, 82 BPM, female vocal, warm acoustic piano, uplifting strings"
   - Giúp ca sĩ AI uốn cao độ luyến láy mềm mại (rapid light melisma), ngắt nhịp co giãn tự do (Rubato verse), hátPre-Chorus và Chorus nhanh lôi cuốn (fast legato pre-chorus, driving chorus), thở nhẹ truyền cảm (vocal sigh), tạo khoảng lặng lắng đọng (pause), giữ nguyên 100% lời (preserve lyrics) và kết thúc bài dịu dàng (clean endings).

8. TIÊU ĐỀ NGẪU NHIÊN MỚI 100% (CẤM RẬP KHUÔN "GÓC PHỐ"):
   - Tiêu đề 3-5 từ Tiếng Việt có dấu, độc đáo, đắt giá, khớp logic bài hát.

KỸ THUẬT ĐIỀU KHIỂN SẮC THÁI CA HÁT TRONG LỜI:
- [Rubato] [rapid light melisma]: Đặt ở Verse 1 và Verse 2 để luyến láy uốn cao độ nhẹ nhàng.
- [fast legato] [upbeat tempo]: Đặt ở Pre-Chorus để hát nhanh hơn chút, cuộn nốt liền mạch.
- [driving beat] [fast chorus]: Đặt ở Chorus để hát nhanh lôi cuốn bùng nổ cao trào.
- [slow tempo] [tender voice] [clean endings]: Đặt ở Outro để hát chậm lại dịu dàng, thì thầm an yên.
- Dấu ba chấm '...': Dùng giữa các từ để ép AI hát ngân chầm chậm lắng đọng.
- Thẻ biểu cảm trong STYLE: Rubato verse, rapid light melisma, fast legato pre-chorus, driving chorus, vocal sigh, pause, preserve lyrics, clean endings.
`;

function buildViBalladPrompt(ctx: PromptContext): string {
  const { prompt, vocalHint, mood } = ctx;
  const creativeAngle = getRandomAngle();
  const seed = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return `Bạn là một nhạc sĩ Việt Nam thiên tài, chuyên sáng tác Pop Ballad Trữ Tình hiện đại tươi sáng đỉnh cao.
Hãy sáng tác một bài hát TIẾNG VIỆT CÓ DẤU CHUẨN MỰC MỚI HOÀN TOÀN (Random Seed: ${seed}).

GÓC NHÌN SÁNG TẠO GỢI Ý CHO LẦN NÀY:
- "${creativeAngle}"

BẮT BUỘC VỀ ĐỘ DÀI CÂU & VẦN ĐIỆU:
- MỖI CÂU HÁT BẮT BUỘC DÀI CHÍNH XÁC TỪ 7 ĐẾN 8 TỪ (CẤM VIẾT CÂU NGẮN VỤN 3-4 TỪ VÀ CẤM CÂU DÀI > 9 TỪ).
- GIEO VẦN THƠ CA RÕ RÀNG MƯỢT MÀ (AABB hoặc ABAB).

CHỦ ĐỀ & Ý TƯỞNG:
- Chủ đề: ${prompt || 'tình yêu lãng mạn ngọt ngào, những kỷ niệm đẹp đẽ và sự trân trọng lẫn nhau'}
- Tâm trạng / Vibe: ${mood || 'tươi sáng, lãng mạn, tự sự ngọt ngào'}
- Giọng hát: ${vocalHint}

${ADVANCED_CONVERSATIONAL_PROSODY_RULES}

OUTPUT — trả về đúng định dạng sau, không markdown, không giải thích:
TITLE: [tên bài ngẫu nhiên mới 100%, 3-5 từ Tiếng Việt có dấu]
STYLE: [Suno style tags dưới 120 chars tiếng Anh, bright modern pop ballad, crisp cutoff, vocal sigh, pause, preserve lyrics, clean endings]
LYRICS:
[Instrumental Intro]
[Verse 1]
[phần còn lại của bài hát đầy đủ đến [Outro]]`;
}

function buildRapPrompt(ctx: PromptContext): string {
  const { prompt, styleBase, isEnglishLyrics, randomIdea, mood, vocalHint } = ctx;
  const seed = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return `You are a world-class Vietnamese trap rap songwriter and producer.
Compose a COMPLETE, 100% UNIQUE RAP song through to [Outro] (Seed: ${seed}).

INPUTS:
- Theme/Idea: ${prompt || randomIdea}
- Style: ${styleBase}
- Mood/Vibe: ${mood || 'trữ tình da diết, tự sự'}

${ADVANCED_CONVERSATIONAL_PROSODY_RULES}

TITLE:
- ${isEnglishLyrics ? 'Creative English title, 3-5 words.' : 'Tên bài hát BẮT BUỘC NGẪU NHIÊN MỚI 100% (CẤM dùng từ "Góc phố"), 3-5 từ Tiếng Việt có dấu.'}

OUTPUT FORMAT:
TITLE: [song title]
STYLE: [Suno style tags including crisp cutoff, vocal sigh, pause, preserve lyrics, clean endings]
LYRICS:
[Instrumental Intro]
[Verse 1]
[phần lời bài hát đầy đủ]`;
}

function buildHiphopPrompt(ctx: PromptContext): string {
  const { prompt, styleBase, isEnglishLyrics, randomIdea, mood, vocalHint } = ctx;
  const seed = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return `You are a world-class Vietnamese hip-hop songwriter.
Compose a COMPLETE, 100% UNIQUE HIP-HOP song through to [Outro] (Seed: ${seed}).

INPUTS:
- Theme/Idea: ${prompt || randomIdea}
- Style: ${styleBase}
- Mood/Vibe: ${mood || 'trữ tình hoài niệm'}

${ADVANCED_CONVERSATIONAL_PROSODY_RULES}

TITLE:
- ${isEnglishLyrics ? 'Creative English title, 3-5 words.' : 'Tên bài hát BẮT BUỘC NGẪU NHIÊN MỚI 100% (CẤM dùng từ "Góc phố"), 3-5 từ Tiếng Việt có dấu.'}

OUTPUT FORMAT:
TITLE: [song title]
STYLE: [Suno style tags including crisp cutoff, vocal sigh, pause, preserve lyrics, clean endings]
LYRICS:
[Instrumental Intro]
[Verse 1]
[phần lời bài hát đầy đủ]`;
}

function buildGenericPrompt(ctx: PromptContext): string {
  const { prompt, styleBase, isEnglishLyrics, randomIdea, mood, vocalHint } = ctx;
  const seed = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return `You are a world-class songwriter and music producer.
Compose a COMPLETE, 100% UNIQUE song through to [Outro] (Seed: ${seed}).

INPUTS:
- Theme/Idea: ${prompt || randomIdea}
- Genre/Style: ${styleBase}
- Mood/Vibe: ${mood || 'trữ tình tươi sáng, lãng mạn'}

${ADVANCED_CONVERSATIONAL_PROSODY_RULES}

TITLE:
- ${isEnglishLyrics ? 'Creative English title, 3-5 words.' : 'Tên bài hát BẮT BUỘC NGẪU NHIÊN MỚI 100% (CẤM từ "Góc phố"), 3-5 từ Tiếng Việt có dấu.'}

OUTPUT FORMAT:
TITLE: [song title]
STYLE: [Suno style tags including crisp cutoff, vocal sigh, pause, preserve lyrics, clean endings]
LYRICS:
[Instrumental Intro]
[Verse 1]
[phần lời bài hát đầy đủ]`;
}

export function buildLyricsPrompt(ctx: PromptContext): string {
  const { genreId } = ctx;

  if (genreId === 'rap' || genreId.includes('trap')) {
    return buildRapPrompt(ctx);
  }

  if (genreId === 'hiphop' || genreId === 'hip-hop' || genreId.includes('hip hop')) {
    return buildHiphopPrompt(ctx);
  }

  return buildViBalladPrompt(ctx);
}
