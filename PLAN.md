# Rencana pengembangan Music Maker

## Tujuan

Aplikasi untuk membuat musik instrumental dengan memilih **mood** dan **genre**. Setelah lagu jadi, pengguna bisa mengendalikan **setiap instrumen**: membuat ulang bagiannya saja, atau mengatur cara instrumen itu bermain. **Tujuan akhirnya: hasilnya dijual (dimonetisasi) di YouTube.**

Cara kerja dengan pengguna: pengguna tidak membaca not dan tidak menilai nada. Semua keputusan nada datang dari bahan tulisan tangan (kit) dan aturan yang diuji otomatis. Pengguna menilai hanya dengan mendengar: memilih A atau B, atau menyebut "detik ke-X terasa aneh". Penyebabnya diukur lalu diperbaiki, dan hasilnya dibandingkan sebelum dan sesudah.

### Syarat karena hasilnya dijual

- **Semua rekaman suara wajib bebas dipakai untuk komersial** (CC0 atau setara), dengan sumber tercatat di `samples/RECORDINGS.txt`.
- **Komposisi harus orisinal atau domain publik.** Kit ditulis sendiri. Korale Bach sudah domain publik.
- **Kualitas siap unggah**: WAV 44,1 kHz, volume akhir setara musik YouTube lain, tanpa klik dan tanpa nada terpotong.
- **Durasi yang dibutuhkan YouTube**: lagu 2–5 menit, dan rangkaian panjang (30–60 menit) untuk video "musik santai".
- **Video**: YouTube butuh file video, minimal gambar diam ditambah audio.
- **Kebijakan monetisasi YouTube**: konten yang diproduksi massal atau berulang bisa ditolak untuk monetisasi ("inauthentic/repetitive content"). Setiap lagu harus cukup berbeda, dan video perlu sentuhan pribadi (judul, gambar, susunan). Aturan persisnya perlu dicek lagi menjelang unggah, karena YouTube sering mengubahnya.

## Keadaan sekarang (2026-11-26)

- **Mood dan genre**:
  - Semua kombinasi genre (Akustik, Lo-fi, Pop) dan mood (Tenang, Ceria, Melankolis) memakai mesin kit dan gaya. Mesin lama hanya tersisa di kode.
- **Lo-fi** (gaya Belajar, Malam, Kopi pagi): swing dari `onset`, piano `jazz` (akor septim, digulung, tanpa root bila ada bass), drum `lofi` (boom-bap), master low-pass dan high-pass 45 Hz, goyang nada seperti kaset, desis piringan hitam (`crackleBuffer`). Kekuatan efek di `lofi`. Pengguna: "semua bagus, tapi efek rusaknya perlu diperhalus supaya tetap enak didengarkan lama", jadi diperhalus: desis 22 → 31 dB di bawah musik, kretek 4 → 2 per detik, goyang ±7 → ±3 sen, low-pass 4,2 → 6,5 kHz. Uji: 240 lagu, 150.115 nada iringan, 0 di luar akor septim.
- **Sumber lagu** (pilihan "Sumber" di UI):
  - *Kit orisinal* (pilihan pengguna): 12 kit empat birama di `studio.js` (`kits`), terdiri dari 8 kit utama ("a") dan 4 kit kontras ("b"). `planSong` merangkai kit utama, bagian kontras, lalu kit utama lagi, dan menutup lagu.
  - *Klasik (Bach)*: 24 korale di `classics.js`. Pengguna mencoba keduanya dan menilai "lumayan bagus", jadi keduanya dipertahankan.
- **Gaya lagu** (`styles`): setiap lagu memilih satu gaya yang menentukan irama melodi (`applyFeel`: asli / panjang / rapat), gitar (petik / genjreng), piano (blok / pecah), drum (lembut / tipis / jalan), dan tempo. Penutupnya dua macam (kadens V–I, atau bar kit lalu tonika), dengan atau tanpa melambat. Tempo gaya dipertahankan, jadi panjang lagu bisa bergeser beberapa detik.
  - Tenang: Santai (bobot 3, favorit pengguna), Mengalir, Teduh, Sederhana.
  - Ceria: Jalan pagi, Ringan. Jalan pagi paling tidak disukai untuk lagu tenang, jadi dipindah ke Ceria.
