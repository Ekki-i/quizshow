'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../server/game');

let clock = 1000;
const mod = () => ({ role: 'moderator', actor: 'moderator', now: clock++ });
const team = (teamId) => ({ role: 'team', teamId, actor: `team:${teamId}`, now: clock++ });

function setup(teamCount = 3) {
  const db = game.createState();
  for (let i = 0; i < teamCount; i++) game.applyAction(db, mod(), 'team.add', { name: `Team ${i + 1}` });
  return { db, ids: db.project.teams.map((t) => t.id) };
}

const gid = (db, type) => db.project.games.find((g) => g.type === type).id;

test('Spiel 1: Abgabe ist gesperrt und richtige Bewertung gibt genau einen Punkt', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'g1.submit', { text: 'x' }), /nicht freigegeben/);
  game.applyAction(db, mod(), 'g1.open', { qIndex: 0 });
  game.applyAction(db, team(ids[0]), 'g1.submit', { text: '1440' });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'g1.submit', { text: 'anders' }), /gesperrt/);

  game.applyAction(db, mod(), 'g1.grade', { teamId: ids[0], correct: true });
  game.applyAction(db, mod(), 'g1.grade', { teamId: ids[0], correct: true });
  assert.equal(game.totals(db)[ids[0]], 1);

  // Korrektur auf falsch erzeugt eine Gegenbuchung, keine Minuspunkte.
  game.applyAction(db, mod(), 'g1.grade', { teamId: ids[0], correct: false });
  assert.equal(game.totals(db)[ids[0]], 0);
  assert.equal(db.ledger.length, 2);
});

test('Spiel 1: Lösung erst nach Bewertung aller Abgaben', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'g1.open', { qIndex: 1 });
  game.applyAction(db, team(ids[1]), 'g1.submit', { text: 'Grün' });
  assert.throws(() => game.applyAction(db, mod(), 'g1.revealSolution'), /bewerten/);
  assert.equal(game.beamerView(db).gameView, undefined);
  game.applyAction(db, mod(), 'g1.grade', { teamId: ids[1], correct: true });
  game.applyAction(db, mod(), 'g1.revealSolution');
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });
  assert.equal(game.beamerView(db).gameView.solution, 'Grün');
  assert.throws(() => game.applyAction(db, team(ids[2]), 'g1.submit', { text: 'zu spät' }), /nicht freigegeben/);
});

test('Doppelte Aktions-ID wird nur einmal verarbeitet', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'g1.open', { qIndex: 0 });
  game.applyAction(db, team(ids[0]), 'g1.submit', { text: 'a' });
  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 2, reason: 'Test' }, 'evt-1');
  const r = game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 2, reason: 'Test' }, 'evt-1');
  assert.equal(r.duplicate, true);
  assert.equal(game.totals(db)[ids[0]], 2);
});

test('Privatsphäre: Teams sehen keine fremden Antworten, Beamer nur freigegebene', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'g1.open', { qIndex: 0 });
  game.applyAction(db, team(ids[0]), 'g1.submit', { text: 'GEHEIM-A' });
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });

  const viewB = JSON.stringify(game.teamView(db, ids[1]));
  assert.ok(!viewB.includes('GEHEIM-A'));
  assert.ok(!viewB.includes(db.project.teams[0].code));
  assert.ok(!JSON.stringify(game.beamerView(db)).includes('GEHEIM-A'));

  game.applyAction(db, mod(), 'g1.showAnswer', { teamId: ids[0], visible: true });
  assert.ok(JSON.stringify(game.beamerView(db)).includes('GEHEIM-A'));
  // Beamer und Teams sehen nie Zugangscodes oder Punktestände.
  const beamer = JSON.stringify(game.beamerView(db));
  for (const t of db.project.teams) assert.ok(!beamer.includes(t.code));
  assert.equal(game.teamView(db, ids[1]).ranking, undefined);
});

test('Teams dürfen keine Moderationsaktionen ausführen', () => {
  const { db, ids } = setup();
  assert.throws(() => game.applyAction(db, team(ids[0]), 'points.adjust', { teamId: ids[0], points: 5, reason: 'x' }), /nicht erlaubt/);
  assert.throws(() => game.applyAction(db, { role: 'beamer', now: 1 }, 'g1.submit', { text: 'x' }), /nicht erlaubt/);
});

