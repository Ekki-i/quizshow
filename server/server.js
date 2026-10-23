'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { createStore } = require('./store');
const game = require('./game');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.QUIZ_DATA_FILE || path.join(ROOT, 'data', 'db.json');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ---------- Speicher und Moderator-Zugang ----------

const store = createStore(DATA_FILE, () => ({ ...game.createState(), auth: { sessions: {} } }));
store.data = game.migrate(store.data);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function ensureModeratorPassword() {
  const db = store.data;
  db.auth = db.auth || { sessions: {} };
  const envPw = process.env.QUIZ_ADMIN_PASSWORD;
  if (envPw) {
    const salt = crypto.randomBytes(16).toString('hex');
    db.auth.salt = salt;
    db.auth.hash = hashPassword(envPw, salt);
  } else if (!db.auth.hash) {
    const pw = crypto.randomBytes(6).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    db.auth.salt = salt;
    db.auth.hash = hashPassword(pw, salt);
    console.log(`\n  Erstes Moderator-Passwort: ${pw}\n  (Ändern per Umgebungsvariable QUIZ_ADMIN_PASSWORD)\n`);
  }
  store.save();
}

function checkPassword(pw) {
  const { salt, hash } = store.data.auth;
  if (typeof pw !== 'string' || !salt) return false;
  const a = Buffer.from(hashPassword(pw, salt), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validSession(token) {
  if (typeof token !== 'string') return false;
  const s = store.data.auth.sessions[token];
  return !!s && s.expires > Date.now();
}

// Einfache Bremse gegen Passwort-Raten: höchstens 10 Fehlversuche pro 10 Minuten und Adresse.
const failedLogins = new Map();
function loginBlocked(ip) {
  const now = Date.now();
  const list = (failedLogins.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  failedLogins.set(ip, list);
  return list.length >= 10;
}

// ---------- HTTP ----------

const STATIC = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/team.html': 'team.html',
  '/moderator.html': 'moderator.html',
  '/beamer.html': 'beamer.html',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function serveStatic(req, res, urlPath) {
  let rel = STATIC[urlPath];
  if (!rel && urlPath.startsWith('/assets/')) rel = urlPath.slice(1);
  if (!rel) return false;
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(path.join(ROOT, path.sep)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { ok: true });

    // Teamliste für die Startseite: nur Namen und Farben, niemals Zugangscodes.
    if (req.method === 'GET' && url.pathname === '/api/teams') {
      return sendJson(res, 200, store.data.project.teams.map((t) => ({ id: t.id, name: t.name, color: t.color })));
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const ip = req.socket.remoteAddress;
      if (loginBlocked(ip)) return sendJson(res, 429, { error: 'Zu viele Fehlversuche. Bitte später erneut versuchen.' });
      const body = await readBody(req);
      if (!checkPassword(body.password)) {
        failedLogins.get(ip).push(Date.now());
        return sendJson(res, 401, { error: 'Passwort ist falsch.' });
      }
      const token = crypto.randomBytes(24).toString('hex');
      const sessions = store.data.auth.sessions;
      for (const [k, s] of Object.entries(sessions)) if (s.expires < Date.now()) delete sessions[k];
      sessions[token] = { expires: Date.now() + SESSION_TTL_MS };
      store.save();
      return sendJson(res, 200, { token });
    }

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const body = await readBody(req);
      if (typeof body.token === 'string') delete store.data.auth.sessions[body.token];
      store.save();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && serveStatic(req, res, url.pathname)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  } catch (err) {
    sendJson(res, 400, { error: 'Ungültige Anfrage.' });
  }
});

// ---------- Echtzeit ----------

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const clients = new Set();

function connections() {
  const teams = {};
  let beamers = 0;
  let moderators = 0;
  for (const c of clients) {
    if (c.role === 'team') teams[c.teamId] = (teams[c.teamId] || 0) + 1;
    if (c.role === 'beamer' && !c.preview) beamers++;
    if (c.role === 'moderator') moderators++;
  }
  return { teams, beamers, moderators };
}

function viewFor(c) {
  const db = store.data;
  if (c.role === 'moderator') return game.moderatorView(db, connections());
  if (c.role === 'team') return game.teamView(db, c.teamId);
  return game.beamerView(db);
}

function send(c, msg) {
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg));
}

