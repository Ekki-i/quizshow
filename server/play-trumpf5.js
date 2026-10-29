'use strict';

// Spiel „5 ist Trümpf“: bis zu fünf Hinweise, Buzzer, Punkte nach dem Hinweis beim Buzzern.

const { fail, log, effect, teamName, bookTarget, buzzIn, currentBuzz, buzzTeamView } = require('./core');

// Hinweis 1 → 5 Punkte … Hinweis 5 → 1 Punkt.
const pointsFor = (hintLevel) => Math.max(0, 6 - hintLevel);

function round(st, i) {
  if (!st.rounds[i]) st.rounds[i] = { hintLevel: 0, buzzes: [], locked: [], resolved: false };
  return st.rounds[i];
}

function active(st) {
  if (st.termIndex < 0) fail('Es läuft gerade kein Begriff.');
  return round(st, st.termIndex);
}

module.exports = {
  pointsFor,
  init: () => ({ termIndex: -1, rounds: {} }),

  team: {
    buzz(db, ctx, game, st) {
      const r = active(st);
      if (r.hintLevel < 1) fail('Es wurde noch kein Hinweis freigegeben.');
      buzzIn(db, ctx, r, { hint: r.hintLevel });
    },
  },

  mod: {
    start(db, ctx, game, st, p) {
      const i = Number(p.termIndex);
      if (!game.content.terms[i]) fail('Begriff nicht gefunden.');
      st.termIndex = i;
      round(st, i);
      log(db, ctx, 'ablauf', `Begriff ${i + 1} gestartet`);
    },
    nextHint(db, ctx, game, st) {
      const r = active(st);
      if (r.resolved) fail('Dieser Begriff ist bereits beendet.');
      if (currentBuzz(r)) fail('Erst die Antwort des buzzernden Teams bewerten.');
      if (r.hintLevel >= 5) fail('Alle fünf Hinweise sind freigegeben.');
      r.hintLevel += 1;
      log(db, ctx, 'ablauf', `Hinweis ${r.hintLevel} freigegeben`);
    },
    judge(db, ctx, game, st, p) {
      const r = active(st);
      const buzz = currentBuzz(r);
      if (!buzz) fail('Kein Team hat gerade das Antwortrecht.');
      if (p.correct) {
        buzz.status = 'correct';
        r.resolved = true;
        bookTarget(db, ctx, `trumpf5:${game.id}:${st.termIndex}`, buzz.teamId, pointsFor(buzz.hint), `${game.title}, Begriff ${st.termIndex + 1}, Hinweis ${buzz.hint}`);
        effect(db, 'correct');
      } else {
        buzz.status = 'wrong';
        r.locked.push(buzz.teamId);
        effect(db, 'wrong');
      }
      log(db, ctx, 'bewertung', `${teamName(db, buzz.teamId)} Begriff ${st.termIndex + 1}: ${p.correct ? 'richtig' : 'falsch'}`);
    },
    close(db, ctx, game, st) {
      const r = active(st);
      if (currentBuzz(r)) fail('Erst die Antwort des buzzernden Teams bewerten.');
      r.resolved = true;
      log(db, ctx, 'ablauf', `Begriff ${st.termIndex + 1} ohne Punkte beendet`);
    },
  },

  teamView(db, game, st, teamId) {
    if (st.termIndex < 0) return null;
    const r = round(st, st.termIndex);
    const term = game.content.terms[st.termIndex];
    const b = buzzTeamView(r, teamId);
    return {
      termIndex: st.termIndex,
      category: term.category,
      hints: r.resolved ? term.hints.slice(0, 5) : term.hints.slice(0, r.hintLevel),
      shown: r.hintLevel,
      resolved: r.resolved,
      term: r.resolved ? term.term : null,
      ...b,
      canBuzz: !r.resolved && r.hintLevel >= 1 && !b.buzzed && !b.locked,
    };
  },

  beamerView(db, game, st) {
    if (st.termIndex < 0) return { waiting: true };
    const r = round(st, st.termIndex);
    const term = game.content.terms[st.termIndex];
    const current = currentBuzz(r);
    const winner = r.buzzes.find((b) => b.status === 'correct');
    return {
      termIndex: st.termIndex,
      category: term.category,
      // Nach der Auflösung werden alle übrigen Hinweise einmal aufgedeckt.
      hints: r.resolved ? term.hints.slice(0, 5) : term.hints.slice(0, r.hintLevel),
      shown: r.hintLevel,
      value: pointsFor(r.hintLevel),
      buzzOrder: r.buzzes.map((b) => ({ teamId: b.teamId, status: b.status })),
      answering: current ? current.teamId : null,
      resolved: r.resolved,
      term: r.resolved ? term.term : null,
      winner: winner ? winner.teamId : null,
    };
  },
};
