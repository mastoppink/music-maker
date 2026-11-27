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
  node cli/music-maker.js rangkaian [opsi] Sambung banyak lagu menjadi satu file panjang (sampai 3 jam)
  node cli/music-maker.js master <file...> Atur volume file audio (misalnya hasil DAW) ke standar YouTube
  node cli/music-maker.js daftar          Tampilkan mood, genre, gaya, dan pola yang tersedia
  node cli/music-maker.js bantuan         Tampilkan teks ini

Opsi untuk "buat":
  --mood <Tenang|Ceria|Melankolis|Sedih>  Bawaan: Tenang
  --genre <Akustik|Lo-fi|Pop|Jazz|Bossa>  Bawaan: Akustik
  --sumber <kit|klasik>                   Kit orisinal atau Klasik (Bach). Bawaan: kit
  --durasi <detik>                        Misalnya 60, 180, 300. Bawaan: 60
  --instrumen <daftar>                    Piano, Gitar, Bass, Drum, String. Bawaan: Piano,Gitar,Bass,Drum
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
  --midi                                  Simpan juga file MIDI dengan formasi band lengkap untuk genrenya
                                          (lihat "daftar"; misalnya Jazz: saksofon, trompet, drum lengkap)
  --mesin <komposisi|kit>                 Cara menulis lagu. komposisi (bawaan): satu motif, bentuk lagu
                                          intro–A–A'–B (klimaks)–A''–outro, frasa tanya-jawab. kit: cara lama
  --midi-saja                             Hanya MIDI dan .json, tanpa WAV (lebih cepat, untuk dipakai di DAW)
  --stem                                  Simpan juga satu WAV per instrumen
  --render <studio|app>                   studio (bawaan bila terpasang, misalnya di VPS): piano FluidSynth + string
                                          sampler dengan legato, ruang hall, mix jernih dan bass empuk
                                          (butuh Python, fluidsynth, ffmpeg dan folder bahan studio; lihat README).
                                          Kalau belum terpasang, otomatis memakai app (suara aplikasi)
  --piano <salamander|kw>                 Piano untuk render studio. salamander (bawaan, kualitas terbaik,
                                          WAJIB kredit CC BY 3.0, otomatis ditulis di file kredit/daftar lagu)
                                          atau kw (Upright Piano KW, CC0, tanpa kredit)
  --bass-studio <busur|petik>             Bass untuk render studio: busur (contrabass digesek, lembut) atau
                                          petik. Bawaan: busur untuk Sedih/Melankolis (kecuali Bossa), lainnya petik
  --aset-studio <folder>                  Folder bahan studio (sf/, vsco/). Bawaan: $MUSIC_MAKER_STUDIO atau /home/ubuntu/studio
  --python <path>                         Python dengan numpy, scipy, soundfile, mido, pyloudnorm, pedalboard
  --katalog <file>                        Katalog sidik melodi semua lagu yang pernah dibuat (cek kemiripan).
                                          Bawaan: ~/.music-maker/katalog.json
  --batas-mirip <0..1>                    Batas kemiripan melodi (Jaccard 6 interval). Bawaan: 0.35
  --tanpa-cek-mirip                       Jangan cek kemiripan dengan katalog
  --reset-katalog                         Kosongkan katalog sebelum mulai
  --video <gambar>                        Buat juga video MP4 (gambar diam + musik). Butuh ffmpeg
  --ffmpeg <path>                         Path ke ffmpeg kalau tidak ada di PATH

Opsi tambahan untuk "rangkaian" (semua opsi "buat" juga berlaku untuk setiap lagu;
--midi menyimpan MIDI setiap lagu di folder <nama>-midi):
  --menit <angka>                         Panjang rangkaian, 1 sampai 180 (3 jam). Bawaan: 30
  --durasi-lagu <detik>                   Panjang tiap lagu. Bawaan: 180
  --jeda <detik>                          Lama peralihan antarlagu (lagu lama memudar, lagu baru masuk). Bawaan: 3
  --campur <Mood/Genre,...>               Bergantian antar kombinasi, misalnya Sedih/Akustik,Melankolis/Jazz
  --target <LUFS>                         Kekerasan akhir seluruh rangkaian. Bawaan: -14 (puncak maks -1.2 dBTP)
  --mp3                                   Simpan juga MP3 320k
  --rencana                               Hanya susun rencana (gaya, kunci, tempo, durasi) tanpa audio, cepat
  Gaya, nada dasar, dan variasi pola bergilir otomatis: gaya yang sama dan nada dasar yang sama tidak
  muncul dalam 5 lagu berdekatan selama pilihannya cukup.
  Lagu yang sudah jadi disimpan di folder <nama>-lagu; kalau proses terputus, jalankan perintah
  yang sama lagi dan lagu yang sudah ada dilewati.

Opsi untuk "master":
  --target <LUFS>                         Kekerasan tujuan. Bawaan: -14 (acuan YouTube)
  --bit <24|16>                           Kedalaman bit WAV hasil. Bawaan: 24
  --keluar <folder>                       Folder hasil. Bawaan: folder yang sama dengan file asli
  --ffmpeg <path>                         Untuk membaca MP3, M4A, FLAC, dan lainnya (WAV dan AIFF tidak perlu)

Setiap WAV disimpan bersama file .json berisi pengaturannya. Pakai --dari file itu
untuk membuat lagu yang persis sama lagi.

