# Music Maker

Generator musik instrumental. Pilih **mood** dan **genre**, lalu atur atau buat ulang **setiap instrumen** (piano, gitar, bass, drum, dan string). Hasilnya berupa file WAV yang siap diunggah ke YouTube.

Tersedia dua cara pakai:

- **Aplikasi web** (`index.html`): buka di browser, dengarkan versi A dan B, lalu atur tiap instrumen.
- **CLI** (`cli/music-maker.js`): buat lagu dari baris perintah, termasuk banyak lagu sekaligus.

Keduanya memakai mesin musik yang sama (`studio.js`), jadi pengaturan yang sama menghasilkan lagu yang sama.

## Aplikasi web

1. Buka `index.html` di Chrome atau Edge. Tidak perlu server atau instalasi.
2. Pilih Mood, Genre, Sumber, Melodi, dan Durasi. Centang instrumen yang dipakai, lalu tekan **Buat musik**.
3. Dengarkan **Versi A** dan **Versi B**, lalu pakai yang Anda suka.
4. Di bagian **Mix instrumental**, setiap instrumen punya:
   - **Pola**: cara instrumen itu bermain (misalnya gitar petik atau genjreng).
   - **Volume**, **Pan** kiri/kanan, dan **Bisukan**.
   - **Buat ulang**: pindah ke variasi lain dari pola itu. Instrumen lain tidak berubah.
5. Di bagian **Mixing & mastering**, atur target loudness LUFS, efek ruang, dan EQ/kompresi studio, lalu tekan **Terapkan mastering**. Ruang langsung berubah saat lagu diputar.
6. Tekan **Unduh WAV** untuk menyimpan hasilnya.
7. Tekan **Unduh MIDI** untuk menyimpan not lagu (satu jalur per instrumen) yang bisa dibuka di program musik seperti FL Studio, Ableton, atau GarageBand.
8. Tekan **Simpan proyek** untuk menyimpan pengaturan lagu (`.json`). Dengan **Buka proyek**, lagu itu bisa dibuat persis sama lagi, termasuk pola, variasi, pan, volume, mastering, dan instrumen yang dibisukan. Format file proyeknya sama dengan CLI, jadi proyek dari aplikasi bisa dipakai di CLI (`--dari`) dan sebaliknya.

### Instrumen

Piano, Gitar, Bass, Drum, dan **String** (biola, viola, dan cello yang menahan akor dengan lembut) tercentang secara bawaan di aplikasi web. Instrumen mana pun dapat dinonaktifkan dengan menghilangkan centangnya.

### Pilihan

| Pilihan | Nilai |
|---|---|
| Mood | Tenang, Ceria, Melankolis, Sedih |
| Genre | Akustik, Lo-fi, Pop, Jazz, Bossa |
| Sumber | **Kit orisinal**: melodi tulisan tangan · **Klasik**: korale J.S. Bach (domain publik) |
| Melodi | Gantian piano & gitar, atau Piano saja |
| Durasi | 30 detik, 1, 2, 3, 5 menit |

Gaya lagu, bentuk lagu, dan pola per instrumen berlaku untuk **Kit orisinal** di semua genre dan semua mood. Sumber **Klasik** memakai korale Bach dengan susunan sendiri.

### Genre

| Genre | Ciri |
|---|---|
| **Akustik** | Gitar nilon dipetik atau digenjreng dengan akor terbuka yang berdenging (seperti Cadd9 dan Am7), drum lembut. |
| **Lo-fi** | Ketukan diayun, akor piano jazz, drum boom-bap, suara hangat dengan goyang kaset halus dan desis piringan hitam yang samar. |
| **Pop** | Hi-hat drum set dengan hi-hat yang sesekali dibuka, isian snare sebelum bagian baru, bass dan akor piano berdenyut. Mood Tenang memakai drum balada. |
| **Jazz** | Ketukan swing, walking bass yang mendekati akor secara kromatis, gerakan akor ii–V–I, akor piano dengan nada kesembilan, hi-hat drum set, melodi jazz bersinkop, solo piano di lagu panjang, penutup 6/9. |
| **Bossa** | Pola petik gitar nilon khas bossa nova, akor berwarna (maj7, m7), bass mengikuti jempol gitar, pukulan rim dengan klave bossa, ketukan lurus. Memakai melodi dan harmoni jazz. |

### Mood

