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
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.submit', { text: 'x' }), /nicht freigegeben/);
  game.applyAction(db, mod(), 'play.open', { qIndex: 0 });
  game.applyAction(db, team(ids[0]), 'play.submit', { text: '1440' });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.submit', { text: 'anders' }), /gesperrt/);

  game.applyAction(db, mod(), 'play.grade', { teamId: ids[0], correct: true });
  game.applyAction(db, mod(), 'play.grade', { teamId: ids[0], correct: true });
  assert.equal(game.totals(db)[ids[0]], 1);

  // Korrektur auf falsch erzeugt eine Gegenbuchung, keine Minuspunkte.
  game.applyAction(db, mod(), 'play.grade', { teamId: ids[0], correct: false });
  assert.equal(game.totals(db)[ids[0]], 0);
  assert.equal(db.ledger.length, 2);
});

test('Spiel 1: Lösung erst nach Bewertung aller Abgaben', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'play.open', { qIndex: 1 });
  game.applyAction(db, team(ids[1]), 'play.submit', { text: 'Grün' });
  assert.throws(() => game.applyAction(db, mod(), 'play.revealSolution'), /bewerten/);
  assert.equal(game.beamerView(db).gameView, undefined);
  game.applyAction(db, mod(), 'play.grade', { teamId: ids[1], correct: true });
  game.applyAction(db, mod(), 'play.revealSolution');
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });
  assert.equal(game.beamerView(db).gameView.solution, 'Grün');
  assert.throws(() => game.applyAction(db, team(ids[2]), 'play.submit', { text: 'zu spät' }), /nicht freigegeben/);
});

test('Doppelte Aktions-ID wird nur einmal verarbeitet', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'play.open', { qIndex: 0 });
  game.applyAction(db, team(ids[0]), 'play.submit', { text: 'a' });
  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 2, reason: 'Test' }, 'evt-1');
  const r = game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 2, reason: 'Test' }, 'evt-1');
  assert.equal(r.duplicate, true);
  assert.equal(game.totals(db)[ids[0]], 2);
});

test('Privatsphäre: Teams sehen keine fremden Antworten, Beamer nur freigegebene', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'play.open', { qIndex: 0 });
  game.applyAction(db, team(ids[0]), 'play.submit', { text: 'GEHEIM-A' });
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });

  const viewB = JSON.stringify(game.teamView(db, ids[1]));
  assert.ok(!viewB.includes('GEHEIM-A'));
  assert.ok(!viewB.includes(db.project.teams[0].code));
  assert.ok(!JSON.stringify(game.beamerView(db)).includes('GEHEIM-A'));

  game.applyAction(db, mod(), 'play.showAnswer', { teamId: ids[0], visible: true });
  assert.ok(JSON.stringify(game.beamerView(db)).includes('GEHEIM-A'));
  // Beamer und Teams sehen nie Zugangscodes oder Punktestände.
  const beamer = JSON.stringify(game.beamerView(db));
  for (const t of db.project.teams) assert.ok(!beamer.includes(t.code));
  // Punkte erscheinen auf dem Beamer nur in der Münzansicht.
  assert.ok(game.beamerView(db).teams.every((t) => !('points' in t)));
  assert.equal(game.teamView(db, ids[1]).ranking, undefined);
});

test('Teams dürfen keine Moderationsaktionen ausführen', () => {
  const { db, ids } = setup();
  assert.throws(() => game.applyAction(db, team(ids[0]), 'points.adjust', { teamId: ids[0], points: 5, reason: 'x' }), /nicht erlaubt/);
  assert.throws(() => game.applyAction(db, { role: 'beamer', now: 1 }, 'play.submit', { text: 'x' }), /nicht erlaubt/);
});

