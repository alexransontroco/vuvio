#!/usr/bin/env zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PDF="$ROOT/Vuvio-ParisCo.pdf"
RUN_ID="$$"

wait_for_file() {
  local file="$1"
  local pid="$2"
  for _ in {1..30}; do
    [[ -s "$file" ]] && break
    sleep 1
  done
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
}

rm -f "$PDF"
"$CHROME" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --disable-crash-reporter \
  --user-data-dir="/private/tmp/vuvio-product-reference-chrome-$RUN_ID" \
  --allow-file-access-from-files \
  --window-size=1920,1080 \
  --print-to-pdf="$PDF" \
  --print-to-pdf-no-header \
  "file://$ROOT/index.html" &
wait_for_file "$PDF" "$!"

mkdir -p "$ROOT/previews"
for i in {1..12}; do
  out="$ROOT/previews/page-$i.png"
  rm -f "$out"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --no-sandbox \
    --disable-crash-reporter \
    --user-data-dir="/private/tmp/vuvio-product-reference-preview-$RUN_ID-$i" \
    --allow-file-access-from-files \
    --window-size=1920,1080 \
    --virtual-time-budget=2000 \
    --screenshot="$out" \
    "file://$ROOT/index.html?slide=$i" >/tmp/vuvio-product-reference-preview-$i.log 2>&1 &
  wait_for_file "$out" "$!"
done

echo "Exported $PDF"