**Tenang** dan **Ceria** memakai 20 melodi mayor tulisan tangan. **Melankolis** memakai 12 melodi minor. **Sedih** memakai 6 melodi minor khusus (garis turun, nada panjang, berakhir rendah) dengan tempo sangat pelan, drum paling lembut (Akustik tanpa drum), dan penutup yang selalu melambat. Jazz dan Bossa memakai 8 melodi jazz tersendiri (juga untuk mood Sedih). Setiap mood dan genre punya beberapa **gaya** (tempo, irama melodi, pola iringan), dan setiap lagu memilih satu gaya. Daftar lengkapnya bisa dilihat dengan `node cli/music-maker.js daftar`.

### Mesin komposisi (bawaan sejak 2026-11-27)

Lagu sekarang **ditulis seperti komposer**, bukan disambung dari potongan kit secara acak:

- **Satu motif** (1 birama) dan **jawabannya** (1 birama) membawa seluruh lagu: diulang, digeser satu nada lebih rendah (sekuens), dinaikkan untuk klimaks, dan diberi hiasan kecil saat kembali.
- **Bentuk lagu** dalam periode 8 birama: pembuka – A (berakhir menggantung di V, seperti *pertanyaan*) – A′ (*menjawab*, pulang ke nada dasar) – B (naik, **klimaks** di tengahnya) – A″ – penutup (potongan motif, V, pulang, melambat). Lagu panjang menambah bagian jeda, tema kedua (C), lalu kembali ke B dan A; setiap B berikutnya naik satu nada lagi supaya klimaks terakhir paling tinggi.
- Nada di ketukan 1 dan 3 serta nada panjang selalu **nada akor**; sisanya kebanyakan **melangkah** (rata-rata 62–72% langkah, dulu 19–49%), ada napas di akhir frasa.
- **Harmoni** dari progresi pilihan per tangga nada (minor: i–VI–III–VII, i–iv–VII–III, …; mayor: I–V–vi–IV, vi–IV–I–V, …). Jazz/Bossa mayor mengubah IV–V menjadi ii7–V, piano jazz memakai voicing tanpa akar dengan nada 9 (kecuali pada akor yang akan bentrok).
- Tempo pelan tidak lagi memakai bass berjalan atau hi-hat sibuk: gaya **Malam Kelabu** (Jazz Sedih) kini tanpa drum dengan bass panjang, **Biru** (Jazz Melankolis) drum tipis dengan bass dua nada, **Kamar Sepi** (Lo-fi Sedih) drum tipis.
- Nada dasar lebih beragam (minor: A–D termasuk Bb dan C#; mayor: C, D, Eb, F, G). Seed berbeda = motif, irama, progresi, dan nada dasar berbeda.

### Aransemen yang berkembang (mesin komposisi)

Setiap bagian lagu punya **lapisan** (0 = pembuka … 4 = klimaks), jadi teksturnya tidak sama dari awal sampai akhir:

| Bagian | Yang terjadi |
|---|---|
| Pembuka (0) | instrumen pengiring saja; string masuk di birama ke-3 |
| A pertama (1 → 1,5) | melodi + iringan jarang (piano pecah per ketukan, gitar hanya di ketukan); **bass masuk** di frasa kedua dengan nada panjang |
| A′ (2) | **drum masuk** (pop: pola balada dulu), pola iringan penuh, string tiga suara, **cello kontra-melodi** menjawab celah melodi |
| B (3) / B2 klimaks (4) | iringan terpenuh (variasi lebih ramai, gitar genjreng di mood ceria/tenang, bass dua nada), voicing piano membuka (oktaf atas, akar rendah di klimaks), string empat suara dan mengembang, pop memakai beat pop penuh |
| A″ setelah klimaks (1,5 → 2) | lebih tipis dulu (tanpa drum), lalu penuh lagi |
| Penutup (1,5) | tanpa drum, potongan motif, ritardando, akor akhir |

Ditambah: *fill* drum lembut di akhir frasa sebelum bagian baru (rim untuk drum tipis, snare untuk lo-fi), dan **lengkung dinamika** seluruh lagu (melodi sekitar −1 dB di awal sampai +3,5 dB di klimaks, iringan ikut sebagian). Semua lagu mesin komposisi melambat di akhir. Periksa per bagian: `node studio/cek-aransemen.js --mood Sedih --genre Akustik --seeds 701`.

Gaya baru untuk Sedih (Hujan Pelan, Surat Lama, Rindu, Sunyi, Lampu Redup, Pelabuhan) dan Melankolis (Senja Ungu, Jendela, Pulang, Hujan Kota, Gerimis Senja), supaya rangkaian panjang bisa bergiliran gaya. Catatan: karena pilihan gayanya bertambah, seed yang sama bisa mendapat gaya lain daripada sebelumnya; file `.json` lama (`--dari`) tetap menyimpan gayanya.

Cara lama tetap ada: `--mesin kit`. File proyek lama (tanpa `mesin`) otomatis memakai cara lama, jadi bunyinya tetap sama. Untuk memeriksa angka-angka komposisi semua mood × genre: `node studio/cek-komposisi.js --seeds 1,2,3`.

### Bentuk lagu (mesin kit)

Lagu 3 menit ke atas punya bagian-bagian: pembuka, melodi utama, bagian tengah yang lebih penuh, melodi kedua (di Jazz: solo), bagian jeda yang tipis, lalu penutup. Pola iringan berganti antarbagian, drum sesekali istirahat, dan nada dasar naik setelah bagian jeda, supaya lagu panjang tidak monoton.

Supaya lagu-lagu tidak berpola sama, setiap lagu (ditentukan oleh seed) memilih salah satu dari empat **urutan bagian**, ada atau tidaknya pembuka, dan instrumen yang membawa melodi lebih dulu (piano atau gitar). Bentuk ini ikut tersimpan di file proyek (`bentuk`), jadi lagu yang disimpan tetap sama.

## CLI

### Persiapan (sekali saja)

Butuh [Node.js](https://nodejs.org) versi 18 atau lebih baru, dan Chrome atau Edge yang sudah terpasang.

```bash
cd music-maker
npm install
```

CLI menjalankan aplikasi di Edge atau Chrome yang sudah ada di komputer tanpa menampilkan jendela, jadi tidak perlu mengunduh browser lain. Kalau browser tidak ditemukan otomatis, beri lokasinya dengan `--browser <path>` atau variabel lingkungan `MUSIC_MAKER_BROWSER`.

### Perintah

```bash
node cli/music-maker.js buat [opsi]       # buat lagu dan simpan sebagai WAV
node cli/music-maker.js rangkaian [opsi]  # sambung banyak lagu menjadi satu file, sampai 3 jam
node cli/music-maker.js master <file...>  # atur volume file audio (misalnya hasil DAW) ke standar YouTube
node cli/music-maker.js daftar         # tampilkan mood, genre, gaya, pola, dan jalur MIDI per genre
node cli/music-maker.js bantuan        # tampilkan semua opsi
```

### Rangkaian panjang (sampai 3 jam)

```bash
node cli/music-maker.js rangkaian --genre Lo-fi --menit 60
# 3 jam, bergantian tiga kombinasi, piano + string + bass, dengan MP3
node cli/music-maker.js rangkaian --menit 180 --campur Sedih/Akustik,Melankolis/Akustik,Sedih/Jazz \
  --instrumen Piano,String,Bass --melodi piano --mp3 --keluar hasil
```

Menyambung banyak lagu berbeda menjadi satu file panjang. Cara kerjanya hemat memori (aman untuk VPS 4 GB):

1. Lagu dibuat **satu per satu** dan disimpan sebagai WAV sendiri di folder `<nama>-lagu/`. Kalau proses terputus, **jalankan perintah yang sama lagi**: lagu yang sudah jadi dilewati.
2. Lagu disambung langsung di disk: ekor lagu memudar sementara lagu berikutnya masuk (crossfade equal-power).
3. Kekerasan seluruh rangkaian diratakan dengan ffmpeg dalam dua tahap (ukur, lalu satu penguatan linear) ke **−14 LUFS**, puncak maksimal **−1,2 dBTP**. Hasil akhir WAV 24-bit (dan MP3 320k dengan `--mp3`).

Setiap lagu punya seed sendiri (berjarak jauh). **Gaya bergiliran otomatis**: untuk setiap lagu dipilih gaya Mood/Genre itu yang paling jarang dipakai dan tidak muncul di 5 lagu terakhir; nada dasar tidak sama dengan 3 lagu terakhir; variasi pola berganti. Tempo ikut rentang gaya masing-masing. Lihat rencananya dulu tanpa membuat audio (beberapa detik saja):

```bash
node cli/music-maker.js rangkaian --rencana --menit 60 --campur Sedih/Akustik,Melankolis/Akustik,Sedih/Jazz
```

| Opsi | Arti | Bawaan |
|---|---|---|
| `--menit` | panjang rangkaian, 1–180 | 30 |
| `--durasi-lagu` | panjang tiap lagu dalam detik | 180 |
| `--jeda` | lama crossfade antarlagu dalam detik | 3 |
| `--campur` | daftar `Mood/Genre` yang dipakai bergantian | mood dan genre biasa |
| `--target` | kekerasan akhir (LUFS) | −14 |
| `--mp3` | simpan juga MP3 320k | tidak |
| `--rencana` | hanya daftar rencana (gaya, kunci, tempo), tanpa audio | tidak |
| `--render` | `studio` atau `app` untuk setiap lagu (lihat di bawah) | studio bila terpasang |

Opsi `buat` lainnya (instrumen, gaya, pola, dan sebagainya) berlaku untuk setiap lagu. Dengan `--midi`, MIDI setiap lagu disimpan di samping WAV-nya di `<nama>-lagu/`. Selain audio, rangkaian menyimpan:

- `.txt`: daftar lagu dengan waktu mulai, dalam format bab YouTube. Tempel langsung ke deskripsi video.
- `.json`: pengaturan, seed, dan deskripsi setiap lagu.

Rangkaian 3 jam menghasilkan WAV 24-bit sekitar 2,9 GB, ditambah lagu satu per satu sekitar 1,9 GB (boleh dihapus setelah selesai). Butuh ffmpeg untuk meratakan kekerasan.

### Opsi `buat`

| Opsi | Arti | Bawaan |
|---|---|---|
| `--mood` | Tenang, Ceria, Melankolis, Sedih | Tenang |
| `--genre` | Akustik, Lo-fi, Pop, Jazz, Bossa | Akustik |
| `--sumber` | `kit` atau `klasik` | kit |
| `--durasi` | panjang lagu dalam detik (10–900) | 60 |
| `--instrumen` | daftar instrumen, dipisah koma (Piano, Gitar, Bass, Drum, String) | Piano,Gitar,Bass,Drum |
| `--melodi` | `gantian` atau `piano` | gantian |
| `--seed` | angka; seed yang sama memberi lagu yang sama | acak |
| `--versi` | jumlah lagu, dengan seed berurutan | 1 |
| `--gaya` | paksa gaya lagu, misalnya `Santai` | dipilih dari seed |
| `--pola` | pola per instrumen, misalnya `Gitar=genjreng,Drum=tipis` | mengikuti gaya |
| `--variasi` | variasi pola mulai dari 1, misalnya `Gitar=2` | 1 |
| `--volume` | volume 0–100 per instrumen, misalnya `Drum=50` | 70 |
| `--bisu` | instrumen yang dibisukan, misalnya `Drum` | tidak ada |
| `--keluar` | folder hasil | `./hasil` |
| `--dari` | buat ulang dari file pengaturan `.json` | |
| `--browser` | lokasi Chrome/Edge/Chromium | otomatis |
| `--midi` | simpan juga file MIDI dengan formasi band lengkap untuk genrenya | |
| `--midi-saja` | hanya MIDI dan `.json`, tanpa WAV (lebih cepat, untuk DAW) | |
| `--stem` | simpan juga satu WAV per instrumen | |
| `--video` | buat juga video MP4 dari gambar diam + musik | |
| `--ffmpeg` | lokasi ffmpeg kalau tidak ada di PATH | `ffmpeg` |

### Contoh

```bash
# Lagu tenang 3 menit dengan gaya Santai
node cli/music-maker.js buat --durasi 180 --gaya Santai

# Tiga lagu ceria sekaligus, drum dibuat tipis
node cli/music-maker.js buat --mood Ceria --versi 3 --pola Drum=tipis

# Klasik 5 menit, hanya piano dan bass
node cli/music-maker.js buat --sumber klasik --durasi 300 --instrumen Piano,Bass

# Buat ulang lagu yang sama persis dari file pengaturannya
node cli/music-maker.js buat --dari hasil/tenang-akustik-kit-seed123.json
```

Setiap lagu disimpan sebagai dua file di folder hasil:

- `tenang-akustik-kit-seed123.wav`: audio stereo 44,1 kHz yang sudah di-master.
- `tenang-akustik-kit-seed123.json`: pengaturan lengkap, termasuk gaya, pola, variasi, nama melodi (`melodi_kit`), bentuk lagu (`bentuk`), dan takaran dinamika yang dipakai. Simpan file ini untuk lagu yang ingin dibuat ulang. Karena nama melodinya tersimpan, lagu tetap sama walaupun nanti ada melodi baru yang ditambahkan.

Catatan: file proyek yang dibuat sebelum 26 November 2026 belum menyimpan nama melodi, jadi bisa menghasilkan melodi yang berbeda.

Dengan opsi tambahan:

- `--midi`: `….mid` dengan formasi band lengkap untuk genrenya (lihat tabel MIDI di atas, atau `daftar`).
- `--midi-saja`: hanya `….mid` dan `.json`, tanpa membuat audio. Lagu 3 menit selesai dalam beberapa detik. Tidak bisa digabung dengan `--stem` atau `--video`.
- `--stem`: `…-stem-piano.wav`, `…-stem-gitar.wav`, dan seterusnya. Kerasnya dan gerak limiternya sama dengan mix lengkap, jadi kalau digabung hasilnya sama dengan lagunya. Desis piringan hitam Lo-fi tidak ikut.
- `--video gambar.jpg`: `….mp4` 1920×1080 berisi gambar diam dan musiknya, siap diunggah ke YouTube. Butuh [ffmpeg](https://ffmpeg.org). Juga berlaku untuk `rangkaian`.

```bash
node cli/music-maker.js buat --genre Lo-fi --durasi 180 --midi --stem --video sampul.jpg
node cli/music-maker.js buat --genre Jazz --durasi 180 --versi 5 --midi-saja
node cli/music-maker.js rangkaian --genre Lo-fi --menit 60 --video sampul.jpg
```

Di layar, CLI menampilkan deskripsi lagu, durasi, kekerasan suara (LUFS), dan puncak suara.

### Mastering hasil DAW (`master`)

Untuk lagu yang dimainkan ulang di program musik (DAW) dari MIDI kita, misalnya dengan instrumen yang lebih bagus di GarageBand:

```bash
node cli/music-maker.js master "~/Music/Lagu Saya.wav"
node cli/music-maker.js master lagu1.aiff lagu2.aiff --keluar siap-unggah
```

Perintah ini memakai mastering yang sama dengan aplikasi: kekerasan dibawa ke **−14 LUFS** (acuan YouTube), limiter menjaga denting tetap utuh (penekanan paling banyak 6 dB), dan **true peak** (puncak di antara sampel, yang bisa pecah setelah YouTube mengubah format) dijaga di bawah −1 dB. Hasilnya `nama-master.wav`, dengan sample rate yang sama dengan file asli.

| Opsi | Arti | Bawaan |
|---|---|---|
| `--target` | kekerasan tujuan dalam LUFS (−24 sampai −8) | −14 |
| `--bit` | WAV 24-bit, atau 16-bit (dengan dither) | 24 |
| `--keluar` | folder hasil | folder file asli |
| `--ffmpeg` | lokasi ffmpeg, hanya perlu untuk MP3, M4A, FLAC, dan lainnya | `ffmpeg` |

- **Format yang dibaca langsung:** WAV (16/24/32-bit, float) dan AIFF (format bawaan Mac). Format lain dibaca lewat [ffmpeg](https://ffmpeg.org) kalau terpasang.
- **Laporan di layar:** kekerasan dan puncak sebelum dan sesudah, seberapa dalam limiter bekerja, dan catatan kalau ada hening panjang di awal atau akhir, atau file mono.
- **Musik yang sangat tenang** bisa berakhir sedikit di bawah −14 LUFS. Itu disengaja, supaya puncaknya tidak ditekan terlalu banyak.
- **Hanya butuh Node.js:** tidak perlu browser, dan tidak perlu `npm install`.
- **Nama file dengan spasi** harus diberi tanda kutip, seperti contoh di atas.

### MIDI: formasi band lengkap untuk setiap genre

File MIDI (tombol **Unduh MIDI**, atau `--midi` di CLI) berisi lebih banyak instrumen daripada yang terdengar di aplikasi. Di DAW, setiap instrumen bisa dipasang ke suara apa pun.

| Genre | Jalur di MIDI |
|---|---|
| **Akustik** | Piano, Gitar, Bass, Drum, **Suling** (membawa melodi di sebagian bagian), **Cello** (harmoni di bagian tengah), **String** (alas lembut), **Perkusi** (shaker, tamborin). Untuk mood Sedih, cello yang membawa melodi, tanpa perkusi. |
| **Lo-fi** | **Electric piano** (Rhodes, menggantikan piano), Gitar, Bass, Drum, **Pad hangat** (synth), **Vibrafon** (arpeggio di bagian tengah). |
| **Pop** | Piano, Gitar, **Bass elektrik**, Drum (ditambah crash di awal bagian baru), **String** (di bagian yang penuh), **Perkusi** (tepuk tangan di ketukan 2 dan 4). |
| **Bossa** | Piano, Gitar nilon, Bass, Drum, **Suling** (membawa melodi, khas bossa), **String** (alas lembut), **Perkusi** (conga, klave). |
| **Jazz** | **Saksofon tenor** (melodi dan solo pertama), **Trompet** (bersama melodi, harmoni di bagian tengah), Piano (iringan, solo kedua), **Gitar jazz**, Bass (walking), **Drum lengkap** (cymbal ride, hi-hat pedal, ghost note, crash, fill). |

- **Melodi tidak dobel:** di bagian yang melodinya dibawa suling, cello, atau saksofon, piano dan gitar tidak ikut memainkan melodi.
- **Nada aman:** semua nada harmoni, pad, dan arpeggio adalah nada akor, dan semuanya di dalam jangkauan alat sungguhan.
- **Siap di DAW:** setiap jalur membawa nomor instrumen General MIDI, volume, dan posisi kiri-kanan. Drum dan perkusi memakai susunan standar General MIDI.
- **String:** kalau String sudah dicentang di aplikasi, jalur String di MIDI adalah yang dari aplikasi. Kalau tidak dicentang, MIDI membuat jalur String sendiri untuk Akustik, Pop, dan Bossa.

### Alur lengkap dengan GarageBand (Mac)

1. Buat lagu di aplikasi lalu tekan **Unduh MIDI**, atau lewat CLI dengan `--midi`. Tambahkan `--stem` kalau ingin memakai sebagian instrumen dari aplikasi.
2. Buka file `.mid` di GarageBand. Setiap instrumen jadi satu jalur, dan temponya ikut terbaca.
3. Ganti instrumen di jalur yang ingin diperbagus, misalnya piano. Jangan pakai quantize, karena pergeseran waktu kecil dan swing-nya memang disengaja.
4. **Bagikan > Ekspor Lagu ke Disk**, lalu pilih WAV atau AIFF dengan kualitas tertinggi.
5. Jalankan `node cli/music-maker.js master "lagu.wav"`. File `lagu-master.wav` siap diunggah.

Sebelum menjual, periksa lisensi setiap instrumen yang dipakai di DAW. Sebagian besar instrumen gratis boleh dipakai untuk musik komersial, tapi aturannya berbeda-beda.

### Cek kemiripan otomatis

Setiap lagu yang dibuat (`buat` dan setiap lagu `rangkaian`) dicatat sidik melodinya di **katalog** (`~/.music-maker/katalog.json`, atau `--katalog <file>`): urutan interval melodi dalam kelompok 6 interval (tidak tergantung nada dasar), progresi akor, nada dasar, gaya. Lagu baru dibandingkan dengan **seluruh** katalog (kemiripan Jaccard). Kalau lebih dari **0,35** (`--batas-mirip`), lagu otomatis ditulis ulang dengan seed turunan (tercatat di layar), sebelum audio dibuat. Kalibrasi: 48 lagu (12 seed × 4 kombinasi) memberi kemiripan median 0,006, 95% di bawah 0,08, paling tinggi 0,15 antar lagu berbeda; seed sama di mood berbeda memberi 1,0 (melodi sama) dan langsung tertangkap. `--tanpa-cek-mirip` mematikan cek, `--reset-katalog` mengosongkan katalog (salinan lama disimpan sebagai `.lama`).

### Render studio (`--render studio`)

**Bawaan sejak 2026-11-27 bila alatnya terpasang** (di VPS sudah); kalau belum, CLI otomatis memakai suara aplikasi dan menyebut apa yang kurang. `--render app` memaksa suara aplikasi. Tanpa DAW/GarageBand: piano, string dan bass dirender di luar browser dengan bahan berkualitas tinggi, lalu digabung dengan gitar dan drum dari aplikasi.

```bash
node cli/music-maker.js buat --mood Sedih --genre Akustik --durasi 180 --instrumen Piano,String,Bass --melodi piano \
  --render studio --python /home/ubuntu/studio/venv/bin/python
# tanpa kredit (piano CC0):
node cli/music-maker.js buat ... --render studio --piano kw
# rangkaian juga bisa (per lagu, bisa dilanjutkan):
node cli/music-maker.js rangkaian --menit 60 --campur Sedih/Akustik,Melankolis/Akustik --instrumen Piano,String,Bass --melodi piano --render studio --mp3
```

- **Piano**: FluidSynth + *Salamander Grand Piano V3* (bawaan, kualitas terbaik) dengan kalibrasi kekerasan per tuts (`studio/piano_cal_salamander.json`) dan pedal sustain legato (CC64), atau `--piano kw` (*Upright Piano KW*, CC0).
- **String**: sampler sendiri di atas VSCO-2 Community Edition (CC0) dengan legato tersimulasi; kontra-melodi cello dengan portamento.
- **Bass**: `--bass-studio busur` (contrabass digesek VSCO-2, lembut dan dalam; bawaan untuk Sedih/Melankolis kecuali Bossa) atau `petik` (bass petik aplikasi).
- **Gitar, drum** (dan bass petik, desis vinyl lo-fi): dari aplikasi, dengan keseimbangan aplikasi.
- **Mix**: keseimbangan antarinstrumen mengikuti aplikasi, EQ untuk kejernihan (lumpur 200–400 Hz dikurangi, presence ~3 kHz dan *air* lembut, tanpa menaikkan 5–8 kHz), bass empuk (sub 45–60 Hz ditebalkan, 130 Hz dan 250 Hz dikurangi, low-pass 1,2 kHz, saturasi halus, kompresi pelan), bass mono di bawah 120 Hz (aman di ponsel dan headset), hall sintetis, kompresi perekat, master ke −14 LUFS dengan limiter true-peak −1,35 dBTP. Laporan spektrum per lagu di `<nama>-studio.json`; untuk file apa pun: `python studio/cek_spektrum.py file.mp3`.
- **Kebutuhan**: Python 3 dengan `numpy scipy soundfile mido pyloudnorm pedalboard numba`, `fluidsynth`, `ffmpeg`, dan folder bahan (`--aset-studio`, bawaan `/home/ubuntu/studio`) berisi `sf/SalamanderGrandPiano-SF2-V3+20200602/…sf2`, `sf/UprightPianoKW-SF2-20220221/…sf2`, `vsco/Strings/…` (VSCO-2 CE). Memori sekitar 1,3 GB per lagu 3 menit.

**Kredit wajib untuk Salamander** (CC BY 3.0; ditulis otomatis ke `<nama>-kredit.txt`, `.json`, dan daftar lagu rangkaian):

> Piano: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)

Bahan lain tidak butuh kredit: Upright Piano KW (CC0), VSCO-2 CE (CC0), dan rekaman aplikasi (CC0, lihat `samples/RECORDINGS.txt`). Hall-nya sintetis (dibuat dari noise), bukan rekaman ruangan, jadi tanpa lisensi tambahan.

## Cara pakai di Mac sendiri (Muse Sounds)

Mode ini **menyusun lagu sendiri** (mesin `komposer/`, untuk mood **Sedih** dan **Melankolis**), menulis partitur
**MusicXML** lengkap dengan tempo, dinamika, pedal, dan legato, lalu memainkannya dengan **Muse Sounds** lewat
MuseScore Studio 4 di Mac Anda sendiri, kemudian mastering ke −14 LUFS dan menyimpan MP3. Semua berjalan di Mac
Anda; tidak perlu komputer lain.

**Isi lagu**: motif pendek yang dikembangkan (diulang, dinaikkan, dijawab), frasa tanya–jawab, desahan (nada
turun setengah/satu langkah), apogiatura dan suspensi 4-3 / 9-8, kadens tipuan (V→VI), akor Neapolitan di
klimaks, bas ratapan (turun kromatis) saat tema kembali, satu klimaks yang jelas, dan ritardando di akhir.
Tiap lagu berbeda birama (4/4, 3/4, 6/8), tempo, kunci, alat utama (piano / piano + string / cello), dan intro.
Lagu baru dibandingkan dengan katalog lagu sebelumnya supaya tidak mirip (`~/.music-maker/katalog-komposer.json`).

### Pasang (sekali saja)

1. Pasang **Muse Hub** (dari musescore.org), login, lalu dari Muse Hub pasang **MuseScore Studio 4** dan
   **Muse Sounds** (minimal *Muse Keys* dan *Muse Strings*). Buka MuseScore sekali.
   Lakukan di **akun Mac yang sama** dengan yang dipakai menjalankan perintah di bawah — lisensi Muse Sounds
   terikat pada akun Muse Hub di akun Mac itu.
2. Di Terminal, di folder music-maker:
   ```
   bash pasang-mac.sh
   ```
   Ini memasang Python 3.12, music21, mido, numpy, dan ffmpeg ke folder `.env-mac/` di dalam repo
   (tanpa admin, tanpa Homebrew; sekitar 700 MB; hapus kapan saja dengan `rm -rf .env-mac .mamba`).
   Butuh internet saat pemasangan saja.

### Satu lagu

```
./music-maker-mac buat --mood Sedih --render musesounds --keluar ~/Music/music-maker
```

Hasil: `.mp3` (siap pakai), `.musicxml` (bisa dibuka dan diedit di MuseScore), `.mid`, dan `.json`
(rencana lagu + hasil cek). Tambahkan `--seed 12` untuk lagu tertentu (seed yang sama = lagu yang sama),
atau pilih sendiri: `--lead cello`, `--birama 3/4`, `--kunci D`, `--tempo 52`, `--mood Melankolis`.

### Satu jam

```
./music-maker-mac rangkaian --mood Sedih --menit 60 --render musesounds --keluar ~/Music/music-maker/sedih-1jam
```

Sekitar 18–20 lagu berbeda, digabung dengan jeda hening 3 detik, mastering −14 LUFS, plus
`*-daftar-lagu.txt` (bab/waktu untuk deskripsi YouTube). Kalau terhenti, jalankan perintah yang sama lagi:
lagu yang sudah selesai tidak dibuat ulang. `--rencana` menampilkan rencana variasi tanpa membuat apa pun;
`--seed-awal 200` memberi rangkaian lain.

Perintah yang sama juga bisa lewat CLI utama: `node cli/music-maker.js buat --mood Sedih --render musesounds`.

### Pemeriksaan otomatis

- **Partitur**: MusicXML dibaca ulang; jumlah not, birama, tempo, pedal, dan dinamika harus cocok dengan komposisi.
- **Lisensi Muse Sounds**: kalau MuseScore tidak bisa memuat Muse Sounds (misalnya akun Mac lain atau belum login
  Muse Hub) ia diam-diam memakai suara dasar. music-maker mendeteksinya dari log MuseScore, **berhenti dengan
  pesan jelas**, dan tidak menyimpan hasil bersuara dasar.
- **Audio**: −14 LUFS, true peak ≤ −1 dBTP, kompresi halus (rasio 2:1) supaya dinamika musik tetap terasa,
  lalu cek jeda hening dan klik. Ringkasan tercetak di akhir, misalnya
  `Judul: 3:39 | -14.0 LUFS | LRA 15.6->10.1 | puncak -2.3 dBTP | cek: bersih`.

Lisensi: musik yang dibuat dengan Muse Sounds boleh dimonetisasi (termasuk YouTube) tanpa kredit; rekaman
suara Muse Sounds sendiri tidak boleh dibagikan terpisah, dan lisensinya pribadi untuk pemilik akun Muse Hub.

## Kualitas suara

- **Dinamika per frasa**: melodi mengeras menuju tengah frasa lalu melembut, nada tinggi sedikit ditekankan, dan bagian penuh lebih bertenaga daripada bagian tenang, seperti dimainkan orang.
- **Mixing**: setiap instrumen dibersihkan dan diberi ruang sendiri (EQ), bass dikompres supaya rata, dan seluruh lagu direkatkan dengan kompresi halus. Keseimbangan antarinstrumen sudah diatur lewat uji dengar.
- **Gema ruangan** dan **posisi kiri-kanan** (piano sedikit ke kiri, gitar sedikit ke kanan) supaya instrumen terdengar menyatu.
- **Mastering** untuk file WAV: kekerasan suara dibawa mendekati **−14 LUFS** (acuan YouTube) dengan limiter yang menjaga puncak di bawah −1 dB. Supaya denting piano tidak gepeng, penekanan dibatasi, jadi lagu yang sangat tenang bisa berakhir sekitar −15 sampai −17 LUFS.

## Lisensi rekaman suara

Semua rekaman instrumen di `samples.js` bebas dipakai untuk komersial (CC0). Sumber tiap rekaman tercatat di `samples/RECORDINGS.txt`. Melodi kit ditulis sendiri untuk proyek ini, dan korale Bach sudah menjadi domain publik.

Sebelum mengunggah ke YouTube, periksa juga kebijakan monetisasi terbaru, terutama tentang konten yang diproduksi massal atau berulang.

## Struktur proyek

| File | Isi |
|---|---|
| `index.html` | tampilan aplikasi web |
| `studio.js` | mesin musik: komposisi, kit, gaya, bentuk lagu, pola instrumen, mix, dan mastering |
| `studio/cek-komposisi.js`, `studio/cek_audio.py` | alat ukur: angka komposisi per mood × genre, dan cek audio (LUFS, LRA, klik, tumpang-tindih MIDI) |
| `studio/render_studio.py`, `studio/piano_cal_salamander.json` | render studio (`--render studio`): piano FluidSynth terkalibrasi, string legato VSCO-2, mix dan master |
| `studio/cek-aransemen.js`, `studio/cek_spektrum.py`, `studio/cek_rangkaian.py` | alat ukur: perkembangan aransemen per bagian, keseimbangan spektrum, cek rangkaian panjang |
| `classics.js` | 24 korale J.S. Bach |
| `samples.js` | rekaman instrumen (CC0), ditanam sebagai base64: piano, gitar nilon, kontrabas, drum (kick, snare, rim, shaker, hi-hat), dan string |
| `cli/music-maker.js` | versi baris perintah |
| `komposer/` | penyusun lagu Sedih/Melankolis + ekspor MusicXML + render Muse Sounds dan mastering (`--render musesounds`) |
| `pasang-mac.sh`, `music-maker-mac` | pemasangan tanpa admin dan perintah untuk mode Muse Sounds di Mac |
| `cli/mastering.js` | mastering untuk perintah `master` (baca WAV/AIFF, LUFS, limiter, true peak, tulis WAV) |
| `PLAN.md` | keadaan sekarang, riwayat keputusan, dan rencana berikutnya |
