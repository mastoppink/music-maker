#!/usr/bin/env python3
"""Checks every WAV (+ .mid) in a folder: loudness/LRA/true peak (ffmpeg ebur128), clicks
(sudden 2nd-difference spikes), silent stretches, MIDI same-pitch overlaps and stub notes.
Usage: cek_audio.py <folder> [--json out.json]"""
import sys, os, json, subprocess, re, glob
import numpy as np
try:
    import mido
except ImportError:
    mido = None

def loud(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    tail = r[r.rfind('Summary'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+)', tail).group(1))
    return dict(I=g('I'), LRA=g('LRA'), TP=g('Peak'))

def audio(f):
    x = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(x, dtype=np.float32).astype(np.float64)
    d2 = np.abs(np.diff(x, 2)); loc = np.convolve(d2, np.ones(2205) / 2205, 'same') + 1e-7
    spikes = int(np.sum((d2 / loc > 25) & (d2 > 0.02)))
    W = 22050; lv = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + W] ** 2)) + 1e-9) for i in range(0, len(x) - W, W)])
    act = lv[4:-6] if len(lv) > 12 else lv
    return dict(dur=round(len(x) / 44100, 1), spikes=spikes, silent=int((act < -50).sum()))

def midi(f):
    if not mido or not os.path.exists(f): return {}
    m = mido.MidiFile(f); ov = stubs = n = 0
    for tr in m.tracks:
        t = 0; on = {}
        for msg in tr:
            t += msg.time
            if msg.type == 'note_on' and msg.velocity > 0:
                key = (msg.channel, msg.note)
                if key in on: ov += 1
                on[key] = t; n += 1
            elif msg.type in ('note_off', 'note_on'):
                key = (msg.channel, msg.note)
                if key in on:
                    if t - on[key] < m.ticks_per_beat * 0.06 and msg.channel != 9: stubs += 1
                    del on[key]
    return dict(midi_notes=n, midi_overlaps=ov, midi_stubs=stubs)

rows = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.wav'))):
    r = dict(file=os.path.basename(f)); r.update(loud(f)); r.update(audio(f)); r.update(midi(f[:-4] + '.mid'))
    rows.append(r); print(json.dumps(r), flush=True)
if '--json' in sys.argv: json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
