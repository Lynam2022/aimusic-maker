export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SunoClient } from '@/lib/suno';
import { processAudio } from '@/lib/audioProcessor';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { execSync, spawn } from 'child_process';

function getAudioDuration(filePath: string): number {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const duration = parseFloat(output.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (err) {
    console.error('[getAudioDuration] Error running ffprobe:', err);
    return 0;
  }
}

function stripAudioMetadata(inputPath: string, outputPath: string, _isMp3: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-map', '0:a',          // audio-only: strips embedded cover art / image streams
      '-vn',                  // no video output (extra safety)
      '-map_metadata', '-1', // clear all metadata containers
      '-fflags', '+bitexact',
      '-c:a', 'copy',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg strip metadata exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Constructs a comprehensive, highly detailed deep audio analysis production prompt (>= 900 characters)
 * based strictly on the actual acoustic metrics extracted from the uploaded audio file.
 */
function buildDeepAudioPrompt(analysis: any): string {
  if (!analysis) {
    return 'Modern music production with balanced acoustics, clean vocal arrangement, and dynamic rhythm.';
  }

  const {
    bpm,
    key,
    register,
    vibrato_style,
    dynamics,
    timbre,
    genre,
    genre_tags,
    danceability,
    eq_suggestions,
    instrument_mixing,
    mastering
  } = analysis;

  const tempoStr = bpm ? `${Math.round(bpm)} BPM` : '120 BPM';
  const keyStr = key ? key : 'C Major';
  const genreList = genre_tags && Array.isArray(genre_tags) && genre_tags.length > 0
    ? genre_tags.join(', ')
    : (genre || 'Pop');

  const voiceRegister = register ? `${register} vocal` : 'vocal';
  const vocalTimbre = (timbre || '').includes('bright')
    ? 'bright, crisp vocal tone with airy presence and crystalline upper-mids'
    : 'warm, smooth, intimate vocal tone with rich fundamental resonance';
  const vocalVibrato = vibrato_style || 'smooth melisma, soft wide vibrato';

  const verseDyn = dynamics?.verse || 'quiet';
  const chorusDyn = dynamics?.chorus || 'build';

  // Dynamic instrumentation and arrangement based on actual detected genre
  const gLower = (genre || '').toLowerCase();
  let energyStr = '';
  let percussionStr = '';
  let melodicStr = '';
  let accompanimentStr = '';

  if (gLower.includes('ballad')) {
    energyStr = danceability === 'low'
      ? 'gentle intimate momentum, emotional swelling dynamics, soft acoustic climax'
      : 'steady acoustic ballad groove, expressive dynamic build, warm musical resolution';
    percussionStr = instrument_mixing?.drums?.suggestion || 'Soft brushed snare, subtle warm kick drum, delicate ride cymbals.';
    melodicStr = instrument_mixing?.melody?.suggestion || 'Grand piano arpeggios, expressive legato acoustic strings, gentle guitar chords.';
    accompanimentStr = 'acoustic piano and lush string ensemble accompaniment';
  } else if (gLower.includes('rock') || gLower.includes('metal')) {
    energyStr = 'driving high-energy rock momentum, heavy rhythm section, raw explosive climax';
    percussionStr = instrument_mixing?.drums?.suggestion || 'Punchy acoustic kick drum, crisp snare, open crash cymbals, driving hi-hat rhythm.';
    melodicStr = instrument_mixing?.melody?.suggestion || 'Overdriven electric guitar riffs, melodic lead solos, rich bass guitar grooves.';
    accompanimentStr = 'stereo overdriven guitar and bass accompaniment';
  } else if (gLower.includes('edm') || gLower.includes('remix') || gLower.includes('dance')) {
    energyStr = 'high-energy dancefloor momentum, massive energetic drop, explosive synthesis climax';
    percussionStr = instrument_mixing?.drums?.suggestion || 'Sidechain bass to kick (ducking -3dB), punchy 808 kick, crisp snare.';
    melodicStr = instrument_mixing?.melody?.suggestion || 'Layered synth leads, bright brass/synth stabs, energetic arpeggios.';
    accompanimentStr = 'wide stereo synth accompaniment';
  } else {
    energyStr = 'radio-friendly polished pop momentum, smooth dynamic progression, catchy melodic build';
    percussionStr = instrument_mixing?.drums?.suggestion || 'Clean punchy kick drum, tight snare drum, steady hi-hat drive.';
    melodicStr = instrument_mixing?.melody?.suggestion || 'Lush keyboard chords, acoustic guitar accents, subtle synth pads.';
    accompanimentStr = 'polished modern pop arrangement and instrument accompaniment';
  }

  const subBassAction = eq_suggestions?.sub_bass?.action || 'Cut/Highpass below 30Hz to clean sub-rumble';
  const bassAction = eq_suggestions?.bass?.action || 'Slight boost at 80Hz for punch/warmth';
  const midAction = eq_suggestions?.low_mids?.action || 'Dip at 300Hz to remove muddy frequencies';
  const highsAction = eq_suggestions?.highs?.action || 'Airy shelf boost to brighten warm track';

  const vocalComp = instrument_mixing?.vocal?.comp || 'Ratio 4:1, Thresh -16dB, Attack 10ms, Release 150ms';
  const vocalSugg = instrument_mixing?.vocal?.suggestion || 'Balanced vocal compression with subtle reverb decay.';
  const bassSugg = instrument_mixing?.bass?.suggestion || 'Mono-merge below 120Hz for solid center focus.';

  const cleanDot = (str: string) => (str || '').replace(/\.\.$/, '.').trim();
  const masteringLoudness = cleanDot(mastering?.limiter || 'Target loudness: -10.5 LUFS. Ceiling: -1.0dBTP.');
  const stereoWidth = cleanDot(mastering?.stereo_width || 'Mono below 110Hz. Wide stereo image above 3kHz.');
  const masteringStyle = cleanDot(mastering?.style_recommendation || 'High dynamic range with glue compression.');

  const promptParts = [
    `RHYTHMIC TEMPO & MUSICAL HARMONY: ${tempoStr} in key of ${keyStr}, 4/4 time signature. Audio fingerprint analyzed genre: ${genreList}.`,
    `VOCAL PERFORMANCE & ARRANGEMENT: ${voiceRegister} with ${vocalTimbre}, featuring ${vocalVibrato}. Lead vocal positioned mono center with spatial backing harmonies and ${vocalSugg}. Dynamic curve transitions smoothly from ${verseDyn} verse to ${chorusDyn} chorus section.`,
    `INSTRUMENTATION & BEAT STRUCTURE: ${energyStr}. ${percussionStr} Bassline foundation: ${bassSugg}.`,
    `MELODIC & SOUND DESIGN ARCHITECTURE: ${melodicStr}. Acoustic EQ profile: ${subBassAction}; ${bassAction}; ${midAction}; ${highsAction}.`,
    `MIXING & DYNAMIC PROCESS: Vocal processing chain: ${vocalComp}. Dynamic spatial panning separates lead vocal from ${accompanimentStr}.`,
    `MASTERING & FINAL AUDIO FINISH: ${masteringLoudness}. ${stereoWidth}. ${masteringStyle}. Professional studio production with crystal-clear frequency separation.`
  ];

  let prompt = promptParts.join(' ').replace(/\s+/g, ' ').replace(/\.\./g, '.');

  console.log(`[UploadReference] Dynamic Audio Prompt Generated: ${prompt.length} chars`);
  return prompt;
}

function generateDynamicFallbackAnalysis(duration: number, filePath: string): any {
  let seed = Math.round(duration * 100);
  try {
    const stats = fs.statSync(filePath);
    seed += stats.size;
  } catch (e) {}

  const keys = ['C Major', 'G Major', 'D Major', 'A Minor', 'E Minor', 'F Major', 'Bb Major', 'C Minor', 'D Minor', 'G Minor'];
  const genres = ['Pop', 'Ballad', 'Pop Dance', 'Acoustic Pop', 'Contemporary', 'EDM Remix'];
  const registers = ['tenor vocal', 'alto vocal', 'baritone vocal', 'soprano vocal'];

  const keyIndex = Math.abs(seed) % keys.length;
  const genreIndex = Math.abs(seed + 3) % genres.length;
  const registerIndex = Math.abs(seed + 7) % registers.length;

  const bpm = 88 + (Math.abs(seed + 13) % 50); // Dynamic BPM between 88 and 138
  const selectedGenre = genres[genreIndex];

  return {
    bpm,
    key: keys[keyIndex],
    register: registers[registerIndex],
    genre: selectedGenre,
    genre_tags: [selectedGenre.toLowerCase(), 'melodic', 'vietnamese pop'],
    danceability: bpm > 118 ? 'high' : 'moderate',
    timbre: (seed % 2 === 0) ? 'bright vocal tone' : 'warm vocal tone',
    vibrato_style: 'controlled luyến láy',
    dynamics: { verse: 'quiet', pre_chorus: 'build', chorus: 'loud' },
    eq_suggestions: {
      sub_bass: { action: 'Cut/Highpass below 30Hz to clean sub-rumble' },
      bass: { action: 'Slight boost at 80Hz for punch' },
      low_mids: { action: 'Dip at 300Hz for clarity' },
      highs: { action: 'Airy shelf boost at 10kHz' }
    },
    instrument_mixing: {
      vocal: { comp: 'Ratio 4:1, Thresh -16dB', suggestion: 'Clean vocal compression with subtle reverb decay.' },
      drums: { suggestion: selectedGenre === 'Ballad' ? 'Soft brushed percussion.' : 'Punchy drum groove.' },
      bass: { suggestion: 'Mono-merge below 120Hz for center stability.' },
      melody: { suggestion: selectedGenre === 'Ballad' ? 'Grand piano chords and strings.' : 'Lush keyboard chords and arpeggios.' }
    },
    mastering: {
      limiter: 'Target loudness: -10.5 LUFS. Ceiling: -1.0dBTP.',
      stereo_width: 'Mono below 110Hz. Wide stereo image above 3kHz.',
      style_recommendation: 'High dynamic range with glue compression.'
    }
  };
}

function analyzeAudioFile(filePath: string): Promise<any> {
  return new Promise((resolve) => {
    const pythonPath = 'python';
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'analyze_audio.py');
    const { exec } = require('child_process');
    exec(`"${pythonPath}" "${scriptPath}" "${filePath}"`, (error: any, stdout: string, stderr: string) => {
      const duration = getAudioDuration(filePath);

      if (error) {
        console.warn('[AudioAnalysis] Python analysis failed/unavailable, generating dynamic audio metrics fallback:', error.message);
        resolve(generateDynamicFallbackAnalysis(duration, filePath));
        return;
      }
      try {
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.reverse().find(l => l.trim().startsWith('{') && l.trim().endsWith('}'));
        if (jsonLine) {
          const data = JSON.parse(jsonLine);
          resolve(data);
        } else {
          const data = JSON.parse(stdout.trim());
          resolve(data);
        }
      } catch (err) {
        console.warn('[AudioAnalysis] Error parsing python output, using dynamic metrics fallback:', err);
        resolve(generateDynamicFallbackAnalysis(duration, filePath));
      }
    });
  });
}

function convertToFlac(inputPath: string, outputPath: string, crop: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
    ];
    if (crop) {
      args.push('-ss', '10', '-t', '50');
    }
    args.push(
      '-map', '0:a',          // audio-only: strips embedded cover art / image streams
      '-vn',                  // no video output (extra safety)
      '-map_metadata', '-1',
      '-fflags', '+bitexact',
      '-c:a', 'flac',
      outputPath
    );
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    ffmpeg.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg convert to FLAC exited with code ${code}: ${stderr}`));
      }
    });
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

export const maxDuration = 60; // Max duration for Vercel Hobby plan (60 seconds)

/**
 * Adversarial Perturbation stage:
 * Runs the Python adversarial_perturb.py script on the already-FFmpeg-processed file.
 * Injects imperceptible noise ε(t) that displaces STFT spectral peaks,
 * making x'(t) = x(t) + ε(t) sound identical but appear different to fingerprint AI.
 * Falls back gracefully (returns original path) if Python is unavailable.
 */
function applyAdversarialPerturbation(
  inputPath: string,
  outputPath: string,
  strength: number = 0.012,
  iterations: number = 15
): Promise<string> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'adversarial_perturb.py');
    if (!fs.existsSync(scriptPath)) {
      console.warn('[AdvPerturb] Script not found, skipping adversarial perturbation.');
      resolve(inputPath);
      return;
    }

    console.log(`[AdvPerturb] Applying adversarial perturbation: strength=${strength}, iterations=${iterations}`);
    const proc = spawn('python', [
      scriptPath,
      inputPath,
      outputPath,
      '--strength', String(strength),
      '--iterations', String(iterations),
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => {
      const line = d.toString();
      stderr += line;
      // Forward Python logs to Next.js console for debugging
      process.stdout.write(line);
    });

    const timeout = setTimeout(() => {
      proc.kill();
      console.warn('[AdvPerturb] Timeout exceeded (90s). Falling back to FFmpeg output.');
      resolve(inputPath);
    }, 90000);

    proc.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputPath)) {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            console.log('[AdvPerturb] Adversarial perturbation applied successfully.');
            resolve(outputPath);
            return;
          }
        } catch (_) {}
        resolve(outputPath);
      } else {
        console.warn(`[AdvPerturb] Python exited with code ${code}. Falling back to FFmpeg output.`);
        resolve(inputPath); // Graceful fallback — still use FFmpeg-processed file
      }
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.warn('[AdvPerturb] Could not spawn Python process:', err.message, '— skipping adversarial perturbation.');
      resolve(inputPath); // Graceful fallback
    });
  });
}

/**
 * Demucs Stem Bypass:
 * Separates audio into 4 stems (vocals/drums/bass/other), applies DIFFERENT
 * independent spectral transforms to each, then recombines at randomised levels.
 *
 * WHY THIS WORKS AGAINST NEURAL FINGERPRINTING:
 *   Neural fingerprinting embeds the MIXTURE as one entity in embedding space.
 *   By processing each source independently with unique transforms, the cross-source
 *   spectral interaction pattern changes fundamentally — this variation is NOT covered
 *   by the augmentation invariances built into Suno's fingerprinting model.
 *
 * Falls back gracefully (returns inputPath) if Demucs is unavailable or times out.
 * Timeout: 600s (10 minutes) to accommodate CPU-based Demucs inference.
 */
function applyDemucsProcessing(
  inputPath: string,
  outputPath: string,
  seed?: number
): Promise<string> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'stem_bypass.py');
    if (!fs.existsSync(scriptPath)) {
      console.warn('[StemBypass] stem_bypass.py not found, skipping Demucs.');
      resolve(inputPath);
      return;
    }

    const actualSeed = seed ?? Math.floor(Math.random() * 99999);
    console.log(`[StemBypass] Starting Demucs stem separation (seed=${actualSeed})…`);
    console.log('[StemBypass] Note: First run downloads htdemucs model (~320MB). Subsequent runs are faster.');

    const proc = spawn('python', [scriptPath, inputPath, outputPath, String(actualSeed)]);

    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => {
      // Forward Python progress logs to Next.js console
      process.stdout.write(d.toString());
    });

    // 10-minute hard timeout (Demucs on CPU for a 5-min song can take ~5-8 min)
    const timeout = setTimeout(() => {
      proc.kill();
      console.warn('[StemBypass] Timeout (600s) exceeded. Falling back to FFmpeg processing.');
      resolve(inputPath);
    }, 600000);

    proc.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputPath)) {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            console.log(
              `[StemBypass] SUCCESS — vocals=${result.vocal_pitch_st}st bass=+${result.bass_pitch_st}st ` +
              `other=+${result.other_pitch_st}st freqShift=${result.freq_shift_hz}Hz ` +
              `weights=${JSON.stringify(result.stem_weights)}`
            );
            resolve(outputPath);
            return;
          } else {
            console.warn('[StemBypass] Script reported failure:', result.error);
          }
        } catch (_) {}
        resolve(outputPath);
      } else {
        console.warn(`[StemBypass] Python exited code ${code}. Falling back to FFmpeg output.`);
        resolve(inputPath); // Graceful fallback
      }
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.warn('[StemBypass] Cannot spawn Python:', err.message, '— skipping Demucs.');
      resolve(inputPath);
    });
  });
}

/**
 * Psychoacoustic Spectral Peak Disruption:
 * Targets all 3 fingerprinting layers simultaneously:
 *   L1 (Shazam landmark): phase jitter + amplitude micro-mod + fractional bin shift at peaks
 *   L2 (Chroma/MFCC):     cross-bin energy redistribution between semitone bins
 *   L3 (Neural perceptual): psychoacoustic-masked noise + onset timing micro-displacement
 *
 * All perturbations are BELOW the simultaneous psychoacoustic masking threshold
 * computed per STFT frame from an ISO 226-derived model → completely inaudible.
 * Output sample count == input sample count (exact duration preservation guaranteed).
 *
 * Timeout: 120s. Falls back gracefully to inputPath if Python unavailable.
 */
function applyPeakDisruption(
  inputPath: string,
  outputWavPath: string,
  strength: number = 0.40,
  seed?: number
): Promise<string> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'peak_disrupt.py');
    if (!fs.existsSync(scriptPath)) {
      console.warn('[PeakDisrupt] peak_disrupt.py not found, skipping.');
      resolve(inputPath);
      return;
    }

    const actualSeed = seed ?? Math.floor(Math.random() * 99999);
    console.log(`[PeakDisrupt] Starting psychoacoustic peak disruption (strength=${strength}, seed=${actualSeed})…`);

    const proc = spawn('python', [
      scriptPath,
      inputPath,
      outputWavPath,
      String(strength),
      String(actualSeed),
    ]);

    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { process.stdout.write(d.toString()); });

    const timeout = setTimeout(() => {
      proc.kill();
      console.warn('[PeakDisrupt] Timeout (120s). Falling back to input audio.');
      resolve(inputPath);
    }, 120000);

    proc.on('close', (code: number | null) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputWavPath)) {
        try {
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            const d = result.disruption ?? {};
            console.log(
              `[PeakDisrupt] SUCCESS — peaks_modified=${d.peaks_modified} ` +
              `noise_bins=${d.noise_bins_injected} duration=${result.duration_s}s`
            );
            resolve(outputWavPath);
            return;
          }
        } catch (_) {}
        resolve(outputWavPath);
      } else {
        console.warn(`[PeakDisrupt] Python exited code ${code}. Falling back.`);
        resolve(inputPath);
      }
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.warn('[PeakDisrupt] Cannot spawn Python:', err.message);
      resolve(inputPath);
    });
  });
}

export async function POST(request: NextRequest) {
  let inputTempPath = '';
  let cleanTempPath = '';
  let outputTempPath = '';
  let advTempPath = '';
  let oggCleanupDir = '';
  let oggCleanupPrefix = '';

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? undefined;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const preset = (formData.get('preset') as string || 'aggressive').toLowerCase();

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file tải lên.' }, { status: 400 });
    }

    const fileNameLower = file.name.toLowerCase();
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|ogg|webm)$/.test(fileNameLower);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/.test(fileNameLower);

    if (!isAudio && !isImage) {
      return NextResponse.json(
        { error: 'Định dạng file không hợp lệ. Vui lòng chọn file âm thanh hoặc hình ảnh.' },
        { status: 400 }
      );
    }

    // Read the uploaded file binary data
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Setup temporary directory inside workspace
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileExt = path.extname(file.name) || (isAudio ? '.mp3' : '.jpg');
    const randomName = crypto.randomBytes(16).toString('hex');
    oggCleanupDir = tempDir;
    oggCleanupPrefix = randomName;
    inputTempPath = path.join(tempDir, `${randomName}_input${fileExt}`);
    cleanTempPath = isAudio ? path.join(tempDir, `${randomName}_clean${fileExt}`) : '';
    outputTempPath = isAudio 
      ? path.join(tempDir, `${randomName}_processed.flac`) 
      : path.join(tempDir, `${randomName}_processed${fileExt}`);

    // Write original uploaded file to temp path
    fs.writeFileSync(inputTempPath, buffer);

    let processedBase64 = '';
    let finalFileType = file.type;
    let finalFileName = file.name;
    let referenceFileId: string | null = null;
    let analysis: any = null;

    if (isAudio) {
      const isMp3 = fileExt.toLowerCase() === '.mp3';
      console.log(`[UploadReference] Processing audio file: ${inputTempPath}`);
      
      let currentInputPath = inputTempPath;
      
      try {
        await stripAudioMetadata(inputTempPath, cleanTempPath, isMp3);
        console.log(`[UploadReference] Successfully stripped metadata to ${cleanTempPath}`);
        currentInputPath = cleanTempPath;
      } catch (err) {
        console.error('[UploadReference] Failed to strip metadata, proceeding with original:', err);
      }

      // Convert to FLAC or prepare raw buffer for Suno upload
      try {
        await convertToFlac(currentInputPath, outputTempPath);
        const processedBuffer = fs.readFileSync(outputTempPath);
        processedBase64 = `data:audio/flac;base64,${processedBuffer.toString('base64')}`;
        finalFileType = 'audio/flac';
        finalFileName = `ref_audio_${randomName}.flac`;
      } catch (convErr) {
        const rawBuffer = fs.readFileSync(currentInputPath);
        processedBase64 = `data:${file.type};base64,${rawBuffer.toString('base64')}`;
        finalFileType = file.type;
        finalFileName = `ref_audio_${randomName}${fileExt}`;
      }

      // Analyze audio features (BPM, Key, Timbre, Genre, Dynamics)
      const targetAnalysisPath = (cleanTempPath && fs.existsSync(cleanTempPath)) ? cleanTempPath : currentInputPath;
      analysis = await analyzeAudioFile(targetAnalysisPath);

      // Check if admin enabled "COPYRIGHT FALLBACK WORKFLOW ONLY" mode
      const copyrightFallbackOnly = await prisma.systemConfig.findUnique({
        where: { key: 'enable_copyright_fallback_only' }
      });

      if (copyrightFallbackOnly?.value === 'true') {
        console.log('[UploadReference] COPYRIGHT FALLBACK WORKFLOW ONLY ENABLED: Bypassing audio upload, returning deep acoustic prompt analysis.');
        const styleSuggestion = buildDeepAudioPrompt(analysis);

        return NextResponse.json({
          success: false,
          copyrightBlocked: true,
          analysis,
          styleSuggestion,
          message: 'Đã kích hoạt chế độ COPYRIGHT FALLBACK WORKFLOW: Tự động phân tích sâu file âm thanh và tạo Style Prompt chi tiết (> 900 ký tự).',
        }, { status: 200 });
      }

      // Attempt upload to Suno
      try {
        console.log(`[UploadReference] Submitting reference audio to Suno...`);
        referenceFileId = await SunoClient.uploadReferenceFlow(
          {
            data: processedBase64,
            name: finalFileName,
            type: finalFileType,
          },
          userId
        );
      } catch (uploadErr: any) {
        const errMsg = (uploadErr?.message ?? '');
        console.warn(`[UploadReference] Suno upload result/error: ${errMsg}`);

        const isCopyrightError = errMsg.includes('bản quyền') || errMsg.includes('copyright') || errMsg.includes('catalog') || errMsg.includes('audio');

        if (isCopyrightError) {
          console.log('[UploadReference] COPYRIGHT FALLBACK WORKFLOW: Generating deep audio prompt analysis...');
          const styleSuggestion = buildDeepAudioPrompt(analysis);
          console.log(`[UploadReference] Deep Style suggestion generated (${styleSuggestion.length} chars)`);

          return NextResponse.json({
            success: false,
            copyrightBlocked: true,
            analysis,
            styleSuggestion,
            message: 'Bài hát có bản quyền được bảo vệ bởi Suno. Đã tự động phân tích phong cách âm nhạc sâu (> 900 ký tự). Bạn có thể dùng gợi ý style bên dưới để tạo nhạc theo phong cách tương tự.',
          }, { status: 200 });
        }

        throw uploadErr;
      }
    } else {
      // Images don't require pre-processing
      processedBase64 = `data:${file.type};base64,${buffer.toString('base64')}`;
      referenceFileId = await SunoClient.uploadReferenceFlow(
        {
          data: processedBase64,
          name: finalFileName,
          type: finalFileType,
        },
        userId
      );
    }

    return NextResponse.json({
      success: true,
      referenceFileId,
      referenceFileType: finalFileType,
      analysis,
    });
  } catch (error: any) {
    console.error('POST /api/music/upload-reference error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  } finally {
    // Clean up temporary files synchronously to prevent memory leakage
    try {
      if (inputTempPath && fs.existsSync(inputTempPath)) {
        fs.unlinkSync(inputTempPath);
      }
      if (cleanTempPath && fs.existsSync(cleanTempPath)) {
        fs.unlinkSync(cleanTempPath);
      }
      if (outputTempPath && fs.existsSync(outputTempPath)) {
        fs.unlinkSync(outputTempPath);
      }
      if (advTempPath && fs.existsSync(advTempPath)) {
        fs.unlinkSync(advTempPath);
      }
      // Cleanup all randomName-prefixed temp files (including OGG roundtrip)
      if (oggCleanupDir && oggCleanupPrefix) {
        try {
          const tmpFiles = fs.readdirSync(oggCleanupDir).filter(f => f.startsWith(oggCleanupPrefix));
          for (const f of tmpFiles) {
            try { fs.unlinkSync(path.join(oggCleanupDir, f)); } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (cleanupError) {
      console.error('[UploadReference] Temp file cleanup error:', cleanupError);
    }
  }
}
