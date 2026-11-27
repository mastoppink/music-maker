#!/usr/bin/env python3
"""Studio re-render of a music-maker MIDI.
Piano -> FluidSynth + Salamander Grand Piano (CC BY 3.0, Alexander Holm).
String / Cello / Bass -> own sampler over VSCO-2 CE sustain samples (CC0).
Then mix (EQ, pan, synthetic hall convolution, glue) and master (-14 LUFS, TP <= -1 dBTP).
Usage: studio_render.py <in.mid> <outdir>
"""
import sys, os, re, glob, subprocess, json
import numpy as np, soundfile as sf, mido, pyloudnorm as pyln
from scipy import signal
from pedalboard import Pedalboard, HighpassFilter, LowpassFilter, PeakFilter, HighShelfFilter, LowShelfFilter, Compressor
from numba import njit
from scipy.ndimage import minimum_filter1d

SR = 44100
MID, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SF2 = "/home/ubuntu/studio/sf/SalamanderGrandPiano-SF2-V3+20200602/SalamanderGrandPiano-V3+20200602.sf2"
VS = "/home/ubuntu/studio/vsco/Strings/"
NOTES = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
rng = np.random.default_rng(4207)

# ---------------- MIDI ----------------
mf = mido.MidiFile(MID)
tempo_map = []  # (tick, tempo)
for tr in mf.tracks:
    t = 0
    for m in tr:
        t += m.time
        if m.type == 'set_tempo': tempo_map.append((t, m.tempo))
tempo_map.sort() or None
if not tempo_map or tempo_map[0][0] != 0: tempo_map.insert(0, (0, 500000))
def t2s(tick):
    s, last_t, last_tempo = 0.0, 0, tempo_map[0][1]
    for tk, tp in tempo_map:
        if tk > tick: break
        s += (tk - last_t) * last_tempo / mf.ticks_per_beat / 1e6; last_t, last_tempo = tk, tp
    return s + (tick - last_t) * last_tempo / mf.ticks_per_beat / 1e6
tracks = {}
for tr in mf.tracks:
    t, on, notes = 0, {}, []
    for m in tr:
        t += m.time
        if m.type == 'note_on' and m.velocity > 0: on.setdefault(m.note, []).append((t, m.velocity))
        elif m.type in ('note_off', 'note_on') and m.note in on and on[m.note]:
            st, v = on[m.note].pop(0); notes.append((t2s(st), t2s(t), m.note, v))
    if notes: tracks[tr.name] = sorted(notes)
end_time = max(n[1] for ns in tracks.values() for n in ns)
total = int((end_time + 7) * SR)
print({k: len(v) for k, v in tracks.items()}, 'end', round(end_time, 1))

# ---------------- Piano via FluidSynth ----------------
pm = mido.MidiFile(ticks_per_beat=mf.ticks_per_beat, type=1)
for tr in mf.tracks:
    if tr.name in ('Piano',) or not any(m.type == 'note_on' for m in tr): pm.tracks.append(tr)
pm.save(OUT + '/piano.mid')
subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.5', '-r', str(SR), '-o', 'synth.polyphony=256',
                '-F', OUT + '/piano-raw.wav', SF2, OUT + '/piano.mid'], check=True)
piano, _ = sf.read(OUT + '/piano-raw.wav')
piano = np.pad(piano, ((0, max(0, total - len(piano))), (0, 0)))[:total]

# ---------------- String sampler ----------------
def load_bank(folder, prefix_re):
    bank = []
    for f in glob.glob(VS + folder + '/*.wav'):
        m = re.search(r'_([A-G]#?)(-?\d)_v(\d)', os.path.basename(f))
        if not m: continue
        midi = 12 * (int(m.group(2)) + 1) + NOTES[m.group(1)] + 12   # VSCO names are one octave low (measured)
        bank.append(dict(path=f, midi=midi, layer=int(m.group(3))))
    return bank
BANKS = {
    'violin': load_bank('Violin Section/susVib', ''),
    'viola': load_bank('Viola Section/susvib', ''),
    'cello': load_bank('Cello Section/susvib', ''),
    'bass': load_bank('Solo Contrabass/SusVib', ''),
}
_cache = {}
def sample_audio(path, midi_nominal):
    if path in _cache: return _cache[path]
    x, sr = sf.read(path, always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    mono = x.mean(1)
    env = np.convolve(np.abs(mono), np.ones(441) / 441, 'same')
    onset = int(np.argmax(env > env.max() * 0.03)); onset = max(0, onset - 220)
    x = x[onset:]; mono = mono[onset:]
    # fine tuning: measure f0 on the sustain and correct within +-45 cents
    seg = mono[int(SR * 1.0):int(SR * 3.0)]
    cents = 0.0
    if len(seg) > SR:
        seg = seg - seg.mean(); N = 8 * len(seg)
        X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)); fr = np.fft.rfftfreq(N, 1 / SR)
        f_exp = 440 * 2 ** ((midi_nominal - 69) / 12)
        best = None
        for h in (1, 2, 3):
            m = (fr > f_exp * h * 0.96) & (fr < f_exp * h * 1.04)
            if m.any():
                fpk = fr[m][np.argmax(X[m])] / h
                c = 1200 * np.log2(fpk / f_exp)
                if best is None or X[m].max() > best[1]: best = (c, X[m].max())
        if best and abs(best[0]) < 45: cents = best[0]
    # level-normalise the sustain so layers differ by timbre more than by loudness
    sus = x[int(SR * 0.8):max(int(SR * 0.8) + SR, len(x) - int(SR * 1.5))]
    rms = np.sqrt(np.mean(sus ** 2)) + 1e-9
    x = x * (0.1 / rms)
    _cache[path] = (x, cents)
    return _cache[path]