- **Melodi** (pilihan di UI): "Gantian piano & gitar" atau "Piano saja". Pengguna suka keduanya.
- **Sampel**: semuanya CC0. Kick drum dipastikan CC0 oleh pengguna, yang mencarinya sendiri (tautan sumber belum dicatat). Lihat `samples/RECORDINGS.txt`.
- **Kontrol per instrumen** (lagu kit): di setiap baris ada pilihan **Pola** (`partOptions`, disimpan di `song.parts`), volume, bisukan, dan **Buat ulang**. Buat ulang berpindah ke variasi berikutnya dari pola itu (`variationCount`), dan nomor variasinya tampil di pesan status. Mengubah satu instrumen hanya membangun ulang instrumen itu (`refresh`).
  - Gitar: Petik (3 variasi: pola asli, naik-turun, jempol bergantian), Genjreng (2 irama).
  - Piano: Akor (3: tahan, diulang di ketukan 1 dan 3, sinkop), Akor dipecah (3 bentuk). Pilihan dinonaktifkan kalau piano membawa melodi sepanjang lagu.
  - Bass: Panjang, Dua nada (dasar dan kelima). Variasi 2 menambah nada oktaf pengantar.
  - Drum: Lembut, Tipis, Berjalan (masing-masing 2 variasi).
  - Uji: 51.314 nada iringan dari semua pola dan variasi, 0 nada di luar akor. Volume antar pola setara (selisih maksimal ±2 dB).
- **A/B**: setiap "Buat musik" menghasilkan dua versi.
- **Bentuk lagu** (`songForm`, `formCycle`): setiap frasa mendapat bagian dan tingkat energi (0 tanpa bass/drum, 1 normal, 2 lebih penuh).
  - Urutan: pembuka (hanya iringan, untuk lagu ≥6 frasa) → A → Av (irama melodi diubah, `otherFeel`) → B → Av → C/Cv (melodi kedua) → B2 → A → jeda (tipis) → … → penutup.
  - Lagu pendek tetap berbentuk A Av B Av.
  - Melodi bergantian piano/gitar per kemunculan melodi (`turn`), bukan per frasa.
- **Variasi lagu panjang** (pengguna: "kurang variasi, sedikit membosankan"; dulu drum, bass, dan iringan sama persis di semua bagian, nada dasar tidak berubah):
  - Variasi pola berganti per bagian (`sectionShift`), dan gitar beralih petik/genjreng di bagian tengah.
  - Drum istirahat di C (`rest`).
  - Nada dasar naik satu nada penuh setelah bagian jeda (`shift`, `keyAt`; lagu ≥10 frasa).
  - Melodi piano naik satu oktav di Cv dan Av setelah naik nada (`high`, jika tetap di bawah C7).
  - Klasik: setiap pengulangan korale, gitar membawa melodi dan piano mengiringi.
  - Uji: 103.184 nada iringan dan 1.200 melodi, 0 nada di luar akor. Volume per bagian berubah paling banyak 2 dB.
- **Durasi**: 30 detik, 1, 2, 3, dan 5 menit. Klasik panjang menyambung beberapa korale (masing-masing dua kali) dengan tempo tetap 71 BPM; korale terakhir dipilih yang paling pas dengan sisa waktu.
- **Kecepatan**: nada dijadwalkan bertahap (`pump` saat diputar, `audio.suspend` saat render), dan nada yang selesai dilepas. Render 5 menit turun dari 112–140 detik menjadi sekitar 16 detik, dengan hasil suara identik (selisih −77 dB).
- **Pop** (gaya Cerah, Lari pagi untuk Ceria; Balada, Hangat untuk Tenang): piano `pulsa` (akor tiap ketukan), bass `delapan` (berdenyut per seperdelapan), drum `pop` (kick 1 dan 3, snare 2 dan 4, hi-hat rapat) dan `balada` (snare di ketukan 3). Uji: 160 lagu, 151.896 nada iringan, 0 di luar akor. Belum didengar pengguna.
- **Melankolis** (gaya Sendu, Kenangan untuk Akustik; Gerimis untuk Lo-fi; Patah hati untuk Pop): 6 kit minor tulis tangan (Sepi, Kenang, Rintik, Pulang; Malam Panjang, Lirih), tangga nada minor alami (`minorSteps`), bentuk akor gitar minor dari A (`minorGrips`, `capoAt`), nada dasar 57/59/60/62. Uji: 240 lagu, 85.480 nada iringan, 0 di luar akor. Belum didengar pengguna.
- **Proyek** (`projectOf`, `songFromProject`, tombol Simpan/Buka proyek): format `.json` yang sama dengan CLI. CLI memakai `songFromProject` yang sama. Uji bolak-balik: simpan, buka di halaman baru, lagu identik; WAV aplikasi dan CLI dari proyek yang sama selisih paling besar 2 LSB.
  - Perbaikan bug saat uji ini: memaksa gaya dulu menggeser urutan acak (tempo, penutup). Sekarang `pickStyle` selalu diambil. Lagu lama yang dibuat dengan `--gaya`/`force.style` bisa sedikit berbeda kalau dibuat ulang.
