"""Render a MusicXML score with MuseScore Studio 4 + Muse Sounds, then master it (music-maker komposer).

Runs on the user's own Mac, in the account where Muse Hub / Muse Sounds are installed and signed in.
  render(xml, wav)   -> calls mscore headless with --sound-profile MuseSounds, detects a licence
                        fallback (ReceiptMissing / MuseSampler not loaded = MS Basic sound) and fails clearly
  master(wav, mp3)   -> gentle compression (keeps the musical dynamics) + 2-pass loudnorm to -14 LUFS,
                        true peak <= -1.5 dBTP, MP3 320 kbps, then measures the result
  scan(audio)        -> gap / click check (same thresholds used for the hand-composed SadnessMelody pieces)
"""
import glob, json, os, re, shutil, subprocess, tempfile


class RenderError(RuntimeError):
    pass


MSCORE_CANDIDATES = [
    '/Applications/MuseScore 4.app/Contents/MacOS/mscore',
    '/Applications/MuseScore Studio 4.app/Contents/MacOS/mscore',
    os.path.expanduser('~/Applications/MuseScore 4.app/Contents/MacOS/mscore'),
    os.path.expanduser('~/Applications/MuseScore Studio 4.app/Contents/MacOS/mscore'),
    '/usr/bin/mscore4', '/usr/bin/mscore', '/usr/local/bin/mscore',
]


def find_mscore(explicit=None):
    for c in [explicit, os.environ.get('MUSESCORE')] + MSCORE_CANDIDATES:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    for c in glob.glob('/Applications/MuseScore*.app/Contents/MacOS/mscore'):
        return c
    raise RenderError('MuseScore Studio 4 tidak ditemukan. Pasang lewat Muse Hub (musescore.org), '
                      'atau beri lokasinya: --mscore "/path/ke/mscore" atau env MUSESCORE.')


def find_tool(name):
    """ffmpeg/ffprobe: repo-local env first (pasang-mac.sh), then PATH"""
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for c in [os.environ.get(name.upper()), os.path.join(here, '.env-mac', 'bin', name),
              os.path.expanduser(f'~/.music-maker/env/bin/{name}'), shutil.which(name)]:
        if c and os.path.isfile(c):
            return c
    raise RenderError(f'{name} tidak ditemukan. Jalankan dulu: bash pasang-mac.sh')


def sampler_present():
    lib = os.path.expanduser('~/Library/Application Support/MuseSampler/lib')
    return os.path.isdir(lib) and bool(os.listdir(lib))


FALLBACK_PATTERNS = ['ReceiptMissing', 'Could not init lib', 'MuseSampler: failed', 'Unable to load MuseSampler',
                     'muse sampler is not available', 'MuseSampler lib not found']


def render(xml, wav, mscore=None, timeout=1800, allow_basic=False):
    """MusicXML -> WAV with Muse Sounds. Raises RenderError when Muse Sounds is not really used."""
    exe = find_mscore(mscore)
    if not sampler_present() and not allow_basic:
        raise RenderError('Muse Sounds (MuseSampler) belum terpasang di akun ini: folder '
                          '~/Library/Application Support/MuseSampler/lib tidak ada. Buka Muse Hub, login, '
                          'pasang Muse Keys + Muse Strings, lalu buka MuseScore sekali.')
    os.makedirs(os.path.dirname(os.path.abspath(wav)) or '.', exist_ok=True)
    tmp = wav + '.sedang.wav'
    cmd = [exe, '-o', tmp, '--sound-profile', 'MuseSounds', xml]
    env = dict(os.environ, QT_QPA_PLATFORM=os.environ.get('QT_QPA_PLATFORM', 'offscreen' if os.uname().sysname != 'Darwin' else ''))
    if not env['QT_QPA_PLATFORM']: env.pop('QT_QPA_PLATFORM')
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        raise RenderError(f'MuseScore tidak selesai dalam {timeout} detik')
    log = (r.stdout or '') + (r.stderr or '')
    with open(wav + '.log', 'w') as f:
        f.write(' '.join(cmd) + '\n' + log)
    hit = [p for p in FALLBACK_PATTERNS if p.lower() in log.lower()]
    hit += [l.strip()[:160] for l in log.splitlines()
            if re.search(r'muse ?sampler', l, re.I) and re.search(r'missing|fail|error|not found|could not|unable|invalid', l, re.I)]
    if hit and not allow_basic:
        if os.path.exists(tmp): os.remove(tmp)
        raise RenderError('Muse Sounds GAGAL dimuat (' + ', '.join(hit) + '): MuseScore akan memakai suara dasar '
                          '(MS Basic), jadi hasil TIDAK disimpan. Penyebab biasa: dijalankan di akun Mac yang bukan '
                          'akun Muse Hub, atau belum login di Muse Hub. Buka Muse Hub di akun ini, pastikan login, '
                          'buka MuseScore sekali, lalu ulangi. Log: ' + wav + '.log')
    if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 100000:
        if os.path.exists(tmp): os.remove(tmp)
        raise RenderError(f'MuseScore gagal (kode {r.returncode}). Log: {wav}.log\n' + log[-800:])
    os.replace(tmp, wav)
    return dict(log=wav + '.log', basic_fallback=bool(hit))


# ------------------------------------------------------------------ loudness helpers
def _last_json(text):
    """ffmpeg prints loudnorm JSON at the end of stderr; on some Mac builds more text follows it"""
    a = text.rfind('{'); b = text.rfind('}')
    if a < 0 or b < a: raise RenderError('tidak bisa membaca hasil loudnorm dari ffmpeg')
    return json.loads(text[a:b + 1])


