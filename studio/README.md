# Studio pipeline (eksperimen Womi)

Branch eksperimen, bukan untuk `main`. Isinya dua hal:

## 1. Perubahan `studio.js` (render bawaan music-maker)
- String: bagian sustain sampel di-loop (loopStart 1.6 s, loopEnd = durasi − 1.5 s, hanya sampel > 4.5 s) supaya akor panjang tidak memudar di tengah.
- EQ lebih terang: piano peaking 3.2 kHz +2 dB, highshelf 8 kHz +3 dB; string peaking 3 kHz +1.5 dB, highshelf 0 dB.
- Room impulse lebih terang (decay lowpass lebih ringan).
- Dinamika baru `halus` (default) dan glue compressor bus lebih lembut.
- Tip CLI: `--pola Piano=pecah` untuk akor pecah, bukan blok.

Hasil ukur (Sedih Akustik, seed 4207): LRA 7.8 → 6.0 LU, presence 2–6 kHz ±+1.3 dB.

## 2. Folder `studio/` — render MIDI ke instrumen sampel lebih baik (Python, jalan di server)
Kebutuhan: Python 3 + `numpy scipy soundfile pedalboard pyloudnorm mido`, `fluidsynth`, `ffmpeg`.
Sampel (tidak disertakan di repo, unduh terpisah):
- Salamander Grand Piano V3 SF2 — CC BY 3.0, wajib kredit: "Piano: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0".
- Alternatif tanpa kredit: FreePats Upright Piano KW SF2 (CC0) — `studio_render_cc0.py`.
- VSCO-2 Community Edition Strings (CC0).
Path sampel di skrip masih path server (`/home/ubuntu/studio/...`), sesuaikan.

| File | Fungsi |
|---|---|
| `studio_render.py <in.mid> <outdir>` | piano lewat FluidSynth, string/cello/bass lewat sampler Python VSCO, mix + hall + master −14 LUFS |
| `studio_render_legato.py` | sama, plus legato simulasi (sustain-entry crossfade, portamento cello) |
| `studio_render_cc0.py` | versi piano CC0 (Upright KW) |
| `compose_sedih01.py`, `compose_sedih01_legato.py`, `compose_sedih02.py` | lagu yang dikomposisi manual: motif, frasa tanya-jawab, klimaks, humanisasi, ritardando |
| `compose_sedih02_v4.py` | Sedih 02 v4: dinamika lebih rapat, string 4 suara (cello–2 viola–biola, nada sama diikat), pedal sustain CC64 sungguhan |
| `studio_render_legato_v4.py` | render legato + level rider pelan (hanya menaikkan, maks +7 dB; kekuatan lewat env `RIDE`, 0.25 utama / 0.45 versi rata) |
| `sedih02v4.sh`, `v4tools.py`, `pedaltest.py`, `cc64.py` | skrip render v4, cek (LRA, jarak intro–klimaks, kerataan not, jumlah not per seksi string, CC64), uji pedal FluidSynth |
| `piano_calib.py` → `piano_cal_salamander.json` | ukur volume tiap tuts Salamander di velocity 20–80; dipakai `compose_sedih02.py` untuk menyetarakan volume not |
| `qc.py`, `bal.py`, `pulse.py`, `pitchcheck.py` | alat cek: loudness/LRA/spektrum/klik, kerataan not intro, denyut, pitch |

Perbaikan bug MIDI yang sudah ada di skrip komposisi:
1. Nada yang sama diulang: not lama selalu diakhiri sebelum dipukul lagi (dulu not baru ikut terpotong).
2. Melodi & iringan pada nada sama yang mulai < 0.15 ketuk digabung jadi satu not.

Pelajaran: sampel Salamander tidak rata antar tuts (A3 ±10 dB lebih pelan) dan sangat peka di velocity rendah (±1 dB per langkah), jadi velocity piano harus dikalibrasi per tuts.
