"""Komposer: writes a complete sad / melancholic song the way the hand-composed
SadnessMelody pieces were written (Kursi Kosong, Surat untuk Ibu, Hujan Terakhir,
Jendela Berembun, Selimut di Lantai, Pesan yang Tak Terkirim).

What it codifies from those pieces
- One MOTIF (a rising "call" bar) and its ANSWER (a falling "sigh" bar, usually
  starting on an appoggiatura that resolves down by step). The whole song is built
  from them: repeated, sequenced higher, inverted/widened for the B section,
  broken into fragments in the coda.
- Periods of question (ends on V) and answer (deceptive V-VI or home).
- Form: Intro - A (16) - B (climax) - A' (theme returns over a chromatic lament
  bass) - Coda (unresolved add9).
- Darker harmony: Neapolitan at the climax, deceptive cadences, lament bass,
  4-3 / 9-8 suspensions, half-diminished ii, iv over a tonic pedal.
- A single real CLIMAX (highest note of the song, held over the Neapolitan),
  then a step / chromatic fall.
- Variety between songs: key, metre (4/4, 3/4, 6/8), tempo, lead (piano solo,
  cello over piano, piano + strings), intro gesture, accompaniment figures.
- Expressive dynamics (phrase arcs, climax) and rubato (breaths, broadening,
  final ritardando). Pedal follows the harmony.

Melody notes are not drawn at random: for every bar the engine tries the motif's
contour from many start notes and keeps the version that best obeys the voice-
leading rules (chord tones on strong beats or a resolving appoggiatura, stepwise
motion, no awkward leaps, reaches the phrase target).
"""
import random
from .song import Song

# --------------------------------------------------------------------------- harmony
CHORDS = {
    'i': (0, [0, 3, 7]), 'i7': (0, [0, 3, 7, 10]), 'iadd9': (0, [0, 3, 7, 2]),
    'iv': (5, [0, 3, 7]), 'iv6': (5, [0, 3, 7, 9]), 'IV': (5, [0, 4, 7]),
    'v': (7, [0, 3, 7]), 'V': (7, [0, 4, 7]), 'V7': (7, [0, 4, 7, 10]), 'V7b9': (7, [0, 4, 7, 10, 13]),
    'Vsus4': (7, [0, 5, 7]),
    'VI': (8, [0, 4, 7]), 'VImaj7': (8, [0, 4, 7, 11]), 'III': (3, [0, 4, 7]), 'IIImaj7': (3, [0, 4, 7, 11]),
    'VII': (10, [0, 4, 7]), 'iio7': (2, [0, 3, 6, 10]), 'viio7': (11, [0, 3, 6, 9]), 'vio7': (9, [0, 3, 6, 10]),
    'N': (1, [0, 4, 7]),
}
DOMINANT = {'V', 'V7', 'V7b9', 'Vsus4', 'viio7'}


def chord_pcs(name):
    r, iv = CHORDS[name]
    return sorted({(r + x) % 12 for x in iv})


def scale_for(name):
    """melodic scale (relative to tonic) that fits the chord of the moment"""
    s = [0, 2, 3, 5, 7, 8, 10]
    if name in DOMINANT: s[6] = 11
    if name in ('IV', 'vio7'): s[5] = 9
    if name == 'N': s[1] = 1
    if name == 'V7b9': s[5] = 8
    return s


def parse_prog(text, meter):
    """'i | VI | iv V7 | V/11' -> per bar [(beat, chord, bass_rel)]"""
    bars = []
    for cell in text.split('|'):
        toks = cell.split()
        out = []
        step = meter / len(toks)
        if meter == 3 and len(toks) == 2: step = 2          # 3/4: 2 + 1
        for k, t in enumerate(toks):
            nm, _, b = t.partition('/')
            out.append((k * step if k < 2 else k * step, nm, int(b) if b else None))
        if meter == 3 and len(toks) == 2: out[1] = (2, out[1][1], out[1][2])
        bars.append(out)
    return bars


PROG = {
    'tanya': ['i | VI | iv | V', 'i | iv | iio7 | V', 'i | i7/10 | VI | V', 'i | VI | iv iio7 | Vsus4 V',
              'i | III | iv | V', 'i | VI | III | V7', 'i | iv/8 | iio7 | V'],
    'tipu': ['i | iv | V7 | VI', 'VI | iv | V7 | VI', 'i | iio7 | V7 | VI', 'iv | VI | V7 | VI', 'i | VI iv | V7 | VI'],
    'pulang': ['i | iv | V7 | i', 'VI | iv | V7 | i', 'iv | iio7 V7 | i | i', 'i | VI iv | V7 | i', 'iv | VI | V7 | i'],
    'hangat': ['III | VII | i | V', 'VI | III | VII | V', 'III | VII | VI | V', 'iv | VII | III | V7', 'VI | VII | III | V'],
    'klimaks': ['VI | iv | N/5 | V7 | VI', 'iv | VI | N/5 | V7b9 | VI', 'III | iv | N/5 | V7 | VI', 'VI | iio7 | N/5 | V7b9 | VI'],
    'ratapan': ['i | V/11 | i7/10 | vio7/9 | VImaj7/8 | V7 | iv V7 | i',
                'i | V/11 | i7/10 | IV/9 | iv/8 | V | VI V7 | i',
                'i | V/11 | VI/0 | vio7/9 | iv/8 | Vsus4 V | iv V7 | i'],
    'coda4': ['VI | iv/0 | i | iadd9', 'VImaj7 | VImaj7 | iv/0 | iadd9', 'iv/0 | VI | i | iadd9'],
    'coda8': ['VI | VImaj7 | iv | iv6 | i | VI | iv/0 | iadd9', 'VImaj7 | VI | iv/0 | i | VI | iv | Vsus4 V | iadd9'],
}

# --------------------------------------------------------------------------- rhythm / contour
RHY = {
    4: {'A': [[1, 1, 2], [2, 2], ['r1', 1, 1, 1], [1.5, .5, 2], [3, 1], [1, 2, 1], [1.5, .5, 1, 1]],
        'B': [[2, 1, 1], [1.5, .5, 2], [2, 2], [3, 1], [1, 1, 2], [1.5, .5, 1, 1]]},
    3: {'A': [[1, 2], [2, 1], [1, 1, 1], ['r1', 1, 1], [1.5, .5, 1]],
        'B': [[1.5, .5, 1], [2, 1], [1, 1, 1], [1, 2]]},
    6: {'A': [[1, .5, 1.5], [1.5, 1.5], [.5, .5, .5, 1.5], [1, .5, 1, .5], ['r1', .5, 1.5]],
        'B': [[1.5, .5, 1], [1, .5, 1.5], [1.5, 1, .5], [1, .5, .5, 1]]},
}
CONT_A = {2: [[2], [3], [4], [1]], 3: [[1, 1], [2, 1], [2, -1], [-1, 3], [3, -1], [0, 1]],
          4: [[1, 1, 1], [2, 1, -1], [-1, 2, 1], [3, 1, -1], [1, 2, 1], [0, 1, -1]]}