test('Spiel 5: Punktwert hängt vom Hinweis beim Buzzern ab, falsches Team bleibt gesperrt', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'trumpf5') });
  game.applyAction(db, mod(), 'g5.start', { termIndex: 0 });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'g5.buzz'), /kein Hinweis/);
  game.applyAction(db, mod(), 'g5.nextHint');
  game.applyAction(db, mod(), 'g5.nextHint');
  game.applyAction(db, team(ids[0]), 'g5.buzz');
  assert.throws(() => game.applyAction(db, team(ids[0]), 'g5.buzz'), /bereits gebuzzert/);
  game.applyAction(db, team(ids[1]), 'g5.buzz');
  assert.throws(() => game.applyAction(db, mod(), 'g5.nextHint'), /Erst die Antwort/);

  game.applyAction(db, mod(), 'g5.judge', { correct: false });
  assert.equal(game.teamView(db, ids[0]).g5.locked, true);
  assert.equal(game.teamView(db, ids[0]).g5.canBuzz, false);
  assert.equal(game.teamView(db, ids[1]).g5.answering, true);

  game.applyAction(db, mod(), 'g5.judge', { correct: true });
  assert.equal(game.totals(db)[ids[1]], 4); // gebuzzert bei Hinweis 2 → 4 Punkte
  assert.equal(game.totals(db)[ids[0]], 0);

  game.applyAction(db, mod(), 'g5.start', { termIndex: 1 });
  game.applyAction(db, mod(), 'g5.nextHint');
  assert.equal(game.teamView(db, ids[0]).g5.canBuzz, true);
});

test('Spiel 5: Punktetabelle 5 bis 1', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(game.trumpfPoints), [5, 4, 3, 2, 1]);
});

test('Undo erzeugt Gegenbuchung und kann nicht doppelt ausgeführt werden', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[2], points: 3, reason: 'Bonus' });
  const entry = db.ledger[0];
  game.applyAction(db, mod(), 'points.undo', { entryId: entry.id });
  assert.equal(game.totals(db)[ids[2]], 0);
  assert.equal(db.ledger.length, 2);
  assert.throws(() => game.applyAction(db, mod(), 'points.undo', { entryId: entry.id }), /bereits/);
  assert.throws(() => game.applyAction(db, mod(), 'points.adjust', { teamId: ids[2], points: 1, reason: '' }), /Begründung/);
});

test('Münze geht an das Team mit den meisten kumulierten Punkten, Gleichstand braucht Schätzfrage', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 3, reason: 'a' });
  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[1], points: 5, reason: 'b' });
  game.applyAction(db, mod(), 'coin.determine', { position: 4 });
  assert.equal(db.live.coins[0].teamId, ids[1]);
  assert.throws(() => game.applyAction(db, mod(), 'coin.determine', { position: 4 }), /bereits/);
  assert.throws(() => game.applyAction(db, mod(), 'coin.determine', { position: 5 }), /4, 6 und 8/);

  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 2, reason: 'c' });
  game.applyAction(db, mod(), 'coin.determine', { position: 6 });
  assert.equal(db.live.coins.length, 1);
  assert.equal(db.live.warning.kind, 'coinTie');
  assert.throws(() => game.applyAction(db, mod(), 'coin.awardTie', { teamId: ids[2] }), /Gleichstand/);
  game.applyAction(db, mod(), 'coin.awardTie', { teamId: ids[0] });
  assert.equal(db.live.coins[1].teamId, ids[0]);
  assert.equal(db.live.coins[1].method, 'Schätzfrage');
});

test('„Die leichten 5“ bleibt auf Position 1, außer per Sonderaktion', () => {
  const { db } = setup();
  const games = db.project.games;
  assert.throws(() => game.applyAction(db, mod(), 'game.moveTo', { gameId: games[1].id, index: 0 }), /Eröffnungsspiel/);
  assert.throws(() => game.applyAction(db, mod(), 'game.remove', { gameId: games[0].id }), /Sonderaktion/);
  const second = games[1].id;
  game.applyAction(db, mod(), 'game.moveTo', { gameId: second, index: 3 });
  assert.equal(db.project.games[3].id, second);
  game.applyAction(db, mod(), 'game.remove', { gameId: db.project.games[0].id, override: 'ENTFERNEN' });
  assert.equal(db.project.games.length, 7);
});

