'use strict';

// Spiellogik und rollenabhängige Sichten. Diese Datei kennt weder HTTP noch
// WebSockets, damit sie direkt getestet werden kann.

const crypto = require('crypto');
const { TYPES, DEFAULT_ORDER, COIN_POSITIONS, SHOW_SIZE, TEAM_COLORS, publicTypes } = require('./defaults');
const { QuizError, fail, newId, log, effect, teamName, totals, cleanText, cleanImage } = require('./core');

// Ablauf der einzelnen Spiele. Jedes Modul liefert init, Team- und
// Moderationsaktionen sowie die Sichten für Teams und Beamer.
const PLAY = {
  leichte5: require('./play-leichte5'),
  dummes: require('./play-dummes'),
  land: require('./play-land'),
  kassenschlager: require('./play-kassenschlager'),
  trumpf5: require('./play-trumpf5'),
  musik: require('./play-musik'),
  jauch: require('./play-jauch'),
  nerd: require('./play-nerd'),
};

const STATE_VERSION = 2;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BEAMER_VIEWS = ['start', 'intro', 'pyramid', 'title', 'game', 'ranking', 'coin', 'pause', 'blank'];
const MAX_PROCESSED = 5000;

// 10 Zeichen aus 32 Symbolen ≈ 50 Bit: nicht erratbar, aber noch abtippbar.
function newTeamCode() {
  let code = '';
  for (let i = 0; i < 10; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

function freshLive() {
  return {
    activeGame: null, // ID der aktiven Spielinstanz in der Show
    games: {}, // Spielzustand je Spielinstanz
    beamer: { view: 'start', data: {} },
    coins: [],
    warning: null,
    effect: { seq: 0, kind: null },
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function libraryEntry(type, now) {
  return { id: newId('lib'), type, title: TYPES[type].title, content: clone(TYPES[type].example), version: 1, updatedAt: now };
}

// Eine Spielinstanz in der Show ist eine unabhängige Kopie eines Datenbank-Eintrags.
function instanceFrom(entry) {
  return { id: newId('game'), type: entry.type, title: entry.title, content: clone(entry.content), libraryId: entry.id, libraryVersion: entry.version, locked: false };
}

// Eine neue Show mit der Standardreihenfolge, je Spieltyp der erste Eintrag der Datenbank.
function newProject(library, name = 'Wer stiehlt uns die Show') {
  const games = DEFAULT_ORDER.map((type) => library.find((e) => e.type === type)).filter(Boolean).map(instanceFrom);
  if (games[0]?.type === 'leichte5') games[0].locked = true; // „Die leichten 5“ als festes Eröffnungsspiel
  return {
    id: newId('proj'),
    name,
    date: '',
    subtitle: 'Die Live-Show mit acht Spielen',
    host: 'Moderation',
    coHost: '',
    // Teams sehen standardmäßig keine fremden Punktestände (Abschnitt 4.1).
    settings: { publicScores: false, reducedMotion: false, sound: true, titleDurationSec: 7 },
    teams: [],
    games,
  };
}

function createState(now = Date.now()) {
  const library = DEFAULT_ORDER.map((type) => libraryEntry(type, now));
  return {
    version: STATE_VERSION,
    library,
    project: newProject(library),
    live: freshLive(),
    ledger: [],
    // Weitere, gerade nicht geöffnete Shows mit eigenem Spielstand und Punktebuch.
    shows: [],
    log: [],
    processed: [],
  };
}

// Ältere Speicherstände (vor der Spiele-Datenbank) übernehmen Teams, Showdaten und Protokoll.
function migrate(db) {
  if (db.version === STATE_VERSION) {
    if (!db.shows) db.shows = [];
    if (db.project.date === undefined) db.project.date = '';
    return db;
  }
  const fresh = createState();
  if (db.project) {
    for (const k of ['name', 'subtitle', 'host', 'coHost', 'settings', 'teams']) if (k in db.project) fresh.project[k] = db.project[k];
  }
  fresh.log = db.log || [];
  if (db.auth) fresh.auth = db.auth;
  return fresh;
}

// ---------- Hilfsfunktionen ----------

function findTeam(db, teamId) {
  const team = db.project.teams.find((t) => t.id === teamId);
  if (!team) fail('Team nicht gefunden.');
  return team;
}

function findGame(db, gameId) {
  const game = db.project.games.find((g) => g.id === gameId);
  if (!game) fail('Spiel nicht in der Show gefunden.');
  return game;
}

function findEntry(db, libraryId) {
  const entry = db.library.find((e) => e.id === libraryId);
  if (!entry) fail('Spiel nicht in der Datenbank gefunden.');
  return entry;
}

function position(db, game) {
  return db.project.games.indexOf(game) + 1;
}

function activeGame(db) {
  const id = db.live.activeGame;
  return id ? db.project.games.find((g) => g.id === id) || null : null;
}

function gameState(db, game) {
  const s = db.live.games;
  if (!s[game.id]) s[game.id] = PLAY[game.type].init(db, game);
  return s[game.id];
}

// Spielaktionen heißen „play.<name>“ und gehen an das gerade aktive Spiel.
function playAction(db, ctx, name, payload) {
  const game = activeGame(db);
  if (!game) fail('Gerade ist kein Spiel aktiv.');
  const mod = PLAY[game.type];
  const table = ctx.role === 'moderator' ? mod.mod : ctx.role === 'team' ? mod.team : null;
  const fn = table && Object.prototype.hasOwnProperty.call(table, name) ? table[name] : null;
  if (!fn) fail('Diese Aktion passt nicht zum aktiven Spiel.');
  return fn(db, ctx, game, gameState(db, game), payload);
}

function cleanColor(v) {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) fail('Ungültige Farbe.');
  return v;
}

// Prüft Inhalte gegen das Schema des Spieltyps. Leere Felder sind beim
// Vorbereiten erlaubt; nur Form, Anzahl und Länge werden erzwungen.
function sanitizeFields(fields, value) {
  const src = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const f of fields) out[f.key] = sanitizeField(f, src[f.key]);
  return out;
}

function sanitizeField(f, v) {
  switch (f.type) {
    case 'text':
    case 'textarea':
      if (v === undefined || v === null) return '';
      if (typeof v !== 'string') fail(`„${f.label}“ ist ungültig.`);
      if (v.length > f.max) fail(`„${f.label}“: maximal ${f.max} Zeichen.`);
      return v;
    case 'number': {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < f.min || n > f.max) fail(`„${f.label}“ muss zwischen ${f.min} und ${f.max} liegen.`);
      return n;
    }
    case 'select':
      if (!f.options.includes(v)) return f.options[0];
      return v;
    case 'object':
      return sanitizeFields(f.fields, v);
    case 'list': {
      const arr = Array.isArray(v) ? v : [];
      if (arr.length < f.min || arr.length > f.max) {
        fail(f.min === f.max ? `„${f.label}“ braucht genau ${f.min} Einträge.` : `„${f.label}“: ${f.min} bis ${f.max} Einträge.`);
      }
      return arr.map((item) => (f.of === 'text' ? sanitizeField({ type: 'text', label: f.label, max: f.maxLength || 300 }, item) : sanitizeFields(f.fields, item)));
    }
    default:
      fail('Unbekanntes Feld.');
  }
  return null;
}

function sanitizeContent(type, content) {
  if (!TYPES[type]) fail('Unbekannter Spieltyp.');
  return sanitizeFields(TYPES[type].schema, content);
}

function rankingSnapshot(db) {
  const sums = totals(db);
  return db.project.teams
    .map((t) => ({ teamId: t.id, name: t.name, color: t.color, points: sums[t.id] }))
    .sort((a, b) => b.points - a.points);
}

function findStashed(db, showId) {
  const s = db.shows.find((x) => x.project.id === showId);
  if (!s) fail('Show nicht gefunden.');
  return s;
}

function stashCurrent(db) {
  db.shows.push({ project: db.project, live: db.live, ledger: db.ledger });
}

function openShow(db, show) {
  db.project = show.project;
  db.live = show.live;
  db.ledger = show.ledger;
}

function cleanDate(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) fail('Ungültiges Datum.');
  return v;
}

