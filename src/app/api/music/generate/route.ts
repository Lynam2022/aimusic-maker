export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteCache } from '@/lib/redis';
import { SunoClient } from '@/lib/suno';
import { checkIpRateLimit } from '@/lib/security';

export async function POST(request: NextRequest) {
  let songRecord: { id: string } | null = null;
  let prompt = '';
  let lyrics = '';
  let mode: 'lyrics' | 'describe' = 'describe';
  let outputType: 'vocal' | 'instrumental' = 'vocal';
  let vocalGender: 'auto' | 'female' | 'male' = 'auto';
  let style = '';
  let title = '';
  let finalStyle = '';
  let sunoModel = 'v3.5';

  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = await checkIpRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Tài khoản hoặc IP của bạn tạm thời bị khóa truy cập do gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${rateCheck.blockDuration} giây.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      bypassLyrics, styleWeight, creativity, audioQuality,
      negativeTags, referenceFile, referenceFileId, referenceFileType,
      referenceMode, continueAt, remixStyleId
    } = body;

    prompt = body.prompt || '';
    lyrics = body.lyrics || '';
    mode = (body.mode as 'lyrics' | 'describe') || 'describe';
    outputType = (body.outputType as 'vocal' | 'instrumental') || 'vocal';
    vocalGender = (body.vocalGender as 'auto' | 'female' | 'male') || 'auto';
    style = body.style || '';
    title = body.title || '';
    sunoModel = body.sunoModel || 'v3.5';

    finalStyle = style;
    if (sunoModel === 'remix' || remixStyleId) {
      const genderWord = vocalGender === 'male' ? 'male' : 'female';

      let remixPrompt = '';
      try {
        const remixStylesConfig = await prisma.systemConfig.findUnique({
          where: { key: 'remix_styles' }
        });
        if (remixStylesConfig && remixStylesConfig.value) {
          const styles = JSON.parse(remixStylesConfig.value);
          const matchedStyle = styles.find((s: any) => s.id === remixStyleId);
          if (matchedStyle && matchedStyle.prompt) {
            remixPrompt = matchedStyle.prompt;
          }
        }
      } catch (err) {
        console.error('Error loading remix styles from DB:', err);
      }

      if (!remixPrompt && sunoModel === 'remix') {
        remixPrompt = `Vinahouse remix Vietnam, nhạc remix TikTok miền Nam, pop-EDM 140 BPM, young Southern Vietnamese {gender} vocal, warm slightly husky timbre, heerful giọng miền Nam tự nhiên, moderate luyến láy smooth slides held vowels, bouncy syllable phrasing 16th-note groove, light airy breaths between phrases, bright upper-mid vocal presence cutting through dense mix, chorus effect widening stereo, long plate reverb open spatial feel, four-on-the-floor kick mono center, 808 sub-bass ultra-heavy mono aggressive sidechain maximum bounce nảy căng, bass pluck sharp snappy off-beat release, dense 16th hi-hat wide stereo pan left-right open hat upbeats, bright plucked synth folk melody staccato, bouncy arpeggio synth playful energy, wide stereo pad long reverb tail, energetic rộn ràng maximum bounce, Vietnamese Vinahouse ballad remix 140 BPM emotional yet energetic, no long melisma no sustained notes`;
      }

      if (remixPrompt) {
        finalStyle = remixPrompt
          .replace(/{gender}/g, genderWord)
          .replace(/{genderWord}/g, genderWord);
      }
    }

    // ── Auth check (allow guest if no session) ─────────────
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          credits: true,
          storageLimit: true,
          _count: {
            select: { songs: true }
          }
        }
      });

      if (!user) {
        return NextResponse.json({ error: 'Người dùng không tồn tại.' }, { status: 404 });
      }

      if (user.credits < 10) {
        return NextResponse.json({ error: 'Không đủ credits. Vui lòng nạp thêm.' }, { status: 402 });
      }

      // Deduct credits + create song record atomically
      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            credits: { decrement: 10 },
            totalSpent: { increment: 10 }
          }
        });

        const song = await tx.song.create({
          data: {
            userId,
            prompt: sunoModel === 'remix' ? '' : prompt,
            lyrics,
            mode,
            outputType,
            vocalGender,
            musicStyle: finalStyle,
            songTitle: title,
            status: 'queued',
            creditsCost: 10,
            sunoModel
          }
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'debit',
            amount: 10,
            balance: updatedUser.credits,
            note: referenceMode === 'cover'
              ? `Tạo nhạc Cover: ${title || prompt?.substring(0, 40) || 'Custom Cover'}`
              : `Tạo nhạc: ${prompt?.substring(0, 50) || title || 'Custom lyrics'}`,
            songId: song.id
          }
        });

        return { song, newBalance: updatedUser.credits };
      });

      songRecord = result.song;

      // Invalidate credits cache asynchronously to prevent Redis connection issues from blocking DB commits
      deleteCache(`user:credits:${userId}`).catch((err) => {
        console.error('[Redis] Invalidate cache error:', err.message);
      });
    }

    let generateResult: { taskId: string; warning?: string };
    try {
      generateResult = await SunoClient.generate({
        prompt,
        lyrics,
        bypassLyrics,
        mode,
        outputType,
        vocalGender,
        style: finalStyle,
        title,
        styleWeight,
        creativity,
        audioQuality,
        negativeTags,
        sunoModel,
        referenceFile,
        referenceFileId,
        referenceFileType,
        referenceMode,
        continueAt,
        userId: userId ?? undefined,
      });
    } catch (genErr: unknown) {
      const genErrMsg = genErr instanceof Error ? genErr.message : String(genErr);
      // Attempt 8 (server-side only): Browser CDP fallback khi Turnstile block
      if (genErrMsg.startsWith('CDP_REQUIRED:')) {
        console.log('[Route] Attempt 8: Browser CDP fallback (server-side)...');
        try {
          const { generateViaBrowser } = await import('@/lib/suno-browser');
          const browserResult = await generateViaBrowser({
            model: sunoModel || 'chirp-fenix',
            customMode: mode === 'lyrics',
            lyrics: lyrics || undefined,
            tags: finalStyle || undefined,
            title: title || undefined,
            makeInstrumental: outputType === 'instrumental',
          });
          console.log('[Route] ✨ Attempt 8 (Browser CDP) succeeded!');
          generateResult = { taskId: browserResult.taskId };
        } catch (browserErr: unknown) {
          const browserMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
          if (browserMsg.includes('rate_limited') || browserMsg.includes('429')) {
            console.error('[Route] CDP rate_limited:', browserMsg);
            throw new Error('Suno đang giới hạn request. Vui lòng đợi 2-3 phút rồi thử lại.');
          } else {
            console.error('[Route] CDP failed:', browserMsg);
            throw new Error('Suno API yêu cầu cập nhật xác thực. Vui lòng cập nhật lại Suno Cookie trong trang Admin.');
          }
        }


      } else {
        throw genErr; // re-throw non-CDP errors
      }
    }
    const { taskId, warning } = generateResult!

    // Update song with taskId if we have a DB record
    if (songRecord && userId) {
      await prisma.song.update({
        where: { id: songRecord.id },
        data: { taskId, status: 'processing' }
      });
    }

    return NextResponse.json({
      success: true,
      taskId,
      songId: songRecord?.id ?? null,
      ...(warning ? { warning } : {}),
    });

  } catch (error: unknown) {
    console.error('POST /api/music/generate error:', error);
    const rawErrMsg = error instanceof Error ? error.message : 'Internal Server Error';

    const session = await getServerSession(authOptions).catch(() => null);
    const uId = session?.user?.id;

    // 1. Record failed status and raw error detail into database for Admin Error Tracing
    if (songRecord) {
      await prisma.song.update({
        where: { id: songRecord.id },
        data: {
          status: 'failed',
          errorMsg: rawErrMsg
        }
      }).catch(err => console.error('[Generate API] Failed to update song errorMsg:', err));
    } else if (uId) {
      await prisma.song.create({
        data: {
          userId: uId,
          prompt: prompt || '',
          lyrics: lyrics || '',
          mode: mode || 'describe',
          outputType: outputType || 'vocal',
          vocalGender: vocalGender || 'auto',
          musicStyle: finalStyle || style || '',
          songTitle: title || 'Mây Của Anh',
          status: 'failed',
          creditsCost: 10,
          errorMsg: rawErrMsg,
          sunoModel: sunoModel || 'v3.5'
        }
      }).catch(err => console.error('[Generate API] Failed to create failed song log:', err));
    }

    // 2. Refund credits if deducted
    if (uId && songRecord) {
      try {
        const user = await prisma.user.update({
          where: { id: uId },
          data: { credits: { increment: 10 }, totalSpent: { decrement: 10 } }
        });
        await prisma.transaction.create({
          data: {
            userId: uId,
            type: 'refund',
            amount: 10,
            balance: user.credits,
            // Chỉ lưu message thân thiện, không expose technical details cho user
            note: `Hoàn credits - Yêu cầu tạo nhạc không thành công.`
          }
        });
        await deleteCache(`user:credits:${uId}`);
      } catch (err) {
        console.error('[Generate API] Refund error:', err);
      }
    }

    let userFacingMsg: string;
    if (rawErrMsg.includes('Browser Token') || rawErrMsg.includes('cookie') || rawErrMsg.includes('token_validation_failed') || rawErrMsg.includes('Unauthorized') || rawErrMsg.includes('verify your request') || rawErrMsg.includes('401')) {
      userFacingMsg = 'Suno Cookie đã hết hạn phiên làm việc (401 Unauthorized). Vui lòng mở suno.com đăng nhập lại và lấy Cookie mới cập nhật trong trang Admin.';
    } else {
      userFacingMsg = rawErrMsg;
    }

    return NextResponse.json(
      { error: userFacingMsg },
      { status: 400 }
    );
  }
}
