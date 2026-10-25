// Beamer: Spielansichten für alle acht Spiele. Es kommen nur freigegebene Daten an.

import { h } from './client.js';
import { answerContent } from './ink.js';
import { mapView } from './map.js';

const ABCD = ['A', 'B', 'C', 'D'];
const pts = (n) => `${n} ${Math.abs(n) === 1 ? 'Punkt' : 'Punkte'}`;
const sub = (text, style = {}) => h('div', { class: 'sub', style: { marginTop: 0, ...style } }, text);
const chip = (t, extra = '', ...rest) => h('span', { class: `chip ${extra}` }, h('span', { class: 'dot', style: { background: t.color } }), t.name, ...rest);

export function renderGame(v, s, teamOf) {
  const fn = { leichte5, dummes, land, kassenschlager, trumpf5, musik, jauch, nerd }[v.type];
  const head = sub(`Spiel ${s.game.position} · ${s.game.title}`, { marginBottom: '3vh' });
  return fn ? [head, ...fn(v, teamOf)].filter(Boolean) : [h('div', { class: 'mega' }, s.game.title)];
}

function options(v, { correct = null, marks = {}, compact = false } = {}) {
  return h('div', { class: `options ${compact ? 'compact' : ''}` }, ABCD.map((l) => h('div', { class: `opt ${correct === l ? 'correct' : ''} ${correct && correct !== l ? 'dim' : ''}` },
    h('b', {}, l), h('span', { class: 'grow' }, v.options[l]), h('span', { class: 'marks' }, ...(marks[l] || [])))));
}

function buzzRow(v, teamOf, order, answering) {
  if (!order.length) return null;
  return h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '3vh' } }, order.map((b) => {
    const sym = b.status === 'correct' ? ' ✓' : b.status === 'wrong' ? ' ✗' : '';
    return chip(teamOf(b.teamId), `${b.teamId === answering ? 'answering' : ''} ${b.status === 'wrong' ? 'wrong' : ''}`, sym);
  }));
}

const dot = (t) => h('span', { class: 'dot', title: t.name, style: { background: t.color } });

// ---------- 1 ----------
function leichte5(v, teamOf) {
  const out = [sub(`Frage ${v.qIndex + 1}`), h('div', { class: 'q' }, v.question || '…')];
  if (!v.answers.length && v.question && !v.solution) out.push(sub(`${v.submittedCount} von ${v.teamCount} Teams haben abgegeben`, { marginTop: '2vh' }));
  out.push(h('div', { class: 'answers' }, v.answers.map((a) => {
    const t = teamOf(a.teamId);
    const mark = a.grade === true ? h('span', { class: 'mark ok', 'aria-label': 'richtig' }, '✓') : a.grade === false ? h('span', { class: 'mark bad', 'aria-label': 'falsch' }, '✗') : null;
    return h('div', { class: `answer${a.ink ? ' has-ink' : ''}`, '--team': t.color }, h('span', {}, h('span', { class: 'who' }, t.name), answerContent(a, 'beamer')), mark);
  })));
  if (v.solution) out.push(h('div', { class: 'solution' }, `Lösung: ${v.solution}`));
  return out;
}

// ---------- 2 ----------
function dummes(v, teamOf) {
  const marks = {};
  for (const f of v.finals) (marks[f.choice] ||= []).push(dot(teamOf(f.teamId)));
  const out = [sub(`Frage ${v.qIndex + 1}`), h('div', { class: 'q compact' }, v.question), options(v, { correct: v.correct, marks, compact: v.evaluated })];
  if (!v.evaluated) out.push(sub(`${v.submittedCount} von ${v.teamCount} Teams haben gesperrt`, { marginTop: '2vh' }));
  if (v.buzz && !v.evaluated) out.push(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '2vh' } }, chip(teamOf(v.buzz), 'answering', ' 🔔 war am schnellsten'), v.windowEnds ? h('span', { class: 'chip' }, '⏱ ', h('b', { 'data-deadline': v.windowEnds }, '')) : null));
  if (v.swap) out.push(h('div', { class: 'solution' }, `🔁 ${teamOf(v.swap.by).name} hat mit ${teamOf(v.swap.with).name} getauscht`));
  return out;
}

