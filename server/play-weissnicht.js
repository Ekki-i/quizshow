'use strict';

// Spiel „Ich weiß nicht, dass du weißt es doch“: Bild auf dem Beamer. Wer zuerst
// buzzert, wählt ein anderes Team, das die Antwort angeblich nicht weiß (alle
// übrigen Buzzer sind sofort gesperrt). Das gewählte Team hat 10 Sekunden für
// eine mündliche Antwort. Falsch: +1 für das Buzzer-Team, richtig: +1 für das
// gewählte Team.

const { fail, log, effect, teamName, teamIds, bookTarget } = require('./core');
const { pv } = require('./scoring');

const ANSWER_MS = 10000;

function round(st, i) {
  if (!st.rounds[i]) st.rounds[i] = { open: false, buzz: null, target: null, deadline: null, result: null, closed: false };
  return st.rounds[i];
}

function current(st) {
  if (st.index < 0) fail('Es läuft gerade keine Runde.');
  return round(st, st.index);
}

function pick(db, ctx, game, st, r, teamId) {
  if (!r.buzz) fail('Noch hat niemand gebuzzert.');
  if (r.target) fail('Das Team ist schon gewählt.');
  if (teamId === r.buzz.teamId || !teamIds(db).includes(teamId)) fail('Bitte ein anderes Team wählen.');
  r.target = teamId;
  r.deadline = ctx.now + ANSWER_MS;
  log(db, ctx, 'ablauf', `${teamName(db, r.buzz.teamId)} wählt ${teamName(db, teamId)} – 10 Sekunden`);
  effect(db, 'buzz');
}

// Je Team eine eigene Buchung: so bleibt auch eine Korrektur eindeutig.
function book(db, ctx, game, st, r, correct) {
  r.result = correct ? 'right' : 'wrong';
  const winner = correct ? r.target : r.buzz.teamId;
  const loser = correct ? r.buzz.teamId : r.target;
  bookTarget(db, ctx, `weissnicht:${game.id}:${st.index}:${winner}`, winner, pv(game, 'winner'), `${game.title}, Runde ${st.index + 1}`);
  bookTarget(db, ctx, `weissnicht:${game.id}:${st.index}:${loser}`, loser, 0, `${game.title}, Runde ${st.index + 1}`);
  log(db, ctx, 'bewertung', `${teamName(db, r.target)} ${correct ? 'wusste es' : 'wusste es nicht'} – +${pv(game, 'winner')} für ${teamName(db, winner)}`);
}

module.exports = {
  ANSWER_MS,
  init: () => ({ index: -1, rounds: {} }),

  team: {
    buzz(db, ctx, game, st) {
      const r = current(st);
      if (!r.open || r.closed) fail('Diese Runde ist nicht offen.');
      if (r.buzz) fail(`${teamName(db, r.buzz.teamId)} war schneller.`);
      r.buzz = { teamId: ctx.teamId, at: ctx.now };
      log(db, ctx, 'buzzer', `${teamName(db, ctx.teamId)} buzzert als erstes Team`);
      effect(db, 'buzz');
    },

    pick(db, ctx, game, st, p) {
      const r = current(st);
      if (!r.buzz || r.buzz.teamId !== ctx.teamId) fail('Nur das Team, das zuerst gebuzzert hat, wählt.');
      pick(db, ctx, game, st, r, p.teamId);
    },
  },

  mod: {
    open(db, ctx, game, st, p) {
      const i = Number(p.index);
      if (!game.content.rounds[i]) fail('Runde nicht gefunden.');
      if (st.index >= 0 && st.index !== i) {
        const prev = round(st, st.index);
        if (prev.target && !prev.result) fail('Erst die laufende Antwort bewerten.');
        prev.open = false;
      }
      st.index = i;
      const r = round(st, i);
      if (!r.closed) r.open = true;
      log(db, ctx, 'ablauf', `Runde ${i + 1} offen – Buzzer frei`);
    },

    // Falls das Buzzer-Team nicht selbst wählen kann (z. B. iPad weg).
    pick(db, ctx, game, st, p) {
      pick(db, ctx, game, st, current(st), p.teamId);
    },

    judge(db, ctx, game, st, p) {
      const r = current(st);
      if (!r.target) fail('Es wurde noch kein Team gewählt.');
      if (r.result) fail('Diese Runde ist schon bewertet.');
      r.closed = true;
      r.open = false;
      book(db, ctx, game, st, r, !!p.correct);
      effect(db, p.correct ? 'correct' : 'wrong');
    },

    // Bewertung umdrehen, falls die Moderation sich verklickt hat.
    regrade(db, ctx, game, st, p) {
      const r = current(st);
      if (!r.result) fail('Noch nicht bewertet.');
      book(db, ctx, game, st, r, !!p.correct);
    },

    // Frage beenden (auch ohne Buzzer): danach keine Buzzer oder Antworten mehr.
    close(db, ctx, game, st) {
      const r = current(st);
      if (r.target && !r.result) fail('Erst die Antwort bewerten.');
      r.closed = true;
      r.open = false;
      log(db, ctx, 'ablauf', `Runde ${st.index + 1} beendet`);
    },
  },

  wakeAt(db, game, st, now) {
    if (st.index < 0) return null;
    const r = round(st, st.index);
    return r.deadline && !r.result && r.deadline > now ? r.deadline : null;
  },

  teamView(db, game, st, teamId) {
    if (st.index < 0) return null;
    const r = round(st, st.index);
    const isBuzzer = r.buzz?.teamId === teamId;
    return {
      index: st.index,
      count: game.content.rounds.length,
      question: game.content.rounds[st.index].question,
      open: r.open && !r.closed,
      canBuzz: r.open && !r.closed && !r.buzz,
      buzzer: r.buzz ? r.buzz.teamId : null,
      isBuzzer,
      choose: isBuzzer && !r.target ? teamIds(db).filter((id) => id !== teamId) : null,
      target: r.target,
      isTarget: r.target === teamId,
      deadline: r.deadline,
      result: r.result,
      closed: r.closed,
      solution: r.result || r.closed ? game.content.rounds[st.index].solution : null,
    };
  },

  beamerView(db, game, st) {
    if (st.index < 0) return { waiting: true };
    const r = round(st, st.index);
    const item = game.content.rounds[st.index];
    return {
      index: st.index,
      image: item.image ? { id: item.image.id, type: item.image.type } : null,
      question: item.question,
      buzzer: r.buzz ? r.buzz.teamId : null,
      target: r.target,
      deadline: r.deadline,
      result: r.result,
      closed: r.closed,
      solution: r.result || r.closed ? item.solution : null,
    };
  },
};
