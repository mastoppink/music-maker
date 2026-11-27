#!/usr/bin/env python3
"""Studio renderer for Music Maker (used by `--render studio` in cli/music-maker.js).

Piano    -> FluidSynth + Salamander Grand Piano V3 (CC BY 3.0, credit required) with a per-key
            loudness calibration, or Upright Piano KW (CC0, no credit). Legato sustain pedal (CC64).
Strings  -> own sampler over VSCO-2 Community Edition sustain samples (CC0) with simulated legato;
            the counter-line ('Cello kontra') gets portamento.
Bass     -> 'busur': bowed VSCO-2 contrabass (CC0), warm and rounded; 'petik': the app's own
            pizzicato bass (VSCO-2, CC0) taken from the app stem.
Guitar, drums, (pizzicato bass), Lo-fi vinyl noise -> the app's own render (CC0 samples), passed in
            as one stem (--sisa) at the app's balance.
Mix: levels matched to the app's balance (--ref), EQ for clarity (low-mid cut, gentle presence and
air), bass mono below 120 Hz, synthetic hall, glue compression; master to the target loudness with
a true-peak ceiling. Memory: float32 stems, about 30 MB per minute per stem.

Usage: render_studio.py --midi song.mid --ref ref.json --out song.wav [--sisa rest.wav]
        [--piano salamander|kw] [--bass busur|petik] [--assets DIR] [--target -14] [--lapor report.json]
"""
import argparse, glob, json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf, mido, pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import minimum_filter1d
from pedalboard import (Pedalboard, HighpassFilter, LowpassFilter, PeakFilter, HighShelfFilter,
                        LowShelfFilter, Compressor)

SR = 44100
ap = argparse.ArgumentParser()
ap.add_argument('--midi', required=True); ap.add_argument('--ref', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--sisa'); ap.add_argument('--piano', default='salamander', choices=['salamander', 'kw'])
ap.add_argument('--bass', default='petik', choices=['busur', 'petik'])
ap.add_argument('--assets', default=os.environ.get('MUSIC_MAKER_STUDIO', '/home/ubuntu/studio'))
ap.add_argument('--target', type=float, default=-14.0); ap.add_argument('--lapor')
A = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__))
REF = json.load(open(A.ref))
LOFI = REF.get('genre') == 'Lo-fi'
rng = np.random.default_rng(int(REF.get('seed', 1)) & 0xffffffff)
SF2 = {'salamander': 'sf/SalamanderGrandPiano-SF2-V3+20200602/SalamanderGrandPiano-V3+20200602.sf2',
       'kw': 'sf/UprightPianoKW-SF2-20220221/UprightPianoKW-20220221.sf2'}[A.piano]
SF2 = os.path.join(A.assets, SF2)
VS = os.path.join(A.assets, 'vsco/Strings/')
for need in (SF2, VS):
    if not os.path.exists(need): sys.exit(f'Bahan studio tidak ditemukan: {need}')
NOTES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}

# ---------------- MIDI ----------------
mf = mido.MidiFile(A.midi)
tempo = 500000
for tr in mf.tracks:
    for m in tr:
        if m.type == 'set_tempo': tempo = m.tempo; break
t2s = lambda tick: tick * tempo / mf.ticks_per_beat / 1e6   # the app writes one constant tempo
tracks = {}
for tr in mf.tracks:
    t, on, notes = 0, {}, []
    for m in tr:
        t += m.time
        if m.type == 'note_on' and m.velocity > 0: on.setdefault(m.note, []).append((t, m.velocity))
        elif m.type in ('note_off', 'note_on') and on.get(m.note):
            st, v = on[m.note].pop(0); notes.append((t2s(st), t2s(t), m.note, v))
    if notes: tracks[tr.name] = sorted(notes)
end_time = max(n[1] for ns in tracks.values() for n in ns)
sisa = None
if A.sisa and os.path.exists(A.sisa):
    sisa, _ = sf.read(A.sisa, dtype='float32', always_2d=True)
    sisa /= float(REF.get('sisaGain', 1.0))
total = int(max(end_time + 6.0, (len(sisa) / SR) if sisa is not None else 0) * SR)

