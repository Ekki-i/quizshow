'use strict';

// Abnahmetests für die sieben neuen Module (Master-Prompt „7 neue Module“).

const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../server/game');
const { totals } = require('../server/core');
const { matchEntry } = require('../server/match');

let clock = 5_000_000;
const mod = () => ({ role: 'moderator', actor: 'moderator', now: clock++ });
const team = (teamId, now) => ({ role: 'team', teamId, actor: `team:${teamId}`, now: now ?? clock++ });

function setup(n = 3) {
  const db = game.createState();
  db.project.teams = [];
  for (let i = 0; i < n; i++) game.applyAction(db, mod(), 'team.add', { name: `Team ${i + 1}` });
  return { db, ids: db.project.teams.map((t) => t.id) };
}
function use(db, type, patch) {
  const entry = db.library.find((e) => e.type === type);
  game.applyAction(db, mod(), 'game.remove', { gameId: db.project.games[7].id });
  game.applyAction(db, mod(), 'game.add', { libraryId: entry.id });
  const g = db.project.games[7];
  if (patch) game.applyAction(db, mod(), 'game.update', { gameId: g.id, content: { ...structuredClone(g.content), ...patch } });
  game.applyAction(db, mod(), 'show.activate', { gameId: g.id });
  db.live.beamer = { view: 'game', data: {} };
  return g;
}
const act = (db, ctx, name, p = {}) => game.applyAction(db, ctx, `play.${name}`, p);
const tv = (db, id, now) => game.teamView(db, id, now).play;
const bv = (db) => game.beamerView(db).gameView;
const pts = (db, id) => totals(db)[id] || 0;

test('Neue Module stehen nur in der Datenbank, nicht automatisch in der Show', () => {
  const db = game.createState();
  for (const t of ['sortieren', 'gier', 'top100', 'star', 'timeline', 'chat', 'hostdu']) {
    assert.ok(db.library.some((e) => e.type === t), t);
    assert.ok(!db.project.games.some((g) => g.type === t), t);
  }
});

test('Blamieren oder Sortieren: unvollständig blockiert, 1 Punkt je richtigem Platz, max. 5, kein Bonus', () => {
  const { db, ids } = setup(3);
  use(db, 'sortieren');
  act(db, mod(), 'open', { index: 0 });
  assert.equal(tv(db, ids[0]).cards.length, 5);
  assert.throws(() => act(db, team(ids[0]), 'submit', { order: [0, 1, 2, 3] }), /alle fünf/);
  assert.throws(() => act(db, team(ids[0]), 'submit', { order: [0, 1, 2, 3, 3] }), /alle fünf/);
  act(db, team(ids[0]), 'submit', { order: [0, 1, 2, 3, 4] }); // alles richtig
  assert.throws(() => act(db, team(ids[0]), 'submit', { order: [4, 3, 2, 1, 0] }), /schon/);
  act(db, team(ids[1]), 'submit', { order: [1, 0, 2, 3, 4] }); // 3 richtig
  assert.throws(() => act(db, mod(), 'evaluate'), /nicht alle/);
  act(db, mod(), 'close'); // Moderation schließt manuell, Team 3 ohne Abgabe
  assert.throws(() => act(db, team(ids[2]), 'submit', { order: [0, 1, 2, 3, 4] }), /geschlossen/);
  act(db, mod(), 'evaluate');
  assert.equal(pts(db, ids[0]), 5);
  assert.equal(pts(db, ids[1]), 3);
  assert.equal(pts(db, ids[2]), 0);
  assert.equal(bv(db).solution.length, 5);
});

