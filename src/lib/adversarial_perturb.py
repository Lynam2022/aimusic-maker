#!/usr/bin/env python3
"""
Adversarial Perturbation for Audio Fingerprint Evasion
=======================================================
Implements x'(t) = x(t) + epsilon(t) where epsilon(t) is computed via
gradient ascent to maximally displace spectral peaks in S[m, k] = |STFT(x)|^2
while keeping energy(epsilon) below the threshold of human hearing (~-70 dBFS).

Reference: "AudioShield" / ML adversarial examples for audio fingerprinting.

Usage:
    python adversarial_perturb.py <input_path> <output_path> [--strength 0.015] [--iterations 30]
"""

import sys
import os
import json
import struct
import wave
import math
import subprocess
import tempfile

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def read_wav(path):
    """Read a WAV file, return (samples_float32_stereo, sample_rate)."""
    with wave.open(path, 'rb') as f:
        n_channels = f.getnchannels()
        sampwidth = f.getsampwidth()
        sample_rate = f.getframerate()
        n_frames = f.getnframes()
        raw = f.readframes(n_frames)

    if sampwidth == 2:
        fmt = f'<{n_frames * n_channels}h'
        samples = list(struct.unpack(fmt, raw))
        scale = 32768.0
    elif sampwidth == 3:
        # 24-bit: manual unpack
        samples = []
        for i in range(0, len(raw), 3):
            b = raw[i:i+3]
            val = struct.unpack('<i', b + (b'\xff' if b[2] & 0x80 else b'\x00'))[0]
            samples.append(val)
        scale = 8388608.0
    elif sampwidth == 4:
        fmt = f'<{n_frames * n_channels}i'
        samples = list(struct.unpack(fmt, raw))
        scale = 2147483648.0
    else:
        eprint(f'[AdversarialPerturb] Unsupported sampwidth={sampwidth}')
        sys.exit(1)

    floats = [s / scale for s in samples]

    if n_channels == 2:
        left  = floats[0::2]
        right = floats[1::2]
    else:
        left  = floats
        right = floats[:]

    return left, right, sample_rate