# ---------------- Piano: FluidSynth, calibrated, legato pedal ----------------
def even_vel_table():
    cal = json.load(open(os.path.join(HERE, 'piano_cal_salamander.json')))
    cal = {int(k): {int(v): l for v, l in d.items()} for k, d in cal.items()}
    vels = sorted(next(iter(cal.values())).keys())
    ref = {v: float(np.median([cal[n][v] for n in cal])) for v in vels}
    def even(nt, v):
        if nt not in cal: return v
        vc = min(vels, key=lambda x: abs(x - min(max(v, vels[0]), vels[-1])))
        best = min(vels, key=lambda x: abs(cal[nt][x] - ref[vc]))
        return max(1, min(127, best + (v - vc)))
    return even
even = even_vel_table() if A.piano == 'salamander' else (lambda nt, v: v)
pm = mido.MidiFile(ticks_per_beat=mf.ticks_per_beat, type=0)
tr = mido.MidiTrack(); pm.tracks.append(tr)
evs = [(0, 0, mido.MetaMessage('set_tempo', tempo=tempo))]
s2t = lambda s: int(round(s * 1e6 / tempo * mf.ticks_per_beat))
for st, en, nt, v in tracks.get('Piano', []):
    evs.append((s2t(st), 2, mido.Message('note_on', note=nt, velocity=even(nt, v))))
    evs.append((s2t(en), 1, mido.Message('note_off', note=nt, velocity=0)))
# Legato pedal: lifted just after each bar line and pressed again, so the old chord blends into
# the new one for a moment instead of being cut.
for b in REF.get('takt', []):
    evs.append((s2t(b + .012), 0, mido.Message('control_change', control=64, value=0)))
    evs.append((s2t(b + .07), 0, mido.Message('control_change', control=64, value=110)))
evs.sort(key=lambda e: (e[0], e[1]))
last = 0
for tk, _, m in evs: tr.append(m.copy(time=tk - last)); last = tk
tmp = tempfile.mkdtemp(prefix='mm-studio-')
pm.save(tmp + '/piano.mid')
subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.5', '-r', str(SR), '-o', 'synth.polyphony=256',
                '-F', tmp + '/piano.wav', SF2, tmp + '/piano.mid'], check=True, capture_output=True)
piano, _ = sf.read(tmp + '/piano.wav', dtype='float32', always_2d=True)
piano = np.pad(piano, ((0, max(0, total - len(piano))), (0, 0)))[:total]
os.remove(tmp + '/piano.wav')

# ---------------- String sampler (VSCO-2 CE) ----------------
def load_bank(folder):
    bank = []
    for f in glob.glob(VS + folder + '/*.wav'):
        m = re.search(r'_([A-G]#?)(-?\d)_v(\d)', os.path.basename(f))
        if m: bank.append(dict(path=f, midi=12 * (int(m.group(2)) + 1) + NOTES[m.group(1)] + 12, layer=int(m.group(3))))
    return bank
BANKS = {'violin': load_bank('Violin Section/susVib'), 'viola': load_bank('Viola Section/susvib'),
         'cello': load_bank('Cello Section/susvib'), 'bass': load_bank('Solo Contrabass/SusVib')}
_cache, _shift = {}, {}
def sample_audio(path, midi_nominal):
    if path in _cache: return _cache[path]
    x, _ = sf.read(path, always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    mono = x.mean(1)
    env = np.convolve(np.abs(mono), np.ones(441) / 441, 'same')
    onset = max(0, int(np.argmax(env > env.max() * 0.03)) - 220)
    x = x[onset:]; mono = mono[onset:]
    seg = mono[SR:3 * SR]; cents = 0.0
    if len(seg) > SR:
        seg = seg - seg.mean(); N = 8 * len(seg)
        X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), N)); fr = np.fft.rfftfreq(N, 1 / SR)
        f_exp = 440 * 2 ** ((midi_nominal - 69) / 12); best = None
        for h in (1, 2, 3):
            msk = (fr > f_exp * h * .96) & (fr < f_exp * h * 1.04)
            if msk.any():
                c = 1200 * np.log2(fr[msk][np.argmax(X[msk])] / h / f_exp)
                if best is None or X[msk].max() > best[1]: best = (c, X[msk].max())
        if best and abs(best[0]) < 45: cents = best[0]
    sus = x[int(SR * .8):max(int(SR * .8) + SR, len(x) - int(SR * 1.5))]
    x = (x * (0.1 / (np.sqrt(np.mean(sus ** 2)) + 1e-9))).astype(np.float32)
    _cache[path] = (x, cents)
    return _cache[path]