def pick(bank, note, vel):
    layers = sorted({b['layer'] for b in bank})
    layer = layers[0] if vel < 82 else layers[-1]
    cand = [b for b in bank if b['layer'] == layer] or bank
    return min(cand, key=lambda b: (abs(b['midi'] - note), b['midi'] < note))

_shift_cache = {}
def shifted(b, note):
    key = (b['path'], note)
    if key in _shift_cache: return _shift_cache[key]
    x, cents = sample_audio(b['path'], b['midi'])
    ratio = 2 ** ((note - b['midi']) / 12 - cents / 1200)
    n = int(len(x) / ratio)
    y = signal.resample(x, n, axis=0) if abs(ratio - 1) > 1e-4 else x.copy()
    _shift_cache[key] = y
    return y

def render_note(b, note, vel, dur, attack, release):
    src = shifted(b, note)
    need = int((dur + release) * SR)
    s0 = int(SR * 1.2); s1 = len(src) - int(SR * 1.6)
    if need <= len(src) or s1 - s0 < SR * 2.5:
        y = src[:need] if need <= len(src) else np.pad(src, ((0, need - len(src)), (0, 0)))
    else:
        # extend: crossfade successive chunks from random points inside the sustain (equal power)
        xf = int(SR * 1.4)
        y = src[:s1].copy()
        while len(y) < need:
            L = int(rng.uniform(2.0, 3.5) * SR); L = min(L, s1 - s0 - 1)
            st = int(rng.uniform(s0, s1 - L))
            chunk = src[st:st + L]
            k = np.linspace(0, np.pi / 2, xf)[:, None]
            tail = y[-xf:] * np.cos(k) + chunk[:xf] * np.sin(k)
            y = np.concatenate([y[:-xf], tail, chunk[xf:]])
        y = y[:need]
    env = np.ones(len(y))
    a = min(int(attack * SR), len(y) // 3)
    if a: env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    r = int(release * SR); rel_start = max(a, len(y) - r)
    env[rel_start:] *= np.linspace(1, 0, len(y) - rel_start) ** 2
    g = (vel / 100) ** 1.6
    return y * env[:, None] * g

def render_track(notes, chooser, attack, release, gain):
    out = np.zeros((total, 2))
    for (st, en, note, vel) in notes:
        bank_name = chooser(note)
        b = pick(BANKS[bank_name], note, vel)
        y = render_note(b, note, vel, max(0.3, en - st), attack, release)
        i = int(st * SR); j = min(total, i + len(y))
        out[i:j] += y[:j - i] * gain
    return out

def string_choice(n): return 'violin' if n >= 62 else ('viola' if n >= 50 else 'cello')
stems = {'piano': piano}
stems['violin'] = render_track([n for n in tracks.get('String', []) if n[2] >= 62], string_choice, .5, 1.1, .9)
stems['viola'] = render_track([n for n in tracks.get('String', []) if 50 <= n[2] < 62], string_choice, .5, 1.1, .85)
stems['celloPad'] = render_track([n for n in tracks.get('String', []) if n[2] < 50], string_choice, .5, 1.1, .8)
stems['cello'] = render_track(tracks.get('Cello', []), lambda n: 'cello', .22, .9, 1.0)
stems['bass'] = render_track(tracks.get('Bass', []), lambda n: 'bass', .25, .8, .9)
for k, v in stems.items():
    sf.write(f'{OUT}/stem-{k}.wav', v.astype(np.float32), SR, subtype='FLOAT')
    print('stem', k, 'peak', round(float(np.abs(v).max()), 3))

# ---------------- Mix ----------------
def pan(x, p, width=1.0):
    m = x.mean(1, keepdims=True); s = (x[:, :1] - x[:, 1:]) / 2
    x = np.hstack([m + s * width, m - s * width])
    th = (p + 1) * np.pi / 4
    return x * np.array([np.cos(th), np.sin(th)]) * np.sqrt(2)
def chain(x, fx): return Pedalboard(fx)(x.T.astype(np.float32), SR).T.astype(np.float64)
def lufs(x): return pyln.Meter(SR).integrated_loudness(x)

proc = {
  'piano':  (chain(stems['piano'], [HighpassFilter(40), PeakFilter(250, -2.0, .9), PeakFilter(3500, 1.5, .8), HighShelfFilter(10000, 1.0, .7)]), 0.0, 1.0, -0.0, .22),
  'violin': (chain(stems['violin'], [HighpassFilter(180), PeakFilter(400, -2, 1), PeakFilter(2800, 1.0, .8), LowpassFilter(13000)]), -0.45, .7, -6.5, .45),
  'viola':  (chain(stems['viola'], [HighpassFilter(120), PeakFilter(350, -2, 1), LowpassFilter(11000)]), 0.3, .7, -7.5, .45),
  'celloPad': (chain(stems['celloPad'], [HighpassFilter(60), PeakFilter(250, -1.5, 1), LowpassFilter(9000)]), 0.45, .6, -9.0, .4),
  'cello':  (chain(stems['cello'], [HighpassFilter(55), PeakFilter(300, -1.5, 1), PeakFilter(2200, 1.5, .9), LowpassFilter(10000)]), 0.2, .5, -4.5, .35),
  'bass':   (chain(stems['bass'], [HighpassFilter(30), PeakFilter(200, -1.5, 1), LowpassFilter(5000)]), 0.0, .3, -10.0, .2),
}
# level each stem relative to the piano by loudness, then apply the offset
ref = lufs(proc['piano'][0])
dry = np.zeros((total, 2)); send = np.zeros((total, 2)); report = {}
for k, (x, p, w, rel, s) in proc.items():
    L = lufs(x)
    if not np.isfinite(L): continue
    g = 10 ** ((ref + rel - L) / 20)
    y = pan(x * g, p, w)
    dry += y; send += y * s; report[k] = dict(lufs_raw=round(L, 1), rel_db=rel)

# synthetic hall IR: early reflections + decorrelated stereo tail, frequency-dependent decay
def hall_ir(sec=3.2, pre=0.022):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    bands = [(20, 250, 2.6), (250, 1200, 2.3), (1200, 4000, 1.8), (4000, 9000, 1.3), (9000, 20000, .8)]
    for ch in range(2):
        noise = rng.standard_normal(n)
        acc = np.zeros(n)
        for lo, hi, rt in bands:
            sos = signal.butter(4, [lo, min(hi, SR / 2 - 100)], 'bandpass', fs=SR, output='sos')
            acc += signal.sosfilt(sos, noise) * np.exp(-6.91 * t / rt)
        fade_in = np.clip(t / 0.06, 0, 1) ** 1.5
        ir[:, ch] = acc * fade_in
        for d, a in [(.011, .5), (.017, .4), (.023, .33), (.031, .28), (.043, .2), (.057, .15)]:
            ir[int((d + ch * .0023) * SR), ch] += a * (1 if rng.random() > .5 else -1) * 3
    ir = np.pad(ir, ((int(pre * SR), 0), (0, 0)))
    return ir / np.sqrt(np.sum(ir ** 2) / 2)
ir = hall_ir()
wet = np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:total] for c in range(2)], 1)
wet = chain(wet, [HighpassFilter(180), LowShelfFilter(400, -2, .7), LowpassFilter(8500)])
wet *= 10 ** ((lufs(dry) - 9.0 - lufs(wet)) / 20)   # tail sits ~9 LU under the dry mix
mix = dry + wet
mix = chain(mix, [Compressor(threshold_db=-22, ratio=1.8, attack_ms=30, release_ms=350)])

