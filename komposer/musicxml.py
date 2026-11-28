"""MusicXML export for MuseScore Studio 4 / Muse Sounds (music-maker komposer).

MuseScore's MIDI import keeps notes + tempo but drops sustain pedal and dynamics, so Muse Sounds would play
flat. This writes notation straight from the composer's own note data (before humanisation):
  - key, time signature (4/4, 3/4, 6/8), every tempo change (exact tempo map, extra marks hidden)
  - dynamics pp..f per phrase + crescendo/diminuendo hairpins
  - piano pedal lines (down at each harmony, 'change' at each new harmony, release at the end)
  - piano grand staff (RH = melody + upper accompaniment, LH = the rest)
  - strings split into Violins / Violas / Violoncellos / Contrabasses, slurred for legato
  - standard instrument-sound ids so MuseScore picks the matching Muse Sounds patch
`export(song, path)` writes the file, then `validate()` re-reads it and checks note counts etc.
"""
import math, os, re, sys
from fractions import Fraction as F
import music21 as m21
from music21 import stream, note, chord, meter, key, tempo, dynamics, clef, instrument, expressions, layout, spanner

# MuseScore 4 default dynamic velocities
LEVELS = [('ppp', 16), ('pp', 33), ('p', 49), ('mp', 64), ('mf', 80), ('f', 96), ('ff', 112)]


# ---------------------------------------------------------------------------- helpers
def q(x):
    """quantise a beat position: 16th grid, or triplet-8th grid when it clearly sits there"""
    t = round(x * 3) / 3
    if abs(x - t) < .025 and abs(round(x * 4) / 4 - x) > .03: return F(round(x * 3), 3)
    return F(round(x * 4), 4)


def merge_same_pitch(ev):
    """same rule as smlib.Song.write: same pitch within 0.15 beat -> one note"""
    ev = sorted(ev); merged = []
    for e in ev:
        for k, m_ in enumerate(merged):
            if m_[2] == e[2] and abs(m_[0] - e[0]) < .15:
                s0 = min(m_[0], e[0]); merged[k] = (s0, max(m_[0] + m_[1], e[0] + e[1]) - s0, e[2], max(m_[3], e[3])); break
        else: merged.append(e)
    return sorted(merged)


def to_groups(ev, total):
    """notes -> monophonic chord sequence [(on, off, [(pitch, vel)], arpeggio)]; rolls -> one arpeggiated chord"""
    ev = sorted(ev)
    # per-beat grid: a beat is triplet if any onset in it sits on a triplet position, else 16ths
    trip = set()
    for st, ln, nt, v in ev:
        t = round(st * 3) / 3
        if abs(st - t) < .025 and abs(round(st * 4) / 4 - st) > .03: trip.add(int(math.floor(t + 1e-6)))
    def q(x):
        b = int(math.floor(x + 1e-6))
        if b in trip or int(math.floor(round(x * 3) / 3 + 1e-6)) in trip and abs(round(x * 3) / 3 - x) < .04:
            return F(round(x * 3), 3)
        return F(round(x * 4), 4)
    out = []; i = 0
    while i < len(ev):
        st, ln, nt, v = ev[i]
        j = i + 1                                         # roll: >=3 notes, steps .1-.35, long notes
        while j < len(ev) and .1 < ev[j][0] - ev[j - 1][0] <= .35 and ev[j][1] >= 2 and ln >= 2: j += 1
        if j - i >= 3:
            out.append([q(st), q(st + ln), [(e[2], e[3]) for e in ev[i:j]], True]); i = j; continue
        on = q(st)
        if out and out[-1][0] == on and not out[-1][3]:
            out[-1][2].append((nt, v)); out[-1][1] = max(out[-1][1], q(st + ln))
        else:
            out.append([on, q(st + ln), [(nt, v)], False])
        i += 1
    for k, g in enumerate(out):                           # clip to next onset (pedal / slur keeps it sounding)
        nxt = out[k + 1][0] if k + 1 < len(out) else F(total)
        mn = F(1, 3) if g[0].denominator == 3 else F(1, 4)
        g[1] = min(max(g[1], g[0] + mn), nxt, F(total))
        if g[1] <= g[0]: g[1] = g[0] + mn
        ps = {}
        for p, v in g[2]: ps[p] = max(v, ps.get(p, 0))
        g[2] = sorted(ps.items())
    bad = [(float(g[0]), float(g[1])) for g in out if (g[1] - g[0]).denominator not in (1, 2, 3, 4, 6) or g[0].denominator not in (1,2,3,4) or g[1].denominator not in (1,2,3,4)]
    if bad and os.environ.get('MXDBG'): print('BAD', bad[:10], file=sys.stderr)
    return out


