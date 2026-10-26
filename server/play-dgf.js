'use strict';

// Spiel „DankeGleichFalsch“: Board mit 25 Begriffen, 22 passen zur Kategorie,
// 3 nicht. Die Teams wählen reihum (Startteam je Kategorie ausgelost, danach im
// Uhrzeigersinn) mit 60 Sekunden pro Auswahl.
// Richtig: Begriff verschwindet, +1 ungesicherter Rundenpunkt.
// Falsch: Das Team scheidet aus, Rundenpunkte 0 – welcher Begriff falsch war,
// bleibt geheim, der Begriff bleibt auf dem Board.
// Zeit abgelaufen: ausgeschieden, Rundenpunkte 0.
// Aussteigen: Punkte werden sofort gutgeschrieben, das Team ist raus.
// Runde vorbei, wenn alle 22 gefunden sind (Teams im Spiel bekommen ihre Punkte)
// oder kein Team mehr im Spiel ist.

const { fail, log, effect, teamName, teamIds, bookTarget, randomInt } = require('./core');

const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function secondsOf(game) {
  const n = Number(game.content.seconds);
  return Number.isFinite(n) && n >= 10 ? n : 60;
}

function current(st) {
  if (st.catIndex < 0 || !st.rounds[st.catIndex]) fail('Es läuft gerade keine Kategorie.');
  return st.rounds[st.catIndex];
}

const inGame = (r, id) => r.teams[id] && r.teams[id].out === null;

// Nächstes aktives Team im Uhrzeigersinn nach dem aktuellen.
function advance(db, ctx, game, r) {
  const order = r.order;
  for (let k = 1; k <= order.length; k++) {
    const id = order[(r.turn + k) % order.length];
    if (inGame(r, id)) {
      r.turn = order.indexOf(id);
      r.deadline = ctx.now + secondsOf(game) * 1000;
      return;
    }
  }
  r.deadline = null;
}

function finish(db, ctx, game, st, r, reason) {
  r.done = true;
  r.deadline = null;
  // Wer bei gelöstem Board (oder Ende durch die Moderation) noch im Spiel ist, bekommt seine Punkte.
  if (reason !== 'empty') {
    for (const id of r.order) {
      if (inGame(r, id)) {
        r.teams[id].out = 'finished';
        bookTarget(db, ctx, `dgf:${game.id}:${st.catIndex}:${id}`, id, r.teams[id].points, `${game.title}, ${r.name}`);
      }
    }
  }
  log(db, ctx, 'ablauf', `Kategorie „${r.name}“ beendet (${{ solved: 'alle 22 gefunden', empty: 'kein Team mehr im Spiel', closed: 'von der Moderation beendet' }[reason]})`);
  effect(db, 'reveal');
}

function checkEnd(db, ctx, game, st, r) {
  const remainingRight = r.board.filter((b) => !b.wrong && !b.gone).length;
  if (remainingRight === 0) return finish(db, ctx, game, st, r, 'solved');
  if (!r.order.some((id) => inGame(r, id))) return finish(db, ctx, game, st, r, 'empty');
  return null;
}

function eliminate(db, ctx, r, id, how) {
  r.teams[id].out = how;
  r.teams[id].lost = r.teams[id].points;
  r.teams[id].points = 0;
  r.flash = { teamId: id, kind: how, seq: (r.flash?.seq || 0) + 1 };
}

