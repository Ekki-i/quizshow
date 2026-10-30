'use strict';

// Spiel „Brain or Dreh'n“: 12 Kategorien mit je einer A–D-Frage. Alle Teams
// antworten (kein Buzzer). Richtige Antwort = Spielpunkt(e). Danach dürfen die
// richtigen Teams buzzern; das schnellste dreht das Glücksrad (12 Felder:
// 6 positive Joker für den Vorrat, 6 negative, die sofort wirken – im Editor
// per Dropdown aus der Joker-Datenbank mit 16 Jokern gewählt). Jedes Feld
// hat dieselbe Wahrscheinlichkeit (gleichverteilter Zufall über alle Felder).
// Spielpunkte laufen getrennt (nie unter 0) und gehen erst mit „Spiel beenden“
// in den Show-Gesamtstand. Joker gelten nur für das eigene Team, außer der
// Joker nennt ausdrücklich ein anderes Team.
//
// Ablauf je Runde: category (Kategorie groß, Joker einsetzen) → question
// (Frage, Antworten) → evaluated (Auflösung, Punkte) → wheel (Buzzer, Rad) → nächste Runde.

const core = require('./core');

const { fail, log, effect, teamName, teamIds, bookTarget, cleanChoice } = core;
// Zufall über core.randomInt (im Test austauschbar).
const randomInt = (n) => core.randomInt(n);
const { WHEEL, WHEEL_SLOTS } = require('./defaults-extra');

const NEEDS_TARGET = ['raeuber', 'dieb', 'blockade', 'detektiv', 'tausch'];
const SECRET = ['detektiv', 'tausch']; // Auswahl bleibt geheim

// Glücksrad dieses Spiels: Namen, Symbole, Texte und Werte der Joker sind im
// Editor änderbar; die Wirkung (Mechanik) jedes Feldes bleibt gleich.
const JOKER_VALUES = { doppel: 2, streak: 2, raeuber: 2, minus2: 2, minus1: 1, raub: 2 };
function wheelOf(game) {
  const c = (game && game.content) || {};
  return WHEEL.map((w) => {
    const side = c[w.good ? 'good' : 'bad'];
    const pos = WHEEL.filter((x) => x.good === w.good).indexOf(w);
    const o = (side && Array.isArray(side.jokers) && side.jokers[pos]) || (Array.isArray(c.jokers) && c.jokers[WHEEL.indexOf(w)]) || {};
    const val = typeof o.value === 'number' && Number.isFinite(o.value) ? o.value : JOKER_VALUES[w.key];
    return { ...w, name: (o.name || '').trim() || w.name, icon: (o.icon || '').trim() || w.icon, text: (o.text || '').trim() || w.text, value: val ?? null };
  });
}
const fieldByKey = (game, k) => wheelOf(game).find((f) => f.key === k);
const GOOD_KEYS = WHEEL.filter((w) => w.good).map((w) => w.key);
const BAD_KEYS = WHEEL.filter((w) => !w.good).map((w) => w.key);

// Gewählte Joker fürs Rad (6 gute, 6 fiese). Ältere Inhalte ohne Auswahl: die ersten sechs.
function slotKeys(game) {
  const c = (game && game.content) || {};
  const pick = (arr, keys) => Array.from({ length: WHEEL_SLOTS }, (_, i) => {
    const k = Array.isArray(arr) && arr[i] ? arr[i].joker : null;
    return keys.includes(k) ? k : keys[i];
  });
  return { good: pick(c.good ? c.good.slots : c.goodSlots, GOOD_KEYS), bad: pick(c.bad ? c.bad.slots : c.badSlots, BAD_KEYS) };
}
// Fehlermeldung, wenn ein Joker doppelt aufs Rad gelegt wurde (sonst null).
function slotProblem(game) {
  const { good, bad } = slotKeys(game);
  const dup = (keys) => [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))].map((k) => `„${fieldByKey(game, k).name}“`);
  const d = [...dup(good), ...dup(bad)];
  return d.length ? `Auf dem Glücksrad ist ${d.join(', ')} doppelt gewählt – jeder Joker darf nur einmal aufs Rad.` : null;
}
// Die 12 Felder des Rads in Reihenfolge (abwechselnd gut/fies), Index = Position auf dem Rad.
function wheelFields(game) {
  const { good, bad } = slotKeys(game);
  const out = [];
  for (let i = 0; i < WHEEL_SLOTS; i += 1) out.push(fieldByKey(game, good[i]), fieldByKey(game, bad[i]));
  return out;
}
// Ergebnis eines Drehs (ältere Spielstände kannten nur die Feldnummer n).
const spunField = (game, spin) => (spin.key ? fieldByKey(game, spin.key) : wheelOf(game).find((f) => f.n === spin.n));
const val = (game, k) => fieldByKey(game, k).value ?? JOKER_VALUES[k];