function showList(db) {
  const summary = (pr, current) => ({ id: pr.id, name: pr.name, date: pr.date || '', teams: pr.teams.length, games: pr.games.length, current });
  return [summary(db.project, true), ...db.shows.map((s) => summary(s.project, false))]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name, 'de'));
}

function requireEditable(db) {
  if (db.live.activeGame !== null) fail('Während ein Spiel aktiv ist, bleibt der Showablauf fest. Zuerst das Spiel beenden.');
}

// ---------- Aktionen ----------

const moderatorActions = {
  'project.update'(db, ctx, p) {
    const pr = db.project;
    if ('name' in p) pr.name = cleanText(p.name, 80) || 'Wer stiehlt uns die Show';
    if ('subtitle' in p) pr.subtitle = cleanText(p.subtitle, 160);
    if ('host' in p) pr.host = cleanText(p.host, 80);
    if ('coHost' in p) pr.coHost = cleanText(p.coHost, 80);
    if ('date' in p) pr.date = cleanDate(p.date);
    if (p.settings && typeof p.settings === 'object') {
      for (const k of ['publicScores', 'reducedMotion', 'sound']) {
        if (k in p.settings) pr.settings[k] = !!p.settings[k];
      }
      if ('titleDurationSec' in p.settings) {
        const d = Number(p.settings.titleDurationSec);
        if (!(d >= 3 && d <= 20)) fail('Titeldauer muss zwischen 3 und 20 Sekunden liegen.');
        pr.settings.titleDurationSec = d;
      }
    }
    log(db, ctx, 'editor', 'Showdaten gespeichert');
  },

  'team.add'(db, ctx, p) {
    const teams = db.project.teams;
    if (teams.length >= 12) fail('Maximal 12 Teams.');
    const name = cleanText(p.name || '', 40) || `Team ${teams.length + 1}`;
    const color = p.color ? cleanColor(p.color) : TEAM_COLORS[teams.length % TEAM_COLORS.length];
    const team = { id: newId('team'), name, color, code: newTeamCode() };
    teams.push(team);
    log(db, ctx, 'team', `Team „${name}“ angelegt`);
  },

  'team.update'(db, ctx, p) {
    const team = findTeam(db, p.teamId);
    if ('name' in p) team.name = cleanText(p.name, 40) || team.name;
    if ('color' in p) team.color = cleanColor(p.color);
    // 3D-Avatar hinter dem Pult; null entfernt ihn (Pult bleibt dann leer).
    if ('avatar' in p) team.avatar = p.avatar ? cleanImage(p.avatar) : null;
    log(db, ctx, 'team', `Team „${team.name}“ geändert${'avatar' in p ? (p.avatar ? ' (Avatar gesetzt)' : ' (Avatar entfernt)') : ''}`);
  },

  'team.regenCode'(db, ctx, p) {
    const team = findTeam(db, p.teamId);
    team.code = newTeamCode();
    log(db, ctx, 'team', `Neuer Zugangscode für „${team.name}“ (alter Code ungültig)`);
    return { kick: team.id };
  },

  'team.remove'(db, ctx, p) {
    const team = findTeam(db, p.teamId);
    if (db.ledger.some((e) => e.teamId === team.id)) {
      fail('Team hat bereits Punktebuchungen und kann nicht gelöscht werden.');
    }
    db.project.teams = db.project.teams.filter((t) => t.id !== team.id);
    log(db, ctx, 'team', `Team „${team.name}“ gelöscht`);
    return { kick: team.id };
  },

  // ----- Spiele-Datenbank -----

  'library.add'(db, ctx, p) {
    if (!TYPES[p.type]) fail('Unbekannter Spieltyp.');
    if (db.library.length >= 200) fail('Die Datenbank ist voll (200 Spiele).');
    const entry = libraryEntry(p.type, ctx.now);
    entry.title = `${TYPES[p.type].title} (neu)`;
    db.library.push(entry);
    log(db, ctx, 'datenbank', `Neues Spiel „${entry.title}“ angelegt`);
    return { created: entry.id };
  },

  'library.duplicate'(db, ctx, p) {
    const src = findEntry(db, p.libraryId);
    if (db.library.length >= 200) fail('Die Datenbank ist voll (200 Spiele).');
    const entry = { ...clone(src), id: newId('lib'), title: `${src.title} (Kopie)`, version: 1, updatedAt: ctx.now };
    db.library.splice(db.library.indexOf(src) + 1, 0, entry);
    log(db, ctx, 'datenbank', `„${src.title}“ dupliziert`);
    return { created: entry.id };
  },

  'library.update'(db, ctx, p) {
    const entry = findEntry(db, p.libraryId);
    if ('title' in p) entry.title = cleanText(p.title, 80) || TYPES[entry.type].title;
    if ('content' in p) entry.content = sanitizeContent(entry.type, p.content);
    entry.version += 1;
    entry.updatedAt = ctx.now;
    log(db, ctx, 'datenbank', `„${entry.title}“ gespeichert (Version ${entry.version})`);
  },

  'library.remove'(db, ctx, p) {
    const entry = findEntry(db, p.libraryId);
    db.library = db.library.filter((e) => e.id !== entry.id);
    log(db, ctx, 'datenbank', `„${entry.title}“ aus der Datenbank gelöscht (Show-Kopien bleiben erhalten)`);
  },

  // Ein in der Show bearbeitetes Spiel als neuen Eintrag in die Datenbank übernehmen.
  'library.saveFromShow'(db, ctx, p) {
    const game = findGame(db, p.gameId);
    const entry = { id: newId('lib'), type: game.type, title: game.title, content: clone(game.content), version: 1, updatedAt: ctx.now };
    db.library.push(entry);
    log(db, ctx, 'datenbank', `„${game.title}“ aus der Show in die Datenbank übernommen`);
    return { created: entry.id };
  },

  // ----- Showablauf -----

  'game.add'(db, ctx, p) {
    requireEditable(db);
    const entry = findEntry(db, p.libraryId);
    const games = db.project.games;
    if (games.length >= SHOW_SIZE) fail(`Die Show hat schon ${SHOW_SIZE} Spiele. Zuerst eines in den Mülleimer ziehen.`);
    const game = instanceFrom(entry);
    let index = Number.isInteger(p.index) ? Math.max(0, Math.min(p.index, games.length)) : games.length;
    if (index === 0 && games[0]?.locked) index = 1;
    games.splice(index, 0, game);
    log(db, ctx, 'editor', `„${game.title}“ auf Position ${index + 1} eingefügt`);
    return { created: game.id };
  },

  'game.remove'(db, ctx, p) {
    requireEditable(db);
    const game = findGame(db, p.gameId);
    if (game.locked && p.override !== 'ENTFERNEN') fail('Das feste Eröffnungsspiel lässt sich nur über die Sonderaktion entfernen.');
    db.project.games = db.project.games.filter((g) => g.id !== game.id);
    log(db, ctx, 'editor', `„${game.title}“ aus der Show entfernt${game.locked ? ' (Sonderaktion Eröffnungsspiel)' : ''}`);
  },

  'game.moveTo'(db, ctx, p) {
    requireEditable(db);
    const games = db.project.games;
    const game = findGame(db, p.gameId);
    const from = games.indexOf(game);
    const to = Math.max(0, Math.min(Number(p.index), games.length - 1));
    if (!Number.isInteger(to)) fail('Ungültige Position.');
    if (from === to) return;
    if (game.locked || (games[0]?.locked && to === 0)) {
      fail('„Die leichten 5“ ist das feste Eröffnungsspiel und bleibt auf Position 1.');
    }
    games.splice(from, 1);
    games.splice(to, 0, game);
    log(db, ctx, 'editor', `„${game.title}“ auf Position ${to + 1} verschoben`);
  },

  'game.update'(db, ctx, p) {
    const game = findGame(db, p.gameId);
    if (db.live.activeGame === game.id && 'content' in p) fail('Inhalte eines laufenden Spiels bitte erst nach dem Beenden ändern.');
    if ('title' in p) game.title = cleanText(p.title, 80) || TYPES[game.type].title;
    if ('content' in p) game.content = sanitizeContent(game.type, p.content);
    log(db, ctx, 'editor', `Inhalte von „${game.title}“ gespeichert`);
  },

  'show.activate'(db, ctx, p) {
    if (p.gameId === null) {
      db.live.activeGame = null;
      log(db, ctx, 'ablauf', 'Kein Spiel aktiv');
      return;
    }
    const game = findGame(db, p.gameId);
    if (!TYPES[game.type].playable) fail(`„${game.title}“ ist noch nicht spielbar.`);
    db.live.activeGame = game.id;
    gameState(db, game);
    log(db, ctx, 'ablauf', `Spiel ${position(db, game)} „${game.title}“ aktiviert`);
  },

  'beamer.show'(db, ctx, p) {
    if (!BEAMER_VIEWS.includes(p.view)) fail('Unbekannte Beamer-Ansicht.');
    if (p.view === 'title' && !activeGame(db)) fail('Zuerst ein Spiel aktivieren.');
    if (p.view === 'ranking') {
      db.live.beamer = { view: 'ranking', data: { ranking: rankingSnapshot(db), at: ctx.now } };
      log(db, ctx, 'beamer', 'Rangliste enthüllt');
      effect(db, 'reveal');
      return;
    }
    if (p.view === 'coin') {
      const last = db.live.coins[db.live.coins.length - 1];
      if (!last) fail('Es wurde noch keine Münze vergeben.');
      db.live.beamer = { view: 'coin', data: { position: last.position, teamId: last.teamId } };
      effect(db, 'coin');
      return;
    }
    db.live.beamer = { view: p.view, data: {} };
    if (p.view === 'title') effect(db, 'title');
    log(db, ctx, 'beamer', `Beamer zeigt „${p.view}“`);
  },

  'points.adjust'(db, ctx, p) {
    findTeam(db, p.teamId);
    const points = Number(p.points);
    if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 100) fail('Ungültige Punktzahl.');
    const reason = cleanText(p.reason || '', 160);
    if (!reason) fail('Bitte eine Begründung angeben.');
    db.ledger.push({ id: newId('pt'), teamId: p.teamId, points, ref: `manual:${newId('m')}`, reason: `Korrektur: ${reason}`, at: ctx.now, actor: ctx.actor });
    log(db, ctx, 'punkte', `${teamName(db, p.teamId)}: ${points > 0 ? '+' : ''}${points} (Korrektur: ${reason})`);
  },

  // „Rückgängig“ löscht keine Historie, sondern erzeugt eine Gegenbuchung.
  'points.undo'(db, ctx, p) {
    const entry = db.ledger.find((e) => e.id === p.entryId);
    if (!entry) fail('Buchung nicht gefunden.');
    if (entry.reversedBy || entry.reverses) fail('Diese Buchung wurde bereits rückgängig gemacht.');
    const counter = { id: newId('pt'), teamId: entry.teamId, points: -entry.points, ref: entry.ref, reason: `Rückgängig: ${entry.reason}`, reverses: entry.id, at: ctx.now, actor: ctx.actor };
    entry.reversedBy = counter.id;
    db.ledger.push(counter);
    log(db, ctx, 'punkte', `Buchung rückgängig: ${teamName(db, entry.teamId)} ${-entry.points}`);
  },

  // Münzvergabe nach den aktiven Positionen 4, 6 und 8 auf Basis des kumulierten Stands.
  'coin.determine'(db, ctx, p) {
    const pos = Number(p.position);
    if (!COIN_POSITIONS.includes(pos)) fail('Münzen gibt es nur nach Position 4, 6 und 8.');
    if (db.live.coins.some((c) => c.position === pos)) fail('Für diese Position wurde die Münze bereits vergeben.');
    const ranking = rankingSnapshot(db);
    if (!ranking.length) fail('Keine Teams vorhanden.');
    const top = ranking.filter((r) => r.points === ranking[0].points);
    if (top.length > 1) {
      db.live.warning = { kind: 'coinTie', position: pos, teamIds: top.map((t) => t.teamId), points: top[0].points };
      log(db, ctx, 'muenze', `Gleichstand um Münze ${pos}: ${top.map((t) => t.name).join(', ')} – Schätzfrage nötig`);
      return;
    }
    db.live.coins.push({ position: pos, teamId: top[0].teamId, at: ctx.now, method: 'Punkte', points: top[0].points });
    db.live.warning = null;
    log(db, ctx, 'muenze', `Münze nach Position ${pos} an ${top[0].name} (${top[0].points} Punkte)`);
  },

  // Nach einer Schätzfrage vergibt die Moderation die Münze ausdrücklich und protokolliert.
  'coin.awardTie'(db, ctx, p) {
    const w = db.live.warning;
    if (!w || w.kind !== 'coinTie') fail('Es gibt keinen offenen Gleichstand.');
    if (!w.teamIds.includes(p.teamId)) fail('Nur Teams aus dem Gleichstand können die Münze erhalten.');
    db.live.coins.push({ position: w.position, teamId: p.teamId, at: ctx.now, method: 'Schätzfrage', points: w.points });
    db.live.warning = null;
    log(db, ctx, 'muenze', `Münze nach Position ${w.position} per Schätzfrage an ${teamName(db, p.teamId)}`);
  },

  // ----- Mehrere Shows -----
  // Geöffnet ist immer genau eine Show (db.project mit Spielstand und Punkten),
  // die anderen liegen vollständig in db.shows.

  'shows.create'(db, ctx, p) {
    requireEditable(db);
    if (db.shows.length >= 50) fail('Maximal 50 Shows.');
    const name = cleanText(p.name || '', 80) || 'Neue Show';
    const project = newProject(db.library, name);
    project.date = cleanDate(p.date);
    if (p.copyTeams) project.teams = clone(db.project.teams);
    stashCurrent(db);
    openShow(db, { project, live: freshLive(), ledger: [] });
    log(db, ctx, 'show', `Neue Show „${name}“ angelegt und geöffnet`);
    return { created: project.id };
  },

  'shows.switch'(db, ctx, p) {
    requireEditable(db);
    const i = db.shows.findIndex((x) => x.project.id === p.showId);
    if (i < 0) fail('Show nicht gefunden.');
    const [next] = db.shows.splice(i, 1);
    stashCurrent(db);
    openShow(db, next);
    log(db, ctx, 'show', `Show „${next.project.name}“ geöffnet`);
  },

  'shows.duplicate'(db, ctx, p) {
    if (db.shows.length >= 50) fail('Maximal 50 Shows.');
    const src = p.showId === db.project.id ? db.project : findStashed(db, p.showId).project;
    const project = { ...clone(src), id: newId('proj'), name: `${src.name} (Kopie)`.slice(0, 80) };
    for (const g of project.games) g.id = newId('game');
    db.shows.push({ project, live: freshLive(), ledger: [] });
    log(db, ctx, 'show', `Show „${src.name}“ dupliziert`);
    return { created: project.id };
  },

  'shows.rename'(db, ctx, p) {
    const project = p.showId === db.project.id ? db.project : findStashed(db, p.showId).project;
    const old = project.name;
    if ('name' in p) project.name = cleanText(p.name, 80) || old;
    if ('date' in p) project.date = cleanDate(p.date);
    log(db, ctx, 'show', `Show „${old}“ umbenannt in „${project.name}“`);
  },

  'shows.remove'(db, ctx, p) {
    if (p.showId === db.project.id) fail('Die geöffnete Show kann nicht gelöscht werden. Zuerst eine andere öffnen.');
    const s = findStashed(db, p.showId);
    db.shows = db.shows.filter((x) => x !== s);
    log(db, ctx, 'show', `Show „${s.project.name}“ gelöscht`);
  },

  'live.reset'(db, ctx, p) {
    if (p.confirm !== 'NEUSTART') fail('Neustart nicht bestätigt.');
    db.live = freshLive();
    db.ledger = [];
    log(db, ctx, 'ablauf', 'Kontrollierter Neustart: Spielstand und Punkte zurückgesetzt');
  },
};

