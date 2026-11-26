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
  node cli/music-maker.js rangkaian [opsi] Sambung banyak lagu menjadi satu file panjang (30–60 menit)
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
  --midi                                  Simpan juga file MIDI (satu jalur per instrumen)
  --stem                                  Simpan juga satu WAV per instrumen
  --video <gambar>                        Buat juga video MP4 (gambar diam + musik). Butuh ffmpeg
  --ffmpeg <path>                         Path ke ffmpeg kalau tidak ada di PATH

Opsi tambahan untuk "rangkaian" (semua opsi "buat" juga berlaku untuk setiap lagu):
  --menit <angka>                         Panjang rangkaian. Bawaan: 30
  --durasi-lagu <detik>                   Panjang tiap lagu. Bawaan: 180
  --jeda <detik>                          Lama peralihan antarlagu (ekor lagu menyatu dengan awal lagu berikutnya). Bawaan: 2

Setiap WAV disimpan bersama file .json berisi pengaturannya. Pakai --dari file itu
untuk membuat lagu yang persis sama lagi.

Contoh:
  node cli/music-maker.js buat --durasi 180 --gaya Santai
  node cli/music-maker.js buat --mood Ceria --versi 3 --pola Drum=tipis
  node cli/music-maker.js buat --sumber klasik --durasi 300 --instrumen Piano,Bass
  node cli/music-maker.js buat --dari hasil/tenang-akustik-kit-seed123.json
  node cli/music-maker.js rangkaian --genre Lo-fi --menit 60

