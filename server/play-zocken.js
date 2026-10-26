'use strict';

// Spiel „Erst ich, dann du, dann du, dann du“: 24 nummerierte Felder mit
// schweren Fragen. Die Moderation öffnet eine Frage, alle dürfen buzzern.
// Richtig: +1 ungesicherter Punkt in der Zock-Serie des Teams, danach
// „Punkt sichern“ (Serie wird gutgeschrieben, endet) oder „zocken“ (das Team
// wählt ein weiteres Feld und muss es allein beantworten).
// Falsch: Die ungesicherten Punkte der Serie sind weg, die Frage bleibt auf dem
// Brett und die anderen Teams dürfen buzzern. Richtig beantwortete Fragen
// verschwinden; das Spiel endet, wenn alle 24 weg sind.

const { fail, log, effect, teamName, bookTarget, buzzIn, currentBuzz, buzzTeamView } = require('./core');

function freshQuestion(st, q, mode, zockTeam = null) {
  st.current = { q, mode, zockTeam, buzzes: [], locked: [], resolved: false };
}

function cur(st) {
  if (!st.current) fail('Gerade ist keine Frage offen.');
  return st.current;
}

// Serie gutschreiben: jede Serie bekommt eine eigene Buchung.
function secure(db, ctx, game, st, teamId) {
  const amount = st.streak[teamId] || 0;
  st.series[teamId] = (st.series[teamId] || 0) + 1;
  if (amount > 0) bookTarget(db, ctx, `zocken:${game.id}:${teamId}:${st.series[teamId]}`, teamId, amount, `${game.title}, Zock-Serie gesichert`);
  st.secured[teamId] = (st.secured[teamId] || 0) + amount;
  st.streak[teamId] = 0;
  st.last = { teamId, kind: 'secured', v: amount };
  log(db, ctx, 'punkte', `${teamName(db, teamId)} sichert ${amount}`);
}

const remaining = (st) => st.removed.length < 24;