Contoh:
  node cli/music-maker.js buat --durasi 180 --gaya Santai
  node cli/music-maker.js buat --mood Ceria --versi 3 --pola Drum=tipis
  node cli/music-maker.js buat --sumber klasik --durasi 300 --instrumen Piano,Bass
  node cli/music-maker.js buat --dari hasil/tenang-akustik-kit-seed123.json
  node cli/music-maker.js rangkaian --genre Lo-fi --menit 60
  node cli/music-maker.js rangkaian --menit 180 --campur Sedih/Akustik,Melankolis/Akustik,Sedih/Jazz --instrumen Piano,String,Bass --melodi piano --mp3
  node cli/music-maker.js buat --genre Jazz --durasi 180 --midi-saja
  node cli/music-maker.js master ~/Music/lagu-dari-garageband.wav

Rangkaian juga menyimpan daftar lagu dengan waktu mulai (.txt) dalam format bab YouTube,
siap ditempel ke deskripsi video. Rangkaian 3 jam menghasilkan WAV 24-bit sekitar 2,9 GB
(plus lagu satu per satu sekitar 1,9 GB di folder <nama>-lagu) dan butuh ffmpeg untuk meratakan kekerasan.`;

function parseArgs(argv) {
  const [command = 'bantuan', ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '-h' || arg === '--help' || arg === '--bantuan') { opts.bantuan = true; continue; }
    if (!arg.startsWith('--')) {
      if (command === 'master') { (opts._ ??= []).push(arg); continue; }
      throw new Error(`Argumen tidak dikenal: ${arg}`);
    }
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    // On/off switches need no value.
    if (['midi', 'midi-saja', 'stem', 'mp3', 'tanpa-cek-mirip', 'reset-katalog', 'rencana'].includes(key) && inline === undefined) { opts[key] = true; continue; }
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
  const known = ['mood','genre','sumber','durasi','instrumen','melodi','seed','versi','gaya','pola','variasi','volume','bisu','keluar','dari','browser','bantuan','menit','durasi-lagu','jeda','midi','midi-saja','stem','video','ffmpeg','mesin','campur','hindari_kunci','mp3','target','render','piano','bass-studio','aset-studio','python','katalog','tanpa-cek-mirip','batas-mirip','reset-katalog','rencana'];
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
    ...(base.pan ? { pan: base.pan } : {}),
    bisu: opts.bisu ? list(opts.bisu) : base.bisu ?? [],
    ...(base.mastering ? { mastering: base.mastering } : {}),
    // Tune names from a saved project keep the song identical even after new kits are added.
    ...(base.melodi_kit && opts.seed === undefined ? { melodi_kit: base.melodi_kit } : {}),
    ...(base.dinamika ? { dinamika: base.dinamika } : {}),
    ...(base.bentuk && opts.seed === undefined ? { bentuk: base.bentuk } : {}),
    // komposisi: songs composed from one motif in a song form (default); kit: the older kit planner.
    // A saved project without 'mesin' was made with the kit planner and keeps it.
    mesin: opts.mesin ?? base.mesin ?? (opts.dari ? 'kit' : 'komposisi')
  };
  if (!['Tenang','Ceria','Melankolis','Sedih'].includes(s.mood)) throw new Error('--mood harus Tenang, Ceria, Melankolis, atau Sedih.');
  if (!['Akustik','Lo-fi','Pop','Jazz','Bossa'].includes(s.genre)) throw new Error('--genre harus Akustik, Lo-fi, Pop, Jazz, atau Bossa.');
  if (!['kit','klasik'].includes(s.sumber)) throw new Error('--sumber harus kit atau klasik.');
  if (!['komposisi','kit'].includes(s.mesin)) throw new Error('--mesin harus komposisi atau kit.');
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
    // Same project reader as the web app's "Buka proyek".
    ctx = new OfflineAudioContext(2, 44100, 44100);
    const result = await songFromProject(s);
    if (result.error) return { error: result.error };
    const notes = result.notes;
    const fp = fingerprint();
    if (fp && s.__katalog) {
      let worst = null;
      for (const e of s.__katalog) { const x = similarity(fp.grams, e.grams); if (!worst || x > worst.skor) worst = { skor: x, id: e.id }; }
      if (worst && worst.skor > s.__batas) return { mirip: worst, fingerprint: fp };
    }
    // Names of the MIDI tracks (full band for the genre), for the summary on screen.
    const midiTracks = midiTrackNames();
    if (s.midiOnly) {
      window.__midi = midiFile();
      return { fingerprint: fp, kunci: song.key, bpm: Math.round(30 / song.step), description: describe(song), seconds: total(), gaya: song.style?.name ?? null, pola: song.parts ?? {},
        variasi: Object.fromEntries(song.tracks.filter(t => song.parts?.[t.name]).map(t => [t.name, (song.variants[t.name] ?? 0) % variationCount[t.name][song.parts[t.name]] + 1])),
        kits: song.kitChoice ?? null, dynamics: song.dynamics, form: song.formChoice ?? null, notes, midiTracks };
    }
    const buf = master(await renderMix(false));
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) for (const x of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
    window.__wav = new Uint8Array(await wav(buf).arrayBuffer());
    window.__gain = buf.gain;
    window.__envelope = buf.envelope;
    const variants = {};
    for (const track of song.tracks) if (song.parts?.[track.name])
      variants[track.name] = (song.variants[track.name] ?? 0) % variationCount[track.name][song.parts[track.name]] + 1;
    return { fingerprint: fp, bpm: Math.round(30 / song.step), description: describe(song), seconds: buf.duration, lufs: buf.loudness, peakDb: 20 * Math.log10(peak),
      gaya: song.style?.name ?? null, pola: song.parts ?? {}, variasi: variants, kits: song.kitChoice ?? null, dynamics: song.dynamics, form: song.formChoice ?? null, notes, midiTracks, kunci: song.key, size: window.__wav.length };
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

// One WAV per instrument, with the same level and limiter movement as the full mix
// (no vinyl noise), so the stems add up to the song.
async function saveStems(page, base) {
  const names = await page.evaluate(() => song.tracks.filter(t => !t.muted).map(t => t.name));
  for (const name of names) {
    const size = await page.evaluate(async name => {
      const saved = song.tracks.map(t => t.muted);
      song.tracks.forEach(t => { t.muted = t.name !== name; });
      masterBus.noNoise = true;
      try { window.__wav = new Uint8Array(await wav(limit(await renderMix(false), window.__gain, window.__envelope)).arrayBuffer()); }
      finally { masterBus.noNoise = false; song.tracks.forEach((t, i) => { t.muted = saved[i]; }); }
      return window.__wav.length;
    }, name);
    fs.writeFileSync(`${base}-stem-${name.toLowerCase()}.wav`, await fetchWav(page, size));
  }
  return names;
}
// Still image + music as an MP4 for YouTube, made with ffmpeg.
function saveVideo(wavFile, image, ffmpeg = 'ffmpeg') {
  const { spawnSync } = require('child_process');
  if (!fs.existsSync(image)) throw new Error(`Gambar tidak ditemukan: ${image}`);
  if (spawnSync(ffmpeg, ['-version']).status !== 0)
    throw new Error('ffmpeg tidak ditemukan. Pasang ffmpeg (https://ffmpeg.org), atau beri lokasinya dengan --ffmpeg <path>.');
  const out = wavFile.replace(/\.wav$/, '.mp4');
  const result = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '2', '-i', image, '-i', wavFile,
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
    '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out]);
  if (result.status !== 0) throw new Error('ffmpeg gagal membuat video: ' + String(result.stderr).trim().split('\n').pop());
  return out;
}


// ---- Similarity guard: a catalog of melody fingerprints of every song made ----
const os = require('os');
const SALAMANDER_CREDIT = 'Piano: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)';
function catalogOf(opts) {
  if (opts['tanpa-cek-mirip']) return null;
  const file = path.resolve(opts.katalog ?? path.join(os.homedir(), '.music-maker', 'katalog.json'));
  if (opts['reset-katalog'] && fs.existsSync(file)) { fs.renameSync(file, file + '.lama'); console.log(`Katalog dikosongkan (salinan lama: ${file}.lama)`); }
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { versi: 1, lagu: [] };
  const limit = Number(opts['batas-mirip'] ?? 0.35);
  if (!(limit > 0 && limit <= 1)) throw new Error('--batas-mirip harus antara 0 dan 1.');
  return { file, data, limit,
    add(entry) { this.data.lagu = this.data.lagu.filter(e => e.id !== entry.id); this.data.lagu.push(entry);
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.part', JSON.stringify(this.data)); fs.renameSync(this.file + '.part', this.file); } };
}
// Compose (and render) one song; if its melody is too close to any song in the catalog, try again
// with a derived seed (logged), before any audio is rendered.
async function renderChecked(page, s, catalog, extra = {}, selfId = null) {
  let last = null;
  for (let k = 0; k < 8; k++) {
    const t = k ? { ...s, seed: s.seed + k * 104729, melodi_kit: undefined, bentuk: undefined } : s;
    const info = await page.evaluate(renderInPage(t), { ...t, ...extra,
      ...(catalog ? { __katalog: catalog.data.lagu.filter(e => e.id !== selfId).map(e => ({ id: path.basename(e.id), grams: e.grams })), __batas: catalog.limit } : {}) });
    if (info.error) throw new Error(info.error);
    if (!info.mirip) return { info, s: t };
    console.log(`\n  Melodi seed ${t.seed} terlalu mirip dengan ${info.mirip.id} (${info.mirip.skor.toFixed(2)} > ${catalog.limit}); dibuat ulang dengan seed lain…`);
    last = info;
  }
  throw new Error('Delapan percobaan tetap terlalu mirip dengan katalog; naikkan --batas-mirip atau pakai --reset-katalog.');
}
function catalogEntry(id, info, s) {
  const f = info.fingerprint ?? {};
  return { id, waktu: new Date().toISOString(), mood: s.mood, genre: s.genre, seed: s.seed, gaya: f.gaya ?? info.gaya ?? null,
    kunci: f.kunci ?? info.kunci ?? null, progresi: f.prog ?? null, grams: f.grams ?? [] };
}

// ---- Studio render: piano, strings and (bowed) bass outside the browser, the rest from the app ----
// Studio render is the default wherever its tools are installed (Python packages, fluidsynth,
// ffmpeg and the instrument folder); otherwise the app's own render is used, with a note.
function studioReady(opts) {
  const { spawnSync } = require('child_process');
  const assets = opts['aset-studio'] ?? process.env.MUSIC_MAKER_STUDIO ?? '/home/ubuntu/studio';
  const pythons = [opts.python, process.env.MUSIC_MAKER_PYTHON, path.join(assets, 'venv', 'bin', 'python'), 'python3'].filter(Boolean);
  const missing = [];
  if (!fs.existsSync(path.join(assets, 'vsco', 'Strings'))) missing.push(`folder bahan ${assets}`);
  if (spawnSync('fluidsynth', ['--version']).status !== 0) missing.push('fluidsynth');
  if (spawnSync(opts.ffmpeg ?? 'ffmpeg', ['-version']).status !== 0) missing.push('ffmpeg');
  const python = pythons.find(p => spawnSync(p, ['-c', 'import numpy, scipy, soundfile, mido, pyloudnorm, pedalboard']).status === 0);
  if (!python) missing.push('Python dengan numpy/scipy/soundfile/mido/pyloudnorm/pedalboard');
  return { ok: !missing.length, missing, python, assets };
}
function studioOptions(opts, s) {
  const asked = opts.render ?? process.env.MUSIC_MAKER_RENDER ?? null;
  if (asked && !['app', 'studio'].includes(asked)) throw new Error('--render harus app atau studio.');
  if (asked === 'app') return null;
  const ready = studioReady(opts);
  if (!ready.ok) {
    if (asked === 'studio') throw new Error('Render studio belum bisa: belum ada ' + ready.missing.join(', ') + '. Lihat README bagian "Render studio".');
    console.log('Render: aplikasi (render studio belum terpasang: ' + ready.missing.join(', ') + ')');
    return null;
  }
  const piano = opts.piano ?? 'salamander';
  if (!['salamander', 'kw'].includes(piano)) throw new Error('--piano harus salamander atau kw.');
  const fixedBass = opts['bass-studio'] ?? null;
  if (fixedBass && !['busur', 'petik'].includes(fixedBass)) throw new Error('--bass-studio harus busur atau petik.');
  const bass = fixedBass ?? 'busur untuk Sedih/Melankolis kecuali Bossa, lainnya petik';
  if (!asked) console.log(`Render: studio (otomatis; piano ${piano}, bass ${bass}). Pakai --render app untuk suara aplikasi.`);
  return { piano, bass, fixedBass, bassFor: x => fixedBass ?? (['Sedih', 'Melankolis'].includes(x.mood) && x.genre !== 'Bossa' ? 'busur' : 'petik'), python: ready.python, assets: ready.assets, ffmpeg: opts.ffmpeg ?? 'ffmpeg' };
}
// The song must already be composed in the page (renderInPage with midiOnly). Writes <base>.wav.
async function studioRender(page, base, st0, s, quiet = false) {
  const { spawnSync } = require('child_process');
  const st = { ...st0, bass: st0.bassFor(s) };
  fs.writeFileSync(base + '-studio.mid', Buffer.from(await page.evaluate(() => Array.from(midiFile({ plain: true })))));
  const studioTracks = ['Piano', 'String', ...(st.bass === 'busur' ? ['Bass'] : [])];
  const r = await page.evaluate(async studioTracks => {
    const saved = song.tracks.map(t => t.muted);
    const solo = names => { song.tracks.forEach((t, i) => { t.muted = saved[i] || !names.includes(t.name); }); return renderMix(false); };
    const ref = {};
    try {
      masterBus.noNoise = true;
      for (const [i, t] of song.tracks.entries()) if (!saved[i] && studioTracks.includes(t.name)) ref[t.name] = loudness(await solo([t.name]));
      masterBus.noNoise = false;
      const rest = song.tracks.filter((t, i) => !saved[i] && !studioTracks.includes(t.name)).map(t => t.name);
      let size = 0, gain = 1;
      if (rest.length || song.genre === 'Lo-fi') {
        const b = await solo(rest);
        let peak = 0;
        for (let c = 0; c < b.numberOfChannels; c++) for (const x of b.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
        gain = peak > .89 ? .89 / peak : 1;
        if (gain !== 1) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let k = 0; k < d.length; k++) d[k] *= gain; }
        window.__wav = new Uint8Array(await wav(b).arrayBuffer()); size = window.__wav.length;
      }
      const takt = song.harmony ? song.harmony.map((h, i) => onset({ step: i * 8, delay: 0 })) : [];
      return { ref, rest, size, gain, takt, genre: song.genre, mood: song.mood, seed: song.seed };
    } finally { masterBus.noNoise = false; song.tracks.forEach((t, i) => { t.muted = saved[i]; }); }
  }, studioTracks);
  const sisa = base + '-sisa.wav', refFile = base + '-ref.json';
  if (r.size) fs.writeFileSync(sisa, await fetchWav(page, r.size));
  fs.writeFileSync(refFile, JSON.stringify({ ref: r.ref, sisaGain: r.gain, takt: r.takt, genre: r.genre, mood: r.mood, seed: r.seed }));
  const script = path.join(root, 'studio', 'render_studio.py');
  const args = [script, '--midi', base + '-studio.mid', '--ref', refFile, '--out', base + '.wav.part', '--piano', st.piano,
    '--bass', st.bass, '--assets', st.assets, '--target', String(s.mastering?.targetLoudness ?? -14), '--lapor', base + '-studio.json',
    ...(r.size ? ['--sisa', sisa] : [])];
  const p = spawnSync(st.python, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (p.status !== 0) throw new Error('Render studio gagal: ' + (p.stderr || p.stdout || '').trim().split('\n').slice(-3).join(' | '));
  fs.renameSync(base + '.wav.part', base + '.wav');
  for (const f of [sisa, refFile]) if (fs.existsSync(f)) fs.unlinkSync(f);
  const rep = JSON.parse(fs.readFileSync(base + '-studio.json', 'utf8'));
  if (st.piano === 'salamander') fs.writeFileSync(base + '-kredit.txt', SALAMANDER_CREDIT + '\n');
  return rep;
}

async function make(opts) {
  const midiOnly = !!opts['midi-saja'];
  if (midiOnly && (opts.stem || opts.video)) throw new Error('--midi-saja tidak membuat audio, jadi tidak bisa digabung dengan --stem atau --video.');
  const settings = settingsFrom({ ...opts, 'midi-saja': undefined });
  const count = Math.max(1, Number(opts.versi ?? 1));
  const outDir = path.resolve(opts.keluar ?? 'hasil');
  fs.mkdirSync(outDir, { recursive: true });
  const catalog = catalogOf(opts);
  if (opts.stem && opts.render === 'studio') throw new Error('--stem belum tersedia untuk --render studio.');
  // --stem keeps the app render (stems per instrument come from the app).
  const studio = midiOnly || opts.stem ? null : studioOptions(opts, settings);
  const browser = await launch(opts.browser);
  try {
    const page = await openStudio(browser);
    for (let i = 0; i < count; i++) {
      // Extra versions get their own tunes; only the first keeps the saved ones.
      const s0 = { ...settings, seed: settings.seed + i, ...(i ? { melodi_kit: undefined, bentuk: undefined } : {}) };
      const started = Date.now();
      process.stdout.write(`Membuat lagu ${i + 1}/${count} (seed ${s0.seed})… `);
      const checked = await renderChecked(page, s0, catalog, { midiOnly: midiOnly || !!studio });
      const info = checked.info, s = checked.s;
      const name = `${s.mood}-${s.genre}-${s.sumber}-seed${s.seed}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const file = path.join(outDir, name + '.wav');
      let studioReport = null;
      if (studio) studioReport = await studioRender(page, file.replace(/\.wav$/, ''), studio, s);
      else if (!midiOnly) fs.writeFileSync(file, await fetchWav(page, info.size));
      if (catalog) catalog.add(catalogEntry(file.replace(/\.wav$/, ''), info, s));
      // Settings file: the exact pattern and variation used, so --dari reproduces this song.
      const saved = { ...s, ...(studio ? { render: 'studio', piano: studio.piano, 'bass-studio': studio.bassFor(s), ...(studio.piano === 'salamander' ? { kredit: SALAMANDER_CREDIT } : {}) } : {}), gaya: info.gaya ?? s.gaya, pola: info.pola, variasi: info.variasi, ...(info.kits ? { melodi_kit: info.kits } : {}), dinamika: info.dynamics, ...(info.form ? { bentuk: info.form } : {}) };
      fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(saved, null, 2) + '\n');
      const min = Math.floor(info.seconds / 60), sec = Math.round(info.seconds % 60);
      console.log(`selesai dalam ${Math.round((Date.now() - started) / 1000)} detik`);
      console.log(`  ${info.description}`);
      console.log(`  Durasi ${min}:${String(sec).padStart(2, '0')}` + (studioReport ? ` · studio ${studioReport.lufs} LUFS · puncak ${studioReport.true_peak} dBTP` : midiOnly ? '' : ` · ${info.lufs.toFixed(1)} LUFS · puncak ${info.peakDb.toFixed(1)} dB`));
      if (studio?.piano === 'salamander') console.log('  Kredit wajib: ' + SALAMANDER_CREDIT);
      // Only instruments that are in the song (the pattern list also names unused ones).
      const played = Object.entries(info.pola).filter(([k]) => info.variasi[k]);
      if (played.length) console.log('  Pola: ' + played.map(([k, v]) => `${k}=${v} (variasi ${info.variasi[k]})`).join(', '));
      for (const note of info.notes) console.log('  Catatan: ' + note);
      const shown = path.relative(process.cwd(), file);
      if (!midiOnly) console.log(`  Disimpan: ${shown.startsWith('..') ? file : shown}`);
      const base = file.replace(/\.wav$/, '');
      if (opts.midi || midiOnly) {
        fs.writeFileSync(base + '.mid', Buffer.from(await page.evaluate(() => Array.from(window.__midi ?? midiFile()))));
        const midiShown = path.relative(process.cwd(), base + '.mid');
        console.log(`  MIDI: ${midiOnly ? (midiShown.startsWith('..') ? base + '.mid' : midiShown) : path.basename(base) + '.mid'} (${info.midiTracks.join(', ')})`);
      }
      if (opts.stem) console.log(`  Stem: ${(await saveStems(page, base)).map(n => path.basename(base) + '-stem-' + n.toLowerCase() + '.wav').join(', ')}`);
      if (opts.video) console.log(`  Video: ${path.basename(saveVideo(file, opts.video, opts.ffmpeg))}`);
    }
  } finally {
    await browser.close();
  }
}

