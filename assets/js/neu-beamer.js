// Beamer: Folien der sieben neuen Module – im Look der übrigen Spielfolien
// (graue Boxen, Teamfarben als Akzente). Zeigt nur freigegebene Inhalte.

import { h, mediaUrl } from './client.js';

const pts = (n) => `${n} ${Math.abs(n) === 1 ? 'Punkt' : 'Punkte'}`;
const sub = (text, style = {}) => h('div', { class: 'sub', style: { marginTop: 0, ...style } }, text);
const chip = (t, extra = '', ...rest) => h('span', { class: `chip team-chip ${extra}`, '--chip': t.color }, t.name, ...rest);
const banner = (text, cls = '') => h('div', { class: `q ${cls}` }, text);
const waitTitle = (t, small) => [h('div', { class: 'mega', style: { fontSize: 'clamp(2rem,5.5vw,5.5rem)' } }, t), small ? sub(small, { marginTop: '2vh' }) : null];
const img = (m, cls) => { const el = h('img', { class: cls, alt: '' }); if (m) mediaUrl(m.id).then((u) => { if (u) el.src = u; }); return el; };
const fmtNum = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('de-DE'));
const row = (...c) => h('div', { class: 'row', style: { justifyContent: 'center', gap: '1vw', marginTop: '2vh', flexWrap: 'wrap' } }, ...c);

// ---------- Blamieren oder Sortieren ----------
function sortieren(v, teamOf) {
  if (v.waiting) return waitTitle('Blamieren oder Sortieren', 'Fünf Karten in die richtige Reihenfolge bringen – jeder richtige Platz zählt.');
  const card = (c, extra = '', label = null) => h('div', { class: `nb-sort-card ${extra}` }, label, c.image ? img(c.image, 'nb-sort-img') : null, c.label ? h('span', { class: 'nm' }, c.label) : null, c.info ? h('span', { class: 'info' }, c.info) : null);
  if (!v.evaluated) {
    return [banner(v.category, 'compact slim'), h('div', { class: 'nb-sort-row' }, v.cards.map((c) => card(c))),
      sub(`${v.submittedCount} von ${v.teamCount} Teams haben sortiert`, { marginTop: '3vh' })];
  }
  return [banner(v.category, 'compact slim'),
    h('div', { class: 'nb-sort-row solved' }, v.solution.map((c, i) => card(c, 'solved', h('b', { class: 'pos' }, String(i + 1))))),
    h('div', { class: 'nb-sort-results' }, v.results.sort((a, b) => b.points - a.points).map((r) => h('div', { class: 'nb-sort-res' },
      chip(teamOf(r.teamId)), h('span', { class: 'marks' }, r.order.map((k, pos) => h('i', { class: k === pos ? 'ok' : 'bad' }, k === pos ? '✓' : '✗'))),
      h('b', { class: 'p' }, `+${r.points}`))))];
}

// ---------- Riskier die Gier ----------
function gier(v, teamOf) {
  const bars = h('div', { class: 'nb-gier-bars' }, v.teams.map((t) => {
    const team = teamOf(t.teamId);
    const res = v.results ? v.results.find((x) => x.teamId === t.teamId) : null;
    return h('div', { class: `nb-gier-bar${t.out ? ' out' : ''}`, '--team': team.color },
      h('span', { class: 'nm' }, team.name),
      h('span', { class: 'track' }, h('i', { style: { width: `${Math.max(0, Math.min(100, (t.balance / (v.start || 100)) * 100))}%` } })),
      h('b', {}, fmtNum(t.balance)),
      res ? h('small', {}, res.missing ? 'keine Antwort' : `${fmtNum(res.value)} (−${fmtNum(res.diff)})`) : null,
      t.out ? h('em', {}, 'raus') : null);
  }));
  if (v.waiting) return [...waitTitle('Riskier die Gier', 'Jedes Team startet mit 100 Gier-Punkten – jede Abweichung wird abgezogen.'), bars];
  const out = [banner(v.question, 'compact slim')];
  if (v.standings) {
    out.push(h('div', { class: 'nb-gier-final' }, v.standings.map((s) => h('div', { class: 'nb-gier-place', '--team': teamOf(s.teamId).color },
      h('b', { class: 'pl' }, `${s.place}.`), h('span', { class: 'nm' }, teamOf(s.teamId).name), h('b', { class: 'p' }, `+${s.points}`)))));
    return out;
  }
  if (v.evaluated) out.push(h('div', { class: 'solution', style: { marginTop: 0 } }, `Lösung: ${fmtNum(v.solution)} ${v.unit}`.trim()));
  else if (v.open) {
    const grace = v.graceEndsAt && Date.now() > v.endsAt;
    out.push(h('div', { class: `nb-gier-time${grace ? ' grace' : ''}` }, grace ? 'Nachfrist ' : '', h('b', { 'data-deadline': String(grace ? v.graceEndsAt : v.endsAt) }, '')),
      sub(`${v.answeredCount} Teams haben geschätzt`));
  }
  out.push(bars);
  return out;
}