test('Riskier die Gier: 100 Startguthaben, 60 s, Nachfrist nur auf Freigabe und nur für offene Teams, jedes Team muss antworten, Punkte automatisch', () => {
  const { db, ids } = setup(3);
  use(db, 'gier', { seconds: 60, questions: [{ question: 'A', answer: 100, unit: '' }, { question: 'B', answer: 50, unit: '' }] });
  assert.equal(tv(db, ids[0]).balance, 100);
  const t0 = clock;
  act(db, { ...mod(), now: t0 }, 'open', { index: 0 });
  act(db, team(ids[0], t0 + 1000), 'answer', { value: 130 }); // −30
  assert.throws(() => act(db, team(ids[0], t0 + 2000), 'answer', { value: 100 }), /schon abgegeben/);
  assert.throws(() => act(db, team(ids[1], t0 + 61000), 'answer', { value: 100 }), /Zeit ist abgelaufen/);
  assert.throws(() => act(db, { ...mod(), now: t0 + 30000 }, 'grace'), /läuft noch/);
  act(db, { ...mod(), now: t0 + 62000 }, 'grace');
  act(db, team(ids[1], t0 + 65000), 'answer', { value: 99 }); // −1, in der Nachfrist
  assert.equal(tv(db, ids[0], t0 + 65000).canAnswer, false); // abgegeben bleibt gesperrt
  assert.throws(() => act(db, { ...mod(), now: t0 + 73000 }, 'evaluate'), /muss antworten/); // Team 3 fehlt
  act(db, { ...mod(), now: t0 + 74000 }, 'grace'); // Nachfrist erneut
  act(db, team(ids[2], t0 + 75000), 'answer', { value: 50 }); // −50
  act(db, { ...mod(), now: t0 + 76000 }, 'evaluate');
  assert.deepEqual(ids.map((id) => tv(db, id).balance), [70, 99, 50]);
  assert.equal(pts(db, ids[0]), 0); // Gier-Punkte sind keine Showpunkte
  const t1 = clock;
  act(db, { ...mod(), now: t1 }, 'open', { index: 1 });
  act(db, team(ids[0], t1 + 100), 'answer', { value: 150 }); // −100 → −30, raus
  act(db, team(ids[1], t1 + 100), 'answer', { value: 60 }); // −10 → 89
  act(db, team(ids[2], t1 + 100), 'answer', { value: 0 }); // −50 → 0, raus
  act(db, { ...mod(), now: t1 + 200 }, 'evaluate'); // entschieden: automatisch gebucht
  assert.equal(pts(db, ids[1]), 10); // letztes verbleibendes Team
  assert.equal(pts(db, ids[2]), 6); // 0 ist besser als −30
  assert.equal(pts(db, ids[0]), 4);
});

test('Riskier die Gier: gleiche Ausscheidungsrunde nach Restguthaben, Gleichstand teilt Platz', () => {
  const { db, ids } = setup(4);
  use(db, 'gier', { seconds: 60, questions: [{ question: 'A', answer: 0, unit: '' }] });
  const t0 = clock;
  act(db, { ...mod(), now: t0 }, 'open', { index: 0 });
  act(db, team(ids[0], t0 + 1), 'answer', { value: 10 }); // 90, bleibt
  act(db, team(ids[1], t0 + 1), 'answer', { value: 102 }); // −2
  act(db, team(ids[2], t0 + 1), 'answer', { value: 104 }); // −4
  act(db, team(ids[3], t0 + 1), 'answer', { value: 102 }); // −2
  act(db, { ...mod(), now: t0 + 2 }, 'evaluate');
  assert.deepEqual(ids.map((id) => pts(db, id)), [10, 6, 3, 6]); // Platz 2 geteilt, Platz 3 übersprungen → Platz 4 = 3
});