function teamState(st, id) {
  if (!st.t[id]) st.t[id] = { points: 0, jokers: [], streak: null, double: false, ban: false, blockedBy: null, jokerLock: false };
  return st.t[id];
}

// Teams, denen man einen Joker stehlen kann (haben mindestens einen im Vorrat).
const thievable = (db, st, teamId) => teamIds(db).filter((id) => id !== teamId && teamState(st, id).jokers.length > 0);

function sub(t, n) {
  const taken = Math.min(t.points, n);
  t.points -= taken;
  return taken;
}

function cur(st) {
  if (st.round < 0) fail('Das Spiel hat noch nicht begonnen.');
  return st.r;
}

function note(st, text, pub = true) {
  st.events.push({ seq: st.events.length + 1, text, pub });
  if (st.events.length > 40) st.events.shift();
}

function newRound(db, st, i) {
  st.round = i;
  st.r = { phase: 'category', joker: null, answers: {}, swapped: null, evaluated: false, buzz: null, spin: null, removed: {} };
  // Sperren aus der Vorrunde gelten genau für diese Frage.
  for (const id of teamIds(db)) {
    const t = teamState(st, id);
    t.blockedNow = t.ban || !!t.blockedBy;
    t.ban = false;
    t.blockedBy = null;
    // Joker-Sperre gilt für genau diesen Kategoriewechsel.
    t.lockNow = t.jokerLock;
    t.jokerLock = false;
  }
}

// Positiver Joker aus dem Vorrat wirkt auf die anstehende Frage.
function applyJoker(db, ctx, game, st, teamId, joker, target) {
  const t = teamState(st, teamId);
  const r = st.r;
  const f = fieldByKey(game, joker.key);
  r.joker = { teamId, key: joker.key, target: target || null };
  switch (joker.key) {
    case 'doppel': t.double = val(game, 'doppel'); note(st, `${teamName(db, teamId)} setzt „${f.name}“ ein`); break;
    case 'streak': t.streak = val(game, 'streak'); note(st, `${teamName(db, teamId)} startet eine Streak`); break;
    case 'fifty': {
      const q = game.content.rounds[st.round];
      const wrong = ['A', 'B', 'C', 'D'].filter((l) => l !== q.correct);
      const keep = wrong[randomInt(wrong.length)];
      r.removed[teamId] = wrong.filter((l) => l !== keep);
      note(st, `${teamName(db, teamId)} setzt einen Joker ein`, true);
      break;
    }
    case 'raeuber': {
      const victim = teamState(st, target);
      const want = val(game, 'raeuber');
      const got = sub(victim, want);
      t.points += got;
      note(st, `${teamName(db, teamId)} stiehlt ${teamName(db, target)} ${got} ${got === 1 ? 'Punkt' : 'Punkte'}${got < want ? ' (mehr war nicht da)' : ''}`);
      break;
    }
    case 'dieb': {
      const victim = teamState(st, target);
      const k = randomInt(victim.jokers.length);
      const [stolen] = victim.jokers.splice(k, 1);
      t.jokers.push(stolen);
      r.joker.stolen = stolen.key;
      note(st, `${teamName(db, teamId)} stiehlt ${teamName(db, target)} einen Joker`);
      log(db, ctx, 'joker', `Joker-Dieb: zufällig gezogen „${fieldByKey(game, stolen.key).name}“ (Nr. ${k + 1} von ${victim.jokers.length + 1})`);
      break;
    }
    case 'blockade': {
      teamState(st, target).blockedNow = true;
      note(st, `${teamName(db, teamId)} blockiert ${teamName(db, target)} für diese Frage`);
      break;
    }
    case 'detektiv':
    case 'tausch':
      note(st, `${teamName(db, teamId)} setzt einen geheimen Joker ein`, true);
      break;
    default:
      break;
  }
  log(db, ctx, 'joker', `${teamName(db, teamId)}: Joker „${f.name}“${target ? ` gegen ${teamName(db, target)}` : ''}`);
}