module.exports = {
  init: () => ({ catIndex: -1, rounds: {} }),

  team: {
    pick(db, ctx, game, st, p) {
      const r = current(st);
      if (r.done) fail('Diese Kategorie ist beendet.');
      const id = r.order[r.turn];
      if (id !== ctx.teamId) fail('Ihr seid gerade nicht an der Reihe.');
      const term = r.board.find((b) => b.id === p.termId && !b.gone);
      if (!term) fail('Diesen Begriff gibt es nicht (mehr).');
      if (term.wrong) {
        eliminate(db, ctx, r, id, 'wrong');
        // Absichtlich ohne Begriff: niemand soll erfahren, welcher falsch ist.
        log(db, ctx, 'bewertung', `${teamName(db, id)}: falsch – ausgeschieden`);
        effect(db, 'wrong');
      } else {
        term.gone = true;
        term.by = id;
        r.teams[id].points += 1;
        r.flash = { teamId: id, kind: 'right', term: term.text, seq: (r.flash?.seq || 0) + 1 };
        log(db, ctx, 'bewertung', `${teamName(db, id)}: „${term.text}“ richtig (${r.teams[id].points} ungesichert)`);
        effect(db, 'correct');
      }
      if (!checkEnd(db, ctx, game, st, r)) advance(db, ctx, game, r);
    },

    // Freiwillig aussteigen: Punkte sofort sichern.
    secure(db, ctx, game, st) {
      const r = current(st);
      if (r.done) fail('Diese Kategorie ist beendet.');
      if (!inGame(r, ctx.teamId)) fail('Ihr seid in dieser Kategorie nicht mehr im Spiel.');
      const t = r.teams[ctx.teamId];
      t.out = 'secured';
      bookTarget(db, ctx, `dgf:${game.id}:${st.catIndex}:${ctx.teamId}`, ctx.teamId, t.points, `${game.title}, ${r.name} (gesichert)`);
      r.flash = { teamId: ctx.teamId, kind: 'secured', seq: (r.flash?.seq || 0) + 1 };
      log(db, ctx, 'ablauf', `${teamName(db, ctx.teamId)} steigt aus und sichert ${t.points}`);
      const wasTurn = r.order[r.turn] === ctx.teamId;
      if (!checkEnd(db, ctx, game, st, r) && wasTurn) advance(db, ctx, game, r);
    },
  },

  mod: {
    open(db, ctx, game, st, p) {
      const c = Number(p.catIndex);
      const cat = game.content.categories[c];
      if (!cat) fail('Kategorie nicht gefunden.');
      if (st.catIndex >= 0 && st.catIndex !== c && st.rounds[st.catIndex] && !st.rounds[st.catIndex].done) fail('Erst die laufende Kategorie beenden.');
      st.catIndex = c;
      if (st.rounds[c]) return;
      const right = lines(cat.right);
      const wrong = lines(cat.wrong);
      if (right.length !== 22 || wrong.length !== 3) fail(`„${cat.name}“ braucht genau 22 passende und 3 falsche Begriffe (jetzt ${right.length} und ${wrong.length}).`);
      const ids = teamIds(db);
      if (!ids.length) fail('Keine Teams angelegt.');
      const start = randomInt(ids.length);
      const board = shuffle([...right.map((t) => ({ text: t, wrong: false })), ...wrong.map((t) => ({ text: t, wrong: true }))])
        .map((b, i) => ({ id: `t${i}`, ...b, gone: false, by: null }));
      st.rounds[c] = {
        name: cat.name, board, order: ids, turn: start, deadline: ctx.now + secondsOf(game) * 1000,
        teams: Object.fromEntries(ids.map((id) => [id, { points: 0, out: null, lost: 0 }])), done: false, flash: null,
      };
      log(db, ctx, 'ablauf', `Kategorie „${cat.name}“: Startteam ausgelost – ${teamName(db, ids[start])}`);
      effect(db, 'reveal');
    },

    // Kategorie von Hand beenden: Teams, die noch im Spiel sind, bekommen ihre Punkte wie bei gelöstem Board.
    close(db, ctx, game, st) {
      const r = current(st);
      if (r.done) fail('Schon beendet.');
      finish(db, ctx, game, st, r, 'closed');
    },
  },

  // Zeit abgelaufen: Team scheidet aus (auch mehrere hintereinander, falls die Anwendung pausiert war).
  tick(db, ctx, game, st) {
    if (st.catIndex < 0) return false;
    const r = st.rounds[st.catIndex];
    if (!r || r.done || !r.deadline) return false;
    let changed = false;
    while (!r.done && r.deadline && ctx.now >= r.deadline) {
      const id = r.order[r.turn];
      const deadline = r.deadline;
      eliminate(db, ctx, r, id, 'timeout');
      log(db, ctx, 'ablauf', `${teamName(db, id)}: Zeit abgelaufen – ausgeschieden`);
      effect(db, 'wrong');
      changed = true;
      if (!checkEnd(db, { ...ctx, now: deadline }, game, st, r)) advance(db, { ...ctx, now: deadline }, game, r);
    }
    return changed;
  },

  wakeAt(db, game, st, now) {
    if (st.catIndex < 0) return null;
    const r = st.rounds[st.catIndex];
    return r && !r.done && r.deadline ? Math.max(r.deadline, now + 50) : null;
  },

  teamView(db, game, st, teamId) {
    if (st.catIndex < 0 || !st.rounds[st.catIndex]) return st.catIndex < 0 ? null : { waiting: true };
    const r = st.rounds[st.catIndex];
    const me = r.teams[teamId] || { points: 0, out: 'none' };
    return {
      catIndex: st.catIndex,
      name: r.name,
      board: r.board.filter((b) => !b.gone).map((b) => ({ id: b.id, text: b.text })),
      found: r.board.filter((b) => b.gone).length,
      turn: r.order[r.turn],
      myTurn: !r.done && r.order[r.turn] === teamId && me.out === null,
      deadline: r.deadline,
      points: me.points,
      out: me.out,
      lost: me.lost,
      done: r.done,
      flash: r.flash && r.flash.teamId === teamId ? r.flash : null,
      // Die falschen Begriffe erst nach Ende der Kategorie.
      wrongTerms: r.done ? r.board.filter((b) => b.wrong).map((b) => b.text) : null,
    };
  },

  beamerView(db, game, st) {
    if (st.catIndex < 0 || !st.rounds[st.catIndex]) return { waiting: true };
    const r = st.rounds[st.catIndex];
    return {
      catIndex: st.catIndex,
      name: r.name,
      // Bestätigt richtige Begriffe verschwinden; welche falsch sind, bleibt bis zum Ende geheim.
      board: r.board.map((b) => ({ id: b.id, text: b.text, gone: b.gone, by: b.gone ? b.by : null, wrong: r.done ? b.wrong : undefined })),
      found: r.board.filter((b) => b.gone).length,
      turn: r.done ? null : r.order[r.turn],
      deadline: r.deadline,
      teams: r.order.map((id) => ({ teamId: id, points: r.teams[id].points, out: r.teams[id].out })),
      flash: r.flash ? { teamId: r.flash.teamId, kind: r.flash.kind, seq: r.flash.seq } : null,
      done: r.done,
    };
  },
};
