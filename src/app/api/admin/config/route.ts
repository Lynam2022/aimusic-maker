export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Fields that must NEVER be sent back to the browser in plain text.
// They are write-only: shown as a redacted placeholder on the client.
const WRITE_ONLY_FIELDS = new Set([
  'google_client_secret',
  'r2_secret_access_key',
  'paypal_client_secret',
  'sepay_api_key',
  'gemini_api_key',
  'suno_cookie',
  'suno_token',
]);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const configs = await prisma.systemConfig.findMany();
    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    // Set defaults if empty
    const defaults = {
      google_client_id: '',
      google_client_secret: '',
      suno_cookie: '',
      suno_token: '',
      gemini_api_key: '',
      storage_type: 'local',
      storage_path: './uploads',
      r2_account_id: '',
      r2_access_key_id: '',
      r2_secret_access_key: '',
      r2_bucket_name: '',
      r2_public_domain: '',
      deposit_account_name: '',
      deposit_account_number: '',
      deposit_bank: '',
      vnd_exchange_rate: '1000',
      credits_per_1000_vnd: '1',
      credits_per_1_usd: '25',
      paypal_client_id: 'sandbox',
      paypal_client_secret: '',
      paypal_mode: 'sandbox',
      sepay_api_key: '',
      credits_per_song: '10',
      enable_reference_file: 'true',
      enable_suno_connect: 'true',
      enable_copyright_fallback_only: 'false',
      enable_audio_bypass_engine: 'true',
      audio_sample_rate: '48000',
      audio_channels: 'stereo',
      audio_peak_dbfs: '-0.79',
      audio_loudness_lufs: '-15.9',
      audio_crest_factor: '18.0',
      audio_cutoff_khz: '16.0',
      audio_lr_correlation: '0.82',
      audio_side_mid_ratio: '0.099',
      audio_vocal_retention: '90',
      audio_pitch_speed_shift: '4.5',
      audio_clean_id3: 'true',
      remix_styles: JSON.stringify([
        {
          id: "remix_1",
          name: "Vinahouse Remix 1",
          prompt: "Vinahouse remix Vietnam, nhạc remix TikTok miền Nam, pop-EDM 140 BPM, young Southern Vietnamese {gender} vocal, warm slightly husky timbre, heerful giọng miền Nam tự nhiên, moderate luyến láy smooth slides held vowels, bouncy syllable phrasing 16th-note groove, light airy breaths between phrases, bright upper-mid vocal presence cutting through dense mix, chorus effect widening stereo, long plate reverb open spatial feel, four-on-the-floor kick mono center, 808 sub-bass ultra-heavy mono aggressive sidechain maximum bounce nảy căng, bass pluck sharp snappy off-beat release, dense 16th hi-hat wide stereo pan left-right open hat upbeats, bright plucked synth folk melody staccato, bouncy arpeggio synth playful energy, wide stereo pad long reverb tail, energetic rộn ràng maximum bounce, Vietnamese Vinahouse ballad remix 140 BPM emotional yet energetic, no long melisma no sustained notes"
        },
        {
          id: "remix_2",
          name: "Remix 2 (Dance EDM)",
          prompt: "Dance EDM remix, high energy, electronic beats, synthesizer melody, fast tempo 128 BPM, clear {gender} vocal"
        }
      ])
    };

    const finalConfigs = { ...defaults, ...configMap };

    // Redact write-only secrets: send empty string so the UI shows "not set"
    // without leaking the real value to the browser.
    const safeConfigs = Object.fromEntries(
      Object.entries(finalConfigs).map(([k, v]) => [
        k,
        WRITE_ONLY_FIELDS.has(k) ? (v ? '••••••••' : '') : v
      ])
    );

    return NextResponse.json({ configs: safeConfigs });
  } catch (error: any) {
    console.error('GET /api/admin/config error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}



export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await request.json();
    const { configs } = body; // expect { key: value, ... }

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ error: 'Invalid configuration format' }, { status: 400 });
    }

    // Upsert configs — skip write-only placeholders so real secrets are never overwritten
    const REDACTED_PLACEHOLDER = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'; // ••••••••
    const filteredEntries = Object.entries(configs).filter(([key, val]) => {
      if (WRITE_ONLY_FIELDS.has(key) && String(val) === REDACTED_PLACEHOLDER) {
        return false; // skip — user didn't change the secret
      }
      return true;
    });

    await prisma.$transaction(
      filteredEntries.map(([key, val]) =>
        prisma.systemConfig.upsert({
          where: { key },
          update: { value: String(val) },
          create: { key, value: String(val) }
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Cấu hình hệ thống đã được cập nhật.' });
  } catch (error: any) {
    console.error('POST /api/admin/config error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