// Führt eine Aktion aus. Eine Aktions-ID wird nur einmal verarbeitet, sodass
// doppelt gesendete Nachrichten keine doppelten Punkte oder Abgaben erzeugen.
function applyAction(db, ctx, name, payload, actionId) {
  if (actionId && db.processed.includes(actionId)) return { duplicate: true };
  let result;
  if (typeof name === 'string' && name.startsWith('play.') && (ctx.role === 'moderator' || ctx.role === 'team')) {
    result = playAction(db, ctx, name.slice(5), payload || {}) || {};
  } else {
    const fn = ctx.role === 'moderator' && Object.prototype.hasOwnProperty.call(moderatorActions, name) ? moderatorActions[name] : null;
    if (!fn) fail('Diese Aktion ist für diese Rolle nicht erlaubt.');
    result = fn(db, ctx, payload || {}) || {};
  }
  if (actionId) {
    db.processed.push(actionId);
    if (db.processed.length > MAX_PROCESSED) db.processed.splice(0, db.processed.length - MAX_PROCESSED);
  }
  return result;
}

function findTeamByCode(db, code) {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  return db.project.teams.find((t) => t.code === c) || null;
}

// ---------- Sichten ----------

function gameHeader(db) {
  const g = activeGame(db);
  return g ? { type: g.type, title: g.title, position: position(db, g) } : null;
}

