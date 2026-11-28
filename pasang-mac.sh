#!/bin/bash
# music-maker — pasang alat untuk komposer + Muse Sounds di Mac (tanpa admin, tanpa Homebrew).
# Membuat lingkungan Python pribadi di folder repo ini: .env-mac/  (python 3.12, numpy, mido, music21, ffmpeg)
# Hapus kapan saja dengan:  rm -rf .env-mac .mamba
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
case "$(uname -m)" in
  arm64) PLAT=osx-arm64 ;;
  x86_64) PLAT=osx-64 ;;
  *) echo "Arsitektur tidak dikenal: $(uname -m)"; exit 1 ;;
esac
[ "$(uname -s)" = "Darwin" ] || PLAT=linux-64

MM="$ROOT/.mamba/bin/micromamba"
if [ ! -x "$MM" ]; then
  echo "[1/3] Mengunduh micromamba ($PLAT, ~12 MB)…"
  mkdir -p "$ROOT/.mamba"
  curl -fsSL "https://micro.mamba.pm/api/micromamba/$PLAT/latest" | tar -xj -C "$ROOT/.mamba" bin/micromamba
fi
export MAMBA_ROOT_PREFIX="$ROOT/.mamba"

if [ ! -x "$ROOT/.env-mac/bin/python" ]; then
  echo "[2/3] Memasang Python + ffmpeg + music21 ke .env-mac (sekali saja, ~600 MB)…"
  "$MM" create -y -q -p "$ROOT/.env-mac" -c conda-forge python=3.12 numpy mido music21 ffmpeg
  "$MM" clean -a -y -q >/dev/null 2>&1 || true
else
  echo "[2/3] .env-mac sudah ada"
fi

echo "[3/3] Memeriksa…"
"$ROOT/.env-mac/bin/python" -c "import music21, mido, numpy; print('  python OK, music21', music21.__version__)"
"$ROOT/.env-mac/bin/ffmpeg" -version | head -1 | sed 's/^/  /'
MS="/Applications/MuseScore 4.app/Contents/MacOS/mscore"
[ -x "$MS" ] || MS="/Applications/MuseScore Studio 4.app/Contents/MacOS/mscore"
if [ -x "$MS" ]; then echo "  MuseScore ditemukan: $MS"; else echo "  PERHATIAN: MuseScore Studio 4 belum ada di /Applications (pasang lewat Muse Hub)"; fi
if [ -d "$HOME/Library/Application Support/MuseSampler/lib" ]; then echo "  Muse Sounds (MuseSampler) ditemukan di akun ini"
else echo "  PERHATIAN: Muse Sounds belum terpasang di akun ini (Muse Hub -> pasang Muse Keys + Muse Strings)"; fi
chmod +x "$ROOT/music-maker-mac" 2>/dev/null || true
echo
echo "Siap. Contoh:  ./music-maker-mac buat --mood Sedih --render musesounds"
