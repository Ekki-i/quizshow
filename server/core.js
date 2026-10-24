'use strict';

// Gemeinsame Bausteine für die Spiellogik: Fehler, Protokoll, Punktebuchungen,
// Buzzer-Warteschlange und Hilfsrechnungen. Wird von game.js und allen
// Spielmodulen (play-*.js) genutzt.

const crypto = require('crypto');

class QuizError extends Error {}

function fail(msg) {
  throw new QuizError(msg);
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function randomInt(max) {
  return crypto.randomInt(max);
}

function log(db, ctx, type, detail) {
  db.log.push({ at: ctx.now, actor: ctx.actor, type, detail });
}

function effect(db, kind) {
  db.live.effect = { seq: db.live.effect.seq + 1, kind };
}

function teamName(db, teamId) {
  const t = db.project.teams.find((x) => x.id === teamId);
  return t ? t.name : teamId;
}

function teamIds(db) {
  return db.project.teams.map((t) => t.id);
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

// Handschriftliche Antwort als PNG (data:-URI) vom Team-iPad.
const INK_MAX = 400000;
function cleanInk(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v)) fail('Ungültige Handschrift.');
  if (v.length > INK_MAX) fail('Die Handschrift ist zu groß.');
  return v;
}

function cleanText(v, max) {
  if (typeof v !== 'string') fail('Ungültige Eingabe.');
  const s = v.trim();
  if (s.length > max) fail(`Maximal ${max} Zeichen.`);
  return s;
}

function cleanChoice(v) {
  if (!['A', 'B', 'C', 'D'].includes(v)) fail('Bitte A, B, C oder D wählen.');
  return v;
}

function pts(n) {
  return `${n} ${Math.abs(n) === 1 ? 'Punkt' : 'Punkte'}`;
}

// ----- Buzzer-Warteschlange (5 ist Trümpf, Musikquiz) -----
// Node verarbeitet Nachrichten nacheinander: die Array-Reihenfolge ist die
// serverseitige Eingangsreihenfolge, der Zeitstempel wird zusätzlich gespeichert.

function buzzIn(db, ctx, round, extra = {}) {
  if (round.resolved) fail('Diese Aufgabe ist bereits beendet.');
  if (round.locked.includes(ctx.teamId)) fail('Ihr seid für diese Aufgabe gesperrt.');
  if (round.buzzes.some((b) => b.teamId === ctx.teamId)) fail('Ihr habt bereits gebuzzert.');
  round.buzzes.push({ teamId: ctx.teamId, at: ctx.now, status: 'pending', ...extra });
  log(db, ctx, 'buzzer', `${teamName(db, ctx.teamId)} buzzert`);
  if (round.buzzes.filter((b) => b.status === 'pending').length === 1) effect(db, 'buzz');
}

function currentBuzz(round) {
  return round.buzzes.find((b) => b.status === 'pending') || null;
}

function buzzTeamView(round, teamId) {
  const own = round.buzzes.find((b) => b.teamId === teamId);
  const current = currentBuzz(round);
  return {
    buzzed: !!own,
    ownStatus: own ? own.status : null,
    locked: round.locked.includes(teamId),
    answering: current ? current.teamId === teamId : false,
  };
}

// Entfernung in Kilometern zwischen zwei Punkten auf der Erde.
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

module.exports = {
  QuizError, fail, newId, randomInt, log, effect, teamName, teamIds, totals, bookTarget, cleanText, cleanInk, cleanChoice, pts,
  buzzIn, currentBuzz, buzzTeamView, distanceKm,
};
