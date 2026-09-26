#!/usr/bin/env zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PDF="$ROOT/Vuvio-Reference-Produit.pdf"

"$CHROME" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --disable-crash-reporter \
  --user-data-dir=/private/tmp/vuvio-product-reference-chrome \
  --allow-file-access-from-files \
  --print-to-pdf="$PDF" \
  --print-to-pdf-no-header \
  "file://$ROOT/index.html"

mkdir -p "$ROOT/previews"
for i in {1..10}; do
  out="$ROOT/previews/page-$i.png"
  rm -f "$out"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --no-sandbox \
    --disable-crash-reporter \
    --user-data-dir="/private/tmp/vuvio-product-reference-preview-$i" \
    --allow-file-access-from-files \
    --window-size=1920,1080 \
    --virtual-time-budget=2000 \
    --screenshot="$out" \
    "file://$ROOT/index.html?slide=$i" >/tmp/vuvio-product-reference-preview-$i.log 2>&1 &
  pid=$!
  for _ in {1..20}; do
    [[ -s "$out" ]] && break
    sleep 1
  done
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
done

echo "Exported $PDF"