test('Top 100: tolerante Treffer, unsichere Treffer an die Moderation, Ranggruppen 1–5', () => {
  const list = Array.from({ length: 100 }, (_, i) => `Eintrag Nummer ${i + 1}`);
  list[0] = 'Volkswagen / VW'; list[24] = 'Die Ärzte'; list[59] = 'FC Bayern München'; list[99] = 'Mercedes-Benz';
  const { db, ids } = setup(4);
  use(db, 'top100', { rounds: [{ category: 'Test', source: 'Q', period: '2024', asOf: '', entries: list.join('\n') }] });
  act(db, mod(), 'open', { index: 0 });
  act(db, team(ids[0]), 'submit', { text: 'vw' }); // Abkürzung → Rang 1
  act(db, team(ids[1]), 'submit', { text: 'Arzte' }); // ohne Artikel/Umlaut → Rang 25
  act(db, team(ids[2]), 'submit', { text: 'Bayern' }); // nur Teil → unsicher
  act(db, team(ids[3]), 'submit', { text: 'Mercedes Bens' }); // Tippfehler → Rang 100
  assert.throws(() => act(db, mod(), 'evaluate'), /unsicheren/);
  act(db, mod(), 'setRank', { teamId: ids[2], rank: 60 });
  act(db, mod(), 'evaluate');
  assert.deepEqual(ids.map((id) => pts(db, id)), [1, 2, 3, 5]);
  act(db, mod(), 'setRank', { teamId: ids[0], rank: null }); // Korrektur nach Auswertung
  assert.equal(pts(db, ids[0]), 0);
  assert.equal(matchEntry('Eintrag Nummer 1', [{ key: 1, variants: ['Eintrag Nummer 1'] }, { key: 2, variants: ['Eintrag Nummer 2'] }]).sure, 1);
});

test('Ich bin ein Star: 8 Begriffe, genau einer falsch, Buzzer-Reihenfolge, max. 1 Punkt', () => {
  const { db, ids } = setup(3);
  const ex = structuredClone(db.library.find((e) => e.type === 'star').content);
  ex.puzzles[0].wrong = '– bitte wählen –';
  use(db, 'star', ex);
  assert.throws(() => act(db, mod(), 'open', { index: 0 }), /falsche/);
  act(db, mod(), 'open', { index: 1 }); // falsch = Begriff 6 (Index 5)
  act(db, team(ids[0]), 'buzz', { pick: 2 }); // schnellster, aber falsch
  act(db, team(ids[1]), 'buzz', { pick: 5 }); // richtig
  act(db, team(ids[2]), 'buzz', { pick: 5 }); // auch richtig, aber später
  assert.throws(() => act(db, team(ids[0]), 'buzz', { pick: 5 }), /schon/);
  assert.equal(bv(db).buzzOrder[0].pick, undefined); // Wahl vor Auflösung geheim
  act(db, mod(), 'resolve');
  assert.deepEqual(ids.map((id) => pts(db, id)), [0, 1, 0]);
});

test('Remember the Timeline: Referenz + 10, richtig +1, Fehler nur Durchgangspunkte, Ausstieg behält, Gutschrift genau einmal', () => {
  const { db, ids } = setup(2);
  const items = Array.from({ length: 10 }, (_, i) => ({ label: `E${i}`, value: String(2000 + i * 2) }));
  use(db, 'timeline', { rounds: [{ category: 'Test', reference: 'R', refValue: '2005', items }, { category: 'T2', reference: 'R', refValue: '2005', items }] });
  act(db, mod(), 'open', { index: 0 });
  let v = bv(db);
  assert.equal(v.line.length, 1);
  assert.equal(v.pool.length, 10);
  const r = db.live.games[db.project.games[7].id].rounds[0];
  const first = r.turn;
  const other = ids.find((x) => x !== first);
  const correctPos = (k) => r.line.filter((x) => (x === 'ref' ? 2005 : 2000 + x * 2) < 2000 + k * 2).length;
  act(db, team(first), 'place', { item: 0, pos: correctPos(0) }); // richtig
  assert.throws(() => act(db, team(first), 'place', { item: 1, pos: 0 }), /nicht am Zug/);
  act(db, team(other), 'place', { item: 9, pos: correctPos(9) }); // richtig
  act(db, team(first), 'place', { item: 1, pos: correctPos(1) }); // richtig → 2
  act(db, team(other), 'quit'); // behält 1
  act(db, team(first), 'place', { item: 8, pos: 0 }); // falsch → 0, raus
  v = bv(db);
  assert.equal(v.done, true);
  assert.equal(v.line.length, 5); // falscher Begriff wurde richtig eingefügt
  assert.equal(pts(db, first), 0);
  assert.equal(pts(db, other), 1);
  act(db, mod(), 'open', { index: 1 }); // nächster Durchgang
  const r2 = db.live.games[db.project.games[7].id].rounds[1];
  const [a2, b2] = [r2.turn, r2.order.find((x) => x !== r2.turn)];
  act(db, team(a2), 'quit');
  act(db, team(b2), 'quit');
  assert.equal(pts(db, other), 1); // frühere Durchgänge bleiben
  assert.throws(() => act(db, mod(), 'end'), /Schon/);
});

