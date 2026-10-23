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
  for (const id of ['live', 'teams', 'editor', 'library', 'points']) document.getElementById(`tab-${id}`).classList.toggle('hidden', id !== tab);
  renderWarning();
  if (tab === 'live') return renderLive();
  const builders = { teams: buildTeams, editor: buildEditor, library: buildLibrary, points: buildPoints };
  renderPanel(tab, builders[tab], force);
}

// Ein Panel nicht neu aufbauen, solange darin getippt wird; danach nachholen.
function renderPanel(id, build, force) {
  const panel = document.getElementById(`tab-${id}`);
  const active = document.activeElement;
  const typing = active && panel.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName);
  if (!force && (typing || ((id === 'editor' || id === 'library') && saveState.dirty))) {
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
    h('ul', { class: 'list' }, S.project.games.map((g, i) => {
      const pos = i + 1;
      const playable = S.types[g.type].playable;
      return h('li', { class: g.id === active ? 'active' : '' },
        h('b', {}, `${pos}.`),
        h('span', { class: 'grow' }, g.title, S.coinPositions.includes(pos) ? h('span', { class: 'muted' }, '  · danach Münze') : null),
        playable ? null : h('span', { class: 'badge' }, 'noch nicht spielbar'),
        g.id === active
          ? h('button', { class: 'btn small ghost', onclick: () => act('show.activate', { gameId: null }) }, 'Beenden')
          : h('button', { class: 'btn small', disabled: !playable, onclick: () => act('show.activate', { gameId: g.id }) }, 'Aktivieren'));
    })),
    S.project.games.length < S.showSize ? h('p', { class: 'muted' }, `Noch ${S.showSize - S.project.games.length} Plätze frei. Spiele setzt du im Show-Editor ein.`) : null);
}

function activeGameOf() {
  return S.project.games.find((g) => g.id === S.live.activeGame) || null;
}

function buildGameControl() {
  const g = activeGameOf();
  if (!g) return card('Spielsteuerung', h('p', { class: 'muted' }, 'Kein Spiel aktiv. Oben ein Spiel aktivieren.'));
  const st = S.live.games[g.id] || {};
  const pos = S.project.games.indexOf(g) + 1;
  if (g.type === 'leichte5') return buildG1(g, st, pos);
  if (g.type === 'trumpf5') return buildG5(g, st, pos);
  return card(g.title, h('p', {}, 'Noch nicht spielbar.'));
}