CONT_B = {2: [[-1], [-2]], 3: [[-1, -1], [-1, -2], [1, -2], [-2, -1]], 4: [[-1, -1, -1], [1, -1, -1], [-1, -1, 1], [-1, -2, 1]]}
CONT_UP = {1: [[]], 2: [[1], [2]], 3: [[1, 1], [2, 1], [1, 2]], 4: [[1, 1, 1], [2, 1, 1], [1, 1, 2]]}
CONT_DN = {1: [[]], 2: [[-1], [-2]], 3: [[-1, -1], [-2, -1]], 4: [[-1, -1, -1], [-1, -2, -1], [-2, -1, -1]]}

KEYS = [('A', 9), ('Bb', 10), ('B', 11), ('C', 0), ('C#', 1), ('D', 2), ('E', 4), ('F', 5), ('F#', 6), ('G', 7)]

# titles: every noun only with adjectives that make sense for it (no "Teh yang Tak Terkirim")
TITLES = {
    'Jendela': ['yang Diam', 'Basah', 'Setengah Terbuka', 'di Ujung Malam'],
    'Surat': ['Terlipat', 'Terakhir', 'yang Tak Pernah Dibalas', 'di Laci'],
    'Kursi': ['yang Menunggu', 'di Sudut Kamar'],
    'Selimut': ['Dingin', 'Terlipat'],
    'Hujan': ['di Ujung Malam', 'yang Tak Reda', 'Pertama Tanpamu'],
    'Lampu': ['Redup', 'yang Lupa Dimatikan'],
    'Cangkir': ['Dingin', 'yang Tak Tersentuh'],
    'Foto': ['Terbalik', 'yang Memudar', 'di Laci'],
    'Pintu': ['Setengah Terbuka', 'yang Tak Lagi Diketuk'],
    'Lorong': ['Sunyi', 'Redup'],
    'Bangku': ['yang Menunggu', 'di Taman Sepi'],
    'Pesan': ['Terakhir', 'yang Tak Terbaca'],
    'Senja': ['Terakhir', 'Tanpa Suara', 'yang Hilang'],
    'Lilin': ['Redup', 'yang Hampir Padam'],
    'Payung': ['yang Tertinggal', 'Basah'],
    'Tangga': ['Sunyi', 'ke Loteng'],
    'Bantal': ['Basah', 'yang Masih Wangi'],
    'Syal': ['yang Tertinggal', 'Terlipat'],
    'Mantel': ['di Gantungan', 'yang Tertinggal'],
    'Jam Dinding': ['yang Berhenti', 'Sunyi'],
    'Kotak Musik': ['yang Rusak', 'yang Diam'],
    'Buku Harian': ['Terakhir', 'yang Terbuka'],
    'Sepatu': ['di Depan Pintu', 'yang Tak Dipakai'],
    'Teh': ['yang Mendingin'],
    'Halaman': ['Terakhir'],
    'Kamar': ['Sunyi', 'yang Tak Disentuh'],
    'Kemeja': ['Terlipat', 'di Kursi'],
    'Piano': ['yang Tertutup', 'Tanpa Pemain'],
    'Gelang': ['yang Tertinggal'],
    'Ranjang': ['Setengah Kosong'],
}
# titles of earlier SadnessMelody songs: never reused
TAKEN = {'Selimut yang Masih Hangat', 'Lampu Tanpa Suara', 'Kamar Berembun', 'Cangkir Berembun', 'Kemeja yang Tidak Diangkat',
         'Foto Kosong', 'Kursi Kosong', 'Surat untuk Ibu', 'Hujan Terakhir', 'Jendela Berembun', 'Selimut di Lantai',
         'Pesan yang Tak Terkirim', 'Jendela yang Berembun'}


def title_for(rng, used=()):
    """a title that is not used yet; nouns already used in this set/catalogue are avoided too"""
    used = set(used) | TAKEN
    used_nouns = {n for n in TITLES for t in used if t.startswith(n + ' ')}
    used_adjs = {t[len(n) + 1:] for n in TITLES for t in used if t.startswith(n + ' ')}
    for avoid in (2, 1, 0):                    # avoid repeating a noun, then an adjective, if possible
        nouns = [n for n in TITLES if not (avoid >= 1 and n in used_nouns)]
        rng.shuffle(nouns)
        for n in nouns:
            adjs = [a for a in TITLES[n] if f'{n} {a}' not in used and not (avoid >= 2 and a in used_adjs)]
            if adjs: return f'{n} {rng.choice(adjs)}'
    return f'Lagu {rng.randint(100, 999)}'


# --------------------------------------------------------------------------- plan
def make_plan(mood, seed, **force):
    """all the big choices for one song (deterministic from seed)"""
    rng = random.Random(seed * 31 + (0 if mood == 'Sedih' else 7))
    meter = force.get('meter') or rng.choice(['4/4', '4/4', '3/4', '6/8'])
    lead = force.get('lead') or rng.choices(['piano', 'piano+string', 'cello'], [5, 3, 2])[0]
    tonic = force.get('key') or rng.choice(KEYS)[0]
    tpc = dict(KEYS)[tonic]
    m = {'4/4': 4, '3/4': 3, '6/8': 3}[meter]
    if meter == '4/4': bpm = rng.randint(48, 58)
    elif meter == '3/4': bpm = rng.randint(54, 62)
    else: bpm = rng.randint(50, 56)
    if lead == 'cello' and meter == '4/4': bpm = min(bpm, 52)
    if mood == 'Melankolis': bpm += 4
    bpm = force.get('bpm') or bpm
    intro = force.get('intro') or rng.choice({'piano': ['detak', 'sendiri', 'lonceng'], 'piano+string': ['string', 'detak', 'sendiri'],
                                               'cello': ['ratapan', 'detak']}[lead])
    return dict(mood=mood, seed=seed, meter=meter, m=m, ts68=meter == '6/8', lead=lead, tonic=tonic, tpc=tpc, bpm=bpm,
                intro=intro, double_climax=rng.random() < .5, title=force.get('title') or title_for(rng, force.get('used_titles', ())),
                durasi=force.get('durasi'))


