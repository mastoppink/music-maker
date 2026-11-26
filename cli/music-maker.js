#!/usr/bin/env node
// Music Maker CLI: makes the same songs as the web app (index.html + studio.js) and
// saves mastered WAV files. It runs the app's own engine in a hidden browser, so the
// result is identical to "Unduh WAV" in the app.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const help = `Music Maker CLI

Pemakaian:
  node cli/music-maker.js buat [opsi]     Buat lagu dan simpan sebagai WAV
  node cli/music-maker.js daftar          Tampilkan mood, genre, gaya, dan pola yang tersedia
  node cli/music-maker.js bantuan         Tampilkan teks ini

Opsi untuk "buat":
  --mood <Tenang|Ceria|Melankolis>        Bawaan: Tenang
  --genre <Akustik|Lo-fi|Pop>             Bawaan: Akustik
  --sumber <kit|klasik>                   Kit orisinal atau Klasik (Bach). Bawaan: kit
  --durasi <detik>                        Misalnya 60, 180, 300. Bawaan: 60
  --instrumen <daftar>                    Bawaan: Piano,Gitar,Bass,Drum
  --melodi <gantian|piano>                Melodi gantian piano & gitar, atau piano saja. Bawaan: gantian
  --seed <angka>                          Seed yang sama memberi lagu yang sama. Bawaan: acak
  --versi <angka>                         Buat beberapa versi dengan seed berurutan. Bawaan: 1
  --gaya <nama>                           Paksa gaya lagu, misalnya Santai (hanya sumber kit)
  --pola <Instrumen=pola,...>             Misalnya Gitar=genjreng,Drum=tipis (hanya sumber kit)
  --variasi <Instrumen=nomor,...>         Variasi pola, mulai dari 1. Misalnya Gitar=2
  --volume <Instrumen=0..100,...>         Bawaan: 70 untuk semua
  --bisu <daftar>                         Instrumen yang dibisukan, misalnya Drum
  --keluar <folder>                       Folder hasil. Bawaan: ./hasil
  --dari <file.json>                      Buat ulang lagu dari file pengaturan yang disimpan
  --browser <path>                        Path ke Chrome/Edge/Chromium kalau tidak ditemukan otomatis

Setiap WAV disimpan bersama file .json berisi pengaturannya. Pakai --dari file itu
untuk membuat lagu yang persis sama lagi.

