#!/usr/bin/env python3
"""Hand-composed sad piece 'Sedih 02' (D minor, 52 BPM, 4/4) -> MIDI for studio_render_legato.py.
Form: Intro(4) A(8, ends on V = question) A'(8, answers home) B(8, climax D6) A''(8, soft) Outro(4).
Motif: rising minor sixth (A4->F5) then stepwise fall (E5 D5) - opposite contour to Sedih 01's falling sigh.
Progression: i-iv-VII-III-VI-ii(o)-V7 (descending-fifths circle), climax on VI.
Accompaniment: dotted rising arpeggio (different from Sedih 01's up-down eighths).
"""
import sys, json, random, itertools
import mido

random.seed(23)
TPB = 480
BPM = 52
OUT = sys.argv[1] if len(sys.argv) > 1 else 'sedih02.mid'

PC = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
CH = {  # chord tones as pitch classes, root first (A# = Bb)
 'Dm':['D','F','A'], 'Gm':['G','A#','D'], 'C':['C','E','G'], 'F':['F','A','C'],
 'Bb':['A#','D','F'], 'Eo':['E','G','A#'], 'A7':['A','C#','E','G'], 'Asus4':['A','D','E'],
 'Dmadd9':['D','F','A','E'],
}
def pcs(ch): return [PC[n] for n in CH[ch]]
def near(pc, lo, hi):
    return [n for n in range(lo, hi + 1) if n % 12 == pc]

S = {
 'intro': ['Dm','Dmadd9','Bb','Asus4'],
 'A':     ['Dm','Gm','C','F','Bb','Eo','A7','A7'],
 'A2':    ['Dm','Gm','C','F','Bb','Gm','A7','Dm'],
 'B':     ['Bb','F','Gm','Dm','Bb','C','A7','A7'],
 'A3':    ['Dm','Gm','C','F','Bb','Gm','A7','Dm'],
 'outro': ['Bb','Gm','Dm','Dm'],
}
ORDER = ['intro','A','A2','B','A3','outro']

m = lambda *xs: list(xs)
MOTIF = m((0,1,69),(1,1.5,77),(2.5,.5,76),(3,1,74))      # A F E D : rise a sixth, fall by step
ANS   = m((0,1.5,74),(1.5,.5,72),(2,2,70))                # D C Bb : stepwise sigh on iv
MEL = {
 'intro': [[],[],[],[]],
 'A':  [MOTIF, ANS,
        m((0,1,67),(1,1.5,76),(2.5,.5,74),(3,1,72)),      # motif a step down (G E D C)
        m((0,1.5,72),(1.5,.5,70),(2,2,69)),
        m((0,1,65),(1,1.5,74),(2.5,.5,72),(3,1,70)),      # motif on VI (F D C Bb)
        m((0,1.5,70),(1.5,.5,69),(2,2,67)),
        m((0,1,69),(1,1,73),(2,2,76)),                    # A C# E rising question
        m((0,1,76),(1,2.5,73))],                          # hangs on C# = question
 'A2': [m((0,1,69),(1,1,77),(2,.25,79),(2.25,.25,77),(2.5,.5,76),(3,1,74)),   # motif with a turn
        ANS,
        m((0,1,67),(1,1.5,76),(2.5,.5,74),(3,1,72)),
        m((0,1.5,72),(1.5,.5,70),(2,2,69)),
        m((0,1,65),(1,1.5,74),(2.5,.5,72),(3,1,70)),
        m((0,1,70),(1,1,74),(2,2,79)),                    # Bb D G reaching up
        m((0,2,76),(2,1,73),(3,1,69)),
        m((0,3.5,74))],                                   # answers home on D
 'B':  [m((0,1,70),(1,1.5,77),(2.5,.5,76),(3,1,74)),      # motif from Bb (rising fifth variant)
        m((0,1.5,81),(1.5,.5,79),(2,2,77)),
        m((0,1,74),(1,1.5,82),(2.5,.5,81),(3,1,79)),      # motif up: D Bb A G
        m((0,1,74),(1,1,77),(2,2,81)),
        m((0,1,82),(1,2,86),(3,.5,84),(3.5,.5,82)),       # CLIMAX D6
        m((0,1.5,84),(1.5,.5,82),(2,2,79)),
        m((0,2,81),(2,1,79),(3,1,76)),
        m((0,3,73),(3,1,76))],
 'A3': None,
 'outro': [m((0,1,65),(1,1.5,74),(2.5,.5,72),(3,1,70)), m((0,2,70),(2,2,69)), m((0,4,74)), []],
}
MEL['A3'] = [list(b) for b in MEL['A2']]
MEL['A3'][7] = m((0,4,74))

