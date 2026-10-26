#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js fehlt. Bitte einmal installieren: https://nodejs.org (LTS-Version)"
  echo "  Danach diese Datei erneut doppelklicken."
  open https://nodejs.org
  read -p "  Enter zum Schließen"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "  Erster Start: benötigte Bausteine werden installiert ..."
  npm install --omit=dev
fi
(sleep 2; open http://localhost:3000) &
npm start
