/**
 * ──────────────────────────────────────────────────────────────
 *  _genres.ts — Genre Profiles
 *
 *  Mỗi genre có: structure (cấu trúc bài hát chuẩn), styleHint, vibe
 *  Cấu trúc chuẩn áp dụng nhất quán:
 *  [Verse 1] -> [Pre-Chorus] -> [Chorus] -> [Verse 2] -> [Pre-Chorus] -> [Chorus] -> [Outro]
 * ──────────────────────────────────────────────────────────────
 */

export interface GenreProfile {
  /** Cấu trúc bài hát chuẩn */
  structure: string;
  /** Suno-compatible style tags (English only) */
  styleHint: string;
  /** Cảm xúc / vibe ngắn gọn */
  vibe: string;
}

export const STANDARD_STRUCTURE = '[Verse 1]\n[Pre-Chorus]\n[Chorus]\n[Verse 2]\n[Pre-Chorus]\n[Chorus]\n[Outro]';
export const RAP_STRUCTURE = '[Intro]\n[Verse 1]\n[Hook]\n[Verse 2]\n[Hook]\n[Outro]';

export const GENRE_PROFILES: Record<string, GenreProfile> = {
  co_phong: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'co phong Vietnam, dan tranh, sao truc, pentatonic scale, modern ballad arrangement, 75 BPM, ethereal vocal',
    vibe: 'trữ tình cổ điển, mộng mơ, hình ảnh ngắt nhịp mượt mà',
  },
  nhac_tre: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'modern Vietnamese pop ballad, acoustic piano, gentle strings, 75-85 BPM, emotional vocals',
    vibe: 'trữ tình hiện đại, sâu lắng, da diết',
  },
  bolero: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'bolero ballad, acoustic guitar, gentle strings, emotional nostalgic vocal',
    vibe: 'trữ tình hoài niệm, da diết, tình yêu và nỗi nhớ',
  },
  vinahouse: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'modern melodic EDM ballad, energetic beat, catchy melody, powerful vocal',
    vibe: 'sôi động nhưng giàu giai điệu cảm xúc',
  },
  ballad: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'soft intimate pop ballad, warm acoustic piano, gentle strings, 75-85 BPM, head voice falsetto, emotional storytelling',
    vibe: 'trữ tình sâu lắng, cô đọng như thơ ca, tình yêu và nỗi nhớ',
  },
  lofi: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'lo-fi chill ballad, dusty vinyl crackle, mellow piano, relaxing boom-bap, soothing vocals',
    vibe: 'trữ tình hoài niệm, thư giãn nhẹ nhàng',
  },
  pop: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'modern pop ballad, bright piano, emotional acoustic guitar, clean soaring vocals',
    vibe: 'trữ tình sâu sắc, giàu hình ảnh thơ ca',
  },
  rock: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'modern rock ballad, electric guitar melody, powerful emotional drums, passionate vocals',
    vibe: 'trữ tình mạnh mẽ, nồng nàn da diết',
  },
  indie: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'indie ballad guitar, lo-fi warmth, authentic expressive vocals, poetic vibe',
    vibe: 'trữ tình mộc mạc, cô đọng nội tâm',
  },
  jazz: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'smooth jazz ballad piano, muted trumpet, brushed drums, soulful vocals',
    vibe: 'trữ tình nồng nàn, sang trọng',
  },
  blues: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'soulful blues ballad, electric guitar cry, Hammond organ, raw emotional vocals',
    vibe: 'trữ tình khắc khoải, chiều sâu nỗi nhớ',
  },
  soul: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'neo-soul ballad, warm electric piano, lush vocal harmonies, passionate singing',
    vibe: 'trữ tình nồng nàn, da diết',
  },
  rnb: {
    structure: STANDARD_STRUCTURE,
    styleHint: 'smooth R&B ballad groove, neo-soul piano, soulful vocals, lush harmonies',
    vibe: 'trữ tình quyến rũ, ngọt ngào',
  },
  rap: {
    structure: RAP_STRUCTURE,
    styleHint: 'Vietnamese trap rap, melodic 808 bass, rolling hi-hat, confident expressive rap flow',
    vibe: 'trữ tình tự sự, vần điệu sắc bén',
  },
  hiphop: {
    structure: RAP_STRUCTURE,
    styleHint: 'Vietnamese hip-hop, boom-bap, warm jazz samples, vinyl drums, mellow storytelling flow',
    vibe: 'trữ tình hoài niệm, thơ ca phố xá',
  },
};

export function resolveGenreProfile(genreId?: string, inputStyle?: string): GenreProfile {
  const query = [genreId, inputStyle].filter(Boolean).join(' ').toLowerCase().trim();
  if (!query) {
    return GENRE_PROFILES.ballad;
  }
  const cleanGenre = (genreId || '').toLowerCase().trim();
  if (cleanGenre && GENRE_PROFILES[cleanGenre]) {
    return GENRE_PROFILES[cleanGenre];
  }
  const matchedKey = Object.keys(GENRE_PROFILES).find(key => query.includes(key));
  if (matchedKey) {
    return GENRE_PROFILES[matchedKey];
  }
  return GENRE_PROFILES.ballad;
}
