import { h, connect, run, store, toast, ask, localServer } from './client.js';

const token = store('quiz.modToken') || localServer?.demoToken;
if (!token) location.href = 'index.html';

let S = null; // letzter Zustand vom Server
let tab = store('quiz.modTab') || 'live';
const saveState = { dirty: false, saving: false, timer: null, pending: new Map() };
const deferred = new Set();

const conn = connect({
  hello: () => ({ role: 'moderator', token }),
  onState: (s) => {
    S = s;
    renderAll();
  },
  onAuthFailed: () => {
    store('quiz.modToken', null);
    location.href = 'index.html';
  },
});

document.getElementById('logout').onclick = async () => {
  await fetch('api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => {});
  store('quiz.modToken', null);
  location.href = 'index.html';
};

for (const b of document.querySelectorAll('[role=tab]')) {
  b.onclick = () => {
    tab = b.dataset.tab;
    store('quiz.modTab', tab);
    renderAll(true);
  };
}

// ---------- Rendering-Grundgerüst ----------

function renderAll(force = false) {
  if (!S) return;
  document.getElementById('show-name').textContent = S.project.name;
  for (const b of document.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const id of ['live', 'teams', 'editor', 'points']) document.getElementById(`tab-${id}`).classList.toggle('hidden', id !== tab);
  renderWarning();
  if (tab === 'live') return renderLive();
  const builders = { teams: buildTeams, editor: buildEditor, points: buildPoints };
  renderPanel(tab, builders[tab], force);
}

// Ein Panel nicht neu aufbauen, solange darin getippt wird; danach nachholen.
function renderPanel(id, build, force) {
  const panel = document.getElementById(`tab-${id}`);
  const active = document.activeElement;
  const typing = active && panel.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName);
  if (!force && (typing || (id === 'editor' && saveState.dirty))) {
    if (!deferred.has(id)) {
      deferred.add(id);
      panel.addEventListener('focusout', () => setTimeout(() => {
        deferred.delete(id);
        if (!saveState.dirty) renderAll();
      }, 0), { once: true });
    }
    return;
  }
  const scroll = window.scrollY;
  panel.replaceChildren(...build());
  window.scrollTo(0, scroll);
}

function renderWarning() {
  const box = document.getElementById('warning');
  const w = S.live.warning;
  if (!w) return box.replaceChildren();
  if (w.kind === 'coinTie') {
    box.replaceChildren(h('div', { class: 'notice warn', role: 'alert' },
      h('b', {}, `Gleichstand um Münze ${w.position}: `),
      w.teamIds.map(teamName).join(', '), ` (je ${w.points} Punkte). Bitte eine Schätzfrage stellen und das Gewinnerteam unten bei „Münzen“ bestätigen.`));
  }
}

const teamName = (id) => S.project.teams.find((t) => t.id === id)?.name || '?';
const teamColor = (id) => S.project.teams.find((t) => t.id === id)?.color || '#888';
const dot = (color) => h('span', { class: 'dot', style: { background: color } });
const card = (title, ...body) => h('section', { class: 'card' }, h('h3', {}, title), ...body);
const act = (name, payload) => run(conn, name, payload);

async function confirmAct(message, name, payload) {
  if (await ask(message)) act(name, payload);
}

// ---------- Live-Regie ----------

// Die Beamer-Vorschau steht fest im HTML, damit sie bei Updates nicht neu lädt.
function renderLive() {
  const scroll = window.scrollY;
  document.getElementById('live-left').replaceChildren(buildFlow(), buildGameControl());
  document.getElementById('beamer-controls').replaceChildren(...buildBeamerControls());
  document.getElementById('live-right').replaceChildren(buildTeamsLive(), buildCoins());
  window.scrollTo(0, scroll);
}

function buildFlow() {
  const active = S.live.activeGame;
  return card('Showablauf',
    h('ul', { class: 'list' }, S.project.games.map((g, i) => h('li', { class: i === active ? 'active' : '' },
      h('b', {}, `${g.position}.`),
      h('span', { class: 'grow' }, g.title, S.coinPositions.includes(g.position) ? h('span', { class: 'muted' }, '  · danach Münze') : null),
      g.implemented ? null : h('span', { class: 'badge' }, 'noch nicht umgesetzt'),
      i === active
        ? h('button', { class: 'btn small ghost', onclick: () => act('show.activate', { gameIndex: null }) }, 'Beenden')
        : h('button', { class: 'btn small', disabled: !g.implemented, onclick: () => act('show.activate', { gameIndex: i }) }, 'Aktivieren')))));
}