# --------------------------------------------------------------------------- composer
class Composer:
    def __init__(self, plan):
        self.p = plan
        self.rng = random.Random(plan['seed'] * 1009 + 17)
        self.m = plan['m']; self.rk = 6 if plan['ts68'] else self.m
        self.tpc = plan['tpc']
        lead = plan['lead']
        if lead == 'cello':
            self.center = 55 + (self.tpc - 7) % 12           # tonic in G3..F#4
            self.lo, self.hi = self.center - 7, min(self.center + 14, 74)
        else:
            self.center = 67 + (self.tpc - 7) % 12           # tonic in G4..F#5
            self.lo, self.hi = self.center - 8, min(self.center + 14, 88)
        self.lead_track = 'Cello' if lead == 'cello' else 'Piano'
        self.bars = []        # per bar dict(sec, harm=[(beat, chord, bass_rel)], notes=[(pos, dur, midi)], role)
        self.last_note = None

    # ---------------------------------------------------------------- pitch helpers
    def scale_notes(self, chord):
        sc = scale_for(chord)
        return [n for n in range(self.lo - 3, self.hi + 4) if (n - self.tpc) % 12 in sc]

    def rel(self, n): return (n - self.tpc) % 12

    def chord_at(self, harm, pos):
        cur = harm[0]
        for h in harm:
            if h[0] <= pos + 1e-6: cur = h
        return cur[1]

    def strong(self, pos, dur):
        if self.rk == 6: return abs(pos) < 1e-6 or abs(pos - 1.5) < 1e-6 or dur >= 1.5
        if self.m == 4: return abs(pos) < 1e-6 or abs(pos - 2) < 1e-6 or dur >= 2
        return abs(pos) < 1e-6 or dur >= 2

    def step_from(self, n, k, chord='i'):
        sn = self.scale_notes(chord)
        j = min(range(len(sn)), key=lambda x: abs(sn[x] - n))
        return sn[max(0, min(len(sn) - 1, j + k))]

    def target(self, steps, chord='i'):
        sn = self.scale_notes(chord)
        base = min(range(len(sn)), key=lambda k: abs(sn[k] - self.center))
        k = max(0, min(len(sn) - 1, base + steps))
        return sn[k]

    # ---------------------------------------------------------------- bar realisation
    def realise(self, harm, rhythm, contour, start):
        """rhythm with optional leading 'r1'; contour in scale steps between successive notes"""
        notes = []; pos = 0.0; idx = None; k = 0
        for r in rhythm:
            if isinstance(r, str):
                pos += float(r[1:]); continue
            ch = self.chord_at(harm, pos)
            sn = self.scale_notes(ch)
            if idx is None:
                if start not in sn: return None
                n = start
            else:
                prev = notes[-1][2]
                j = min(range(len(sn)), key=lambda x: abs(sn[x] - prev))
                j += contour[k - 1] if k - 1 < len(contour) else 0
                if not 0 <= j < len(sn): return None
                n = sn[j]
            notes.append((pos, r, n)); idx = 1; k += 1; pos += r
        return notes

    def score(self, harm, notes, target, prev=None, forbid_above=None):
        if not notes: return 1e9
        s = 0.0
        for i, (pos, dur, n) in enumerate(notes):
            ch = self.chord_at(harm, pos); pcs = chord_pcs(ch)
            ct = self.rel(n) in pcs
            nxt = notes[i + 1] if i + 1 < len(notes) else None
            prv = notes[i - 1] if i > 0 else None
            if n < self.lo or n > self.hi: s += 12
            if forbid_above is not None and n >= forbid_above: s += 60      # the climax note must stay unique
            if self.strong(pos, dur):
                if not ct:
                    if nxt and 1 <= n - nxt[2] <= 2 and self.rel(nxt[2]) in chord_pcs(self.chord_at(harm, nxt[0])):
                        s += .3 if dur <= 2 else 2                      # appoggiatura / sigh: welcome
                        s -= .4
                    else: s += 7
            else:
                if not ct:
                    ok_in = prv is None or abs(n - prv[2]) <= 2
                    ok_out = nxt is None or abs(n - nxt[2]) <= 2
                    if not (ok_in and ok_out): s += 3
            if dur >= 1.5 and not ct and not (nxt and 1 <= n - nxt[2] <= 2): s += 4
            if prv:
                iv = abs(n - prv[2])
                if iv > 7: s += 5
                elif iv == 6: s += 3
                elif iv > 4: s += .8
                if iv == 3 and {self.rel(n), self.rel(prv[2])} in ({8, 11}, {1, 10}): s += 4   # augmented 2nd
        if prev is not None:
            iv = abs(notes[0][2] - prev)
            if iv > 7: s += 4
            elif iv == 6: s += 3
            elif iv > 4: s += .7
        s += .35 * abs(notes[0][2] - target)
        return s

    def best_bar(self, harm, rhythm, contours, target, prev=None, forbid_above=None, fixed_start=None):
        best = None
        cands = []
        for c in contours:
            cands.append(c)
            for k in range(len(c)):               # one-step mutations keep the shape recognisable
                for d in (-1, 1):
                    c2 = list(c); c2[k] += d
                    if c2[k] != 0 or c[k] == 0: cands.append(c2)
        ch0 = self.chord_at(harm, 0)
        starts = [fixed_start] if fixed_start else [n for n in self.scale_notes(ch0) if abs(n - target) <= 6]
        for c in cands:
            pen = 0 if c in contours else .9
            for st in starts:
                nt = self.realise(harm, rhythm, c, st)
                if not nt: continue
                sc = self.score(harm, nt, target, prev, forbid_above) + pen + self.rng.random() * .05
                if best is None or sc < best[0]: best = (sc, nt)
        return best[1] if best else None

    def cadence(self, harm, kind, target, prev):
        M = self.m
        goal_ch = harm[-1][1]; gpos = harm[-1][0]
        pcs = chord_pcs(goal_ch)
        opts = []
        def near(pc, t): return min((n for n in range(self.lo, self.hi + 1) if self.rel(n) == pc), key=lambda n: abs(n - t))
        if kind == 'tanya':
            pref = [2, 11, 7]
        elif kind == 'tipu':
            pref = [0, 3]
        else:
            pref = [0, 3, 7]
        pref = [p for p in pref if p in pcs] or pcs
        for pc in pref:
            g = near(pc, target)
            if gpos == 0:
                opts.append([(0, M, g)])
                above = [n for n in self.scale_notes(goal_ch) if n > g]
                if above:
                    a = above[0]
                    if self.m == 4: opts.append([(0, 2, a), (2, 2, g)])     # 4-3 / 9-8 suspension
                    else: opts.append([(0, 2, a), (2, 1, g)] if self.rk != 6 else [(0, 1.5, a), (1.5, 1.5, g)])
                    if self.m == 4: opts.append([(0, 1, a), (1, 3, g)])
            else:
                first = self.chord_at(harm, 0)
                fs = [n for n in self.scale_notes(first) if self.rel(n) in chord_pcs(first)]
                f = min(fs, key=lambda n: abs(n - g) + (0 if n > g else 1.5))
                opts.append([(0, gpos, f), (gpos, M - gpos, g)])
        best = None
        for o in opts:
            sc = self.score(harm, o, target, prev) + self.rng.random() * .3 + .25 * abs(o[-1][2] - target)
            if best is None or sc < best[0]: best = (sc, o)
        return best[1]

    # ---------------------------------------------------------------- song form
    def compose(self):
        p = self.p; rng = self.rng; M = self.m; rk = self.rk
        sedih = p['mood'] == 'Sedih'
        self.rhyA = rng.choice(RHY[rk]['A']); self.rhyB = rng.choice(RHY[rk]['B'])
        nA = sum(1 for r in self.rhyA if not isinstance(r, str)); nB = len(self.rhyB)
        self.cA = rng.choice(CONT_A.get(nA, CONT_A[3])) if nA > 1 else []
        self.cB = rng.choice(CONT_B.get(nB, CONT_B[3])) if nB > 1 else []
        self.rhyA2 = rng.choice([r for r in RHY[rk]['A'] if r != self.rhyA])
        long3 = M == 3

        def P(kind): return parse_prog(rng.choice(PROG[kind]), M)
        sections = []
        # intro
        if p['intro'] in ('ratapan',):
            sections.append(('Intro', parse_prog('i | V/11 | i7/10 | IV/9 iv/8', M), ['intro'] * 4))
        elif p['intro'] == 'string':
            sections.append(('Intro', parse_prog('i | i | iv/0 | i', M), ['intro'] * 4))
        else:
            sections.append(('Intro', parse_prog(rng.choice(['i | VI | i | V', 'i | VImaj7 | i | V7', 'i | iv/0 | i | V']), M),
                             ['intro'] * 4))
        q1 = P('tanya'); c1 = P('pulang' if rng.random() < .5 else 'tipu')
        q2 = q1 if rng.random() < .6 else P('tanya'); c2 = P('tipu')
        sections.append(('A', q1 + c1 + q2 + c2, ['mA', 'mB', 'mA+', 'cad:tanya', 'mA', 'mB', 'naik', 'cad:' + ('pulang' if c1[-1][-1][1] == 'i' else 'tipu'),
                                                 'mA^', 'mB^', 'mA^+', 'cad:tanya', 'mA^', 'mB^', 'turun', 'cad:tipu']))
        kl = P('klimaks')
        if long3:
            bsec = P('hangat') + P('hangat') + P('tanya')[:3] + kl
            roles = ['bA', 'bB', 'bA+', 'cad:tanya', 'bA+', 'bB+', 'naik', 'cad:tanya', 'naik', 'naik', 'naik',
                     'naik', 'naik', 'puncak', 'jatuh', 'cad:tipu']
        else:
            bsec = P('hangat') + kl
            roles = ['bA', 'bB', 'bA+', 'cad:tanya', 'naik', 'naik', 'puncak', 'jatuh', 'cad:tipu']
        assert len(bsec) == len(roles)
        sections.append(('B', bsec, roles))
        lam = P('ratapan')
        if long3:
            sections.append(("A'", lam + P('pulang') + P('pulang'), ['copy'] * 8 + ['mA', 'mB', 'turun', 'cad:pulang', 'mA-', 'mB-', 'turun', 'cad:pulang']))
        else:
            sections.append(("A'", lam, ['copy'] * 7 + ['cad:pulang']))
        cod = P('coda8' if long3 else 'coda4')
        sections.append(('Coda', cod, ['frag', 'mB-', 'tahan', 'akhir'] if not long3 else ['frag', 'mB-', 'tahan', 'tahan', 'frag', 'mB-', 'tahan', 'akhir']))
        if p.get('durasi') and p['durasi'] > self.est_seconds(sections) + 40:
            sections = self.long_form(sections, P, long3)
        self.sections = [x if len(x) == 4 else x + (x[0],) for x in sections]      # (label, harm, roles, kind)
        self.write_melody()
        return self

    def est_seconds(self, sections):
        bars = sum(len(x[1]) for x in sections)
        return bars * self.m * 60 / self.p['bpm'] * 1.0 + 4

    def long_form(self, sections, P, long3):
        """--durasi: a longer song that still develops instead of looping:
        Intro - A - B (first, smaller climax) - A' (lament) - Interlude - A2 (theme returns higher, new
        accompaniment) - B2 (the real climax, new progression) - long Coda.  Parts are sized to the target."""
        rng = self.rng
        intro, A, B, Ap, cod = sections
        b_roles = ['puncak1' if r == 'puncak' else r for r in B[2]]
        B1 = ('B', B[1], b_roles, 'B')
        jh = parse_prog(rng.choice(['VI | iv | VI | V', 'VImaj7 | iv | III | V', 'iv | VI | iv/0 | Vsus4 V']), self.m)
        J = ('Jeda', jh, ['frag', 'tahan', 'frag', 'cad:tanya'], 'Jembatan')
        q = P('tanya'); c = P('pulang'); q2 = P('tanya'); c2 = P('tipu')
        a2_8 = ('A2', q + c, ['mA^', 'mB^', 'mA^+', 'cad:tanya', 'mA^', 'mB^', 'turun', 'cad:pulang'], 'A')
        a2_16 = ('A2', q + c2 + q2 + c, ['mA', 'mB', 'mA+', 'cad:tanya', 'mA^', 'mB^', 'naik', 'cad:tipu',
                                         'mA^', 'mB^', 'mA^+', 'cad:tanya', 'mA^', 'mB^', 'turun', 'cad:pulang'], 'A')
        kl = P('klimaks')
        if long3:
            b2 = P('hangat') + P('tanya')[:3] + kl
            b2r = ['bA', 'bB', 'bA+', 'cad:tanya', 'naik', 'naik', 'naik', 'naik', 'naik', 'puncak', 'jatuh', 'cad:tipu']
        else:
            b2 = P('hangat') + kl
            b2r = ['bA', 'bB', 'bA+', 'cad:tanya', 'naik', 'naik', 'puncak', 'jatuh', 'cad:tipu']
        B2 = ('B2', b2, b2r, 'B')
        c8 = P('coda8')
        cod8 = ('Coda', c8, ['frag', 'mB-', 'tahan', 'tahan', 'frag', 'mB-', 'tahan', 'akhir'], 'Coda')
        target = self.p['durasi']
        best = None
        for a2 in (a2_8, a2_16):
            for jj in ([J], []):
                for cc in (cod8, cod):
                    form = [intro, A, B1, Ap] + jj + [a2, B2, cc]
                    e = self.est_seconds(form)
                    d = abs(e - target) + (0 if jj else 6)          # prefer keeping the breathing interlude
                    if best is None or d < best[0]: best = (d, form)
        return best[1]

    def write_melody(self):
        M = self.m
        bars = []
        for sec, harm, roles, kind in self.sections:
            for k, (h, r) in enumerate(zip(harm, roles)):
                bars.append(dict(sec=sec, kind=kind, harm=h, role=r, notes=[], k=k))
        self.bars = bars
        A_notes = [b for b in bars if b['sec'] == 'A']
        last_B = [b['sec'] for b in bars if b['kind'] == 'B'][-1]
        # B section must climb to the single highest note
        peak_steps = 9 if self.p['lead'] != 'cello' else 8
        pb = next(b for b in bars if b['role'] == 'puncak')
        pch = self.chord_at(pb['harm'], 0)
        pk_t = self.target(peak_steps, pch)
        pcands = [n for n in range(self.lo, self.hi + 1) if self.rel(n) in chord_pcs(pch)]
        self.peak = min(pcands, key=lambda x: abs(x - pk_t) - (.5 if x > pk_t else 0))
        a_ceiling = self.peak - 3
        prev = None
        intro = self.p['intro']
        for i, b in enumerate(bars):
            h, role = b['harm'], b['role']
            if role == 'intro':
                if intro == 'sendiri' and b['k'] < 2:
                    rh = self.rhyB if b['k'] == 0 else [M]
                    t = self.target(2 if b['k'] == 0 else 0)
                    nt = self.best_bar(h, rh, [self.cB] if rh is self.rhyB else [[]], t, prev)
                    b['notes'] = nt or []
                elif intro == 'lonceng' and b['k'] < 2:
                    t = self.target(4 if b['k'] == 0 else 0)
                    pc = 7 if b['k'] == 0 else 0
                    n = min((x for x in range(self.lo, self.peak - 2) if self.rel(x) == pc), key=lambda x: abs(x - t))
                    b['notes'] = [(0 if b['k'] == 0 else M / 2, M if b['k'] == 0 else M / 2, n)]
                if b['notes']: prev = b['notes'][-1][2]
                continue
            if role == 'copy':                       # A' : the theme returns over the lament bass
                src = A_notes[b['k']] if b['k'] < len(A_notes) else A_notes[-1]
                ok = all(self.rel(n) in chord_pcs(self.chord_at(h, pos)) or not self.strong(pos, d) or
                         (j + 1 < len(src['notes']) and 1 <= n - src['notes'][j + 1][2] <= 2)
                         for j, (pos, d, n) in enumerate(src['notes']))
                if ok and src['notes']:
                    b['notes'] = list(src['notes'])
                else:
                    rh = [d for _, d, _ in src['notes']] or [M]
                    st = src['notes'][0][2] if src['notes'] else self.target(0)
                    cont = [0] * (len(rh) - 1)
                    sn = self.scale_notes(self.chord_at(h, 0))
                    if src['notes'] and len(rh) > 1:
                        cont = []
                        for (p0, d0, n0), (p1, d1, n1) in zip(src['notes'], src['notes'][1:]):
                            cont.append(max(-3, min(3, round((n1 - n0) / 1.7))))
                    lead_rest = src['notes'][0][0] if src['notes'] else 0
                    rr = ([f'r{lead_rest:g}'] if lead_rest else []) + rh
                    b['notes'] = self.best_bar(h, rr, [cont], st, prev, forbid_above=a_ceiling + 1) or src['notes']
                prev = b['notes'][-1][2] if b['notes'] else prev
                continue
            sec = b['sec']; kind = b['kind']
            fa_b = self.peak if sec == last_B else self.peak - 2     # only the last B may reach the peak
            # target steps per role
            base = {'A': 0, 'B': 3, "A'": -1, 'Coda': -1, 'Jembatan': -1}[kind]
            hi = 2 if role.endswith('^') or role.endswith('^+') else 0
            if role.startswith('cad:'):
                kind = role[4:]
                tn = self.step_from(prev, -1) if prev else self.target(base)
                nt = self.cadence(h, kind, tn, prev)
            elif role == 'puncak':
                n = self.peak
                nt = [(0, M, n)]
                b['peak'] = n
            elif role == 'puncak1':                  # first climax: held a little below the real peak
                ch = self.chord_at(h, 0)
                c1 = [x for x in range(self.lo, self.peak - 1) if self.rel(x) in chord_pcs(ch)]
                n = max(c1) if c1 else self.peak - 3
                nt = [(0, M, n)]
            elif role == 'jatuh':
                pkn = bars[i - 1]['notes'][-1][2] if bars[i - 1]['notes'] else self.target(peak_steps - 1)
                rh = {4: [1, 1.5, .5, 1], 3: [1, 1, 1], 6: [1, .5, 1.5]}[self.rk]
                nt = self.best_bar(h, rh, CONT_DN[len(rh)], pkn - 1, prev, forbid_above=pkn)
            elif role in ('naik',):
                step_i = sum(1 for x in bars[:i] if x['sec'] == sec and x['role'] == 'naik')
                t = self.step_from(prev, 1) if prev else self.target(base + 2)
                rh = self.rhyA2 if not isinstance(self.rhyA2[0], str) else self.rhyA2[1:]
                nt = self.best_bar(h, rh, CONT_UP.get(len(rh), CONT_UP[3]), t, prev,
                                   forbid_above=(a_ceiling if kind != 'B' else fa_b))
            elif role == 'turun':
                rh = self.rhyB
                nt = self.best_bar(h, rh, CONT_DN.get(len(rh), CONT_DN[3]), self.step_from(prev, 1) if prev else self.target(base), prev, forbid_above=a_ceiling)
            elif role in ('tahan', 'akhir'):
                ch = self.chord_at(h, 0)
                pref = [7, 2, 0] if role == 'akhir' else [0, 3, 7, 2]
                pcs = chord_pcs(ch)
                t = self.target(base)
                cands = [n for n in range(self.lo, self.hi) if self.rel(n) in pref and (self.rel(n) in pcs or role == 'akhir')]
                n = min(cands, key=lambda x: abs(x - (prev or t)) + .2 * abs(x - t)) if cands else t
                nt = [(0, M, n)] if role == 'tahan' else [(0, M * .75, n)]
            elif role == 'frag':
                rh = [x for x in self.rhyA if not isinstance(x, str)]
                rh = rh[:max(1, len(rh) - 1)]
                rh = rh + [M - sum(rh)] if M - sum(rh) > 0 else rh
                nt = self.best_bar(h, rh, [self.cA[:len(rh) - 1] + [0] * max(0, len(rh) - 1 - len(self.cA))], self.target(base), prev)
            else:
                # motif bars
                isA = role.startswith('mA') or role.startswith('bA')
                rh = self.rhyA if isA else self.rhyB
                cont = self.cA if isA else self.cB
                if role.startswith('b'):
                    cont = [c + (1 if c > 0 else 0) for c in cont] if isA else cont     # B: widened call
                first_mA = next((x for x in bars[:i] if x['sec'] == sec and x['role'] in ('mA', 'bA') and x['notes']), None)
                if isA:
                    if role in ('mA', 'bA') or not first_mA: tn = self.target(base + hi)
                    elif role.endswith('^') : tn = self.step_from(first_mA['notes'][0][2], 2)
                    elif role.endswith('+'): tn = self.step_from(first_mA['notes'][0][2], 3 if hi else 2)
                    elif role.endswith('-'): tn = self.step_from(first_mA['notes'][0][2], -1)
                    else: tn = self.target(base + hi)
                else:
                    tn = self.step_from(prev, 1) if prev else self.target(base + 2)
                    if role.endswith('-'): tn = prev or tn
                # exact repetition of the first statement when the harmony allows it
                rep = None
                if role in ('mA', 'mB'):
                    first = next((x for x in bars[:i] if x['role'] == role and x['sec'] == sec and x['notes']), None)
                    if first and first['harm'] == h: rep = list(first['notes'])
                nt = rep or self.best_bar(h, rh, [cont], tn, prev,
                                          forbid_above=a_ceiling if kind != 'B' else fa_b)
            b['notes'] = nt or [(0, M, self.target(base))]
            if role != 'puncak':                     # safety: nothing else may reach the climax note
                lim = (fa_b if kind == 'B' else a_ceiling + 1) if role != 'puncak1' else self.peak - 1
                fixed = []
                for (ps, d, n) in b['notes']:
                    if n >= lim:
                        ch = self.chord_at(h, ps)
                        below = [x for x in self.scale_notes(ch) if x < lim and (self.rel(x) in chord_pcs(ch) or d < 1)]
                        n = max(below) if below else n - 12
                    fixed.append((ps, d, n))
                b['notes'] = fixed
            prev = b['notes'][-1][2]

    def max_so_far(self, bars, i):
        return max((n for x in bars[:i] for _, _, n in x['notes']), default=0)

    # ---------------------------------------------------------------- arrangement
    def build_song(self):
        p = self.p; M = self.m
        s = Song(p['title'], p['bpm'], M, p['seed'], ts68=p['ts68'])
        t = p['tonic']
        s.key_str = (t[0] + '-' if len(t) == 2 and t[1] == 'b' else t) + ' minor'
        s.plan = p
        lead = p['lead']; L = self.lead_track
        nb = len(self.bars)
        s.bars = nb
        # section index map
        start = {}
        for i, b in enumerate(self.bars):
            start.setdefault(b['sec'], i)
        for sec, first in sorted(start.items(), key=lambda x: x[1]): s.sections.append((sec, first))
        peak_bar = next(i for i, b in enumerate(self.bars) if b['role'] == 'puncak')
        sedih = p['mood'] == 'Sedih'
        # dynamics envelope (bar -> base melody velocity)
        a0, bB, aP, cD = start['A'], start['B'], start["A'"], start['Coda']
        if lead == 'cello':
            ENV = [(0, 60), (a0, 62), (bB - 1, 66), (bB, 68), (peak_bar, 86), (peak_bar + 1, 82), (aP, 62), (cD, 56), (nb, 46)]
        else:
            ENV = [(0, 50), (a0, 54), (a0 + 8, 58), (bB - 1, 60), (bB, 60), (peak_bar, 76), (peak_bar + 1, 72),
                   (aP, 56), (cD - 1, 52), (cD, 48), (nb, 38)]
        if 'B2' in start:                     # long form (--durasi): two climaxes, the second one higher
            p1 = next(i for i, b in enumerate(self.bars) if b['role'] == 'puncak1')
            jb = start.get('Jeda', start['A2']); a2, b2 = start['A2'], start['B2']
            ENV = [(0, 50), (a0, 54), (a0 + 8, 58), (bB - 1, 59), (bB, 59), (p1, 69), (p1 + 1, 66), (aP, 55), (jb, 50),
                   (a2, 55), (a2 + 4, 58), (b2 - 1, 60), (b2, 61), (peak_bar, 78), (peak_bar + 1, 73), (cD - 1, 54), (cD, 49), (nb, 38)]
            ENV = sorted(dict(ENV).items())
            if lead == 'cello': ENV = [(b, round(46 + (v - 38) * 40 / 38)) for b, v in ENV]
        if sedih: ENV = [(b, v - 2) for b, v in ENV]
        def env(bi):
            for (b1, v1), (b2, v2) in zip(ENV, ENV[1:]):
                if b1 <= bi <= b2: return v1 + (v2 - v1) * (bi - b1) / max(1, (b2 - b1))
            return ENV[-1][1]
        self.env = env
        # harmony + bass
        for i, b in enumerate(self.bars):
            for (bt, ch, br) in b['harm']:
                r, _ = CHORDS[ch]
                bass_rel = br if br is not None else r
                s.harm.append((i * M + bt, self.bass_midi(bass_rel), [(self.tpc + x) % 12 for x in chord_pcs(ch)]))
        # melody
        center = self.center
        for i, b in enumerate(self.bars):
            for (pos, d, n) in b['notes']:
                v = env(i) + (.55 if lead != 'cello' else .7) * (n - center) + (3 if pos == 0 else 0) + (2 if d >= 2 else 0) - (3 if d <= .5 else 0)
                if b['role'] in ('puncak', 'puncak1'): v += 4
                v = max(28 if lead != 'cello' else 42, min(94, v))
                s.add_mel(L, i * M + pos, d, n, v)
        self.accompany(s)
        self.unclash(s)
        self.tempo(s, peak_bar)
        s.info = dict(plan={k: v for k, v in p.items() if k != 'used_titles'}, peak_bar=peak_bar + 1,
                      motif=dict(ritme_A=self.rhyA, kontur_A=self.cA, ritme_B=self.rhyB, kontur_B=self.cB))
        return s

    def bass_midi(self, rel):
        n = 36 + (self.tpc + rel) % 12          # C2..B2
        if n > 47: n -= 12
        if n < 33: n += 12
        return n

    def unclash(self, s):
        """an accompaniment note a minor 9th / semitone against a held melody note (usually the note an
        appoggiatura resolves to) is struck later, when the melody has moved, or dropped if it never does"""
        melk = {(round(m[0], 4), m[2]) for m in s.mel}
        mel = sorted(s.mel)
        for tr, evs in s.ev.items():
            out = []
            for e in evs:
                st, ln, nt, v = e
                if (round(st, 4), nt) in melk: out.append(e); continue
                hit = next((m for m in mel if m[1] >= .75 and m[0] - .05 <= st < m[0] + m[1] - .1 and
                            abs(m[2] - nt) % 12 == 1 and st >= m[0] - .05), None)
                if hit is None: out.append(e); continue
                new_st = hit[0] + hit[1]
                if new_st < st + ln - .5: out.append((new_st, st + ln - new_st, nt, v))
            s.ev[tr] = out
        # held notes that started earlier (string pads, long bass/piano notes) and rub a semitone against a long
        # melody note: stop before the melody note and come back after it (the resolution note must not
        # sound together with its appoggiatura)
        for tr, evs in s.ev.items():
            out = []
            for e in evs:
                st, ln, nt, v = e
                if (round(st, 4), nt) in melk: out.append(e); continue
                pieces = [(st, st + ln)]
                for m in mel:
                    if m[1] < .75 or abs(m[2] - nt) % 12 not in (1, 11): continue
                    m0, m1 = m[0], m[0] + m[1]
                    nxt = []
                    for a, b in pieces:
                        if min(b, m1) - max(a, m0) < .4 or a >= m0 - .05: nxt.append((a, b)); continue
                        if m0 - a >= .5: nxt.append((a, m0))
                        if b - m1 >= .5: nxt.append((m1, b))
                    pieces = nxt
                for a, b in pieces: out.append((a, b - a, nt, v))
            s.ev[tr] = out

    def accompany(self, s):
        p = self.p; M = self.m; rk = self.rk; lead = p['lead']
        rng = self.rng
        PATS = {
            4: {'heart': [(0, 'b'), (2, 0), (2, 1)], 'low': [(0, 'b'), (1.5, 0), (3, 1)],
                'arp4': [(0, 'b'), (1, 0), (1.5, 1), (2, 2), (3, 1)],
                'flow8': [(0, 'b'), (.5, 'b5'), (1, 0), (1.5, 1), (2, 2), (2.5, 1), (3, 'b8'), (3.5, 0)],
                'sparse': [(0, 'b'), (2, 0), (2, 1), (2, 2)], 'hold': [(0, 'b'), (0, 0), (0, 1), (0, 2)],
                'blok3': [(0, 'b'), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2), (3, 0), (3, 1), (3, 2)]},
            3: {'waltz': [(0, 'b'), (1, 0), (1, 1), (2, 0), (2, 1)], 'rockB': [(0, 'b'), (.5, 0), (1, 1), (1.5, 2), (2, 1), (2.5, 0)],
                'sparse': [(0, 'b'), (1.5, 0), (1.5, 1)], 'hold': [(0, 'b'), (0, 0), (0, 1), (0, 2)],
                'flow': [(0, 'b'), (.5, 0), (1, 1), (1.5, 2), (2, 3), (2.5, 2)]},
            6: {'rock': [(0, 'b'), (.5, 0), (1, 1), (1.5, 'b5'), (2, 0), (2.5, 1)],
                'rockB': [(0, 'b'), (.5, 0), (1, 1), (1.5, 2), (2, 1), (2.5, 0)],
                'sparse': [(0, 'b'), (1.5, 0), (1.5, 1)], 'hold': [(0, 'b'), (0, 0), (0, 1), (0, 2)]},
        }[rk]
        if rk == 4:
            pat_of = {'Intro': 'heart', 'A': rng.choice(['arp4', 'low', 'arp4']), 'B': 'flow8', "A'": 'sparse', 'Coda': 'sparse'}
            if lead == 'cello': pat_of.update(A='blok3', B='flow8', **{"A'": 'arp4'})
        elif rk == 3:
            pat_of = {'Intro': 'waltz', 'A': rng.choice(['waltz', 'rockB']), 'B': 'flow', "A'": 'sparse', 'Coda': 'sparse'}
        else:
            pat_of = {'Intro': 'rock', 'A': 'rock', 'B': 'rockB', "A'": 'sparse', 'Coda': 'sparse'}
        # long form: the returning theme (A2) gets a different accompaniment, the interlude only held chords
        if any(b['sec'] == 'A2' for b in self.bars):
            alt = [k for k in PATS if k not in (pat_of['A'], 'hold', 'sparse', 'heart', 'blok3')]
            pat_of['A2'] = rng.choice(alt) if alt else pat_of['A']
            pat_of['Jembatan'] = 'hold'
        intro = p['intro']
        nb = len(self.bars)
        L = self.lead_track
        for i, b in enumerate(self.bars):
            sec = b['kind']; lab = b['sec']; b0 = i * M
            av = self.env(i) - (17 if lead != 'cello' else 22)
            harm = b['harm']
            last = i == nb - 1
            # ---- piano accompaniment
            silent = (sec == 'Intro' and ((intro == 'sendiri' and b['k'] < 2) or (intro == 'lonceng' and b['k'] < 2 and False) or intro == 'string'))
            if last:
                bn = self.bass_midi(0)
                top = [x for x in range(50, 76) if self.rel(x) in (0, 3, 7, 2)]
                voic = [bn - 12, bn, bn + 7] + [x for x in top if x > bn + 9][:4]
                for j, n in enumerate(voic): s.add('Piano', b0 + j * .24, M * 2.2, n, av + 6 - j)
            elif not silent:
                pat = pat_of.get(lab, pat_of.get(sec, 'sparse')) if not (sec == 'Intro' and intro == 'ratapan') else 'ratapan'
                if sec == 'B' and b['role'] in ('puncak', 'puncak1') and rk == 4: pat = 'flow8'
                segs = [(h[0], (harm[k + 1][0] if k + 1 < len(harm) else M)) for k, h in enumerate(harm)]
                for k, (bt, ch, br) in enumerate(harm):
                    st, en = segs[k]
                    r, _ = CHORDS[ch]
                    bn = self.bass_midi(br if br is not None else r)
                    if pat == 'ratapan':                     # bare octaves walking the lament bass
                        s.add('Piano', b0 + st, en - st + .2, bn, av + 10); s.add('Piano', b0 + st, en - st + .2, bn + 12, av + 7)
                        continue
                    if L == 'Piano':
                        ceil_ = s.mel_low(b0 + st, b0 + en, 'Piano') - 3
                        if ceil_ > 150: ceil_ = 69
                        upper = sorted(n for pc in chord_pcs(ch) for n in range(bn + 7, min(ceil_, 69) + 1) if self.rel(n) == pc)
                    else:                                    # cello lead: piano chords sit around it, never on it
                        mel_here = [m[2] for m in s.mel if m[0] < b0 + en and m[0] + m[1] > b0 + st]
                        lo_, hi_ = (60, 79) if sec == 'B' else (55, 74)
                        upper = sorted(n for pc in chord_pcs(ch) for n in range(lo_, hi_ + 1) if self.rel(n) == pc
                                       and all(abs(n - m) > 2 for m in mel_here))
                    if not upper: upper = [bn + 12]
                    P = PATS[pat] if len(harm) == 1 else [(st, 'b'), (st + .03, 0), (st + .03, 1), (st + .03, 2)]
                    oct_ = (sec == 'B' and b['role'] in ('puncak', 'puncak1', 'jatuh', 'naik')) or (sec == 'Intro' and intro == 'detak' and False)
                    for (pos, v) in P:
                        if not (st <= pos < en): continue
                        if v == 'b': n, vv = bn, av + 5
                        elif v == 'b5': n, vv = bn + 7, av - 3
                        elif v == 'b8': n, vv = bn + 12, av - 4
                        else: n, vv = upper[min(v, len(upper) - 1)], av - 3 + (1 if v == 1 else 0)
                        if sec == 'Intro' and intro in ('detak', 'lonceng'): vv += 6
                        s.add('Piano', b0 + pos, en - pos + .25, n, vv)
                        if v == 'b' and oct_ and bn - 12 >= 24: s.add('Piano', b0 + pos, en - pos + .25, bn - 12, av + 1)
            # ---- strings
            if lead == 'piano':
                continue
            use = False; sv = 0
            if lead == 'piano+string':
                if sec == 'Intro' and intro == 'string': use, sv = True, 40 + 6 * b['k']
                elif sec == 'A' and b['k'] >= 8: use, sv = True, 40
                elif sec == 'B': use, sv = True, 50 + (10 if b['role'] in ('puncak', 'jatuh') else 0)
                elif lab == 'A2': use, sv = True, 44
                elif sec == 'Jembatan': use, sv = True, 38
                elif sec == "A'": use, sv = True, 42
                elif sec == 'Coda': use, sv = True, 36
            else:   # cello lead: strings join at B, stay soft after
                if sec == 'B': use, sv = True, 52 + (10 if b['role'] in ('puncak', 'jatuh') else 0)
                elif lab == 'A2' and b['k'] >= 4: use, sv = True, 40
                elif sec == 'Jembatan': use, sv = True, 38
                elif sec == "A'" and b['k'] >= 4: use, sv = True, 42
                elif sec == 'Coda' and not last: use, sv = True, 36
            if p['mood'] == 'Sedih': sv -= 3
            if use and not last:
                for k, (bt, ch, br) in enumerate(harm):
                    en = harm[k + 1][0] if k + 1 < len(harm) else M
                    r, _ = CHORDS[ch]; bn = self.bass_midi(br if br is not None else r)
                    mlow = s.mel_low(b0 + bt, b0 + en, L)
                    if mlow > 150: mlow = 79
                    if L == 'Piano':
                        top = min(mlow - 5, 74)
                        tones = sorted(n for pc in chord_pcs(ch) for n in range(50, top + 1) if self.rel(n) == pc)[-3:]
                    else:
                        mh = s.mel_high(b0 + bt, b0 + en)
                        tones = sorted(n for pc in chord_pcs(ch) for n in range(max(mh + 4, 64), 82) if self.rel(n) == pc)[:2]
                    for n in tones: s.add('String', b0 + bt, en - bt + .05, n, sv)
                    if sec == 'B' or (sec == 'Intro' and intro == 'string') or sec == 'Coda':
                        s.add('Bass', b0 + bt, en - bt, bn - 12 if bn - 12 >= 28 else bn, sv + 6)
            # C3 colour: violas + celli double the melody an octave below at the climax
            if lead == 'piano+string' and p['double_climax'] and sec == 'B' and b['role'] in ('naik', 'puncak', 'jatuh', 'cad:tipu'):
                for (pos, d, n) in b['notes']:
                    lo = n - 12
                    s.add('Viola' if lo >= 55 else 'Cello', b0 + pos, d, lo, self.env(i) - 10)
        # legato pads: tie same pitches across bars
        for tr in ('String', 'Bass'):
            st = sorted(s.ev[tr]); merged = []
            for e in st:
                for k in range(len(merged) - 1, -1, -1):
                    m_ = merged[k]
                    if m_[2] == e[2] and abs(m_[0] + m_[1] - .05 - e[0]) < .06:
                        merged[k] = (m_[0], e[0] + e[1] - m_[0], m_[2], m_[3]); break
                else: merged.append(e)
            s.ev[tr] = merged

    def tempo(self, s, peak_bar):
        M = self.m; bpm = self.p['bpm']; nb = len(self.bars)
        T = [(0, bpm * .93), (M, bpm)]
        for i, b in enumerate(self.bars):
            if b['role'].startswith('cad:') and i < nb - 5:
                T += [(i * M + M - 1, bpm * .9), ((i + 1) * M, bpm)]
        T += [(peak_bar * M, bpm * .95), (peak_bar * M + M / 2, bpm * .9), ((peak_bar + 1) * M, bpm * .95), ((peak_bar + 2) * M, bpm)]
        start, beats = (nb - 4) * M, 4 * M
        for k in range(int(beats) + 1):
            T.append((start + k, bpm * .97 * (1 - .3 * (k / beats) ** 1.5)))
        s.tempo = sorted(dict(T).items())