function buildG1(g, st, pos) {
  const qIndex = st.qIndex ?? -1;
  const rounds = st.rounds || {};
  const round = rounds[qIndex];
  const title = `Spiel ${pos} · ${g.title}`;
  const out = [h('div', { class: 'row' }, g.content.questions.map((q, i) => {
    const label = `Frage ${i + 1}${rounds[i]?.solutionRevealed ? ' ✓' : ''}`;
    return h('button', { class: `btn small ${i === qIndex ? 'pink' : 'ghost'}`, onclick: () => act('g1.open', { qIndex: i }) }, label);
  }))];
  if (qIndex < 0 || !round) {
    out.push(h('p', { class: 'muted' }, 'Frage freigeben, damit sie auf den Team-iPads erscheint.'));
    return card(title, ...out);
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
  return card(title, ...out);
}

function buildG5(g, st, pos) {
  const termIndex = st.termIndex ?? -1;
  const rounds = st.rounds || {};
  const round = rounds[termIndex];
  const out = [h('div', { class: 'row' }, g.content.terms.map((t, i) => {
    const r = rounds[i];
    return h('button', { class: `btn small ${i === termIndex ? 'pink' : 'ghost'}`, onclick: () => act('g5.start', { termIndex: i }) }, `Begriff ${i + 1}${r?.resolved ? ' ✓' : ''}`);
  }))];
  if (termIndex < 0 || !round) return card(`Spiel ${pos} · ${g.title}`, ...out, h('p', { class: 'muted' }, 'Begriff starten: Teams sehen zuerst nur die Kategorie.'));
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
  return card(`Spiel ${pos} · ${g.title}`, ...out);
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

// ---------- Autosave ----------

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

// ---------- Show-Editor ----------

let selectedGame = null;
let selectedEntry = null;
const drafts = new Map();

function buildEditor() {
  const p = S.project;
  const field = (label, key, max) => h('div', {}, h('label', { for: `show-${key}` }, label),
    h('input', { id: `show-${key}`, value: p[key], maxlength: String(max), oninput: (ev) => autosave(`project.${key}`, () => act('project.update', { [key]: ev.target.value })) }));
  const check = (label, key) => h('label', { style: { fontWeight: 400 } },
    h('input', { type: 'checkbox', checked: p.settings[key], style: { width: 'auto', marginRight: '8px' }, onchange: (ev) => act('project.update', { settings: { [key]: ev.target.checked } }) }), label);

  if (!p.games.some((g) => g.id === selectedGame)) selectedGame = p.games[0]?.id || null;
  const sel = p.games.find((g) => g.id === selectedGame);

  return [
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px' } }, h('h2', { style: { margin: 0 } }, 'Show-Editor'), saveIndicator()),
    buildBoard(),
    sel ? buildGameEditor('game', sel) : null,
    h('div', { class: 'grid two', style: { marginTop: '16px' } },
      card('Show', field('Showname', 'name', 80), field('Untertitel', 'subtitle', 160), field('Moderation', 'host', 80), field('Co-Moderation (optional)', 'coHost', 80)),
      card('Darstellung',
        check('Animationen reduzieren', 'reducedMotion'),
        check('Soundeffekte auf dem Beamer', 'sound'),
        check('Teams dürfen den Punktestand sehen (Standard: aus)', 'publicScores'),
        h('label', { for: 'show-title-dur' }, 'Dauer der Spieltitel-Animation (Sekunden)'),
        h('input', { id: 'show-title-dur', type: 'number', min: '3', max: '20', value: p.settings.titleDurationSec, onchange: (ev) => act('project.update', { settings: { titleDurationSec: Number(ev.target.value) } }) }))),
  ];
}

const trashIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/>';
  return svg;
};

// Showablauf als Brett: Plätze 1–4 links, 5–8 rechts, Mülleimer in der Mitte.
function buildBoard() {
  const games = S.project.games;
  const running = S.live.activeGame !== null;
  const slots = Array.from({ length: S.showSize }, (_, i) => (games[i] ? buildSlot(games[i], i, running) : buildEmptySlot(i, running)));
  const trash = h('div', {
    class: 'trash', role: 'note', tabindex: '-1',
    ondragover: (ev) => { ev.preventDefault(); ev.currentTarget.classList.add('over'); },
    ondragleave: (ev) => ev.currentTarget.classList.remove('over'),
    ondrop: (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.remove('over');
      const id = ev.dataTransfer.getData('text/plain');
      const g = games.find((x) => x.id === id);
      if (g) removeGame(g);
    },
  }, trashIcon(), h('b', {}, 'Mülleimer'), h('span', {}, 'Spiel hierher ziehen, um es aus der Show zu entfernen'));
  return card('Showablauf',
    h('p', { class: 'muted' }, 'Ziehe Spiele, um die Reihenfolge zu ändern, oder in den Mülleimer, um sie zu entfernen. Freie Plätze füllst du mit Spielen aus der Datenbank, auch mehrfach mit demselben Spiel. Nach Platz 4, 6 und 8 gibt es eine Münze.'),
    running ? h('p', { class: 'notice warn' }, 'Ein Spiel läuft gerade. Der Ablauf lässt sich erst nach dem Beenden ändern.') : null,
    games.length !== S.showSize ? h('p', { class: 'notice warn' }, `Die Show hat ${games.length} von ${S.showSize} Spielen. Vor dem Live-Start müssen alle ${S.showSize} Plätze belegt sein.`) : null,
    h('div', { class: 'board' },
      h('div', { class: 'slots' }, slots.slice(0, 4)),
      h('div', { class: 'trash-col' }, trash),
      h('div', { class: 'slots' }, slots.slice(4))));
}

function slotDrop(index) {
  return {
    ondragover: (ev) => { ev.preventDefault(); ev.currentTarget.classList.add('over'); },
    ondragleave: (ev) => ev.currentTarget.classList.remove('over'),
    ondrop: (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.remove('over');
      const id = ev.dataTransfer.getData('text/plain');
      if (id && S.project.games.some((g) => g.id === id)) act('game.moveTo', { gameId: id, index: Math.min(index, S.project.games.length - 1) });
    },
  };
}

function buildSlot(g, i, running) {
  const pos = i + 1;
  const type = S.types[g.type];
  return h('article', {
    class: `slot ${g.id === selectedGame ? 'selected' : ''}`, draggable: running || g.locked ? 'false' : 'true',
    ondragstart: (ev) => { ev.dataTransfer.setData('text/plain', g.id); ev.dataTransfer.effectAllowed = 'move'; },
    ...slotDrop(i),
  },
  h('span', { class: 'slot-pos' }, pos),
  h('div', { class: 'slot-body' },
    h('b', { class: 'slot-title' }, g.title),
    h('span', { class: 'muted slot-type' }, g.title === type.title ? type.summary : type.title),
    h('div', { class: 'row', style: { gap: '6px' } },
      type.playable ? h('span', { class: 'badge ok' }, 'spielbar') : h('span', { class: 'badge' }, 'Inhalte bearbeitbar'),
      g.locked ? h('span', { class: 'badge warn' }, '🔒 Eröffnungsspiel') : null,
      S.coinPositions.includes(pos) ? h('span', { class: 'badge coin-badge' }, '🪙 danach Münze') : null)),
  h('div', { class: 'slot-actions' },
    h('button', { class: `btn small ${g.id === selectedGame ? 'pink' : 'ghost'}`, onclick: () => { selectedGame = g.id; renderAll(true); } }, 'Bearbeiten'),
    h('button', { class: 'btn small ghost', disabled: running || g.locked || i === 0 || (i === 1 && S.project.games[0]?.locked), 'aria-label': `${g.title} nach oben`, onclick: () => act('game.moveTo', { gameId: g.id, index: i - 1 }) }, '↑'),
    h('button', { class: 'btn small ghost', disabled: running || g.locked || i === S.project.games.length - 1, 'aria-label': `${g.title} nach unten`, onclick: () => act('game.moveTo', { gameId: g.id, index: i + 1 }) }, '↓'),
    h('button', { class: 'btn small ghost icon', disabled: running, 'aria-label': `${g.title} entfernen`, title: 'In den Mülleimer', onclick: () => removeGame(g) }, trashIcon())));
}

function buildEmptySlot(i, running) {
  return h('div', { class: 'slot empty', ...slotDrop(i) },
    h('span', { class: 'slot-pos' }, i + 1),
    h('div', { class: 'slot-body' }, h('span', { class: 'muted' }, 'Freier Platz')),
    h('button', { class: 'btn small', disabled: running, onclick: () => pickFromLibrary(i) }, '+ Spiel aus Datenbank'));
}

async function removeGame(g) {
  if (S.live.activeGame !== null) return toast('Ein Spiel läuft gerade. Zuerst beenden.');
  if (g.locked) {
    const ok = await ask(`„${g.title}“ ist das feste Eröffnungsspiel. Willst du es per Sonderaktion aus der Show entfernen?`, { requireText: 'ENTFERNEN', confirmLabel: 'Entfernen', danger: true });
    if (ok) act('game.remove', { gameId: g.id, override: 'ENTFERNEN' });
    return;
  }
  if (await ask(`„${g.title}“ aus der Show entfernen? In der Spiele-Datenbank bleibt es erhalten.`, { confirmLabel: 'In den Mülleimer', danger: true })) {
    act('game.remove', { gameId: g.id });
  }
}

// Auswahl aus der Datenbank für einen freien Platz.
function pickFromLibrary(index) {
  const overlay = h('div', { class: 'modal-backdrop', onclick: (ev) => ev.target === overlay && overlay.remove() });
  const close = () => overlay.remove();
  const groups = Object.entries(S.types).map(([type, t]) => {
    const entries = S.library.filter((e) => e.type === type);
    return h('section', { class: 'pick-group' },
      h('h4', {}, t.title, ' ', t.playable ? h('span', { class: 'badge ok' }, 'spielbar') : h('span', { class: 'badge' }, 'Inhalte bearbeitbar')),
      entries.length ? h('ul', { class: 'list' }, entries.map((e) => h('li', {},
        h('span', { class: 'grow' }, e.title, h('span', { class: 'muted' }, ` · Version ${e.version}`)),
        h('button', { class: 'btn small pink', onclick: async () => { close(); const r = await act('game.add', { libraryId: e.id, index }); if (r) { selectedGame = null; } } }, 'Einsetzen'))))
        : h('p', { class: 'muted' }, 'Kein Eintrag. Lege in der Spiele-Datenbank einen an.'));
  });
  overlay.append(h('div', { class: 'modal card wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Spiel aus Datenbank wählen' },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { style: { margin: 0 } }, `Platz ${index + 1}: Spiel aus der Datenbank wählen`), h('button', { class: 'btn small ghost', onclick: close }, 'Schließen')),
    h('div', { class: 'pick-list' }, groups)));
  document.body.append(overlay);
}