test('Spiele-Datenbank: alle acht Spiele vorhanden, Show frei zusammenstellbar, auch doppelt', () => {
  const { db } = setup();
  assert.deepEqual(db.library.map((e) => e.type), ['leichte5', 'dummes', 'land', 'kassenschlager', 'trumpf5', 'musik', 'jauch', 'nerd']);
  const trumpf = db.library.find((e) => e.type === 'trumpf5');
  assert.throws(() => game.applyAction(db, mod(), 'game.add', { libraryId: trumpf.id }), /schon 8 Spiele/);

  // Zwei Spiele entfernen und zweimal „5 ist Trümpf“ einsetzen.
  for (const type of ['dummes', 'land']) game.applyAction(db, mod(), 'game.remove', { gameId: gid(db, type) });
  game.applyAction(db, mod(), 'game.add', { libraryId: trumpf.id, index: 1 });
  game.applyAction(db, mod(), 'game.add', { libraryId: trumpf.id });
  const copies = db.project.games.filter((g) => g.type === 'trumpf5');
  assert.equal(copies.length, 3);
  assert.equal(db.project.games[1].type, 'trumpf5');

  // Kopien sind unabhängig voneinander und von der Datenbank.
  const content = structuredClone(copies[0].content);
  content.terms[0].hints[0] = 'Neuer Hinweis';
  game.applyAction(db, mod(), 'game.update', { gameId: copies[0].id, content, title: 'Trümpf Tiere' });
  assert.equal(copies[0].content.terms[0].hints[0], 'Neuer Hinweis');
  assert.notEqual(copies[1].content.terms[0].hints[0], 'Neuer Hinweis');
  assert.notEqual(trumpf.content.terms[0].hints[0], 'Neuer Hinweis');
  assert.equal(copies[0].title, 'Trümpf Tiere');
});

test('Zwei Instanzen desselben Spiels haben getrennte Punkte und Zustände', () => {
  const { db, ids } = setup();
  const trumpf = db.library.find((e) => e.type === 'trumpf5');
  game.applyAction(db, mod(), 'game.remove', { gameId: gid(db, 'dummes') });
  game.applyAction(db, mod(), 'game.add', { libraryId: trumpf.id });
  const [a, b] = db.project.games.filter((g) => g.type === 'trumpf5');
  for (const g of [a, b]) {
    game.applyAction(db, mod(), 'show.activate', { gameId: g.id });
    game.applyAction(db, mod(), 'g5.start', { termIndex: 0 });
    game.applyAction(db, mod(), 'g5.nextHint');
    game.applyAction(db, team(ids[0]), 'g5.buzz');
    game.applyAction(db, mod(), 'g5.judge', { correct: true });
  }
  assert.equal(game.totals(db)[ids[0]], 10);
});

test('Datenbank: anlegen, duplizieren, bearbeiten, löschen und Inhalte prüfen', () => {
  const { db } = setup();
  const r = game.applyAction(db, mod(), 'library.add', { type: 'jauch' });
  const entry = db.library.find((e) => e.id === r.created);
  assert.equal(entry.content.questions.length, 8);
  const bad = structuredClone(entry.content);
  bad.questions.pop();
  assert.throws(() => game.applyAction(db, mod(), 'library.update', { libraryId: entry.id, content: bad }), /genau 8/);
  const good = structuredClone(entry.content);
  good.questions[1].question = 'Wie hoch ist die Zugspitze?';
  good.questions[1].correct = 'Z';
  game.applyAction(db, mod(), 'library.update', { libraryId: entry.id, content: good });
  assert.equal(entry.content.questions[1].question, 'Wie hoch ist die Zugspitze?');
  assert.equal(entry.content.questions[1].correct, 'A'); // ungültige Auswahl fällt auf die erste Option zurück
  assert.equal(entry.version, 2);
  const d = game.applyAction(db, mod(), 'library.duplicate', { libraryId: entry.id });
  game.applyAction(db, mod(), 'library.remove', { libraryId: entry.id });
  assert.ok(db.library.find((e) => e.id === d.created));
  assert.ok(!db.library.find((e) => e.id === entry.id));
});

test('Showablauf ist gesperrt, solange ein Spiel läuft', () => {
  const { db } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'trumpf5') });
  assert.throws(() => game.applyAction(db, mod(), 'game.remove', { gameId: gid(db, 'nerd') }), /Zuerst das Spiel beenden/);
  assert.throws(() => game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'nerd') }), /noch nicht spielbar/);
});

test('Neuer Zugangscode macht den alten ungültig', () => {
  const { db, ids } = setup();
  const old = db.project.teams[0].code;
  assert.equal(old.length, 10);
  assert.equal(game.findTeamByCode(db, old.toLowerCase()).id, ids[0]);
  game.applyAction(db, mod(), 'team.regenCode', { teamId: ids[0] });
  assert.equal(game.findTeamByCode(db, old), null);
});
