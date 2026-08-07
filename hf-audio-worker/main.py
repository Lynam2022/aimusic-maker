import os
import random
import subprocess
import uuid
import math
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI(title="Audio Bypass Worker Microservice")

TEMP_DIR = "/tmp/audio_worker"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Audio Bypass Worker", "version": "1.0.0"}

@app.post("/process-audio")
async def process_audio(
    file: UploadFile = File(...),
    preset: str = Form("aggressive")
):
    try:
        req_id = uuid.uuid4().hex
        input_filename = f"{req_id}_input_{file.filename}"
        clean_filename = f"{req_id}_clean.mp3"
        output_filename = f"{req_id}_processed.flac"

        input_path = os.path.join(TEMP_DIR, input_filename)
        clean_path = os.path.join(TEMP_DIR, clean_filename)
        output_path = os.path.join(TEMP_DIR, output_filename)

        # Save uploaded file to disk
        contents = await file.read()
        with open(input_path, "wb") as f:
            f.write(contents)

        # 1. Strip ID3 metadata
        strip_cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-map", "0:a", "-vn", "-map_metadata", "-1",
            "-fflags", "+bitexact", "-c:a", "copy", clean_path
        ]
        subprocess.run(strip_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        current_input = clean_path if os.path.exists(clean_path) else input_path

        # 2. Dynamic Random Acoustic Perturbation Parameters
        if preset == "fidelity":
            pitch_semis = round(0.7 + random.random() * 0.2, 2)
            pitch_ratio = round(math.pow(2, pitch_semis / 12), 5)
            tempo_ratio = round(1.015 + random.random() * 0.01, 3)
            delay1 = random.randint(10, 15)
            delay2 = random.randint(6, 10)

            filter_complex = ";".join([
                "[0:a]asplit=3[in_low][in_mid][in_high]",
                f"[in_low]lowpass=f=200,rubberband=pitch={pitch_ratio}:tempo={tempo_ratio},adelay={delay1}|{delay1},equalizer=f=80:width_type=o:width=1.5:g=1.0[low_proc]",
                f"[in_mid]lowpass=f=4000,highpass=f=200,rubberband=pitch={pitch_ratio}:tempo={tempo_ratio}:formant=preserved,equalizer=f=300:width_type=o:width=2.0:g=-1.5[mid_proc]",
                f"[in_high]highpass=f=4000,rubberband=pitch={pitch_ratio}:tempo={tempo_ratio},adelay={delay2}|${delay2},aexciter=freq=4000:level_in=1:level_out=1:amount=10:drive=2.0:blend=0.15,equalizer=f=12000:width_type=o:width=1.5:g=1.2[high_proc]",
                "[low_proc][mid_proc][high_proc]amix=inputs=3:weights=1 1 1:normalize=0[mixed]",
                "[mixed]volume=1.05,loudnorm=I=-13.0:TP=-1.0:LRA=7,aresample=44100[out]"
            ])
        elif preset == "aggressive":
            pitch_semis = round(3.8 + random.random() * 1.0, 2)
            pitch_ratio = round(math.pow(2, pitch_semis / 12), 5)
            tempo_ratio = round(1.035 + random.random() * 0.03, 3)
            freq_shift = random.randint(8, 14)
            vib_freq = round(2.5 + random.random() * 0.8, 1)
            vib_depth = round(0.03 + random.random() * 0.015, 3)
            delay1 = random.randint(40, 60)
            delay2 = random.randint(80, 110)
            presence_gain = round(4.2 + random.random() * 1.0, 1)

            filter_complex = ";".join([
                "[0:a]asplit=3[in_low][in_mid][in_high]",
                f"[in_low]lowpass=f=200,rubberband=pitch={pitch_ratio}:tempo={tempo_ratio},compand=attacks=0.003:decays=0.08:points=-60/-60|-20/-16|0/-2:gain=3.0,equalizer=f=60:width_type=o:width=1.5:g=4.0[low_proc]",
                f"[in_mid]lowpass=f=4000,highpass=f=200,rubberband=pitch={pitch_ratio}:tempo={tempo_ratio}:formant=shifted,chorus=0.5:0.7:35:0.3:0.15:2,vibrato=f={vib_freq}:d={vib_depth},afreqshift=shift={freq_shift},aecho=0.8:0.8:{delay1}|{delay2}:0.15|0.08,bs2b=profile=default,pan=stereo|c0=0.88*c0+0.12*c1|c1=0.88*c1+0.12*c0,equalizer=f=300:width_type=o:width=2.0:g=-3.5,equalizer=f=1500:width_type=o:width=2.0:g=-5.5,equalizer=f=3500:width_type=o:width=1.5:g={presence_gain}[mid_proc]",
                f"[in_high]highpass=f=4000,aexciter=freq=3200:level_in=1:level_out=1:amount=16:drive=4.5:blend=0.28,equalizer=f=10000:width_type=o:width=2.0:g=3.5[high_proc]",
                "[low_proc][mid_proc][high_proc]amix=inputs=3:weights=1 1 1:normalize=0[mixed]",
                "[mixed]volume=1.18,loudnorm=I=-12.5:TP=-1.0:LRA=7,aresample=44100[out]"
            ])
        else:
            # Subtle/simple bypass: convert to FLAC or simple format
            filter_complex = "aresample=44100[out]"

        process_cmd = [
            "ffmpeg", "-y", "-i", current_input,
            "-vn", "-map_metadata", "-1", "-fflags", "+bitexact",
            "-filter_complex", filter_complex,
            "-map", "[out]", "-c:a", "flac", output_path
        ]
        
        proc_res = subprocess.run(process_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc_res.returncode != 0:
            raise Exception(f"FFmpeg failed: {proc_res.stderr[-500:]}")

        return FileResponse(
            path=output_path,
            filename=f"ref_audio_{req_id}.flac",
            media_type="audio/flac"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup input files asynchronously in background
        pass
