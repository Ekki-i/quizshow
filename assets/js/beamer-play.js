// Beamer: Spielansichten für alle acht Spiele. Es kommen nur freigegebene Daten an.

import { h } from './client.js';
import { answerContent } from './ink.js';
import { mapView } from './map.js';

const ABCD = ['A', 'B', 'C', 'D'];
const pts = (n) => `${n} ${Math.abs(n) === 1 ? 'Punkt' : 'Punkte'}`;
const sub = (text, style = {}) => h('div', { class: 'sub', style: { marginTop: 0, ...style } }, text);
const chip = (t, extra = '', ...rest) => h('span', { class: `chip team-chip ${extra}`, '--chip': t.color }, t.name, ...rest);

export function renderGame(v, s, teamOf) {
  const fn = { leichte5, dummes, land, kassenschlager, trumpf5, musik, jauch, nerd }[v.type];
  if (v.type === 'jauch') return jauch(v, teamOf, s); // eigenes, bildschirmfüllendes Design
  // Schlank: keine Spielnummer, kein Spielname, kein Fragezähler – nur Frage und Antworten.
  return fn ? fn(v, teamOf).filter(Boolean) : [h('div', { class: 'mega' }, s.game.title)];
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
  const out = [h('div', { class: 'q' }, v.question || '…')];
  if (!v.answers.length && v.question && !v.solution) out.push(sub(`${v.submittedCount} von ${v.teamCount} Teams haben abgegeben`, { marginTop: '2vh' }));
  out.push(h('div', { class: 'answers' }, v.answers.map((a) => {
    const t = teamOf(a.teamId);
    const mark = a.grade === true ? h('span', { class: 'mark ok', 'aria-label': 'richtig' }, '✓') : a.grade === false ? h('span', { class: 'mark bad', 'aria-label': 'falsch' }, '✗') : null;
    // Wie im Finale: schwarze Antwortfläche, darunter die graue Namensleiste, Teamfarbe als seitliche Balken.
    return h('div', { class: `answer fx-card${a.ink ? ' has-ink' : ''}`, '--team': t.color },
      h('div', { class: 'ans-body' }, answerContent(a, 'beamer'), mark),
      h('div', { class: 'ans-name' }, t.name));
  })));
  if (v.solution) out.push(h('div', { class: 'solution' }, `Lösung: ${v.solution}`));
  return out;
}

