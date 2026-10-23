#!/bin/bash
# Blueprint — one-time setup (macOS). Double-click this file in Finder.
cd "$(dirname "$0")" || exit 1
echo ""
echo "=== Blueprint setup ==="
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js is not installed on this Mac."
  echo "Install the LTS version from https://nodejs.org (or: brew install node), then double-click setup.command again."
  open "https://nodejs.org/en/download"
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi
echo "Node $(node -v) · npm $(npm -v)"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local (add your Google Client ID there later — see docs/GOOGLE_SHEETS_SETUP.md)"
fi
echo ""
echo "Installing packages…"
npm install --no-audit --no-fund || { echo "npm install failed — see the messages above."; read -n 1 -s -r -p "Press any key to close…"; exit 1; }
echo ""
echo "Checking the build…"
npm run build || { echo "Build failed — see the messages above."; read -n 1 -s -r -p "Press any key to close…"; exit 1; }
echo ""
echo "Setup complete. Starting Blueprint at http://localhost:5173 (keep this window open; Ctrl+C to stop)…"
( sleep 2; open "http://localhost:5173" ) &
npm run dev