function buildGameControl() {
  const g = S.live.activeGame === null ? null : S.project.games[S.live.activeGame];
  if (!g) return card('Spielsteuerung', h('p', { class: 'muted' }, 'Kein Spiel aktiv. Oben ein Spiel aktivieren.'));
  if (g.key === 'leichte5') return buildG1(g);
  if (g.key === 'trumpf5') return buildG5(g);
  return card(g.title, h('p', {}, 'Noch nicht umgesetzt.'));
}

function buildG1(g) {
  const qIndex = S.live.g1.qIndex;
  const round = S.live.g1.rounds[qIndex];
  const out = [h('div', { class: 'row' }, g.content.questions.map((q, i) => {
    const r = S.live.g1.rounds[i];
    const label = `Frage ${i + 1}${r?.solutionRevealed ? ' ✓' : ''}`;
    return h('button', { class: `btn small ${i === qIndex ? 'pink' : 'ghost'}`, onclick: () => act('g1.open', { qIndex: i }) }, label);
  }))];
  if (qIndex < 0 || !round) {
    out.push(h('p', { class: 'muted' }, 'Frage freigeben, damit sie auf den Team-iPads erscheint.'));
    return card(`Spiel 1 · ${g.title}`, ...out);
  }
  const q = g.content.questions[qIndex];
  out.push(h('p', { class: 'question', style: { fontSize: '1.4rem' } }, q.question));
  out.push(h('p', {}, h('span', { class: 'muted' }, 'Musterlösung (nur für dich): '), h('b', {}, q.solution)));
  out.push(h('p', {}, round.open ? h('span', { class: 'badge ok' }, '● Abgabe offen') : h('span', { class: 'badge' }, '🔒 Abgabe geschlossen')));
  out.push(h('ul', { class: 'list' }, S.project.teams.map((t) => {
    const a = round.answers[t.id];
    if (!a) return h('li', {}, dot(t.color), h('span', { class: 'grow' }, t.name, h('span', { class: 'muted' }, ' – noch nicht abgegeben')));
    const grade = a.grade === true ? h('span', { class: 'badge ok' }, '✓ richtig') : a.grade === false ? h('span', { class: 'badge bad' }, '✗ falsch') : h('span', { class: 'badge warn' }, 'offen');
    return h('li', {}, dot(t.color),
      h('span', { class: 'grow' }, h('b', {}, t.name), ': ', a.text),
      grade,
      h('button', { class: `btn small ${a.onBeamer ? 'cyan' : 'ghost'}`, onclick: () => act('g1.showAnswer', { teamId: t.id, visible: !a.onBeamer }) }, a.onBeamer ? 'Auf Beamer ✓' : 'Auf Beamer zeigen'),
      h('button', { class: 'btn small ok', onclick: () => act('g1.grade', { teamId: t.id, correct: true }) }, '✓ Richtig'),
      h('button', { class: 'btn small bad', onclick: () => act('g1.grade', { teamId: t.id, correct: false }) }, '✗ Falsch'));
  })));
  out.push(h('p', { style: { marginTop: '14px' } },
    round.solutionRevealed
      ? h('span', { class: 'badge ok' }, 'Lösung wird gezeigt')
      : h('button', { class: 'btn', onclick: () => confirmAct('Lösung zeigen und Abgabe für diese Frage schließen?', 'g1.revealSolution') }, 'Lösung auf Beamer zeigen')));
  return card(`Spiel 1 · ${g.title}`, ...out);
}