# trim lead-in, fade the tail after reverb
lead = int(np.argmax(np.abs(mix).max(1) > 1e-4)); lead = max(0, lead - int(.25 * SR))
mix = mix[lead:]
last = int((end_time + 3.5) * SR) - lead
fade = int(3.5 * SR); mix = mix[:last + fade]
mix[last:] *= np.cos(np.linspace(0, np.pi / 2, len(mix) - last))[:, None] ** 2
mix[:int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))[:, None]

# ---------------- Master ----------------
@njit(cache=True)
def smooth_gain(target, att, rel):
    g = 1.0; out = np.empty_like(target)
    for i in range(len(target)):
        t = target[i]
        g = g + (t - g) * (att if t < g else rel)
        out[i] = g
    return out
def true_peak_limit(x, ceiling_db=-1.2):
    c = 10 ** (ceiling_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[:len(x)]
    pk = np.pad(pk, (0, len(x) - len(pk)), constant_values=0)
    target = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    la = int(.005 * SR)
    target = minimum_filter1d(target, 2 * la + 1)
    g = smooth_gain(target, 1 - np.exp(-1 / (SR * .002)), 1 - np.exp(-1 / (SR * .12)))
    return x * g[:, None]
def tp(x): return 20 * np.log10(np.abs(signal.resample_poly(x, 4, 1, axis=0)).max())
for it in range(4):
    mix *= 10 ** ((-14.0 - lufs(mix)) / 20)
    mix = true_peak_limit(mix, -1.3)
    if abs(lufs(mix) + 14) < .15 and tp(mix) <= -1.0: break
res = dict(lufs=round(lufs(mix), 2), true_peak=round(tp(mix), 2), dur=round(len(mix) / SR, 1), stems=report)
print(json.dumps(res))
sf.write(f'{OUT}/studio-master.wav', mix.astype(np.float32), SR, subtype='PCM_24')
json.dump(res, open(f'{OUT}/report.json', 'w'), indent=1)
print('STUDIODONE')
