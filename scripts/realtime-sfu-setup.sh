#!/bin/bash
# Cloudflare Realtime SFU — Local Test Environment Setup
# Usage: ./scripts/realtime-sfu-setup.sh

set -e

echo "================================"
echo "Cloudflare Realtime SFU Setup"
echo "================================"
echo ""

# Step 1: Verify credentials
echo "1. Verifying Cloudflare Realtime SFU credentials..."
if [ -f "functions/.env.local" ]; then
  if grep -q "^CF_APP_ID=[^$]" functions/.env.local && grep -q "^CF_APP_SECRET=[^$]" functions/.env.local; then
    CF_APP_ID=$(grep "^CF_APP_ID=" functions/.env.local | cut -d= -f2)
    CF_APP_SECRET=$(grep "^CF_APP_SECRET=" functions/.env.local | cut -d= -f2)

    if [ -z "$CF_APP_ID" ] || [ -z "$CF_APP_SECRET" ]; then
      echo "✗ Credentials empty. Set them in functions/.env.local"
      echo "  CF_APP_ID=your-app-id"
      echo "  CF_APP_SECRET=your-app-secret"
      exit 1
    fi

    echo "✓ CF_APP_ID: $(echo $CF_APP_ID | head -c 10)..."
    echo "✓ CF_APP_SECRET: $(echo $CF_APP_SECRET | head -c 10)..."
  else
    echo "✗ Credentials not configured in functions/.env.local"
    exit 1
  fi
else
  echo "✗ functions/.env.local not found"
  exit 1
fi

echo ""
echo "2. Building TypeScript..."
npm run build > /dev/null 2>&1 && echo "✓ Frontend built" || (echo "✗ Frontend build failed"; exit 1)
cd functions && npm run build > /dev/null 2>&1 && echo "✓ Functions built" || (echo "✗ Functions build failed"; exit 1)
cd ..

echo ""
echo "3. Starting Firebase Emulators..."
echo "   (Firestore + Functions on ports 8080, 5001)"
firebase emulators:start --only firestore,functions &
EMULATOR_PID=$!

# Wait for emulators to start
sleep 5

echo ""
echo "4. Starting Vite dev server..."
echo "   (HTTP on http://localhost:5173)"
npm run dev > /tmp/vite.log 2>&1 &
DEV_PID=$!

sleep 3

echo ""
echo "================================"
echo "✓ Environment Ready"
echo "================================"
echo ""
echo "Access URLs:"
echo "  Local (Desktop):  http://localhost:5173/admin/realtime-test"
echo "  Emulator UI:      http://localhost:4000"
echo "  Functions:        http://localhost:5001"
echo ""
echo "For mobile access, use ngrok:"
echo "  ngrok http 5173"
echo "  Then open: https://[ngrok-url]/admin/realtime-test"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

wait
