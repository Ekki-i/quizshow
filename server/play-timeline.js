'use strict';

// Spiel „Remember the Timeline“: Pro Durchgang steht ein Referenzbegriff schon auf
// der Zeitachse, zehn weitere Begriffe müssen eingeordnet werden. Das Startteam
// wird zufällig gelost, danach reihum im Uhrzeigersinn (Teamreihenfolge). Das
// aktive Team wählt einen freien Begriff und legt ihn vor, nach oder zwischen
// die liegenden Begriffe. Richtig = 1 Punkt im Durchgang. Falsch = alle Punkte
// dieses Durchgangs weg, das Team scheidet für den Durchgang aus, der Begriff
// wird an der richtigen Stelle eingefügt (verbraucht). Freiwilliger Ausstieg
// behält die Punkte. Der Durchgang endet, wenn alle zehn liegen oder kein Team
// mehr aktiv ist; dann werden die Durchgangspunkte genau einmal gutgeschrieben.
// Gleiche Sortierwerte sind nicht erlaubt (der Editor/Start meldet sie).

const { fail, log, effect, teamName, teamIds, bookTarget, randomInt } = require('./core');
const { pv } = require('./scoring');
const { sortValue, shuffled } = require('./match');

const N = 10;

// Sortierwerte eines Durchgangs: reine Zahlen werden direkt verglichen, sonst als Jahr/Datum.
function values(rd) {
  const raw = [rd.refValue, ...(rd.items || []).map((it) => it.value)].map((v) => String(v ?? '').trim());
  const numeric = raw.every((v) => /^-?\d+([.,]\d+)?$/.test(v));
  return raw.map((v) => (numeric ? Number(v.replace(',', '.')) : sortValue(v)));
}
function validate(rd) {
  if (!String(rd.reference || '').trim()) return 'Der Referenzbegriff fehlt.';
  const items = rd.items || [];
  if (items.length !== N || items.some((it) => !String(it.label || '').trim())) return 'Es müssen genau zehn Begriffe eingetragen sein.';
  const v = values(rd);
  const bad = v.findIndex((x) => x === null);
  if (bad >= 0) return `Sortierwert fehlt oder ist unklar bei ${bad === 0 ? 'dem Referenzbegriff' : `„${items[bad - 1].label}“`} (z. B. 1999 oder 2001-09-11).`;
  const seen = new Map();
  for (let i = 0; i < v.length; i++) {
    const name = i === 0 ? rd.reference : items[i - 1].label;
    if (seen.has(v[i])) return `Gleicher Sortierwert bei „${seen.get(v[i])}“ und „${name}“ – bitte genauer angeben (z. B. Monat/Tag).`;
    seen.set(v[i], name);
  }
  return null;
}

function current(st) {
  if (st.index < 0 || !st.rounds[st.index]) fail('Es läuft gerade kein Durchgang.');
  return st.rounds[st.index];
}
const activeIds = (r) => r.order.filter((id) => r.teams[id].state === 'active');
function nextTurn(r) {
  const act = activeIds(r);
  if (!act.length || !r.pool.length) { r.turn = null; return; }
  const start = r.turn ? r.order.indexOf(r.turn) : -1;
  for (let k = 1; k <= r.order.length; k++) {
    const id = r.order[(start + k + r.order.length) % r.order.length];
    if (r.teams[id].state === 'active') { r.turn = id; return; }
  }
  r.turn = null;
}
function finish(db, ctx, game, st, r) {
  if (r.done) return;
  r.done = true;
  r.turn = null;
  for (const id of r.order) bookTarget(db, ctx, `timeline:${game.id}:${st.index}:${id}`, id, r.teams[id].points, `${game.title}, Durchgang ${st.index + 1}`);
  log(db, ctx, 'ablauf', `Timeline: Durchgang ${st.index + 1} beendet, Punkte gutgeschrieben`);
  effect(db, 'reveal');
}