function broadcast() {
  for (const c of clients) {
    if (!c.role) continue;
    try {
      send(c, { type: 'state', state: viewFor(c), serverTime: Date.now() });
    } catch (err) {
      // z. B. Team wurde gelöscht: Verbindung beenden statt fremde Daten zu senden.
      send(c, { type: 'kicked', message: 'Euer Zugang ist nicht mehr gültig.' });
      c.ws.close();
    }
  }
}

// Zeitabhängige Spielregeln (z. B. 10-Sekunden-Fenster) ändern die Sichten
// ohne neue Aktion: zum richtigen Zeitpunkt noch einmal senden.
let wakeTimer = null;
function scheduleWake() {
  clearTimeout(wakeTimer);
  const at = game.nextWake(store.data);
  if (at) wakeTimer = setTimeout(broadcast, at - Date.now() + 50);
}

function kickTeam(teamId) {
  for (const c of clients) {
    if (c.role === 'team' && c.teamId === teamId) {
      send(c, { type: 'kicked', message: 'Euer Zugangscode wurde erneuert oder das Team entfernt.' });
      c.ws.close();
    }
  }
}

function handleHello(c, msg) {
  if (msg.role === 'moderator') {
    if (!validSession(msg.token)) return send(c, { type: 'auth-failed', message: 'Bitte erneut anmelden.' });
    c.role = 'moderator';
  } else if (msg.role === 'team') {
    const team = game.findTeamByCode(store.data, msg.code);
    if (!team) return send(c, { type: 'auth-failed', message: 'Zugangscode unbekannt.' });
    c.role = 'team';
    c.teamId = team.id;
  } else if (msg.role === 'beamer') {
    c.role = 'beamer';
    c.preview = !!msg.preview;
  } else {
    return send(c, { type: 'auth-failed', message: 'Unbekannte Rolle.' });
  }
  send(c, { type: 'welcome', role: c.role });
  broadcast();
}

function handleAction(c, msg) {
  if (c.role === 'moderator' && !validSession(c.token)) {
    return send(c, { type: 'ack', id: msg.id, ok: false, error: 'Sitzung abgelaufen. Bitte neu anmelden.' });
  }
  const ctx = {
    role: c.role,
    teamId: c.teamId,
    actor: c.role === 'team' ? `team:${c.teamId}` : c.role,
    now: Date.now(),
  };
  // Auf einer Kopie arbeiten: schlägt eine Aktion fehl, bleibt der Zustand unverändert.
  const draft = structuredClone(store.data);
  try {
    const result = game.applyAction(draft, ctx, msg.name, msg.payload, typeof msg.id === 'string' ? msg.id : null);
    store.data = draft;
    store.save();
    send(c, { type: 'ack', id: msg.id, ok: true, duplicate: !!result.duplicate });
    if (result.kick) kickTeam(result.kick);
    broadcast();
    scheduleWake();
  } catch (err) {
    const message = err instanceof game.QuizError ? err.message : 'Interner Fehler.';
    if (!(err instanceof game.QuizError)) console.error(err);
    send(c, { type: 'ack', id: msg.id, ok: false, error: message });
  }
}

wss.on('connection', (ws) => {
  const c = { ws, role: null, alive: true };
  clients.add(c);
  ws.on('pong', () => (c.alive = true));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'hello') {
      c.token = msg.token;
      return handleHello(c, msg);
    }
    if (msg.type === 'action' && (c.role === 'moderator' || c.role === 'team')) return handleAction(c, msg);
  });
  ws.on('close', () => {
    clients.delete(c);
    broadcast();
  });
});

// Tote Verbindungen erkennen, damit die Moderation den echten Verbindungsstatus sieht.
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) {
      c.ws.terminate();
      continue;
    }
    c.alive = false;
    c.ws.ping();
  }
}, 15000).unref();

ensureModeratorPassword();
server.listen(PORT, () => {
  console.log(`Quizshow läuft auf http://localhost:${PORT}`);
});