def cuts(a, z):
    """split [a,z) at integer beats when its ends mix triplet and 16th grids (avoids 12/24-tuplets)"""
    nice = lambda x: x.denominator in (1, 2, 4)
    tri = lambda x: x.denominator in (1, 3)
    if nice(a) and nice(z):
        return [(a, z)]
    if math.floor(a) == math.ceil(z) - 1 or (a.denominator == 1 and z.denominator == 1):
        return [(a, z)]                                   # inside one beat (or whole beats): fine
    pts = [a] + [F(k) for k in range(math.floor(a) + 1, math.ceil(z))] + [z]
    return [(x, y) for x, y in zip(pts, pts[1:]) if y > x]


def level_of(v):
    return min(range(len(LEVELS)), key=lambda k: abs(LEVELS[k][1] - v))


MINLV = [0]

def dyn_plan(bar_vel, nbars):
    """per-bar mean velocity -> [(bar, level)] changes + hairpins [(bar_from, bar_to, 'cresc'|'dim')]"""
    bars = sorted(bar_vel)
    if not bars: return [], []
    sm = {}
    for b in bars:                                        # 3-bar moving average (phrase-level, not note-level)
        w = [bar_vel[x] for x in bars if abs(x - b) <= 1]
        sm[b] = sum(w) / len(w)
    lv = {b: max(MINLV[0], level_of(sm[b])) for b in bars}
    marks = [(bars[0], lv[bars[0]])]; cur = lv[bars[0]]
    for k, b in enumerate(bars[1:], 1):
        nxt = lv[bars[k + 1]] if k + 1 < len(bars) else lv[b]
        if lv[b] != cur and (nxt == lv[b] or abs(lv[b] - cur) >= 2):     # change must hold >=2 bars
            marks.append((b, lv[b])); cur = lv[b]
    pins = []
    for (b1, l1), (b2, l2) in zip(marks, marks[1:]):
        span = b2 - b1
        if span >= 3:
            start = b2 - min(4, span - 1)
            pins.append((start, b2, 'cresc' if l2 > l1 else 'dim'))
    return marks, pins