DYN = {'intro':(0,36),'A':(62,39),'A2':(66,41),'B':(78,47),'A3':(56,35),'outro':(50,31)}

events = {'Piano':[], 'String':[], 'Cello':[], 'Bass':[]}
bar0 = 0
prev_cello = 57
PAD = {'prev': None, 'active': {}}
melody = []
for sec in ORDER:
    chords = S[sec]; mel = MEL[sec]; mv, av = DYN[sec]
    for i, ch in enumerate(chords):
        b = (bar0 + i) * 4
        tones = pcs(ch)
        n = len(chords); arc = 1 - abs((i + .5) / n - .6) * 1.1
        for (bt, ln, nt) in mel[i]:
            v = int(mv * (.86 + .2 * arc) + (6 if bt == 0 else 0))
            events['Piano'].append((b + bt, ln, nt, min(100, v))); melody.append((b + bt, ln, nt, v))
        # ---- accompaniment: steady rising eighths, settling into quarters on beats 3-4
        root = near(tones[0], 38, 49)[-1] if near(tones[0], 38, 49)[-1] >= 41 else near(tones[0], 38, 49)[-1] + 12
        fifth = root + 7 if ch not in ('Eo',) else root + 6
        third = near(tones[1], root + 12, root + 23)[0]
        top = near(tones[2], root + 12, root + 26)[-1]
        last_bar = sec == 'outro' and i == 3
        if last_bar:
            for k, nt in enumerate([root, fifth, root + 12, third, top]):
                events['Piano'].append((b + k * .2, 6, nt, av + 6))
        else:
            pat = [(0, root, 0), (.5, fifth, 0), (1, root + 12, 0), (1.5, third, 0), (2, top, 0), (3, third, 0)]   # steady pulse (old dotted pattern limped)
            for (pos, nt, acc) in pat:
                events['Piano'].append((b + pos, 4 - pos, nt, int((av + acc) * (.95 + .07 * arc))))
        # ---- strings: voice-led, common tones tied (A2, B, A3); a single high violin line in intro end/outro
        if sec in ('A2','B','A3'):
            lo, hi = (52, 72) if sec != 'B' else (55, 79)   # spans viola + violin sections
            opts = [near(pc, lo, hi) for pc in tones[:3]]
            cands = [sorted(c) for c in itertools.product(*opts) if max(c) - min(c) <= 14]
            if PAD['prev']:
                voic = min(cands, key=lambda c: sum(abs(a - b_) for a, b_ in zip(c, PAD['prev'])))
            else:
                voic = min(cands, key=lambda c: abs(sum(c) / 3 - 61))
            PAD['prev'] = voic
            voic = list(voic)
            if sec == 'B' and i >= 3: voic.append(near(tones[0], 76, 88)[0])
            sv = {'A2':58,'B':74,'A3':50}[sec]
            still = {}
            for nt in voic:
                if nt in PAD['active'] and PAD['active'][nt][0] + PAD['active'][nt][1] >= b - .01:
                    k = PAD['active'][nt][2]
                    st0, ln0, n0, v0 = events['String'][k]
                    events['String'][k] = (st0, b + 4.1 - st0, n0, v0)
                    still[nt] = (st0, b + 4.1 - st0, k)
                else:
                    events['String'].append((b, 4.1, nt, int(sv * (.85 + .25 * arc))))
                    still[nt] = (b, 4.1, len(events['String']) - 1)
            PAD['active'] = still
        else:
            PAD['active'] = {}
        # ---- cello counter-melody (A2, B, A3): moves in contrary motion to the melody, by step where possible
        if sec in ('A2','B','A3'):
            mnotes = [x[2] for x in mel[i]]
            mdir = (mnotes[-1] - mnotes[0]) if len(mnotes) > 1 else 0
            beats = (0, 2) if sec != 'B' else (0, 1, 2, 3)
            for bt in beats:
                allc = [c for pc in tones for c in near(pc, 45, 64)]
                movers = [c for c in allc if c != prev_cello and abs(c - prev_cello) <= 5] or allc
                if mdir > 0: pref = [c for c in movers if c < prev_cello] or movers     # melody up -> cello down
                elif mdir < 0: pref = [c for c in movers if c > prev_cello] or movers
                else: pref = movers
                nt = min(pref, key=lambda c: abs(c - prev_cello))
                prev_cello = nt
                cv = {'A2':60,'B':72,'A3':52}[sec]
                ln = 2.0 if sec != 'B' else 1.0
                events['Cello'].append((b + bt, ln, nt, cv))
        # ---- bass: root, plus fifth on beat 3 in A2/B
        if sec in ('A','A2','B','A3') or (sec == 'outro' and i < 3):
            r = near(tones[0], 28, 40)[0]
            bv = 70 if sec == 'B' else 58
            if sec in ('A2','B') and ch != 'Eo':
                events['Bass'].append((b, 2.0, r, bv)); events['Bass'].append((b + 2, 2.0, r + 7 if r + 7 <= 45 else r - 5, bv - 6))
            else:
                events['Bass'].append((b, 4.0, r, bv))
    bar0 += len(chords)
