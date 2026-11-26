# Rencana pengembangan Music Maker

## Tujuan

Generator musik instrumental untuk dipakai sendiri, dan hasil musiknya bisa dijual. Pengguna tidak membaca not dan tidak menilai nada, jadi semua keputusan musikal di tingkat nada datang dari bahan yang sudah ditulis. Pengguna cukup memilih versi yang disukai (A/B).

## Keadaan sekarang (2026-11-26)

- **Sumber lagu** (pilihan "Sumber" di UI):
  - *Kit orisinal*: dua belas kit empat birama tulisan tangan di `studio.js` (`kits`). Ada delapan kit utama ("a") dan empat kit kontras ("b"). Kit baru: Embun, Kabut, Senja, Pelangi (a), Hujan, Angin (b). `planSong` merangkai kit utama, lalu bagian kontras, lalu kit utama lagi, dan menutup dengan kadens V–I. Berlaku untuk Akustik · Tenang.
  - *Klasik (Bach)*: 24 korale empat suara bernada mayor di `classics.js`, diambil dari JSB Chorales dataset. Komposisinya bebas hak cipta. `arrangeChorale` membagi suara: sopran untuk melodi, alto dan tenor untuk iringan, bas untuk bass.
- **Peran**: bass memegang nada dasar. Piano dan gitar bergantian membawa melodi per frasa. Bass dan drum masuk setelah frasa pertama.
- **Keseimbangan volume** (`trackTrim`, `gitarMelodyBoost`): diukur per birama. Sebelumnya drum menenggelamkan melodi gitar saat masuk (pengguna: "semuanya rusak saat drum masuk"). Sekarang melodi paling keras, drum paling pelan.
- **Petikan gitar**: dulu gitar hampir selalu memakai rekaman petikan paling lembut (pengguna: "seperti gripnya kurang kuat"). Sekarang hanya lapisan sedang dan kuat, dan volumenya dinormalkan per rekaman (`guitarPeak`). Senar LowE/A/D hanya punya lapisan 1–2, jadi diambil yang terkuat.
- **Ekor nada** (pengguna: "kayak dipaksa mati"): gitar memudar 0,3 detik saat ganti akor (dulu 0,045), piano memakai pedal sampai ganti akor, bass menyambung ke nada berikutnya, dan lagu punya ekor 3 detik (`tail`) setelah ketukan terakhir.
- **Melodi di gitar** (pengguna: "mulai detik 15 seperti orang belajar main gitar"): melodi dulu dimainkan tinggi di senar G (sampai fret 17) dan melompat antar senar. Sekarang nada melodi diarahkan ke fret rendah di senar atas. Pengguna suka keduanya, jadi ada pilihan "Melodi" di UI: "Gantian piano & gitar" (bawaan) atau "Piano saja" (`pianoMelody`).
- **A/B**: setiap "Buat musik" menghasilkan dua versi (seed berurutan). Seed tampil di pesan status.
- **Sampel**: Meta Piano (4 lapisan dinamika), gitar nilon Meta, kontrabas pizzicato VSCO 2 CE, kick lama, snare lembut dan shaker VSCO. Semuanya CC0, lihat `samples/RECORDINGS.txt`.

## Gaya lagu (`styles`)

Setiap seed memilih satu gaya: Santai, Mengalir, Jalan pagi, Teduh, Ringan, Sederhana. Gaya menentukan irama melodi (`applyFeel`: asli / panjang / rapat), iringan gitar (petik / genjreng), iringan piano (blok / pecah), pola drum (lembut / tipis / jalan) dan rentang tempo. Penutup dipilih terpisah: kadens V–I atau bar ketiga kit lalu tonika, dengan atau tanpa melambat (ritardando). Tempo gaya dipertahankan; panjang lagu yang menyesuaikan (± beberapa detik). Uji otomatis: 600 lagu, 0 pelanggaran aturan nada akor.

## Riwayat yang sudah ditolak lewat dengar

- Nada antar bass, dan bass yang masuk di ketukan pertama, pada etude piano lama.
- Melodi yang disusun otomatis dengan aturan (rombakan pertama). Kini diganti kit tulis tangan.

## Berikutnya

1. (Dibatalkan) Pemilihan 12 kit lewat A/B: pengguna mendengar semuanya mirip, karena hanya melodi yang berbeda. Diganti gaya lagu (lihat Gaya).
   Catatan lama: pengguna sudah memilih Kit orisinal daripada Klasik. Sekarang menyaring 12 kit lewat halaman A/B (12 pilihan, dua putaran). Kit dengan 0 kemenangan dibuang. `newSong({onlyKit})` memutar satu kit saja untuk audisi.
2. Tambah kit baru untuk mood lain (Ceria, Melankolis) dengan format yang sama.
3. Ekspor MIDI per track, supaya hasil bisa dipoles di DAW.
4. Simpan dan buka proyek (seed, sumber, instrumen, volume).