test('Spiel 5: Punktwert hängt vom Hinweis beim Buzzern ab, falsches Team bleibt gesperrt', () => {
  const { db, ids } = setup();
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'trumpf5') });
  game.applyAction(db, mod(), 'play.start', { termIndex: 0 });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.buzz'), /kein Hinweis/);
  game.applyAction(db, mod(), 'play.nextHint');
  game.applyAction(db, mod(), 'play.nextHint');
  game.applyAction(db, team(ids[0]), 'play.buzz');
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.buzz'), /bereits gebuzzert/);
  game.applyAction(db, team(ids[1]), 'play.buzz');
  assert.throws(() => game.applyAction(db, mod(), 'play.nextHint'), /Erst die Antwort/);

  game.applyAction(db, mod(), 'play.judge', { correct: false });
  assert.equal(game.teamView(db, ids[0]).play.locked, true);
  assert.equal(game.teamView(db, ids[0]).play.canBuzz, false);
  assert.equal(game.teamView(db, ids[1]).play.answering, true);

  game.applyAction(db, mod(), 'play.judge', { correct: true });
  assert.equal(game.totals(db)[ids[1]], 4); // gebuzzert bei Hinweis 2 → 4 Punkte
  assert.equal(game.totals(db)[ids[0]], 0);

  game.applyAction(db, mod(), 'play.start', { termIndex: 1 });
  game.applyAction(db, mod(), 'play.nextHint');
  assert.equal(game.teamView(db, ids[0]).play.canBuzz, true);
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
    game.applyAction(db, mod(), 'play.start', { termIndex: 0 });
    game.applyAction(db, mod(), 'play.nextHint');
    game.applyAction(db, team(ids[0]), 'play.buzz');
    game.applyAction(db, mod(), 'play.judge', { correct: true });
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
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'nerd') });
  assert.equal(db.live.activeGame, gid(db, 'nerd'));
});

test('Neuer Zugangscode macht den alten ungültig', () => {
  const { db, ids } = setup();
  const old = db.project.teams[0].code;
  assert.equal(old.length, 10);
  assert.equal(game.findTeamByCode(db, old.toLowerCase()).id, ids[0]);
  game.applyAction(db, mod(), 'team.regenCode', { teamId: ids[0] });
  assert.equal(game.findTeamByCode(db, old), null);
});

// ---------- Spiele 2, 3, 4, 6, 7, 8 ----------

function activate(db, type, content) {
  const id = gid(db, type);
  if (content) game.applyAction(db, mod(), 'game.update', { gameId: id, content });
  game.applyAction(db, mod(), 'show.activate', { gameId: id });
  return id;
}

const q = (correct) => ({ question: 'Frage?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, correct });

test('Jauch: Leiter, Sicherheitsstufe, Aussteigen und Joker', () => {
  const { db, ids } = setup(3);
  activate(db, 'jauch', { questions: Array.from({ length: 8 }, () => q('A')) });
  const [a, b, c] = ids;
  const play = (t, name, p) => game.applyAction(db, team(t), `play.${name}`, p);

  // Frage 1–4: alle richtig außer c bei Frage 2 (vor der Sicherheitsstufe → 0 Punkte).
  for (let i = 0; i < 4; i++) {
    game.applyAction(db, mod(), 'play.next');
    if (i === 0) {
      play(a, 'joker', { kind: 'fifty' });
      assert.throws(() => play(b, 'joker', { kind: 'phone' }), /bereits ein Team/);
      assert.equal(game.teamView(db, a).play.removed.length, 2);
      assert.ok(!game.teamView(db, a).play.removed.includes('A'));
      assert.equal(game.teamView(db, b).play.removed.length, 0);
    }
    play(a, 'answer', { choice: 'A' });
    play(b, 'answer', { choice: 'A' });
    if (game.teamView(db, c).play.status === 'active') play(c, 'answer', { choice: i === 1 ? 'B' : 'A' });
    assert.throws(() => game.applyAction(db, mod(), 'play.next'), /auflösen/);
    game.applyAction(db, mod(), 'play.reveal');
  }
  assert.deepEqual([a, b, c].map((t) => game.totals(db)[t]), [5, 5, 0]);
  assert.equal(game.teamView(db, c).play.status, 'out');
  assert.equal(game.teamView(db, c).play.outAt, 2);

  // b steigt freiwillig aus und behält 5.
  play(b, 'quit');
  // Frage 5: a mit Telefonjoker; a darf erst antworten, wenn alle anderen gesperrt haben – hier ist a allein.
  game.applyAction(db, mod(), 'play.next');
  play(a, 'joker', { kind: 'phone' });
  play(a, 'answer', { choice: 'A' });
  game.applyAction(db, mod(), 'play.reveal');
  assert.equal(game.totals(db)[a], 6);
  // Frage 6 falsch: Rückfall auf die Sicherheitsstufe 5.
  game.applyAction(db, mod(), 'play.next');
  play(a, 'answer', { choice: 'D' });
  game.applyAction(db, mod(), 'play.reveal');
  assert.deepEqual([a, b, c].map((t) => game.totals(db)[t]), [5, 5, 0]);
  assert.throws(() => game.applyAction(db, mod(), 'play.next'), /Kein Team/);
  const beamer = game.beamerView(db);
  assert.equal(beamer.gameView, undefined);
});

test('Jauch: Telefonjoker wartet, bis alle anderen gesperrt haben; Antworten bleiben geheim', () => {
  const { db, ids } = setup(2);
  activate(db, 'jauch', { questions: Array.from({ length: 8 }, () => q('C')) });
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });
  game.applyAction(db, mod(), 'play.next');
  game.applyAction(db, team(ids[0]), 'play.joker', { kind: 'phone' });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.answer', { choice: 'C' }), /Telefonjoker/);
  game.applyAction(db, team(ids[1]), 'play.answer', { choice: 'B' });
  assert.ok(!JSON.stringify(game.teamView(db, ids[0])).includes('"choice":"B"'));
  assert.equal(game.beamerView(db).gameView.correct, null);
  assert.ok(game.beamerView(db).gameView.phoneRunning);
  game.applyAction(db, team(ids[0]), 'play.answer', { choice: 'C' });
  game.applyAction(db, mod(), 'play.reveal');
  const v = game.beamerView(db).gameView;
  assert.equal(v.correct, 'C');
  assert.equal(v.joker.kind, 'phone');
  assert.equal(game.totals(db)[ids[0]], 1);
});

