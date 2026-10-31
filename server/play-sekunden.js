'use strict';

// Spiel „30 Seconds to Spaß“: Reihum hat jedes Team einen Zug. Das Team startet
// ihn selbst mit seinem Buzzer; dann beantwortet es mündlich so viele Fragen wie
// möglich, die Moderation tippt je Frage „Richtig“ oder „Falsch“ (sofort weiter
// zur nächsten Frage). Ein versteckter Timer läuft: Das Team muss nach 30 Sekunden
// erneut buzzern. Nur wer innerhalb der Toleranz stoppt (Durchgang 1: ± 4 s,
// Durchgang 2: ± 2 s – im Editor änderbar), behält die Punkte dieses Zuges.
// Zwei Durchgänge, jedes Team ist in jedem Durchgang einmal dran.
//
// Fragen sind in „Blöcken“ organisiert: Ein Block enthält gleichartige Fragen
// (gleiches Thema, gleiche Schwierigkeit), je eine pro Team-Platz. Das Team auf
// Platz k der Reihenfolge bekommt aus jedem Block die k-te Frage – so erhalten
// alle Teams eines Durchgangs sehr ähnliche, gleich schwere Fragen.

const { fail, log, effect, teamName, teamIds, bookTarget } = require('./core');
const { pv } = require('./scoring');
const core = require('./core');

const randomInt = (n) => core.randomInt(n);
const secondsOf = (game) => Number(game.content.seconds) || 30;
const tolOf = (game, d) => {
  const v = Number(d === 0 ? game.content.tol1 : game.content.tol2);
  return Number.isFinite(v) && v >= 0 ? v : d === 0 ? 4 : 2;
};
// Sicherheitsgrenze: wer bis weit nach dem Toleranzfenster nicht stoppt, ist automatisch zu spät.
const AUTO_STOP_EXTRA_MS = 15000;

function round(st, d) {
  if (!st.rounds[d]) st.rounds[d] = { order: [], turn: 0, turns: {}, done: false };
  return st.rounds[d];
}
function current(st) {
  if (st.index < 0) fail('Es läuft gerade kein Durchgang.');
  return round(st, st.index);
}
function turnOf(r, id) {
  if (!r.turns[id]) r.turns[id] = { phase: 'ready', startedAt: null, stoppedAt: null, marks: [], ok: null, points: 0, late: false };
  return r.turns[id];
}
const activeTeam = (r) => r.order[r.turn] || null;

// Frage Nr. q für Team-Platz p in Durchgang d (aus Block q, Platz p).
function questionFor(game, d, p, q) {
  const blocks = (game.content.rounds[d] && game.content.rounds[d].blocks) || [];
  const b = blocks[q];
  if (!b) return null;
  const items = (b.items || []).filter((it) => String(it.question || '').trim());
  if (!items.length) return null;
  const it = items[p % items.length];
  return { topic: b.topic || '', question: it.question, answer: it.answer || '', block: q, total: blocks.length };
}

function stop(db, ctx, game, st, r, id, t, auto = false) {
  t.phase = 'stopped';
  t.stoppedAt = auto ? null : ctx.now;
  const elapsed = auto ? null : (ctx.now - t.startedAt) / 1000;
  const tol = tolOf(game, st.index);
  const sec = secondsOf(game);
  t.elapsed = elapsed;
  t.late = auto;
  t.ok = !auto && Math.abs(elapsed - sec) <= tol;
  const correct = t.marks.filter((m) => m).length;
  t.correct = correct;
  t.points = t.ok ? correct * pv(game, 'correct') : 0;
  bookTarget(db, ctx, `sekunden:${game.id}:${st.index}:${id}`, id, t.points, `${game.title}, Durchgang ${st.index + 1}`);
  log(db, ctx, 'ablauf', `${teamName(db, id)}: ${auto ? 'nicht gestoppt' : `gestoppt nach ${elapsed.toFixed(1)} s`} – ${correct} richtig – ${t.ok ? `${t.points} Punkte` : 'außerhalb der Toleranz, 0 Punkte'}`);
  effect(db, t.ok ? 'correct' : 'wrong');
}

