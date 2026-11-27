#!/usr/bin/env python3
"""Streaming check of a long rangkaian (works for 3 hours with little memory).
Usage: cek_rangkaian.py <rangkaian.wav>   (reads the .txt tracklist next to it)
Reports duration, loudness/true peak/LRA (ffmpeg ebur128), clicks, quiet stretches and the
level around every join (minimum of 0.5 s windows within +-8 s of each song start)."""
import sys, os, re, json, subprocess
import numpy as np
wav = sys.argv[1]; txt = wav[:-4] + '.txt'
def secs(t):
    p = [int(x) for x in t.split(':')]; return sum(v * 60 ** i for i, v in enumerate(reversed(p)))
starts = [secs(l.split()[0]) for l in open(txt) if l.strip() and l.split()[0].replace(':', '').isdigit()][1:]
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
tail = r[r.rfind('Summary'):]
g = lambda k: float(re.search(k + r':\s+(-?[\d.]+)', tail).group(1))
SR = 44100; W = SR // 2
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-f', 'f32le', '-'], stdout=subprocess.PIPE)
lv, spikes, prev = [], 0, np.zeros(0)
while True:
    b = p.stdout.read(SR * 30 * 4)
    if not b: break
    x = np.frombuffer(b, dtype=np.float32).astype(np.float64)
    for i in range(0, len(x) - W + 1, W): lv.append(20 * np.log10(np.sqrt(np.mean(x[i:i + W] ** 2)) + 1e-9))
    y = np.concatenate([prev, x]); d2 = np.abs(np.diff(y, 2))
    loc = np.convolve(d2, np.ones(2205) / 2205, 'same') + 1e-7
    spikes += int(np.sum((d2 / loc > 25) & (d2 > 0.02))); prev = x[-4:]
lv = np.array(lv); act = lv[20:-20]
joins = [round(float(lv[max(0, int(s * 2) - 16):int(s * 2) + 16].min()), 1) for s in starts]
res = dict(durasi=round(len(lv) / 2, 1), I=g('I'), LRA=g('LRA'), TP=g('Peak'), klik=spikes,
           jendela_sunyi_bawah_m50=int((act < -50).sum()), paling_pelan_db=round(float(act.min()), 1),
           sambungan=len(joins), sambungan_terpelan_db=min(joins) if joins else None,
           sambungan_median_db=round(float(np.median(joins)), 1) if joins else None)
print(json.dumps(res))
