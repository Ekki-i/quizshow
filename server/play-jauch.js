'use strict';

// Spiel „Ein Hauch von Günther Jauch“: acht Fragen A–D, alle Teams spielen
// parallel. Der Punktestand ist der erreichte Stand der Leiter (nicht additiv),
// ab Frage 4 ist die Sicherheitsstufe von 5 Punkten erreicht.

const { fail, randomInt, log, effect, teamName, teamIds, bookTarget, cleanChoice, pts } = require('./core');
const { JAUCH_LADDER } = require('./defaults');
const { pv } = require('./scoring');
// Gewinnstufen (im Editor änderbar, sonst Standardleiter).
const ladderOf = (game) => JAUCH_LADDER.map((_, i) => pv(game, `q${i + 1}`));

const SAFETY_INDEX = 3; // Frage 4
const ABCD = ['A', 'B', 'C', 'D'];

function teamState(st, teamId) {
  if (!st.teams[teamId]) st.teams[teamId] = { status: 'active', secured: 0, outAt: null, jokers: { fifty: false, phone: false } };
  return st.teams[teamId];
}

// Joker je Frage: 50:50 darf jedes Team jederzeit nehmen (eigene, zufällige Streichung),
// den Telefonjoker gibt es pro Frage nur einmal (er wartet auf alle anderen Teams).
function round(st, q) {
  if (!st.rounds[q]) st.rounds[q] = { open: false, revealed: false, answers: {}, fifty: {}, phone: null, jokerLog: [] };
  const r = st.rounds[q];
  if (!r.fifty) {
    // älteres Format (ein Joker pro Frage) übernehmen
    r.fifty = {};
    r.phone = null;
    r.jokerLog = [];
    if (r.joker) {
      if (r.joker.kind === 'fifty') r.fifty[r.joker.teamId] = r.joker.removed;
      else r.phone = r.joker.teamId;
      r.jokerLog.push({ teamId: r.joker.teamId, kind: r.joker.kind });
    }
    delete r.joker;
  }
  return r;
}

function current(st) {
  if (st.qIndex < 0) fail('Es läuft gerade keine Frage.');
  return round(st, st.qIndex);
}

// Teams, die bei der aktuellen Frage noch antworten müssen.
function activeTeams(db, st) {
  return teamIds(db).filter((id) => teamState(st, id).status === 'active');
}

function phoneWaiting(db, st, r) {
  if (!r.phone) return false;
  return activeTeams(db, st).some((id) => id !== r.phone && !r.answers[id]);
}

function book(db, ctx, game, teamId, value, why) {
  bookTarget(db, ctx, `jauch:${game.id}:${teamId}`, teamId, value, `${game.title}, ${why}`);
}

