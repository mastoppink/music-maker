"""music-maker komposer CLI  (python -m komposer ...)

  buat       one composed song  -> .mid + .musicxml (+ Muse Sounds .wav/.mp3 with --render musesounds)
  rangkaian  N different songs joined into one long audio (e.g. 60 minutes), resumable

Examples (see README, "Cara pakai di Mac sendiri"):
  ./music-maker-mac buat --mood Sedih --seed 12 --render musesounds --keluar ~/Music/mm
  ./music-maker-mac rangkaian --mood Sedih --menit 60 --render musesounds --keluar ~/Music/mm/jam1
"""
import argparse, json, os, random, re, shutil, subprocess, sys, time

from . import lagu, musicxml, katalog
from . import musesounds as ms


def slug(s):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s or 'lagu'


def out_base(a, song, seed):
    return os.path.join(os.path.expanduser(a.keluar), f'{slug(a.mood)}-{seed}-{slug(song.name)}')


def say(*x):
    print(*x, flush=True)


def make_song(a, seed, force, kat_path, check_similar=True, tries=12):
    """compose; if too similar to an earlier song, move to the next seed (reported)"""
    for k in range(tries):
        s, c = lagu.compose(a.mood, seed + k * 1000, **force)
        if not check_similar:
            return s, c, seed + k * 1000, None
        ok, sim, who = katalog.check(s, kat_path, a.ambang)
        if ok:
            return s, c, seed + k * 1000, sim
        say(f'  - seed {seed + k * 1000}: terlalu mirip "{who}" ({sim:.2f} >= {a.ambang}), coba seed lain')
    raise SystemExit('Tidak menemukan lagu yang cukup berbeda; pakai --reset-katalog atau --tanpa-cek-mirip.')


def finish_song(a, s, base):
    """write MIDI + MusicXML (+ render/master); returns info dict"""
    os.makedirs(os.path.dirname(base), exist_ok=True)
    s.write_midi(base + '.mid')
    rep = musicxml.export(s, base + '.musicxml', min_level=a.dinamika_min)
    info = dict(judul=s.name, kunci=s.key_str, rencana={k: v for k, v in s.plan.items() if k not in ('m', 'tpc')},
                ukuran=lagu.describe(s), musicxml=rep['xml'], validasi=rep['validasi'])
    if not rep['validasi']['ok']:
        raise SystemExit('Validasi MusicXML gagal: ' + '; '.join(rep['validasi']['masalah']))
    if a.render == 'musesounds':
        t0 = time.time()
        ms.render(base + '.musicxml', base + '.wav', mscore=a.mscore, allow_basic=a.izinkan_suara_dasar)
        m = ms.master(base + '.wav', base + '.mp3')
        sc = ms.scan(base + '.mp3')
        info.update(render_detik=round(time.time() - t0), master=m, cek=sc, ringkas=ms.ringkas(s.name, m, sc))
        if not a.simpan_wav:
            pass   # the WAV is kept by default only inside rangkaian (needed for joining); see below
    with open(base + '.json', 'w') as f: json.dump(info, f, indent=1, default=str)
    return info


def force_from(a):
    f = {}
    if a.birama: f['meter'] = a.birama
    if a.lead: f['lead'] = a.lead
    if a.kunci: f['key'] = a.kunci
    if a.tempo: f['bpm'] = a.tempo
    return f


def cmd_buat(a):
    kat = os.path.expanduser(a.katalog)
    if a.reset_katalog and os.path.exists(kat): os.remove(kat)
    seed = a.seed if a.seed is not None else random.randint(1, 99999)
    force = force_from(a)
    force['used_titles'] = tuple(e['judul'] for e in katalog.load(kat)['lagu'])
    s, c, seed, sim = make_song(a, seed, force, kat, not a.tanpa_cek_mirip)
    base = out_base(a, s, seed)
    say(f'Menyusun "{s.name}" ({a.mood}, seed {seed}, {s.plan["meter"]}, {s.plan["lead"]}, {s.key_str}, {s.plan["bpm"]} BPM)')
    info = finish_song(a, s, base)
    if not a.tanpa_cek_mirip: katalog.add(s, kat, dict(mood=a.mood, seed=seed))
    if a.render == 'musesounds' and not a.simpan_wav and os.path.exists(base + '.wav'): os.remove(base + '.wav')
    d = info['ukuran']
    say(f"  {d['detik']} detik, klimaks {d['klimaks']}, MusicXML valid ({info['validasi']['not_terbaca']} not)")
    if 'ringkas' in info: say('  ' + info['ringkas'])
    for ext in ('.mp3', '.musicxml', '.mid'):
        if os.path.exists(base + ext): say('  ' + base + ext)


