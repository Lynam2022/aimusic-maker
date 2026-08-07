import sys
import json
import numpy as np
import librosa
import warnings

# Suppress warnings for clean output
warnings.filterwarnings("ignore")

def analyze(file_path):
    # Load first 60 seconds of audio
    y, sr = librosa.load(file_path, sr=22050, duration=60.0)
    
    # Normalize audio to standard -1.0 to 1.0 range for consistent metric extraction
    y = librosa.util.normalize(y)
    
    # 1. BPM Detection
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    if isinstance(tempo, np.ndarray):
        bpm = float(tempo[0])
    else:
        bpm = float(tempo)
    bpm = round(bpm)
    
    # 2. HPSS & F0 Extraction (pyin)
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    
    f0, voiced_flag, voiced_probs = librosa.pyin(y_harmonic, fmin=65, fmax=1000, sr=sr)
    voiced_f0 = f0[~np.isnan(f0)]
    
    median_f0 = 0.0
    register = "tenor"
    vibrato_style = "controlled luyến láy"
    freq_est = 0.0
    
    if len(voiced_f0) > 0:
        median_f0 = float(np.median(voiced_f0))
        
        if median_f0 < 130:
            register = "baritone bass"
        elif median_f0 < 200:
            register = "tenor"
        elif median_f0 < 260:
            register = "alto"
        else:
            register = "soprano"
            
        f0_detrend = voiced_f0 - np.convolve(voiced_f0, np.ones(21)/21, mode='same')
        zero_crossings = np.where(np.diff(np.sign(f0_detrend)))[0]
        
        dt = 512 / sr
        duration_voiced = len(voiced_f0) * dt
        if duration_voiced > 0:
            freq_est = (len(zero_crossings) / 2.0) / duration_voiced
        else:
            freq_est = 0.0
            
        if freq_est > 10.0:
            vibrato_style = "tight fast vibrato, controlled luyến láy"
        else:
            vibrato_style = "smooth melisma, soft wide vibrato"
        
    # 4. RMS dynamics
    rms_frames = librosa.feature.rms(y=y)[0]
    n_frames = len(rms_frames)
    if n_frames >= 3:
        sec1 = rms_frames[:n_frames//3]
        sec2 = rms_frames[n_frames//3 : 2*n_frames//3]
        sec3 = rms_frames[2*n_frames//3 :]
        
        rms1 = float(np.mean(sec1))
        rms2 = float(np.mean(sec2))
        rms3 = float(np.mean(sec3))
    else:
        rms1, rms2, rms3 = 0.1, 0.15, 0.2
        
    levels = [rms1, rms2, rms3]
    sorted_idx = np.argsort(levels)
    dynamic_curve = ["", "", ""]
    dynamic_curve[sorted_idx[0]] = "quiet"
    dynamic_curve[sorted_idx[1]] = "build"
    dynamic_curve[sorted_idx[2]] = "loud"
    
    # 5. Spectral Centroid
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    mean_centroid = float(np.mean(centroid))
    
    if mean_centroid < 2200:
        timbre = "warm vocal tone, not bright/airy"
    else:
        timbre = "bright vocal tone, airy vocals"
        
    # 6. Key / Chroma
    chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
    mean_chroma = np.mean(chroma, axis=1)
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    dominant_note_idx = int(np.argmax(mean_chroma))
    key = notes[dominant_note_idx]
    
    third_maj = (dominant_note_idx + 4) % 12
    third_min = (dominant_note_idx + 3) % 12
    if mean_chroma[third_maj] >= mean_chroma[third_min]:
        key_mode = "Major"
    else:
        key_mode = "Minor"
        
    # 7. Acoustic EQ & Dynamics Suggestions
    eq_suggestions = {
        "sub_bass": {"freq": "20Hz - 60Hz", "gain": -1.5, "action": "Cut/Highpass below 30Hz to clean sub-rumble"},
        "bass": {"freq": "60Hz - 250Hz", "gain": 1.0, "action": "Slight boost at 80Hz for punch/warmth"},
        "low_mids": {"freq": "250Hz - 1kHz", "gain": -2.0, "action": "Dip at 300Hz to remove muddy frequencies"},
        "high_mids": {"freq": "1kHz - 4kHz", "gain": 0.0, "action": "Flat / Keep natural presence"},
        "highs": {"freq": "4kHz - 20kHz", "gain": 1.5, "action": "High-shelf boost at 10kHz for air/breathiness"}
    }
    
    if mean_centroid < 2200:
        eq_suggestions["high_mids"] = {"freq": "1.5kHz - 3.5kHz", "gain": 2.0, "action": "Boost presence for vocal clarity"}
        eq_suggestions["highs"] = {"freq": "8kHz - 20kHz", "gain": 2.5, "action": "Airy shelf boost to brighten warm track"}
    else:
        eq_suggestions["high_mids"] = {"freq": "2kHz - 4kHz", "gain": -1.5, "action": "Slight cut at 3.5kHz to reduce harshness/sibilants"}

    if median_f0 > 0:
        if median_f0 < 150:
            vocal_eq = "High-pass filter at 75Hz. Dip mud at 220Hz. Boost chest voice body at 120Hz."
        else:
            vocal_eq = "High-pass filter at 140Hz. Boost vocal presence at 2.8kHz. Control sibilance at 7.5kHz."
    else:
        vocal_eq = "High-pass filter at 90Hz. Smooth EQ response for general acoustic balance."

    rms_std = float(np.std(rms_frames)) if len(rms_frames) > 0 else 0.05
    if rms_std > 0.03:
        comp_ratio = "4:1"
        comp_thresh = "-16dB"
        comp_attack = "10ms"
        comp_release = "150ms"
        mastering_style = "High dynamic range: Require parallel compression to glue the mix together."
    else:
        comp_ratio = "2:1"
        comp_thresh = "-10dB"
        comp_attack = "30ms"
        comp_release = "80ms"
        mastering_style = "Pre-compressed: Focus on tape saturation and brickwall limiting."

    # 8. Genre / Style Detection (Normalized)
    stft = np.abs(librosa.stft(y))
    max_stft = np.max(stft) + 1e-8
    stft_norm = stft / max_stft
    spectral_flux = float(np.mean(np.sum(np.diff(stft_norm, axis=1) ** 2, axis=0)))

    percussive_rms = float(np.sqrt(np.mean(y_percussive ** 2))) if len(y_percussive) > 0 else 0
    harmonic_rms   = float(np.sqrt(np.mean(y_harmonic ** 2)))   if len(y_harmonic) > 0 else 0.01
    perc_ratio = percussive_rms / (harmonic_rms + 1e-8)

    is_slow = bpm < 92
    is_upbeat = 118 <= bpm <= 145
    is_fast = bpm > 145
    is_perc_heavy = perc_ratio > 0.55
    is_harmonic_heavy = harmonic_rms > (percussive_rms * 1.4)

    if is_slow or (is_harmonic_heavy and mean_centroid < 2400 and bpm < 105):
        genre = "Ballad"
        genre_tags = ["ballad", "emotional", "piano", "acoustic", "lush strings", "heartfelt"]
        is_remix = False
        danceability = "low"
        vocal_mixing = "Intimate dry lead vocal with soft hall reverb decay and delicate acoustic framing."
        drums_sugg = "Soft brushed percussion, warm kick drum, delicate ride cymbals."
        bass_sugg = "Warm acoustic or upright bass, smooth sub-frequencies."
        melody_sugg = "Grand piano chords, acoustic guitar fingerpicking, legato string ensemble."
    elif is_upbeat and is_perc_heavy and spectral_flux > 0.05:
        genre = "EDM Remix"
        genre_tags = ["edm", "remix", "electronic", "dance", "club", "808 bass", "drop"]
        is_remix = True
        danceability = "very high"
        vocal_mixing = "Polished modern vocal chain with dynamic de-essing, sidechain compression, and stereo doubling."
        drums_sugg = "Sidechain bass to kick (ducking -3dB), punchy 808 kick, crisp snare."
        bass_sugg = "Heavy sub-bass mono-merged below 120Hz for solid center focus."
        melody_sugg = "Layered synth leads, bright brass/synth stabs, energetic arpeggios."
    elif (is_upbeat or is_fast) and mean_centroid > 2800:
        genre = "Pop Dance"
        genre_tags = ["pop", "dance pop", "upbeat", "electronic pop", "modern pop"]
        is_remix = False
        danceability = "high"
        vocal_mixing = "Bright airy vocal production, stereo chorus effects, plate reverb."
        drums_sugg = "Clean punchy electronic kick, snappy snare drum, 8th-note hi-hat drive."
        bass_sugg = "Groovy synth bassline with tight low-end control."
        melody_sugg = "Catchy synth arpeggios, rhythm guitar strumming, vibrant melody lines."
    elif 92 <= bpm < 118:
        genre = "Pop"
        genre_tags = ["pop", "melodic", "radio pop", "contemporary"]
        is_remix = False
        danceability = "moderate"
        vocal_mixing = "Balanced vocal compression, subtle plate reverb, transparent EQ."
        drums_sugg = "Clean acoustic/electronic hybrid drums with steady pulse."
        bass_sugg = "Balanced melodic bassline supporting root notes."
        melody_sugg = "Lush keyboard chords, acoustic guitar accents, subtle synth pads."
    else:
        genre = "Contemporary"
        genre_tags = ["pop", "contemporary", "melodic"]
        is_remix = False
        danceability = "moderate"
        vocal_mixing = "Natural vocal clarity with subtle compression and space."
        drums_sugg = "Steady rhythm section with balanced dynamic response."
        bass_sugg = "Controlled low-end foundation."
        melody_sugg = "Harmonious musical backing with organic instrument separation."

    genre_tags.append("Vietnamese pop")

    instrument_mixing = {
        "vocal": {"eq": vocal_eq, "comp": f"Ratio {comp_ratio}, Thresh {comp_thresh}, Attack {comp_attack}, Release {comp_release}", "suggestion": vocal_mixing},
        "drums": {"eq": "Boost kick punch at 60Hz. Cut snare boxiness at 400Hz.", "comp": "Fast transient compression.", "suggestion": drums_sugg},
        "bass": {"eq": "Boost roundness at 90Hz. Cut mud at 250Hz.", "comp": "Tight ratio 6:1 for sub-frequency stability.", "suggestion": bass_sugg},
        "melody": {"eq": "Highpass at 180Hz. Dip at 1kHz for vocal clarity.", "comp": "Soft ratio 2:1 for natural dynamic balance.", "suggestion": melody_sugg}
    }

    mastering = {
        "limiter": "Target loudness: -10.5 LUFS. Ceiling: -1.0dBTP. Output ceiling -0.2dB.",
        "stereo_width": "Mono below 110Hz. Wide stereo image (+25%) above 3kHz.",
        "style_recommendation": mastering_style
    }

    return {
        "bpm": bpm,
        "register": register,
        "vibrato_style": vibrato_style,
        "dynamics": {
            "verse": dynamic_curve[0],
            "pre_chorus": dynamic_curve[1],
            "chorus": dynamic_curve[2]
        },
        "timbre": timbre,
        "key": f"{key} {key_mode}",
        "freq_est": round(freq_est, 2),
        "median_f0": round(median_f0, 2),
        "genre": genre,
        "genre_tags": genre_tags,
        "is_remix": is_remix,
        "danceability": danceability,
        "eq_suggestions": eq_suggestions,
        "instrument_mixing": instrument_mixing,
        "mastering": mastering
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
        
    try:
        res = analyze(sys.argv[1])
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