// ---------- Quizzen, wo man steht ----------
function top100(v, teamOf) {
  if (v.waiting) return waitTitle('Quizzen, wo man steht', 'Top-100-Listen: je weiter hinten euer Eintrag steht, desto mehr Punkte.');
  const src = [v.source && `Quelle: ${v.source}`, v.period, v.asOf].filter(Boolean).join(' · ');
  const out = [banner(v.category, 'compact slim'), src ? sub(src, { fontSize: '2vh', opacity: 0.8 }) : null,
    h('div', { class: 'nb-t100-scale' }, [['1–20', 1], ['21–40', 2], ['41–60', 3], ['61–80', 4], ['81–100', 5]].map(([r, p]) => h('span', {}, h('small', {}, `Rang ${r}`), h('b', {}, pts(p)))))];
  if (!v.evaluated) { out.push(sub(`${v.submittedCount} von ${v.teamCount} Teams haben abgegeben`, { marginTop: '3vh' })); return out; }
  out.push(h('div', { class: 'nb-t100-res' }, v.results.map((r) => h('div', { class: `nb-t100-row${r.rank ? '' : ' miss'}`, '--team': teamOf(r.teamId).color },
    h('span', { class: 'nm' }, teamOf(r.teamId).name), h('span', { class: 'ans' }, `„${r.text}“`),
    h('span', { class: 'rank' }, r.rank ? `Rang ${r.rank}` : 'nicht in der Top 100'), h('b', { class: 'p' }, `+${r.points}`)))));
  return out;
}

// ---------- Ich bin ein Star, lüg mich nicht an ----------
function star(v, teamOf) {
  if (v.waiting) return waitTitle('Ich bin ein Star, lüg mich nicht an', 'Acht Begriffe – einer davon ist gelogen.');
  const ring = h('div', { class: 'nb-star' },
    h('div', { class: 'nb-star-center' }, v.centerImage ? img(v.centerImage, 'nb-star-img') : null, h('b', {}, v.center)),
    v.terms.map((t, i) => {
      const a = (i / 8) * 2 * Math.PI - Math.PI / 2; // im Uhrzeigersinn ab oben
      return h('div', { class: `nb-star-term${v.resolved ? (i === v.wrong ? ' wrong' : ' right') : ''}`, style: { left: `${50 + 40 * Math.cos(a)}%`, top: `${50 + 40 * Math.sin(a)}%` } }, t);
    }));
  const order = v.buzzOrder.length ? row(...v.buzzOrder.map((b, k) => chip(teamOf(b.teamId), b.correct === false ? 'wrong' : '', ` ${k + 1}.${b.correct === undefined ? '' : b.correct ? ' ✓' : ' ✗'}`))) : null;
  return [ring, order, v.resolved ? h('div', { class: 'solution', style: { marginTop: '1.5vh' } }, v.winner ? `${teamOf(v.winner).name} +1` : 'Kein Team lag richtig') : null];
}

