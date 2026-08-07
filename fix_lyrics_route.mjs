import fs from 'fs';

const content = `export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkIpRateLimit } from '@/lib/security';

// Bo sinh loi bai hat thong minh ho tro Tieng Viet & Tieng Anh theo phong cach nhac
const VIETNAMESE_LYRICS_TEMPLATES = [
  {
    genres: ['pop', 'ballad', 'lofi', 'acoustic'],
    title: 'Goc Pho Va Noi Nho',
    style: 'Pop Ballad hien dai, tru tinh nhe nhang',
    lyrics: \`[Rubato]
[Verse 1]
[C] That ra chieu nay con mua ghe qua goc pho quen
[Am] Man hinh dien thoai hien len dong tin nhan cu chua bam gui
[F] Nguoi qua duong voi va che chiec o nghieng
[G] Con anh lang nhin ly ca phe da nguoi tu bao gio.

[Pre-Chorus]
[F] Nhieu khi tu hoi long minh da quen hay chua
[G] Ky niem ngay ay nhu ban tay ai khe nam giua chieu mua
[Em] Hoa ra noi nho van nam yen o day
[Am] Chi la tu giau di giua bon be au lo.
[voice crack]

[Chorus 1]
[F] Noi nho nhu mua roi giua dem dai menh mong [Vibrato]
[G] De trai tim anh giat minh goi ten em trong lang im [Vibrato]
[Em] Noi nho keo anh ve nhung ngay ta chung loi [Vibrato]
[Am] Dau biet gio day hai chung ta da xa roi [Vibrato].

[Verse 2]
[C] Tu nhien dem nay gio lua qua can phong vang
[Am] Goc ban lam viec con nguyen cuon sach em lat do
[F] Canh hoa kho nam ngoan giua tung trang giay
[G] Nhac anh nho ve mot nu cuoi ngap ngung thuo ay.

[Pre-Chorus]
[F] Nhieu khi tu hoi long minh da quen hay chua
[G] Ky niem ngay ay nhu ban tay ai khe nam giua chieu mua
[Em] Hoa ra noi nho van nam yen o day
[Am] Chi la tu giau di giua bon be au lo.
[voice crack]

[Chorus 2]
[F] Noi nho nhu mua roi giua dem dai menh mong [Vibrato]
[G] De trai tim anh giat minh goi ten em trong lang im [Vibrato]
[Em] Noi nho keo anh ve nhung ngay ta chung loi [Vibrato]
[Am] Dau biet gio day hai chung ta da xa roi [Vibrato].

[OUTRO]
[F] That ra anh van nho... [Vibrato]
[G] Giua goc pho quen thuo nao...
[Am] Noi nho nhe nhang tan vao dem.\`
  },
  {
    genres: ['rock', 'edm', 'dance', 'upbeat', 'pop rock'],
    title: 'Khat Vong Bay Xa',
    style: 'Modern Rock soi dong, tran day nang luong',
    lyrics: \`[Verse 1]
[Am] Buoc tren con duong dai day nhung chong gai
[F] Toi khong he run so truoc nhung kho khan ngay mai
[C] Anh binh minh dang len chieu sang muon noi
[G] Danh thuc con tim khat khao cham toi chan troi.

[Pre-Chorus]
[F] Dau doi chan met nhoai dau co don dau
[G] Niem tin trong ta luon ruc chay mot mau
[Em] Hay dap tan man dem buoc qua noi sau
[Am] Chang duong vinh quang dang cho don phia sau.

[Chorus 1]
[F] Bay len di hoi nhung canh chim khong moi
[G] Vuot qua bao giong cham toi nhung vi sao sang ngoi
[Em] Hay song het minh voi dam me ruc chay
[Am] Khat vong bay xa tu do giua cuoc doi nay!

[Verse 2]
[Am] Tung buoc chan di qua nhung thang tram cuoc doi
[F] Giu vung nu cuoi no tren moi nguoi oi
[C] Ngay moi dang len voi bao nhieu niem vui
[G] Xua tan di bao nhieu u toi ngam ngui.

[Pre-Chorus]
[F] Dau doi chan met nhoai dau co don dau
[G] Niem tin trong ta luon ruc chay mot mau
[Em] Hay dap tan man dem buoc qua noi sau
[Am] Chang duong vinh quang dang cho don phia sau.

[Chorus 2]
[F] Bay len di hoi nhung canh chim khong moi
[G] Vuot qua bao giong cham toi nhung vi sao sang ngoi
[Em] Hay song het minh voi dam me ruc chay
[Am] Khat vong bay xa tu do giua cuoc doi nay!

[BRIDGE (BUILD-UP)]
[Dm] Hay giu vung long tin vuot qua moi bao giong
[Em] De ngon lua nhiet huyet mai chay trong long
[F] Duong tuong lai rong mo chao don chung ta
[G] Bay cao bay xa cung nhung giac mo hong.

[OUTRO]
[F] Khat vong bay xa...
[G] Tu do giua cuoc doi nay...
[Am] Mai mai ruc chay.\`
  },
  {
    genres: ['rap', 'hiphop', 'r&b'],
    title: 'Goc Pho Len Den',
    style: 'Chill Rap, Hip-hop duong pho',
    lyrics: \`[Verse 1]
[Am] Goc pho len den cung la luc man dem buong
[F] Nhin dong nguoi hoi ha xuoi nguoc nhung noi buon
[C] Tao viet len nhung van tho ve cuoc doi day suong gio
[G] Noi nhung giac mo van dang ap u tu thuo nho

[Pre-Chorus]
[Dm] Co nhung dem trang dai suy nghi ve ngay mai
[Em] Lieu con duong dang di la dung hay la sai
[F] Nhung ta van tin vao mot ngay tuong lai
[G] Anh mat troi se chieu roi chuoi ngay dai.

[Chorus 1]
[Am] Khi anh den duong vut sang lung linh
[F] Ta nhin thay ro bong dang cua chinh minh
[C] Trai qua bao thang tram van giu vung niem tin
[G] Tim lai tu do trong nhung thuoc phim.

[Verse 2]
[Am] Ho noi tao mo mong noi tao ke kho khao
[F] Nhung am nhac cuu roi tam hon day hu hao
[C] Moi loi rap viet ra la mot phan xuong mau
[G] Khong can su gia tao khong can phai che giau

[Pre-Chorus]
[Dm] Co nhung dem trang dai suy nghi ve ngay mai
[Em] Lieu con duong dang di la dung hay la sai
[F] Nhung ta van tin vao mot ngay tuong lai
[G] Anh mat troi se chieu roi chuoi ngay dai.

[Chorus 2]
[Am] Khi anh den duong vut sang lung linh
[F] Ta nhin thay ro bong dang cua chinh minh
[C] Trai qua bao thang tram van giu vung niem tin
[G] Tim lai tu do trong nhung thuoc phim.

[BRIDGE (BUILD-UP)]
[Dm] Nhung luc moi met muon buong xuoi tat ca
[Em] Hay nho ly do vi sao ta bat dau di qua
[F] Du the gioi ngoai kia co bao la gian tra
[G] Thi ta van vung buoc tren con duong cua chung ta.

[OUTRO]
[Am] Tim lai tu do...
[F] Trong nhung thuoc phim...
[C] Cua cuoc doi minh.\`
  }
];

const ENGLISH_LYRICS_TEMPLATES = [
  {
    genres: ['pop', 'ballad', 'lofi', 'acoustic'],
    title: 'Neon Whispers',
    style: 'Aesthetic Lofi Pop with soothing vocals',
    lyrics: \`[Verse 1]
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
[Am] Fading out.\`
  },
  {
    genres: ['rock', 'edm', 'dance', 'upbeat'],
    title: 'Electric Energy',
    style: 'High-energy Electronic Dance Pop',
    lyrics: \`[Verse 1]
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
[Am] Tonight we fly.\`
  }
];

async function detectCountryByIp(ip) {
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
    const res = await fetch('http://ip-api.com/json/' + cleanIp, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.countryCode) return data.countryCode.toUpperCase();
    }
  } catch (err) { }
  return 'VN';
}

console.log('Script loaded OK - ' + content.length + ' chars');
`;

fs.writeFileSync('d:/nhac-ai/fix_lyrics_route.mjs', content, 'utf8');
console.log('Script written OK');