// ---------- Spiele-Datenbank ----------

function buildLibrary() {
  if (!S.library.some((e) => e.id === selectedEntry)) selectedEntry = null;
  const sel = S.library.find((e) => e.id === selectedEntry);
  const groups = Object.entries(S.types).map(([type, t]) => {
    const entries = S.library.filter((e) => e.type === type);
    return h('section', { class: 'card lib-group' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h3', { style: { margin: 0 } }, t.title),
        h('div', { class: 'row', style: { gap: '6px' } },
          t.playable ? h('span', { class: 'badge ok' }, 'spielbar') : h('span', { class: 'badge' }, 'Inhalte bearbeitbar, Spielablauf folgt'),
          h('button', { class: 'btn small', onclick: async () => { const r = await act('library.add', { type }); if (r) { selectedEntry = null; } } }, '+ Neu'))),
      h('p', { class: 'muted' }, t.summary),
      entries.length ? h('ul', { class: 'list' }, entries.map((e) => h('li', { class: e.id === selectedEntry ? 'active' : '' },
        h('span', { class: 'grow' }, h('b', {}, e.title), h('span', { class: 'muted' }, ` · Version ${e.version}`)),
        h('button', { class: `btn small ${e.id === selectedEntry ? 'pink' : 'ghost'}`, onclick: () => { selectedEntry = e.id; renderAll(true); } }, 'Bearbeiten'),
        h('button', { class: 'btn small ghost', onclick: () => act('library.duplicate', { libraryId: e.id }) }, 'Duplizieren'),
        h('button', { class: 'btn small ghost', disabled: S.project.games.length >= S.showSize || S.live.activeGame !== null, title: S.project.games.length >= S.showSize ? 'Die Show ist voll. Zuerst ein Spiel in den Mülleimer ziehen.' : '', onclick: () => act('game.add', { libraryId: e.id }).then((r) => r && toast(`„${e.title}“ in die Show eingesetzt`, 'info')) }, 'In Show einsetzen'),
        h('button', { class: 'btn small ghost icon', 'aria-label': `${e.title} löschen`, onclick: async () => { if (await ask(`„${e.title}“ aus der Datenbank löschen? Spiele, die schon in der Show sind, bleiben erhalten.`, { confirmLabel: 'Löschen', danger: true })) act('library.remove', { libraryId: e.id }); } }, trashIcon()))))
        : h('p', { class: 'muted' }, 'Noch kein Eintrag.'));
  });
  return [
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px' } }, h('h2', { style: { margin: 0 } }, 'Spiele-Datenbank'), saveIndicator()),
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Hier liegen alle Spiele mit ihren Inhalten. Lege Varianten an (z. B. zweimal „5 ist Trümpf“ mit anderen Begriffen) und setze sie im Show-Editor ein. Eine Show bekommt immer eine eigene Kopie.'),
    sel ? buildGameEditor('library', sel) : null,
    h('div', { class: 'grid lib-grid', style: { marginTop: '16px' } }, groups),
  ];
}

