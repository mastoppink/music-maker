#!/usr/bin/env python3
"""Hand-composed sad piece 'Sedih 01' (E minor, 56 BPM, 4/4) -> MIDI for studio_render.py.
Form: Intro(4) A(8, ends on V = question) A'(8, answers home) B(8, climax A5) A''(8, soft) Outro(4).
Built from one 2-bar motif (falling dotted figure + rising answer), sequenced and varied.
Tracks: Piano (melody + broken-chord accompaniment), String (pads), Cello (counter-line), Bass.
"""
import sys, json, random
import mido

random.seed(11)
TPB = 480
BPM = 56
OUT = sys.argv[1] if len(sys.argv) > 1 else 'sedih01.mid'

PC = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
CH = {  # chord tones as pitch classes, root first
 'Em':['E','G','B'], 'C':['C','E','G'], 'G':['G','B','D'], 'D':['D','F#','A'],
 'Am':['A','C','E'], 'B7':['B','D#','F#','A'], 'F#o':['F#','A','C','E'], 'Emadd9':['E','G','B','F#'],
}
def pcs(ch): return [PC[n] for n in CH[ch]]
def near(pc, lo, hi):
    return [n for n in range(lo, hi + 1) if n % 12 == pc]

# ---------- harmony per section (one chord per bar) ----------
S = {
 'intro': ['Em','Emadd9','C','C'],
 'A':     ['Em','C','G','D','Am','C','B7','B7'],
 'A2':    ['Em','C','G','D','Am','B7','Em','Em'],
 'B':     ['Am','Em','C','G','Am','F#o','B7','B7'],
 'A3':    ['Em','C','G','D','Am','B7','Em','Em'],
 'outro': ['C','Am','Em','Em'],
}
ORDER = ['intro','A','A2','B','A3','outro']

# ---------- melody: (beat, length, midi) per bar ----------
m = lambda *xs: list(xs)
MOTIF  = m((0,1.5,71),(1.5,.5,69),(2,2,67))          # B A G  (falling sigh)
ANS    = m((0,1,64),(1,1,67),(2,2,72))                # E G C  (rising question)
MEL = {
 'intro': [[],[],[],[]],
 'A':  [MOTIF, ANS,
        m((0,1.5,74),(1.5,.5,72),(2,2,71)),            # motif sequenced up (D C B)
        m((0,2,69),(2,1,66),(3,1,67)),
        m((0,1.5,72),(1.5,.5,71),(2,2,69)),            # motif on Am (C B A)
        m((0,1,67),(1,1,72),(2,2,76)),                 # reaching up to E5
        m((0,2,75),(2,1,72),(3,1,71)),
        m((0,3.5,71))],                                # hangs on B = question
 'A2': [m((0,1.5,71),(1.5,.25,72),(1.75,.25,71),(2,2,67)),   # motif with a turn
        ANS,
        m((0,1.5,74),(1.5,.5,72),(2,2,71)),
        m((0,2,69),(2,1,66),(3,1,67)),
        m((0,1.5,72),(1.5,.5,71),(2,2,69)),
        m((0,1,66),(1,1,71),(2,2,75)),
        m((0,2,71),(2,2,67)),
        m((0,3.5,64))],                                # answers home on E
 'B':  [m((0,1.5,76),(1.5,.5,74),(2,2,72)),            # motif up a sixth (E D C)
        m((0,1,71),(1,1,74),(2,2,79)),
        m((0,1.5,79),(1.5,.5,78),(2,2,76)),
        m((0,1,74),(1,1,76),(2,2,79)),
        m((0,2,81),(2,1,79),(3,1,76)),                 # climax A5
        m((0,1.5,78),(1.5,.5,76),(2,2,72)),
        m((0,2,75),(2,2,78)),
        m((0,3,71),(3,1,69))],
 'A3': None,  # filled below: A2 melody, softer, last bar longer
 'outro': [m((0,1.5,71),(1.5,.5,69),(2,2,67)), m((0,3,64)), [], []],
}
MEL['A3'] = [list(b) for b in MEL['A2']]
MEL['A3'][7] = m((0,4,64))

# dynamics (melody base velocity per section) and accompaniment velocity
DYN = {'intro':(0,38),'A':(64,40),'A2':(68,42),'B':(78,48),'A3':(58,36),'outro':(52,32)}

