#!/usr/bin/env python3
"""Checks for Sedih 02 v4.
  v4tools.py st <master.wav>            short-term loudness profile (3 s windows, 1 s hop): intro mean, climax max, gap
  v4tools.py midi <file.mid>            same-pitch overlaps, stubs, string notes per section (violin/viola/cello), CC64 count
  v4tools.py bal <file.mid> <wav>       piano intro note level spread (first 18.3 s, channel 0)
  v4tools.py drops <stem-piano.wav>     sudden drops in the piano stem
"""
import sys, numpy as np, soundfile as sf, mido, pyloudnorm as pyln

def notes_of(mid):
    mf = mido.MidiFile(mid); t = 0; tempo = 500000; on = {}; out = []; cc = 0
    for m in mido.merge_tracks(mf.tracks):
        t += mido.tick2second(m.time, mf.ticks_per_beat, tempo)
        if m.type == 'set_tempo': tempo = m.tempo
        if m.type == 'control_change' and m.control == 64: cc += 1
        if m.type == 'note_on' and m.velocity > 0: on.setdefault((m.channel, m.note), []).append((t, m.velocity))
        elif m.type in ('note_off', 'note_on') and on.get((m.channel, m.note)):
            st, v = on[(m.channel, m.note)].pop(0); out.append((m.channel, st, t, m.note, v))
    return out, cc

cmd = sys.argv[1]
if cmd == 'st':
    x, sr = sf.read(sys.argv[2]); meter = pyln.Meter(sr, block_size=0.4)
    L = []
    for s in np.arange(0, len(x) / sr - 3, 1.0):
        seg = x[int(s * sr):int((s + 3) * sr)]
        try: v = meter.integrated_loudness(seg)
        except Exception: v = -70
        L.append(v if np.isfinite(v) else -70)
    L = np.array(L)
    intro = L[1:17].mean(); clim = L.max(); body = L[:int(len(L) - 12)]
    print('ST intro(1-17s) mean', round(intro, 1), 'max', round(clim, 1), 'at', int(L.argmax()), 's  gap', round(clim - intro, 1),
          ' p10', round(np.percentile(body, 10), 1), 'p95', round(np.percentile(body, 95), 1))
    print('ST every 10s', [round(v, 1) for v in L[::10]])
elif cmd == 'midi':
    ns, cc = notes_of(sys.argv[2])
    ov = []; stubs = []
    by = {}
    for n in ns: by.setdefault((n[0], n[3]), []).append(n)
    for k, lst in by.items():
        lst.sort(key=lambda n: n[1])
        for a, b in zip(lst, lst[1:]):
            if b[1] < a[2] - 1e-6: ov.append((k, round(a[1], 2), round(b[1], 2)))
        stubs += [(k, round(n[1], 2)) for n in lst if n[2] - n[1] < .08]
    s = [n for n in ns if n[0] == 3]
    vio = sum(n[3] >= 62 for n in s); vla = sum(50 <= n[3] < 62 for n in s); vc = sum(n[3] < 50 for n in s)
    print('overlaps', ov[:10], 'n', len(ov), '| stubs', stubs[:10], 'n', len(stubs), '| CC64 msgs', cc)
    print('string notes', len(s), 'violin', vio, 'viola', vla, 'cellopad', vc)
elif cmd == 'bal':
    ns, _ = notes_of(sys.argv[2])
    ev = sorted((n[1], n[3]) for n in ns if n[0] == 0 and n[1] < 18.3)
    x, sr = sf.read(sys.argv[3]); m = x.mean(1) if x.ndim > 1 else x
    L = [20 * np.log10(np.sqrt((m[int(t * sr):int((t + .25) * sr)] ** 2).mean()) + 1e-9) for t, n in ev]
    print('intro note levels', [round(l, 1) for l in L]); print('spread dB', round(max(L) - min(L), 1), 'std', round(float(np.std(L)), 1))
elif cmd == 'drops':
    x, sr = sf.read(sys.argv[2]); m = np.abs(x).mean(1)
    db = np.array([20 * np.log10(m[int(s * sr):int((s + .05) * sr)].mean() + 1e-9) for s in np.arange(0, len(m) / sr - .1, .05)])
    print('drops', [round(i * .05, 2) for i in range(2, len(db)) if db[i] < db[i - 2] - 10 and db[i - 2] > -40])