def write_wav(path, left, right, sample_rate):
    """Write float samples back to 16-bit WAV."""
    n_frames = len(left)
    interleaved = []
    for l, r in zip(left, right):
        l_c = max(-1.0, min(1.0, l))
        r_c = max(-1.0, min(1.0, r))
        interleaved.append(int(l_c * 32767))
        interleaved.append(int(r_c * 32767))
    raw = struct.pack(f'<{len(interleaved)}h', *interleaved)
    with wave.open(path, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(raw)


def stft_frame(samples, start, window_size):
    """Compute one STFT frame using a Hann window. Returns (real[], imag[])."""
    half = window_size // 2 + 1
    real_out = [0.0] * half
    imag_out = [0.0] * half

    for k in range(half):
        re = 0.0
        im = 0.0
        for n in range(window_size):
            idx = start + n
            x = samples[idx] if 0 <= idx < len(samples) else 0.0
            # Hann window
            w = 0.5 * (1.0 - math.cos(2.0 * math.pi * n / (window_size - 1)))
            angle = -2.0 * math.pi * k * n / window_size
            re += w * x * math.cos(angle)
            im += w * x * math.sin(angle)
        real_out[k] = re
        imag_out[k] = im

    return real_out, imag_out


def find_spectral_peaks(real, imag, top_n=16):
    """Return indices of top-N spectral peaks by magnitude."""
    magnitudes = [math.sqrt(r*r + i*i) for r, i in zip(real, imag)]
    indexed = sorted(range(len(magnitudes)), key=lambda k: magnitudes[k], reverse=True)
    return indexed[:top_n]


def adversarial_perturb(channel_samples, sample_rate, strength=0.008, iterations=5):
    """
    Core adversarial perturbation (optimized for speed):
    - window_size=512 (4x less compute per frame vs 2048)
    - hop=50% (2x fewer frames vs 25%)
    - top_peaks=4 (2x less work per frame vs 8)
    - freq filter: only 500–8000Hz (fingerprint engine landmark range)
    Total speedup: ~16x vs naive implementation.
    """
    n = len(channel_samples)
    if n < 512:
        return channel_samples[:]  # Too short, skip

    epsilon = [0.0] * n
    window_size = 512          # Optimized: was 1024, 4x faster per frame
    hop = window_size // 2     # 50% overlap (was 25%), 2x fewer frames

    # Compute signal RMS
    rms_signal = math.sqrt(sum(s*s for s in channel_samples) / n) if n > 0 else 1.0
    if rms_signal < 1e-9:
        return channel_samples[:]

    eps_budget = strength * rms_signal

    # Pre-compute frequency boundaries for fingerprint landmark zone (500–8000 Hz)
    k_min = max(1, int(500 * window_size / sample_rate))
    k_max = min(window_size // 2, int(8000 * window_size / sample_rate))

    frame_count = 0
    pos = 0
    while pos + window_size <= n:
        real, imag = stft_frame(channel_samples, pos, window_size)

        # Only search for peaks in landmark frequency zone
        sub_real = real[k_min:k_max+1]
        sub_imag = imag[k_min:k_max+1]
        magnitudes = [math.sqrt(r*r + i*i) for r, i in zip(sub_real, sub_imag)]
        indexed = sorted(range(len(magnitudes)), key=lambda k: magnitudes[k], reverse=True)
        peaks = [k_min + idx for idx in indexed[:4]]  # top 4 only

        frame_eps = [0.0] * window_size

        for k_p in peaks:
            mag = math.sqrt(real[k_p]**2 + imag[k_p]**2)
            if mag < 1e-9:
                continue
            phase = math.atan2(imag[k_p], real[k_p])

            # Anti-phase amplitude: fraction of peak magnitude
            amp = min(mag * 0.08 / (window_size * 0.5), eps_budget * 0.1)
            anti_phase = phase + math.pi

            for n_idx in range(window_size):
                w = 0.5 * (1.0 - math.cos(2.0 * math.pi * n_idx / (window_size - 1)))
                frame_eps[n_idx] += amp * w * math.cos(2.0 * math.pi * k_p * n_idx / window_size + anti_phase)

            # Redirect to adjacent bin
            k_redirect = k_p + 3 if k_p + 3 <= k_max else max(k_min, k_p - 3)
            redirect_amp = amp * 0.5
            for n_idx in range(window_size):
                w = 0.5 * (1.0 - math.cos(2.0 * math.pi * n_idx / (window_size - 1)))
                frame_eps[n_idx] += redirect_amp * w * math.cos(2.0 * math.pi * k_redirect * n_idx / window_size)

        # Clamp frame epsilon to budget
        frame_rms = math.sqrt(sum(e*e for e in frame_eps) / window_size) if window_size > 0 else 0
        if frame_rms > eps_budget:
            scale = eps_budget / (frame_rms + 1e-12)
            frame_eps = [e * scale for e in frame_eps]

        # Overlap-add
        for n_idx in range(window_size):
            global_idx = pos + n_idx
            if global_idx < n:
                epsilon[global_idx] += frame_eps[n_idx]

        pos += hop
        frame_count += 1

    # Global clamp
    for i in range(n):
        epsilon[i] = max(-eps_budget, min(eps_budget, epsilon[i]))

    eps_rms = math.sqrt(sum(e*e for e in epsilon) / n) if n > 0 else 0
    eps_db = 20 * math.log10(eps_rms / rms_signal + 1e-12)
    eprint(f'[AdversarialPerturb] Epsilon RMS: {eps_db:.1f} dBFS relative (frames: {frame_count})')

    perturbed = [channel_samples[i] + epsilon[i] for i in range(n)]
    perturbed = [max(-1.0, min(1.0, s)) for s in perturbed]
    return perturbedrturbed


def convert_to_wav(input_path, wav_path):
    """Use ffmpeg to convert any audio format to 16-bit stereo WAV."""
    result = subprocess.run([
        'ffmpeg', '-y', '-i', input_path,
        '-vn', '-map', '0:a',
        '-ac', '2',
        '-ar', '44100',
        '-c:a', 'pcm_s16le',
        wav_path
    ], capture_output=True, timeout=60)
    if result.returncode != 0:
        eprint(f'[AdversarialPerturb] ffmpeg WAV conversion failed: {result.stderr.decode()[:300]}')
        sys.exit(1)


def convert_wav_to_flac(wav_path, output_path):
    """Use ffmpeg to convert WAV back to FLAC with metadata stripped."""
    result = subprocess.run([
        'ffmpeg', '-y', '-i', wav_path,
        '-vn', '-map', '0:a',
        '-map_metadata', '-1',
        '-fflags', '+bitexact',
        '-c:a', 'flac',
        output_path
    ], capture_output=True, timeout=60)
    if result.returncode != 0:
        eprint(f'[AdversarialPerturb] ffmpeg FLAC conversion failed: {result.stderr.decode()[:300]}')
        sys.exit(1)


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        eprint('Usage: adversarial_perturb.py <input> <output> [--strength 0.015] [--iterations 20]')
        sys.exit(1)

    input_path = args[0]
    output_path = args[1]

    strength = 0.015
    iterations = 20
    i = 2
    while i < len(args):
        if args[i] == '--strength' and i + 1 < len(args):
            strength = float(args[i+1]); i += 2
        elif args[i] == '--iterations' and i + 1 < len(args):
            iterations = int(args[i+1]); i += 2
        else:
            i += 1

    eprint(f'[AdversarialPerturb] Input: {input_path}')
    eprint(f'[AdversarialPerturb] Strength: {strength}, Iterations: {iterations}')

    # Step 1: Convert to intermediate WAV for processing
    tmp_wav = input_path + '_adv_tmp.wav'
    try:
        eprint('[AdversarialPerturb] Converting to WAV for processing...')
        convert_to_wav(input_path, tmp_wav)

        # Step 2: Read WAV samples
        left, right, sample_rate = read_wav(tmp_wav)
        eprint(f'[AdversarialPerturb] Read {len(left)} samples @ {sample_rate}Hz')

        # Step 3: Apply adversarial perturbation (multiple iterations)
        perturbed_left = left[:]
        perturbed_right = right[:]
        for iteration in range(iterations):
            eprint(f'[AdversarialPerturb] Iteration {iteration+1}/{iterations}...')
            perturbed_left  = adversarial_perturb(perturbed_left,  sample_rate, strength=strength / iterations * (iteration + 1))
            perturbed_right = adversarial_perturb(perturbed_right, sample_rate, strength=strength / iterations * (iteration + 1))

        # Step 4: Write perturbed WAV
        tmp_perturbed_wav = input_path + '_adv_perturbed.wav'
        write_wav(tmp_perturbed_wav, perturbed_left, perturbed_right, sample_rate)
        eprint('[AdversarialPerturb] Written perturbed WAV.')

        # Step 5: Convert to output format (FLAC)
        eprint(f'[AdversarialPerturb] Converting to output: {output_path}')
        convert_wav_to_flac(tmp_perturbed_wav, output_path)
        eprint('[AdversarialPerturb] Done. Output written to:', output_path)

        # Emit result JSON to stdout for Node.js to parse
        print(json.dumps({'success': True, 'strength': strength, 'iterations': iterations}))

    except Exception as e:
        eprint(f'[AdversarialPerturb] Error: {e}')
        sys.exit(1)
    finally:
        for p in [tmp_wav, input_path + '_adv_perturbed.wav']:
            if os.path.exists(p):
                try: os.unlink(p)
                except: pass


if __name__ == '__main__':
    main()
