'use strict';

// Spiel „Film ab – Buzzer an!“: Die Moderation startet den Filmausschnitt auf
// dem Beamer, alle Teams dürfen buzzern. Der erste Buzzer antwortet mündlich:
// richtig = 1 Punkt und der Film endet, falsch = dieses Team ist für diesen Film
// gesperrt, der Clip läuft noch einmal von vorn und die übrigen dürfen erneut buzzern.

const { fail, log, effect, teamName, teamIds, bookTarget, buzzIn, currentBuzz, buzzTeamView } = require('./core');
const { pv } = require('./scoring');

function round(st, i) {
  if (!st.rounds[i]) st.rounds[i] = { started: false, playback: { state: 'stopped', seq: 0, restart: true }, buzzes: [], locked: [], resolved: false, winner: null };
  return st.rounds[i];
}

function current(st) {
  if (st.index < 0) fail('Es läuft gerade kein Film.');
  return round(st, st.index);
}

function setPlayback(r, state, restart = false) {
  r.playback = { state, seq: r.playback.seq + 1, restart };
}

module.exports = {
  init: () => ({ index: -1, rounds: {} }),

  team: {
    buzz(db, ctx, game, st) {
      const r = current(st);
      if (!r.started) fail('Der Film läuft noch nicht.');
      if (currentBuzz(r)) fail('Ein anderes Team antwortet gerade.');
      buzzIn(db, ctx, r);
      // Beim Buzzer hält der Clip an, damit in Ruhe geantwortet werden kann.
      if (r.playback.state === 'playing') setPlayback(r, 'paused');
    },
  },

  mod: {
    open(db, ctx, game, st, p) {
      const i = Number(p.index);
      if (!game.content.films[i]) fail('Film nicht gefunden.');
      if (st.index >= 0 && st.index !== i) {
        const prev = round(st, st.index);
        if (prev.playback.state === 'playing') setPlayback(prev, 'stopped');
      }
      st.index = i;
      round(st, i);
      log(db, ctx, 'ablauf', `Film ${i + 1} vorbereitet`);
    },

    // Abspielen: von vorn oder an der Pausenstelle weiter.
    play(db, ctx, game, st, p) {
      const r = current(st);
      if (!game.content.films[st.index].clip) fail('Für diesen Film ist noch kein Ausschnitt hochgeladen.');
      if (currentBuzz(r)) fail('Erst die Antwort des Teams bewerten.');
      r.started = true;
      setPlayback(r, 'playing', !!p.restart || r.playback.state === 'stopped');
      log(db, ctx, 'ablauf', `Film ${st.index + 1} läuft${p.restart ? ' (von vorn)' : ''}`);
      effect(db, 'title');
    },

    pause(db, ctx, game, st) {
      const r = current(st);
      setPlayback(r, 'paused');
    },

    judge(db, ctx, game, st, p) {
      const r = current(st);
      const b = currentBuzz(r);
      if (!b) fail('Gerade antwortet kein Team.');
      const film = game.content.films[st.index];
      if (p.correct) {
        b.status = 'correct';
        r.resolved = true;
        r.winner = b.teamId;
        setPlayback(r, 'stopped');
        bookTarget(db, ctx, `filmab:${game.id}:${st.index}`, b.teamId, pv(game, 'correct'), `${game.title}, Film ${st.index + 1}`);
        log(db, ctx, 'bewertung', `${teamName(db, b.teamId)}: „${film.title}“ richtig`);
        effect(db, 'correct');
      } else {
        b.status = 'wrong';
        r.locked.push(b.teamId);
        log(db, ctx, 'bewertung', `${teamName(db, b.teamId)}: falsch, für diesen Film gesperrt`);
        effect(db, 'wrong');
        if (teamIds(db).every((id) => r.locked.includes(id))) {
          r.resolved = true;
          setPlayback(r, 'stopped');
          log(db, ctx, 'ablauf', `Film ${st.index + 1}: alle Teams falsch, keine Punkte`);
        } else {
          // Clip läuft noch einmal von vorn; alle nicht gesperrten Teams dürfen wieder buzzern.
          setPlayback(r, 'playing', true);
          log(db, ctx, 'ablauf', `Film ${st.index + 1} läuft noch einmal von vorn`);
        }
      }
    },

    // Film manuell beenden (z. B. niemand weiß es); die Lösung wird gezeigt.
    close(db, ctx, game, st) {
      const r = current(st);
      if (currentBuzz(r)) fail('Erst die Antwort des Teams bewerten.');
      r.resolved = true;
      setPlayback(r, 'stopped');
      log(db, ctx, 'ablauf', `Film ${st.index + 1} beendet`);
    },
  },

  teamView(db, game, st, teamId) {
    if (st.index < 0) return null;
    const r = round(st, st.index);
    const pending = currentBuzz(r);
    return {
      index: st.index,
      count: game.content.films.length,
      started: r.started,
      ...buzzTeamView(r, teamId),
      resolved: r.resolved,
      canBuzz: r.started && !r.resolved && !pending && !r.locked.includes(teamId) && !r.buzzes.some((b) => b.teamId === teamId && b.status === 'pending'),
      someoneAnswering: !!pending && pending.teamId !== teamId,
      title: r.resolved ? game.content.films[st.index].title : null,
      winner: r.winner,
    };
  },

  beamerView(db, game, st) {
    if (st.index < 0) return { waiting: true };
    const r = round(st, st.index);
    const film = game.content.films[st.index];
    const pending = currentBuzz(r);
    return {
      index: st.index,
      clip: film.clip ? { id: film.clip.id, type: film.clip.type } : null,
      playback: r.playback,
      started: r.started,
      answering: pending ? pending.teamId : null,
      buzzOrder: r.buzzes.map((b) => ({ teamId: b.teamId, status: b.status })),
      resolved: r.resolved,
      title: r.resolved ? film.title : null,
      winner: r.winner,
    };
  },
};