function buildG5(g) {
  const termIndex = S.live.g5.termIndex;
  const round = S.live.g5.rounds[termIndex];
  const out = [h('div', { class: 'row' }, g.content.terms.map((t, i) => {
    const r = S.live.g5.rounds[i];
    return h('button', { class: `btn small ${i === termIndex ? 'pink' : 'ghost'}`, onclick: () => act('g5.start', { termIndex: i }) }, `Begriff ${i + 1}${r?.resolved ? ' ✓' : ''}`);
  }))];
  if (termIndex < 0 || !round) return card(`Spiel ${g.position} · ${g.title}`, ...out, h('p', { class: 'muted' }, 'Begriff starten: Teams sehen zuerst nur die Kategorie.'));
  const term = g.content.terms[termIndex];
  out.push(h('p', {}, h('span', { class: 'muted' }, 'Kategorie: '), h('b', {}, term.category), h('span', { class: 'muted' }, ' · Lösung: '), h('b', {}, term.term)));
  out.push(h('ol', { class: 'list' }, term.hints.map((hint, i) => h('li', { style: { opacity: i < round.hintLevel ? 1 : 0.5 } },
    h('b', {}, `${i + 1}.`), h('span', { class: 'grow' }, hint), i < round.hintLevel ? h('span', { class: 'badge ok' }, 'freigegeben') : h('span', { class: 'badge' }, `${5 - i} P.`)))));
  const pending = round.buzzes.find((b) => b.status === 'pending');
  out.push(h('div', { class: 'row', style: { marginTop: '12px' } },
    h('button', { class: 'btn', disabled: round.resolved || round.hintLevel >= 5 || !!pending, onclick: () => act('g5.nextHint') }, `Hinweis ${Math.min(round.hintLevel + 1, 5)} freigeben`),
    h('button', { class: 'btn small ghost', disabled: round.resolved || !!pending, onclick: () => confirmAct('Begriff ohne Punkte beenden?', 'g5.close') }, 'Ohne Punkte beenden'),
    round.resolved ? h('span', { class: 'badge ok' }, 'Begriff beendet') : null));
  const first = round.buzzes[0]?.at;
  out.push(h('h4', {}, 'Buzzer-Reihenfolge (Server-Zeit)'));
  out.push(round.buzzes.length ? h('ol', { class: 'list' }, round.buzzes.map((b) => h('li', { class: b === pending ? 'active' : '' },
    dot(teamColor(b.teamId)), h('span', { class: 'grow' }, h('b', {}, teamName(b.teamId)), h('span', { class: 'muted' }, ` · Hinweis ${b.hint} · +${b.at - first} ms`)),
    b.status === 'correct' ? h('span', { class: 'badge ok' }, '✓ richtig') : b.status === 'wrong' ? h('span', { class: 'badge bad' }, '✗ falsch') : null,
    b === pending ? [
      h('button', { class: 'btn small ok', onclick: () => act('g5.judge', { correct: true }) }, `✓ Richtig (+${6 - b.hint})`),
      h('button', { class: 'btn small bad', onclick: () => act('g5.judge', { correct: false }) }, '✗ Falsch'),
    ] : null))) : h('p', { class: 'muted' }, 'Noch kein Buzzer.'));
  return card(`Spiel ${g.position} · ${g.title}`, ...out);
}

function buildBeamerControls() {
  const views = [
    ['start', 'Startbild'], ['intro', 'Intro & Teams'], ['pyramid', 'Pyramide 4–2–2'], ['title', 'Spieltitel'],
    ['game', 'Spiel'], ['ranking', 'Rangliste enthüllen'], ['coin', 'Münze zeigen'], ['blank', 'Schwarz'],
  ];
  const current = S.live.beamer.view;
  return [
    h('p', { class: 'muted' }, `Zeigt jetzt: `, h('b', {}, views.find((v) => v[0] === current)?.[1] || current),
      ` · ${S.connections.beamers || 0} Beamer verbunden`),
    h('div', { class: 'row' }, views.map(([v, label]) => h('button', {
      class: `btn small ${v === current ? 'pink' : 'ghost'}`,
      onclick: () => v === 'ranking'
        ? confirmAct('Kumulierte Rangliste jetzt auf dem Beamer enthüllen?', 'beamer.show', { view: v })
        : act('beamer.show', { view: v }),
    }, label))),
  ];
}

function buildTeamsLive() {
  const sorted = [...S.project.teams].sort((a, b) => S.totals[b.id] - S.totals[a.id]);
  return card('Teams live (nur für dich sichtbar)',
    sorted.length ? h('ul', { class: 'list' }, sorted.map((t) => {
      const online = S.connections.teams?.[t.id];
      return h('li', {}, dot(t.color), h('span', { class: 'grow' }, t.name),
        h('span', { class: `badge ${online ? 'ok' : 'warn'}` }, online ? '● online' : '○ offline'),
        h('b', {}, `${S.totals[t.id]} P.`));
    })) : h('p', { class: 'muted' }, 'Noch keine Teams angelegt.'));
}