// ---------- 3 ----------
function land(v, teamOf) {
  if (v.waiting) return [h('div', { class: 'mega', style: { fontSize: 'clamp(2rem,5vw,5rem)' } }, 'Ich sehe ein Land …'), h('div', { class: 'map-box beamer-map' }, mapView(v.map))];
  const markers = (v.guesses || []).map((g) => ({ lat: g.lat, lng: g.lng, color: teamOf(g.teamId).color, label: teamOf(g.teamId).name, showLabel: true }));
  if (v.target) markers.push({ lat: v.target.lat, lng: v.target.lng, kind: 'target', label: v.target.name });
  const out = [h('div', { class: 'q compact' }, v.question), h('div', { class: 'map-box beamer-map' }, mapView(v.map, { markers }))];
  if (!v.guesses) out.push(sub(`${v.submittedCount} von ${v.teamCount} Teams haben ihren Punkt gesetzt`, { marginTop: '2vh' }));
  if (v.target) {
    const w = v.winners.map((id) => teamOf(id).name).join(', ');
    out.push(h('div', { class: 'solution' }, `📍 ${v.target.name}${w ? ` – am nächsten: ${w}` : ''}`));
  }
  return out;
}

// ---------- 4 ----------
function kassenschlager(v, teamOf) {
  if (v.converted) {
    return [h('div', { class: 'mega', style: { fontSize: 'clamp(2rem,5vw,5rem)' } }, 'Kasse gemacht!'),
      h('ol', { class: 'rank' }, Object.entries(v.converted).sort((a, b) => b[1].points - a[1].points).map(([id, c]) => h('li', { '--team': teamOf(id).color },
        h('span', {}, '💰'), h('span', {}, teamOf(id).name), h('span', { class: 'pts' }, `${c.money} $ → ${c.points}`))))];
  }
  if (v.waiting) return [h('div', { class: 'mega', style: { fontSize: 'clamp(2rem,5vw,5rem)' } }, 'Das ist ein echter Kassenschlager'), sub('Jedes Team startet mit 20 $', { marginTop: '3vh' })];
  const out = [h('div', { class: 'mega', style: { fontSize: 'clamp(2rem,5vw,5rem)' } }, `🎬 Film ${v.movieIndex + 1}`)];
  if (v.finished) out.push(h('div', { class: 'solution' }, v.title));
  else out.push(sub(`Zyklus ${v.cycle} von ${v.maxCycles}`, { marginTop: '2vh' }));
  if (v.turn) {
    const phase = { buy: 'kauft einen Hinweis …', answer: 'schreibt …', grading: 'hat geantwortet' }[v.turn.phase];
    out.push(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '3vh' } }, v.order.map((id) => chip(teamOf(id), id === v.turn.teamId ? 'answering' : ''))));
    out.push(sub(`${teamOf(v.turn.teamId).name} ${phase}`, { marginTop: '3vh' }));
  }
  return out;
}

// ---------- 5 ----------
function trumpf5(v, teamOf) {
  if (v.waiting) return [h('div', { class: 'mega', style: { fontSize: 'clamp(2.4rem,6vw,6rem)' } }, '5 ist Trümpf')];
  // Kompakt: alles muss auf einen Beamer-Bildschirm passen. Noch verdeckte
  // Hinweise stehen als Platzhalter da, damit nichts springt.
  const slots = Array.from({ length: 5 }, (_, i) => {
    const text = v.hints[i];
    const value = 5 - i;
    return h('li', { class: text === undefined ? 'empty' : '' },
      h('span', { class: 'pv', 'aria-label': `${value} ${value === 1 ? 'Punkt' : 'Punkte'}` }, String(value)),
      h('span', { class: 'tx' }, text === undefined ? '' : text));
  });
  const foot = [];
  if (!v.resolved && v.hints.length) foot.push(h('span', { class: 't5-value' }, `Jetzt noch ${pts(v.value)}`));
  const buzz = buzzRow(v, teamOf, v.buzzOrder, v.answering);
  return [h('div', { class: 't5' },
    h('div', { class: 't5-cat' }, h('small', {}, `Begriff ${v.termIndex + 1} · Kategorie`), v.category),
    h('ol', { class: 'hints' }, slots),
    foot.length || buzz ? h('div', { class: 't5-foot' }, ...foot, buzz) : null,
    v.term ? h('div', { class: 'solution' }, `${v.term}${v.winner ? ` – ${teamOf(v.winner).name}` : ''}`) : null)];
}