events = {'Piano':[], 'String':[], 'Cello':[], 'Bass':[]}   # (start_beat, len_beats, note, vel)
bar0 = 0
prev_cello = 52
melody = []
for sec in ORDER:
    chords = S[sec]; mel = MEL[sec]; mv, av = DYN[sec]
    for i, ch in enumerate(chords):
        b = (bar0 + i) * 4
        tones = pcs(ch)
        # phrase arc: rise to bar 5 of 8, relax at the ends
        n = len(chords); arc = 1 - abs((i + .5) / n - .6) * 1.1
        # ---- melody
        for (bt, ln, nt) in mel[i]:
            v = int(mv * (.86 + .2 * arc) + (6 if bt == 0 else 0))
            events['Piano'].append((b + bt, ln, nt, min(100, v))); melody.append((b + bt, ln, nt, v))
        # ---- broken-chord accompaniment (eighths, held like a sustain pedal)
        root = near(tones[0], 40, 51)[0]
        fifth = root + 7
        third = near(tones[1], root + 12, root + 23)[0]
        top = near(tones[2] if len(tones) > 2 else tones[0], root + 12, root + 26)
        top = top[-1] if top else root + 19
        if ch == 'B7': fifth = root + 7
        pat = [root, fifth, root + 12, third, top, third, root + 12, fifth]
        last_bar = sec == 'outro' and i == 3
        if last_bar:
            for k, nt in enumerate([root, fifth, root + 12, third, top]):
                events['Piano'].append((b + k * .18, 6, nt, av + 6))
        else:
            for k, nt in enumerate(pat):
                hold = 4 - k * .5            # pedal: everything rings to the bar line
                v = av + (6 if k == 0 else 0) + (3 if k == 4 else 0)
                events['Piano'].append((b + k * .5, hold, nt, int(v * (.9 + .15 * arc))))
        # ---- strings: enter at A2, fuller in B, thinner in A3
        if sec in ('A2','B','A3'):
            lo, hi = (55, 74) if sec != 'B' else (57, 79)
            voic = []
            for pc in tones[:3]:
                c = near(pc, lo, hi); voic.append(c[len(c) // 2] if sec != 'A3' else c[0])
            if sec == 'B' and i >= 4: voic.append(near(tones[0], 76, 88)[0])
            sv = {'A2':60,'B':74,'A3':52}[sec]
            for nt in voic:
                events['String'].append((b, 4.1, nt, int(sv * (.85 + .25 * arc))))
        # ---- cello counter-line: two half notes, stepwise toward chord tones (A2, B, A3)
        if sec in ('A2','B','A3'):
            for half in (0, 2):
                pc = tones[1] if half == 0 else tones[0]
                cands = near(pc, 45, 62)
                nt = min(cands, key=lambda c: abs(c - prev_cello))
                prev_cello = nt
                cv = {'A2':62,'B':74,'A3':54}[sec]
                events['Cello'].append((b + half, 2.05, nt, cv))
        # ---- bass: root whole notes from A
        if sec in ('A','A2','B','A3') or (sec == 'outro' and i < 3):
            events['Bass'].append((b, 4.0, near(tones[0], 28, 39)[0], 70 if sec == 'B' else 60))
    bar0 += len(chords)
total_bars = bar0

# ---------- humanise ----------
MSET = {(a, b_, c) for a, b_, c, _ in melody}
def human(ev, jitter=.018, track=''):
    out = []
    for (st, ln, nt, v) in ev:
        j = random.uniform(-jitter, jitter) * BPM / 60      # seconds -> beats
        if track == 'Piano' and (st, ln, nt) in MSET: j += .02 * BPM / 60  # melody sits a hair behind
        out.append((max(0, st + j), ln, nt, max(1, min(127, v + random.randint(-3, 3)))))
    return out

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
           motif_bars=sum(1 for s in ORDER for bar in MEL[s] if len(bar) >= 3 and bar[0][1] == 1.5 and bar[1][1] in (.5, .25)),
           climax='A5 (81) in B bar 5', cadences='A ends on B (V, question); A2/A3 end on E (i, answer)')
print(json.dumps(rep))
