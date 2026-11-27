#!/usr/bin/env python3
"""Spectrum balance of audio files (MP3/WAV via ffmpeg): share of energy per band in dB relative to
the whole, low end 30-60 Hz, mono vs stereo energy and loudness. Usage: cek_spektrum.py file...
Bands: sub 20-60, bass 60-150, lowmid 200-400 (mud), mid 400-2k, presence 2-5k, sibilance 5-8k, air 8-16k."""
import sys, json, subprocess, numpy as np
from scipy import signal
SR = 44100
def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)
for f in sys.argv[1:]:
    x = load(f); m = x.mean(1).astype(np.float64)
    fr, P = signal.welch(m, SR, nperseg=8192); tot = P.sum()
    b = lambda lo, hi: round(float(10 * np.log10(P[(fr >= lo) & (fr < hi)].sum() / tot + 1e-12)), 1)
    out = dict(sub_20_60=b(20, 60), sub_30_60=b(30, 60), bass_60_150=b(60, 150), lowmid_200_400=b(200, 400), mid_400_2k=b(400, 2000),
               presence_2k_5k=b(2000, 5000), sibilance_5k_8k=b(5000, 8000), air_8k_16k=b(8000, 16000),
               mono_vs_stereo_db=round(float(10 * np.log10(np.mean(m ** 2) / np.mean(x.astype(np.float64) ** 2))), 2))
    try:
        import pyloudnorm as pyln
        out['lufs'] = round(float(pyln.Meter(SR).integrated_loudness(x.astype(np.float64))), 1)
    except Exception: pass
    print(json.dumps({'file': f.split('/')[-1], **out}))