module.exports = {
  init: () => ({ removed: [], current: null, decide: null, choose: null, streak: {}, secured: {}, series: {} }),

  team: {
    buzz(db, ctx, game, st) {
      const c = cur(st);
      if (c.mode !== 'open') fail('Diese Frage beantwortet das zockende Team allein.');
      if (currentBuzz(c)) fail('Ein anderes Team antwortet gerade.');
      buzzIn(db, ctx, c);
    },

    // Nach einer richtigen Antwort: sichern oder zocken.
    decide(db, ctx, game, st, p) {
      if (!st.decide || st.decide !== ctx.teamId) fail('Ihr seid gerade nicht am Zug.');
      st.decide = null;
      if (p.choice === 'secure' || !remaining(st)) {
        secure(db, ctx, game, st, ctx.teamId);
        effect(db, 'reveal');
      } else {
        st.choose = ctx.teamId;
        log(db, ctx, 'ablauf', `${teamName(db, ctx.teamId)} zockt mit ${st.streak[ctx.teamId]} ungesicherten Punkten`);
      }
    },

    // Zockendes Team wählt das nächste Feld.
    choose(db, ctx, game, st, p) {
      if (st.choose !== ctx.teamId) fail('Ihr wählt gerade kein Feld.');
      const q = Number(p.q);
      if (!Number.isInteger(q) || q < 0 || q > 23 || st.removed.includes(q)) fail('Dieses Feld ist nicht mehr frei.');
      st.choose = null;
      freshQuestion(st, q, 'zock', ctx.teamId);
      log(db, ctx, 'ablauf', `${teamName(db, ctx.teamId)} wählt Feld ${q + 1}`);
      effect(db, 'title');
    },
  },

  mod: {
    // Eine Frage zum Buzzern öffnen (Spielbeginn oder nach einer gesicherten Serie).
    open(db, ctx, game, st, p) {
      const q = Number(p.q);
      if (!Number.isInteger(q) || q < 0 || q > 23 || st.removed.includes(q)) fail('Dieses Feld ist nicht mehr frei.');
      if (st.decide || st.choose) fail('Ein Team entscheidet gerade (sichern oder zocken).');
      if (st.current && !st.current.resolved && st.current.buzzes.some((b) => b.status === 'pending')) fail('Erst die laufende Antwort bewerten.');
      freshQuestion(st, q, 'open');
      log(db, ctx, 'ablauf', `Feld ${q + 1} geöffnet – Buzzer frei`);
      effect(db, 'title');
    },

    judge(db, ctx, game, st, p) {
      const c = cur(st);
      if (c.resolved) fail('Diese Frage ist schon beantwortet.');
      let teamId;
      if (c.mode === 'zock') teamId = c.zockTeam;
      else {
        const b = currentBuzz(c);
        if (!b) fail('Gerade antwortet kein Team.');
        teamId = b.teamId;
        b.status = p.correct ? 'correct' : 'wrong';
      }
      if (p.correct) {
        c.resolved = true;
        st.removed.push(c.q);
        st.streak[teamId] = (st.streak[teamId] || 0) + 1;
        st.decide = teamId;
        st.last = { teamId, kind: 'won', v: st.streak[teamId] };
        log(db, ctx, 'bewertung', `${teamName(db, teamId)}: Feld ${c.q + 1} richtig – ${st.streak[teamId]} ungesichert`);
        effect(db, 'correct');
        if (!remaining(st)) {
          // Letzte Frage gelöst: Serie automatisch sichern, Spiel vorbei.
          st.decide = null;
          secure(db, ctx, game, st, teamId);
        }
      } else {
        const lost = st.streak[teamId] || 0;
        st.streak[teamId] = 0;
        st.last = { teamId, kind: 'lost', v: lost };
        log(db, ctx, 'bewertung', `${teamName(db, teamId)}: Feld ${c.q + 1} falsch${lost ? ` – ${lost} ungesicherte Punkte verloren` : ''}`);
        effect(db, 'wrong');
        // Frage bleibt auf dem Brett; jetzt dürfen die anderen buzzern.
        if (c.mode === 'zock') {
          freshQuestion(st, c.q, 'open');
          st.current.locked.push(teamId);
        } else {
          c.locked.push(teamId);
        }
      }
    },

    // Frage zurück aufs Brett legen (z. B. niemand weiß es).
    release(db, ctx, game, st) {
      const c = cur(st);
      if (c.resolved) fail('Diese Frage ist schon beantwortet.');
      if (currentBuzz(c)) fail('Erst die laufende Antwort bewerten.');
      if (c.mode === 'zock') fail('Das zockende Team muss diese Frage beantworten.');
      st.current = null;
      log(db, ctx, 'ablauf', `Feld ${c.q + 1} zurück aufs Brett`);
    },

    // Falls ein Team-iPad ausfällt: Entscheidung für das Team treffen.
    decideFor(db, ctx, game, st, p) {
      if (!st.decide) fail('Gerade entscheidet kein Team.');
      return module.exports.team.decide(db, { ...ctx, teamId: st.decide }, game, st, p);
    },
  },

  teamView(db, game, st, teamId) {
    const c = st.current;
    const q = c ? game.content.questions[c.q] : null;
    return {
      removed: st.removed,
      current: c ? { q: c.q, mode: c.mode, zockTeam: c.zockTeam, question: q.question, resolved: c.resolved } : null,
      ...(c && c.mode === 'open' ? buzzTeamView(c, teamId) : {}),
      canBuzz: !!c && c.mode === 'open' && !c.resolved && !currentBuzz(c) && !c.locked.includes(teamId),
      zocking: !!c && c.mode === 'zock' && c.zockTeam === teamId && !c.resolved,
      decide: st.decide === teamId,
      choose: st.choose === teamId,
      streak: st.streak[teamId] || 0,
      secured: st.secured[teamId] || 0,
      done: !remaining(st),
    };
  },

  beamerView(db, game, st) {
    const c = st.current;
    const pending = c && c.mode === 'open' ? currentBuzz(c) : null;
    return {
      removed: st.removed,
      current: c ? {
        q: c.q, mode: c.mode, zockTeam: c.zockTeam, question: game.content.questions[c.q].question, resolved: c.resolved,
        answer: c.resolved ? game.content.questions[c.q].answer : null,
        answering: c.mode === 'zock' ? c.zockTeam : pending ? pending.teamId : null,
        buzzOrder: c.buzzes.map((b) => ({ teamId: b.teamId, status: b.status })),
      } : null,
      decide: st.decide,
      choose: st.choose,
      streaks: Object.entries(st.streak).filter(([, v]) => v > 0).map(([teamId, v]) => ({ teamId, v })),
      // Laufende Zock-Serie: wie viele Punkte gerade erspielt sind bzw. auf dem Spiel stehen.
      series: (() => {
        const id = st.decide || st.choose || (c && c.mode === 'zock' && !c.resolved ? c.zockTeam : null);
        return id ? { teamId: id, v: st.streak[id] || 0, phase: st.decide ? 'decide' : st.choose ? 'choose' : 'zock' } : null;
      })(),
      last: st.last || null,
      done: !remaining(st),
    };
  },
};
