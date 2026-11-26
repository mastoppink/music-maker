// Mastering for finished audio files (for example a song re-played in a DAW from our MIDI):
// bring it to YouTube loudness with the same method the app uses for its own exports, check
// the true peak, and write a high-quality WAV. Runs in Node only, no browser needed.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---- Reading audio ----
// WAV (PCM 16/24/32-bit, 32/64-bit float) and AIFF/AIFC (PCM) are read directly; anything
// else (MP3, M4A, FLAC, ...) is converted with ffmpeg when it is installed.
function readAudio(file, ffmpeg = 'ffmpeg') {
  const data = fs.readFileSync(file);
  const id = data.toString('latin1', 0, 4), form = data.toString('latin1', 8, 12);
  if (id === 'RIFF' && form === 'WAVE') return readWav(data);
  if (id === 'FORM' && (form === 'AIFF' || form === 'AIFC')) return readAiff(data, form === 'AIFC');
  const probe = spawnSync(ffmpeg, ['-version']);
  if (probe.status !== 0)
    throw new Error(`${path.basename(file)} bukan WAV atau AIFF. Ekspor lagu sebagai WAV atau AIFF (GarageBand: Bagikan > Ekspor Lagu ke Disk), atau pasang ffmpeg untuk format lain.`);
  const out = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-f', 'wav', '-acodec', 'pcm_f32le', '-'], { maxBuffer: 2 ** 31 });
  if (out.status !== 0) throw new Error(`ffmpeg tidak bisa membaca ${path.basename(file)}: ${String(out.stderr).trim().split('\n').pop()}`);
  return readWav(out.stdout);
}

