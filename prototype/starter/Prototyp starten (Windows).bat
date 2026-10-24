@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js ist nicht installiert.
  echo   Bitte von https://nodejs.org die LTS-Version installieren und danach diese Datei erneut doppelklicken.
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)
node prototyp-server.js
pause