function teamView(db, teamId, now = Date.now()) {
  const team = findTeam(db, teamId);
  const view = {
    role: 'team',
    show: { name: db.project.name, subtitle: db.project.subtitle },
    team: { id: team.id, name: team.name, color: team.color },
    teams: publicTeams(db),
    game: gameHeader(db),
    settings: { reducedMotion: db.project.settings.reducedMotion },
  };
  if (db.project.settings.publicScores) view.ranking = rankingSnapshot(db).map(({ name, color, points }) => ({ name, color, points }));
  const g = activeGame(db);
  if (g) {
    const play = PLAY[g.type].teamView(db, g, gameState(db, g), teamId, now);
    if (play) view.play = { type: g.type, ...play };
  }
  return view;
}

function publicTeams(db) {
  return db.project.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
}

// Nächster Zeitpunkt, an dem die Server alle Sichten neu senden sollen.
function nextWake(db, now = Date.now()) {
  const g = activeGame(db);
  const fn = g && PLAY[g.type].wakeAt;
  return fn ? fn(db, g, gameState(db, g), now) : null;
}

function beamerGameView(db) {
  const g = activeGame(db);
  if (!g) return null;
  return { type: g.type, ...PLAY[g.type].beamerView(db, g, gameState(db, g)) };
}

// Der Beamer bekommt ausschließlich öffentliche, freigegebene Daten.
function beamerView(db) {
  const pr = db.project;
  const b = db.live.beamer;
  // Punktestände zeigt der Beamer nur bei der Münzvergabe auf den Teampulten;
  // sonst bleiben sie geheim (Team-iPads sehen nie fremde Punkte).
  const sums = b.view === 'coin' ? totals(db) : null;
  const view = {
    role: 'beamer',
    show: { name: pr.name, subtitle: pr.subtitle, host: pr.host, coHost: pr.coHost },
    teams: publicTeams(db).map((t, i) => {
      const out = sums ? { ...t, points: sums[t.id] || 0 } : { ...t };
      // Avatare nur in den Ansichten mit Teampulten mitschicken (große Bilder).
      const avatar = db.project.teams[i].avatar;
      if (avatar && (b.view === 'intro' || b.view === 'coin')) out.avatar = avatar;
      return out;
    }),
    settings: { reducedMotion: pr.settings.reducedMotion, sound: pr.settings.sound, titleDurationSec: pr.settings.titleDurationSec },
    view: b.view,
    effect: db.live.effect,
    game: gameHeader(db),
  };
  if (b.view === 'game') view.gameView = beamerGameView(db);
  if (b.view === 'ranking') view.ranking = b.data.ranking;
  if (b.view === 'coin') view.coin = b.data;
  if (b.view === 'pyramid' || b.view === 'intro') {
    view.games = pr.games.map((g, i) => ({ title: g.title, position: i + 1 }));
  }
  return view;
}

function moderatorView(db, connections) {
  return {
    role: 'moderator',
    project: db.project,
    shows: showList(db),
    library: db.library,
    types: publicTypes(),
    showSize: SHOW_SIZE,
    live: db.live,
    totals: totals(db),
    ledger: db.ledger.slice(-100),
    log: db.log.slice(-60),
    coinPositions: COIN_POSITIONS,
    connections: connections || {},
    beamerPreview: beamerView(db),
  };
}

module.exports = {
  QuizError,
  createState,
  migrate,
  applyAction,
  findTeamByCode,
  sanitizeContent,
  teamView,
  beamerView,
  moderatorView,
  totals,
  nextWake,
  trumpfPoints: PLAY.trumpf5.pointsFor,
};