module.exports = {
  init: () => ({ index: -1, rounds: {} }),
  validate,
  values,

  team: {
    // { item: k (0–9), pos: Lücke 0…Länge der Zeitachse }
    place(db, ctx, game, st, p) {
      const r = current(st);
      if (r.done) fail('Der Durchgang ist beendet.');
      if (r.turn !== ctx.teamId) fail('Ihr seid gerade nicht am Zug.');
      const k = Number(p.item);
      if (!r.pool.includes(k)) fail('Dieser Begriff ist nicht mehr verfügbar.');
      const pos = Number(p.pos);
      if (!(Number.isInteger(pos) && pos >= 0 && pos <= r.line.length)) fail('Ungültige Stelle.');
      const v = values(game.content.rounds[st.index]);
      const val = (x) => v[x === 'ref' ? 0 : x + 1];
      const left = pos > 0 ? val(r.line[pos - 1]) : -Infinity;
      const right = pos < r.line.length ? val(r.line[pos]) : Infinity;
      const ok = left < val(k) && val(k) < right;
      // Richtige Stelle (für den Fehlerfall): hinter allen kleineren Werten.
      const correctPos = r.line.filter((x) => val(x) < val(k)).length;
      r.pool = r.pool.filter((x) => x !== k);
      r.line.splice(ok ? pos : correctPos, 0, k);
      const t = r.teams[ctx.teamId];
      if (ok) t.points += pv(game, 'correct');
      else { t.lost = t.points; t.points = 0; t.state = 'out'; }
      r.last = { teamId: ctx.teamId, item: k, ok, pos: ok ? pos : correctPos, tried: pos, at: ctx.now };
      r.history.push(r.last);
      log(db, ctx, 'antwort', `Timeline: ${teamName(db, ctx.teamId)} ordnet „${game.content.rounds[st.index].items[k].label}“ ein – ${ok ? 'richtig' : 'falsch'}`);
      effect(db, ok ? 'correct' : 'wrong');
      nextTurn(r);
      if (!r.pool.length || !activeIds(r).length) finish(db, ctx, game, st, r);
    },
    // Freiwillig aussteigen: Punkte des Durchgangs bleiben.
    quit(db, ctx, game, st) {
      const r = current(st);
      if (r.done) fail('Der Durchgang ist beendet.');
      const t = r.teams[ctx.teamId];
      if (!t || t.state !== 'active') fail('Ihr seid in diesem Durchgang nicht mehr aktiv.');
      t.state = 'quit';
      log(db, ctx, 'ablauf', `Timeline: ${teamName(db, ctx.teamId)} steigt aus (${t.points} Punkte bleiben)`);
      if (r.turn === ctx.teamId) nextTurn(r);
      if (!activeIds(r).length) finish(db, ctx, game, st, r);
    },
  },

  mod: {
    open(db, ctx, game, st, p) {
      const i = Number(p.index);
      const rd = game.content.rounds[i];
      if (!rd) fail('Durchgang nicht gefunden.');
      if (st.index >= 0 && st.index !== i && st.rounds[st.index] && !st.rounds[st.index].done) fail('Erst den laufenden Durchgang beenden.');
      st.index = i;
      if (st.rounds[i]) return; // schon gestartet: nur wieder anzeigen
      const err = validate(rd);
      if (err) fail(`Durchgang ${i + 1} kann nicht starten: ${err}`);
      const order = teamIds(db);
      if (!order.length) fail('Keine Teams vorhanden.');
      const startTeam = order[randomInt(order.length)];
      const r = {
        order, line: ['ref'], pool: shuffled([...Array(N).keys()], `${game.id}:tl:${i}`), turn: null,
        teams: Object.fromEntries(order.map((id) => [id, { points: 0, state: 'active', lost: 0 }])),
        startTeam, last: null, history: [], done: false,
      };
      r.turn = startTeam;
      st.rounds[i] = r;
      log(db, ctx, 'ablauf', `Timeline: Durchgang ${i + 1} gestartet – Startteam ${teamName(db, startTeam)} (ausgelost)`);
    },
    // Manuell beenden (z. B. wenn die Zeit drängt) – Punkte werden gutgeschrieben.
    end(db, ctx, game, st) {
      const r = current(st);
      if (r.done) fail('Schon beendet.');
      finish(db, ctx, game, st, r);
    },
  },

  teamView(db, game, st, teamId) {
    if (st.index < 0 || !st.rounds[st.index]) return st.index < 0 ? null : { waiting: true, index: st.index };
    const r = st.rounds[st.index];
    const rd = game.content.rounds[st.index];
    const label = (x) => (x === 'ref' ? rd.reference : rd.items[x].label);
    const shown = (x) => (x === 'ref' ? rd.refValue : rd.items[x].value);
    const me = r.teams[teamId] || { points: 0, state: 'out' };
    return {
      index: st.index,
      count: game.content.rounds.length,
      category: rd.category,
      line: r.line.map((x) => ({ label: label(x), value: shown(x), ref: x === 'ref' })),
      pool: r.pool.map((k) => ({ k, label: rd.items[k].label })),
      myTurn: r.turn === teamId && !r.done,
      turnTeam: r.turn,
      state: me.state,
      points: me.points,
      lost: me.lost,
      last: r.last ? { ...r.last, label: label(r.last.item) } : null,
      done: r.done,
    };
  },

  beamerView(db, game, st) {
    if (st.index < 0) return { waiting: true };
    const rd = game.content.rounds[st.index];
    const r = st.rounds[st.index];
    if (!r) return { index: st.index, category: rd.category, notStarted: true };
    const label = (x) => (x === 'ref' ? rd.reference : rd.items[x].label);
    const shown = (x) => (x === 'ref' ? rd.refValue : rd.items[x].value);
    return {
      index: st.index,
      category: rd.category,
      line: r.line.map((x) => ({ label: label(x), value: shown(x), ref: x === 'ref', last: r.last && r.last.item === x })),
      pool: r.pool.map((k) => rd.items[k].label),
      turn: r.turn,
      startTeam: r.startTeam,
      teams: r.order.map((id) => ({ teamId: id, ...r.teams[id] })),
      last: r.last ? { ...r.last, label: label(r.last.item) } : null,
      done: r.done,
    };
  },
};
