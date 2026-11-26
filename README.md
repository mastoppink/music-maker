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
   - **Volume** dan **Bisukan**.
   - **Buat ulang**: pindah ke variasi lain dari pola itu. Instrumen lain tidak berubah.
5. Tekan **Unduh WAV** untuk menyimpan hasilnya.
6. Tekan **Unduh MIDI** untuk menyimpan not lagu (satu jalur per instrumen) yang bisa dibuka di program musik seperti FL Studio, Ableton, atau GarageBand.
7. Tekan **Simpan proyek** untuk menyimpan pengaturan lagu (`.json`). Dengan **Buka proyek**, lagu itu bisa dibuat persis sama lagi, termasuk pola, variasi, volume, dan instrumen yang dibisukan. Format file proyeknya sama dengan CLI, jadi proyek dari aplikasi bisa dipakai di CLI (`--dari`) dan sebaliknya.

### Instrumen

Piano, Gitar, Bass, dan Drum tercentang secara bawaan. **String** (biola, viola, dan cello yang menahan akor dengan lembut) bisa ditambahkan dengan mencentangnya, atau di CLI dengan `--instrumen Piano,Gitar,Bass,Drum,String`.

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

### Bentuk lagu

Lagu 3 menit ke atas punya bagian-bagian: pembuka, melodi utama, bagian tengah yang lebih penuh, melodi kedua (di Jazz: solo piano), bagian jeda yang tipis, lalu penutup. Pola iringan berganti antarbagian, drum sesekali istirahat, dan nada dasar naik setelah bagian jeda, supaya lagu panjang tidak monoton.

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
node cli/music-maker.js rangkaian [opsi]  # sambung banyak lagu menjadi satu file 30–60 menit
node cli/music-maker.js master <file...>  # atur volume file audio (misalnya hasil DAW) ke standar YouTube
node cli/music-maker.js daftar         # tampilkan mood, genre, gaya, dan pola yang tersedia
node cli/music-maker.js bantuan        # tampilkan semua opsi
```

### Rangkaian panjang (30–60 menit)

```bash
node cli/music-maker.js rangkaian --genre Lo-fi --menit 60
```

Menyambung banyak lagu berbeda (seed berurutan) menjadi satu WAV panjang. Setiap lagu di-master sendiri supaya kerasnya rata, lalu ekornya menyatu dengan awal lagu berikutnya. Opsi tambahan:

| Opsi | Arti | Bawaan |
|---|---|---|
| `--menit` | panjang rangkaian | 30 |
| `--durasi-lagu` | panjang tiap lagu dalam detik | 180 |
| `--jeda` | lama peralihan antarlagu dalam detik | 2 |

Opsi `buat` lainnya (mood, genre, gaya, pola, dan sebagainya) berlaku untuk setiap lagu. Selain WAV, rangkaian menyimpan:

- `.txt`: daftar lagu dengan waktu mulai, dalam format bab YouTube. Tempel langsung ke deskripsi video.
- `.json`: pengaturan dan seed setiap lagu.

Rangkaian 60 menit butuh beberapa menit untuk dibuat, dan WAV-nya sekitar 600 MB. Karena ukurannya, rangkaian hanya tersedia di CLI, tidak di aplikasi web.

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
| `--midi` | simpan juga file MIDI | |
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
- `tenang-akustik-kit-seed123.json`: pengaturan lengkap, termasuk gaya, pola, variasi, nama melodi (`melodi_kit`), dan takaran dinamika yang dipakai. Simpan file ini untuk lagu yang ingin dibuat ulang. Karena nama melodinya tersimpan, lagu tetap sama walaupun nanti ada melodi baru yang ditambahkan.

Catatan: file proyek yang dibuat sebelum 26 November 2026 belum menyimpan nama melodi, jadi bisa menghasilkan melodi yang berbeda.

Dengan opsi tambahan:

- `--midi`: `….mid`, not lagu per instrumen untuk program musik (DAW).
- `--stem`: `…-stem-piano.wav`, `…-stem-gitar.wav`, dan seterusnya. Kerasnya dan gerak limiternya sama dengan mix lengkap, jadi kalau digabung hasilnya sama dengan lagunya. Desis piringan hitam Lo-fi tidak ikut.
- `--video gambar.jpg`: `….mp4` 1920×1080 berisi gambar diam dan musiknya, siap diunggah ke YouTube. Butuh [ffmpeg](https://ffmpeg.org). Juga berlaku untuk `rangkaian`.

```bash
node cli/music-maker.js buat --genre Lo-fi --durasi 180 --midi --stem --video sampul.jpg
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

### Alur lengkap dengan GarageBand (Mac)

1. Buat lagu di aplikasi lalu tekan **Unduh MIDI**, atau lewat CLI dengan `--midi`. Tambahkan `--stem` kalau ingin memakai sebagian instrumen dari aplikasi.
2. Buka file `.mid` di GarageBand. Setiap instrumen jadi satu jalur, dan temponya ikut terbaca.
3. Ganti instrumen di jalur yang ingin diperbagus, misalnya piano. Jangan pakai quantize, karena pergeseran waktu kecil dan swing-nya memang disengaja.
4. **Bagikan > Ekspor Lagu ke Disk**, lalu pilih WAV atau AIFF dengan kualitas tertinggi.
5. Jalankan `node cli/music-maker.js master "lagu.wav"`. File `lagu-master.wav` siap diunggah.

Sebelum menjual, periksa lisensi setiap instrumen yang dipakai di DAW. Sebagian besar instrumen gratis boleh dipakai untuk musik komersial, tapi aturannya berbeda-beda.

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
| `studio.js` | mesin musik: kit, gaya, bentuk lagu, pola instrumen, mix, dan mastering |
| `classics.js` | 24 korale J.S. Bach |
| `samples.js` | rekaman instrumen (CC0), ditanam sebagai base64: piano, gitar nilon, kontrabas, drum (kick, snare, rim, shaker, hi-hat), dan string |
| `cli/music-maker.js` | versi baris perintah |
| `cli/mastering.js` | mastering untuk perintah `master` (baca WAV/AIFF, LUFS, limiter, true peak, tulis WAV) |
| `PLAN.md` | keadaan sekarang, riwayat keputusan, dan rencana berikutnya |