// Negatives Feld wirkt sofort.
function applyNegative(db, ctx, game, st, teamId, f) {
  const t = teamState(st, teamId);
  const res = { key: f.key };
  switch (f.key) {
    case 'minus2': res.taken = sub(t, val(game, 'minus2')); break;
    case 'minus1': res.taken = sub(t, val(game, 'minus1')); break;
    case 'raub': {
      const others = teamIds(db).filter((id) => id !== teamId);
      res.taken = sub(t, val(game, 'raub'));
      if (others.length) {
        res.to = others[randomInt(others.length)];
        teamState(st, res.to).points += res.taken;
      }
      break;
    }
    case 'verlust':
      if (t.jokers.length) res.lost = t.jokers.splice(randomInt(t.jokers.length), 1)[0].key;
      else res.none = true;
      break;
    case 'sperre': t.jokerLock = true; break;
    case 'verbot': t.ban = true; break;
    case 'enteignung': res.lostCount = t.jokers.length; t.jokers = []; break;
    case 'reset': res.taken = t.points; t.points = 0; break;
    default: break;
  }
  return res;
}

function negText(db, teamId, f, res) {
  const n = teamName(db, teamId);
  switch (f.key) {
    case 'minus2': case 'minus1': return `${n} verliert ${res.taken} ${res.taken === 1 ? 'Punkt' : 'Punkte'}`;
    case 'raub': return res.to ? `${n} verliert ${res.taken} – ausgelost bekommt sie ${'​'}${teamName(db, res.to)}` : `${n} verliert ${res.taken}`;
    case 'verlust': return res.none ? `${n} hat keinen Joker – keine Wirkung` : `${n} verliert einen Joker`;
    case 'sperre': return `${n} darf beim nächsten Kategoriewechsel keinen Joker einsetzen`;
    case 'verbot': return `${n} darf die nächste Frage nicht beantworten`;
    case 'enteignung': return `${n} verliert alle Joker (${res.lostCount})`;
    case 'reset': return `${n}: Spielpunkte auf 0`;
    default: return n;
  }
}

// Antwort, die für ein Team gewertet wird (Antworttausch des Joker-Teams separat protokolliert).
function effective(r, id) {
  if (r.swapped && r.swapped.teamId === id) return r.answers[r.swapped.with]?.choice ?? null;
  return r.answers[id]?.choice ?? null;
}

