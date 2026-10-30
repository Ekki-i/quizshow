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

test('Wer nix werd, werd Nerd: Notizen nur in der Gebotsphase, danach privat und nur lesbar', () => {
  const { db, ids } = setup(2);
  game.applyAction(db, mod(), 'show.activate', { gameId: db.project.games.find((g) => g.type === 'nerd').id });
  db.live.beamer = { view: 'game', data: {} };
  const ink = 'data:image/png;base64,iVBORw0KGgo=';
  act(db, mod(), 'open', { catIndex: 0 });
  act(db, team(ids[0]), 'notes', { ink });
  assert.equal(tv(db, ids[0]).notesInk, null); // während der Gebote nicht in der Sicht
  act(db, team(ids[0]), 'bid', { bid: 3 });
  act(db, team(ids[0]), 'notes', { ink }); // nach eigenem Gebot noch änderbar
  act(db, team(ids[1]), 'bid', { bid: 2 });
  act(db, mod(), 'revealBids');
  assert.equal(tv(db, ids[0]).notesInk, ink);
  assert.equal(tv(db, ids[1]).notesInk, null); // fremde Notizen nie sichtbar
  assert.equal(JSON.stringify(game.beamerView(db)).includes(ink), false);
  assert.throws(() => act(db, team(ids[0]), 'notes', { ink }), /Gebotsphase/);
});

test('Punkte je Spiel im Editor änderbar (Regeln bleiben gleich)', () => {
  const { db, ids } = setup(2);
  const g = use(db, 'sortieren', { scoring: { position: 2 } });
  act(db, mod(), 'open', { index: 0 });
  act(db, team(ids[0]), 'submit', { order: [0, 1, 2, 4, 3] }); // 3 richtig
  act(db, team(ids[1]), 'submit', { order: [0, 1, 2, 3, 4] });
  act(db, mod(), 'evaluate');
  assert.equal(pts(db, ids[0]), 6);
  assert.equal(pts(db, ids[1]), 10);
  // leer = Standard
  const d = game.createState();
  const l5 = d.project.games[0];
  assert.equal(require('../server/scoring').pv(l5, 'correct'), 1);
  assert.ok(g.content.scoring);
});

test('Spieltitel-Lied: in der Show gesetzt → auch in der Datenbank, kommt in neue Shows mit; in der Datenbank setzbar', () => {
  const { db } = setup(2);
  const g = db.project.games[1];
  const media = { id: 'media_abcdefabcdef12', type: 'video/mp4', name: 'titel.mp4', size: 10 };
  game.applyAction(db, mod(), 'game.setIntro', { gameId: g.id, media });
  const entry = db.library.find((e) => e.id === g.libraryId);
  assert.equal(entry.intro.id, media.id);
  game.applyAction(db, mod(), 'game.remove', { gameId: db.project.games[7].id });
  game.applyAction(db, mod(), 'game.add', { libraryId: entry.id });
  assert.equal(db.project.games[7].intro.id, media.id);
  const other = db.library.find((e) => e.type === 'gier');
  game.applyAction(db, mod(), 'library.setIntro', { libraryId: other.id, media: { ...media, id: 'media_bbbbbbbbbbbb12', type: 'audio/mpeg' } });
  assert.ok(game.referencedMedia(db).has('media_bbbbbbbbbbbb12'));
});

test('Musikquiz: Clip läuft mit „Aufgabe starten“, pausiert beim Buzzern; Punkte je Feld änderbar', () => {
  const { db, ids } = setup(2);
  const g = db.project.games.find((x) => x.type === 'musik');
  const content = structuredClone(g.content);
  content.categories[0].fields[1].clip = { id: 'media_abcdefabcdef12', type: 'audio/mpeg', name: 'c.mp3', size: 1 };
  content.scoring = { field1: 1, field2: 5, field3: 9 };
  game.applyAction(db, mod(), 'game.update', { gameId: g.id, content });
  game.applyAction(db, mod(), 'show.activate', { gameId: g.id });
  db.live.beamer = { view: 'game', data: {} };
  act(db, mod(), 'pick', { cat: 0, field: 1 });
  act(db, mod(), 'start');
  assert.equal(bv(db).current.playback.state, 'playing');
  assert.equal(bv(db).current.clip.id, 'media_abcdefabcdef12');
  act(db, team(ids[0]), 'buzz');
  assert.equal(bv(db).current.playback.state, 'paused');
  act(db, mod(), 'judge', { correct: true });
  assert.equal(pts(db, ids[0]), 5);
});

