@echo off
chcp 65001 >nul
title Wer stiehlt uns die Show
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js fehlt. Bitte einmal installieren: https://nodejs.org  ^(LTS-Version^)
  echo  Danach diese Datei erneut doppelklicken.
  echo.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo  Erster Start: benoetigte Bausteine werden installiert ...
  call npm install --omit=dev
)
start "" http://localhost:3000
call npm start
pause