module.exports = {
  WHEEL,
  wheelOf,
  wheelFields,
  slotProblem,
  init: () => ({ round: -1, r: null, t: {}, events: [], finished: false }),

  team: {
    // Joker aus dem Vorrat beim Vorstellen der Kategorie einsetzen (höchstens einer pro Frage).
    useJoker(db, ctx, game, st, p) {
      const r = cur(st);
      if (r.phase !== 'category') fail('Joker nur beim Vorstellen der Kategorie – jetzt ist es zu spät.');
      if (r.joker) fail('Für diese Frage wurde schon ein Joker eingesetzt.');
      const t = teamState(st, ctx.teamId);
      if (t.lockNow) fail('Ihr habt Joker-Sperre für diesen Kategoriewechsel.');
      const k = t.jokers.findIndex((j) => j.id === p.jokerId);
      if (k < 0) fail('Diesen Joker habt ihr nicht.');
      const joker = t.jokers[k];
      let target = null;
      if (joker.key === 'dieb' && !thievable(db, st, ctx.teamId).length) fail('Kein anderes Team hat einen Joker – der Joker-Dieb bleibt im Vorrat.');
      if (NEEDS_TARGET.includes(joker.key)) {
        if (!teamIds(db).includes(p.target) || p.target === ctx.teamId) fail('Bitte ein anderes Team wählen.');
        if (joker.key === 'dieb' && !teamState(st, p.target).jokers.length) fail('Dieses Team hat keinen Joker.');
        target = p.target;
      }
      t.jokers.splice(k, 1);
      applyJoker(db, ctx, game, st, ctx.teamId, joker, target);
      effect(db, 'buzz');
    },

    answer(db, ctx, game, st, p) {
      const r = cur(st);
      if (r.phase !== 'question') fail('Gerade wird nicht geantwortet.');
      const t = teamState(st, ctx.teamId);
      if (t.blockedNow) fail('Ihr dürft diese Frage nicht beantworten.');
      if (r.answers[ctx.teamId]) fail('Eure Antwort ist schon eingeloggt.');
      const choice = cleanChoice(p.choice);
      if ((r.removed[ctx.teamId] || []).includes(choice)) fail('Diese Antwort ist weggefallen.');
      // Detektiv: Das Joker-Team antwortet erst, wenn das beobachtete Team eingeloggt hat.
      if (r.joker?.key === 'detektiv' && r.joker.teamId === ctx.teamId && teamState(st, r.joker.target).blockedNow !== true && !r.answers[r.joker.target]) {
        fail('Wartet, bis das beobachtete Team geantwortet hat.');
      }
      r.answers[ctx.teamId] = { choice, at: ctx.now };
      log(db, ctx, 'antwort', `${teamName(db, ctx.teamId)} hat eingeloggt`);
    },

    // Antworttausch-Joker: nach beiden Antworten tauschen (oder behalten).
    swap(db, ctx, game, st, p) {
      const r = cur(st);
      if (r.phase !== 'question' || r.joker?.key !== 'tausch' || r.joker.teamId !== ctx.teamId) fail('Kein Antworttausch möglich.');
      if (!r.answers[ctx.teamId] || !r.answers[r.joker.target]) fail('Erst wenn beide Teams eingeloggt haben.');
      if (r.swapDecided) fail('Schon entschieden.');
      r.swapDecided = true;
      if (p.swap) {
        r.swapped = { teamId: ctx.teamId, with: r.joker.target, original: r.answers[ctx.teamId].choice, used: r.answers[r.joker.target].choice };
        log(db, ctx, 'joker', `Antworttausch: ${teamName(db, ctx.teamId)} wertet ${r.swapped.used} statt ${r.swapped.original} (Antwort von ${teamName(db, r.joker.target)} bleibt unverändert)`);
      }
    },

    wheelBuzz(db, ctx, game, st) {
      const r = cur(st);
      if (r.phase !== 'wheel') fail('Das Glücksrad ist gerade nicht frei.');
      if (!r.correct.includes(ctx.teamId)) fail('Nur Teams mit richtiger Antwort dürfen ans Rad.');
      if (r.buzz) fail(`${teamName(db, r.buzz)} war schneller.`);
      r.buzz = ctx.teamId;
      log(db, ctx, 'buzzer', `${teamName(db, ctx.teamId)} darf das Glücksrad drehen`);
      effect(db, 'buzz');
    },

    spin(db, ctx, game, st) {
      const r = cur(st);
      if (r.phase !== 'wheel' || r.buzz !== ctx.teamId) fail('Ihr dürft gerade nicht drehen.');
      if (r.spin) fail('Das Rad hat sich schon gedreht.');
      // Gleichverteilt: jedes der Felder hat dieselbe Chance (1 von 12).
      const fields = wheelFields(game);
      const idx = randomInt(fields.length);
      const f = fields[idx];
      r.spin = { index: idx, key: f.key, n: f.n, teamId: ctx.teamId, at: ctx.now, name: f.name, good: f.good };
      const t = teamState(st, ctx.teamId);
      if (f.good) {
        t.jokers.push({ id: `j${st.events.length}_${idx}_${ctx.now % 100000}`, key: f.key });
        note(st, `${teamName(db, ctx.teamId)} erdreht einen Joker`);
        log(db, ctx, 'joker', `${teamName(db, ctx.teamId)} erdreht „${f.name}“ (Vorrat)`);
      } else {
        const res = applyNegative(db, ctx, game, st, ctx.teamId, f);
        r.spin.res = res;
        r.spin.text = negText(db, ctx.teamId, f, res);
        note(st, negText(db, ctx.teamId, f, res));
        log(db, ctx, 'joker', `${teamName(db, ctx.teamId)} erdreht „${f.name}“: ${negText(db, ctx.teamId, f, res)}`);
      }
      effect(db, 'reveal');
    },
  },

  mod: {
    start(db, ctx, game, st) {
      if (st.round >= 0) fail('Das Spiel läuft schon.');
      const dup = slotProblem(game);
      if (dup) fail(dup);
      for (const id of teamIds(db)) teamState(st, id);
      newRound(db, st, 0);
      log(db, ctx, 'ablauf', `Runde 1: Kategorie „${game.content.rounds[0].category}“`);
      effect(db, 'title');
    },

    showQuestion(db, ctx, game, st) {
      const r = cur(st);
      if (r.phase !== 'category') fail('Die Frage ist schon offen.');
      r.phase = 'question';
      log(db, ctx, 'ablauf', `Runde ${st.round + 1}: Frage offen`);
    },

    evaluate(db, ctx, game, st) {
      const r = cur(st);
      if (r.phase !== 'question') fail('Gerade läuft keine Frage.');
      const q = game.content.rounds[st.round];
      r.phase = 'evaluated';
      r.correct = [];
      for (const id of teamIds(db)) {
        const t = teamState(st, id);
        const choice = effective(r, id);
        if (choice === null) {
          if (t.streak && !t.blockedNow) t.streak = null; // keine Antwort beendet die Streak
          continue;
        }
        if (choice === q.correct) {
          let gain = 1;
          if (t.streak) { gain = t.streak; t.streak += 1; }
          if (t.double) { gain = Math.max(gain, typeof t.double === 'number' ? t.double : 2); t.double = false; }
          t.points += gain;
          r.correct.push(id);
          r.gains = { ...(r.gains || {}), [id]: gain };
        } else {
          t.streak = null; // falsche Antwort beendet die Streak
        }
      }
      log(db, ctx, 'ablauf', `Runde ${st.round + 1} aufgelöst (richtig: ${q.correct})`);
      effect(db, 'reveal');
    },

    openWheel(db, ctx, game, st) {
      const r = cur(st);
      if (r.phase !== 'evaluated') fail('Erst die Frage auflösen.');
      if (!r.correct.length) fail('Niemand lag richtig – das Rad bleibt zu.');
      r.phase = 'wheel';
      log(db, ctx, 'ablauf', 'Glücksrad frei – richtige Teams dürfen buzzern');
    },

    // Falls das Team-iPad ausfällt: für das Buzzer-Team drehen.
    spinFor(db, ctx, game, st) {
      const r = cur(st);
      if (!r.buzz) fail('Noch hat niemand gebuzzert.');
      return module.exports.team.spin(db, { ...ctx, teamId: r.buzz }, game, st);
    },

    next(db, ctx, game, st) {
      const r = cur(st);
      if (!['evaluated', 'wheel'].includes(r.phase)) fail('Erst die Frage auflösen.');
      if (r.phase === 'wheel' && r.buzz && !r.spin) fail('Das Rad wurde noch nicht gedreht.');
      if (st.round + 1 >= game.content.rounds.length) fail('Das war die letzte Runde – jetzt „Spiel beenden“.');
      newRound(db, st, st.round + 1);
      log(db, ctx, 'ablauf', `Runde ${st.round + 1}: Kategorie „${game.content.rounds[st.round].category}“`);
      effect(db, 'title');
    },

    // Spielpunkte einmalig in den Show-Gesamtstand übernehmen.
    finish(db, ctx, game, st) {
      if (st.round < 0) fail('Das Spiel hat noch nicht begonnen.');
      for (const id of teamIds(db)) {
        bookTarget(db, ctx, `brain:${game.id}:${id}`, id, teamState(st, id).points, `${game.title} (Spielpunkte)`);
      }
      st.finished = true;
      log(db, ctx, 'ablauf', `${game.title} beendet – Spielpunkte gutgeschrieben`);
      effect(db, 'reveal');
    },

    // Spielpunkte korrigieren (bleibt innerhalb dieses Spiels, nie unter 0).
    adjust(db, ctx, game, st, p) {
      const t = teamState(st, p.teamId);
      const d = Number(p.delta);
      if (!Number.isInteger(d) || Math.abs(d) > 20) fail('Ungültige Korrektur.');
      t.points = Math.max(0, t.points + d);
      log(db, ctx, 'punkte', `${teamName(db, p.teamId)}: Spielpunkte ${d > 0 ? '+' : ''}${d} (Korrektur)`);
      if (st.finished) bookTarget(db, ctx, `brain:${game.id}:${p.teamId}`, p.teamId, t.points, `${game.title} (Spielpunkte, Korrektur)`);
    },
  },

  teamView(db, game, st, teamId) {
    if (st.round < 0) return { waiting: true, title: game.title };
    const r = st.r;
    const q = game.content.rounds[st.round];
    const t = teamState(st, teamId);
    const det = r.joker?.key === 'detektiv' && r.joker.teamId === teamId;
    const tau = r.joker?.key === 'tausch' && r.joker.teamId === teamId;
    return {
      round: st.round,
      count: game.content.rounds.length,
      phase: r.phase,
      category: q.category,
      question: r.phase !== 'category' ? q.question : null,
      options: r.phase !== 'category' ? q.options : null,
      removed: r.removed[teamId] || [],
      blocked: t.blockedNow,
      answer: r.answers[teamId]?.choice ?? null,
      correct: ['evaluated', 'wheel'].includes(r.phase) ? q.correct : null,
      gained: r.gains ? r.gains[teamId] || 0 : null,
      points: t.points,
      // Eigener Joker-Vorrat (privat).
      jokers: t.jokers.map((j) => ({
        id: j.id, ...fieldByKey(game, j.key), needsTarget: NEEDS_TARGET.includes(j.key),
        // Joker-Dieb ist nur einsetzbar, wenn ein anderes Team Joker hat.
        usable: j.key !== 'dieb' || thievable(db, st, teamId).length > 0,
        targets: j.key === 'dieb' ? thievable(db, st, teamId) : null,
      })),
      // Spielpunkte aller Teams (nur dieses Spiel).
      allPoints: teamIds(db).map((id) => ({ teamId: id, points: teamState(st, id).points })),
      canUseJoker: r.phase === 'category' && !r.joker && !t.lockNow && t.jokers.length > 0,
      jokerLock: t.lockNow,
      jokerUsed: r.joker ? (r.joker.teamId === teamId ? { key: r.joker.key, target: r.joker.target } : { other: true }) : null,
      double: t.double,
      streak: t.streak,
      // Detektiv: Antwort des beobachteten Teams nur für das Joker-Team, erst nach dessen Abgabe.
      detective: det ? { target: r.joker.target, answer: r.answers[r.joker.target]?.choice ?? null, waiting: !r.answers[r.joker.target] } : null,
      swap: tau && r.phase === 'question' ? { target: r.joker.target, ready: !!r.answers[teamId] && !!r.answers[r.joker.target], decided: !!r.swapDecided, theirs: r.answers[teamId] && r.answers[r.joker.target] ? r.answers[r.joker.target].choice : null } : null,
      wheel: r.phase === 'wheel' ? { canBuzz: r.correct.includes(teamId) && !r.buzz, mine: r.buzz === teamId, taken: r.buzz, spin: r.spin ? { index: r.spin.index, field: spunField(game, r.spin) } : null } : null,
      targets: teamIds(db).filter((id) => id !== teamId),
      finished: st.finished,
    };
  },

  beamerView(db, game, st) {
    if (st.round < 0) return { waiting: true };
    const r = st.r;
    const q = game.content.rounds[st.round];
    const publicJoker = r.joker && !SECRET.includes(r.joker.key) && r.joker.key !== 'fifty'
      ? { teamId: r.joker.teamId, field: fieldByKey(game, r.joker.key), target: r.joker.target }
      : r.joker ? { teamId: r.joker.teamId, secret: true } : null;
    return {
      round: st.round,
      count: game.content.rounds.length,
      phase: r.phase,
      category: q.category,
      question: r.phase !== 'category' ? q.question : null,
      options: r.phase !== 'category' ? q.options : null,
      answeredCount: Object.keys(r.answers).length,
      blocked: teamIds(db).filter((id) => teamState(st, id).blockedNow),
      correct: ['evaluated', 'wheel'].includes(r.phase) ? q.correct : null,
      // Nach der Auflösung: gewertete Antworten (ein Tausch bleibt geheim, nur das Ergebnis zählt).
      results: ['evaluated', 'wheel'].includes(r.phase) ? teamIds(db).map((id) => ({ teamId: id, ok: r.correct.includes(id), answered: effective(r, id) !== null })) : [],
      joker: publicJoker,
      wheel: { fields: wheelFields(game).map((f) => ({ n: f.n, icon: f.icon, good: f.good, name: f.name })), buzz: r.phase === 'wheel' ? r.buzz : null, spin: r.spin ? { index: r.spin.index, field: spunField(game, r.spin), teamId: r.spin.teamId, text: r.spin.res ? negText(db, r.spin.teamId, spunField(game, r.spin), r.spin.res) : null } : null, open: r.phase === 'wheel' },
      // Spielpunkte dieses Spiels (nicht der Show-Gesamtstand) dauerhaft auf dem Beamer.
      points: teamIds(db).map((id) => ({ teamId: id, points: teamState(st, id).points })),
      events: st.events.filter((e) => e.pub).slice(-4),
      finished: st.finished,
    };
  },
};