test('Brain or Dreh’n: Joker im Editor änderbar (Name, Symbol, Text, Wert), ältere Inhalte bekommen Standard-Joker', () => {
  const { db } = setup(2);
  const brain = require('../server/play-brain');
  const g = use(db, 'brain');
  assert.equal(g.content.jokers.length, 16);
  const content = structuredClone(g.content);
  delete content.jokers; // alter Stand ohne Joker-Liste
  const lib = db.library.find((e) => e.type === 'brain');
  game.applyAction(db, mod(), 'library.update', { libraryId: lib.id, content });
  assert.equal(db.library.find((e) => e.type === 'brain').content.jokers.length, 16);
  const own = structuredClone(content);
  own.jokers = structuredClone(db.library.find((e) => e.type === 'brain').content.jokers);
  own.jokers[1] = { name: 'Großer Abzug', icon: '💥', text: 'Ihr verliert 5 Spielpunkte.', value: 5 };
  const w = brain.wheelOf({ type: 'brain', content: own });
  assert.equal(w[1].key, 'minus2'); // Wirkung bleibt
  assert.equal(w[1].name, 'Großer Abzug');
  assert.equal(w[1].value, 5);
  assert.equal(brain.wheelOf({ type: 'brain', content: {} })[0].name, 'Doppelpunkt');
  assert.equal(require('../server/scoring').pv({ type: 'nerd', content: { scoring: { maxPenalty: 5 } } }, 'maxPenalty'), 5);
});

test('Brain or Dreh’n: 6 gute + 6 fiese Joker per Auswahl aufs Rad, keine Doppelten', () => {
  const { db } = setup(2);
  const brain = require('../server/play-brain');
  const g = use(db, 'brain');
  const keys = () => brain.wheelFields(g).map((f) => f.key);
  // Standard: die ersten sechs guten und fiesen, abwechselnd.
  assert.deepEqual(keys(), ['doppel', 'minus2', 'streak', 'raub', 'fifty', 'verlust', 'raeuber', 'sperre', 'dieb', 'minus1', 'blockade', 'verbot']);
  g.content.goodSlots = ['tausch', 'detektiv', 'doppel', 'streak', 'fifty', 'dieb'].map((joker) => ({ joker }));
  g.content.badSlots = ['reset', 'enteignung', 'verbot', 'minus1', 'raub', 'minus2'].map((joker) => ({ joker }));
  assert.deepEqual(keys(), ['tausch', 'reset', 'detektiv', 'enteignung', 'doppel', 'verbot', 'streak', 'minus1', 'fifty', 'raub', 'dieb', 'minus2']);
  // Umbenannte Joker aus der Datenbank erscheinen so auf dem Rad.
  g.content.jokers[15] = { ...g.content.jokers[15], name: 'Alles weg' };
  assert.equal(brain.wheelFields(g)[1].name, 'Alles weg');
  // Doppelt gewählt: Start verweigert, Generalprobe-Check meldet es.
  g.content.badSlots[2] = { joker: 'reset' };
  assert.match(brain.slotProblem(g), /„Alles weg“ doppelt/);
  assert.throws(() => act(db, mod(), 'start'), /doppelt gewählt/);
  const report = require('../server/check').checkShow(db, require('../server/defaults').TYPES);
  assert.ok(JSON.stringify(report).includes('doppelt gewählt'));
  g.content.badSlots[2] = { joker: 'verbot' };
  act(db, mod(), 'start');
  assert.equal(bv(db).wheel.fields.length, 12);
});

test('Brain or Dreh’n: jedes der 12 Felder hat dieselbe Chance', () => {
  const { db, ids } = setup(2);
  const [A] = ids;
  const core = require('../server/core');
  const g = use(db, 'brain');
  act(db, mod(), 'start');
  const st = db.live.games[g.id];
  const real = core.randomInt;
  const asked = new Set();
  core.randomInt = (n) => { asked.add(n); return real(n); };
  const counts = {};
  const N = 12000;
  try {
    for (let i = 0; i < N; i += 1) {
      st.r.phase = 'wheel'; st.r.correct = [A]; st.r.buzz = A; st.r.spin = null;
      st.t[A].jokers = [];
      act(db, team(A), 'spin');
      const s = st.r.spin;
      assert.equal(bv(db).wheel.fields[s.index].icon, bv(db).wheel.spin.field.icon); // Feld unter dem Zeiger = Ergebnis
      counts[s.index] = (counts[s.index] || 0) + 1;
    }
  } finally { core.randomInt = real; }
  assert.ok(asked.has(12)); // gezogen wird über alle 12 Felder
  assert.equal(Object.keys(counts).length, 12);
  const e = N / 12;
  const chi = Object.values(counts).reduce((sum, c) => sum + ((c - e) ** 2) / e, 0);
  assert.ok(chi < 35, `Verteilung ungleich (Chi² ${chi.toFixed(1)}): ${JSON.stringify(counts)}`);
});