- **Siap unggah**: MIDI (`midiFile`, aplikasi dan CLI `--midi`; format 1, 480 tick, waktu mengikuti swing dan ritardando), stem (CLI `--stem`; memakai gain dan kurva limiter mix lengkap sehingga jumlah stem = mix, selisih −73 dB; tanpa desis vinyl), video (CLI `--video`, ffmpeg, 1920×1080, 2 fps gambar diam, AAC 320k; juga untuk rangkaian).
- **Jazz** (gaya Kafe malam untuk Tenang, Swing untuk Ceria, Biru untuk Melankolis): swing triplet (`onset`, +0,3 langkah), bass `jalan` (walking: nada akor di ketukan 1–3, nada pengantar ke root berikutnya di ketukan 4, ditandai `approach`), piano `jazz`, drum `jazz` (pola ride, kick lembut, cross-stick di variasi 2). Ketukan cymbal kini memakai hi-hat drum set (lihat di bawah).
- **String** (instrumen baru, tidak dicentang secara bawaan): seksi cello/viola/biola VSCO 2 CE, 16 rekaman, nada diukur per file (`stringCents`). Pola `panjang` (akor ditahan mengikuti harmoni, disambung bila akor sama; energi 0: cello+viola pelan, energi 2: biola tinggi ikut) dan `tinggi`. Serangan lembut 0,4 detik, lepas 0,9 detik. Di Klasik memegang alto dan tenor. Level sekitar 7–8 dB di bawah melodi.
- Uji: 162 lagu semua genre dan mood dengan String, 113.033 nada iringan + 3.146 nada pengantar walking bass, 0 di luar akor.
- **Perbaikan drum** (pengguna: cymbal jazz "dipukul pelan-pelan … ragu dia pas"): ukuran puncak menunjukkan snare, hi-hat, rim, dan ride 25–35 dB di bawah kick di semua genre, karena kick direkam hampir full scale sedangkan rekaman VSCO jauh lebih lirih, dan pilihan lapisan drum dulu bergiliran ke semua lapisan bila lapisan yang diminta tidak ada. Sekarang: lapisan terdekat (`pickSample`), puncak tiap bunyi disetarakan (`sample.lift`), lalu `drumBalance` (snare −6, rim −8..−11, ride −10, hi-hat −12..−17 dB dari kick). Ride dibuat ulang dengan dengung alami (−40 dB setelah 1,1–1,3 detik, dulu 0,4–0,5). Volume drum keseluruhan hampir sama (kick dominan). Uji buta: Lagu 1 (Jazz) B = baru, Lagu 2 (Pop) A = baru.
- **Jazz tanpa cymbal orkestra** (pengguna: "simbalnya jelas tidak pas"): cymbal gantung VSCO dibuang. Penggantinya hi-hat drum set VCSL (CC0): `hhl` setengah terbuka di ketukan 1 dan 3 (dipotong saat hi-hat menutup), `hhc` tertutup ditekan di 2 dan 4, ketukan ayun pelan; lapisan sendiri (`drumSteps`); VCSL juga tidak punya ride. Pengguna: "hi-hat sudah pas suaranya, tetapi volumenya terlalu dominan"; dari tiga takaran dipilih turun 8 dB (`drumBalance` hhc −6, hhl −5), sekitar 18–20 dB di bawah kick.
- **Rangkaian** (CLI `rangkaian`): lagu berseed berurutan, di-master satu per satu, disambung dengan tumpang-tindih `--jeda` (bawaan 2 detik), ditulis langsung ke disk. Juga menyimpan daftar bab YouTube (.txt) dan .json. Hanya diuji singkat (1 menit); pengguna minta rangkaian 60 menit tidak dicoba dulu.
- **Mix dan mastering**:
  - Gema ruangan buatan (`roomImpulse`, sekitar 2 detik, ber-seed sehingga hasilnya selalu sama), dikirim per instrumen (`placement.room`).
  - Posisi kiri-kanan (`placement.pan`): piano −0,22, gitar +0,26, bass dan drum di tengah.
  - Volume diukur dalam LUFS (`loudness`, ITU-R BS.1770, cocok dengan ffmpeg ±0,2 dB).
  - Ekspor WAV melewati `master`: gain menuju −14 LUFS dan limiter look-ahead (`limit`, batas −1,5 dBFS, true peak sekitar −1,3). Penekanan puncak dibatasi 6 dB (`maxSquashDb`), jadi lagu yang sangat tenang bisa berakhir −15 sampai −17 LUFS.
  - Putar di aplikasi memakai gain aman tanpa limiter.