# ------------------------------------------------------------------ rangkaian
LEADS = ['piano', 'piano+string', 'cello']
METERS = ['4/4', '3/4', '6/8']


def plan_set(a, n):
    """vary lead, metre and key from song to song (no key among the last 3, no lead/metre twice in a row)"""
    rng = random.Random(a.seed_awal * 7 + (1 if a.mood == 'Melankolis' else 0))
    keys = [k for k, _ in lagu.KEYS]
    out, last_keys = [], []
    lead_cycle = []
    for i in range(n):
        if not lead_cycle:
            lead_cycle = LEADS[:] + ['piano']        # piano a bit more often
            rng.shuffle(lead_cycle)
            if out and lead_cycle[0] == out[-1]['lead']: lead_cycle.append(lead_cycle.pop(0))
        lead = lead_cycle.pop(0)
        meters = [m for m in METERS if not out or m != out[-1]['meter']]
        meter = rng.choice(meters)
        k = rng.choice([x for x in keys if x not in last_keys[-3:]])
        last_keys.append(k)
        out.append(dict(nomor=i + 1, seed=a.seed_awal + i * 37, lead=lead, meter=meter, key=k))
    return out


def run(cmd):
    subprocess.run(cmd, check=True)


def cmd_rangkaian(a):
    outdir = os.path.expanduser(a.keluar); os.makedirs(outdir, exist_ok=True)
    kat = os.path.expanduser(a.katalog)
    if a.reset_katalog and os.path.exists(kat): os.remove(kat)
    target = a.menit * 60
    n = max(2, round(target / 195) + 1)               # ~3:15 per song; extra songs are dropped at the end
    state_p = os.path.join(outdir, 'rangkaian.json')
    st = json.load(open(state_p)) if os.path.exists(state_p) else dict(mood=a.mood, menit=a.menit, rencana=plan_set(a, n), lagu=[])
    if a.rencana:
        for p in st['rencana']: say(f"{p['nomor']:2d}. seed {p['seed']}  {p['lead']:13s} {p['meter']}  {p['key']} minor")
        return
    used = {x['judul'] for x in st['lagu']} | {e['judul'] for e in katalog.load(kat)['lagu']}
    total = sum(x['detik'] for x in st['lagu'])
    done = {x['nomor'] for x in st['lagu']}
    for p in st['rencana']:
        if total >= target: break
        if p['nomor'] in done: continue
        force = dict(lead=p['lead'], meter=p['meter'], key=p['key'], used_titles=tuple(used))
        s, c, seed, sim = make_song(a, p['seed'], force, kat, not a.tanpa_cek_mirip)
        base = os.path.join(outdir, f"{p['nomor']:02d}-{slug(s.name)}")
        say(f"[{p['nomor']}] {s.name}: {p['lead']}, {p['meter']}, {s.key_str}, {s.plan['bpm']} BPM (seed {seed})")
        info = finish_song(a, s, base)
        if not a.tanpa_cek_mirip: katalog.add(s, kat, dict(mood=a.mood, seed=seed))
        dur = info['cek']['detik'] if 'cek' in info else info['ukuran']['detik']
        if 'ringkas' in info: say('    ' + info['ringkas'])
        st['lagu'].append(dict(nomor=p['nomor'], judul=s.name, seed=seed, dasar=base, detik=dur))
        used.add(s.name); total += dur
        json.dump(st, open(state_p, 'w'), indent=1)
    if a.render != 'musesounds':
        say(f'Selesai: {len(st["lagu"])} lagu (MIDI + MusicXML) di {outdir}. Tambahkan --render musesounds untuk audio.')
        return
    if total < target * .9:
        st['rencana'] += plan_set(argparse.Namespace(seed_awal=a.seed_awal + 5000, mood=a.mood), 4)
        json.dump(st, open(state_p, 'w'), indent=1)
        raise SystemExit('Durasi belum cukup; jalankan perintah yang sama lagi untuk melanjutkan.')
    # ---- join: each song already at -14 LUFS; 3 s of silence between songs, then one final loudness pass
    ff = ms.find_tool('ffmpeg')
    gap = a.jeda
    lst = os.path.join(outdir, '.gabung.txt'); sil = os.path.join(outdir, '.hening.wav')
    run([ff, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=stereo', '-t', str(gap), '-c:a', 'pcm_f32le', sil])
    parts = []
    with open(lst, 'w') as f:
        for k, x in enumerate(st['lagu']):
            mp = x['dasar'] + '.norm.wav'
            if not os.path.exists(mp):
                run([ff, '-y', '-loglevel', 'error', '-i', x['dasar'] + '.mp3', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', mp])
            f.write(f"file '{mp}'\n")
            if k + 1 < len(st['lagu']): f.write(f"file '{sil}'\n")
            parts.append(mp)
    joined = os.path.join(outdir, '.gabung.wav')
    run([ff, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'pcm_f32le', joined])
    name = f"{slug(a.mood)}-{a.menit}menit"
    mp3 = os.path.join(outdir, name + '.mp3')
    m = ms.master(joined, mp3, extra_filter=None)
    bnd, t = [], 0.0
    for x in st['lagu'][:-1]:
        t += x['detik'] + gap; bnd.append(t)
    sc = ms.scan(mp3, boundaries=bnd)
    # tracklist / YouTube chapters
    t = 0.0; lines = []
    for x in st['lagu']:
        lines.append(f"{ms.fmt(t) if t < 3600 else str(int(t // 3600)) + ':' + ms.fmt(t % 3600).zfill(5)} {x['judul']}")
        t += x['detik'] + gap
    with open(os.path.join(outdir, name + '-daftar-lagu.txt'), 'w') as f: f.write('\n'.join(lines) + '\n')
    for pth in parts + [joined, sil, lst]:
        if os.path.exists(pth): os.remove(pth)
    if not a.simpan_wav:
        for x in st['lagu']:
            if os.path.exists(x['dasar'] + '.wav'): os.remove(x['dasar'] + '.wav')
    say(ms.ringkas(name, m, sc).replace(' | cek', f" | {len(st['lagu'])} lagu | cek"))
    say(mp3); say(os.path.join(outdir, name + '-daftar-lagu.txt'))


def main(argv=None):
    ap = argparse.ArgumentParser(prog='music-maker komposer')
    sub = ap.add_subparsers(dest='cmd', required=True)
    for nm in ('buat', 'rangkaian'):
        p = sub.add_parser(nm)
        p.add_argument('--mood', '--suasana', default='Sedih', choices=['Sedih', 'Melankolis'])
        p.add_argument('--keluar', default='~/Music/music-maker')
        p.add_argument('--render', default='tidak', choices=['tidak', 'musesounds'])
        p.add_argument('--mscore', help='lokasi mscore jika bukan /Applications/MuseScore 4.app')
        p.add_argument('--izinkan-suara-dasar', action='store_true', help='(tes) tetap simpan walau Muse Sounds gagal dimuat')
        p.add_argument('--simpan-wav', action='store_true')
        p.add_argument('--tanpa-cek-mirip', action='store_true')
        p.add_argument('--reset-katalog', action='store_true')
        p.add_argument('--katalog', default=katalog.DEFAULT)
        p.add_argument('--ambang', type=float, default=katalog.THRESHOLD)
        p.add_argument('--dinamika-min', default='pp', choices=['ppp', 'pp', 'p', 'mp'])
        if nm == 'buat':
            p.add_argument('--seed', type=int)
            p.add_argument('--birama', choices=METERS); p.add_argument('--lead', choices=LEADS)
            p.add_argument('--kunci', choices=[k for k, _ in lagu.KEYS]); p.add_argument('--tempo', type=int)
        else:
            p.add_argument('--menit', type=int, default=60)
            p.add_argument('--seed-awal', type=int, default=1)
            p.add_argument('--jeda', type=float, default=3.0, help='detik hening antar lagu')
            p.add_argument('--rencana', action='store_true', help='hanya tampilkan rencana variasi')
    a = ap.parse_args(argv)
    try:
        (cmd_buat if a.cmd == 'buat' else cmd_rangkaian)(a)
    except ms.RenderError as e:
        print('\nGAGAL: ' + str(e), file=sys.stderr); sys.exit(2)


if __name__ == '__main__':
    main()