// ---------- Remember the Timeline ----------
function timeline(v, teamOf) {
  if (v.waiting) return waitTitle('Remember the Timeline', 'Reihum einordnen – ein Fehler kostet alle Punkte dieses Durchgangs.');
  if (v.notStarted) return [banner(v.category, 'compact slim'), sub('Gleich wird das Startteam ausgelost …', { marginTop: '4vh' })];
  const line = h('div', { class: 'nb-tl-line' }, v.line.map((e) => h('div', { class: `nb-tl-item${e.ref ? ' ref' : ''}${e.last ? (v.last.ok ? ' last ok' : ' last bad') : ''}` },
    h('b', {}, e.value), h('span', {}, e.label))));
  const teams = h('div', { class: 'nb-tl-teams' }, v.teams.map((t) => chip(teamOf(t.teamId), `${t.teamId === v.turn ? 'answering' : ''} ${t.state !== 'active' ? 'wrong-soft' : ''}`,
    h('b', {}, ` ${t.points}`), t.state === 'out' ? ' ✗' : t.state === 'quit' ? ' ⏏' : '')));
  const info = v.done ? h('div', { class: 'solution', style: { marginTop: '1vh' } }, 'Durchgang beendet – Punkte gutgeschrieben')
    : v.last ? sub(`${teamOf(v.last.teamId).name}: „${v.last.label}“ ${v.last.ok ? '✓ richtig' : '✗ falsch – Punkte weg'}`, { marginTop: '1vh' })
      : sub(`${teamOf(v.turn).name} beginnt (ausgelost)`, { marginTop: '1vh' });
  return [banner(v.category, 'compact slim'), line, h('div', { class: 'nb-tl-pool' }, `Noch ${v.pool.length} Begriffe`), info, teams];
}

// ---------- Guck mal, wer da spricht ----------
function chat(v, teamOf) {
  if (v.waiting) return waitTitle('Guck mal, wer da spricht', 'Wer schreibt hier? Buzzern, sobald ihr es wisst.');
  const phone = h('div', { class: 'phone-chat' },
    h('div', { class: `pc-head${v.resolved ? ' known' : ''}` }, v.photo ? img(v.photo, 'pc-photo') : h('span', { class: 'pc-avatar' }, v.person ? v.person.slice(0, 1) : '?'),
      h('b', {}, v.person || 'Unbekannt')),
    h('div', { class: 'pc-body' }, v.messages.map((m, i) => h('div', { class: `pc-msg ${m.right ? 'right' : 'left'}${i === v.messages.length - 1 && !v.resolved ? ' new' : ''}` }, m.text))));
  const buzz = v.buzzOrder.length ? row(...v.buzzOrder.map((b) => chip(teamOf(b.teamId), `${b.teamId === v.answering ? 'answering' : ''} ${b.status === 'wrong' ? 'wrong' : ''}`, b.status === 'correct' ? ' ✓' : b.status === 'wrong' ? ' ✗' : ''))) : null;
  return [h('div', { class: 'nb-chat' }, phone, h('div', { class: 'nb-chat-side' }, h('div', { class: 'nb-chat-count' }, `${v.shown} / ${v.total}`), buzz,
    v.resolved ? h('div', { class: 'solution' }, v.winner ? `${teamOf(v.winner).name} +1` : v.person) : null))];
}

// ---------- Host du das Zeug dafür? ----------
function hostdu(v, teamOf) {
  if (v.waiting) return waitTitle('Host du das Zeug dafür?', 'Erfindet Antworten, die andere Teams für richtig halten!');
  const out = [banner(v.question, 'compact slim')];
  if (v.phase === 'submit') return [...out, sub(`${v.submittedCount} von ${v.teamCount} Teams haben eingereicht`, { marginTop: '4vh' })];
  if (v.phase === 'review') return [...out, sub('Alle haben eingereicht – gleich geht die Abstimmung los …', { marginTop: '4vh' })];
  const revealed = v.phase === 'revealed';
  out.push(h('div', { class: 'nb-hd-opts' }, v.options.map((o) => h('div', { class: `nb-hd-opt${revealed ? (o.correct ? ' correct' : ' fake') : ''}` },
    h('b', { class: 'l' }, o.letter), h('span', { class: 'tx' }, o.text),
    revealed ? h('span', { class: 'meta' },
      o.correct ? h('em', {}, '✓ richtig') : o.by.length ? h('em', {}, 'erfunden von ', o.by.map((id) => teamOf(id).name).join(', ')) : null,
      o.chosenBy.length ? h('span', { class: 'votes' }, o.chosenBy.map((id) => h('i', { style: { background: teamOf(id).color }, title: teamOf(id).name }))) : null) : null))));
  if (!revealed) out.push(sub(`${v.votedCount} Teams haben gewählt`, { marginTop: '2vh' }));
  else out.push(row(...Object.entries(v.results).filter(([, r]) => r.regular + r.deceive > 0).map(([id, r]) => chip(teamOf(id), '', h('b', {}, ` +${r.regular + r.deceive}`)))));
  return out;
}

export const BEAMER_NEU = { sortieren, gier, top100, star, timeline, chat, hostdu };