function readWav(data) {
  let at = 12, fmt = null, body = null;
  while (at + 8 <= data.length) {
    const id = data.toString('latin1', at, at + 4);
    let size = data.readUInt32LE(at + 4);
    if (id === 'data' && (size === 0 || size === 0xffffffff || at + 8 + size > data.length)) size = data.length - at - 8;
    if (id === 'fmt ') fmt = data.subarray(at + 8, at + 8 + size);
    if (id === 'data') body = data.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  if (!fmt || !body) throw new Error('File WAV tidak lengkap (bagian fmt atau data tidak ditemukan).');
  let format = fmt.readUInt16LE(0);
  const channels = fmt.readUInt16LE(2), rate = fmt.readUInt32LE(4), bits = fmt.readUInt16LE(14);
  if (format === 0xfffe) format = fmt.readUInt16LE(24);   // WAVE_FORMAT_EXTENSIBLE: real format in the GUID
  const bytes = bits / 8, frames = Math.floor(body.length / (bytes * channels));
  const ch = [...Array(channels)].map(() => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
    const o = (i * channels + c) * bytes;
    let v;
    if (format === 3) v = bits === 64 ? body.readDoubleLE(o) : body.readFloatLE(o);
    else if (format === 1) {
      if (bits === 16) v = body.readInt16LE(o) / 32768;
      else if (bits === 24) v = body.readIntLE(o, 3) / 8388608;
      else if (bits === 32) v = body.readInt32LE(o) / 2147483648;
      else if (bits === 8) v = (body[o] - 128) / 128;
      else throw new Error(`WAV ${bits}-bit belum didukung.`);
    } else throw new Error('Format WAV ini belum didukung (bukan PCM atau float).');
    ch[c][i] = v;
  }
  return { rate, channels: ch, sourceBits: bits, sourceFloat: format === 3 };
}

function readAiff(data, compressed) {
  let at = 12, comm = null, ssnd = null;
  while (at + 8 <= data.length) {
    const id = data.toString('latin1', at, at + 4), size = data.readUInt32BE(at + 4);
    if (id === 'COMM') comm = data.subarray(at + 8, at + 8 + size);
    if (id === 'SSND') ssnd = data.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  if (!comm || !ssnd) throw new Error('File AIFF tidak lengkap.');
  const channels = comm.readUInt16BE(0), frames = comm.readUInt32BE(2), bits = comm.readUInt16BE(6);
  // Sample rate is an 80-bit extended float.
  const exp = comm.readUInt16BE(8) & 0x7fff, mant = comm.readUInt32BE(10) * 2 ** 32 + comm.readUInt32BE(14);
  const rate = Math.round(mant * 2 ** (exp - 16383 - 63));
  let little = false;
  if (compressed) {
    const kind = comm.toString('latin1', 18, 22);
    if (kind === 'sowt') little = true;
    else if (kind !== 'NONE') throw new Error(`AIFC terkompresi (${kind}) belum didukung. Ekspor sebagai WAV atau AIFF biasa.`);
  }
  const offset = ssnd.readUInt32BE(0), body = ssnd.subarray(8 + offset), bytes = Math.ceil(bits / 8);
  const ch = [...Array(channels)].map(() => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
    const o = (i * channels + c) * bytes;
    if (o + bytes > body.length) break;
    let v;
    if (bytes === 2) v = (little ? body.readInt16LE(o) : body.readInt16BE(o)) / 32768;
    else if (bytes === 3) v = (little ? body.readIntLE(o, 3) : body.readIntBE(o, 3)) / 8388608;
    else if (bytes === 4) v = (little ? body.readInt32LE(o) : body.readInt32BE(o)) / 2147483648;
    else throw new Error(`AIFF ${bits}-bit belum didukung.`);
    ch[c][i] = v;
  }
  return { rate, channels: ch, sourceBits: bits, sourceFloat: false };
}

// ---- Measuring ----
// Integrated loudness in LUFS (ITU-R BS.1770: K-weighting, 400 ms blocks, gating), the same
// method as the app (studio.js `loudness`). Mono is measured as one channel.
function loudness(channels, rate) {
  const biquad = (b, a) => x => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  let w = 2 * Math.PI * 1681.974450955533 / rate, A = 10 ** (3.999843853973347 / 40);
  let al = Math.sin(w) / (2 * .7071752369554196), c = Math.cos(w), sq = 2 * Math.sqrt(A) * al;
  const shelf = biquad([A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)],
    [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]);
  w = 2 * Math.PI * 38.13547087602444 / rate; al = Math.sin(w) / (2 * .5003270373238773); c = Math.cos(w);
  const high = biquad([(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al]);
  const weighted = channels.map(x => high(shelf(x)));
  const n = channels[0].length, size = Math.floor(.4 * rate), hop = Math.floor(.1 * rate), blocks = [];
  // Running sums keep this fast on long files.
  const prefix = weighted.map(y => { const p = new Float64Array(n + 1); for (let i = 0; i < n; i++) p[i + 1] = p[i] + y[i] * y[i]; return p; });
  for (let at = 0; at + size <= n; at += hop) {
    let sum = 0;
    for (const p of prefix) sum += (p[at + size] - p[at]) / size;
    blocks.push(sum);
  }
  const lufs = z => -.691 + 10 * Math.log10(z);
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  const loud = blocks.filter(z => lufs(z) > -70);
  if (!loud.length) return -70;
  const relative = lufs(mean(loud)) - 10;
  return lufs(mean(loud.filter(z => lufs(z) > relative)));
}

const peakOf = channels => { let p = 0; for (const x of channels) for (const v of x) p = Math.max(p, Math.abs(v)); return p; };
// True peak: 4x oversampling with a windowed-sinc filter (as in ITU-R BS.1770-4 Annex 2),
// catching peaks between samples that can clip after conversion to MP3/AAC on YouTube.
function truePeak(channels) {
  const factor = 4, taps = 12;
  const kernel = [];
  for (let phase = 1; phase < factor; phase++) {
    const k = [];
    for (let t = -taps + 1; t <= taps; t++) {
      const x = t - phase / factor;
      const sinc = Math.sin(Math.PI * x) / (Math.PI * x);
      const win = .5 + .5 * Math.cos(Math.PI * x / taps);
      k.push(sinc * win);
    }
    kernel.push(k);
  }
  let peak = peakOf(channels);
  for (const x of channels) for (let i = taps; i < x.length - taps; i++) {
    // Between-sample peaks overshoot the samples by at most a few dB, so quiet passages can
    // be skipped: only check where the neighbouring samples are above -6 dBFS.
    if (Math.abs(x[i]) < .5 && Math.abs(x[i + 1]) < .5) continue;
    for (const k of kernel) {
      let v = 0;
      for (let j = 0; j < k.length; j++) v += k[j] * x[i - taps + 1 + j];
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
  }
  return peak;
}

// ---- Limiting ----
// Look-ahead peak limiter, the same design as the app (studio.js `limit`): the gain drops
// ahead of each peak and recovers slowly, then the curve is smoothed.
function limit(channels, rate, gain, ceilingDb) {
  const n = channels[0].length, thr = 10 ** (ceilingDb / 20), look = Math.floor(rate * .005), win = 2 * look;
  const release = 1 - Math.exp(-1 / (rate * .15));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (const d of channels) peak = Math.max(peak, Math.abs(d[i] * gain));
    need[i] = peak > thr ? thr / peak : 1;
  }
  const ahead = new Float32Array(n), queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && need[queue[tail - 1]] >= need[i]) tail--;
    queue[tail++] = i;
    while (queue[head] > i + win - 1) head++;
    ahead[i] = need[queue[head]];
  }
  const env = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) { g = Math.min(ahead[i], g + (1 - g) * release); env[i] = g; }
  let sum = look * env[0], deepest = 1;
  const out = channels.map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    sum += env[i] - (i >= look ? env[i - look] : env[0]);
    const smooth = sum / look;
    deepest = Math.min(deepest, smooth);
    for (let c = 0; c < channels.length; c++) out[c][i] = channels[c][i] * gain * smooth;
  }
  return { channels: out, deepestDb: 20 * Math.log10(deepest) };
}