total_bars = bar0

# ---------- humanise ----------
MSET = {(a, b_, c) for a, b_, c, _ in melody}
def human(ev, jitter=.018, track=''):
    out = []
    for (st, ln, nt, v) in ev:
        j = random.uniform(-jitter, jitter) * BPM / 60      # seconds -> beats
        if track == 'Piano' and (st, ln, nt) in MSET: j += .02 * BPM / 60  # melody sits a hair behind
        vj = 1 if (track == 'Piano' and v < 55) else 3   # accompaniment: tiny jitter so notes stay even
        out.append((max(0, st + j), ln, nt, max(1, min(127, v + random.randint(-vj, vj)))))
    return out

# ---------- piano loudness calibration (Salamander samples are uneven per key, e.g. A3 ~10 dB weaker) ----------
import json as _json, os as _os, statistics as _st
_CAL = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'piano_cal_salamander.json')))
_CAL = {int(k): {int(v): l for v, l in d.items()} for k, d in _CAL.items()}
_VELS = sorted(next(iter(_CAL.values())).keys())
_REF = {v: _st.median(_CAL[n][v] for n in _CAL) for v in _VELS}
def even_vel(nt, v):
    if nt not in _CAL: return v
    vc = min(max(v, _VELS[0]), _VELS[-1]); vc = min(_VELS, key=lambda x: abs(x - vc))
    target = _REF[vc]
    best = min(_VELS, key=lambda x: abs(_CAL[nt][x] - target))
    return max(1, min(127, best + (v - vc)))
for _k in range(len(events['Piano'])):
    st_, ln_, nt_, v_ = events['Piano'][_k]
    events['Piano'][_k] = (st_, ln_, nt_, even_vel(nt_, v_))

