#!/usr/bin/env python3
"""
stem_bypass.py — Demucs-based audio copyright fingerprint bypass

STRATEGY:
  Neural fingerprinting embeds the MIXTURE of all audio sources as one entity.
  When we:
    1. Separate each source (vocals/drums/bass/instruments) with Demucs
    2. Apply a DIFFERENT independent transform to EACH source
    3. Recombine at slightly different levels

  The resulting mixture embedding lands at a completely different position in
  the neural embedding space → no match against catalog despite same music.

  Why DSP alone fails: transforms applied to the FULL MIX are invariant to
  neural models (trained with augmentation). But separate-source manipulation
  changes the cross-source spectral interaction pattern which is NOT in training.

USAGE:
  python stem_bypass.py <input_audio> <output_flac> [seed]

OUTPUT:
  JSON to stdout: {"success": true, "seed": N, "vocal_pitch": X, ...}
  Progress logs to stderr
"""

import sys
import os
import json
import subprocess
import tempfile
import random
import math
import shutil


def ffmpeg_run(args: list, desc: str = '') -> None:
    """Run FFmpeg command, raise on failure."""
    result = subprocess.run(
        ['ffmpeg', '-y'] + args,
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(
            f'FFmpeg {desc} failed (code {result.returncode}):\n{result.stderr[-500:]}'
        )


def ensure_demucs():
    """Check if demucs is importable; install if not."""
    try:
        result = subprocess.run(
            [sys.executable, '-c', 'import demucs'],
            capture_output=True, timeout=10
        )
        if result.returncode == 0:
            return  # already installed
    except Exception:
        pass

    print('[StemBypass] demucs not found — installing (first run only)...', file=sys.stderr, flush=True)
    install = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', 'demucs', '-q', '--no-warn-script-location'],
        timeout=360
    )
    if install.returncode != 0:
        raise RuntimeError('Failed to install demucs. Run: pip install demucs')
    print('[StemBypass] demucs installed successfully.', file=sys.stderr, flush=True)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({'success': False, 'error': 'Usage: stem_bypass.py <input> <output> [seed]'}))
        sys.exit(1)

    input_path  = sys.argv[1]
    output_path = sys.argv[2]
    seed        = int(sys.argv[3]) if len(sys.argv) > 3 else random.randint(0, 99999)

    rng = random.Random(seed)

    # 1. Ensure demucs is available
    try:
        ensure_demucs()
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

    tmpdir = tempfile.mkdtemp(prefix='stem_bypass_')

    try:
        # ── 2. Demucs separation ─────────────────────────────────────────────
        print(f'[StemBypass] Running Demucs htdemucs separation (seed={seed})...', file=sys.stderr, flush=True)

        sep = subprocess.run([
            sys.executable, '-m', 'demucs',
            '--out', tmpdir,
            '--name', 'htdemucs',
            '--float32',
            input_path
        ], timeout=600)

        if sep.returncode != 0:
            raise RuntimeError('Demucs separation failed')

        # Locate output stems directory
        basename  = os.path.splitext(os.path.basename(input_path))[0]
        stems_dir = os.path.join(tmpdir, 'htdemucs', basename)

        if not os.path.isdir(stems_dir):
            raise FileNotFoundError(f'Stems dir not found: {stems_dir}')

        stem_files = {}
        for stem in ['vocals', 'drums', 'bass', 'other']:
            p = os.path.join(stems_dir, f'{stem}.wav')
            if not os.path.exists(p):
                raise FileNotFoundError(f'Stem missing: {p}')
            stem_files[stem] = p

        print('[StemBypass] All 4 stems separated. Applying independent transforms...', file=sys.stderr, flush=True)

        # ── 3. Per-stem independent transforms ───────────────────────────────
        processed = {}

        # VOCALS: pitch down 0.8–1.7st + plate reverb + presence reshape
        vp = -(0.8 + rng.random() * 0.9)
        vr = math.pow(2, vp / 12)
        vd1 = rng.randint(28, 48)
        vd2 = rng.randint(55, 85)
        processed['vocals'] = os.path.join(tmpdir, 'voc.flac')
        ffmpeg_run([
            '-i', stem_files['vocals'], '-vn', '-map_metadata', '-1',
            '-af', (
                f'rubberband=pitch={vr:.5f}:tempo=1.000:formant=preserved,'
                f'aecho=0.88:0.10:{vd1}|{vd2}:0.08|0.05,'
                f'equalizer=f=2800:width_type=o:width=2.0:g=-2.0,'
                f'equalizer=f=8500:width_type=o:width=2.0:g=1.5'
            ),
            '-c:a', 'flac', processed['vocals']
        ], 'vocals')
        print(f'[StemBypass] Vocals: pitch={vp:.2f}st, reverb_delay={vd1}/{vd2}ms', file=sys.stderr, flush=True)

        # DRUMS: micro-delay + transient & tonal reshaping + room sim
        dd = rng.randint(6, 16)
        processed['drums'] = os.path.join(tmpdir, 'drm.flac')
        ffmpeg_run([
            '-i', stem_files['drums'], '-vn', '-map_metadata', '-1',
            '-af', (
                f'adelay={dd}|{dd},'
                f'equalizer=f=70:width_type=o:width=1.5:g=2.5,'
                f'equalizer=f=280:width_type=o:width=1.5:g=-3.5,'
                f'equalizer=f=5000:width_type=o:width=2.0:g=2.0,'
                f'aecho=0.93:0.04:20|40:0.04|0.02'
            ),
            '-c:a', 'flac', processed['drums']
        ], 'drums')
        print(f'[StemBypass] Drums: delay={dd}ms + transient reshape', file=sys.stderr, flush=True)

        # BASS: pitch up 0.4–1.0st + sub boost + mud cut
        bp = 0.4 + rng.random() * 0.6
        br = math.pow(2, bp / 12)
        processed['bass'] = os.path.join(tmpdir, 'bas.flac')
        ffmpeg_run([
            '-i', stem_files['bass'], '-vn', '-map_metadata', '-1',
            '-af', (
                f'rubberband=pitch={br:.5f}:tempo=1.000,'
                f'equalizer=f=55:width_type=o:width=1.5:g=3.0,'
                f'equalizer=f=230:width_type=o:width=1.5:g=-3.0,'
                f'equalizer=f=480:width_type=o:width=1.5:g=1.5'
            ),
            '-c:a', 'flac', processed['bass']
        ], 'bass')
        print(f'[StemBypass] Bass: pitch=+{bp:.2f}st + sub/mud reshape', file=sys.stderr, flush=True)

        # OTHER (instruments/pads/FX): harmonic shift + stereo width + air
        fs = 1.2 + rng.random() * 1.3
        op = 1.0 + rng.random() * 1.0
        or_v = math.pow(2, op / 12)
        od = rng.randint(22, 42)
        ph = round(0.05 + rng.random() * 0.06, 3)
        processed['other'] = os.path.join(tmpdir, 'oth.flac')
        ffmpeg_run([
            '-i', stem_files['other'], '-vn', '-map_metadata', '-1',
            '-af', (
                f'afreqshift=shift={fs:.2f},'
                f'rubberband=pitch={or_v:.5f}:tempo=1.000:formant=preserved,'
                f'equalizer=f=1500:width_type=o:width=2.0:g=2.5,'
                f'equalizer=f=9000:width_type=o:width=2.0:g=2.0,'
                f'aecho=0.91:0.07:{od}|{od*2}:0.07|0.04,'
                f'apulsator=hz={ph}:amount=0.18'
            ),
            '-c:a', 'flac', processed['other']
        ], 'other')
        print(f'[StemBypass] Other: freqShift={fs:.2f}Hz pitch=+{op:.2f}st pulsator={ph}Hz', file=sys.stderr, flush=True)

        # ── 4. Mix recombine with randomized stem weights ─────────────────────
        vw = round(0.88 + rng.random() * 0.10, 3)
        dw = round(0.92 + rng.random() * 0.08, 3)
        bw = round(0.92 + rng.random() * 0.08, 3)
        ow = round(0.90 + rng.random() * 0.10, 3)

        print(f'[StemBypass] Mixing stems (vocals={vw} drums={dw} bass={bw} other={ow})...', file=sys.stderr, flush=True)
        ffmpeg_run([
            '-i', processed['vocals'],
            '-i', processed['drums'],
            '-i', processed['bass'],
            '-i', processed['other'],
            '-vn', '-map_metadata', '-1',
            '-filter_complex', (
                f'[0]volume={vw}[v];'
                f'[1]volume={dw}[d];'
                f'[2]volume={bw}[b];'
                f'[3]volume={ow}[o];'
                f'[v][d][b][o]amix=inputs=4:normalize=0[mix];'
                f'[mix]loudnorm=I=-13:TP=-1.0:LRA=7,aresample=44100[out]'
            ),
            '-map', '[out]', '-c:a', 'flac', output_path
        ], 'final mix')

        print(f'[StemBypass] Done → {output_path}', file=sys.stderr, flush=True)

        print(json.dumps({
            'success': True,
            'seed': seed,
            'vocal_pitch_st': round(vp, 3),
            'bass_pitch_st': round(bp, 3),
            'other_pitch_st': round(op, 3),
            'freq_shift_hz': round(fs, 2),
            'drum_delay_ms': dd,
            'stem_weights': {'vocals': vw, 'drums': dw, 'bass': bw, 'other': ow}
        }))

    except Exception as e:
        print(f'[StemBypass] ERROR: {e}', file=sys.stderr, flush=True)
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
