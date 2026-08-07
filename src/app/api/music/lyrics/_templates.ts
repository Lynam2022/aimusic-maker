/**
 * ──────────────────────────────────────────────────────────────
 *  _templates.ts — Static Lyrics Templates (fallback khi AI fail)
 *  Intro CHỈ CÓ NHẠC CỤ ([Instrumental Intro]), không giọng hát / hò hét
 * ──────────────────────────────────────────────────────────────
 */

export interface LyricsTemplate {
  genres: string[];
  title: string;
  style: string;
  lyrics: string;
}

export const VIETNAMESE_LYRICS_TEMPLATES: LyricsTemplate[] = [

  // ── 1. POP BALLAD TRỮ TÌNH HIỆN ĐẠI ─────────────────────────────────────────
  {
    genres: ['pop', 'ballad', 'acoustic', 'auto', 'nhac_tre'],
    title: 'Lời Giận Hờn Vu Vơ',
    style: 'soft intimate pop ballad, warm acoustic piano, gentle strings, 75-85 BPM, head voice falsetto, emotional storytelling, lo-fi warmth',
    lyrics: [
      '[Instrumental Intro]',
      '[Rubato]',
      '[Verse 1]',
      'Chiều hôm ấy có một thoáng hờn ghen vu vơ,',
      'Tin nhắn gửi đi bỗng nhiên lặng im không nói một lời.',
      'Anh ngồi thẫn thờ nhìn ly trà chanh đã tan hết đá,',
      'Tự hỏi vì sao hai ta lại vội vã giận dỗi nhau.',
      '',
      '[Pre-Chorus]',
      'Nhiều khi nghĩ lại thấy mình thật vụng về trẻ con,',
      'Chỉ vì nỗi sợ mất em nên lòng này mới chẳng an yên.',
      'Hóa ra anh vội trách em mà quên mất tình yêu thương,',
      'Chẳng ai đúng ai sai, chỉ vì ta quá yêu nhau mà thôi [voice crack].',
      '',
      '[Chorus]',
      'Vì yêu nên mới dỗi hờn, vì thương nên mới vội lo [Vibrato],',
      'Giờ đây ôm lấy em thật chặt, trao nụ cười xua đi âu lo [Vibrato],',
      'Cảm ơn những lần giận hờn để ta thêm thấu hiểu nhau [Vibrato],',
      'Tình yêu ngọt ngào hơn sau những khoảng lặng trao nhau [Vibrato].',
      '',
      '[Rubato]',
      '[Verse 2]',
      'Nắng chiều chiếu qua khung cửa sổ ngập tràn ấm áp,',
      'Em mỉm cười nắm tay anh khẽ tựa đầu lên vai.',
      'Bao nhiêu muộn phiền chiều nay như làn mây nhẹ trôi mất,',
      'Chỉ còn lại nụ cười rạng rỡ và ánh mắt trao yêu thương.',
      '',
      '[Pre-Chorus]',
      'Nhiều khi nghĩ lại thấy mình thật vụng về trẻ con,',
      'Chỉ vì nỗi sợ mất em nên lòng này mới chẳng an yên.',
      'Hóa ra anh vội trách em mà quên mất tình yêu thương,',
      'Chẳng ai đúng ai sai, chỉ vì ta quá yêu nhau mà thôi [voice crack].',
      '',
      '[Chorus]',
      'Vì yêu nên mới dỗi hờn, vì thương nên mới vội lo [Vibrato],',
      'Giờ đây ôm lấy em thật chặt, trao nụ cười xua đi âu lo [Vibrato],',
      'Cảm ơn những lần giận hờn để ta thêm thấu hiểu nhau [Vibrato],',
      'Tình yêu ngọt ngào hơn sau những khoảng lặng trao nhau [Vibrato].',
      '',
      '[Outro]',
      'Tình yêu hai ta ngọt ngào...',
      'Giữa góc phố quen tràn đầy nắng ấm...',
      'Nhẹ nhàng hạnh phúc vẹn tròn.',
    ].join('\n'),
  },

  // ── 2. CỔ PHONG TRỮ TÌNH ──────────────────────────────────────────────────
  {
    genres: ['co_phong', 'co-phong', 'cổ phong', 'tradition'],
    title: 'Hương Trà Chiều Xưa',
    style: 'co phong Vietnam, dan tranh, sao truc, pentatonic scale, modern ballad arrangement, 75 BPM, ethereal female vocal',
    lyrics: [
      '[Instrumental Intro]',
      '[Rubato]',
      '[Verse 1]',
      'Sương giăng mờ lối cũ, tiếng sáo trúc trầm vang,',
      'Nhìn dòng nước trôi êm đềm, nghe bóng chiều nhẹ tan.',
      'Giọt trà ấm trên môi, nhớ kỷ niệm xưa cũ,',
      'Tựa mây khói mênh mang, lòng vấn vương mộng mị.',
      '',
      '[Pre-Chorus]',
      'Người đi qua góc phố, áo lụa mỏng vương hương,',
      'Để lại chốn hoài niệm, ngàn dặm nẻo yêu thương,',
      'Trăng treo cành trúc mỏng, gió thổi khẽ rèm thưa,',
      'Lòng ta vẫn ở lại, chốn quen cũ ngày xưa [voice crack].',
      '',
      '[Chorus]',
      'Ngàn năm mây vẫn bay, tình gói trọn trong lòng [Vibrato],',
      'Dẫu thời gian phai dấu, nụ cười vẫn ngóng trông [Vibrato],',
      'Đàn tranh vút tiếng ca, họa bức tranh duyên nợ [Vibrato],',
      'Giữ lại nét duyên xưa, một đời ta thương nhớ [Vibrato].',
      '',
      '[Rubato]',
      '[Verse 2]',
      'Đêm nay ngồi một mình, nhìn ánh trăng soi thềm,',
      'Từng câu thơ thầm nhắc, bao ân tình êm đềm.',
      'Dù dâu bể đổi thay, tim này không phai dấu,',
      'Chỉ mong người bình yên, ở phương trời thâm sâu.',
      '',
      '[Pre-Chorus]',
      'Người đi qua góc phố, áo lụa mỏng vương hương,',
      'Để lại chốn hoài niệm, ngàn dặm nẻo yêu thương,',
      'Trăng treo cành trúc mỏng, gió thổi khẽ rèm thưa,',
      'Lòng ta vẫn ở lại, chốn quen cũ ngày xưa [voice crack].',
      '',
      '[Chorus]',
      'Ngàn năm mây vẫn bay, tình gói trọn trong lòng [Vibrato],',
      'Dẫu thời gian phai dấu, nụ cười vẫn ngóng trông [Vibrato],',
      'Đàn tranh vút tiếng ca, họa bức tranh duyên nợ [Vibrato],',
      'Giữ lại nét duyên xưa, một đời ta thương nhớ [Vibrato].',
      '',
      '[Outro]',
      'Hương trà thoảng trong đêm...',
      'Giữ trọn tình duyên xưa...',
      'Mãi mãi vẹn nguyên.',
    ].join('\n'),
  },

  // ── 3. ACOUSTIC / CHILL BALLAD ───────────────────────────────────────────
  {
    genres: ['acoustic', 'chill', 'romantic', 'indie', 'lofi'],
    title: 'Góc Nhỏ Cho Hai Ta',
    style: 'chill acoustic ballad, bright fingerstyle guitar, warm electric piano, midtempo 85 BPM, intimate romantic feeling, soothing vocals',
    lyrics: [
      '[Instrumental Intro]',
      '[Rubato]',
      '[Verse 1]',
      'Ngồi bên góc quán quen ta hay ghé mỗi cuối tuần,',
      'Tiếng đàn acoustic vang lên giai điệu trong mộng mơ.',
      'Kể lại câu chuyện hai ta từ những ngày mới quen,',
      'Có chút ngập ngừng nhưng ngập tràn những niềm vui.',
      '',
      '[Pre-Chorus]',
      'Có những lúc đôi ta giận dỗi vì những chuyện vu vơ,',
      'Nhưng khi ngẫm lại mới thấy mình yêu nhau nhiều biết bao.',
      'Tự trách bản thân sao đôi khi lại chẳng đủ kiên nhẫn,',
      'Để rồi nhận ra em chính là món quà tuyệt vời nhất [voice crack].',
      '',
      '[Chorus]',
      'Hãy cùng nắm chặt tay bước đi trên con đường nắng [Vibrato],',
      'Gạt đi những muộn phiền ta trao nhau nụ cười rạng rỡ [Vibrato],',
      'Ballad ấm áp ngân vang giai điệu lãng mạn [Vibrato],',
      'Viết tiếp câu chuyện tình yêu ngọt ngào của hai ta [Vibrato].',
      '',
      '[Rubato]',
      '[Verse 2]',
      'Kỷ niệm ngày xưa ấy, từng vệt nắng dịu êm,',
      'Tay trong tay sánh bước, môi cười mắt vương thêm.',
      'Bao dỗi hờn vội tan, nhường cho tình thương tha thiết,',
      'Thành phố ngập yêu thương, ta có nhau trọn đời.',
      '',
      '[Pre-Chorus]',
      'Có những lúc đôi ta giận dỗi vì những chuyện vu vơ,',
      'Nhưng khi ngẫm lại mới thấy mình yêu nhau nhiều biết bao.',
      'Tự trách bản thân sao đôi khi lại chẳng đủ kiên nhẫn,',
      'Để rồi nhận ra em chính là món quà tuyệt vời nhất [voice crack].',
      '',
      '[Chorus]',
      'Hãy cùng nắm chặt tay bước đi trên con đường nắng [Vibrato],',
      'Gạt đi những muộn phiền ta trao nhau nụ cười rạng rỡ [Vibrato],',
      'Ballad ấm áp ngân vang giai điệu lãng mạn [Vibrato],',
      'Viết tiếp câu chuyện tình yêu ngọt ngào của hai ta [Vibrato].',
      '',
      '[Outro]',
      'Góc nhỏ hai ta...',
      'Ngập tràn nụ cười và hạnh phúc...',
      'Mãi mãi bên nhau.',
    ].join('\n'),
  },

  // ── 4. RAP TRỮ TÌNH (MELODIC RAP / TRAP) ──────────────────────────────────
  {
    genres: ['rap', 'trap'],
    title: 'Góc Phố Đêm Khuya',
    style: 'Vietnamese trap rap, dark 808 sub bass, rolling hi-hat triplets, atmospheric synth pads, aggressive confident rap flow',
    lyrics: [
      '[Instrumental Intro]',
      '[Rubato]',
      '[Verse 1]',
      'Đèn đường hắt bóng dài, bước chân đi thong thả,',
      'Bao khó khăn thử thách, đã dạy ta vươn xa.',
      'Âm nhạc là nguồn sống, trong tim là đam mê,',
      'Không lùi bước gục ngã, giữ trọn một lời thề.',
      'Tiếng 808 gầm vang, từng câu rap chắc nịch,',
      'Bỏ lại sau lưng lời gièm pha, hướng tới điều mình thích.',
      '',
      '[Hook]',
      'Góc phố khuya lặng lẽ, ánh đèn vàng lung linh [Vibrato],',
      'Viết nên những câu rap, bằng nhiệt huyết chính mình [Vibrato],',
      'Vượt qua bao sóng gió, giữ vững một niềm tin [Vibrato],',
      'Tìm lại sự tự do, trong ánh mắt ngập tràn bình minh [Vibrato].',
      '',
      '[Rubato]',
      '[Verse 2]',
      'Người ta nói mơ mộng, nhưng ta biết đường đi,',
      'Sống đúng với bản chất, không bao giờ hoài nghi.',
      'Mỗi giọt mồ hôi rơi, là một bài học mới,',
      'Vươn mình trong đêm tối, chạm tới vùng trời mới.',
      '',
      '[Hook]',
      'Góc phố khuya lặng lẽ, ánh đèn vàng lung linh [Vibrato],',
      'Viết nên những câu rap, bằng nhiệt huyết chính mình [Vibrato],',
      'Vượt qua bao sóng gió, giữ vững một niềm tin [Vibrato],',
      'Tìm lại sự tự do, trong ánh mắt ngập tràn bình minh [Vibrato].',
      '',
      '[Outro]',
      'Đêm dần trôi về sáng...',
      'Ánh bình minh lấp lánh...',
      'Đam mê này mãi cháy...',
      'Vững bước trên con đường riêng.',
    ].join('\n'),
  },

  // ── 5. HIP-HOP BOOM-BAP TRỮ TÌNH ──────────────────────────────────────────
  {
    genres: ['hiphop', 'hip-hop'],
    title: 'Nhịp Phố Khuya',
    style: 'Vietnamese hip-hop, classic boom-bap production, warm jazz samples, vinyl drums, mellow bass groove, soulful hook',
    lyrics: [
      '[Instrumental Intro]',
      '[Rubato]',
      '[Verse 1]',
      'Khuya nay ngồi một mình, nhìn phố xa mê man,',
      'Đầu óc lan man thả theo tiếng nhạc nhẹ nhàng.',
      'Nhớ ngày đầu cầm chiếc micro, trong tim ngập tràn hoài hoài,',
      'Giờ tháo gỡ từng câu từ, để tâm sự những nỗi niềm dài.',
      '',
      '[Hook]',
      'Hip-hop dạy mình cách đứng dậy sau đêm dài [Vibrato],',
      'Mỗi nhịp trống kia nhắc nhở mình sống thật thà không phôi phái [Vibrato],',
      'Không cần ồn ào chỉ cần âm nhạc chạm đến lòng [Vibrato],',
      'Trong từng câu từ là cả một chặng đường dài rộng [Vibrato].',
      '',
      '[Rubato]',
      '[Verse 2]',
      'Đêm qua đi để lại những ước mơ ngọt ngào,',
      'Cảm ơn âm nhạc đã chữa lành những nỗi đau.',
      'Nhắm mắt lại thấy hình bóng tuổi thơ hồn nhiên,',
      'Hip-hop là mảng ký ức, gắn liền tuổi thanh xuân.',
      '',
      '[Hook]',
      'Hip-hop dạy mình cách đứng dậy sau đêm dài [Vibrato],',
      'Mỗi nhịp trống kia nhắc nhở mình sống thật thà không phôi phái [Vibrato],',
      'Không cần ồn ào chỉ cần âm nhạc chạm đến lòng [Vibrato],',
      'Trong từng câu từ là cả một chặng đường dài rộng [Vibrato].',
      '',
      '[Outro]',
      'Đêm dần trôi...',
      'Bình minh sẽ tới...',
      'Cho giai điệu còn mãi...',
      'Sâu lắng trong tim.',
    ].join('\n'),
  },
];

