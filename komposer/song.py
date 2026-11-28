"""Note container + clean MIDI writer for the komposer engine.

A Song holds raw (un-humanised) note events per track, the harmony map and the
tempo map. The MusicXML exporter reads these raw events; the MIDI writer adds a
little human timing for DAW use. MIDI hygiene rules (learned the hard way):
same pitch within 0.15 beat = one note; a repeated pitch ends before it is
struck again; sustain pedal follows the harmony.
"""
import random
import mido

TPB = 480
TRACKS = ('Piano', 'String', 'Cello', 'Bass', 'Violin', 'Viola')
PROGRAMS = {'Piano': (0, 0), 'String': (3, 48), 'Bass': (2, 32), 'Cello': (7, 42), 'Violin': (4, 40), 'Viola': (5, 41)}


class Song:
    def __init__(self, name, bpm, meter, seed, ts68=False):
        self.name, self.bpm, self.meter, self.ts68 = name, bpm, meter, ts68
        self.ev = {k: [] for k in TRACKS}
        self.harm = []          # (abs_beat, bass_midi, [pcs])
        self.mel = []           # (abs_beat, len, midi, track)
        self.sections = []      # (name, first_bar)
        self.tempo = []         # (abs_beat, bpm)
        self.bars = 0
        self.info = {}
        self.seed = seed

    def add(self, track, beat, ln, nt, v):
        self.ev[track].append((beat, ln, int(nt), int(max(1, min(120, v)))))

    def add_mel(self, track, beat, ln, nt, v):
        self.add(track, beat, ln, nt, v)
        self.mel.append((beat, ln, int(nt), track))

    def mel_low(self, start, end, track=None):
        ns = [m[2] for m in self.mel if m[0] < end and m[0] + m[1] > start and (track is None or m[3] == track)]
        return min(ns) if ns else 200

    def mel_high(self, start, end):
        ns = [m[2] for m in self.mel if m[0] < end and m[0] + m[1] > start]
        return max(ns) if ns else -1

    def chord_at(self, beat):
        cur = None
        for h in self.harm:
            if h[0] <= beat + 1e-6: cur = h
            else: break
        return cur

    def total_beats(self):
        return self.bars * self.meter

    # ------------------------------------------------------------------ timing
    def seconds_at(self, beat):
        pts = sorted(self.tempo) or [(0, self.bpm)]
        t, last_b, last_bpm = 0.0, 0.0, pts[0][1]
        for b, bpm in pts:
            if b >= beat: break
            t += (b - last_b) * 60 / last_bpm
            last_b, last_bpm = b, bpm
        return t + (beat - last_b) * 60 / last_bpm

    # ------------------------------------------------------------------ MIDI
    def write_midi(self, out, jitter=.012, lead_lag=.015):
        rnd = random.Random(self.seed * 7 + 1)
        mset = {(m[0], m[2]) for m in self.mel}
        mf = mido.MidiFile(type=1, ticks_per_beat=TPB)
        meta = mido.MidiTrack(); mf.tracks.append(meta)
        meta.append(mido.MetaMessage('track_name', name=self.name, time=0))
        if self.ts68:
            meta.append(mido.MetaMessage('time_signature', numerator=6, denominator=8, time=0))
        else:
            meta.append(mido.MetaMessage('time_signature', numerator=self.meter, denominator=4, time=0))
        last = 0
        for beat, bpm in sorted(self.tempo):
            t = int(round(beat * TPB)); meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=t - last)); last = t
        for name in TRACKS:
            if not self.ev[name]: continue
            ch, prog = PROGRAMS[name]
            tr = mido.MidiTrack(); mf.tracks.append(tr)
            tr.append(mido.MetaMessage('track_name', name=name, time=0))
            tr.append(mido.Message('program_change', channel=ch, program=prog, time=0))
            ev = []
            for (st, ln, nt, v) in self.ev[name]:
                j = rnd.uniform(-jitter, jitter) * self.bpm / 60
                if (st, nt) in mset and name == 'Piano': j += lead_lag * self.bpm / 60
                ev.append((max(0, st + j), ln, nt, max(1, min(127, v + rnd.randint(-1, 1)))))
            fixed = clean_notes(ev)
            msgs = []
            for (st, ln, nt, v) in fixed:
                msgs.append((int(st * TPB), 1, nt, v)); msgs.append((int((st + ln) * TPB), 0, nt, 0))
            if name == 'Piano':
                hs = [h[0] for h in self.harm] + [self.total_beats() + 8]
                for a, b in zip(hs, hs[1:]):
                    msgs.append((int((a + .08) * TPB), 2, 64, 127))
                    msgs.append((int((b - .07) * TPB), 2, 64, 0))
            msgs.sort(key=lambda x: (x[0], {0: 0, 2: 1, 1: 2}[x[1]]))
            lt = 0
            for t, on, nt, v in msgs:
                if on == 2: tr.append(mido.Message('control_change', channel=ch, control=nt, value=v, time=t - lt))
                else: tr.append(mido.Message('note_on' if on else 'note_off', channel=ch, note=nt, velocity=v if on else 0, time=t - lt))
                lt = t
        mf.save(out)
        return mf

    def capture(self):
        """plain dict for the MusicXML exporter"""
        return dict(name=self.name, bpm=self.bpm, meter=self.meter, bars=self.bars, sections=list(self.sections),
                    harm=[(h[0], h[1], list(h[2])) for h in self.harm], tempo=sorted(self.tempo),
                    ev={n: list(v) for n, v in self.ev.items()}, mel=[tuple(x) for x in self.mel], ts68=self.ts68)


def clean_notes(ev):
    ev = sorted(ev)
    merged = []                                 # same pitch within 0.15 beat -> one note
    for e in ev:
        for k, m_ in enumerate(merged):
            if m_[2] == e[2] and abs(m_[0] - e[0]) < .15:
                s0 = min(m_[0], e[0]); merged[k] = (s0, max(m_[0] + m_[1], e[0] + e[1]) - s0, e[2], max(m_[3], e[3])); break
        else: merged.append(e)
    ev = sorted(merged); nxt = {}; fixed = []
    for (st, ln, nt, v) in reversed(ev):        # repeated pitch ends before re-strike
        en = st + ln
        if nt in nxt and en > nxt[nt] - .02: en = nxt[nt] - .02
        nxt[nt] = st; fixed.append((st, max(.06, en - st), nt, v))
    return sorted(fixed)