def compose(mood='Sedih', seed=1, **force):
    if mood not in ('Sedih', 'Melankolis'):
        raise ValueError('Mesin komposer Muse Sounds saat ini untuk mood Sedih dan Melankolis.')
    plan = make_plan(mood, seed, **force)
    c = Composer(plan).compose()
    return c.build_song(), c


def describe(song):
    """measurable report (same numbers we used for the hand-composed pieces)"""
    mel = sorted(m for m in song.mel)
    ns = [m[2] for m in mel]
    lp = [abs(b - a) for a, b in zip(ns, ns[1:])]
    sus = sighs = 0
    for k in range(len(mel) - 1):
        st, ln, nt, _ = mel[k]; st2, _, nt2, _ = mel[k + 1]
        h = song.chord_at(st); h2 = song.chord_at(st2)
        if not h or not h2: continue
        onbeat = abs(st - round(st)) < 1e-6
        if onbeat and nt % 12 not in h[2] and 1 <= nt - nt2 <= 2 and nt2 % 12 in h2[2]: sus += 1
        if 1 <= nt - nt2 <= 2 and ln >= 1: sighs += 1
    top = max(mel, key=lambda m: (m[2], -m[0]))
    tsec = song.seconds_at(top[0]); total = song.seconds_at(song.total_beats())
    return dict(judul=song.name, birama=song.bars, detik=round(total + 3, 1), nada_melodi=len(ns),
                rentang=[min(ns), max(ns)], lompatan_terbesar=max(lp), melangkah=round(sum(l <= 2 for l in lp) / len(lp), 2),
                apogiatura=sus, desah=sighs, klimaks=f'{int(tsec // 60)}:{int(tsec % 60):02d}',
                bagian={n: f'{int(song.seconds_at(b * song.meter) // 60)}:{int(song.seconds_at(b * song.meter) % 60):02d}' for n, b in song.sections})
