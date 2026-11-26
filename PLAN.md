# Rencana pengembangan Music Maker

## Tujuan

Generator musik instrumental untuk dipakai sendiri, dan hasil musiknya bisa dijual. Pengguna tidak membaca not dan tidak menilai nada, jadi semua keputusan musikal di tingkat nada datang dari bahan yang sudah ditulis. Pengguna cukup memilih versi yang disukai (A/B).

## Keadaan sekarang (2026-11-26)

- **Sumber lagu** (pilihan "Sumber" di UI):
  - *Kit orisinal*: enam kit empat birama tulisan tangan di `studio.js` (`kits`). Ada empat kit utama ("a") dan dua kit kontras ("b"). `planSong` merangkai kit utama, lalu bagian kontras, lalu kit utama lagi, dan menutup dengan kadens V–I. Berlaku untuk Akustik · Tenang.
  - *Klasik (Bach)*: 24 korale empat suara bernada mayor di `classics.js`, diambil dari JSB Chorales dataset. Komposisinya bebas hak cipta. `arrangeChorale` membagi suara: sopran untuk melodi, alto dan tenor untuk iringan, bas untuk bass.
- **Peran**: bass memegang nada dasar. Piano dan gitar bergantian membawa melodi per frasa. Bass dan drum masuk setelah frasa pertama.
- **A/B**: setiap "Buat musik" menghasilkan dua versi (seed berurutan). Seed tampil di pesan status.
- **Sampel**: Meta Piano (4 lapisan dinamika), gitar nilon Meta, kontrabas pizzicato VSCO 2 CE, kick lama, snare lembut dan shaker VSCO. Semuanya CC0, lihat `samples/RECORDINGS.txt`.

## Riwayat yang sudah ditolak lewat dengar

- Nada antar bass, dan bass yang masuk di ketukan pertama, pada etude piano lama.
- Melodi yang disusun otomatis dengan aturan (rombakan pertama). Kini diganti kit tulis tangan.

## Berikutnya

1. Pengguna menilai `contoh/kit-*.wav` dan `contoh/klasik-*.wav`. Kit atau korale yang disukai ditandai, yang tidak disukai dibuang.
2. Tambah kit baru untuk mood lain (Ceria, Melankolis) dengan format yang sama.
3. Ekspor MIDI per track, supaya hasil bisa dipoles di DAW.
4. Simpan dan buka proyek (seed, sumber, instrumen, volume).