const clock = seconds => {
  const t = Math.round(seconds), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(sec).padStart(2, '0');
};

// Long mix (up to 3 hours): songs are rendered one by one, each saved as its own WAV in
// <name>-lagu/ (so an interrupted run continues where it stopped), then joined on disk with a
// short overlap and finally brought to the target loudness with ffmpeg in two passes
// (measure, then a single linear gain), so memory stays small whatever the length.
// --campur Mood/Genre,Mood/Genre,... takes turns between combinations; next to each other two
// songs never share a key, and every song has its own seed.
async function mix(opts) {
  const minutes = Number(opts.menit ?? 30), each = Number(opts['durasi-lagu'] ?? 180), fade = Number(opts.jeda ?? 3);
  if (!(minutes >= 1 && minutes <= 180)) throw new Error('--menit harus antara 1 dan 180.');
  if (!(each >= 20 && each <= 600)) throw new Error('--durasi-lagu harus antara 20 dan 600 detik.');
  if (!(fade >= 0 && fade <= 10)) throw new Error('--jeda harus antara 0 dan 10 detik.');
  if (opts.stem || opts['midi-saja']) throw new Error('--stem dan --midi-saja hanya untuk "buat". Untuk rangkaian, --midi menyimpan MIDI setiap lagu.');
  const settings = settingsFrom({ ...opts, durasi: each, menit: undefined, 'durasi-lagu': undefined, jeda: undefined, campur: undefined, mp3: undefined, target: undefined });
  delete settings.melodi_kit;
  delete settings.bentuk;
  const combos = opts.campur ? list(opts.campur).map(c => {
    const [mood, genre] = c.split('/').map(x => x.trim());
    if (!['Tenang','Ceria','Melankolis','Sedih'].includes(mood) || !['Akustik','Lo-fi','Pop','Jazz','Bossa'].includes(genre))
      throw new Error(`--campur: "${c}" bukan Mood/Genre yang dikenal (contoh: Sedih/Akustik,Melankolis/Jazz).`);
    return { mood, genre };
  }) : [{ mood: settings.mood, genre: settings.genre }];
  const target = Number(opts.target ?? settings.mastering?.targetLoudness ?? -14);
  const outDir = path.resolve(opts.keluar ?? 'hasil');
  fs.mkdirSync(outDir, { recursive: true });
  const label = opts.campur ? 'campur' : `${settings.mood}-${settings.genre}`;
  const name = `rangkaian-${label}-${minutes}menit-seed${settings.seed}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const songDir = path.join(outDir, name + '-lagu');
  fs.mkdirSync(songDir, { recursive: true });
  const rate = 44100, frameBytes = 4;
  const secondsOf = f => (fs.statSync(f).size - 44) / (rate * frameBytes);
  // 1. Songs, one by one; finished ones (WAV + .json) are kept and skipped on a rerun.
  // Styles rotate: for each song the least-used style of its Mood/Genre that has not been heard in
  // the last 5 songs, a key not used in the last 3 songs, and pattern variations that alternate.
  const catalog = opts.rencana ? null : catalogOf(opts);
  const studio = opts.rencana ? null : studioOptions(opts, settings);
  const plan = !!opts.rencana;
  const songs = [], history = [], styleUse = {};
  let length = 0, browser = null, page = null;
  const ensurePage = async () => { if (!browser) { browser = await launch(opts.browser); page = await openStudio(browser); } return page; };
  const stylePool = {};
  try {
    for (let i = 0; length < minutes * 60 - 20; i++) {
      const combo = combos[i % combos.length];
      const ck = combo.mood + '/' + combo.genre;
      if (!stylePool[ck]) stylePool[ck] = await (await ensurePage()).evaluate(([m, g]) => styles.filter(x => x.mood === m && x.genre === g).map(x => x.name), [combo.mood, combo.genre]);
      const recent = history.slice(-5);
      let gaya = settings.gaya ?? null;
      if (!gaya && stylePool[ck].length) {
        const pool = stylePool[ck].filter(n => !recent.some(h => h.gaya === n));
        const from = pool.length ? pool : stylePool[ck];
        gaya = from.reduce((best, n) => (styleUse[n] ?? 0) < (styleUse[best] ?? 0) ? n : best, from[0]);
      }
      const occurrence = history.filter(h => h.combo === ck).length;
      const variasi = { ...Object.fromEntries(['Piano', 'Gitar', 'Bass', 'Drum', 'String'].map(n => [n, 1 + (occurrence + i) % 3])), ...settings.variasi };
      const avoid = history.slice(-3).map(h => h.kunci).filter(k => k !== null && k !== undefined);
      // Seeds far apart per combination, so songs of a mix never repeat one another.
      const s = { ...settings, ...combo, gaya, variasi, seed: settings.seed + i * 7919, ...(avoid.length ? { hindari_kunci: avoid } : {}) };
      const base = path.join(songDir, `lagu-${String(i + 1).padStart(3, '0')}-seed${s.seed}`);
      let info;
      if (!plan && fs.existsSync(base + '.json') && fs.existsSync(base + '.wav')) {
        info = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
        console.log(`Lagu ${i + 1} sudah ada, dilewati · ${info.description}`);
      } else {
        await ensurePage();
        const started = Date.now();
        process.stdout.write(`Lagu ${i + 1} (${combo.mood} ${combo.genre}${gaya ? ' · ' + gaya : ''}, seed ${s.seed})… `);
        const checked = await renderChecked(page, s, catalog, { midiOnly: plan || !!studio }, base);
        const r = checked.info;
        let lufs = r.lufs;
        if (plan) { /* plan only: nothing written per song */ }
        else if (studio) lufs = (await studioRender(page, base, studio, checked.s)).lufs;
        else { fs.writeFileSync(base + '.wav.part', await fetchWav(page, r.size)); fs.renameSync(base + '.wav.part', base + '.wav'); }
        if (opts.midi && !plan) fs.writeFileSync(base + '.mid', Buffer.from(await page.evaluate(() => Array.from(midiFile()))));
        info = { description: r.description, gaya: r.gaya, kunci: r.kunci, bpm: r.bpm, mood: combo.mood, genre: combo.genre, seed: checked.s.seed, lufs,
          ...(plan ? { detik: r.seconds } : {}), ...(studio ? { render: 'studio', piano: studio.piano } : {}) };
        if (catalog) catalog.add(catalogEntry(base, r, checked.s));
        if (!plan) fs.writeFileSync(base + '.json', JSON.stringify(info, null, 2) + '\n');
        console.log(`${Math.round((Date.now() - started) / 1000)} dtk · ${r.description}`);
      }
      history.push({ combo: ck, gaya: info.gaya, kunci: info.kunci ?? null });
      if (info.gaya) styleUse[info.gaya] = (styleUse[info.gaya] ?? 0) + 1;
      const secs = plan ? info.detik : secondsOf(base + '.wav');
      songs.push({ ...info, file: base + '.wav', seconds: secs });
      length += secs - (i ? fade : 0);
      process.stdout.write(`  total sekarang ${clock(length)} dari ${clock(minutes * 60)}\n`);
    }
  } finally {
    if (browser) await browser.close();
  }
  const keyName = k => k === null || k === undefined ? '' : ' · ' + ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][k % 12];
  const minorMark = s => s.kunci !== undefined && s.kunci !== null && ['Sedih','Melankolis'].includes(s.mood) ? 'm' : '';
  const credit = songs.some(x => x.piano === 'salamander') ? '\nKredit: ' + SALAMANDER_CREDIT + '\n' : '';
  if (plan) {
    let t = 0;
    const lines = songs.map((x, i) => { const line = `${clock(t)} Lagu ${i + 1} · ${x.mood} ${x.genre}${x.gaya ? ' · ' + x.gaya : ''}${keyName(x.kunci)}${minorMark(x)} · ${x.bpm} BPM · seed ${x.seed}`; t += x.seconds - fade; return line; });
    fs.writeFileSync(path.join(outDir, name + '-rencana.txt'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    const used = Object.entries(styleUse).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}x`).join(', ');
    console.log(`\nRencana ${clock(length)}, ${songs.length} lagu. Gaya: ${used}`);
    console.log(`  ${path.join(outDir, name + '-rencana.txt')}`);
    return;
  }
  // 2. Join on disk: the tail of each song fades out while the next one fades in (equal power).
  const joined = path.join(songDir, 'gabungan.wav');
  const overlap = Math.round(fade * rate);
  const fd = fs.openSync(joined, 'w');
  fs.writeSync(fd, Buffer.alloc(44));
  let written = 0, held = null;
  const chapters = [];
  const readFrames = (file) => fs.readFileSync(file).subarray(44);
  for (let i = 0; i < songs.length; i++) {
    const pcm = Buffer.from(readFrames(songs[i].file));
    const frames = pcm.length / frameBytes;
    if (held) {
      const n = Math.min(held.length / frameBytes, frames);
      for (let f = 0; f < n; f++) {
        const x = (f + .5) / n, gOut = Math.cos(x * Math.PI / 2), gIn = Math.sin(x * Math.PI / 2);
        for (let c = 0; c < 2; c++) {
          const at = f * frameBytes + c * 2;
          const v = held.readInt16LE(at) * gOut + pcm.readInt16LE(at) * gIn;
          pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), at);
        }
      }
    }
    chapters.push([written / (rate * frameBytes), songs[i]]);
    const keep = i < songs.length - 1 ? Math.min(overlap, Math.floor(frames / 3)) * frameBytes : 0;
    fs.writeSync(fd, pcm, 0, pcm.length - keep); written += pcm.length - keep;
    held = keep ? Buffer.from(pcm.subarray(pcm.length - keep)) : null;
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + written, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * frameBytes, 28); head.writeUInt16LE(frameBytes, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(written, 40);
  fs.writeSync(fd, head, 0, 44, 0);
  fs.closeSync(fd);
  // 3. Final loudness with ffmpeg (streams the file, little memory): measure, then one linear gain
  //    with a true-peak ceiling of -1 dBTP. Without ffmpeg the joined file is kept as it is.
  const file = path.join(outDir, name + '.wav');
  const { spawnSync } = require('child_process');
  const ff = opts.ffmpeg ?? 'ffmpeg';
  let measured = null;
  if (spawnSync(ff, ['-version']).status === 0) {
    process.stdout.write('Mengukur kekerasan seluruh rangkaian… ');
    const m = spawnSync(ff, ['-hide_banner', '-nostats', '-i', joined, '-af', `loudnorm=I=${target}:TP=-1.2:LRA=20:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const json = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{')));
    measured = json;
    console.log(`${json.input_i} LUFS, puncak ${json.input_tp} dBTP`);
    const af = `loudnorm=I=${target}:TP=-1.2:LRA=20:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true,aresample=44100`;
    const a = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', joined, '-af', af, '-c:a', 'pcm_s24le', file], { encoding: 'utf8' });
    if (a.status !== 0) throw new Error('ffmpeg gagal mengatur kekerasan: ' + a.stderr.trim().split('\n').pop());
    fs.unlinkSync(joined);
    if (opts.mp3) {
      process.stdout.write('Membuat MP3 320k… ');
      const b = spawnSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-c:a', 'libmp3lame', '-b:a', '320k', file.replace(/\.wav$/, '.mp3')], { encoding: 'utf8' });
      console.log(b.status === 0 ? 'selesai' : 'gagal: ' + b.stderr.trim().split('\n').pop());
    }
  } else {
    fs.renameSync(joined, file);
    console.log('ffmpeg tidak ditemukan: kekerasan akhir tidak diratakan (setiap lagu sudah di-master sendiri).');
  }
  fs.writeFileSync(path.join(outDir, name + '.txt'), chapters.map(([t, s], i) =>
    `${clock(t)} Lagu ${i + 1} · ${s.mood} ${s.genre}${s.gaya ? ' · ' + s.gaya : ''}${keyName(s.kunci)}${minorMark(s)}`).join('\n') + '\n' + credit);
  if (credit) console.log('Kredit wajib (sudah ditulis di daftar lagu): ' + SALAMANDER_CREDIT);
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify({ ...settings, campur: opts.campur ?? null, menit: minutes, 'durasi-lagu': each, jeda: fade,
    kekerasan: measured ? { sebelum: Number(measured.input_i), target } : null,
    lagu: chapters.map(([t, s]) => ({ mulai: clock(t), mood: s.mood, genre: s.genre, seed: s.seed, deskripsi: s.description })) }, null, 2) + '\n');
  console.log(`Selesai: ${clock(written / (rate * frameBytes))}, ${songs.length} lagu`);
  console.log(`  ${file}`);
  console.log(`  Daftar lagu untuk deskripsi YouTube: ${path.join(outDir, name + '.txt')}`);
  console.log(`  Lagu satu per satu (boleh dihapus kalau sudah tidak perlu): ${songDir}`);
  if (opts.video) {
    console.log('Membuat video…');
    console.log(`  Video: ${saveVideo(file, opts.video, opts.ffmpeg)}`);
  }
}

// Master finished audio files (e.g. exported from a DAW) with the app's own method.
function masterFiles(opts) {
  const files = opts._ ?? [];
  if (!files.length) throw new Error('Sebutkan file yang mau di-master, misalnya: node cli/music-maker.js master lagu.wav');
  const known = ['_', 'target', 'bit', 'keluar', 'ffmpeg', 'bantuan'];
  for (const key of Object.keys(opts)) if (!known.includes(key)) throw new Error(`Opsi tidak dikenal untuk master: --${key}. Lihat "bantuan".`);
  const target = Number(opts.target ?? -14), bits = Number(opts.bit ?? 24);
  if (!(target >= -24 && target <= -8)) throw new Error('--target harus antara -24 dan -8 LUFS.');
  if (![16, 24].includes(bits)) throw new Error('--bit harus 16 atau 24.');
  const m = require('./mastering');
  const db = x => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`File tidak ditemukan: ${file}`);
    const started = Date.now();
    process.stdout.write(`Mastering ${path.basename(file)}… `);
    const audio = m.readAudio(file, opts.ffmpeg);
    const seconds = audio.channels[0].length / audio.rate;
    if (seconds > 30 * 60) throw new Error('File lebih dari 30 menit. Untuk rangkaian panjang, pakai perintah "rangkaian" (setiap lagu di-master sendiri).');
    const before = { lufs: m.loudness(audio.channels, audio.rate), peak: m.peakOf(audio.channels) };
    const done = m.master(audio, { target });
    const after = { lufs: m.loudness(done.channels, audio.rate), tp: m.truePeak(done.channels) };
    const outDir = opts.keluar ? path.resolve(opts.keluar) : path.dirname(path.resolve(file));
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, path.basename(file).replace(/\.[^.]+$/, '') + '-master.wav');
    m.writeWav(out, done.channels, audio.rate, bits);
    console.log(`selesai dalam ${Math.round((Date.now() - started) / 1000)} detik`);
    const len = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
    console.log(`  ${len} · ${audio.rate} Hz · ${audio.channels.length === 1 ? 'mono' : 'stereo'}`);
    console.log(`  Sebelum: ${before.lufs.toFixed(1)} LUFS, puncak ${db(before.peak)} dB`);
    console.log(`  Sesudah: ${after.lufs.toFixed(1)} LUFS, true peak ${db(after.tp)} dBTP (gain ${done.gainDb >= 0 ? '+' : ''}${done.gainDb.toFixed(1)} dB, limiter paling dalam ${done.squashDb.toFixed(1)} dB)`);
    if (after.lufs < target - .5)
      console.log(`  Catatan: berhenti di ${after.lufs.toFixed(1)} LUFS supaya puncak tidak ditekan lebih dari 6 dB (suara bisa jadi gepeng). Ini wajar untuk musik yang sangat tenang.`);
    if (audio.channels.length === 1) console.log('  Catatan: file mono. YouTube menerimanya, tapi ekspor stereo dari DAW biasanya lebih baik.');
    const gap = m.silence(done.channels, audio.rate);
    if (gap.lead > 1) console.log(`  Catatan: ada ${gap.lead.toFixed(1)} detik hening di awal. Pertimbangkan memotongnya di DAW.`);
    if (gap.trail > 4) console.log(`  Catatan: ada ${gap.trail.toFixed(1)} detik hening di akhir.`);
    console.log(`  Disimpan: ${out} (WAV ${bits}-bit)`);
  }
}

async function show(opts) {
  const browser = await launch(opts.browser);
  try {
    const page = await openStudio(browser);
    const info = await page.evaluate(() => ({
      instruments: Object.keys(sampleData),
      styles: styles.map(s => ({ name: s.name, genre: s.genre, mood: s.mood, bpm: s.bpm, guitar: s.guitar, piano: s.piano, drum: s.drum })),
      parts: Object.fromEntries(Object.entries(partOptions).map(([n, o]) => [n, Object.entries(o).map(([k, label]) => `${k} (${label}, ${variationCount[n][k]} variasi)`)])),
      moods: [...document.querySelectorAll('#mood option')].map(o => o.value),
      genres: [...document.querySelectorAll('#genre option')].map(o => o.value)
    }));
    info.midi = await page.evaluate(async genres => {
      ctx = new OfflineAudioContext(2, 44100, 44100);
      const out = {};
      for (const genre of genres) {
        await songFromProject({ genre, mood:'Tenang', durasi:20, instrumen:['Piano','Gitar','Bass','Drum'], seed:1 });
        out[genre] = midiTrackNames();
      }
      return out;
    }, info.genres);
    console.log('Mood:       ' + info.moods.join(', '));
    console.log('Genre:      ' + info.genres.join(', '));
    console.log('Sumber:     kit (Kit orisinal), klasik (Bach)');
    console.log('Instrumen:  ' + info.instruments.join(', '));
    console.log('\nGaya lagu (sumber kit):');
    for (const s of info.styles) console.log(`  ${s.name.padEnd(11)} ${s.genre.padEnd(8)} mood ${s.mood.padEnd(7)} ${s.bpm[0]}–${s.bpm[1]} BPM · gitar ${s.guitar}, piano ${s.piano}, drum ${s.drum}`);
    console.log('\nJalur MIDI per genre (--midi atau --midi-saja; contoh mood Tenang, instrumen bawaan):');
    for (const [genre, list] of Object.entries(info.midi)) console.log(`  ${genre.padEnd(8)} ${list.join(', ')}`);
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
    else if (command === 'rangkaian') await mix(opts);
    else if (command === 'master') masterFiles(opts);
    else if (command === 'daftar') await show(opts);
    else throw new Error(`Perintah tidak dikenal: ${command}. Lihat "node cli/music-maker.js bantuan".`);
  } catch (e) {
    console.error('Gagal: ' + e.message);
    process.exitCode = 1;
  }
})();