test('Dummes: Buzzer, 10-Sekunden-Fenster, ein Tausch im ganzen Spiel', () => {
  const { db, ids } = setup(3);
  const [a, b, c] = ids;
  activate(db, 'dummes');
  const play = (t, name, p, now) => game.applyAction(db, { ...team(t), ...(now ? { now } : {}) }, `play.${name}`, p);
  game.applyAction(db, mod(), 'play.open', { qIndex: 0 }); // richtig: B
  assert.throws(() => play(a, 'buzz'), /Erst die eigene Antwort/);
  play(a, 'answer', { choice: 'A' }, 50000);
  play(a, 'buzz', {}, 50001);
  play(b, 'answer', { choice: 'B' }, 52000);
  assert.throws(() => play(b, 'buzz', {}, 52001), /schneller/);
  // c verpasst das Fenster und darf erst nach Freigabe abgeben.
  assert.throws(() => play(c, 'answer', { choice: 'C' }, 70000), /10 Sekunden/);
  assert.equal(game.teamView(db, a, 70000).play.swapTargets.length, 1);
  game.applyAction(db, mod(), 'play.allowLate', { teamId: c });
  play(c, 'answer', { choice: 'C' }, 71000);
  // Tauschdetails sind vor der Auswertung geheim.
  play(a, 'swap', { teamId: b }, 72000);
  assert.equal(game.teamView(db, b, 72000).play.choice, 'B');
  assert.equal(game.teamView(db, b, 72000).play.swappedWith, null);
  game.applyAction(db, mod(), 'play.evaluate');
  assert.deepEqual([a, b, c].map((t) => game.totals(db)[t]), [1, 0, 0]);
  assert.equal(game.teamView(db, b, 72000).play.final, 'A');
  assert.equal(game.teamView(db, b, 72000).play.swappedWith, db.project.teams[0].name);
  // Der Tausch ist verbraucht: in Frage 2 gibt es keinen Buzzer mehr.
  game.applyAction(db, mod(), 'play.open', { qIndex: 1 });
  play(b, 'answer', { choice: 'C' });
  assert.throws(() => play(b, 'buzz'), /schon genutzt/);
  game.applyAction(db, mod(), 'play.evaluate');
  game.applyAction(db, mod(), 'play.grade', { teamId: b, correct: false });
  assert.equal(game.totals(db)[b], 0);
  assert.equal(game.nextWake(db, 0), null);
});

