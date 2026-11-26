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
  - Akustik · Tenang dan Akustik · Ceria memakai mesin kit dan gaya (lengkap).
  - Mood Melankolis dan genre Lo-fi dan Pop masih memakai mesin lama yang sederhana.
- **Sumber lagu** (pilihan "Sumber" di UI):
  - *Kit orisinal* (pilihan pengguna): 12 kit empat birama di `studio.js` (`kits`), terdiri dari 8 kit utama ("a") dan 4 kit kontras ("b"). `planSong` merangkai kit utama, bagian kontras, lalu kit utama lagi, dan menutup lagu.
  - *Klasik (Bach)*: 24 korale di `classics.js`. Pengguna lebih memilih Kit, jadi kandidat dihapus.
- **Gaya lagu** (`styles`): setiap lagu memilih satu gaya yang menentukan irama melodi (`applyFeel`: asli / panjang / rapat), gitar (petik / genjreng), piano (blok / pecah), drum (lembut / tipis / jalan), dan tempo. Penutupnya dua macam (kadens V–I, atau bar kit lalu tonika), dengan atau tanpa melambat. Tempo gaya dipertahankan, jadi panjang lagu bisa bergeser beberapa detik.
  - Tenang: Santai (bobot 3, favorit pengguna), Mengalir, Teduh, Sederhana.
  - Ceria: Jalan pagi, Ringan. Jalan pagi paling tidak disukai untuk lagu tenang, jadi dipindah ke Ceria.
- **Melodi** (pilihan di UI): "Gantian piano & gitar" atau "Piano saja". Pengguna suka keduanya.
- **Kontrol per instrumen**: volume, bisukan, "Buat ulang" (pola baru untuk instrumen itu saja).
- **A/B**: setiap "Buat musik" menghasilkan dua versi.
- **Ekspor**: WAV stereo 44,1 kHz dari seluruh mix.
- **Uji otomatis**: 600 lagu per mood, 0 nada melodi di ketukan kuat yang bukan nada akor.

### Perbaikan suara yang sudah lolos dengar

- Keseimbangan volume (`trackTrim`, `gitarMelodyBoost`). Dulu drum menenggelamkan melodi ("semuanya rusak saat drum masuk").
- Gitar memakai petikan sedang dan kuat, dengan volume dinormalkan per rekaman (`guitarPeak`). Dulu terdengar "gripnya kurang kuat".
- Ekor nada: gitar memudar 0,3 detik, piano memakai pedal, bass menyambung, dan ada ekor 3 detik di akhir lagu. Dulu nada "dipaksa mati".
- Melodi gitar di fret rendah, senar atas. Dulu terdengar "seperti orang belajar main gitar".
- Karakter gitar tetap satu: melodi memakai lapisan yang sama dengan iringan, ditambah nada jempol, dan senar bawah tidak dilepas saat bass masuk. Dulu "tidak nyambung karakter suaranya".

### Yang ditolak lewat dengar

- Nada antar bass, dan bass yang masuk di ketukan pertama, pada etude piano lama.
- Melodi yang disusun otomatis dengan aturan. Diganti kit tulis tangan.
- Pemilihan 12 kit lewat A/B: semuanya terdengar mirip karena hanya melodi yang berbeda. Diganti gaya lagu.

## Berikutnya (urut prioritas)

1. **Ganti kick drum.** Kick masih dari koleksi lama (Tonejs `acoustic-kit`) yang lisensinya tidak jelas. Ganti dengan kick CC0 sebelum ada lagu yang diunggah. Ini wajib untuk dijual.
2. **Kontrol per instrumen yang lebih lengkap.** Di setiap baris instrumen ada pilihan cara main: gitar petik/genjreng, piano blok/pecah, drum lembut/tipis/jalan. Tersedia juga "Buat ulang" per instrumen. Mengubah satu instrumen tidak mengubah yang lain.
3. **Durasi untuk YouTube.** Pilihan 3 dan 5 menit (lebih banyak bagian dan variasi), dan "rangkaian" 30–60 menit dari beberapa lagu berbeda dengan jeda halus.
4. **Mood Melankolis.** Kit bernada minor dengan format yang sama, plus gaya yang cocok.
5. **Genre Lo-fi dan Pop** di mesin kit. Gaya baru (misalnya drum lo-fi yang diayun, suara lebih hangat) memakai kit yang sama.
6. **Simpan dan buka proyek** (seed, mood, genre, gaya, instrumen, pengaturan tiap instrumen, volume), supaya lagu bisa dibuat persis sama lagi.
7. **Siap unggah**: volume akhir standar YouTube (sekitar −14 LUFS), ekspor per instrumen (stem), ekspor MIDI, dan video sederhana (gambar + audio).
8. **Hapus sumber Klasik (Bach)** kalau pengguna setuju, supaya aplikasi lebih sederhana.
