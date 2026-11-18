#!/usr/bin/env sh
# Vuvio-Lab launcher — lance émulateurs Firebase + Vite dev en parallèle.
# Ctrl+C sur le terminal tue les deux processus proprement.

set -eu

LAB_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LAB_ROOT"

echo ''
echo '═══════════════════════════════════════════════'
echo '  Vuvio-Lab — environnement expérimental'
echo '═══════════════════════════════════════════════'
echo ''
echo '  Firebase UI    : http://127.0.0.1:4000/'
echo '  Vite dev       : http://localhost:5174/'
echo '  Prod (stable)  : laissé libre sur :5173'
echo ''
echo '  Données persistées sous .emulator-data/'
echo '  (export auto à l’arrêt)'
echo ''

# --- Pre-flight ---
if ! command -v firebase >/dev/null 2>&1; then
  echo 'ERROR: firebase CLI introuvable. Installe-la avec "npm install -g firebase-tools".'
  exit 1
fi
if ! command -v java >/dev/null 2>&1; then
  echo 'ERROR: java introuvable. Installe Temurin 17 (voir docs/ops/VUVIO-LAB-ENVIRONMENT.md).'
  exit 1
fi
if [ ! -d functions/node_modules ]; then
  echo '→ Installing functions deps (première fois)…'
  npm --prefix functions install
fi

# --- Emulators (foreground via Firebase CLI subprocess, backgrounded by shell) ---
mkdir -p .emulator-data

# Firebase CLI accepte --import même si le dossier est vide.
firebase emulators:start \
  --only auth,firestore,storage,functions \
  --import=./.emulator-data \
  --export-on-exit=./.emulator-data \
  > .emulator-data/emulators.log 2>&1 &
EMULATORS_PID=$!

# --- Vite ---
# On laisse quelques secondes aux émulateurs pour écouter avant que l’app ne s’y connecte.
sleep 5
if ! kill -0 "$EMULATORS_PID" 2>/dev/null; then
  echo 'ERROR: émulateurs ont crashé au démarrage. Logs :'
  tail -40 .emulator-data/emulators.log
  exit 1
fi

echo '→ Émulateurs en route. Lancement Vite…'
echo ''

# Cleanup à la sortie
cleanup() {
  echo ''
  echo '→ Arrêt Vuvio-Lab…'
  kill "$EMULATORS_PID" 2>/dev/null || true
  wait "$EMULATORS_PID" 2>/dev/null || true
  echo '  Émulateurs stoppés (data exportée dans .emulator-data/).'
}
trap cleanup EXIT INT TERM

# Vite au premier plan, Ctrl+C remonte au trap.
npm run dev