module.exports = {
  init: () => ({ qIndex: -1, rounds: {}, teams: {} }),

  team: {
    answer(db, ctx, game, st, p) {
      const r = current(st);
      const ts = teamState(st, ctx.teamId);
      if (ts.status !== 'active') fail('Ihr spielt in diesem Spiel nicht mehr mit.');
      if (!r.open) fail('Die Frage ist nicht freigegeben.');
      if (r.answers[ctx.teamId]) fail('Eure Antwort ist bereits gesperrt.');
      const choice = cleanChoice(p.choice);
      if ((r.fifty[ctx.teamId] || []).includes(choice)) fail('Diese Antwort wurde durch 50:50 entfernt.');
      if (r.phone === ctx.teamId && phoneWaiting(db, st, r)) {
        fail('Telefonjoker: Erst wenn alle anderen Teams gesperrt haben, gebt ihr eure Antwort ab.');
      }
      r.answers[ctx.teamId] = { choice, at: ctx.now };
      log(db, ctx, 'antwort', `${teamName(db, ctx.teamId)} hat Frage ${st.qIndex + 1} gesperrt`);
    },

    joker(db, ctx, game, st, p) {
      const r = current(st);
      const ts = teamState(st, ctx.teamId);
      if (ts.status !== 'active') fail('Ihr spielt in diesem Spiel nicht mehr mit.');
      if (!r.open) fail('Die Frage ist nicht freigegeben.');
      if (r.answers[ctx.teamId]) fail('Ihr habt schon gesperrt.');
      if (!['fifty', 'phone'].includes(p.kind)) fail('Unbekannter Joker.');
      if (ts.jokers[p.kind]) fail('Diesen Joker habt ihr schon eingesetzt.');
      if (p.kind === 'phone' && r.phone) fail('In dieser Frage telefoniert schon ein anderes Team.');
      ts.jokers[p.kind] = true;
      if (p.kind === 'fifty') {
        const wrong = ABCD.filter((l) => l !== game.content.questions[st.qIndex].correct);
        const removed = [];
        while (removed.length < 2) removed.push(wrong.splice(randomInt(wrong.length), 1)[0]);
        r.fifty[ctx.teamId] = removed.sort();
      } else {
        r.phone = ctx.teamId;
      }
      r.jokerLog.push({ teamId: ctx.teamId, kind: p.kind });
      log(db, ctx, 'joker', `${teamName(db, ctx.teamId)} setzt ${p.kind === 'fifty' ? '50:50' : 'Telefonjoker'} bei Frage ${st.qIndex + 1} ein`);
    },

    // Aussteigen und den bisher erspielten Stand sichern: nach einer Auflösung
    // oder während eine Frage läuft (statt sie zu beantworten).
    quit(db, ctx, game, st) {
      const ts = teamState(st, ctx.teamId);
      if (ts.status !== 'active') fail('Ihr spielt in diesem Spiel nicht mehr mit.');
      if (st.qIndex < 0) fail('Es läuft noch keine Frage.');
      const r = round(st, st.qIndex);
      if (!r.revealed) {
        if (!r.open) fail('Die Frage ist nicht freigegeben.');
        if (r.answers[ctx.teamId]) fail('Ihr habt schon gesperrt – aussteigen geht wieder nach der Auflösung.');
      }
      ts.status = 'quit';
      ts.outAt = r.revealed ? st.qIndex + 1 : st.qIndex; // Anzahl gespielter Fragen
      log(db, ctx, 'ablauf', `${teamName(db, ctx.teamId)} steigt ${r.revealed ? `nach Frage ${st.qIndex + 1}` : `bei Frage ${st.qIndex + 1}`} aus und sichert ${pts(ts.secured)}`);
    },
  },

  mod: {
    next(db, ctx, game, st) {
      const q = st.qIndex + 1;
      if (st.qIndex >= 0 && !round(st, st.qIndex).revealed) fail('Erst die aktuelle Frage auflösen.');
      if (!game.content.questions[q]) fail('Alle Fragen sind gespielt.');
      for (const id of teamIds(db)) teamState(st, id);
      if (!activeTeams(db, st).length) fail('Kein Team spielt mehr mit.');
      st.qIndex = q;
      round(st, q).open = true;
      log(db, ctx, 'ablauf', `Frage ${q + 1} (${pts(ladderOf(game)[q])}) freigegeben`);
    },

    reveal(db, ctx, game, st, p) {
      const r = current(st);
      if (r.revealed) fail('Diese Frage ist bereits aufgelöst.');
      const missing = activeTeams(db, st).filter((id) => !r.answers[id]);
      if (missing.length && !p.force) fail(`Noch nicht gesperrt: ${missing.map((id) => teamName(db, id)).join(', ')}`);
      const q = st.qIndex;
      const correct = game.content.questions[q].correct;
      r.open = false;
      r.revealed = true;
      for (const id of activeTeams(db, st)) {
        const ts = teamState(st, id);
        const a = r.answers[id];
        if (a && a.choice === correct) {
          ts.secured = ladderOf(game)[q];
          book(db, ctx, game, id, ts.secured, `Frage ${q + 1} richtig`);
          if (q === JAUCH_LADDER.length - 1) {
            ts.status = 'done';
            ts.outAt = q + 1;
          }
        } else {
          ts.secured = q > SAFETY_INDEX ? ladderOf(game)[SAFETY_INDEX] : 0;
          ts.status = 'out';
          ts.outAt = q + 1;
          book(db, ctx, game, id, ts.secured, `Frage ${q + 1} ${a ? 'falsch' : 'ohne Antwort'}, ausgeschieden`);
        }
      }
      log(db, ctx, 'ablauf', `Frage ${q + 1} aufgelöst (richtig: ${correct})`);
      effect(db, 'reveal');
    },
  },

  teamView(db, game, st, teamId) {
    const ts = teamState(st, teamId);
    const base = { status: ts.status, secured: ts.secured, outAt: ts.outAt, jokers: { fifty: !ts.jokers.fifty, phone: !ts.jokers.phone }, ladder: ladderOf(game) };
    if (st.qIndex < 0) return { ...base, qIndex: -1 };
    const r = round(st, st.qIndex);
    const q = game.content.questions[st.qIndex];
    const own = r.answers[teamId];
    return {
      ...base,
      qIndex: st.qIndex,
      value: ladderOf(game)[st.qIndex],
      question: q.question,
      options: q.options,
      removed: r.fifty[teamId] || [],
      open: r.open,
      revealed: r.revealed,
      choice: own ? own.choice : null,
      correct: r.revealed ? q.correct : null,
      phoneTaken: !!r.phone && r.phone !== teamId,
      phone: r.phone === teamId ? { waiting: phoneWaiting(db, st, r) } : null,
      jokerLog: r.jokerLog,
      canQuit: ts.status === 'active' && ((r.revealed && st.qIndex < JAUCH_LADDER.length - 1) || (r.open && !own)),
    };
  },

  beamerView(db, game, st) {
    const teams = teamIds(db).map((id) => {
      const ts = teamState(st, id);
      return { teamId: id, status: ts.status, secured: ts.secured, outAt: ts.outAt };
    });
    if (st.qIndex < 0) return { waiting: true, ladder: ladderOf(game) };
    const r = round(st, st.qIndex);
    // Eingesetzte Joker je Art (über das ganze Spiel) und die Joker der laufenden Frage
    // – sofort sichtbar, wer welchen Joker genommen hat.
    const jokers = {};
    for (const kind of ['fifty', 'phone']) jokers[kind] = teamIds(db).filter((id) => teamState(st, id).jokers[kind]);
    const q = game.content.questions[st.qIndex];
    const active = teams.filter((t) => t.status === 'active' || r.answers[t.teamId]);
    return {
      qIndex: st.qIndex,
      ladder: ladderOf(game),
      question: q.question,
      options: q.options,
      lockedCount: Object.keys(r.answers).length,
      activeCount: r.revealed ? active.length : teams.filter((t) => t.status === 'active').length,
      phoneRunning: !r.revealed && !!r.phone && !r.answers[r.phone],
      revealed: r.revealed,
      correct: r.revealed ? q.correct : null,
      answers: r.revealed ? Object.entries(r.answers).map(([teamId, a]) => ({ teamId, choice: a.choice })) : [],
      roundJokers: r.jokerLog,
      quitNow: teams.filter((t) => t.status === 'quit' && t.outAt === st.qIndex).map((t) => t.teamId),
      teams: r.revealed ? teams : null,
      jokers,
      safeIndex: SAFETY_INDEX,
    };
  },
};
