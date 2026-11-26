# Music Maker

Generator musik instrumental. Pilih **mood** dan **genre**, lalu atur atau buat ulang **setiap instrumen** (piano, gitar, bass, drum). Hasilnya berupa file WAV yang siap diunggah ke YouTube.

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
6. Tekan **Simpan proyek** untuk menyimpan pengaturan lagu (`.json`). Dengan **Buka proyek**, lagu itu bisa dibuat persis sama lagi, termasuk pola, variasi, volume, dan instrumen yang dibisukan. Format file proyeknya sama dengan CLI, jadi proyek dari aplikasi bisa dipakai di CLI (`--dari`) dan sebaliknya.

### Pilihan

| Pilihan | Nilai |
|---|---|
| Mood | Tenang, Ceria, Melankolis |
| Genre | Akustik, Lo-fi, Pop |
| Sumber | **Kit orisinal**: melodi tulisan tangan · **Klasik**: korale J.S. Bach (domain publik) |
| Melodi | Gantian piano & gitar, atau Piano saja |
| Durasi | 30 detik, 1, 2, 3, 5 menit |

Gaya lagu, bentuk lagu (pembuka, melodi utama, bagian tengah, jeda, penutup), dan pola per instrumen saat ini berlaku penuh untuk **Kit orisinal** untuk semua genre (**Akustik**, **Lo-fi**, **Pop**) dan semua mood (**Tenang**, **Ceria**, **Melankolis**). Melankolis memakai melodi bernada minor yang ditulis khusus. Pop punya drum pop atau balada, bass berdenyut, dan akor piano berdenyut. Lo-fi punya ketukan diayun, akor piano jazz, drum boom-bap, suara hangat dengan goyang kaset, dan desis piringan hitam. 

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
| `--mood` | Tenang, Ceria, Melankolis | Tenang |
| `--genre` | Akustik, Lo-fi, Pop | Akustik |
| `--sumber` | `kit` atau `klasik` | kit |
| `--durasi` | panjang lagu dalam detik (10–900) | 60 |
| `--instrumen` | daftar instrumen, dipisah koma | Piano,Gitar,Bass,Drum |
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
- `tenang-akustik-kit-seed123.json`: pengaturan lengkap, termasuk gaya, pola, dan variasi yang dipakai. Simpan file ini untuk lagu yang ingin dibuat ulang.

Di layar, CLI menampilkan deskripsi lagu, durasi, kekerasan suara (LUFS), dan puncak suara.

## Kualitas suara

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
| `samples.js` | rekaman instrumen (CC0), ditanam sebagai base64 |
| `cli/music-maker.js` | versi baris perintah |
| `PLAN.md` | keadaan sekarang, riwayat keputusan, dan rencana berikutnya |