function buildCoins() {
  const w = S.live.warning;
  return card('Münzen',
    h('ul', { class: 'list' }, S.coinPositions.map((pos) => {
      const c = S.live.coins.find((x) => x.position === pos);
      if (c) return h('li', {}, h('span', { class: 'grow' }, `Nach Position ${pos}`), dot(teamColor(c.teamId)), h('b', {}, teamName(c.teamId)), h('span', { class: 'muted' }, `(${c.method})`));
      const tie = w?.kind === 'coinTie' && w.position === pos;
      return h('li', {}, h('span', { class: 'grow' }, `Nach Position ${pos}`),
        tie
          ? w.teamIds.map((id) => h('button', { class: 'btn small', onclick: () => confirmAct(`${teamName(id)} hat die Schätzfrage gewonnen und bekommt die Münze?`, 'coin.awardTie', { teamId: id }) }, `${teamName(id)} gewinnt Schätzfrage`))
          : h('button', { class: 'btn small', onclick: () => confirmAct(`Münzgewinner nach Position ${pos} aus dem kumulierten Punktestand ermitteln?`, 'coin.determine', { position: pos }) }, 'Gewinner ermitteln'));
    })),
    h('p', { class: 'muted' }, 'Danach „Münze zeigen“ beim Beamer wählen.'));
}

// ---------- Teams ----------

function buildTeams() {
  const base = `${location.origin}${location.pathname.replace(/moderator\.html$/, '')}team.html?code=`;
  return [
    card('Team anlegen',
      h('form', {
        class: 'row', onsubmit: (ev) => {
          ev.preventDefault();
          const name = ev.target.elements.name.value;
          act('team.add', { name });
          ev.target.reset();
        },
      }, h('input', { name: 'name', placeholder: 'Teamname', maxlength: '40', style: { flex: '1 1 220px', width: 'auto' } }),
      h('button', { class: 'btn', type: 'submit' }, '+ Team hinzufügen')),
      h('p', { class: 'muted' }, 'Standard sind sechs Teams. Jedes Team bekommt einen geheimen Zugangscode und einen persönlichen Link.')),
    card(`Teams (${S.project.teams.length})`,
      S.project.teams.length ? h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Farbe'), h('th', {}, 'Name'), h('th', {}, 'Zugangscode / Link'), h('th', {}, ''))),
        h('tbody', {}, S.project.teams.map((t) => h('tr', {},
          h('td', {}, h('input', { type: 'color', value: t.color, 'aria-label': `Farbe ${t.name}`, style: { width: '56px', padding: '2px' }, onchange: (ev) => act('team.update', { teamId: t.id, color: ev.target.value }) })),
          h('td', {}, h('input', { value: t.name, maxlength: '40', 'aria-label': 'Teamname', onchange: (ev) => act('team.update', { teamId: t.id, name: ev.target.value }) })),
          h('td', {}, h('div', { class: 'code' }, t.code),
            h('button', { class: 'btn small ghost', onclick: () => Promise.resolve(navigator.clipboard?.writeText(base + t.code)).then(() => toast('Link kopiert', 'info'), () => toast(`Kopieren nicht möglich. Link: ${base + t.code}`, 'info')) }, 'Link kopieren')),
          h('td', {}, h('div', { class: 'row' },
            h('button', { class: 'btn small ghost', onclick: () => confirmAct(`Neuen Code für ${t.name} erzeugen? Der alte Code und verbundene Geräte werden ungültig.`, 'team.regenCode', { teamId: t.id }) }, 'Neuer Code'),
            h('button', { class: 'btn small bad', onclick: () => confirmAct(`Team ${t.name} löschen?`, 'team.remove', { teamId: t.id }) }, 'Löschen'))))))) : h('p', { class: 'muted' }, 'Noch keine Teams.')),
  ];
}

// ---------- Show-Editor (Autosave) ----------

function saveIndicator() {
  const el = h('span', { class: 'save-state', id: 'save-state', 'aria-live': 'polite' });
  updateSaveIndicator(el);
  return el;
}

