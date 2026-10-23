#!/bin/bash
# Blueprint — start the app (macOS). Double-click this file in Finder. Keep the window open while you use the app.
cd "$(dirname "$0")" || exit 1
[ -d node_modules ] || { echo "Run setup.command first."; read -n 1 -s -r -p "Press any key to close…"; exit 1; }
( sleep 2; open "http://localhost:5173" ) &
npm run dev
