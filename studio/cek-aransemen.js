#!/usr/bin/env node
// Measures how the arrangement develops through a song, without audio: per section of the form,
// how many notes each instrument plays per bar, the counter-line, drum fills and the loudness shape
// (phrase dynamics in dB). Usage: node studio/cek-aransemen.js [--mood Sedih] [--genre Akustik]
//   [--seeds 701,702] [--instrumen Piano,Gitar,Bass,Drum,String] [--durasi 150]
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
  const res = await page.evaluate(async ({ mood, genre, seeds, names, dur }) => {
    ctx = new OfflineAudioContext(2, 44100, 44100);
    for (const n of names) await loadBank(n);
    const out = [];
    for (const seed of seeds) {
      ctx = new OfflineAudioContext(2, 44100, 44100);
      newSong({ genre, mood, duration: dur, names, seed, pianoMelody: true });
      const H = song.harmony, sec = {};
      H.forEach((h, b) => { const k = `${h.section}(${h.layer})`; (sec[k] ??= { bars: 0, first: b }).bars++; });
      for (const t of song.tracks) for (const e of t.events) {
        const b = Math.min(H.length - 1, Math.floor(e.step / 8)), h = H[b], k = `${h.section}(${h.layer})`;
        const name = e.counter ? 'Cello' : t.name;
        sec[k][name] = (sec[k][name] ?? 0) + 1;
        if (e.tune && e.expr !== undefined) (sec[k].db ??= []).push(e.expr);
      }
      const rows = Object.entries(sec).sort((a, b) => a[1].first - b[1].first).map(([k, v]) => {
        const per = n => v[n] ? (v[n] / v.bars).toFixed(1) : '-';
        const db = v.db ? (v.db.reduce((a, x) => a + x, 0) / v.db.length).toFixed(1) : '-';
        return `${k.padEnd(12)} ${String(v.bars).padStart(3)} birama | ` + [...names, 'Cello'].map(n => `${n} ${per(n)}`).join('  ') + ` | melodi ${db} dB`;
      });
      out.push(`${mood} ${genre} seed ${seed} · ${song.style?.name} · bentuk ${song.komposisi?.bentuk}\n  ` + rows.join('\n  '));
    }
    return out;
  }, { mood: args.mood ?? 'Sedih', genre: args.genre ?? 'Akustik', seeds: (args.seeds ?? '701').split(',').map(Number),
       names: (args.instrumen ?? 'Piano,Gitar,Bass,Drum,String').split(','), dur: Number(args.durasi ?? 150) });
  console.log(res.join('\n\n'));
  await browser.close();
})();
