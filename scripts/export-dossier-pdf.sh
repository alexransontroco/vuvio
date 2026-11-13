#!/usr/bin/env zsh
# Export a Vuvio dossier HTML to PDF via per-slide screenshots + Pillow.
#
# Why this instead of Chrome --print-to-pdf?
# Chrome's Skia PDF backend flips some base64 JPEGs upside-down (reproducible
# bug on this deck). Taking PNG screenshots sidesteps the bug and produces a
# much smaller PDF (~7 MB vs ~20 MB for 13 slides).
#
# The HTML must support ?slide=N (hides all other .frame elements).
#
# Usage:
#   ./scripts/export-dossier-pdf.sh "Vuvio-dossier-EN.html"
#   ./scripts/export-dossier-pdf.sh "Vuvio-dossier(1).html" Vuvio-dossier-FR.pdf
set -euo pipefail

IN="${1:?html file required}"
OUT="${2:-${IN%.html}.pdf}"
PAGES="${PAGES:-13}"
W="${W:-2560}"
H="${H:-1440}"
IN_ABS="$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
RUN_ID="$$"
TMP="/private/tmp/vuvio-dossier-export-$RUN_ID"

[[ -f "$IN_ABS" ]] || { echo "not found: $IN_ABS" >&2; exit 1; }
[[ -x "$CHROME" ]] || { echo "Chrome not found at $CHROME" >&2; exit 1; }

mkdir -p "$TMP"
trap "rm -rf '$TMP' 2>/dev/null; pkill -f vuvio-dossier-chrome-$RUN_ID 2>/dev/null; exit" EXIT INT TERM

wait_for_file() {
  local file="$1" pid="$2"
  for _ in {1..30}; do
    [[ -s "$file" ]] && break
    sleep 1
  done
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
}

for i in {1..$PAGES}; do
  OUT_PNG="$TMP/page-$(printf '%02d' $i).png"
  LOG="$TMP/chrome-$i.log"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --no-sandbox \
    --disable-crash-reporter \
    --user-data-dir="$TMP/vuvio-dossier-chrome-$RUN_ID-$i" \
    --allow-file-access-from-files \
    --hide-scrollbars \
    --window-size="$W,$H" \
    --virtual-time-budget=2000 \
    --screenshot="$OUT_PNG" \
    "file://${IN_ABS}?slide=$i" >"$LOG" 2>&1 &
  wait_for_file "$OUT_PNG" "$!"
  [[ -s "$OUT_PNG" ]] || { echo "screenshot failed for slide $i (see $LOG)" >&2; exit 1; }
  echo "  slide $i → $(du -h "$OUT_PNG" | cut -f1)"
done

python3 <<PYEOF
from PIL import Image
import glob, os
files = sorted(glob.glob('$TMP/page-*.png'))
imgs = [Image.open(f).convert('RGB') for f in files]
imgs[0].save('$OUT', save_all=True, append_images=imgs[1:], resolution=200.0)
print('PDF:', '$OUT', '→', os.path.getsize('$OUT'), 'bytes')
PYEOF

ls -lh "$OUT"