test('Musik: Feld wählen, Buzzer, falsch sperrt, richtig gibt Feldpunkte', () => {
  const { db, ids } = setup(2);
  activate(db, 'musik');
  game.applyAction(db, mod(), 'play.pick', { cat: 4, field: 2 });
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.buzz'), /läuft noch nicht/);
  game.applyAction(db, mod(), 'play.start');
  game.applyAction(db, team(ids[0]), 'play.buzz');
  game.applyAction(db, team(ids[1]), 'play.buzz');
  game.applyAction(db, mod(), 'play.judge', { correct: false });
  assert.equal(game.teamView(db, ids[0]).play.current.locked, true);
  game.applyAction(db, mod(), 'play.judge', { correct: true });
  assert.deepEqual(ids.map((t) => game.totals(db)[t]), [0, 3]);
  assert.throws(() => game.applyAction(db, mod(), 'play.pick', { cat: 4, field: 2 }), /schon gespielt/);
  assert.equal(game.teamView(db, ids[0]).play.board[4].fields[2].winner, ids[1]);
  game.applyAction(db, mod(), 'play.pick', { cat: 0, field: 0 });
  game.applyAction(db, mod(), 'play.close');
  assert.equal(game.teamView(db, ids[0]).play.board[0].fields[0].played, true);
});

test('Nerd: geheime Gebote, Stichentscheid, erster und zweiter Versuch', () => {
  const { db, ids } = setup(3);
  const [a, b, c] = ids;
  activate(db, 'nerd');
  game.applyAction(db, mod(), 'play.open', { catIndex: 0 });
  game.applyAction(db, team(a), 'play.bid', { bid: 4 });
  game.applyAction(db, team(b), 'play.bid', { bid: 4 });
  assert.equal(game.teamView(db, c).play.bids, null);
  assert.throws(() => game.applyAction(db, mod(), 'play.revealBids'), /Noch kein Gebot/);
  game.applyAction(db, team(c), 'play.bid', { bid: 2 });
  game.applyAction(db, mod(), 'play.revealBids');
  // Gleichstand wird nicht stillschweigend aufgelöst.
  assert.equal(db.live.games[gid(db, 'nerd')].rounds[0].phase, 'choose');
  game.applyAction(db, mod(), 'play.choose', { teamId: b });
  const mark = (p) => game.applyAction(db, mod(), 'play.mark', p);
  mark({ answer: 'Mario' });
  mark({ answer: 'Mario' }); // doppelt = Fehler
  mark({ text: 'Sonic' });
  mark({ text: 'Pikachu' }); // dritter Fehler → b verliert 4
  assert.equal(game.totals(db)[b], -4);
  // Standardregel: das gleich hohe Gebot von a zählt nicht als zweithöchstes – c bekommt den Versuch mit Ziel 4.
  const v = game.teamView(db, c).play;
  assert.equal(v.attempt.teamId, c);
  assert.equal(v.attempt.target, 4);
  mark({ text: 'falsch' });
  mark({ text: 'falsch' }); // zweiter Fehler → c verliert höchstens 3 (Gebot 2)
  assert.deepEqual([a, b, c].map((t) => game.totals(db)[t]), [0, -4, -2]);
  game.applyAction(db, mod(), 'play.open', { catIndex: 1 });
  game.applyAction(db, team(a), 'play.bid', { bid: 2 });
  game.applyAction(db, mod(), 'play.revealBids', { force: true });
  mark({ answer: 'Pakistan' });
  game.applyAction(db, mod(), 'play.unmark');
  mark({ answer: 'Pakistan' });
  mark({ answer: 'Afghanistan' });
  assert.equal(game.totals(db)[a], 2);
});

