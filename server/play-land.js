'use strict';

// Spiel „Ich sehe ein Land, das du nicht siehst“: jedes Team setzt einen Punkt
// auf der Karte. Erst werden alle Tipps gleichzeitig gezeigt, dann der Zielort.
// Das Team mit dem kleinsten Abstand bekommt 1 Punkt.

const { fail, log, effect, teamName, teamIds, bookTarget, distanceKm } = require('./core');

function round(st, t) {
  if (!st.rounds[t]) st.rounds[t] = { open: false, guesses: {}, showGuesses: false, showTarget: false, winners: [] };
  return st.rounds[t];
}

function current(st) {
  if (st.taskIndex < 0) fail('Es läuft gerade keine Aufgabe.');
  return round(st, st.taskIndex);
}

function coord(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail('Ungültiger Kartenpunkt.');
  return Math.round(n * 1000) / 1000;
}

function distances(task, r) {
  return Object.entries(r.guesses).map(([teamId, g]) => ({ teamId, lat: g.lat, lng: g.lng, km: Math.round(distanceKm(g, task)) }));
}

function bookWinners(db, ctx, game, st, r, winners, why) {
  r.winners = winners;
  for (const id of Object.keys(r.guesses).concat(winners)) {
    bookTarget(db, ctx, `land:${game.id}:${st.taskIndex}:${id}`, id, winners.includes(id) ? 1 : 0, `${game.title}, Aufgabe ${st.taskIndex + 1}${why}`);
  }
}

// Karte je Aufgabe: eigene Wahl oder die Standard-Karte des Spiels.
function mapOf(game, task) {
  return task && ['Welt', 'Europa', 'Deutschland'].includes(task.map) ? task.map : game.content.map;
}

function publicView(db, game, st) {
  const r = round(st, st.taskIndex);
  const task = game.content.tasks[st.taskIndex];
  return {
    map: mapOf(game, task),
    taskIndex: st.taskIndex,
    count: game.content.tasks.length,
    question: task.question,
    image: task.image ? { id: task.image.id, type: task.image.type } : null,
    open: r.open,
    submittedCount: Object.keys(r.guesses).length,
    teamCount: db.project.teams.length,
    guesses: r.showGuesses ? distances(task, r).map((d) => ({ teamId: d.teamId, lat: d.lat, lng: d.lng, km: r.showTarget ? d.km : null })) : null,
    target: r.showTarget ? { name: task.target, lat: task.lat, lng: task.lng } : null,
    winners: r.showTarget ? r.winners : [],
  };
}

module.exports = {
  init: () => ({ taskIndex: -1, rounds: {} }),

  team: {
    guess(db, ctx, game, st, p) {
      const r = current(st);
      if (!r.open) fail('Die Aufgabe ist nicht freigegeben.');
      if (r.guesses[ctx.teamId]) fail('Euer Punkt ist bereits gesperrt.');
      r.guesses[ctx.teamId] = { lat: coord(p.lat, -90, 90), lng: coord(p.lng, -180, 180), at: ctx.now };
      log(db, ctx, 'antwort', `${teamName(db, ctx.teamId)} hat einen Punkt gesetzt`);
    },
  },

  mod: {
    open(db, ctx, game, st, p) {
      const t = Number(p.taskIndex);
      const task = game.content.tasks[t];
      if (!task) fail('Aufgabe nicht gefunden.');
      if (task.lat === null || task.lng === null) fail('Für diese Aufgabe fehlen noch Breiten- und Längengrad im Editor.');
      if (st.taskIndex >= 0 && st.taskIndex !== t) round(st, st.taskIndex).open = false;
      st.taskIndex = t;
      const r = round(st, t);
      if (!r.showGuesses) r.open = true;
      log(db, ctx, 'ablauf', `Aufgabe ${t + 1} freigegeben`);
    },

    revealGuesses(db, ctx, game, st) {
      const r = current(st);
      if (!Object.keys(r.guesses).length) fail('Noch kein Team hat einen Punkt gesetzt.');
      r.open = false;
      r.showGuesses = true;
      log(db, ctx, 'ablauf', 'Alle Tipps auf der Karte gezeigt');
      effect(db, 'reveal');
    },

    revealTarget(db, ctx, game, st) {
      const r = current(st);
      if (!r.showGuesses) fail('Zuerst die Tipps der Teams zeigen.');
      if (r.showTarget) fail('Der Zielort ist bereits enthüllt.');
      const d = distances(game.content.tasks[st.taskIndex], r);
      const best = Math.min(...d.map((x) => x.km));
      r.showTarget = true;
      bookWinners(db, ctx, game, st, r, d.filter((x) => x.km === best).map((x) => x.teamId), '');
      log(db, ctx, 'ablauf', `Zielort enthüllt, am nächsten: ${r.winners.map((id) => teamName(db, id)).join(', ')} (${best} km)`);
      effect(db, 'correct');
    },

    // Nachvollziehbare manuelle Korrektur bei Karten- oder Geocodierungsfehlern.
    setWinner(db, ctx, game, st, p) {
      const r = current(st);
      if (!r.showTarget) fail('Erst den Zielort enthüllen.');
      if (!teamIds(db).includes(p.teamId)) fail('Team nicht gefunden.');
      bookWinners(db, ctx, game, st, r, [p.teamId], ', manuell korrigiert');
      log(db, ctx, 'bewertung', `Korrektur: Punkt geht an ${teamName(db, p.teamId)}`);
    },
  },

  teamView(db, game, st, teamId) {
    if (st.taskIndex < 0) return { map: game.content.map, taskIndex: -1 };
    const r = round(st, st.taskIndex);
    const own = r.guesses[teamId];
    return { ...publicView(db, game, st), own: own ? { lat: own.lat, lng: own.lng } : null };
  },

  beamerView(db, game, st) {
    if (st.taskIndex < 0) return { waiting: true, map: game.content.map };
    return publicView(db, game, st);
  },
};