function updateSaveIndicator(el = document.getElementById('save-state')) {
  if (!el) return;
  if (saveState.saving) el.textContent = '… speichert';
  else if (saveState.dirty) el.textContent = '● Ungespeicherte Änderungen';
  else el.textContent = '✓ Gespeichert';
  el.style.color = saveState.dirty || saveState.saving ? 'var(--warn)' : 'var(--ok)';
}

// Änderungen je Bereich sammeln und nach kurzer Pause automatisch speichern.
function autosave(key, fn) {
  saveState.pending.set(key, fn);
  saveState.dirty = true;
  updateSaveIndicator();
  clearTimeout(saveState.timer);
  saveState.timer = setTimeout(async () => {
    const jobs = [...saveState.pending.values()];
    saveState.pending.clear();
    saveState.saving = true;
    updateSaveIndicator();
    const results = await Promise.all(jobs.map((job) => job()));
    saveState.saving = false;
    saveState.dirty = saveState.pending.size > 0 || results.some((r) => !r);
    updateSaveIndicator();
  }, 800);
}

function buildEditor() {
  const p = S.project;
  const field = (label, key, max) => h('div', {}, h('label', {}, label),
    h('input', { value: p[key], maxlength: String(max), oninput: (ev) => autosave(`project.${key}`, () => act('project.update', { [key]: ev.target.value })) }));
  const check = (label, key) => h('label', { style: { fontWeight: 400 } },
    h('input', { type: 'checkbox', checked: p.settings[key], style: { width: 'auto', marginRight: '8px' }, onchange: (ev) => act('project.update', { settings: { [key]: ev.target.checked } }) }), label);

  const out = [
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px' } }, h('h2', { style: { margin: 0 } }, 'Show-Editor'), saveIndicator()),
    h('div', { class: 'grid two' },
      card('Show', field('Showname', 'name', 80), field('Untertitel', 'subtitle', 160), field('Moderation', 'host', 80), field('Co-Moderation (optional)', 'coHost', 80)),
      card('Darstellung',
        check('Animationen reduzieren', 'reducedMotion'),
        check('Soundeffekte auf dem Beamer', 'sound'),
        check('Teams dürfen den Punktestand sehen (Standard: aus)', 'publicScores'),
        h('label', {}, 'Dauer der Spieltitel-Animation (Sekunden)'),
        h('input', { type: 'number', min: '3', max: '20', value: p.settings.titleDurationSec, onchange: (ev) => act('project.update', { settings: { titleDurationSec: Number(ev.target.value) } }) }))),
    card('Spielreihenfolge',
      h('p', { class: 'muted' }, 'Münzzeremonien finden nach den aktiven Positionen 4, 6 und 8 statt – unabhängig davon, welches Spiel dort steht. „Die leichten 5“ bleibt fest auf Position 1.'),
      h('ul', { class: 'list' }, p.games.map((g, i) => h('li', {},
        h('b', {}, `${g.position}.`), h('span', { class: 'grow' }, g.title, g.fixedOpener ? h('span', { class: 'muted' }, ' · festes Eröffnungsspiel') : null),
        S.coinPositions.includes(g.position) ? h('span', { class: 'badge' }, '🪙 danach Münze') : null,
        h('button', { class: 'btn small ghost', disabled: i <= 1 || g.fixedOpener, 'aria-label': 'nach oben', onclick: () => act('game.move', { gameIndex: i, dir: 'up' }) }, '↑'),
        h('button', { class: 'btn small ghost', disabled: i === p.games.length - 1 || g.fixedOpener, 'aria-label': 'nach unten', onclick: () => act('game.move', { gameIndex: i, dir: 'down' }) }, '↓'))))),
  ];
  p.games.forEach((g, i) => {
    if (g.key === 'leichte5') out.push(editG1(g, i));
    if (g.key === 'trumpf5') out.push(editG5(g, i));
  });
  return out;
}

function editG1(g, gameIndex) {
  const content = structuredClone(g.content);
  const save = () => autosave(`game.${gameIndex}`, () => act('game.updateContent', { gameIndex, content }));
  return card(`Inhalte: ${g.title}`, h('div', { class: 'grid two' }, content.questions.map((q, i) => h('div', {},
    h('label', {}, `Frage ${i + 1}`),
    h('textarea', { rows: '2', maxlength: '300', oninput: (ev) => { q.question = ev.target.value; save(); } }, q.question),
    h('label', {}, 'Musterlösung'),
    h('input', { value: q.solution, maxlength: '200', oninput: (ev) => { q.solution = ev.target.value; save(); } })))));
}