test('Kassenschlager: Paywall, Züge, private Ergebnisse, Ausscheiden und Umrechnung', () => {
  const { db, ids } = setup(2);
  const [a, b] = ids;
  activate(db, 'kassenschlager');
  const play = (t, name, p) => game.applyAction(db, team(t), `play.${name}`, p);
  game.applyAction(db, mod(), 'play.startMovie', { movieIndex: 0 });
  assert.throws(() => play(b, 'buy', { hint: 0 }), /nicht am Zug/);
  assert.throws(() => play(a, 'answer', { text: 'Titanic' }), /Erst einen Hinweis/);
  play(a, 'buy', { hint: 3 }); // 4 $
  assert.throws(() => play(a, 'buy', { hint: 0 }), /Antwort/);
  assert.equal(game.teamView(db, a).play.hints[3].text, 'Leonardo DiCaprio');
  assert.equal(game.teamView(db, b).play.hints[3].text, null);
  assert.equal(game.teamView(db, a).play.wallet, 16);
  assert.equal(game.teamView(db, b).play.wallet, 20);
  assert.ok(!JSON.stringify(game.beamerView(db)).includes('wallet'));
  play(a, 'answer', { text: 'Titanic' });
  game.applyAction(db, mod(), 'play.grade', { correct: true });
  assert.equal(game.teamView(db, a).play.wallet, 21);
  assert.ok(!JSON.stringify(game.beamerView(db)).includes('Titanic'));
  // b gibt sein ganzes Geld aus und rät falsch → nach dem Film mit 0 $ raus.
  const st = db.live.games[gid(db, 'kassenschlager')];
  st.wallet[b] = 4;
  play(b, 'buy', { hint: 3 });
  play(b, 'answer', { text: 'Avatar' });
  game.applyAction(db, mod(), 'play.grade', { correct: false });
  // a hat gelöst und wird übersprungen; b kann nichts mehr kaufen und darf direkt raten.
  assert.equal(game.teamView(db, b).play.phase, 'answer');
  play(b, 'answer', { text: 'Avatar 2' });
  game.applyAction(db, mod(), 'play.grade', { correct: false });
  game.applyAction(db, mod(), 'play.endMovie');
  assert.equal(game.teamView(db, b).play.out, true);
  assert.equal(game.teamView(db, b).play.title, 'Titanic');
  game.applyAction(db, mod(), 'play.startMovie', { movieIndex: 1 });
  assert.deepEqual(st.movies[1].order, [a]);
  game.applyAction(db, mod(), 'play.endMovie');
  game.applyAction(db, mod(), 'play.convert');
  assert.deepEqual([a, b].map((t) => game.totals(db)[t]), [11, 0]);
  assert.throws(() => game.applyAction(db, mod(), 'play.convert'), /bereits/);
});

test('Land: Punkte setzen, Tipps zeigen, Zielort enthüllen, nächster gewinnt', () => {
  const { db, ids } = setup(3);
  const [a, b, c] = ids;
  activate(db, 'land');
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });
  game.applyAction(db, mod(), 'play.open', { taskIndex: 0 }); // Paris
  game.applyAction(db, team(a), 'play.guess', { lat: 48.0, lng: 2.0 });
  game.applyAction(db, team(b), 'play.guess', { lat: 52.5, lng: 13.4 });
  assert.throws(() => game.applyAction(db, team(a), 'play.guess', { lat: 1, lng: 1 }), /gesperrt/);
  assert.throws(() => game.applyAction(db, team(c), 'play.guess', { lat: 200, lng: 1 }), /Ungültig/);
  assert.equal(game.teamView(db, b).play.guesses, null);
  assert.equal(game.beamerView(db).gameView.target, null);
  assert.throws(() => game.applyAction(db, mod(), 'play.revealTarget'), /Zuerst/);
  game.applyAction(db, mod(), 'play.revealGuesses');
  assert.equal(game.beamerView(db).gameView.guesses.length, 2);
  assert.throws(() => game.applyAction(db, team(c), 'play.guess', { lat: 48.8, lng: 2.3 }), /nicht freigegeben/);
  game.applyAction(db, mod(), 'play.revealTarget');
  assert.deepEqual(game.beamerView(db).gameView.winners, [a]);
  assert.deepEqual([a, b, c].map((t) => game.totals(db)[t]), [1, 0, 0]);
  game.applyAction(db, mod(), 'play.setWinner', { teamId: b });
  assert.deepEqual([a, b, c].map((t) => game.totals(db)[t]), [0, 1, 0]);
});

test('Spielaktionen gehen nur an das aktive Spiel', () => {
  const { db, ids } = setup(1);
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.buzz'), /kein Spiel aktiv/);
  activate(db, 'leichte5');
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.buzz'), /passt nicht/);
  assert.throws(() => game.applyAction(db, team(ids[0]), 'play.open', { qIndex: 0 }), /passt nicht/);
  assert.throws(() => game.applyAction(db, { role: 'beamer', now: 1 }, 'play.open', { qIndex: 0 }), /nicht erlaubt/);
});