Contoh:
  node cli/music-maker.js buat --durasi 180 --gaya Santai
  node cli/music-maker.js buat --mood Ceria --versi 3 --pola Drum=tipis
  node cli/music-maker.js buat --sumber klasik --durasi 300 --instrumen Piano,Bass
  node cli/music-maker.js buat --dari hasil/tenang-akustik-kit-seed123.json`;

function parseArgs(argv) {
  const [command = 'bantuan', ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '-h' || arg === '--help' || arg === '--bantuan') { opts.bantuan = true; continue; }
    if (!arg.startsWith('--')) throw new Error(`Argumen tidak dikenal: ${arg}`);
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    const value = inline ?? rest[++i];
    if (value === undefined) throw new Error(`Opsi --${key} butuh nilai.`);
    opts[key] = value;
  }
  return { command, opts };
}
const list = text => String(text).split(',').map(s => s.trim()).filter(Boolean);
const pairs = (text, name) => Object.fromEntries(list(text).map(item => {
  const [k, v] = item.split('=');
  if (!k || v === undefined) throw new Error(`Format --${name} harus Instrumen=nilai, misalnya Gitar=2.`);
  return [k.trim(), v.trim()];
}));

// Turn command-line options into the settings the engine needs.
function settingsFrom(opts) {
  const known = ['mood','genre','sumber','durasi','instrumen','melodi','seed','versi','gaya','pola','variasi','volume','bisu','keluar','dari','browser','bantuan'];
  for (const key of Object.keys(opts)) if (!known.includes(key)) throw new Error(`Opsi tidak dikenal: --${key}. Lihat "bantuan".`);
  const base = opts.dari ? JSON.parse(fs.readFileSync(opts.dari, 'utf8')) : {};
  const s = {
    mood: opts.mood ?? base.mood ?? 'Tenang',
    genre: opts.genre ?? base.genre ?? 'Akustik',
    sumber: opts.sumber ?? base.sumber ?? 'kit',
    durasi: Number(opts.durasi ?? base.durasi ?? 60),
    instrumen: opts.instrumen ? list(opts.instrumen) : base.instrumen ?? ['Piano','Gitar','Bass','Drum'],
    melodi: opts.melodi ?? base.melodi ?? 'gantian',
    seed: opts.seed !== undefined ? Number(opts.seed) : base.seed ?? Math.floor(Math.random() * 1e9),
    gaya: opts.gaya ?? base.gaya ?? null,
    pola: opts.pola ? pairs(opts.pola, 'pola') : base.pola ?? {},
    variasi: opts.variasi ? Object.fromEntries(Object.entries(pairs(opts.variasi, 'variasi')).map(([k, v]) => [k, Number(v)])) : base.variasi ?? {},
    volume: opts.volume ? Object.fromEntries(Object.entries(pairs(opts.volume, 'volume')).map(([k, v]) => [k, Number(v)])) : base.volume ?? {},
    bisu: opts.bisu ? list(opts.bisu) : base.bisu ?? []
  };
  if (!['Tenang','Ceria','Melankolis'].includes(s.mood)) throw new Error('--mood harus Tenang, Ceria, atau Melankolis.');
  if (!['Akustik','Lo-fi','Pop'].includes(s.genre)) throw new Error('--genre harus Akustik, Lo-fi, atau Pop.');
  if (!['kit','klasik'].includes(s.sumber)) throw new Error('--sumber harus kit atau klasik.');
  if (!['gantian','piano'].includes(s.melodi)) throw new Error('--melodi harus gantian atau piano.');
  if (!(s.durasi >= 10 && s.durasi <= 900)) throw new Error('--durasi harus antara 10 dan 900 detik.');
  if (!Number.isInteger(s.seed) || s.seed < 0) throw new Error('--seed harus bilangan bulat positif.');
  for (const v of Object.values(s.volume)) if (!(v >= 0 && v <= 100)) throw new Error('--volume harus 0 sampai 100.');
  for (const v of Object.values(s.variasi)) if (!(Number.isInteger(v) && v >= 1)) throw new Error('--variasi mulai dari 1.');
  return s;
}

// Use a browser that is already installed (Edge or Chrome), so nothing large has to be downloaded.
async function launch(browserPath) {
  let core;
  try { core = require('playwright-core'); }
  catch { throw new Error('Paket playwright-core belum terpasang. Jalankan "npm install" di folder music-maker.'); }
  const tries = [];
  const exe = browserPath || process.env.MUSIC_MAKER_BROWSER;
  if (exe) tries.push({ executablePath: exe });
  tries.push({ channel: 'msedge' }, { channel: 'chrome' });
  for (const options of tries) {
    try { return await core.chromium.launch({ ...options, headless: true }); } catch {}
  }
  try { return await require('playwright').chromium.launch(); } catch {}
  throw new Error('Tidak menemukan Chrome atau Edge. Pasang salah satunya, atau beri path dengan --browser <path>.');
}

async function openStudio(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(root, 'index.html').replace(/\\/g, '/'));
  await page.waitForFunction(() => typeof newSong === 'function' && typeof sampleData === 'object');
  if (errors.length) throw new Error('Aplikasi gagal dimuat: ' + errors[0]);
  return page;
}

// Render one song inside the page and return its description; WAV bytes stay in the page.
function renderInPage(s) {
  return async s => {
    const names = s.instrumen;
    const fail = text => ({ error: text });
    for (const n of names) if (!sampleData[n]) return fail(`Instrumen tidak dikenal: ${n}. Pilihan: ${Object.keys(sampleData).join(', ')}.`);
    if (s.gaya && !styles.some(x => x.name === s.gaya)) return fail(`Gaya tidak dikenal: ${s.gaya}. Pilihan: ${styles.map(x => x.name).join(', ')}.`);
    for (const [n, p] of Object.entries(s.pola)) {
      if (!partOptions[n]) return fail(`Instrumen tidak punya pola: ${n}.`);
      if (!partOptions[n][p]) return fail(`Pola ${n} tidak dikenal: ${p}. Pilihan: ${Object.keys(partOptions[n]).join(', ')}.`);
    }
    ctx = new OfflineAudioContext(2, 44100, 44100);
    for (const n of names) await loadBank(n);
    const force = { parts: s.pola };
    if (s.gaya) force.style = s.gaya;
    newSong({ genre: s.genre, mood: s.mood, duration: s.durasi, names, seed: s.seed, source: s.sumber,
      pianoMelody: s.melodi === 'piano', force });
    const notes = [];
    if (!song.parts && (Object.keys(s.pola).length || Object.keys(s.variasi).length || s.gaya))
      notes.push('Gaya, pola, dan variasi hanya berlaku untuk sumber kit dengan genre Akustik dan mood Tenang/Ceria; diabaikan.');
    for (const track of song.tracks) {
      const v = s.variasi[track.name];
      if (v && song.parts?.[track.name]) {
        song.variants[track.name] = v - 1;
        track.events = pattern(track.name);
      }
      if (s.volume[track.name] !== undefined) track.volume = s.volume[track.name] / 100;
      track.muted = s.bisu.includes(track.name);
    }
    const buf = master(await renderMix(false));
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) for (const x of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
    window.__wav = new Uint8Array(await wav(buf).arrayBuffer());
    const variants = {};
    for (const track of song.tracks) if (song.parts?.[track.name])
      variants[track.name] = (song.variants[track.name] ?? 0) % variationCount[track.name][song.parts[track.name]] + 1;
    return { description: describe(song), seconds: buf.duration, lufs: buf.loudness, peakDb: 20 * Math.log10(peak),
      gaya: song.style?.name ?? null, pola: song.parts ?? {}, variasi: variants, notes, size: window.__wav.length };
  };
}

async function fetchWav(page, size) {
  const chunks = [], step = 4 * 1024 * 1024;
  for (let at = 0; at < size; at += step) {
    const b64 = await page.evaluate(([at, step]) => {
      const part = window.__wav.subarray(at, at + step);
      let s = '';
      for (let i = 0; i < part.length; i += 32768) s += String.fromCharCode(...part.subarray(i, i + 32768));
      return btoa(s);
    }, [at, step]);
    chunks.push(Buffer.from(b64, 'base64'));
  }
  return Buffer.concat(chunks);
}

async function make(opts) {
  const settings = settingsFrom(opts);
  const count = Math.max(1, Number(opts.versi ?? 1));
  const outDir = path.resolve(opts.keluar ?? 'hasil');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch(opts.browser);
  try {
    const page = await openStudio(browser);
    for (let i = 0; i < count; i++) {
      const s = { ...settings, seed: settings.seed + i };
      const started = Date.now();
      process.stdout.write(`Membuat lagu ${i + 1}/${count} (seed ${s.seed})… `);
      const info = await page.evaluate(renderInPage(s), s);
      if (info.error) throw new Error(info.error);
      const name = `${s.mood}-${s.genre}-${s.sumber}-seed${s.seed}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const file = path.join(outDir, name + '.wav');
      fs.writeFileSync(file, await fetchWav(page, info.size));
      // Settings file: the exact pattern and variation used, so --dari reproduces this song.
      const saved = { ...s, gaya: info.gaya ?? s.gaya, pola: info.pola, variasi: info.variasi };
      fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(saved, null, 2) + '\n');
      const min = Math.floor(info.seconds / 60), sec = Math.round(info.seconds % 60);
      console.log(`selesai dalam ${Math.round((Date.now() - started) / 1000)} detik`);
      console.log(`  ${info.description}`);
      console.log(`  Durasi ${min}:${String(sec).padStart(2, '0')} · ${info.lufs.toFixed(1)} LUFS · puncak ${info.peakDb.toFixed(1)} dB`);
      if (Object.keys(info.pola).length)
        console.log('  Pola: ' + Object.entries(info.pola).map(([k, v]) => `${k}=${v} (variasi ${info.variasi[k]})`).join(', '));
      for (const note of info.notes) console.log('  Catatan: ' + note);
      const shown = path.relative(process.cwd(), file);
      console.log(`  Disimpan: ${shown.startsWith('..') ? file : shown}`);
    }
  } finally {
    await browser.close();
  }
}