def pick(bank, note, vel):
    layers = sorted({b['layer'] for b in bank})
    layer = layers[0] if vel < 82 else layers[-1]
    cand = [b for b in bank if b['layer'] == layer] or bank
    return min(cand, key=lambda b: (abs(b['midi'] - note), b['midi'] < note))
def shifted(b, note):
    key = (b['path'], note)
    if key not in _shift:
        x, cents = sample_audio(b['path'], b['midi'])
        ratio = 2 ** ((note - b['midi']) / 12 - cents / 1200)
        _shift[key] = (signal.resample(x, int(len(x) / ratio), axis=0) if abs(ratio - 1) > 1e-4 else x).astype(np.float32)
    return _shift[key]
def render_note(b, note, vel, dur, attack, release, offset=0.0, glide=0.0, handover=False):
    src = shifted(b, note)
    if offset: src = src[int(offset * SR):]
    need = int((dur + release) * SR)
    s0, s1 = int(SR * 1.2), len(src) - int(SR * 1.6)
    if need <= len(src) or s1 - s0 < SR * 2.5:
        y = src[:need] if need <= len(src) else np.pad(src, ((0, need - len(src)), (0, 0)))
    else:
        xf = int(SR * 2.0); y = src[:s1].copy()
        while len(y) < need:
            L = min(int(rng.uniform(2.0, 3.5) * SR), s1 - s0 - 1); st = int(rng.uniform(s0, s1 - L))
            chunk = src[st:st + L].copy()
            chunk *= np.clip((np.sqrt(np.mean(y[-xf:] ** 2)) + 1e-9) / (np.sqrt(np.mean(chunk[:xf] ** 2)) + 1e-9), .7, 1.4)
            k = np.linspace(0, np.pi / 2, xf)[:, None]
            y = np.concatenate([y[:-xf], y[-xf:] * np.cos(k) + chunk[:xf] * np.sin(k), chunk[xf:]])
        y = y[:need]
    if glide:
        G = int(.09 * SR); r = np.ones(len(y)); t = np.arange(min(G, len(y))) / G
        r[:len(t)] = 2 ** (glide / 12 * (1 - t) ** 2)
        pos = np.clip(np.cumsum(r) - r[0], 0, len(y) - 1)
        y = np.stack([np.interp(pos, np.arange(len(y)), y[:, c]) for c in range(2)], 1)
    env = np.ones(len(y), dtype=np.float32)
    a = min(int(attack * SR), len(y) // 3)
    if a: env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** (1 if offset else 2)
    rs = max(a, len(y) - int(release * SR))
    env[rs:] *= np.cos(np.linspace(0, np.pi / 2, len(y) - rs)) if handover else np.linspace(1, 0, len(y) - rs) ** 2
    return y * env[:, None] * (vel / 100) ** 1.6
def render_track(notes, chooser, attack, release, legato=False, glide=False):
    out = np.zeros((total, 2), dtype=np.float32)
    notes = sorted(notes); succ, pred = {}, {}
    if legato:
        starts = np.array([n[0] for n in notes])
        for i, (st, en, nt, v) in enumerate(notes):
            best = None
            for j in np.nonzero(np.abs(starts - en) <= .2)[0]:
                nt2 = notes[j][2]
                if j == i or j in pred or not (0 < abs(nt2 - nt) <= 5): continue
                if best is None or abs(nt2 - nt) < abs(notes[best][2] - nt): best = j
            if best is not None: succ[i] = best; pred[best] = i
    for i, (st, en, note, vel) in enumerate(notes):
        b = pick(BANKS[chooser(note)], note, vel)
        dur, rel, att, off, gl = max(0.3, en - st), release, attack, 0.0, 0.0
        if i in succ: dur = max(0.3, notes[succ[i]][0] - st); rel = .4
        if i in pred:
            att, off = .4, .55
            if glide: gl = float(notes[pred[i]][2] - note)
        y = render_note(b, note, vel, dur, att, rel, off, gl, handover=i in succ)
        k = int(st * SR); j = min(total, k + len(y))
        if j > k: out[k:j] += y[:j - k]
    return out
choice = lambda n: 'violin' if n >= 62 else ('viola' if n >= 50 else 'cello')
S = tracks.get('String', [])
stems = {'piano': piano,
         'violin': render_track([n for n in S if n[2] >= 62], choice, .5, 1.1, legato=True),
         'viola': render_track([n for n in S if 50 <= n[2] < 62], choice, .5, 1.1, legato=True),
         'celloPad': render_track([n for n in S if n[2] < 50], choice, .5, 1.1, legato=True),
         'kontra': render_track(tracks.get('Cello kontra', []), lambda n: 'cello', .2, .9, legato=True, glide=True)}
if A.bass == 'busur':
    # bowed bass one octave as written; soft attack, no clicky onset
    stems['bass'] = render_track(tracks.get('Bass', []), lambda n: 'bass', .3, .9)
_cache.clear(); _shift.clear()

# ---------------- Mix ----------------
def chain(x, fx): return Pedalboard(fx)(np.ascontiguousarray(x.T, dtype=np.float32), SR).T
meter = pyln.Meter(SR)
def lufs(x):
    v = meter.integrated_loudness(x.astype(np.float64)) if np.abs(x).max() > 1e-6 else -np.inf
    return v
def pan(x, p, width=1.0):
    m = x.mean(1, keepdims=True); s = (x[:, :1] - x[:, 1:]) / 2
    x = np.hstack([m + s * width, m - s * width]); th = (p + 1) * np.pi / 4
    return (x * np.array([np.cos(th), np.sin(th)], dtype=np.float32) * np.sqrt(2)).astype(np.float32)
def warmth(x, drive=1.6):
    # gentle tube-like saturation: soft rounding of the bass peaks, mostly even harmonics
    return (np.tanh(x * drive) / np.tanh(drive) * .85 + x * .15).astype(np.float32)
lofi_tone = [LowpassFilter(7500)] if LOFI else []
# Clarity: low-mid mud (200-400 Hz) cut on every melodic stem, gentle presence around 3 kHz and a
# soft air shelf on the piano only, no boost in the sibilant 6-8 kHz region.
FX = {
    'piano':    ([HighpassFilter(38), PeakFilter(280, -2.5, .9), PeakFilter(3000, 1.5, .7), PeakFilter(6800, -1.0, 1.5), HighShelfFilter(11000, 2.5, .7)] + lofi_tone, 0.0, 1.0, .22),
    'violin':   ([HighpassFilter(190), PeakFilter(380, -2.5, 1), PeakFilter(2600, 1.0, .8), LowpassFilter(12000)] + lofi_tone, -.5, .75, .45),
    'viola':    ([HighpassFilter(130), PeakFilter(330, -2.5, 1), LowpassFilter(10000)] + lofi_tone, .35, .7, .45),
    'celloPad': ([HighpassFilter(60), PeakFilter(260, -2.0, 1), LowpassFilter(7000)], .45, .6, .4),
    'kontra':   ([HighpassFilter(55), PeakFilter(250, -2.0, 1), PeakFilter(1800, 1.0, .9), LowpassFilter(6500)], .3, .5, .35),
    # deep but round: sub weight around 45-60 Hz, the boomy 120-140 Hz and the woolly 250 Hz pulled
    # down, nothing above ~1.2 kHz (no bow noise or clicks), slow gentle compression
    'bass':     ([HighpassFilter(28), LowShelfFilter(62, 4.5, .7), PeakFilter(130, -2.5, 1.0), PeakFilter(250, -2.0, 1), LowpassFilter(1200), Compressor(threshold_db=-24, ratio=2.0, attack_ms=40, release_ms=300)], 0.0, .0, .12),
}
ref_db = REF.get('ref', {})
# loudness of each studio stem relative to the app's matching instrument (keeps the app balance);
# small offsets: strings a touch fuller, counter-line under the tune
piano_ref = ref_db.get('Piano')
OFFSET = {'piano': 0.0, 'violin': -6.5, 'viola': -7.5, 'celloPad': -9.0, 'kontra': -5.0, 'bass': 0.0}
dry = np.zeros((total, 2), dtype=np.float32); send = np.zeros((total, 2), dtype=np.float32); report = {}
string_target = ref_db.get('String')
string_sum = None
proc = {}
for k in list(stems):
    x = stems.pop(k)
    if np.abs(x).max() < 1e-6: continue
    fx, p, w, s = FX[k]
    if k == 'bass': x = warmth(x)
    proc[k] = (pan(chain(x, fx), p, w), s)
# reference: the studio piano sits where the app's piano sat; strings as a group where the app's strings were
pl = lufs(proc['piano'][0]) if 'piano' in proc else None
gains = {}
for k, (y, s) in proc.items():
    L = lufs(y)
    if not np.isfinite(L): continue
    if k == 'piano' and piano_ref is not None: target = piano_ref
    elif k in ('violin', 'viola', 'celloPad') and string_target is not None: target = string_target + {'violin': -1.5, 'viola': -3.0, 'celloPad': -4.5}[k]
    elif k == 'kontra' and (string_target is not None or piano_ref is not None): target = (string_target if string_target is not None else piano_ref - 6) + 1.0
    elif k == 'bass' and ref_db.get('Bass') is not None: target = ref_db['Bass'] + 2.5
    else: target = (piano_ref if piano_ref is not None else -20) + OFFSET[k]
    gains[k] = 10 ** ((target - L) / 20)
    report[k] = dict(lufs_eigen=round(float(L), 1), target=round(float(target), 1))
for k, (y, s) in proc.items():
    if k not in gains: continue
    y = y * gains[k]; dry += y; send += y * s
del proc
if sisa is not None:
    rest = np.zeros((total, 2), dtype=np.float32); n = min(total, len(sisa)); rest[:n] = sisa[:n]
    rest = chain(rest, [HighpassFilter(28), LowShelfFilter(60, 2.0, .7), PeakFilter(320, -1.5, .9)])
    dry += rest; send += rest * .08
    report['sisa_app'] = dict(lufs_eigen=round(float(lufs(rest)), 1))
    del rest, sisa

def hall_ir(sec=2.8, pre=0.02):
    n = int(sec * SR); t = np.arange(n) / SR; ir = np.zeros((n, 2))
    bands = [(20, 250, 2.2), (250, 1200, 2.1), (1200, 4000, 1.7), (4000, 9000, 1.2), (9000, 20000, .7)]
    r2 = np.random.default_rng(7)
    for ch in range(2):
        noise = r2.standard_normal(n); acc = np.zeros(n)
        for lo, hi, rt in bands:
            sos = signal.butter(4, [lo, min(hi, SR / 2 - 100)], 'bandpass', fs=SR, output='sos')
            acc += signal.sosfilt(sos, noise) * np.exp(-6.91 * t / rt)
        ir[:, ch] = acc * np.clip(t / .06, 0, 1) ** 1.5
        for d, a in [(.011, .5), (.017, .4), (.023, .33), (.031, .28), (.043, .2), (.057, .15)]:
            ir[int((d + ch * .0023) * SR), ch] += a * (1 if r2.random() > .5 else -1) * 3
    ir = np.pad(ir, ((int(pre * SR), 0), (0, 0)))
    return (ir / np.sqrt(np.sum(ir ** 2) / 2)).astype(np.float32)
ir = hall_ir()
wet = np.stack([signal.oaconvolve(send[:, c], ir[:, c])[:total] for c in range(2)], 1).astype(np.float32)
del send
wet = chain(wet, [HighpassFilter(200), LowShelfFilter(450, -2.5, .7), LowpassFilter(8000)])
wet *= 10 ** ((lufs(dry) - 10.0 - lufs(wet)) / 20)
mix = dry + wet; del dry, wet
# Bass in mono below ~120 Hz (comfortable on headphones, safe on phones and in mono)
sos = signal.butter(4, 120, 'lowpass', fs=SR, output='sos')
low = signal.sosfiltfilt(sos, mix, axis=0).astype(np.float32)
mix = mix - low + low.mean(1, keepdims=True)
mix = chain(mix, [PeakFilter(300, -1.0, .8), HighShelfFilter(10000, 1.5, .7), Compressor(threshold_db=-22, ratio=1.7, attack_ms=35, release_ms=350)])
# Trim silence at both ends (long mixes join songs with a crossfade, so a silent tail would leave a
# gap): start 0.15 s before the first sound, end where the reverb tail falls 60 dB below the peak,
# with a 2 s fade into that point.
blk = int(.05 * SR); nb = len(mix) // blk
lev = 20 * np.log10(np.sqrt((mix[:nb * blk] ** 2).mean(1).reshape(nb, blk).mean(1)) + 1e-12)
on = np.nonzero(lev > lev.max() - 60)[0]
first = max(0, on[0] * blk - int(.15 * SR)) if len(on) else 0
last = min(len(mix), (on[-1] + 1) * blk) if len(on) else len(mix)
mix = mix[first:last]
fade = min(int(2.0 * SR), len(mix) // 4)
mix[-fade:] *= (np.cos(np.linspace(0, np.pi / 2, fade)) ** 2)[:, None]

# ---------------- Master ----------------
def _smooth_py(target, a_att, a_rel):
    g = np.empty_like(target); cur = 1.0
    for i in range(len(target)):
        t = target[i]; cur += (t - cur) * (a_att if t < cur else a_rel); g[i] = cur
    return g
try:
    from numba import njit
    _smooth = njit(cache=True)(_smooth_py)
except Exception:
    _smooth = _smooth_py
def true_peak_limit(x, ceiling_db=-1.35):
    # look-ahead true-peak limiter: 4x oversampled peaks, gain down in 2 ms, back up in 120 ms
    c = 10 ** (ceiling_db / 20)
    pk = np.concatenate([np.abs(signal.resample_poly(x[i:i + SR * 20], 4, 1, axis=0)).max(1).reshape(-1, 4).max(1)
                         for i in range(0, len(x), SR * 20)])[:len(x)]
    pk = np.pad(pk, (0, len(x) - len(pk)))
    target = minimum_filter1d(np.minimum(1.0, c / np.maximum(pk, 1e-9)), 2 * int(.005 * SR) + 1).astype(np.float64)
    g = _smooth(target, 1 - np.exp(-1 / (SR * .002)), 1 - np.exp(-1 / (SR * .12)))
    return x * g[:, None].astype(np.float32)
def tp(x): return 20 * np.log10(max(float(np.abs(signal.resample_poly(x[i:i + SR * 20], 4, 1, axis=0)).max()) for i in range(0, len(x), SR * 20)))
for it in range(4):
    mix = mix * 10 ** ((A.target - lufs(mix)) / 20)
    mix = true_peak_limit(mix.astype(np.float32), -1.35)
    if abs(lufs(mix) - A.target) < .15 and tp(mix) <= -1.2: break

# ---------------- Report: spectrum balance, mono, sub level ----------------
def bands(x):
    m = x.mean(1).astype(np.float64)
    f, P = signal.welch(m, SR, nperseg=8192)
    tot = P.sum()
    def b(lo, hi): return round(float(10 * np.log10(P[(f >= lo) & (f < hi)].sum() / tot + 1e-12)), 1)
    return dict(sub_20_60=b(20, 60), bass_60_150=b(60, 150), lowmid_200_400=b(200, 400), mid_400_2k=b(400, 2000),
                presence_2k_5k=b(2000, 5000), sibilance_5k_8k=b(5000, 8000), air_8k_16k=b(8000, 16000))
mono = mix.mean(1)
res = dict(lufs=round(float(lufs(mix)), 2), true_peak=round(float(tp(mix)), 2), durasi=round(len(mix) / SR, 1),
           mono_vs_stereo_db=round(float(10 * np.log10(np.mean(mono ** 2) / (np.mean(mix ** 2) + 1e-12) + 1e-12)), 2),
           spektrum=bands(mix), piano=A.piano, bass=A.bass, stem=report)
out_tmp = A.out + '.f32.wav'
sf.write(out_tmp, mix.astype(np.float32), SR, subtype='FLOAT')
del mix
# 16-bit 44.1 kHz with a plain 44-byte header (the CLI joins long mixes on disk)
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', out_tmp, '-c:a', 'pcm_s16le', '-map_metadata', '-1',
                '-fflags', '+bitexact', '-flags:a', '+bitexact', '-f', 'wav', A.out], check=True)
os.remove(out_tmp)
if A.lapor: json.dump(res, open(A.lapor, "w"), indent=1, default=float)
print(json.dumps(res, default=float))
