/**
 * ──────────────────────────────────────────────────────────────
 *  _utils.ts — Lyrics utility functions
 *  Chỉnh sửa tại đây để thay đổi cách xử lý / validate / format lyrics
 * ──────────────────────────────────────────────────────────────
 */

/**
 * Xóa các artifact lửng cuối lyrics do AI bị cắt token:
 * - Bracket chưa đóng [ ở cuối
 * - Dòng chỉ có dấu câu / khoảng trắng
 * - Dòng ngắt dở ngắn vụn (e.g. "Cố gi,", "Của những")
 * - Markdown code fence ```
 */
export function sanitizeLyrics(raw: string): string {
  if (!raw) return '';

  // Remove markdown code fences if AI wraps output
  let text = raw.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '');

  // Split and trim lines
  const lines = text.split('\n').map(l => l.trimEnd());

  // Clean trailing incomplete lines
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();

    // 1. Line is empty, lone bracket, or incomplete section header
    if (last === '' || last === '[' || last === '...' || /^\[?\s*$/.test(last) || /^\[[^\]]*$/.test(last)) {
      lines.pop();
      continue;
    }

    // 2. Line is a section header at the very end of lyrics with no lyrics under it
    if (/^\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Hook|Drop|Build|Breakdown|Solo|Lời|Điệp)[^\]]*\]$/i.test(last)) {
      lines.pop();
      continue;
    }

    // 3. Line ends abruptly with dangling word or truncated snippet (e.g. "Cố gi,", "Của những", "Và")
    const cleanLastWord = last.replace(/[.,!?:;\u2026]$/, '').trim();
    const words = cleanLastWord.split(/\s+/);
    const lastWord = (words[words.length - 1] || '').toLowerCase();

    if (
      (words.length <= 2 && cleanLastWord.length < 10) ||
      ['của', 'và', 'hoặc', 'nhưng', 'mà', 'với', 'là', 'ở', 'khi', 'trong', 'đã', 'đang', 'sẽ', 'cố', 'gi', 'giữ', 'of', 'and', 'or', 'but', 'with', 'is', 'in', 'at', 'on', 'the', 'a', 'an'].includes(lastWord)
    ) {
      lines.pop();
      continue;
    }

    break;
  }

  return lines.join('\n').trim();
}

/**
 * Kiểm tra lyrics có đủ cấu trúc tối thiểu:
 * - Phải có ít nhất 1 section header [Verse...] hoặc [Chorus...]
 * - Phải có ít nhất 6 dòng nội dung (không tính dòng trống)
 * - Không được kết thúc bằng bracket lửng hoặc section header không có nội dung
 */
export function isValidLyricsStructure(lyrics: string): boolean {
  if (!lyrics || lyrics.length < 80) return false;

  const SECTION_RE = /\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Hook|Drop|Build|Breakdown|Solo|Lời|Điệp)[^\]]*\]/i;
  if (!SECTION_RE.test(lyrics)) return false;

  // Count non-empty, non-header content lines
  const lines = lyrics.split('\n').map(l => l.trim()).filter(Boolean);
  const contentLines = lines.filter(l => !/^\[[^\]]+\]$/.test(l));

  if (contentLines.length < 6) return false;

  // Check last meaningful line isn't an incomplete section header or bracket
  const lastLine = lines[lines.length - 1] || '';
  if (/^\[[^\]]*$/.test(lastLine) || /^\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Hook|Drop|Build|Breakdown|Solo|Lời|Điệp)[^\]]*\]$/i.test(lastLine)) {
    return false;
  }

  return true;
}

/**
 * Loại bỏ toàn bộ nhãn hợp âm (Chords) khỏi lời bài hát,
 * chỉ giữ lại các nhãn cấu trúc bài hát ([Intro], [Verse 1], [Chorus], [Hook], [Outro], [Rubato]...)
 */
