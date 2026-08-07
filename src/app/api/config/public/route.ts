import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [

            'enable_reference_file',
            'enable_suno_connect',
            'enable_copyright_fallback_only',
            'enable_audio_bypass_engine',
            'remix_styles',
            'credits_per_1000_vnd',
            'credits_per_1_usd',
            'deposit_bank',
            'deposit_account_number',
            'deposit_account_name',
            'paypal_client_id',
            'paypal_mode',
            'audio_sample_rate',
            'audio_channels',
            'audio_peak_dbfs',
            'audio_loudness_lufs',
            'audio_crest_factor',
            'audio_cutoff_khz',
            'audio_lr_correlation',
            'audio_side_mid_ratio',
            'audio_vocal_retention',
            'audio_pitch_speed_shift',
            'audio_clean_id3'
          ]
        }
      }
    });

    const configMap = configs.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const defaultRemixStyles = JSON.stringify([
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
    ]);

    let creditsPer1000Vnd = configMap.credits_per_1000_vnd;
    if (!creditsPer1000Vnd || creditsPer1000Vnd === '1') {
      creditsPer1000Vnd = '9';
      await prisma.systemConfig.upsert({
        where: { key: 'credits_per_1000_vnd' },
        update: { value: '9' },
        create: { key: 'credits_per_1000_vnd', value: '9' }
      }).catch(() => {});
    }

    let creditsPer1Usd = configMap.credits_per_1_usd;
    if (!creditsPer1Usd || creditsPer1Usd === '25' || creditsPer1Usd === '225') {
      creditsPer1Usd = '110';
      await prisma.systemConfig.upsert({
        where: { key: 'credits_per_1_usd' },
        update: { value: '110' },
        create: { key: 'credits_per_1_usd', value: '110' }
      }).catch(() => {});
    }

    return NextResponse.json({
      enable_reference_file: configMap.enable_reference_file !== 'false', // default to true if not explicitly 'false'
      enable_suno_connect: configMap.enable_suno_connect !== 'false', // default to true if not explicitly 'false'
      remix_styles: configMap.remix_styles || defaultRemixStyles,
      credits_per_1000_vnd: creditsPer1000Vnd,
      credits_per_1_usd: creditsPer1Usd,
      deposit_bank: configMap.deposit_bank || '',
      deposit_account_number: configMap.deposit_account_number || '',
      deposit_account_name: configMap.deposit_account_name || '',
      paypal_client_id: configMap.paypal_client_id || 'sandbox',
      paypal_mode: configMap.paypal_mode || 'sandbox'
    });
  } catch (error) {
    console.error('GET /api/config/public error:', error);
    const defaultRemixStyles = JSON.stringify([
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
    ]);
    return NextResponse.json({
      enable_reference_file: true,
      enable_suno_connect: true,
      remix_styles: defaultRemixStyles
    });
  }
}