# ---------------------------------------------------------------------------- build
def build(cap, key_str, title, ts68=False):
    M = cap['meter']; ev = cap['ev']
    melset = {(round(a, 4), c) for a, b, c, t in cap['mel']}
    all_end = max(st + ln for v in ev.values() for st, ln, nt, vv in v)
    nbars = max(cap['bars'], math.ceil((all_end - 1e-6) / M))
    total = nbars * M
    tonic, mode = key_str.split()
    K = key.Key(tonic, mode.lower())

    # ---- piano split
    pia = merge_same_pitch(ev.get('Piano', []))
    mel_on = {}
    for st, ln, nt, v in pia:
        if (round(st, 4), nt) in melset: mel_on.setdefault(q(st), []).append((st, ln, nt, v))
    rh1, rh2, lh = [], [], []
    for e in pia:
        st, ln, nt, v = e
        if (round(st, 4), nt) in melset: rh1.append(e)
        elif nt >= 55 and any(abs(st - x[0]) < .05 and x[2] - nt <= 12 and x[2] > nt for x in mel_on.get(q(st), [])):
            rh1.append(e)                                 # octave / sixth doubling under the melody note
        elif nt >= 60: rh2.append(e)
        else: lh.append(e)

    # ---- strings split
    sv = {'Violin': list(ev.get('Violin', [])), 'Viola': list(ev.get('Viola', [])),
          'Cello': list(ev.get('Cello', [])), 'Bass': list(ev.get('Bass', [])),
          'PadVn': [], 'PadVa': [], 'PadVc': []}
    lead_sep = bool(sv['Violin'] or sv['Viola'] or sv['Cello'])
    for st, ln, nt, v in ev.get('String', []):
        if lead_sep: (sv['PadVc'] if nt < 48 else sv['PadVa'] if nt < 62 else sv['PadVn']).append((st, ln, nt, v))
        else: (sv['Cello'] if nt < 48 else sv['Viola'] if nt < 62 else sv['Violin']).append((st, ln, nt, v))

    def bar_means(evs):
        d = {}
        for st, ln, nt, v in evs: d.setdefault(int(st // M), []).append(v)
        return {b: sum(x) / len(x) for b, x in d.items()}

    sc = stream.Score()
    md = m21.metadata.Metadata(); md.title = title; md.composer = 'music-maker'; sc.metadata = md

    def make_measures(voices, clef_obj, first_extra=None):
        """voices: list of group lists -> list of Measures"""
        ms = []
        for b in range(nbars):
            mm = stream.Measure(number=b + 1)
            if b == 0:
                mm.insert(0, clef_obj); mm.insert(0, key.KeySignature(K.sharps)); mm.insert(0, meter.TimeSignature('6/8' if ts68 else f'{M}/4'))
            b0, b1 = F(b * M), F((b + 1) * M)
            used = [vg for vg in voices if any(g[0] < b1 and g[1] > b0 for g in vg)] or voices[:1]
            for vi, vg in enumerate(used):
                vo = stream.Voice(id=str(vi + 1)) if len(used) > 1 else None
                tgt = vo if vo is not None else mm
                pos = b0
                for g in vg:
                    on, off, ps, arp = g
                    if off <= b0 or on >= b1: continue
                    s_, e_ = max(on, b0), min(off, b1)
                    if s_ > pos:
                        for a_, z_ in cuts(pos, s_): tgt.insert(a_ - b0, note.Rest(quarterLength=z_ - a_))
                    pcs_ = cuts(s_, e_)
                    for k_, (a_, z_) in enumerate(pcs_):
                        if len(ps) == 1: n = note.Note(ps[0][0])
                        else: n = chord.Chord([p for p, _ in ps])
                        n.quarterLength = z_ - a_
                        vel = max(v for _, v in ps)
                        n.volume.velocity = int(max(1, min(127, vel)))
                        before = a_ > on; after = z_ < off
                        if before and after: n.tie = m21.tie.Tie('continue')
                        elif before: n.tie = m21.tie.Tie('stop')
                        elif after: n.tie = m21.tie.Tie('start')
                        if arp and a_ == on and isinstance(n, chord.Chord):
                            n.expressions.append(expressions.ArpeggioMark('normal'))
                        n.editorial.group = g
                        tgt.insert(a_ - b0, n)
                    pos = e_
                if pos < b1:
                    for a_, z_ in cuts(pos, b1): tgt.insert(a_ - b0, note.Rest(quarterLength=z_ - a_))
                if vo is not None: mm.insert(0, vo)
            ms.append(mm)
        return ms

    def add_dyn(ms, evs, staff_measures_for_pins=None):
        marks, pins = dyn_plan(bar_means(evs), nbars)
        for b, l in marks:
            if b < len(ms): ms[b].insert(0, dynamics.Dynamic(LEVELS[l][0]))
        sp = []
        for b1, b2, kind in pins:
            n1 = first_note(ms, b1); n2 = last_note(ms, b2 - 1)
            if n1 is not None and n2 is not None and n1 is not n2:
                w = dynamics.Crescendo(n1, n2) if kind == 'cresc' else dynamics.Diminuendo(n1, n2)
                sp.append(w)
        return marks, pins, sp

    def notes_in(mm):
        return [n for n in mm.recurse().notes]

    def first_note(ms, b):
        for k in range(b, len(ms)):
            ns = notes_in(ms[k])
            if ns: return ns[0]
        return None

    def last_note(ms, b):
        for k in range(min(b, len(ms) - 1), -1, -1):
            ns = notes_in(ms[k])
            if ns: return ns[-1]
        return None

    report = {'bars': nbars, 'meter': M, 'parts': {}}
    spanners_all = []

    # ---- piano grand staff
    if pia:
        g1, g2, gl = to_groups(rh1, total), to_groups(rh2, total), to_groups(lh, total)
        rh_ms = make_measures([g1, g2] if g2 else [g1], clef.TrebleClef())
        lh_ms = make_measures([gl], clef.BassClef())
        rh = stream.PartStaff(id='PianoRH'); lhp = stream.PartStaff(id='PianoLH')
        pi = instrument.Piano(); pi.partName = 'Piano'; rh.insert(0, pi)
        pi2 = instrument.Piano(); pi2.partName = 'Piano'; lhp.insert(0, pi2)
        # tempo map on the top staff (first mark visible, the rest hidden)
        for k, (bt, bpm) in enumerate(cap['tempo']):
            b = int(bt // M)
            if b >= nbars: continue
            te = expressions.TextExpression(f'QQTEMPO{"V" if k == 0 else "H"}{round(bpm, 2)}QQ')
            off = F(bt) if isinstance(bt, int) else F(round(bt * 12), 12)
            rh_ms[b].insert(off - b * M, te)
        mel_ev = [e for e in pia if (round(e[0], 4), e[2]) in melset]
        mel_bars = {int(e[0] // M) for e in mel_ev}
        # bars without melody (intro / codetta): use the loudest piano note there
        extra = {}
        for e in pia:
            b = int(e[0] // M)
            if b not in mel_bars and b < cap['bars']: extra[b] = max(extra.get(b, 0), e[3])
        dyn_src = mel_ev + [(b * M, 1, 0, v) for b, v in extra.items()]
        marks, pins, sp = add_dyn(rh_ms, dyn_src)
        spanners_all += sp
        # pedal placeholders in the LH staff
        hs = sorted({q(h[0]) for h in cap['harm']})
        ped = [(x, 'start' if k == 0 else 'change') for k, x in enumerate(hs)] + [(F(total) - F(1, 4), 'stop')]
        for x, kind in ped:
            b = min(int(x // M), nbars - 1)
            te = expressions.TextExpression(f'QQPED{kind}QQ'); lh_ms[b].insert(x - b * M, te)
        for mm in rh_ms: rh.append(mm)
        for mm in lh_ms: lhp.append(mm)
        sc.insert(0, rh); sc.insert(0, lhp)
        sc.insert(0, layout.StaffGroup([rh, lhp], name='Piano', abbreviation='Pno.', symbol='brace', barTogether=True))
        report['parts']['Piano'] = dict(notes=len(pia), rh_melody=len(rh1), rh_upper=len(rh2), lh=len(lh),
                                        dynamics=[(b + 1, LEVELS[l][0]) for b, l in marks],
                                        hairpins=[(a + 1, b + 1, k) for a, b, k in pins], pedal_marks=len(ped))

    # ---- strings
    spec = [('Violin', instrument.Violin, clef.TrebleClef, 'Violins'), ('Viola', instrument.Viola, clef.AltoClef, 'Violas'),
            ('Cello', instrument.Violoncello, clef.BassClef, 'Violoncellos'),
            ('PadVn', instrument.Violin, clef.TrebleClef, 'Violins (pad)'), ('PadVa', instrument.Viola, clef.AltoClef, 'Violas (pad)'),
            ('PadVc', instrument.Violoncello, clef.BassClef, 'Violoncellos (pad)'), ('Bass', instrument.Contrabass, clef.Bass8vbClef, 'Contrabasses')]
    sparts = []
    for nm_, inst, cl, pname in spec:
        evs = merge_same_pitch(sv[nm_])
        if not evs: continue
        gs = to_groups(evs, total)
        ms = make_measures([gs], cl())
        p = stream.Part(id=nm_)
        ins = inst(); ins.partName = pname; p.insert(0, ins)
        marks, pins, sp = add_dyn(ms, evs)
        spanners_all += sp
        # legato slurs over each connected run of notes (split at rests)
        runs, cur = [], []
        for k, g in enumerate(gs):
            if cur and g[0] - cur[-1][1] > F(1, 8): runs.append(cur); cur = []
            cur.append(g)
        if cur: runs.append(cur)
        for mm in ms: p.append(mm)
        nobj = {}
        for n in p.recurse().notes:
            g = getattr(n.editorial, 'group', None)
            if g is not None: nobj.setdefault(id(g), []).append(n)
        nsl = 0
        for r in runs:
            if len(r) < 2: continue
            a = nobj.get(id(r[0]), [None])[0]; b = nobj.get(id(r[-1]), [None])[-1]
            if a is not None and b is not None and a is not b:
                spanners_all.append(spanner.Slur(a, b)); nsl += 1
        sparts.append(p)
        report['parts'][pname] = dict(notes=len(evs), dynamics=[(b + 1, LEVELS[l][0]) for b, l in marks],
                                      hairpins=[(a + 1, b + 1, k) for a, b, k in pins], slurs=nsl)
    for p in sparts: sc.insert(0, p)
    for s_ in spanners_all: sc.insert(0, s_)
    return sc, report


SOUNDS = {'Piano': 'keyboard.piano', 'Violins': 'strings.violin', 'Violas': 'strings.viola',
          'Violoncellos': 'strings.cello', 'Contrabasses': 'strings.contrabass'}


def postprocess(path):
    x = open(path, encoding='utf-8').read()
    # pedal placeholders -> real pedal lines
    x = re.sub(r'<words[^>]*>QQPED(\w+)QQ</words>', lambda m: f'<pedal type="{m.group(1)}" line="yes" sign="no"/>', x)
    # tempo placeholders -> metronome mark + sound tempo (music21's own marks get negative offsets MuseScore ignores)
    def tmp(m):
        vis, bpm, rest = m.group(1), m.group(2), m.group(3)
        po = '' if vis == 'V' else ' print-object="no"'
        return (f'<direction placement="above"><direction-type><metronome parentheses="no"{po}><beat-unit>quarter</beat-unit>'
                f'<per-minute>{bpm}</per-minute></metronome></direction-type>{rest}<sound tempo="{bpm}"/></direction>')
    x = re.sub(r'<direction[^>]*>\s*<direction-type>\s*<words[^>]*>QQTEMPO([VH])([\d.]+)QQ</words>\s*</direction-type>(.*?)</direction>', tmp, x, flags=re.S)
    # directions music21 positions with <offset> (no note starts there in that voice): MuseScore ignores
    # the offset, so move the time cursor explicitly with backup/forward around the direction instead
    def mv(m):
        d = m.group(0); o = int(re.search(r'<offset[^>]*>(-?\d+)</offset>', d).group(1))
        d = re.sub(r'\s*<offset[^>]*>-?\d+</offset>', '', d)
        if o < 0: return f'<backup><duration>{-o}</duration></backup>{d}<forward><duration>{-o}</duration></forward>'
        return f'<forward><duration>{o}</duration></forward>{d}<backup><duration>{o}</duration></backup>'
    x = re.sub(r'<direction\b[^>]*>(?:(?!</direction>).)*<offset[^>]*>-?\d+</offset>(?:(?!</direction>).)*</direction>', mv, x, flags=re.S)
    # instrument-sound ids so MuseScore picks the right instrument (and the matching Muse Sounds patch)
    def fix_part(m):
        blk = m.group(0)
        pn = re.search(r'<part-name>([^<]*)</part-name>', blk)
        snd = SOUNDS.get(pn.group(1).replace(' (pad)', '').strip()) if pn else None
        if snd and '<instrument-sound>' not in blk:
            blk = re.sub(r'(<instrument-name>[^<]*</instrument-name>)', r'\1\n        <instrument-sound>' + snd + '</instrument-sound>', blk, count=1)
        return blk
    x = re.sub(r'<score-part .*?</score-part>', fix_part, x, flags=re.S)
    open(path, 'w', encoding='utf-8').write(x)
    return x




def export(song, path, key_str=None, min_level='pp'):
    """Song -> MusicXML file; returns the report dict (incl. validation)."""
    cap = song.capture()
    MINLV[0] = [l for l, _ in LEVELS].index(min_level) if min_level else 0
    sc, rep = build(cap, key_str or song.key_str, song.name, ts68=cap.get('ts68', False))
    os.makedirs(os.path.dirname(os.path.abspath(path)) or '.', exist_ok=True)
    sc.write('musicxml', fp=path)
    x = postprocess(path)
    rep['xml'] = dict(pedal=x.count('<pedal '), dynamics=x.count('<dynamics'), wedges=x.count('<wedge '),
                      slurs=x.count('<slur '), tempo=len(re.findall(r'<sound[^>]*tempo=', x)))
    rep['validasi'] = validate(path, cap, rep)
    return rep


def validate(path, cap, rep):
    """re-import the file with music21 and compare against the composer's notes"""
    problems = []
    s = m21.converter.parse(path)
    got = 0
    for n in s.recurse().notes:
        if n.tie is not None and n.tie.type in ('stop', 'continue'): continue
        got += len(n.pitches) if n.isChord else 1
    want = sum(p['notes'] for p in rep['parts'].values())
    # chords can merge duplicate pitches that start together; allow a small margin
    if got < want * .97 or got > want * 1.01:
        problems.append(f'jumlah not {got} vs komposer {want}')
    if cap['tempo'] and rep['xml']['tempo'] < len([t for t in cap['tempo'] if t[0] < rep['bars'] * cap['meter']]) * .95:
        problems.append(f"tempo {rep['xml']['tempo']} dari {len(cap['tempo'])}")
    if 'Piano' in rep['parts'] and rep['xml']['pedal'] < 2: problems.append('pedal hilang')
    if rep['xml']['dynamics'] < 2: problems.append('dinamika hilang')
    ts = [t.ratioString for t in s.recurse().getElementsByClass('TimeSignature')]
    want_ts = '6/8' if cap.get('ts68') else f"{cap['meter']}/4"
    if not ts or ts[0] != want_ts: problems.append(f'birama {ts[:1]} bukan {want_ts}')
    for p in s.parts:
        for m in p.getElementsByClass('Measure'):
            if abs(m.duration.quarterLength - cap['meter']) > 1e-6 and m.number < rep['bars']:
                problems.append(f'birama {m.number} panjang {m.duration.quarterLength}'); break
    return dict(ok=not problems, not_terbaca=got, not_komposer=want, masalah=problems)
