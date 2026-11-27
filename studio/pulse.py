"""Loop-pulsing check: amplitude modulation of a sustained stem inside long notes.
Reports the 50 ms RMS envelope modulation (dB, p95-p5) inside held notes, split into
notes shorter than the raw sample (no loop) and longer (looped) for comparison."""
import sys, numpy as np, soundfile as sf, mido
from scipy.ndimage import uniform_filter1d
SR = 44100
stem, mid, track, lo, hi = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
x, _ = sf.read(stem); m = x.mean(1)
mf = mido.MidiFile(mid); tempo = 500000
for tr in mf.tracks:
    for msg in tr:
        if msg.type == 'set_tempo': tempo = msg.tempo; break
spt = tempo / mf.ticks_per_beat / 1e6
notes = []
for tr in mf.tracks:
    if tr.name != track: continue
    t, on = 0, {}
    for msg in tr:
        t += msg.time
        if msg.type == 'note_on' and msg.velocity > 0: on[msg.note] = t
        elif msg.type in ('note_on', 'note_off') and msg.note in on:
            s = on.pop(msg.note)
            if lo <= msg.note < hi: notes.append((s * spt, t * spt))
w = int(.05 * SR)
env = 20 * np.log10(np.sqrt(uniform_filter1d(m ** 2, w)) + 1e-9)
# regions where at least one note of this group is held >= 1.5 s past attack
mask = np.zeros(len(m), bool)
for s, e in notes:
    if e - s > 4: mask[int((s + 1.2) * SR):int((e - .2) * SR)] = True
seg = env[mask]
if len(seg):
    # remove slow trend (phrase dynamics) with 2 s moving average, look at 0.3-5 Hz wobble
    seg_full = np.where(mask, env, np.nan)
    trend = uniform_filter1d(np.nan_to_num(seg_full, nan=np.nanmean(seg)), 2 * SR)
    wob = (env - trend)[mask]
    print(track, lo, hi, 'held regions s', round(mask.sum() / SR, 1), 'wobble p5-p95 dB', round(np.percentile(wob, 95) - np.percentile(wob, 5), 2))
else:
    print('no long notes')
