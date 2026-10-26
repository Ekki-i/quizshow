'use strict';

// Kleiner Webserver für den entpackten Prototyp (ohne Abhängigkeiten).
// Startet auf dem ersten freien Port ab 8080 und öffnet den Browser.
// Aufruf: node prototyp-server.js  (oder per Doppelklick auf eine Starter-Datei)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (rel === '/') rel = '/prototype.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 8100) listen(port + 1);
    else {
      console.error('Server konnte nicht starten:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/prototype.html`;
    console.log('');
    console.log('  Prototyp „Wer stiehlt uns die Show“ läuft:');
    console.log(`  ${url}`);
    console.log('  Moderator-Passwort: fabian');
    console.log('');
    console.log('  Dieses Fenster offen lassen. Zum Beenden schließen oder Strg+C drücken.');
    if (!process.argv.includes('--no-open')) openBrowser(url);
  });
}

listen(Number(process.env.PORT) || 8080);