def measure(path):
    ff = find_tool('ffmpeg')
    r = subprocess.run([ff, '-nostdin', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    t = r.stderr[r.stderr.rfind('Summary:'):]
    g = lambda k: float(re.search(rf'^\s+{k}:\s+(-?[\d.]+|-inf)', t, re.M).group(1).replace('-inf', '-99'))
    return dict(I=g('I'), LRA=g('LRA'), TP=g('Peak'))


COMP = 'acompressor=threshold=-26dB:ratio=2:attack=40:release=500:knee=6:makeup=1'


def master(wav, mp3, target=-14.0, tp=-1.5, lra=12, extra_filter=None, wav_out=None):
    """gentle glue compression + 2-pass linear loudnorm + exact trim; MP3 320k 48 kHz
    (+ wav_out: the same master as 24-bit 48 kHz WAV, ready for video editing)"""
    ff = find_tool('ffmpeg')
    pre = COMP + (',' + extra_filter if extra_filter else '')
    raw = measure(wav)
    r = subprocess.run([ff, '-nostdin', '-nostats', '-i', wav, '-af', f'{pre},loudnorm=I={target}:TP={tp}:LRA={lra}:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True)
    j = _last_json(r.stderr)
    ln = (f"loudnorm=I={target}:TP={tp}:LRA={lra}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
          f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:linear=true")
    tmpd = tempfile.mkdtemp()
    stage = os.path.join(tmpd, 'stage.wav')
    subprocess.run([ff, '-nostdin', '-y', '-loglevel', 'error', '-i', wav, '-af', f'{pre},{ln},aresample=48000', '-c:a', 'pcm_f32le', stage], check=True)
    m1 = measure(stage)
    trim = target - m1['I']
    trim = min(trim, -1.0 - m1['TP'])             # never push the true peak above -1 dBTP
    os.makedirs(os.path.dirname(os.path.abspath(mp3)) or '.', exist_ok=True)
    subprocess.run([ff, '-nostdin', '-y', '-loglevel', 'error', '-i', stage, '-af', f'volume={trim:.2f}dB', '-c:a', 'libmp3lame',
                    '-b:a', '320k', mp3], check=True)
    if wav_out:
        subprocess.run([ff, '-nostdin', '-y', '-loglevel', 'error', '-i', stage, '-af', f'volume={trim:.2f}dB', '-c:a', 'pcm_s24le',
                        '-ar', '48000', wav_out], check=True)
    shutil.rmtree(tmpd, ignore_errors=True)
    fin = measure(mp3)
    return dict(raw=raw, final=fin)


def scan(path, boundaries=()):
    """gaps (>=1.5 s under -60 dBFS, not counting the end) and click candidates"""
    import numpy as np
    ff = find_tool('ffmpeg'); sr = 48000
    raw = subprocess.run([ff, '-nostdin', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
                         capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    dur = len(x) / sr
    hop = sr // 10; nb = len(x) // hop
    rms = 20 * np.log10(np.sqrt((x[:nb * hop].reshape(nb, hop) ** 2).mean(1)) + 1e-12)
    gaps, run = [], 0
    for i, v in enumerate(rms):
        if v < -60: run += 1
        else:
            g0 = (i - run) / 10
            planned = any(b - 8 <= g0 <= b + .5 for b in boundaries)    # the planned silence between songs
            if run >= 15 and (i - run) > 5 and not planned: gaps.append(round(g0, 1))
            run = 0
    d2 = np.abs(np.diff(x, 2)); w = sr // 50; nb2 = len(d2) // w
    blk = d2[:nb2 * w].reshape(nb2, w)
    med = np.median(blk, 1) + 1e-7; pk = blk.max(1)
    cand = np.where((pk > 12 * med) & (pk > 0.02))[0]
    clicks, tiny, soft = [], [], []
    db = lambda a: 20 * np.log10(np.sqrt((a ** 2).mean()) + 1e-12) if len(a) else -240
    for b in cand:
        i = b * w + int(np.argmax(blk[b])); t = round(i / sr, 2)
        pre = db(d2[max(0, i - int(.03 * sr)):max(0, i - int(.01 * sr))])
        post = db(d2[i + int(.01 * sr):i + int(.03 * sr)])
        burst = db(d2[max(0, i - 48):i + 48]); music = db(x[max(0, i - sr // 10):i + sr // 10])
        if post - pre > 6: soft.append(t)                     # a note attack, not a click
        elif burst - pre >= 12 or music < -35: clicks.append(t)
        else: tiny.append(t)

    def merge(ts):
        out = []
        for t in ts:
            if not out or t - out[-1] > .5: out.append(t)
        return out
    return dict(detik=round(dur, 1), jeda=gaps, klik=merge(clicks), kecil=len(merge(tiny)), serangan_nada=len(merge(soft)))


def fmt(s):
    return f'{int(s // 60)}:{int(s % 60):02d}'


def ringkas(name, m, sc):
    f = m['final']; flags = []
    if sc['jeda']: flags.append('JEDA di ' + ', '.join(fmt(g) for g in sc['jeda']))
    if sc['klik']: flags.append('KLIK? di ' + ', '.join(fmt(c) for c in sc['klik'][:8]))
    if f['TP'] > -1.0: flags.append(f"puncak {f['TP']} > -1")
    if abs(f['I'] + 14) > .3: flags.append(f"loudness {f['I']}")
    return (f"{name}: {fmt(sc['detik'])} | {f['I']} LUFS | LRA {m['raw']['LRA']}->{f['LRA']} | puncak {f['TP']} dBTP | "
            f"cek: {'; '.join(flags) if flags else 'bersih'}")