# ---------- write MIDI with a closing ritardando ----------
mf = mido.MidiFile(type=1, ticks_per_beat=TPB)
meta = mido.MidiTrack(); meta.name = 'Music Maker'; mf.tracks.append(meta)
meta.append(mido.MetaMessage('time_signature', numerator=4, denominator=4, time=0))
tempo_pts = [(0, BPM)]
rit_start = (total_bars - 4) * 4
for k in range(17):                                   # slow down over the last 4 bars
    tempo_pts.append((rit_start + k, BPM * (1 - .28 * (k / 16) ** 1.5)))
# small breath before the climax section and before the return
b_start = (4 + 8 + 8) * 4; a3_start = b_start + 32
tempo_pts += [(b_start - 1, BPM * .93), (b_start, BPM), (a3_start - 1, BPM * .9), (a3_start, BPM * .97)]
tempo_pts.sort()
last = 0
for beat, bpm in tempo_pts:
    t = int(beat * TPB)
    meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=t - last)); last = t

PROG = {'Piano':(0,0), 'String':(3,48), 'Bass':(2,32), 'Cello':(7,42)}
for name in ['Piano','String','Bass','Cello']:
    ch, prog = PROG[name]
    tr = mido.MidiTrack(); tr.name = name; mf.tracks.append(tr)
    tr.append(mido.MetaMessage('track_name', name=name, time=0))
    tr.append(mido.Message('program_change', channel=ch, program=prog, time=0))
    msgs = []
    ev = sorted(human(events[name], track=name))
    if name == 'Piano':   # pedal feel: let accompaniment ring a little past the bar line
        ev = [(st, ln + (.3 if v < 50 else 0), nt, v) for (st, ln, nt, v) in ev]
    # FIX: a repeated pitch must end BEFORE it is struck again, otherwise the old
    # note-off silences the new note (this cut the piano at ~0:04)
    # FIX 2: melody and accompaniment hitting the SAME pitch at (almost) the same time
    # used to produce a 0.05-beat stub whose note-off cut the other one (heard at ~2:37).
    # Merge them into one note: loudest velocity, longest length.
    merged = []
    for e in ev:
        for k, m_ in enumerate(merged):
            if m_[2] == e[2] and abs(m_[0] - e[0]) < .15:
                merged[k] = (min(m_[0], e[0]), max(m_[0] + m_[1], e[0] + e[1]) - min(m_[0], e[0]), e[2], max(m_[3], e[3])); break
        else: merged.append(e)
    ev = sorted(merged)
    nxt = {}
    fixed = []
    for (st, ln, nt, v) in reversed(ev):
        en = st + ln
        if nt in nxt and en > nxt[nt] - .02: en = nxt[nt] - .02
        nxt[nt] = st
        fixed.append((st, max(.05, en - st), nt, v))
    for (st, ln, nt, v) in fixed:
        msgs.append((int(st * TPB), 1, nt, v)); msgs.append((int((st + ln) * TPB), 0, nt, 0))
    msgs.sort(key=lambda x: (x[0], x[1]))
    lt = 0
    for t, on, nt, v in msgs:
        tr.append(mido.Message('note_on' if on else 'note_off', channel=ch, note=nt, velocity=v if on else 0, time=t - lt)); lt = t
mf.save(OUT)

# ---------- measurable report ----------
notes = [e[2] for e in sorted(melody)]
leaps = [abs(b - a) for a, b in zip(notes, notes[1:])]
rep = dict(bars=total_bars, seconds=round(mf.length, 1), melody_notes=len(notes),
           melody_range=[min(notes), max(notes)], biggest_leap=max(leaps),
           stepwise_share=round(sum(l <= 2 for l in leaps) / len(leaps), 2),
           motif_bars=sum(1 for s in ORDER for bar in MEL[s] if len(bar) >= 4 and bar[0][1] == 1 and bar[1][0] == 1 and bar[1][2] - bar[0][2] >= 7),
           climax='D6 (86) in B bar 5', cadences='A ends on C# over A7 (V, question); A2/A3 end on D (i, answer)')
print(json.dumps(rep))