module.exports = {
  init: () => ({ index: -1, rounds: {} }),
  questionFor,

  team: {
    // Ein Buzzer für alles: erst starten, dann stoppen.
    buzz(db, ctx, game, st) {
      const r = current(st);
      if (r.done) fail('Der Durchgang ist beendet.');
      if (activeTeam(r) !== ctx.teamId) fail('Ihr seid gerade nicht dran.');
      const t = turnOf(r, ctx.teamId);
      if (t.phase === 'ready') {
        t.phase = 'running';
        t.startedAt = ctx.now;
        log(db, ctx, 'buzzer', `${teamName(db, ctx.teamId)} startet (Durchgang ${st.index + 1})`);
        effect(db, 'buzz');
        return;
      }
      if (t.phase === 'running') return stop(db, ctx, game, st, r, ctx.teamId, t);
      fail('Euer Zug ist schon vorbei.');
    },
  },

  mod: {
    // Durchgang öffnen: Startteam wird ausgelost, danach reihum (Durchgang 2 mit demselben Startteam).
    open(db, ctx, game, st, p) {
      const d = Number(p.index);
      if (!game.content.rounds[d]) fail('Durchgang nicht gefunden.');
      if (!(game.content.rounds[d].blocks || []).some((b) => (b.items || []).some((it) => String(it.question || '').trim()))) fail('Für diesen Durchgang sind noch keine Fragen eingetragen.');
      st.index = d;
      const r = round(st, d);
      if (!r.order.length) {
        const ids = teamIds(db);
        const other = st.rounds[1 - d];
        const start = other && other.order.length ? ids.indexOf(other.order[0]) : randomInt(ids.length);
        r.order = ids.map((_, i) => ids[(Math.max(0, start) + i) % ids.length]);
        log(db, ctx, 'ablauf', `30 Seconds: Durchgang ${d + 1} – es beginnt ${teamName(db, r.order[0])}`);
      }
    },
    // Wertung der aktuellen Frage: { correct: true|false } – danach sofort die nächste Frage.
    mark(db, ctx, game, st, p) {
      const r = current(st);
      const id = activeTeam(r);
      const t = id && turnOf(r, id);
      if (!t || t.phase !== 'running') fail('Gerade läuft kein Zug.');
      t.marks.push(!!p.correct);
    },
    // Letzte Wertung zurücknehmen (Vertipper).
    unmark(db, ctx, game, st) {
      const r = current(st);
      const id = activeTeam(r);
      const t = id && turnOf(r, id);
      if (!t || t.phase !== 'running' || !t.marks.length) fail('Nichts zurückzunehmen.');
      t.marks.pop();
    },
    // Notfall, falls das iPad des Teams ausfällt: für das Team starten bzw. stoppen.
    buzzFor(db, ctx, game, st) {
      const r = current(st);
      const id = activeTeam(r);
      if (!id) fail('Kein Team ist dran.');
      return module.exports.team.buzz(db, { ...ctx, teamId: id }, game, st);
    },
    next(db, ctx, game, st) {
      const r = current(st);
      const id = activeTeam(r);
      if (id && turnOf(r, id).phase !== 'stopped') fail('Das Team ist noch nicht fertig.');
      if (r.turn + 1 >= r.order.length) {
        r.done = true;
        log(db, ctx, 'ablauf', `30 Seconds: Durchgang ${st.index + 1} beendet`);
        return;
      }
      r.turn += 1;
      log(db, ctx, 'ablauf', `30 Seconds: ${teamName(db, activeTeam(r))} ist dran`);
    },
  },

  // Wer viel zu lange nicht stoppt, hat automatisch verpasst (0 Punkte).
  tick(db, ctx, game, st) {
    if (st.index < 0) return false;
    const r = round(st, st.index);
    const id = activeTeam(r);
    const t = id && r.turns[id];
    if (!t || t.phase !== 'running') return false;
    const limit = t.startedAt + (secondsOf(game) + tolOf(game, st.index)) * 1000 + AUTO_STOP_EXTRA_MS;
    if (ctx.now < limit) return false;
    stop(db, ctx, game, st, r, id, t, true);
    return true;
  },
  wakeAt(db, game, st, now) {
    if (st.index < 0) return null;
    const r = round(st, st.index);
    const id = activeTeam(r);
    const t = id && r.turns[id];
    if (!t || t.phase !== 'running') return null;
    const limit = t.startedAt + (secondsOf(game) + tolOf(game, st.index)) * 1000 + AUTO_STOP_EXTRA_MS;
    return limit > now ? limit : null;
  },

  teamView(db, game, st, teamId) {
    if (st.index < 0) return null;
    const r = round(st, st.index);
    const id = activeTeam(r);
    const mine = r.turns[teamId];
    const cur = id && r.turns[id];
    return {
      index: st.index,
      count: game.content.rounds.length,
      seconds: secondsOf(game),
      tol: tolOf(game, st.index),
      myTurn: !r.done && id === teamId,
      turnTeam: r.done ? null : id,
      phase: mine ? mine.phase : 'waiting',
      running: !!(cur && cur.phase === 'running'),
      // Während des eigenen Zuges keine Uhr und keine Zwischenstände – nur die Zahl der Fragen.
      answered: mine && mine.phase === 'running' ? mine.marks.length : null,
      result: mine && mine.phase === 'stopped' ? { elapsed: mine.elapsed, ok: mine.ok, late: mine.late, correct: mine.correct, points: mine.points } : null,
      done: r.done,
    };
  },

  beamerView(db, game, st) {
    if (st.index < 0) return { waiting: true };
    const r = round(st, st.index);
    const id = activeTeam(r);
    const t = id && r.turns[id];
    const p = id ? r.order.indexOf(id) : 0;
    const q = t && t.phase === 'running' ? questionFor(game, st.index, p, t.marks.length) : null;
    return {
      index: st.index,
      count: game.content.rounds.length,
      seconds: secondsOf(game),
      tol: tolOf(game, st.index),
      done: r.done,
      turn: r.done ? null : id,
      phase: t ? t.phase : 'ready',
      // Laufender Zug: Frage (ohne Lösung) und Zwischenstand der Wertungen, aber keine Uhr.
      question: q ? { topic: q.topic, text: q.question, n: t.marks.length + 1 } : null,
      outOfQuestions: !!(t && t.phase === 'running' && !q),
      marks: t ? t.marks : [],
      result: t && t.phase === 'stopped' ? { elapsed: t.elapsed, ok: t.ok, late: t.late, correct: t.correct, points: t.points } : null,
      order: r.order.map((x) => {
        const tt = r.turns[x];
        return { teamId: x, state: tt ? tt.phase : 'ready', points: tt && tt.phase === 'stopped' ? tt.points : null, ok: tt && tt.phase === 'stopped' ? tt.ok : null };
      }),
    };
  },
};