async function show(opts) {
  const browser = await launch(opts.browser);
  try {
    const page = await openStudio(browser);
    const info = await page.evaluate(() => ({
      instruments: Object.keys(sampleData),
      styles: styles.map(s => ({ name: s.name, mood: s.mood, bpm: s.bpm, guitar: s.guitar, piano: s.piano, drum: s.drum })),
      parts: Object.fromEntries(Object.entries(partOptions).map(([n, o]) => [n, Object.entries(o).map(([k, label]) => `${k} (${label}, ${variationCount[n][k]} variasi)`)])),
      moods: [...document.querySelectorAll('#mood option')].map(o => o.value),
      genres: [...document.querySelectorAll('#genre option')].map(o => o.value)
    }));
    console.log('Mood:       ' + info.moods.join(', '));
    console.log('Genre:      ' + info.genres.join(', '));
    console.log('Sumber:     kit (Kit orisinal), klasik (Bach)');
    console.log('Instrumen:  ' + info.instruments.join(', '));
    console.log('\nGaya lagu (sumber kit, genre Akustik):');
    for (const s of info.styles) console.log(`  ${s.name.padEnd(11)} mood ${s.mood.padEnd(7)} ${s.bpm[0]}–${s.bpm[1]} BPM · gitar ${s.guitar}, piano ${s.piano}, drum ${s.drum}`);
    console.log('\nPola per instrumen (--pola Instrumen=nama, --variasi Instrumen=nomor):');
    for (const [n, list] of Object.entries(info.parts)) console.log(`  ${n.padEnd(6)} ${list.join(', ')}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    const { command, opts } = parseArgs(process.argv.slice(2));
    if (opts.bantuan || ['bantuan','help','-h','--help'].includes(command)) console.log(help);
    else if (command === 'buat') await make(opts);
    else if (command === 'daftar') await show(opts);
    else throw new Error(`Perintah tidak dikenal: ${command}. Lihat "node cli/music-maker.js bantuan".`);
  } catch (e) {
    console.error('Gagal: ' + e.message);
    process.exitCode = 1;
  }
})();
