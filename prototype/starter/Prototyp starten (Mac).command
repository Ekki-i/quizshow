#!/bin/bash
# Doppelklick startet den Quizshow-Prototyp im Browser.
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  node prototyp-server.js
elif command -v python3 >/dev/null 2>&1; then
  PORT=8080
  echo ""
  echo "  Quizshow-Prototyp läuft: http://localhost:$PORT/prototype.html"
  echo "  Moderator-Passwort: fabian"
  echo "  Dieses Fenster offen lassen. Zum Beenden schließen oder Ctrl+C drücken."
  (sleep 1; open "http://localhost:$PORT/prototype.html") &
  python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo "Node.js ist nicht installiert. Bitte von https://nodejs.org die LTS-Version installieren."
  open "https://nodejs.org"
  read -r -p "Enter zum Schließen"
fi