// ---------- 6 ----------
function musik(v, teamOf) {
  const c = v.current;
  const board = h('div', { class: 'jeopardy' }, v.board.map((cat, i) => h('div', { class: 'col' },
    h('div', { class: 'cat' }, cat.name || `Kategorie ${i + 1}`),
    cat.fields.map((f) => h('div', { class: `cell ${f.played ? 'played' : ''}`, style: f.winner ? { borderColor: teamOf(f.winner).color, color: teamOf(f.winner).color } : null }, f.played ? (f.winner ? teamOf(f.winner).name : '–') : String(f.value))))));
  if (!c || (c.resolved && !c.answer)) return [board];
  const out = [sub(`${c.category} · ${pts(c.value)}${c.mashup ? ' · beide Songtitel nennen!' : ''}`)];
  out.push(h('div', { class: 'q' }, c.task || (c.started ? '🎵 Hört genau hin …' : '🎵')));
  out.push(buzzRow(v, teamOf, c.buzzOrder, c.answering));
  if (c.resolved) out.push(h('div', { class: 'solution' }, `${c.answer}${c.winner ? ` – ${teamOf(c.winner).name}` : ''}`));
  return out;
}

// ---------- 7 ----------
function jauch(v, teamOf) {
  if (v.waiting) return [h('div', { class: 'mega', style: { fontSize: 'clamp(2.4rem,6vw,6rem)' } }, 'Ein Hauch von Günther Jauch')];
  const ladder = h('div', { class: 'ladder big' }, v.ladder.map((p, i) => h('span', { class: `step ${i === v.qIndex ? 'current' : ''} ${i === 3 ? 'safe' : ''}` }, `${i + 1} · ${p}`)));
  const marks = {};
  for (const a of v.answers) (marks[a.choice] ||= []).push(dot(teamOf(a.teamId)));
  const out = [ladder, sub(`Frage ${v.qIndex + 1} · ${pts(v.ladder[v.qIndex])}`, { marginTop: '1vh' }), h('div', { class: 'q compact' }, v.question), options(v, { correct: v.correct, marks, compact: v.revealed })];
  if (!v.revealed) {
    out.push(sub(`${v.lockedCount} von ${v.activeCount} Teams haben gesperrt${v.phoneRunning ? ' · 📞 Telefonjoker läuft' : ''}`, { marginTop: '2vh' }));
    return out;
  }
  if (v.joker) out.push(sub(`🃏 ${teamOf(v.joker.teamId).name}: ${v.joker.kind === 'fifty' ? '50:50' : 'Telefonjoker'}`, { marginTop: '2vh' }));
  const label = { active: 'im Spiel', quit: 'ausgestiegen', out: 'ausgeschieden', done: 'alles geschafft' };
  out.push(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '2vh' } }, v.teams.map((t) => chip(teamOf(t.teamId), t.status === 'out' ? 'wrong' : '',
    ` · ${label[t.status]}${t.outAt && t.status !== 'done' ? ` (Frage ${t.outAt})` : ''} · ${pts(t.secured)}`))));
  return out;
}

// ---------- 8 ----------
function nerd(v, teamOf) {
  if (v.waiting) return [h('div', { class: 'mega', style: { fontSize: 'clamp(2.4rem,6vw,6rem)' } }, 'Wer nix werd, werd Nerd')];
  const out = [sub(v.finale ? '★ Die große Finalkategorie ★' : `Kategorie ${v.catIndex + 1}`), h('div', { class: `q ${v.finale ? 'finale' : ''}` }, v.category)];
  if (v.phase === 'bidding') {
    out.push(sub(`${v.bidCount} von ${v.teamCount} geheimen Geboten abgegeben`, { marginTop: '3vh' }));
    return out;
  }
  out.push(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '2vh' } }, v.bids.map((b, i) => chip(teamOf(b.teamId), v.attempt?.teamId === b.teamId && !v.attempt.done ? 'answering' : '', h('b', { style: { marginLeft: '.5em', animation: `pop .4s ${i * 0.2}s both` } }, b.bid)))));
  if (v.phase === 'choose') out.push(sub('Gleichstand! Die Moderation entscheidet.', { marginTop: '3vh' }));
  const a = v.attempt;
  if (a) {
    const t = teamOf(a.teamId);
    out.push(h('div', { class: 'nerd-score' },
      h('span', { style: { color: t.color } }, t.name),
      h('span', { class: 'big-num' }, `${a.correct} / ${a.target}`),
      h('span', { class: 'errors' }, Array.from({ length: a.maxErrors }, (_, i) => h('span', { class: i < a.errors ? 'x on' : 'x' }, '✗')))));
    if (a.named.length) out.push(h('div', { class: 'named' }, a.named.map((n) => h('span', { class: 'chip' }, n))));
  }
  for (const r of v.results) {
    out.push(h('div', { class: 'solution' }, `${teamOf(r.teamId).name}: ${r.success ? 'geschafft' : 'gescheitert'} (${r.points > 0 ? '+' : ''}${r.points})`));
  }
  return out;
}
