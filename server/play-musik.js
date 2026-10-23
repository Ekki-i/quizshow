'use strict';

// Musikquiz im Jeopardy-Stil: fünf Kategorien mit Feldern zu 1, 2 und 3 Punkten.
// Ein Feld wird gewählt, die Moderation startet den Clip, alle Teams buzzern.

const { fail, log, effect, teamName, bookTarget, buzzIn, currentBuzz, buzzTeamView } = require('./core');

const key = (c, f) => `${c}-${f}`;
const SONG_SONG_SONG = /^Song Song Song/;

function round(st, k) {
  if (!st.rounds[k]) st.rounds[k] = { started: false, buzzes: [], locked: [], resolved: false };
  return st.rounds[k];
}

function active(st) {
  if (!st.current) fail('Es ist gerade kein Feld gewählt.');
  return round(st, st.current);
}

function field(game, k) {
  const [c, f] = k.split('-').map(Number);
  const cat = game.content.categories[c];
  return { c, f, cat, field: cat.fields[f], value: f + 1, mashup: SONG_SONG_SONG.test(cat.mode) };
}

function board(game, st) {
  return game.content.categories.map((cat, c) => ({
    name: cat.name,
    mashup: SONG_SONG_SONG.test(cat.mode),
    fields: cat.fields.map((_, f) => {
      const p = st.played[key(c, f)];
      return { value: f + 1, played: !!p, winner: p ? p.winner : null };
    }),
  }));
}

function resolve(db, ctx, st, winner) {
  const r = active(st);
  r.resolved = true;
  st.played[st.current] = { winner };
}

module.exports = {
  init: () => ({ current: null, played: {}, rounds: {} }),

  team: {
    buzz(db, ctx, game, st) {
      const r = active(st);
      if (!r.started) fail('Die Aufgabe läuft noch nicht.');
      buzzIn(db, ctx, r);
    },
  },

  mod: {
    pick(db, ctx, game, st, p) {
      const c = Number(p.cat);
      const f = Number(p.field);
      if (!game.content.categories[c]?.fields[f]) fail('Feld nicht gefunden.');
      if (st.current && !round(st, st.current).resolved) fail('Erst das laufende Feld beenden.');
      const k = key(c, f);
      if (st.played[k]) fail('Dieses Feld wurde schon gespielt.');
      st.current = k;
      round(st, k);
      log(db, ctx, 'ablauf', `Feld „${game.content.categories[c].name || `Kategorie ${c + 1}`}“ für ${f + 1} gewählt`);
    },
    start(db, ctx, game, st) {
      const r = active(st);
      if (r.resolved) fail('Dieses Feld ist bereits beendet.');
      r.started = true;
      log(db, ctx, 'ablauf', 'Aufgabe gestartet, Buzzer frei');
    },
    judge(db, ctx, game, st, p) {
      const r = active(st);
      const buzz = currentBuzz(r);
      if (!buzz) fail('Kein Team hat gerade das Antwortrecht.');
      const info = field(game, st.current);
      if (p.correct) {
        buzz.status = 'correct';
        bookTarget(db, ctx, `musik:${game.id}:${st.current}`, buzz.teamId, info.value, `${game.title}, ${info.cat.name || `Kategorie ${info.c + 1}`} ${info.value}`);
        resolve(db, ctx, st, buzz.teamId);
        effect(db, 'correct');
      } else {
        buzz.status = 'wrong';
        r.locked.push(buzz.teamId);
        effect(db, 'wrong');
      }
      log(db, ctx, 'bewertung', `${teamName(db, buzz.teamId)}: ${p.correct ? 'richtig' : 'falsch'}`);
    },
    close(db, ctx, game, st) {
      const r = active(st);
      if (r.resolved) fail('Dieses Feld ist bereits beendet.');
      if (currentBuzz(r)) fail('Erst die Antwort des buzzernden Teams bewerten.');
      resolve(db, ctx, st, null);
      log(db, ctx, 'ablauf', 'Feld ohne Punkte beendet');
    },
  },

  teamView(db, game, st, teamId) {
    const out = { board: board(game, st), current: null };
    if (!st.current) return out;
    const r = round(st, st.current);
    const info = field(game, st.current);
    const b = buzzTeamView(r, teamId);
    out.current = {
      category: info.cat.name, value: info.value, mashup: info.mashup, task: info.field.task,
      started: r.started, resolved: r.resolved, ...b,
      canBuzz: r.started && !r.resolved && !b.buzzed && !b.locked,
    };
    return out;
  },

  beamerView(db, game, st) {
    const out = { board: board(game, st), current: null };
    if (!st.current) return out;
    const r = round(st, st.current);
    const info = field(game, st.current);
    const current = currentBuzz(r);
    out.current = {
      category: info.cat.name, value: info.value, mashup: info.mashup, task: info.field.task,
      started: r.started, resolved: r.resolved,
      buzzOrder: r.buzzes.map((x) => ({ teamId: x.teamId, status: x.status })),
      answering: current ? current.teamId : null,
      answer: r.resolved ? info.field.answer : null,
      winner: st.played[st.current]?.winner || null,
    };
    return out;
  },
};