// ---------- 2 ----------
function dummes(v, teamOf) {
  const marks = {};
  for (const f of v.finals) (marks[f.choice] ||= []).push(dot(teamOf(f.teamId)));
  const out = [h('div', { class: 'q compact' }, v.question), options(v, { correct: v.correct, marks, compact: v.evaluated })];
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
  const out = [h('div', { class: 'q' }, '🎬 Welcher Film ist gesucht?')];
  if (v.finished) out.push(h('div', { class: 'solution' }, v.title));
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
    h('div', { class: 't5-cat' }, h('small', {}, 'Kategorie'), v.category),
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
// Im Stil einer klassischen Millionen-Quizshow: blaue Bühne, Joker links, Leiter mit
// Punkten rechts, Frage und Antworten in sechseckigen Leisten.
const PHONE_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M33 6c-2 0-3 1-4 3l-2 6c-.5 2 0 3 1.5 4l2.5 2c-2 5-6 9-11 11l-2-2.5c-1-1.5-2-2-4-1.5l-6 2c-2 1-3 2-3 4 0 5 5 9 11 9C30 43 43 30 43 16c0-6-4-10-10-10z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M6 14l4 4-4 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function hexBar(cls, ...children) {
  return h('div', { class: `wwm-line ${cls}` }, h('div', { class: 'wwm-hex' }, h('div', { class: 'wwm-hex-in' }, ...children)));
}

function jauch(v, teamOf, s) {
  const title = s ? s.game.title : 'Ein Hauch von Günther Jauch';
  const top = null;
  const ladder = h('div', { class: 'wwm-ladder' }, v.ladder.map((p, i) => ({ p, i })).reverse().map(({ p, i }) =>
    h('div', { class: `wwm-step${i === v.qIndex ? ' current' : ''}${i === (v.safeIndex ?? 3) || i === v.ladder.length - 1 ? ' safe' : ''}${v.qIndex !== undefined && i < v.qIndex ? ' done' : ''}` },
      h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'dotsep' }, '◆'), h('span', { class: 'p' }, `${p} P`))));
  if (v.waiting) {
    return [h('div', { class: 'wwm' }, top,
      h('div', { class: 'wwm-mid' }, h('div'), h('div', { class: 'wwm-ring idle' }, h('b', {}, '?')), ladder),
      hexBar('wwm-q', title))];
  }
  const jokers = v.jokers || { fifty: [], phone: [] };
  const live = !v.revealed && v.phoneRunning ? 'phone' : null;
  const jokerBtn = (kind, content) => {
    const used = jokers[kind] || [];
    const allUsed = v.teams ? v.teams.filter((t) => t.status === 'active').every((t) => used.includes(t.teamId)) && used.length > 0 : false;
    const now = (v.joker && v.joker.kind === kind) || live === kind;
    const btn = h('div', { class: `wwm-joker${now ? ' now' : ''}${allUsed ? ' gone' : ''}`, title: kind === 'fifty' ? '50:50-Joker' : 'Telefonjoker' });
    if (typeof content === 'string' && content.startsWith('<svg')) btn.innerHTML = content; else btn.append(content);
    return h('div', { class: 'wwm-joker-wrap' }, btn,
      used.length ? h('div', { class: 'wwm-joker-teams' }, used.map((id) => dot(teamOf(id)))) : null,
      v.joker && v.joker.kind === kind ? h('div', { class: 'wwm-joker-who' }, teamOf(v.joker.teamId).name) : live === kind ? h('div', { class: 'wwm-joker-who' }, 'läuft …') : null);
  };
  const ring = v.revealed
    ? h('div', { class: 'wwm-ring done' }, h('b', {}, v.correct), h('small', {}, 'richtig'))
    : h('div', { class: 'wwm-ring' }, h('b', {}, `${v.lockedCount}/${v.activeCount}`), h('small', {}, 'gesperrt'));
  const marks = {};
  for (const a of v.answers) (marks[a.choice] ||= []).push(dot(teamOf(a.teamId)));
  const opt = (l) => hexBar(`wwm-a${v.correct === l ? ' correct' : ''}${v.correct && v.correct !== l ? ' dim' : ''}`,
    h('span', { class: 'wwm-diamond' }, '◆'), h('b', {}, `${l}:`), h('span', { class: 'grow' }, v.options[l]), h('span', { class: 'marks' }, ...(marks[l] || [])));
  const out = [top,
    h('div', { class: 'wwm-mid' },
      h('div', { class: 'wwm-jokers' }, jokerBtn('fifty', h('b', {}, '50:50')), jokerBtn('phone', PHONE_ICON)),
      h('div', { class: 'wwm-center' }, ring, h('div', { class: 'wwm-value' }, `${v.ladder[v.qIndex]} P`)),
      ladder),
    hexBar('wwm-q', v.question),
    h('div', { class: 'wwm-answers' }, opt('A'), opt('B'), opt('C'), opt('D'))];
  if (v.revealed && v.teams) {
    const label = { active: 'im Spiel', quit: 'ausgestiegen', out: 'raus', done: 'geschafft' };
    out.push(h('div', { class: 'wwm-teams' }, v.teams.map((t) => chip(teamOf(t.teamId), t.status === 'out' ? 'wrong' : '', ` · ${label[t.status]} · ${t.secured} P`))));
  }
  return [h('div', { class: `wwm${v.revealed ? ' revealed' : ''}` }, ...out)];
}

// ---------- 8 ----------
function nerd(v, teamOf) {
  if (v.waiting) return [h('div', { class: 'mega', style: { fontSize: 'clamp(2.4rem,6vw,6rem)' } }, 'Wer nix werd, werd Nerd')];
  const out = [v.finale ? sub('★ Die große Finalkategorie ★') : null, h('div', { class: `q ${v.finale ? 'finale' : ''}` }, v.category),
    v.possible ? h('div', { class: 'nerd-possible' }, 'maximal ', h('b', {}, String(v.possible)), ` richtige ${v.possible === 1 ? 'Antwort' : 'Antworten'} möglich`) : null];
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
    if (a.which === 'second' && a.kept) out.push(sub(`${a.kept} richtige ${a.kept === 1 ? 'Antwort bleibt' : 'Antworten bleiben'} stehen – ${t.name} füllt auf`, { marginTop: '1vh' }));
    if (a.named.length) out.push(h('div', { class: 'named' }, a.named.map((n, i) => h('span', { class: `chip${i < (a.kept || 0) ? ' kept' : ''}` }, n))));
  }
  for (const r of v.results) {
    out.push(h('div', { class: 'solution' }, `${teamOf(r.teamId).name}: ${r.success ? 'geschafft' : 'gescheitert'} (${r.points > 0 ? '+' : ''}${r.points})`));
  }
  return out;
}
