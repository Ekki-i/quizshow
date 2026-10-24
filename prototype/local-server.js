// Lokaler Server für den Browser-Prototyp. Er nutzt dieselbe Spiellogik wie
// der Node-Server (server/game.js, beim Build eingebunden) und bildet dessen
// Verhalten nach: Anmeldung, rollenabhängige Sichten, Aktionen mit Rückmeldung.
// Alle Bildschirme der Prototyp-Seite teilen sich diesen einen Zustand.

import { game } from './game-bundle.js';

const PASSWORD = 'demo';
const DEMO_TOKEN = 'demo-token';
const STORAGE_KEY = 'quiz.prototype.state.v3';
const DEMO_TEAMS = [
  { name: 'Die Füchse', code: 'FUCHS12345' },
  { name: 'Team Blitz', code: 'BLITZ12345' },
  { name: 'Möwenschwarm', code: 'MOEWE12345' },
];

function seed() {
  const db = game.createState();
  const ctx = { role: 'moderator', actor: 'moderator', now: Date.now() };
  DEMO_TEAMS.forEach((t, i) => {
    game.applyAction(db, ctx, 'team.add', { name: t.name });
    db.project.teams[i].code = t.code;
  });
  db.project.subtitle = 'Prototyp · alle Daten bleiben in diesem Browser';
  return db;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return game.migrate(JSON.parse(raw));
  } catch {
    // Kein Speicher verfügbar: Zustand lebt nur bis zum Neuladen.
  }
  return seed();
}

export function createLocalServer() {
  let data = load();
  const clients = new Set();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignorieren
    }
  }

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
    if (c.role === 'moderator') return game.moderatorView(data, connections());
    if (c.role === 'team') return game.teamView(data, c.teamId);
    return game.beamerView(data);
  }

  function send(c, msg) {
    if (c.readyState !== 1) return;
    const text = JSON.stringify(msg);
    // Asynchron zustellen wie über ein echtes Netzwerk.
    setTimeout(() => {
      if (c.readyState !== 1) return;
      try {
        c.onmessage?.({ data: text });
      } catch {
        // Seite des Bildschirms existiert nicht mehr.
        c.close();
      }
    }, 0);
  }

  function broadcast() {
    for (const c of clients) {
      if (!c.role) continue;
      try {
        send(c, { type: 'state', state: viewFor(c), serverTime: Date.now() });
      } catch {
        send(c, { type: 'kicked', message: 'Euer Zugang ist nicht mehr gültig.' });
        c.close();
      }
    }
  }

  // Zeitabhängige Spielregeln (z. B. 10-Sekunden-Fenster) ändern die Sichten
  // ohne neue Aktion: zum richtigen Zeitpunkt noch einmal senden.
  let wakeTimer = null;
  function scheduleWake() {
    clearTimeout(wakeTimer);
    const at = game.nextWake(data);
    if (at) wakeTimer = setTimeout(broadcast, at - Date.now() + 50);
  }

  function kickTeam(teamId) {
    for (const c of clients) {
      if (c.role === 'team' && c.teamId === teamId) {
        send(c, { type: 'kicked', message: 'Euer Zugangscode wurde erneuert oder das Team entfernt.' });
        setTimeout(() => c.close(), 10);
      }
    }
  }

  function handle(c, msg) {
    if (msg.type === 'hello') {
      if (msg.role === 'moderator') {
        if (msg.token !== DEMO_TOKEN) return send(c, { type: 'auth-failed', message: 'Bitte erneut anmelden.' });
        c.role = 'moderator';
      } else if (msg.role === 'team') {
        const team = game.findTeamByCode(data, msg.code);
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
      return broadcast();
    }
    if (msg.type !== 'action' || !(c.role === 'moderator' || c.role === 'team')) return;
    const ctx = { role: c.role, teamId: c.teamId, actor: c.role === 'team' ? `team:${c.teamId}` : c.role, now: Date.now() };
    const draft = structuredClone(data);
    try {
      const result = game.applyAction(draft, ctx, msg.name, msg.payload, typeof msg.id === 'string' ? msg.id : null);
      data = draft;
      save();
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

  return {
    demoToken: DEMO_TOKEN,
    demoTeams: DEMO_TEAMS,

    // Gibt ein Objekt zurück, das sich wie ein WebSocket verhält.
    connect() {
      const c = {
        readyState: 0,
        send: (text) => handle(c, JSON.parse(text)),
        close: () => {
          if (c.readyState === 3) return;
          c.readyState = 3;
          clients.delete(c);
          broadcast();
        },
      };
      clients.add(c);
      setTimeout(() => {
        c.readyState = 1;
        c.onopen?.();
      }, 0);
      return c;
    },

    api(name, body) {
      if (name === 'teams') return [200, data.project.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }))];
      if (name === 'login') {
        return body.password === PASSWORD ? [200, { token: DEMO_TOKEN }] : [401, { error: 'Passwort ist falsch. Im Prototyp lautet es „demo“.' }];
      }
      return [200, { ok: true }];
    },

    reset() {
      data = seed();
      save();
      broadcast();
    },
  };
}