export const ENGLISH_LYRICS_TEMPLATES: LyricsTemplate[] = [
  {
    genres: ['pop', 'ballad', 'lofi', 'acoustic'],
    title: 'Sweet Love Journey',
    style: 'soft intimate pop ballad, warm acoustic piano, gentle strings, 75-85 BPM, soothing vocals',
    lyrics: [
      '[Instrumental Intro]',
      '[Rubato]',
      '[Verse 1]',
      'Walking together down the sunlit street,',
      'Feeling the rhythm of two heartbeats.',
      'A simple misunderstanding resolved with a smile,',
      'Realizing we belong together all the while.',
      '',
      '[Pre-Chorus]',
      'Looking back at the moments we argued before,',
      'I see how much I love you even more.',
      'Learning to forgive and understand each day,',
      'Growing stronger together in every single way [voice crack].',
      '',
      '[Chorus]',
      'Oh sweet love journey filled with joy and light [Vibrato],',
      'Holding your hand making everything so bright [Vibrato],',
      'We learned to listen and to truly care [Vibrato],',
      'Building a beautiful story that we share [Vibrato].',
      '',
      '[Rubato]',
      '[Verse 2]',
      'Memories of golden days beneath the sky,',
      'Hand in hand as gentle breezes wander by.',
      'Every shadow disappears when you are near,',
      'Filling all my moments with your love so dear.',
      '',
      '[Pre-Chorus]',
      'Looking back at the moments we argued before,',
      'I see how much I love you even more.',
      'Learning to forgive and understand each day,',
      'Growing stronger together in every single way [voice crack].',
      '',
      '[Chorus]',
      'Oh sweet love journey filled with joy and light [Vibrato],',
      'Holding your hand making everything so bright [Vibrato],',
      'We learned to listen and to truly care [Vibrato],',
      'Building a beautiful story that we share [Vibrato].',
      '',
      '[Outro]',
      'Sweet love journey...',
      'Sunlit memories...',
      'Forever together.',
    ].join('\n'),
  },
];

export function getTemplateByGenre(lyricsGenre?: string, query?: string, isEnglish?: boolean): LyricsTemplate {
  const templates = isEnglish ? ENGLISH_LYRICS_TEMPLATES : VIETNAMESE_LYRICS_TEMPLATES;
  const genreId = (lyricsGenre || '').toLowerCase().trim();

  if (genreId) {
    const matched = templates.filter(t =>
      t.genres.some(g => {
        const target = g.toLowerCase();
        return target === genreId || target.includes(genreId) || genreId.includes(target);
      })
    );
    if (matched.length > 0) {
      return matched[Math.floor(Math.random() * matched.length)];
    }
  }

  const cleanQuery = (query || '').toLowerCase();
  if (cleanQuery) {
    const matched = templates.filter(t =>
      t.genres.some(g => cleanQuery.includes(g.toLowerCase()))
    );
    if (matched.length > 0) {
      return matched[Math.floor(Math.random() * matched.length)];
    }
  }

  return templates[Math.floor(Math.random() * templates.length)];
}
