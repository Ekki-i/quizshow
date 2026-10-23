'use strict';

// Spiellogik und rollenabhängige Sichten. Diese Datei kennt weder HTTP noch
// WebSockets, damit sie direkt getestet werden kann.

const crypto = require('crypto');
const { COIN_POSITIONS, TEAM_COLORS, defaultProject } = require('./defaults');

class QuizError extends Error {}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BEAMER_VIEWS = ['start', 'intro', 'pyramid', 'title', 'game', 'ranking', 'coin', 'blank'];
const MAX_PROCESSED = 5000;

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

// 10 Zeichen aus 32 Symbolen ≈ 50 Bit: nicht erratbar, aber noch abtippbar.
function newTeamCode() {
  let code = '';
  for (let i = 0; i < 10; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

function freshLive() {
  return {
    activeGame: null,
    beamer: { view: 'start', data: {} },
    g1: { qIndex: -1, rounds: {} },
    g5: { termIndex: -1, rounds: {} },
    coins: [],
    warning: null,
    effect: { seq: 0, kind: null },
  };
}

function createState() {
  return {
    version: 1,
    project: defaultProject(newId('proj')),
    live: freshLive(),
    ledger: [],
    log: [],
    processed: [],
  };
}

// ---------- Hilfsfunktionen ----------

function fail(msg) {
  throw new QuizError(msg);
}

function findTeam(db, teamId) {
  const team = db.project.teams.find((t) => t.id === teamId);
  if (!team) fail('Team nicht gefunden.');
  return team;
}

function activeGame(db) {
  const i = db.live.activeGame;
  return i === null ? null : db.project.games[i];
}

function requireActive(db, key) {
  const g = activeGame(db);
  if (!g || g.key !== key) fail('Dieses Spiel ist gerade nicht aktiv.');
  return g;
}

function log(db, ctx, type, detail) {
  db.log.push({ at: ctx.now, actor: ctx.actor, type, detail });
}

function effect(db, kind) {
  db.live.effect = { seq: db.live.effect.seq + 1, kind };
}

function totals(db) {
  const sums = {};
  for (const t of db.project.teams) sums[t.id] = 0;
  for (const e of db.ledger) if (e.teamId in sums) sums[e.teamId] += e.points;
  return sums;
}

function bookedFor(db, ref) {
  return db.ledger.filter((e) => e.ref === ref).reduce((s, e) => s + e.points, 0);
}

// Bucht nur die Differenz zum Zielwert. Dadurch erzeugen doppelte oder
// korrigierte Bewertungen nie doppelte Punkte, und jede Korrektur bleibt als
// eigene Gegenbuchung sichtbar.
function bookTarget(db, ctx, ref, teamId, target, reason) {
  const delta = target - bookedFor(db, ref);
  if (delta === 0) return null;
  const entry = { id: newId('pt'), teamId, points: delta, ref, reason, at: ctx.now, actor: ctx.actor };
  db.ledger.push(entry);
  log(db, ctx, 'punkte', `${teamName(db, teamId)}: ${delta > 0 ? '+' : ''}${delta} (${reason})`);
  return entry;
}

function teamName(db, teamId) {
  const t = db.project.teams.find((x) => x.id === teamId);
  return t ? t.name : teamId;
}

function cleanText(v, max) {
  if (typeof v !== 'string') fail('Ungültige Eingabe.');
  const s = v.trim();
  if (s.length > max) fail(`Maximal ${max} Zeichen.`);
  return s;
}

function cleanColor(v) {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) fail('Ungültige Farbe.');
  return v;
}

function g1Round(db, qIndex) {
  const r = db.live.g1.rounds;
  if (!r[qIndex]) r[qIndex] = { open: false, solutionRevealed: false, answers: {} };
  return r[qIndex];
}

function g5Round(db, termIndex) {
  const r = db.live.g5.rounds;
  if (!r[termIndex]) r[termIndex] = { hintLevel: 0, buzzes: [], locked: [], resolved: false };
  return r[termIndex];
}

function g5Current(round) {
  return round.buzzes.find((b) => b.status === 'pending') || null;
}

// Punkte bei „5 ist Trümpf“: Hinweis 1 → 5 Punkte … Hinweis 5 → 1 Punkt.
function trumpfPoints(hintLevel) {
  return Math.max(0, 6 - hintLevel);
}

function rankingSnapshot(db) {
  const sums = totals(db);
  return db.project.teams
    .map((t) => ({ teamId: t.id, name: t.name, color: t.color, points: sums[t.id] }))
    .sort((a, b) => b.points - a.points);
}

// ---------- Aktionen ----------

const teamActions = {
  'g1.submit'(db, ctx, p) {
    requireActive(db, 'leichte5');
    const qIndex = db.live.g1.qIndex;
    const round = g1Round(db, qIndex);
    if (!round.open) fail('Die Frage ist nicht freigegeben.');
    if (round.answers[ctx.teamId]) fail('Eure Antwort ist bereits abgegeben und gesperrt.');
    const text = cleanText(p.text, 200);
    if (!text) fail('Bitte zuerst eine Antwort eingeben.');
    round.answers[ctx.teamId] = { text, at: ctx.now, grade: null, onBeamer: false };
    log(db, ctx, 'antwort', `${teamName(db, ctx.teamId)} hat Frage ${qIndex + 1} abgegeben`);
  },

  'g5.buzz'(db, ctx) {
    requireActive(db, 'trumpf5');
    const termIndex = db.live.g5.termIndex;
    if (termIndex < 0) fail('Es läuft gerade kein Begriff.');
    const round = g5Round(db, termIndex);
    if (round.resolved) fail('Dieser Begriff ist bereits beendet.');
    if (round.hintLevel < 1) fail('Es wurde noch kein Hinweis freigegeben.');
    if (round.locked.includes(ctx.teamId)) fail('Ihr seid für diesen Begriff gesperrt.');
    if (round.buzzes.some((b) => b.teamId === ctx.teamId)) fail('Ihr habt bereits gebuzzert.');
    // Node verarbeitet Nachrichten nacheinander: die Array-Reihenfolge ist die
    // serverseitige Eingangsreihenfolge, der Zeitstempel wird zusätzlich gespeichert.
    round.buzzes.push({ teamId: ctx.teamId, at: ctx.now, hint: round.hintLevel, status: 'pending' });
    log(db, ctx, 'buzzer', `${teamName(db, ctx.teamId)} buzzert bei Hinweis ${round.hintLevel}`);
    if (round.buzzes.filter((b) => b.status === 'pending').length === 1) effect(db, 'buzz');
  },
};

const moderatorActions = {
  'project.update'(db, ctx, p) {
    const pr = db.project;
    if ('name' in p) pr.name = cleanText(p.name, 80) || 'Quizshow';
    if ('subtitle' in p) pr.subtitle = cleanText(p.subtitle, 160);
    if ('host' in p) pr.host = cleanText(p.host, 80);
    if ('coHost' in p) pr.coHost = cleanText(p.coHost, 80);
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
    log(db, ctx, 'team', `Team „${team.name}“ geändert`);
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

  'game.updateContent'(db, ctx, p) {
    const game = db.project.games[p.gameIndex];
    if (!game) fail('Spiel nicht gefunden.');
    if (game.key === 'leichte5') {
      if (!Array.isArray(p.content?.questions) || p.content.questions.length !== 5) {
        fail('„Die leichten 5“ braucht genau fünf Fragen.');
      }
      game.content = {
        questions: p.content.questions.map((q) => ({
          question: cleanText(q.question, 300),
          solution: cleanText(q.solution, 200),
        })),
      };
    } else if (game.key === 'trumpf5') {
      if (!Array.isArray(p.content?.terms) || p.content.terms.length !== 5) {
        fail('„5 ist Trümpf“ braucht genau fünf Begriffe.');
      }
      game.content = {
        terms: p.content.terms.map((t) => {
          if (!Array.isArray(t.hints) || t.hints.length !== 5) fail('Jeder Begriff braucht fünf Hinweise.');
          return {
            category: cleanText(t.category, 80),
            term: cleanText(t.term, 120),
            hints: t.hints.map((h) => cleanText(h, 200)),
          };
        }),
      };
    } else {
      fail('Für dieses Spiel gibt es noch keinen Editor.');
    }
    log(db, ctx, 'editor', `Inhalte von „${game.title}“ gespeichert`);
  },

  'game.move'(db, ctx, p) {
    const games = db.project.games;
    const from = p.gameIndex;
    const to = from + (p.dir === 'up' ? -1 : 1);
    if (!games[from] || !games[to]) fail('Verschieben nicht möglich.');
    if (games[from].fixedOpener || games[to].fixedOpener) {
      fail('„Die leichten 5“ ist das feste Eröffnungsspiel und bleibt auf Position 1.');
    }
    if (db.live.activeGame !== null) fail('Während ein Spiel aktiv ist, bleibt die Reihenfolge fest.');
    [games[from], games[to]] = [games[to], games[from]];
    games.forEach((g, i) => (g.position = i + 1));
    log(db, ctx, 'editor', `„${games[to].title}“ auf Position ${to + 1} verschoben`);
  },

  'show.activate'(db, ctx, p) {
    if (p.gameIndex === null) {
      db.live.activeGame = null;
      log(db, ctx, 'ablauf', 'Kein Spiel aktiv');
      return;
    }
    const game = db.project.games[p.gameIndex];
    if (!game) fail('Spiel nicht gefunden.');
    if (!game.implemented) fail(`„${game.title}“ ist noch nicht umgesetzt.`);
    db.live.activeGame = p.gameIndex;
    log(db, ctx, 'ablauf', `Spiel ${game.position} „${game.title}“ aktiviert`);
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

  'g1.open'(db, ctx, p) {
    const game = requireActive(db, 'leichte5');
    const qIndex = Number(p.qIndex);
    if (!game.content.questions[qIndex]) fail('Frage nicht gefunden.');
    const prev = db.live.g1.qIndex;
    if (prev >= 0 && prev !== qIndex) g1Round(db, prev).open = false;
    db.live.g1.qIndex = qIndex;
    const round = g1Round(db, qIndex);
    if (!round.solutionRevealed) round.open = true;
    log(db, ctx, 'ablauf', `Frage ${qIndex + 1} freigegeben`);
  },

  'g1.showAnswer'(db, ctx, p) {
    requireActive(db, 'leichte5');
    const round = g1Round(db, db.live.g1.qIndex);
    const ans = round.answers[p.teamId];
    if (!ans) fail('Dieses Team hat noch nicht abgegeben.');
    ans.onBeamer = !!p.visible;
    log(db, ctx, 'beamer', `Antwort von ${teamName(db, p.teamId)} ${ans.onBeamer ? 'gezeigt' : 'ausgeblendet'}`);
  },

  'g1.grade'(db, ctx, p) {
    requireActive(db, 'leichte5');
    const qIndex = db.live.g1.qIndex;
    const round = g1Round(db, qIndex);
    const ans = round.answers[p.teamId];
    if (!ans) fail('Dieses Team hat noch nicht abgegeben.');
    const correct = !!p.correct;
    const changed = ans.grade !== null && ans.grade !== correct;
    ans.grade = correct;
    bookTarget(db, ctx, `g1:${qIndex}:${p.teamId}`, p.teamId, correct ? 1 : 0,
      `Die leichten 5, Frage ${qIndex + 1}${changed ? ', Bewertung korrigiert' : ''}`);
    log(db, ctx, 'bewertung', `${teamName(db, p.teamId)} Frage ${qIndex + 1}: ${correct ? 'richtig' : 'falsch'}`);
    if (ans.onBeamer) effect(db, correct ? 'correct' : 'wrong');
  },

  'g1.revealSolution'(db, ctx) {
    requireActive(db, 'leichte5');
    const qIndex = db.live.g1.qIndex;
    const round = g1Round(db, qIndex);
    const ungraded = Object.values(round.answers).filter((a) => a.grade === null).length;
    if (ungraded > 0) fail(`Erst alle abgegebenen Antworten bewerten (${ungraded} offen).`);
    round.open = false;
    round.solutionRevealed = true;
    log(db, ctx, 'ablauf', `Lösung zu Frage ${qIndex + 1} gezeigt, Abgabe geschlossen`);
  },

  'g5.start'(db, ctx, p) {
    const game = requireActive(db, 'trumpf5');
    const termIndex = Number(p.termIndex);
    if (!game.content.terms[termIndex]) fail('Begriff nicht gefunden.');
    db.live.g5.termIndex = termIndex;
    g5Round(db, termIndex);
    log(db, ctx, 'ablauf', `Begriff ${termIndex + 1} gestartet`);
  },

  'g5.nextHint'(db, ctx) {
    requireActive(db, 'trumpf5');
    const termIndex = db.live.g5.termIndex;
    if (termIndex < 0) fail('Zuerst einen Begriff starten.');
    const round = g5Round(db, termIndex);
    if (round.resolved) fail('Dieser Begriff ist bereits beendet.');
    if (g5Current(round)) fail('Erst die Antwort des buzzernden Teams bewerten.');
    if (round.hintLevel >= 5) fail('Alle fünf Hinweise sind freigegeben.');
    round.hintLevel += 1;
    log(db, ctx, 'ablauf', `Hinweis ${round.hintLevel} freigegeben`);
  },

  'g5.judge'(db, ctx, p) {
    requireActive(db, 'trumpf5');
    const termIndex = db.live.g5.termIndex;
    const round = g5Round(db, termIndex);
    const buzz = g5Current(round);
    if (!buzz) fail('Kein Team hat gerade das Antwortrecht.');
    if (p.correct) {
      buzz.status = 'correct';
      round.resolved = true;
      const pts = trumpfPoints(buzz.hint);
      bookTarget(db, ctx, `g5:${termIndex}`, buzz.teamId, pts, `5 ist Trümpf, Begriff ${termIndex + 1}, Hinweis ${buzz.hint}`);
      effect(db, 'correct');
    } else {
      buzz.status = 'wrong';
      round.locked.push(buzz.teamId);
      effect(db, 'wrong');
    }
    log(db, ctx, 'bewertung', `${teamName(db, buzz.teamId)} Begriff ${termIndex + 1}: ${p.correct ? 'richtig' : 'falsch'}`);
  },

  'g5.close'(db, ctx) {
    requireActive(db, 'trumpf5');
    const round = g5Round(db, db.live.g5.termIndex);
    if (g5Current(round)) fail('Erst die Antwort des buzzernden Teams bewerten.');
    round.resolved = true;
    log(db, ctx, 'ablauf', `Begriff ${db.live.g5.termIndex + 1} ohne Punkte beendet`);
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
    const position = Number(p.position);
    if (!COIN_POSITIONS.includes(position)) fail('Münzen gibt es nur nach Position 4, 6 und 8.');
    if (db.live.coins.some((c) => c.position === position)) fail('Für diese Position wurde die Münze bereits vergeben.');
    const ranking = rankingSnapshot(db);
    if (!ranking.length) fail('Keine Teams vorhanden.');
    const top = ranking.filter((r) => r.points === ranking[0].points);
    if (top.length > 1) {
      db.live.warning = { kind: 'coinTie', position, teamIds: top.map((t) => t.teamId), points: top[0].points };
      log(db, ctx, 'muenze', `Gleichstand um Münze ${position}: ${top.map((t) => t.name).join(', ')} – Schätzfrage nötig`);
      return;
    }
    db.live.coins.push({ position, teamId: top[0].teamId, at: ctx.now, method: 'Punkte', points: top[0].points });
    db.live.warning = null;
    log(db, ctx, 'muenze', `Münze nach Position ${position} an ${top[0].name} (${top[0].points} Punkte)`);
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
  const table = ctx.role === 'moderator' ? moderatorActions : ctx.role === 'team' ? teamActions : null;
  const fn = table && Object.prototype.hasOwnProperty.call(table, name) ? table[name] : null;
  if (!fn) fail('Diese Aktion ist für diese Rolle nicht erlaubt.');
  const result = fn(db, ctx, payload || {}) || {};
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
  return g ? { key: g.key, title: g.title, position: g.position } : null;
}

function teamView(db, teamId) {
  const team = findTeam(db, teamId);
  const view = {
    role: 'team',
    show: { name: db.project.name, subtitle: db.project.subtitle },
    team: { id: team.id, name: team.name, color: team.color },
    game: gameHeader(db),
    settings: { reducedMotion: db.project.settings.reducedMotion },
  };
  if (db.project.settings.publicScores) view.ranking = rankingSnapshot(db).map(({ name, color, points }) => ({ name, color, points }));
  const g = activeGame(db);
  if (g?.key === 'leichte5' && db.live.g1.qIndex >= 0) {
    const qIndex = db.live.g1.qIndex;
    const round = g1Round(db, qIndex);
    const own = round.answers[teamId];
    view.g1 = {
      qIndex,
      question: round.open || round.solutionRevealed ? g.content.questions[qIndex].question : null,
      open: round.open,
      answer: own ? { text: own.text, grade: own.grade } : null,
    };
  }
  if (g?.key === 'trumpf5' && db.live.g5.termIndex >= 0) {
    const termIndex = db.live.g5.termIndex;
    const round = g5Round(db, termIndex);
    const term = g.content.terms[termIndex];
    const own = round.buzzes.find((b) => b.teamId === teamId);
    const current = g5Current(round);
    view.g5 = {
      termIndex,
      category: term.category,
      hints: term.hints.slice(0, round.hintLevel),
      resolved: round.resolved,
      locked: round.locked.includes(teamId),
      buzzed: !!own,
      ownStatus: own ? own.status : null,
      answering: current ? current.teamId === teamId : false,
      canBuzz: !round.resolved && round.hintLevel >= 1 && !own && !round.locked.includes(teamId),
    };
  }
  return view;
}

function publicTeams(db) {
  return db.project.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
}

function beamerGameView(db) {
  const g = activeGame(db);
  if (!g) return null;
  if (g.key === 'leichte5') {
    const qIndex = db.live.g1.qIndex;
    if (qIndex < 0) return { key: g.key, waiting: true };
    const round = g1Round(db, qIndex);
    const visible = round.open || round.solutionRevealed;
    return {
      key: g.key,
      qIndex,
      question: visible ? g.content.questions[qIndex].question : null,
      submittedCount: Object.keys(round.answers).length,
      teamCount: db.project.teams.length,
      answers: Object.entries(round.answers)
        .filter(([, a]) => a.onBeamer)
        .map(([teamId, a]) => ({ teamId, text: a.text, grade: a.grade })),
      solution: round.solutionRevealed ? g.content.questions[qIndex].solution : null,
    };
  }
  if (g.key === 'trumpf5') {
    const termIndex = db.live.g5.termIndex;
    if (termIndex < 0) return { key: g.key, waiting: true };
    const round = g5Round(db, termIndex);
    const term = g.content.terms[termIndex];
    const current = g5Current(round);
    const winner = round.buzzes.find((b) => b.status === 'correct');
    return {
      key: g.key,
      termIndex,
      category: term.category,
      hints: term.hints.slice(0, round.hintLevel),
      value: trumpfPoints(round.hintLevel),
      buzzOrder: round.buzzes.map((b) => ({ teamId: b.teamId, status: b.status })),
      answering: current ? current.teamId : null,
      resolved: round.resolved,
      term: round.resolved ? term.term : null,
      winner: winner ? winner.teamId : null,
    };
  }
  return { key: g.key };
}

// Der Beamer bekommt ausschließlich öffentliche, freigegebene Daten.
function beamerView(db) {
  const pr = db.project;
  const b = db.live.beamer;
  const view = {
    role: 'beamer',
    show: { name: pr.name, subtitle: pr.subtitle, host: pr.host, coHost: pr.coHost },
    teams: publicTeams(db),
    settings: { reducedMotion: pr.settings.reducedMotion, sound: pr.settings.sound, titleDurationSec: pr.settings.titleDurationSec },
    view: b.view,
    effect: db.live.effect,
    game: gameHeader(db),
  };
  if (b.view === 'game') view.gameView = beamerGameView(db);
  if (b.view === 'ranking') view.ranking = b.data.ranking;
  if (b.view === 'coin') view.coin = b.data;
  if (b.view === 'pyramid' || b.view === 'intro') {
    view.games = pr.games.map((g) => ({ title: g.title, position: g.position }));
  }
  return view;
}

function moderatorView(db, connections) {
  return {
    role: 'moderator',
    project: db.project,
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
  applyAction,
  findTeamByCode,
  teamView,
  beamerView,
  moderatorView,
  totals,
  trumpfPoints,
};
