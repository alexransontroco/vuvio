#!/usr/bin/env zsh
# Export a Vuvio pitch deck (pitch3.html, pitch4.html, …) to PDF.
#
# The pitch decks reference assets via ABSOLUTE paths (/pitch-assets/...).
# Chrome headless with file:// cannot resolve those paths, so every image
# comes out broken. We serve public/ via a short-lived HTTP server, then
# print via http://localhost:<port>/<slug>.html.
#
# Usage:
#   ./scripts/export-pitch-pdf.sh pitch4
#   ./scripts/export-pitch-pdf.sh pitch3 ~/Desktop/vuvio-pitch3.pdf
set -euo pipefail

SLUG="${1:-pitch4}"
OUT="${2:-$PWD/${SLUG}.pdf}"
PORT="${PORT:-8773}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

[[ -f "$PUBLIC/${SLUG}.html" ]] || { echo "not found: $PUBLIC/${SLUG}.html" >&2; exit 1; }
[[ -x "$CHROME" ]] || { echo "Chrome not found at $CHROME" >&2; exit 1; }

cd "$PUBLIC"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID >/dev/null 2>&1 || true" EXIT INT TERM

# Wait up to ~5s for the server to accept connections
for _ in {1..25}; do
  curl -sf -o /dev/null "http://localhost:${PORT}/${SLUG}.html" && break
  sleep 0.2
done

rm -f "$OUT"
"$CHROME" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --disable-crash-reporter \
  --user-data-dir="/private/tmp/vuvio-pitch-pdf-$$" \
  --no-pdf-header-footer \
  --print-to-pdf="$OUT" \
  --print-to-pdf-no-header \
  "http://localhost:${PORT}/${SLUG}.html"

ls -lh "$OUT"