- **Ekspor**: WAV stereo 44,1 kHz.
- **CLI** (`cli/music-maker.js`, panduan di `README.md`): menjalankan `index.html` di Edge/Chrome tanpa jendela (playwright-core), lalu menyimpan WAV yang sudah di-master plus `.json` pengaturan. Perintah: `buat` (semua opsi aplikasi, `--versi` untuk banyak lagu, `--dari` untuk membuat ulang dari `.json`), `daftar`, dan `bantuan`. Hasil `--dari` sama dengan aslinya (selisih paling besar 1 LSB).
- **Uji otomatis**: 600 lagu per mood, 0 nada melodi di ketukan kuat yang bukan nada akor.

### Perbaikan suara yang sudah lolos dengar

- Keseimbangan volume (`trackTrim`, `gitarMelodyBoost`). Dulu drum menenggelamkan melodi ("semuanya rusak saat drum masuk").
- Gitar memakai petikan sedang dan kuat, dengan volume dinormalkan per rekaman (`guitarPeak`). Dulu terdengar "gripnya kurang kuat".
- Ekor nada: gitar memudar 0,3 detik, piano memakai pedal, bass menyambung, dan ada ekor 3 detik di akhir lagu. Dulu nada "dipaksa mati".
- Melodi gitar di fret rendah, senar atas. Dulu terdengar "seperti orang belajar main gitar".
- Karakter gitar tetap satu: melodi memakai lapisan yang sama dengan iringan, ditambah nada jempol, dan senar bawah tidak dilepas saat bass masuk. Dulu "tidak nyambung karakter suaranya".

- Lo-fi: tiga contoh pertama dinilai "semua bagus". Efek diperhalus menang uji buta di kedua lagu (Belajar, Kopi pagi), dengan volume disamakan.
- Gema ruangan dan kiri-kanan: uji buta dengan volume disamakan. Pengguna memilih versi baru di kedua lagu (Kit dan Klasik).

### Yang ditolak lewat dengar

- Nada antar bass, dan bass yang masuk di ketukan pertama, pada etude piano lama.
- Melodi yang disusun otomatis dengan aturan. Diganti kit tulis tangan.
- Pemilihan 12 kit lewat A/B: semuanya terdengar mirip karena hanya melodi yang berbeda. Diganti gaya lagu.

## Menunggu dengar

- Variasi lagu panjang: pengguna mendengar ulang sampai akhir; versi bervariasi (1 A / 2 B) punya variasi di akhir. Semua variasi menyala (bisa dimatikan per jenis lewat `song.vary`).

## Berikutnya (urut prioritas)

1. **Dengar Jazz dan String** (uji buta String: Lagu 1 A = dengan string, Lagu 2 B = dengan string), plus Pop dan Melankolis yang belum dinilai.
2. **Coba rangkaian 60 menit** di komputer pengguna.
3. Ide: lebih banyak kit melodi; gambar sampul otomatis untuk video.
