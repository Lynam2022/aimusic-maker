import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface AudioProcessOptions {
  pitchShift?: number; // e.g. 1.8
  tempoShift?: number; // e.g. 1.08
  maxDuration?: number; // e.g. 30
  useEcho?: boolean;
  startOffset?: number; // start crop offset in seconds
  bitcrushEnabled?: boolean;
  bitcrushBits?: number;
  bitcrushSampleRate?: number;
  lossyEnabled?: boolean;
  lossyBitrate?: string; // e.g. '128k', '96k'
  useModulation?: boolean;
  useFilters?: boolean;
  useNoise?: boolean;
  useSubBass?: boolean;
  useFreqShift?: boolean;
  // ── Group 1: Audio Transcoder ──────────────────────────────────────────────
  /** Codec Hopping: encode through OGG Vorbis after the MP3 lossy roundtrip */
  codecHoppingEnabled?: boolean;
  /** OGG Vorbis quality gate for the codec-hop step (0-10, default 1) */
  oggQuality?: number;
  /** Sample Rate Ladder: cascade resample 44100→22050→48000→32000→44100 */
  sampleRateLadderEnabled?: boolean;
  // ── Group 2: Audio Effect Processor ────────────────────────────────────────
  /** Harmonic Exciter: synthesise 2nd/3rd harmonics to alter chromagram signature */
  useHarmonicExciter?: boolean;
  /** Harmonic exciter drive amount (0-100, default 22) */
  harmonicExciterAmount?: number;
  /** M/S Stereo Processing: apply a subtle phase rotation to the Side channel only */
  useMidSideProcessing?: boolean;
  /** Spectral Smearing: dual cascaded short-echo (8ms + 14ms) to blur transient onsets */
  useSpectralSmearing?: boolean;
  /** De-Esser / Allpass Phase Sweep to disrupt spectrogram landmark anchors */
  useDeEsser?: boolean;
  // ── ASR Lyrics Bypass ──────────────────────────────────────────────────────
  /**
   * When false (default is true), rubberband will NOT preserve vocal formants during
   * pitch-shifting. This warps the vocal tract characteristics making the voice
   * unrecognisable to Suno’s ASR lyrics detection engine.
   * Set to false for aggressive ASR bypass.
   */
  preserveFormant?: boolean;
  /**
   * Vocal distortion via vibrato: blurs phoneme boundaries so that ASR
   * cannot reliably segment individual words. Uses a 3.5 Hz vibrato at
   * configurable depth (0.0–1.0, default 0.12 = moderate blur).
   */
  useVocalDistortion?: boolean;
  /** Vibrato depth for vocal distortion (0.0-1.0, default 0.12) */
  vocalDistortionDepth?: number;
  /**
   * Vocal Center Suppression (karaoke L–R subtraction).
   * In commercial stereo music, lead vocals are center-panned (equal in L+R).
   * Subtracting a fraction of the opposite channel removes center-panned content,
   * drastically reducing vocal level for ASR. strength=0.5 removes ~50% of vocals.
   * Combined with phase inversion of the right channel in a single pan filter.
   */
  useVocalSuppression?: boolean;
  /** Suppression coefficient 0.0-0.7 (default 0.5). Higher = more vocals removed. */
  vocalSuppressionStrength?: number;
  /**
   * Heavy multi-voice chorus: creates 4 ghost voices at 50-100ms delays with
   * independent speeds. ASR relies on stable vocal onsets; a 4-voice choir effect
   * completely destroys the single-voice temporal structure that Whisper depends on.
   */
  useHeavyChorus?: boolean;
  /**
   * Full Karaoke Vocal Removal — strongest ASR bypass.
   * Applies center-channel extraction (L-R, L-R) to completely remove
   * center-panned vocals from stereo audio. In commercial pop/Vietnamese
   * music, lead vocals are virtually always mixed center, so this leaves
   * a clean instrumental track that Suno's ASR cannot match to any lyrics.
   * Note: also removes center-panned bass/kick; compensate with bassCompensationGain.
   */
  useFullVocalRemoval?: boolean;
  /**
   * EQ gain (dB) applied at ~100Hz after vocal removal to restore bass
   * lost by the L-R subtraction. Typical useful range: 3–8 dB. Default 5.
   */
  bassCompensationGain?: number;
  /**
   * High-Fidelity Bypass: Band-Split Delay.
   * Splits audio into Bass, Mid, and Treble. Delays bass by 15ms and treble by 10ms.
   * Invisible to human hearing (sounds like a very tiny stereo widening),
   * but completely destroys transient alignment in spectrograms.
   */
  useBandSplitDelay?: boolean;
  /**
   * Use asetrate instead of rubberband for pitch/tempo shift.
   * This ties pitch and tempo together (analog turntable style)
   * but eliminates all digital phase smearing, resulting in crystal clear audio.
   */
  useAnalogPitchTempo?: boolean;
}