test('Remember the Timeline: gleiche Sortierwerte verhindern den Start', () => {
  const { db } = setup(2);
  const items = Array.from({ length: 10 }, (_, i) => ({ label: `E${i}`, value: String(2000 + i) }));
  items[3].value = '2005';
  use(db, 'timeline', { rounds: [{ category: 'X', reference: 'R', refValue: '2005', items }] });
  assert.throws(() => act(db, mod(), 'open', { index: 0 }), /Gleicher Sortierwert/);
});

test('Guck mal, wer da spricht: Buzzer ab Nachricht 1, falsch sperrt nur dieses Team, richtig +1, manuell beenden', () => {
  const { db, ids } = setup(3);
  use(db, 'chat');
  act(db, mod(), 'open', { index: 0 });
  assert.throws(() => act(db, team(ids[0]), 'buzz'), /ersten Nachricht/);
  assert.equal(bv(db).person, null);
  act(db, mod(), 'next');
  act(db, team(ids[0]), 'buzz');
  act(db, mod(), 'judge', { correct: false });
  assert.throws(() => act(db, team(ids[0]), 'buzz'), /gesperrt|bereits/);
  act(db, team(ids[1]), 'buzz');
  act(db, mod(), 'judge', { correct: true });
  assert.deepEqual(ids.map((id) => pts(db, id)), [0, 1, 0]);
  assert.equal(bv(db).person, 'Albert Einstein');
});

test('Host du das Zeug dafür: alle müssen einreichen, eigene Option gesperrt, Täuschungspunkte genau einmal', () => {
  const { db, ids } = setup(4);
  use(db, 'hostdu', { questions: [{ question: 'Was ist X?', answer: 'Ein Fisch', aliases: '' }] });
  act(db, mod(), 'open', { index: 0 });
  act(db, team(ids[0]), 'submit', { text: 'Ein Vogel' });
  act(db, team(ids[1]), 'submit', { text: 'ein vogel!' }); // wird mit Team 1 zusammengeführt
  act(db, team(ids[2]), 'submit', { text: 'Ein Fisch' }); // = richtige Antwort
  assert.throws(() => act(db, mod(), 'close'), /Jedes Team muss einreichen/);
  act(db, team(ids[3]), 'submit', { text: 'Eine Pflanze' });
  act(db, mod(), 'close');
  act(db, mod(), 'startVote');
  const opts = tv(db, ids[0]).options;
  assert.equal(opts.length, 3);
  const own = opts.find((o) => o.own);
  assert.equal(own.text, 'Ein Vogel');
  assert.throws(() => act(db, team(ids[0]), 'vote', { letter: own.letter }), /eigene/);
  const letter = (t) => tv(db, ids[0]).options.find((o) => o.text === t).letter;
  const fisch = tv(db, ids[3]).options.find((o) => o.text === 'Ein Fisch').letter;
  assert.throws(() => act(db, team(ids[2]), 'vote', { letter: fisch }), /eigene/); // richtige, aber selbst eingereicht
  act(db, team(ids[0]), 'vote', { letter: fisch }); // richtig +1
  act(db, team(ids[1]), 'vote', { letter: letter('Eine Pflanze') }); // Team 4 täuscht +1
  act(db, team(ids[2]), 'vote', { letter: letter('Ein Vogel') }); // Team 1 und 2 je +1
  act(db, team(ids[3]), 'vote', { letter: letter('Ein Vogel') }); // Team 1 und 2 je +1
  act(db, mod(), 'reveal');
  assert.deepEqual(ids.map((id) => pts(db, id)), [3, 2, 0, 1]);
});