export function removeChordsFromLyrics(rawLyrics: string): string {
  if (!rawLyrics) return '';

  // Match chord patterns in brackets: [Am], [C], [F], [G], [Dm], [Em], [Bb], [Cadd9], [D/F#], [F#m7]...
  const CHORD_REGEX = /\[([A-G][b#]?(?:m|maj|min|dim|aug|sus|add|7|9|11|13)*\/?(?:[A-G][b#]?)?)\]/gi;

  return rawLyrics.replace(CHORD_REGEX, (match, chordStr) => {
    const lower = chordStr.toLowerCase();
    // Safety: keep structural or vocal tags
    if (['intro', 'verse', 'chorus', 'hook', 'bridge', 'outro', 'rubato', 'vibrato', 'voice crack', 'drop', 'solo'].some(k => lower.includes(k))) {
      return match;
    }
    return '';
  }).replace(/  +/g, ' ');
}

/**
 * Format lyrics: loại bỏ hợp âm, ẩn các tags kỹ thuật ngầm ([Rubato], [voice crack], [Vibrato], [Instrumental Intro]),
 * dọn dẹp khoảng trắng, tự động ngắt nghỉ bằng dấu câu, và ĐẢM BẢO BẮT BUỘC CÓ [Verse 1] Ở ĐẦU BÀI HÁT.
 */
export function formatLyrics(rawLyrics: string): string {
  if (!rawLyrics) return '';

  // First sanitize truncated trailing lines
  let text = sanitizeLyrics(rawLyrics);

  // 1. Remove chord annotations
  text = removeChordsFromLyrics(text);

  // 2. Remove technical tags ([Rubato], [voice crack], [Vibrato], [rapid light melisma], [fast legato], [driving beat], [upbeat tempo], etc.) & residual brackets like [, ]
  text = text
    .replace(/\[\s*(?:Rubato|voice crack|Vibrato|Instrumental Intro|Intro|Melodic Drop|Piano Solo|Instrumental Break|Strings Interlude|Acoustic Guitar Solo|Building Drop|Melodic Interlude|Break|Solo|Interlude|Drop|endings|crisp cutoff|vocal sigh|sigh|pause|preserve lyrics|preserve-lyrics|cutoff|rapid light melisma|smooth melisma|melisma|fast legato|upbeat tempo|driving beat|fast chorus|driving chorus|slow tempo|tender voice|clean endings)\s*\]/gi, '')
    .replace(/\[\s*(?:Instrumental|Melodic|Piano|Strings|Guitar)\s*[^\]]*\]/gi, '')
    .replace(/\b(?:crisp cutoff|vocal sigh|preserve lyrics|clean endings|rapid light melisma|fast legato|upbeat tempo|driving beat|fast chorus|slow tempo|tender voice)\b/gi, '')
    .replace(/\[\s*[,.\s]*\]/g, '')
    .replace(/\s*\[\s*$/gm, '');

  const keywords = [
    'verse', 'chorus', 'pre-chorus', 'bridge', 'outro', 'hook',
    'lời', 'điệp khúc', 'kết thúc',
  ];

  const regex = /\[([^\]]+)\]/g;

  // Standardize section headers
  let formatted = text.replace(regex, (match, content) => {
    const cleanContent = content.trim().toLowerCase();
    const isHeader = keywords.some(keyword => cleanContent.includes(keyword));
    if (isHeader) {
      return `\n\n[${content.trim()}]\n`;
    }
    return '';
  });

  const lines = formatted.split('\n').map(line => line.trim());
  const cleanedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove line numbers (e.g. "1. ", "2) ") and word counts in parentheses (e.g. "(7),", "(8)")
    if (!/^\[[^\]]+\]$/.test(line)) {
      line = line.replace(/^\d+[\.\)]\s*/, '');
      line = line.replace(/\s*\(\d+\)\s*,?/g, '');
    }

    line = line.replace(/\[\s*[,.\s]*$/, '').trim();

    if (line === '') {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
    } else {
      if (!/^\[[^\]]+\]$/.test(line)) {
        // If line is overly long (> 10 words), split into 2 short natural lines
        const words = line.split(/\s+/);
        if (words.length >= 11) {
          const mid = Math.ceil(words.length / 2);
          let part1 = words.slice(0, mid).join(' ');
          let part2 = words.slice(mid).join(' ');
          if (!/[.,!?:;\u2026]$/.test(part1)) part1 += ',';
          if (!/[.,!?:;\u2026]$/.test(part2)) part2 += ',';
          cleanedLines.push(part1);
          cleanedLines.push(part2);
          continue;
        }

        if (!/[.,!?:;\u2026]$/.test(line)) {
          line = line + ',';
        }
      }
      cleanedLines.push(line);
    }
  }

  // Remove leading blank lines
  while (cleanedLines.length > 0 && cleanedLines[0] === '') {
    cleanedLines.shift();
  }

  // Remove trailing blank lines or brackets
  while (cleanedLines.length > 0 && (cleanedLines[cleanedLines.length - 1] === '' || /^\[?\s*$/.test(cleanedLines[cleanedLines.length - 1]))) {
    cleanedLines.pop();
  }

  // 3. ENSURE [Verse 1] HEADER IS ALWAYS PRESENT AT THE VERY TOP
  if (cleanedLines.length > 0) {
    const firstLine = cleanedLines[0];
    if (!/^\[[^\]]+\]$/.test(firstLine)) {
      cleanedLines.unshift('[Verse 1]');
    }
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Làm sạch lyrics cho hiển thị UI (giao diện người dùng):
 * - Ẩn bớt các thẻ kỹ thuật như [Rubato], [voice crack], [Vibrato], [Instrumental Intro]
 * - Giữ lại chuẩn cấu trúc chính: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Outro]
 * - Trình bày sạch đẹp, gọn gàng đúng chuẩn nghệ thuật.
 */
export function cleanDisplayLyrics(rawLyrics: string): string {
  return formatLyrics(rawLyrics);
}

/**
 * Làm sạch và chuẩn hóa tiêu đề bài hát (Song Title):
 * - Loại bỏ các ký tự rác, prefix AI (TITLE:, markdown, ngoặc kép)
 * - Khắc phục các tiêu đề ghép từ gượng gập của AI (vd: "Mưa Tan Nỗi Giận", "Chia Tay Mùa Hạ Hóa Ngọt Ngào")
 * - Chuẩn hóa viết hoa chuẩn Tiếng Việt tự nhiên
 */
export function sanitizeSongTitle(rawTitle: string, isEnglish = false): string {
  if (!rawTitle) return isEnglish ? 'Untitled Song' : 'Khúc Ca Không Tên';

  let title = rawTitle
    .replace(/^(TITLE|Tiêu đề|Song Title|Tên bài hát):\s*/i, '')
    .replace(/^["'“”«»]+|["'“”«»]+$/g, '')
    .replace(/^#+\s*/, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  if (!title) return isEnglish ? 'Untitled Song' : 'Khúc Ca Không Tên';

  if (title.length > 60) {
    const words = title.split(/\s+/).slice(0, 5);
    title = words.join(' ');
  }

  if (!isEnglish) {
    title = title
      .toLowerCase()
      .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
  }

  return title;
}