// ---------------------------------------------------------------------------
// Internal helper – runs a single FFmpeg command and resolves/rejects.
// ---------------------------------------------------------------------------
function runFfmpeg(args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`[AudioProcessor] ${label} completed.`);
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}: ${stderr}`));
      }
    });
    proc.on('error', reject);
  });
}

/**
 * Pre-processes an audio file to crop duration, shift pitch, adjust tempo,
 * and apply multiple layered acoustic filters to bypass Suno's copyright detection mechanisms.
 * Supports bitcrushing, lossy compression roundtrips, codec hopping and sample-rate laddering.
 */
export function processAudio(
  inputPath: string,
  outputPath: string,
  options: AudioProcessOptions
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let currentInputPath = inputPath;

    // All temp files are tracked here for guaranteed cleanup in the finally block.
    const tempPaths: string[] = [];
    const makeTempPath = (suffix: string): string => {
      const tempDir = path.dirname(outputPath);
      const rand = crypto.randomBytes(8).toString('hex');
      const p = path.join(tempDir, `_tmp_${rand}${suffix}`);
      tempPaths.push(p);
      return p;
    };

    try {
      // â”€â”€ Stage 1: Lossy MP3 roundtrip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Encodes to a temporary MP3 to introduce the characteristic lossy
      // frequency-shelf artifacts of LAME / MP3 codec before main processing.
      if (options.lossyEnabled) {
        const tempMp3 = makeTempPath('.mp3');
        await runFfmpeg([
          '-y',
          '-i', currentInputPath,
          '-map', '0:a',        // audio-only: discard embedded cover art / PNG streams
          '-vn',                // no video output (belt-and-braces)
          '-b:a', options.lossyBitrate || '128k',
          '-map_metadata', '-1',
          '-fflags', '+bitexact',
          tempMp3,
        ], `Lossy MP3 roundtrip @ ${options.lossyBitrate || '128k'}`);
        currentInputPath = tempMp3;
      }

      // â”€â”€ Stage 2: Codec Hopping â€“ OGG Vorbis intermediate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Chains a second lossy encode through OGG Vorbis (distinct psychoacoustic
      // model from MP3), then decodes back to lossless PCM. The layered artifact
      // patterns from two different codecs heavily disrupt spectrogram fingerprints
      // while remaining largely inaudible.
      if (options.codecHoppingEnabled) {
        const quality = options.oggQuality ?? 1; // 0-10; q=1 â‰ˆ ~80 kbps VBR
        const tempOgg = makeTempPath('.ogg');
        const tempOggDecoded = makeTempPath('_decoded.flac');

        // Step A â€“ encode to OGG Vorbis at low quality
        await runFfmpeg([
          '-y',
          '-i', currentInputPath,
          '-map', '0:a',        // audio-only
          '-vn',
          '-c:a', 'libvorbis',
          '-q:a', String(quality),
          '-map_metadata', '-1',
          '-fflags', '+bitexact',
          tempOgg,
        ], `Codec Hop â€“ OGG Vorbis encode q=${quality}`);

        // Step B â€“ decode OGG back to lossless so the main stage reads raw PCM
        await runFfmpeg([
          '-y',
          '-i', tempOgg,
          '-map', '0:a',
          '-vn',
          '-c:a', 'flac',
          '-map_metadata', '-1',
          '-fflags', '+bitexact',
          tempOggDecoded,
        ], 'Codec Hop â€“ OGG decode to PCM/FLAC');

        currentInputPath = tempOggDecoded;
      }

      // â”€â”€ Stage 3: Main FFmpeg processing (filter graph + output) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const args: string[] = ['-y'];

      // Crop / start-offset. Default 3 s skips common intro fingerprints.
      const start = options.startOffset !== undefined ? options.startOffset : 3;
      args.push('-ss', `${start}`);
      if (options.maxDuration) {
        args.push('-t', `${options.maxDuration}`);
      }
      args.push('-i', currentInputPath);

      // â”€â”€ Build Audio Filter Chain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const filters: string[] = [];

      // Normalise to 44 100 Hz at the start of the chain
      filters.push('aresample=44100');

      // â”€â”€ Sample Rate Ladder (Ká»¹ thuáº­t 1.2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Cascade-resample through 4 distinct intermediate rates. Each resample at
      // a non-integer multiple introduces unique interpolation artifacts (aliasing,
      // ringing) that collectively destroy the original spectrogram fingerprint
      // without producing audible artefacts at the restored 44 100 Hz output.
      if (options.sampleRateLadderEnabled) {
        console.log('[AudioProcessor] Applying Sample Rate Ladder: 44100â†’22050â†’48000â†’32000â†’44100');
        filters.push('aresample=22050:resampler=swr:precision=16'); // halve  â€“ HF alias
        filters.push('aresample=48000:resampler=swr:precision=16'); // upsample â€“ interpolation noise
        filters.push('aresample=32000:resampler=swr:precision=16'); // downsample â€“ more aliasing
        filters.push('aresample=44100:resampler=swr:precision=16'); // restore to target rate
      }

      // Bitcrushing (sample-rate + bit-depth reduction)
      if (options.bitcrushEnabled) {
        const crushRate = options.bitcrushSampleRate || 32000;
        const crushBits = options.bitcrushBits || 8;
        console.log(`[AudioProcessor] Applying Bitcrusher: ${crushBits}-bit @ ${crushRate}Hz`);
        filters.push(`aresample=${crushRate}`);
        filters.push(`acrusher=bits=${crushBits}:mix=0.25:mode=log:aa=0.5:samples=1`);
      }

      // Pitch & Tempo
      const semitones = options.pitchShift || 0;
      const tempo = options.tempoShift || 1.0;
      if (options.useAnalogPitchTempo) {
        // Analog turntable style: ties pitch and tempo together via sample rate conversion.
        // Zero digital artifacts, crystal clear transients, no phase smearing.
        const newRate = Math.round(44100 * tempo);
        console.log(`[AudioProcessor] Analog Pitch/Tempo (asetrate): rate=${newRate}Hz (tempo=${tempo})`);
        filters.push(`asetrate=${newRate}`);
      } else if (semitones !== 0 || tempo !== 1.0) {
        // Rubberband phase vocoder
        const pitchRatio = Math.pow(2, semitones / 12);
        const formantFlag = options.preserveFormant !== false ? ':formant=preserved' : '';
        console.log(`[AudioProcessor] Rubberband: pitch=${semitones}st tempo=${tempo} formant=${options.preserveFormant !== false ? 'preserved' : 'SHIFTED'}`);
        filters.push(`rubberband=pitch=${pitchRatio.toFixed(4)}:tempo=${tempo.toFixed(4)}${formantFlag}`);
      }

      // Linear Frequency Shift (constant Hz offset)
      if (options.useFreqShift) {
        const freqShift = 3; // 3 Hz shift is completely inaudible to humans, but breaks FFT peak matching
        filters.push(`afreqshift=shift=${freqShift}`);
      }

      // ── ASR Bypass: Vocal Distortion (phoneme blur) ───────────────────────
      // A moderate vibrato at 3.5 Hz creates pitch micro-oscillations at the
      // phoneme level. ASR engines rely on stable formant trajectories to
      // distinguish phonemes (e.g. /i/ vs /e/). At 12% depth the vibrato
      // is subtle to the ear but introduces enough jitter to make ASR fail
      // on individual words, especially consonants and vowel transitions.
      if (options.useVocalDistortion) {
        const depth = Math.min(options.vocalDistortionDepth ?? 0.12, 0.5);
        console.log(`[AudioProcessor] Applying Vocal Distortion (vibrato 3.5Hz depth=${depth})`);
        filters.push(`vibrato=f=3.5:d=${depth.toFixed(2)}`);
      }

      // ── Group 2.1: Harmonic Exciter ──────────────────────────────────────
      // Synthesises 2nd/3rd harmonic overtones above the cut frequency.
      // Changes the energy ratio between harmonics, altering the chromagram
      // "note signature" used by Shazam / ACRCloud fingerprinting.
      // NOTE: FFmpeg aexciter params are: freq, level_in, level_out, amount, drive, blend, ceil, listen
      //       "harmonics" is NOT a valid param – use "drive" for saturation control.
      if (options.useHarmonicExciter) {
        const amount = Math.min(options.harmonicExciterAmount ?? 22, 50);
        console.log(`[AudioProcessor] Applying Harmonic Exciter: amount=${amount}`);
        filters.push(`aexciter=freq=3200:level_in=1:level_out=1:amount=${amount}:drive=8.5:blend=0.35`);
      }

      // ── Group 2.2: Stereo Field Pulsation (replaces stereotools) ─────────
      // Applies a very slow sinusoidal LFO on stereo width at 0.2 Hz (~5 s cycle)
      // at 1.5% modulation depth. ContentID fingerprinters typically mono-sum;
      // shifting the stereo image changes the mono sum without audible artifacts.
      // apulsator is a reliable built-in FFmpeg filter with no external deps.
      if (options.useMidSideProcessing) {
        console.log('[AudioProcessor] Applying Stereo Field Pulsation (apulsator)');
        filters.push('apulsator=mode=sine:timing=hz:hz=0.2:amount=0.015:offset_l=0:offset_r=0.5');
      }

      // ── Group 2.3: Spectral Smearing (dual short-echo convolution) ────────
      // Two cascaded micro-echoes (8 ms + 14 ms) smear transient onsets,
      // causing onset-timestamp fingerprinting to fail while remaining
      // completely inaudible as reverb (wet mix ≤ 10%).
      if (options.useSpectralSmearing) {
        console.log('[AudioProcessor] Applying Spectral Smearing (8ms + 14ms echoes)');
        filters.push('aecho=0.86:0.70:8:0.10');
        filters.push('aecho=0.82:0.66:14:0.06');
      }

      // ── Group 2.4: Phase Allpass Sweep (aphaser) ──────────────────────────
      // A slow all-pass phase sweep at 0.3 Hz shifts the phase of all frequency
      // bins continuously. Since perceptual fingerprinting is phase-sensitive
      // at the spectrogram level, this disrupts the landmark anchor points.
      if (options.useDeEsser) {
        console.log('[AudioProcessor] Applying Allpass Phase Sweep (aphaser)');
        filters.push('aphaser=in_gain=0.9:out_gain=0.9:delay=3:decay=0.4:speed=0.3:type=t');
      }

      // Slowed & Reverb: Spacious echo to blur vocals and add Lofi aesthetic
      if (options.useEcho) {
        console.log('[AudioProcessor] Applying Reverb/Echo (Slowed & Reverb style)');
        // 400ms delay, 40% wet mix, 88% decay -> smooth wide space
        filters.push('aecho=0.8:0.88:400:0.4');
      }

      // High-pass / Low-pass EQ
      if (options.useFilters) {
        filters.push('highpass=f=75');
        filters.push('lowpass=f=15000');
      }

      // ── ASR: Multi-Voice Chorus ────────────────────────────────────────────
      // Creates 3 ghost voices at 50ms/70ms/95ms – turns one voice into a trio.
      // 3 voices provides enough ASR confusion while sounding less muddy than 4.
      // in_gain=0.80, out_gain=0.80 prevents clipping on dense mixes.
      if (options.useHeavyChorus) {
        console.log('[AudioProcessor] Applying Multi-Voice Chorus (3 voices)');
        filters.push('chorus=0.80:0.80:50|70|95:0.75|0.65|0.55:0.15|0.18|0.12:2|3|1');
      }

      // ── Vocal Treatment (pan filter – choose one mode) ────────────────────
      // Priority: Full Removal > Weighted Suppression > Standard Phase Inversion
      if (options.useFullVocalRemoval) {
        // ── Mode 1: Full Karaoke Vocal Removal ────────────────────────────
        // L-R subtraction removes center vocals, copied to both channels to keep them in phase
        console.log('[AudioProcessor] Full Karaoke Vocal Removal (L-R extraction, phase-aligned)');
        filters.push('pan=stereo|c0=c0-c1|c1=c0-c1');

        // Bass restoration: L-R fully removes center-panned bass. Boost low end.
        const bassGain = options.bassCompensationGain ?? 6;
        console.log(`[AudioProcessor] Bass Compensation: +${bassGain}dB @ 100Hz`);
        filters.push(`equalizer=f=100:width_type=o:width=1.5:g=${bassGain}`);
        // Presence boost: restore midrange clarity after vocal removal
        filters.push('equalizer=f=3000:width_type=o:width=1.2:g=2');

      } else if (options.useVocalSuppression) {
        // ── Mode 2: Weighted Vocal Suppression (partial L-R) ──────────────
        // Partially reduces center-panned content, keeping channels in phase.
        const s = Math.min(options.vocalSuppressionStrength ?? 0.5, 0.7);
        console.log(`[AudioProcessor] Vocal Center Suppression: ${(s * 100).toFixed(0)}% (phase-aligned)`);
        filters.push(`pan=stereo|c0=c0-${s.toFixed(2)}*c1|c1=c1-${s.toFixed(2)}*c0`);

        // Bass restoration: partial suppression also reduces center-panned bass.
        if (options.bassCompensationGain && options.bassCompensationGain > 0) {
          const bg = options.bassCompensationGain;
          console.log(`[AudioProcessor] Bass Compensation: +${bg}dB @ 100Hz`);
          filters.push(`equalizer=f=100:width_type=o:width=1.5:g=${bg}`);
          // Subtle presence boost to restore midrange clarity
          filters.push('equalizer=f=3000:width_type=o:width=1.2:g=1.5');
        }

      } else {
        // ── Mode 3: Passthrough ───────────────────────────────────────────
        // Rely on other effects (aphaser, apulsator) for fingerprint bypass without phase cancellation.
        filters.push('pan=stereo|c0=c0|c1=c1');
      }

      // Volume compensation
      if (options.useFilters || options.useModulation || options.bitcrushEnabled
          || options.useVocalSuppression || options.useFullVocalRemoval) {
        filters.push('volume=5dB');
      }

      // Final normalisation back to 44 100 Hz
      filters.push('aresample=44100');

      // ── Build complex filter graph ──────────────────────────────────────────
      const filterStr = filters.length > 0 ? filters.join(',') : 'anull';
      let filterGraph: string;
      let graph = '';
      let mainOut = '[vocal_proc]';

      if (options.useBandSplitDelay) {
        console.log('[AudioProcessor] Applying Band-Split Delay (Bass +15ms, Treble +10ms)');
        graph += `[0:a] ${filterStr} [pre]; `;
        // Split into 3 streams
        graph += `[pre] asplit=3 [b1][b2][b3]; `;
        // Bass: < 200 Hz, delayed by 15ms
        graph += `[b1] lowpass=f=200,adelay=15|15 [low]; `;
        // Mids: 200 Hz - 3000 Hz, no delay
        graph += `[b2] highpass=f=200,lowpass=f=3000 [mid]; `;
        // Treble: > 3000 Hz, delayed by 10ms
        graph += `[b3] highpass=f=3000,adelay=10|10 [high]; `;
        // Mix them back together. amix reduces volume by 1/N (so 1/3 for 3 inputs). 
        // We use volume=3 to restore the original level.
        graph += `[low][mid][high] amix=inputs=3:duration=longest,volume=3 [vocal_proc]; `;
      } else {
        graph += `[0:a] ${filterStr} [vocal_proc]; `;
      }

      if (options.useNoise || options.useSubBass) {
        const mixInputs: string[] = [mainOut];
        if (options.useNoise) {
          graph += `anoisesrc=d=${options.maxDuration || 300}:c=pink:r=44100:amplitude=0.01,pan=stereo|c0=c0|c1=c0 [noise]; `;
          mixInputs.push('[noise]');
        }
        if (options.useSubBass) {
          const subFreq = Math.floor(45 + Math.random() * 8);
          graph += `sine=f=${subFreq}:r=44100:d=${options.maxDuration || 300},volume=0.015,pan=stereo|c0=c0|c1=c0 [sub_bass]; `;
          mixInputs.push('[sub_bass]');
        }
        graph += `${mixInputs.join('')} amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0 [out]`;
        filterGraph = graph;
      } else {
        graph += `${mainOut} aformat=sample_rates=44100 [out]`;
        filterGraph = graph;
      }

      args.push('-filter_complex', filterGraph);
      args.push('-map', '[out]');
      args.push('-map_metadata', '-1');
      args.push('-fflags', '+bitexact');
      args.push('-write_id3v1', '0');
      args.push('-id3v2_version', '0');
      args.push(outputPath);

      console.log(`[AudioProcessor] Spawning main FFmpeg: ffmpeg ${args.join(' ')}`);
      await runFfmpeg(args, 'Main FFmpeg processing');
      resolve();

    } catch (err) {
      reject(err);
    } finally {
      // Clean up every temporary file regardless of success or failure
      for (const p of tempPaths) {
        if (p && fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (_) {}
        }
      }
    }
  });
}
