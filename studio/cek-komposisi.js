#!/usr/bin/env node
// Measures how "composed" the generated tunes are, for every mood x genre (or one), without audio.
// Usage: node studio/cek-komposisi.js [--mesin komposisi|kit] [--seeds 1,2,3] [--mood Sedih] [--genre Jazz]
// Per song: range, % stepwise moves, biggest leap, % strong-beat notes that are chord tones,
// how often the opening motif's rhythm returns, cadences (A phrase ends away from home, song ends home),
// where the highest note sits, and MIDI problems (overlapping same-pitch notes, stub notes < 30 ms).
'use strict';
const path = require('path');
const root = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? a.concat([[x.slice(2), all[i + 1]]]) : a), []));
(async () => {
  const core = require('playwright-core');
  let browser;
  for (const o of [{ executablePath: process.env.MUSIC_MAKER_BROWSER }, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { browser = await core.chromium.launch({ ...o, headless: true }); break; } catch {}
  }
  const page = await browser.newPage();
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForFunction(() => typeof newSong === 'function' && typeof sampleData === 'object');
  const moods = args.mood ? [args.mood] : ['Sedih', 'Melankolis', 'Tenang', 'Ceria'];
  const genres = args.genre ? [args.genre] : ['Akustik', 'Lo-fi', 'Pop', 'Jazz', 'Bossa'];
  const seeds = (args.seeds ?? '1,2,3,4,5').split(',').map(Number);
  const rows = await page.evaluate(({ moods, genres, seeds, engine, dur }) => {
    const out = [];
    for (const mood of moods) for (const genre of genres) for (const seed of seeds) {
      ctx = new OfflineAudioContext(2, 44100, 44100);
      newSong({ genre, mood, duration: dur, names: ['Piano', 'Bass'], seed, pianoMelody: true, engine });
      const seq = [];
      song.melody.forEach((bar, b) => bar.forEach(([on, len, d]) => { if (d !== null && d !== undefined) seq.push({ t: b * 8 + on, len, d, root: song.harmony[b].root, b }); }));
      const moves = seq.slice(1).map((n, i) => Math.abs(n.d - seq[i].d));
      const strong = seq.filter(n => n.t % 4 === 0);
      const ct = strong.filter(n => [0, 2, 4].includes(((n.d - n.root) % 7 + 7) % 7)).length;
      // rhythm signature per bar; motif = the first sung bar
      const sig = song.melody.map(bar => bar.map(n => n[0] + ':' + n[1]).join(','));
      const first = sig.find(x => x);
      const repeats = sig.filter(x => x === first).length;
      const top = seq.reduce((m, n) => (n.d > m.d ? n : m), seq[0]);
      const bars = song.harmony.length;
      const piano = song.tracks.find(t => t.name === 'Piano').events;
      // same pitch overlap / stubs in piano events (seconds)
      const evs = piano.map(e => ({ at: e.step * song.step, end: e.step * song.step + (e.ring ?? e.len * song.step), note: e.note })).sort((a, b) => a.at - b.at);
      let overlaps = 0, stubs = 0; const last = {};
      for (const e of evs) { if (last[e.note] && last[e.note].end > e.at + .001 && e.at - last[e.note].at > .15 * song.step * 2) overlaps++; if (e.end - e.at < .03) stubs++; last[e.note] = e; }
      out.push({ mood, genre, seed, desc: describe(song), bentuk: song.komposisi?.bentuk ?? song.kitNames?.join('+'), bars,
        range: seq.length ? Math.max(...seq.map(n => n.d)) - Math.min(...seq.map(n => n.d)) : 0,
        stepwise: +(moves.filter(m => m <= 1).length / Math.max(1, moves.length)).toFixed(2),
        leaps3: moves.filter(m => m >= 3).length, maxLeap: Math.max(0, ...moves),
        chordTones: +(ct / Math.max(1, strong.length)).toFixed(2), motifReturns: repeats,
        climaxAt: +(top ? top.b / bars : 0).toFixed(2), endsHome: seq.length ? ((seq.at(-1).d % 7) + 7) % 7 === 0 : false,
        notes: seq.length, overlaps, stubs, big: seq.slice(1).map((n, i) => [n.b, song.harmony[n.b].section, seq[i].d, n.d]).filter(x => Math.abs(x[3] - x[2]) >= 6) });
    }
    return out;
  }, { moods, genres, seeds, engine: args.mesin ?? 'komposisi', dur: Number(args.durasi ?? 180) });
  console.log(JSON.stringify(rows));
  await browser.close();
})();