// Reach the target loudness without squashing peaks by more than maxSquashDb, keeping the
// true peak at or below truePeakDb.
function master(audio, { target = -14, maxSquashDb = 6, ceilingDb = -1.5, truePeakDb = -1 } = {}) {
  const { channels, rate } = audio;
  let gain = 10 ** ((target - loudness(channels, rate)) / 20), out;
  for (let pass = 0; pass < 3; pass++) {
    out = limit(channels, rate, gain, ceilingDb);
    gain *= Math.min(10 ** ((target - loudness(out.channels, rate)) / 20), 10 ** ((out.deepestDb + maxSquashDb) / 20));
  }
  out = limit(channels, rate, gain, ceilingDb);
  // True-peak safety: if peaks between samples still pass the limit, lower the ceiling a little.
  for (let tries = 0; tries < 4; tries++) {
    const tp = 20 * Math.log10(truePeak(out.channels));
    if (tp <= truePeakDb) break;
    ceilingDb -= tp - truePeakDb + .1;
    out = limit(channels, rate, gain, ceilingDb);
  }
  return { channels: out.channels, gainDb: 20 * Math.log10(gain), squashDb: -out.deepestDb };
}

// ---- Writing ----
// 24-bit WAV by default; 16-bit uses triangular dither so quiet fades stay smooth.
function writeWav(file, channels, rate, bits = 24) {
  const n = channels[0].length, count = channels.length, bytes = bits / 8;
  const out = Buffer.alloc(44 + n * count * bytes);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * count * bytes, 4); out.write('WAVE', 8); out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(count, 22); out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * count * bytes, 28); out.writeUInt16LE(count * bytes, 32); out.writeUInt16LE(bits, 34);
  out.write('data', 36); out.writeUInt32LE(n * count * bytes, 40);
  const full = bits === 24 ? 8388607 : 32767;
  let seed = 22222;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) for (let c = 0; c < count; c++) {
    let v = channels[c][i] * full;
    if (bits === 16) v += rand() - rand();
    v = Math.max(-full - 1, Math.min(full, Math.round(v)));
    const o = 44 + (i * count + c) * bytes;
    if (bits === 24) out.writeIntLE(v, o, 3); else out.writeInt16LE(v, o);
  }
  fs.writeFileSync(file, out);
}

// Silence at the very start or end (useful to know before uploading).
function silence(channels, rate) {
  const n = channels[0].length, thr = 10 ** (-60 / 20);
  const loudAt = i => channels.some(x => Math.abs(x[i]) > thr);
  let start = 0; while (start < n && !loudAt(start)) start++;
  let end = n - 1; while (end > start && !loudAt(end)) end--;
  return { lead: start / rate, trail: (n - 1 - end) / rate };
}

module.exports = { readAudio, loudness, truePeak, peakOf, master, writeWav, silence };