function editG5(g, gameIndex) {
  const content = structuredClone(g.content);
  const save = () => autosave(`game.${gameIndex}`, () => act('game.updateContent', { gameIndex, content }));
  return card(`Inhalte: ${g.title}`, h('div', { class: 'grid two' }, content.terms.map((t, i) => h('div', { class: 'card', style: { background: 'var(--bg)' } },
    h('h4', { style: { marginTop: 0 } }, `Begriff ${i + 1}`),
    h('label', {}, 'Kategorie'), h('input', { value: t.category, maxlength: '80', oninput: (ev) => { t.category = ev.target.value; save(); } }),
    h('label', {}, 'Gesuchter Begriff'), h('input', { value: t.term, maxlength: '120', oninput: (ev) => { t.term = ev.target.value; save(); } }),
    t.hints.map((hint, j) => [h('label', {}, `Hinweis ${j + 1} (${5 - j} Punkte)`), h('input', { value: hint, maxlength: '200', oninput: (ev) => { t.hints[j] = ev.target.value; save(); } })])))));
}

// ---------- Punkte & Protokoll ----------

function buildPoints() {
  const ledger = [...S.ledger].reverse();
  const fmt = (ts) => new Date(ts).toLocaleTimeString('de-DE');
  return [
    h('div', { class: 'grid two' },
      card('Punkte korrigieren',
        h('form', {
          onsubmit: (ev) => {
            ev.preventDefault();
            const f = ev.target.elements;
            act('points.adjust', { teamId: f.team.value, points: Number(f.points.value), reason: f.reason.value }).then((ok) => ok && ev.target.reset());
          },
        },
        h('label', {}, 'Team'), h('select', { name: 'team', required: true }, S.project.teams.map((t) => h('option', { value: t.id }, t.name))),
        h('label', {}, 'Punkte (z. B. 1 oder -1)'), h('input', { name: 'points', type: 'number', step: '1', required: true }),
        h('label', {}, 'Begründung (Pflicht, wird protokolliert)'), h('input', { name: 'reason', maxlength: '160', required: true }),
        h('p', {}, h('button', { class: 'btn', type: 'submit' }, 'Buchen')))),
      card('Kontrollierter Neustart',
        h('p', { class: 'muted' }, 'Setzt Spielzustand, Münzen und alle Punkte zurück. Teams, Inhalte und Protokoll bleiben erhalten.'),
        h('button', {
          class: 'btn bad', onclick: async () => {
            const ok = await ask('Spielstand, Münzen und alle Punkte wirklich zurücksetzen?', { requireText: 'NEUSTART', confirmLabel: 'Zurücksetzen', danger: true });
            if (ok) act('live.reset', { confirm: 'NEUSTART' });
          },
        }, 'Neustart …'))),
    card('Punktebuchungen',
      h('p', { class: 'muted' }, '„Rückgängig“ löscht nichts, sondern erzeugt eine Gegenbuchung.'),
      ledger.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Zeit'), h('th', {}, 'Team'), h('th', {}, 'Punkte'), h('th', {}, 'Grund'), h('th', {}, ''))),
        h('tbody', {}, ledger.map((e) => h('tr', { style: { opacity: e.reversedBy ? 0.5 : 1 } },
          h('td', {}, fmt(e.at)), h('td', {}, teamName(e.teamId)), h('td', {}, h('b', {}, e.points > 0 ? `+${e.points}` : e.points)), h('td', {}, e.reason),
          h('td', {}, e.reversedBy || e.reverses ? null : h('button', { class: 'btn small ghost', onclick: () => confirmAct('Diese Buchung rückgängig machen?', 'points.undo', { entryId: e.id }) }, 'Rückgängig')))))) : h('p', { class: 'muted' }, 'Noch keine Buchungen.')),
    card('Protokoll', h('ul', { class: 'list log' }, [...S.log].reverse().map((l) => h('li', {}, h('span', { class: 'muted' }, fmt(l.at)), h('span', { class: 'grow' }, l.detail))))),
  ];
}