// ---------- Formular-Editor für Spielinhalte ----------

function buildGameEditor(kind, item) {
  const key = `${kind}.${item.id}`;
  let d = drafts.get(key);
  if (!d || !(saveState.pending.has(key) || saveState.saving)) {
    d = { title: item.title, content: structuredClone(item.content) };
    drafts.set(key, d);
  }
  const type = S.types[item.type];
  const save = () => autosave(key, () => (kind === 'game'
    ? act('game.update', { gameId: item.id, title: d.title, content: d.content })
    : act('library.update', { libraryId: item.id, title: d.title, content: d.content })));
  const rerender = () => { save(); renderAll(true); };
  const running = kind === 'game' && S.live.activeGame === item.id;
  const pos = kind === 'game' ? S.project.games.indexOf(item) + 1 : null;

  return h('section', { class: 'card editor', style: { marginTop: '16px' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      h('h3', { style: { margin: 0 } }, kind === 'game' ? `Platz ${pos} bearbeiten: ${type.title}` : `Datenbank-Eintrag bearbeiten: ${type.title}`),
      kind === 'game'
        ? h('button', { class: 'btn small ghost', onclick: () => act('library.saveFromShow', { gameId: item.id }).then((r) => r && toast('Als neuer Eintrag in der Datenbank gespeichert', 'info')) }, 'In Datenbank speichern')
        : h('span', { class: 'muted' }, `Version ${item.version}`)),
    h('p', { class: 'muted' }, kind === 'game'
      ? 'Änderungen gelten nur für diese Show. Der Eintrag in der Datenbank bleibt unverändert.'
      : 'Änderungen gelten für künftige Shows. Spiele, die schon in einer Show sind, bleiben unverändert.'),
    running ? h('p', { class: 'notice warn' }, 'Dieses Spiel läuft gerade. Inhalte erst nach dem Beenden ändern.') : null,
    h('fieldset', { disabled: running, class: 'plain' },
      h('label', { for: `${key}-title` }, 'Name in der Show (erscheint im Spieltitel auf dem Beamer)'),
      h('input', { id: `${key}-title`, value: d.title, maxlength: '80', oninput: (ev) => { d.title = ev.target.value; save(); } }),
      formFields(type.schema, d.content, save, rerender, key)));
}

function formFields(fields, obj, save, rerender, idBase) {
  return fields.map((f) => formField(f, obj, f.key, save, rerender, `${idBase}-${f.key}`));
}

function formField(f, holder, k, save, rerender, id) {
  const set = (v) => { holder[k] = v; save(); };
  switch (f.type) {
    case 'text':
      return h('div', { class: 'field' }, h('label', { for: id }, f.label), h('input', { id, value: holder[k] ?? '', maxlength: String(f.max), oninput: (ev) => set(ev.target.value) }));
    case 'textarea':
      return h('div', { class: 'field' }, h('label', { for: id }, f.label), h('textarea', { id, rows: String(f.rows || 2), maxlength: String(f.max), oninput: (ev) => set(ev.target.value) }, holder[k] ?? ''));
    case 'number':
      return h('div', { class: 'field' }, h('label', { for: id }, f.label), h('input', { id, type: 'number', min: String(f.min), max: String(f.max), step: String(f.step || 1), value: holder[k] ?? '', oninput: (ev) => set(ev.target.value === '' ? null : Number(ev.target.value)) }));
    case 'select': {
      const sel = h('select', { id, onchange: (ev) => set(ev.target.value) }, f.options.map((o) => h('option', { value: o }, o)));
      sel.value = holder[k] ?? f.options[0];
      return h('div', { class: 'field' }, h('label', { for: id }, f.label), sel);
    }
    case 'object':
      holder[k] = holder[k] || {};
      return h('fieldset', { class: 'group' }, h('legend', {}, f.label), h('div', { class: 'field-grid' }, formFields(f.fields, holder[k], save, rerender, id)));
    case 'list': {
      const arr = (holder[k] = holder[k] || []);
      const canChange = f.min !== f.max;
      const items = arr.map((item, i) => {
        const label = f.itemLabels[i] || `${i + 1}`;
        const remove = canChange && arr.length > f.min
          ? h('button', { type: 'button', class: 'btn small ghost icon', 'aria-label': `${label} entfernen`, onclick: () => { arr.splice(i, 1); rerender(); } }, trashIcon())
          : null;
        if (f.of === 'text') {
          return h('div', { class: 'field list-text' }, h('label', { for: `${id}-${i}` }, label),
            h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, h('input', { id: `${id}-${i}`, value: item ?? '', maxlength: String(f.maxLength || 300), oninput: (ev) => { arr[i] = ev.target.value; save(); } }), remove));
        }
        const preview = Object.values(item).find((v) => typeof v === 'string' && v.trim()) || 'noch leer';
        return h('details', { class: 'item', open: arr.length <= 5 || i === 0 },
          h('summary', {}, h('b', {}, label), h('span', { class: 'muted' }, ` · ${preview.slice(0, 60)}`)),
          h('div', { class: 'item-body' }, formFields(f.fields, item, save, rerender, `${id}-${i}`), remove ? h('div', { style: { marginTop: '8px' } }, remove) : null));
      });
      const add = canChange && arr.length < f.max
        ? h('button', { type: 'button', class: 'btn small', onclick: () => { arr.push(f.of === 'text' ? '' : emptyItem(f.fields)); rerender(); } }, `+ ${f.addLabel || 'Eintrag hinzufügen'}`)
        : null;
      return h('fieldset', { class: 'group' }, h('legend', {}, f.label, canChange ? h('span', { class: 'muted' }, ` (${arr.length} von max. ${f.max})`) : null), h('div', { class: f.of === 'text' ? 'field-grid' : 'items' }, items), add);
    }
    default:
      return null;
  }
}

function emptyItem(fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'object') out[f.key] = emptyItem(f.fields);
    else if (f.type === 'list') out[f.key] = Array.from({ length: f.min }, () => (f.of === 'text' ? '' : emptyItem(f.fields)));
    else if (f.type === 'select') out[f.key] = f.options[0];
    else if (f.type === 'number') out[f.key] = null;
    else out[f.key] = '';
  }
  return out;
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