test('Mehrere Shows: anlegen, umbenennen, wechseln, duplizieren, löschen', () => {
  const { db, ids } = setup(2);
  const first = db.project.id;
  game.applyAction(db, mod(), 'points.adjust', { teamId: ids[0], points: 3, reason: 'Test' });
  game.applyAction(db, mod(), 'shows.rename', { showId: first, name: 'Show 12.11.', date: '2026-11-12' });
  const r = game.applyAction(db, mod(), 'shows.create', { name: 'Show 03.12.', copyTeams: true });
  assert.equal(db.project.id, r.created);
  assert.equal(db.project.teams.length, 2);
  assert.equal(game.totals(db)[ids[0]], 0);
  assert.equal(db.project.games.length, 8);
  // Teams mit gleichem Code bleiben in der neuen Show angemeldet.
  assert.equal(game.teamView(db, ids[0]).team.id, ids[0]);
  const list = game.moderatorView(db).shows;
  assert.deepEqual(list.map((x) => x.name), ['Show 12.11.', 'Show 03.12.']);
  assert.equal(list.find((x) => x.current).id, r.created);

  game.applyAction(db, mod(), 'shows.switch', { showId: first });
  assert.equal(db.project.name, 'Show 12.11.');
  assert.equal(game.totals(db)[ids[0]], 3);

  game.applyAction(db, mod(), 'show.activate', { gameId: db.project.games[0].id });
  assert.throws(() => game.applyAction(db, mod(), 'shows.switch', { showId: r.created }), /Spiel beenden/);
  game.applyAction(db, mod(), 'show.activate', { gameId: null });

  const d = game.applyAction(db, mod(), 'shows.duplicate', { showId: first });
  const copy = db.shows.find((x) => x.project.id === d.created);
  assert.equal(copy.project.name, 'Show 12.11. (Kopie)');
  assert.notEqual(copy.project.games[0].id, db.project.games[0].id);
  assert.equal(copy.ledger.length, 0);
  assert.throws(() => game.applyAction(db, mod(), 'shows.remove', { showId: first }), /geöffnete Show/);
  game.applyAction(db, mod(), 'shows.remove', { showId: d.created });
  assert.equal(db.shows.length, 1);
  assert.throws(() => game.applyAction(db, mod(), 'shows.rename', { showId: first, date: '12.11.2026' }), /Datum/);
});

test('Handschrift: Spiel 1 und Kassenschlager nehmen PNG-Antworten an und prüfen sie', () => {
  const INK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const { db, ids } = setup(2);
  const [a, b] = ids;
  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'leichte5') });
  game.applyAction(db, mod(), 'play.open', { qIndex: 0 });
  assert.throws(() => game.applyAction(db, team(a), 'play.submit', { ink: 'data:text/html;base64,PHNjcmlwdD4=' }), /Ungültige Handschrift/);
  assert.throws(() => game.applyAction(db, team(a), 'play.submit', { ink: `data:image/png;base64,${'A'.repeat(400001)}` }), /zu groß/);
  assert.throws(() => game.applyAction(db, team(a), 'play.submit', {}), /aufschreiben/);
  game.applyAction(db, team(a), 'play.submit', { ink: INK });
  assert.equal(game.teamView(db, a).play.answer.ink, INK);
  game.applyAction(db, mod(), 'play.showAnswer', { teamId: a, visible: true });
  game.applyAction(db, mod(), 'beamer.show', { view: 'game' });
  assert.equal(game.beamerView(db).gameView.answers[0].ink, INK);
  assert.equal(game.teamView(db, b).play.answer, null);

  game.applyAction(db, mod(), 'show.activate', { gameId: gid(db, 'kassenschlager') });
  game.applyAction(db, mod(), 'play.startMovie', { movieIndex: 0 });
  game.applyAction(db, team(a), 'play.buy', { hint: 3 });
  game.applyAction(db, team(a), 'play.answer', { ink: INK });
  game.applyAction(db, mod(), 'play.grade', { correct: false });
  assert.equal(game.teamView(db, a).play.lastAnswer.ink, INK);
  assert.ok(!JSON.stringify(game.beamerView(db)).includes(INK));
});