Rangkaian juga menyimpan daftar lagu dengan waktu mulai (.txt) dalam format bab YouTube,
siap ditempel ke deskripsi video. Rangkaian 60 menit butuh beberapa menit untuk dibuat
dan menghasilkan WAV sekitar 600 MB.`;

function parseArgs(argv) {
  const [command = 'bantuan', ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '-h' || arg === '--help' || arg === '--bantuan') { opts.bantuan = true; continue; }
    if (!arg.startsWith('--')) throw new Error(`Argumen tidak dikenal: ${arg}`);
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    // On/off switches need no value.
    if (['midi', 'stem'].includes(key) && inline === undefined) { opts[key] = true; continue; }
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
  const known = ['mood','genre','sumber','durasi','instrumen','melodi','seed','versi','gaya','pola','variasi','volume','bisu','keluar','dari','browser','bantuan','menit','durasi-lagu','jeda','midi','stem','video','ffmpeg'];
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
    bisu: opts.bisu ? list(opts.bisu) : base.bisu ?? [],
    // Tune names from a saved project keep the song identical even after new kits are added.
    ...(base.melodi_kit && opts.seed === undefined ? { melodi_kit: base.melodi_kit } : {}),
    ...(base.dinamika ? { dinamika: base.dinamika } : {})
  };
  if (!['Tenang','Ceria','Melankolis','Sedih'].includes(s.mood)) throw new Error('--mood harus Tenang, Ceria, Melankolis, atau Sedih.');
  if (!['Akustik','Lo-fi','Pop','Jazz','Bossa'].includes(s.genre)) throw new Error('--genre harus Akustik, Lo-fi, Pop, Jazz, atau Bossa.');
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
    // Same project reader as the web app's "Buka proyek".
    ctx = new OfflineAudioContext(2, 44100, 44100);
    const result = await songFromProject(s);
    if (result.error) return { error: result.error };
    const notes = result.notes;
    const buf = master(await renderMix(false));
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) for (const x of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(x));
    window.__wav = new Uint8Array(await wav(buf).arrayBuffer());
    window.__gain = buf.gain;
    window.__envelope = buf.envelope;
    const variants = {};
    for (const track of song.tracks) if (song.parts?.[track.name])
      variants[track.name] = (song.variants[track.name] ?? 0) % variationCount[track.name][song.parts[track.name]] + 1;
    return { description: describe(song), seconds: buf.duration, lufs: buf.loudness, peakDb: 20 * Math.log10(peak),
      gaya: song.style?.name ?? null, pola: song.parts ?? {}, variasi: variants, kits: song.kitChoice ?? null, dynamics: song.dynamics, notes, size: window.__wav.length };
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

async function make(opts) {
  const settings = settingsFrom(opts);
  const count = Math.max(1, Number(opts.versi ?? 1));
  const outDir = path.resolve(opts.keluar ?? 'hasil');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch(opts.browser);
  try {
    const page = await openStudio(browser);
    for (let i = 0; i < count; i++) {
      // Extra versions get their own tunes; only the first keeps the saved ones.
      const s = { ...settings, seed: settings.seed + i, ...(i ? { melodi_kit: undefined } : {}) };
      const started = Date.now();
      process.stdout.write(`Membuat lagu ${i + 1}/${count} (seed ${s.seed})… `);
      const info = await page.evaluate(renderInPage(s), s);
      if (info.error) throw new Error(info.error);
      const name = `${s.mood}-${s.genre}-${s.sumber}-seed${s.seed}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const file = path.join(outDir, name + '.wav');
      fs.writeFileSync(file, await fetchWav(page, info.size));
      // Settings file: the exact pattern and variation used, so --dari reproduces this song.
      const saved = { ...s, gaya: info.gaya ?? s.gaya, pola: info.pola, variasi: info.variasi, ...(info.kits ? { melodi_kit: info.kits } : {}), dinamika: info.dynamics };
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
      const base = file.replace(/\.wav$/, '');
      if (opts.midi) {
        fs.writeFileSync(base + '.mid', Buffer.from(await page.evaluate(() => Array.from(midiFile()))));
        console.log(`  MIDI: ${path.basename(base)}.mid`);
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

// Long mix: songs with consecutive seeds, each mastered on its own (so loudness stays even),
// joined with a short overlap and written straight to disk so memory stays small.
async function mix(opts) {
  const minutes = Number(opts.menit ?? 30), each = Number(opts['durasi-lagu'] ?? 180), fade = Number(opts.jeda ?? 2);
  if (!(minutes >= 1 && minutes <= 180)) throw new Error('--menit harus antara 1 dan 180.');
  if (!(each >= 20 && each <= 600)) throw new Error('--durasi-lagu harus antara 20 dan 600 detik.');
  if (!(fade >= 0 && fade <= 10)) throw new Error('--jeda harus antara 0 dan 10 detik.');
  if (opts.midi || opts.stem) throw new Error('--midi dan --stem hanya untuk "buat", bukan rangkaian.');
  const settings = settingsFrom({ ...opts, durasi: each, menit: undefined, 'durasi-lagu': undefined, jeda: undefined });
  // Every song in a mix picks its own tunes.
  delete settings.melodi_kit;
  const outDir = path.resolve(opts.keluar ?? 'hasil');
  fs.mkdirSync(outDir, { recursive: true });
  const name = `rangkaian-${settings.mood}-${settings.genre}-${minutes}menit-seed${settings.seed}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const file = path.join(outDir, name + '.wav');
  const rate = 44100, channels = 2, frameBytes = 4, overlap = Math.round(fade * rate) * frameBytes;
  const fd = fs.openSync(file, 'w');
  fs.writeSync(fd, Buffer.alloc(44));
  let written = 0, held = Buffer.alloc(0);
  const chapters = [], songs = [];
  const browser = await launch(opts.browser);
  try {
    const page = await openStudio(browser);
    for (let i = 0; written / (rate * frameBytes) < minutes * 60 - 20; i++) {
      const s = { ...settings, seed: settings.seed + i };
      const started = Date.now();
      process.stdout.write(`Lagu ${i + 1} (seed ${s.seed})… `);
      const info = await page.evaluate(renderInPage(s), s);
      if (info.error) throw new Error(info.error);
      const pcm = (await fetchWav(page, info.size)).subarray(44);
      // Overlap: the held tail of the previous song is summed with the start of this one.
      const join = Math.min(held.length, pcm.length);
      for (let at = 0; at < join; at += 2) {
        const v = held.readInt16LE(at) + pcm.readInt16LE(at);
        pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), at);
      }
      if (held.length > join) { fs.writeSync(fd, held.subarray(0, held.length - join)); written += held.length - join; }
      chapters.push([written / (rate * frameBytes), `Lagu ${i + 1} · ${info.gaya ? 'Gaya ' + info.gaya : info.description.split(' · ')[0]}`]);
      songs.push({ seed: s.seed, deskripsi: info.description, mulai: clock(written / (rate * frameBytes)) });
      const keep = Math.min(overlap, pcm.length);
      fs.writeSync(fd, pcm.subarray(0, pcm.length - keep)); written += pcm.length - keep;
      held = Buffer.from(pcm.subarray(pcm.length - keep));
      console.log(`${Math.round((Date.now() - started) / 1000)} detik · ${info.description} · sampai ${clock(written / (rate * frameBytes))}`);
    }
    fs.writeSync(fd, held); written += held.length;
  } finally {
    await browser.close();
    // WAV header now that the size is known.
    const head = Buffer.alloc(44);
    head.write('RIFF', 0); head.writeUInt32LE(36 + written, 4); head.write('WAVE', 8); head.write('fmt ', 12);
    head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(channels, 22); head.writeUInt32LE(rate, 24);
    head.writeUInt32LE(rate * frameBytes, 28); head.writeUInt16LE(frameBytes, 32); head.writeUInt16LE(16, 34);
    head.write('data', 36); head.writeUInt32LE(written, 40);
    fs.writeSync(fd, head, 0, 44, 0);
    fs.closeSync(fd);
  }
  fs.writeFileSync(path.join(outDir, name + '.txt'), chapters.map(([t, title]) => `${clock(t)} ${title}`).join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify({ ...settings, menit: minutes, 'durasi-lagu': each, jeda: fade, lagu: songs }, null, 2) + '\n');
  console.log(`Selesai: ${clock(written / (rate * frameBytes))}, ${songs.length} lagu, ${(written / 1e6).toFixed(0)} MB`);
  console.log(`  ${file}`);
  console.log(`  Daftar lagu untuk deskripsi YouTube: ${path.join(outDir, name + '.txt')}`);
  if (opts.video) {
    console.log('Membuat video…');
    console.log(`  Video: ${saveVideo(file, opts.video, opts.ffmpeg)}`);
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
    console.log('Mood:       ' + info.moods.join(', '));
    console.log('Genre:      ' + info.genres.join(', '));
    console.log('Sumber:     kit (Kit orisinal), klasik (Bach)');
    console.log('Instrumen:  ' + info.instruments.join(', '));
    console.log('\nGaya lagu (sumber kit):');
    for (const s of info.styles) console.log(`  ${s.name.padEnd(11)} ${s.genre.padEnd(8)} mood ${s.mood.padEnd(7)} ${s.bpm[0]}–${s.bpm[1]} BPM · gitar ${s.guitar}, piano ${s.piano}, drum ${s.drum}`);
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
    else if (command === 'daftar') await show(opts);
    else throw new Error(`Perintah tidak dikenal: ${command}. Lihat "node cli/music-maker.js bantuan".`);
  } catch (e) {
    console.error('Gagal: ' + e.message);
    process.exitCode = 1;
  }
})();