test('Avatare: nur gültige Bilder, nur auf dem Beamer bei Intro und Münze, entfernbar', () => {
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const { db, ids } = setup(2);
  assert.throws(() => game.applyAction(db, mod(), 'team.update', { teamId: ids[0], avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }), /Ungültiges Bild/);
  assert.throws(() => game.applyAction(db, team(ids[0]), 'team.update', { teamId: ids[0], avatar: IMG }), /nicht erlaubt/);
  game.applyAction(db, mod(), 'team.update', { teamId: ids[0], avatar: IMG });
  assert.ok(!JSON.stringify(game.beamerView(db)).includes(IMG));
  assert.ok(!JSON.stringify(game.teamView(db, ids[1])).includes(IMG));
  game.applyAction(db, mod(), 'beamer.show', { view: 'intro' });
  assert.equal(game.beamerView(db).teams[0].avatar, IMG);
  assert.equal(game.beamerView(db).teams[1].avatar, undefined);
  game.applyAction(db, mod(), 'beamer.show', { view: 'pause' });
  assert.equal(game.beamerView(db).view, 'pause');
  game.applyAction(db, mod(), 'team.update', { teamId: ids[0], avatar: null });
  assert.equal(db.project.teams[0].avatar, null);
});

test('Showablauf: Standardfolge, Weiter/Zurück lösen Spiel, Beamer und Münze aus', () => {
  const { db, ids } = setup(2);
  const steps = game.moderatorView(db).rundown;
  assert.deepEqual(steps.slice(0, 6).map((s) => s.kind), ['start', 'intro', 'pyramid', 'pyramid', 'title', 'game']);
  assert.ok(steps.some((s) => s.kind === 'coin' && s.pos === 4));
  assert.ok(steps.some((s) => s.kind === 'pause'));
  assert.equal(steps.at(-1).kind, 'end');
  assert.throws(() => game.applyAction(db, mod(), 'run.prev', {}), /erste Schritt/);
  game.applyAction(db, mod(), 'run.next', {});
  assert.equal(db.live.beamer.view, 'start');
  const titleIdx = steps.findIndex((s) => s.kind === 'title' && s.pos === 2);
  game.applyAction(db, mod(), 'run.goto', { index: titleIdx });
  assert.equal(db.live.activeGame, db.project.games[1].id);
  assert.equal(db.live.beamer.view, 'title');
  // Münze: Gleichstand → Hinweis, kein Beamerwechsel zur Münze
  const coinIdx = steps.findIndex((s) => s.kind === 'coin' && s.pos === 4);
  const r = game.applyAction(db, mod(), 'run.goto', { index: coinIdx });
  assert.ok(r.notice);
  assert.equal(db.live.warning.kind, 'coinTie');
  assert.throws(() => game.applyAction(db, mod(), 'run.next', {}), /noch nicht vergeben/);
  game.applyAction(db, mod(), 'coin.awardTie', { teamId: ids[1] });
  assert.equal(db.live.beamer.view, 'coin');
  assert.equal(db.live.coins[0].teamId, ids[1]);
  game.applyAction(db, mod(), 'run.next', {});
  assert.equal(db.live.beamer.view, 'pause');
  // eigener Ablauf mit zusätzlicher Pause; ungültige Schritte werden abgelehnt
  const custom = steps.map(({ id, kind, pos }) => ({ id, kind, pos }));
  custom.splice(2, 0, { kind: 'pause' });
  game.applyAction(db, mod(), 'rundown.set', { steps: custom });
  assert.equal(game.moderatorView(db).rundown[2].kind, 'pause');
  assert.throws(() => game.applyAction(db, mod(), 'rundown.set', { steps: [{ kind: 'coin', pos: 3 }] }), /4, 6 und 8/);
  assert.throws(() => game.applyAction(db, mod(), 'rundown.set', { steps: [{ kind: 'quatsch' }] }), /Unbekannter/);
  game.applyAction(db, mod(), 'rundown.reset', {});
  assert.equal(game.moderatorView(db).rundownCustom, false);
});
