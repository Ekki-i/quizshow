import { h, connect, run, store, toast, ask, localServer, uploadMedia, mediaUrl, setShowTitle, coinImg } from './client.js';
import { buildPlay } from './mod-play.js';
import { buildFinaleLive, buildFinaleEditor } from './mod-finale.js';

const token = store('quiz.modToken') || localServer?.demoToken;
if (!token) location.href = 'index.html';

let S = null; // letzter Zustand vom Server
// Ansicht: ?view=live (nur Moderation), ?view=editor (nur Editor), sonst beides.
const VIEW = new URLSearchParams(location.search).get('view');
const LIVE_TABS = ['live'];
const EDITOR_TABS = ['teams', 'editor', 'library'];
const ALLOWED = VIEW === 'editor' ? EDITOR_TABS : VIEW === 'live' ? LIVE_TABS : [...LIVE_TABS, ...EDITOR_TABS];
const TAB_KEY = `quiz.modTab${VIEW ? `.${VIEW}` : ''}`;
let tab = ALLOWED.includes(store(TAB_KEY)) ? store(TAB_KEY) : ALLOWED[0];
let lastEditorTab = EDITOR_TABS.includes(tab) ? tab : 'teams';
if (VIEW === 'editor') {
  document.getElementById('main-tabs').classList.add('hidden');
  document.querySelector('.beamer-mini')?.remove(); // Beamer-Vorschau nur in der Moderation
}
if (VIEW === 'live') document.querySelector('#main-tabs [data-group="editor"]').remove();
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
    tab = b.dataset.group === 'editor' ? lastEditorTab : b.dataset.tab;
    if (EDITOR_TABS.includes(tab)) lastEditorTab = tab;
    store(TAB_KEY, tab);
    renderAll(true);
  };
}

// ---------- Rendering-Grundgerüst ----------

function renderAll(force = false) {
  if (!S) return;
  setShowTitle(document.getElementById('show-name'), S.project.name);
  const inEditor = EDITOR_TABS.includes(tab);
  for (const b of document.querySelectorAll('[role=tab]')) {
    b.setAttribute('aria-selected', String(b.dataset.group === 'editor' ? inEditor : b.dataset.tab === tab));
  }
  document.getElementById('editor-tabs').classList.toggle('hidden', !inEditor);
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
  panel.replaceChildren(...build().filter(Boolean));
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

// Countdowns (10-Sekunden-Fenster) live mitzählen.
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) el.textContent = `${Math.max(0, Math.ceil((Number(el.dataset.deadline) - Date.now()) / 1000))} s`;
}, 250);

async function confirmAct(message, name, payload) {
  if (await ask(message)) act(name, payload);
}

// ---------- Live-Regie ----------

// Die Beamer-Vorschau steht fest im HTML, damit sie bei Updates nicht neu lädt.
function renderLive() {
  const scroll = window.scrollY;
  document.getElementById('run-panel').replaceChildren(buildRun());
  const step = (S.rundown || [])[S.live.run ?? -1];
  const finaleOn = !S.live.activeGame && (S.live.finale || step?.kind === 'finale');
  document.getElementById('live-left').replaceChildren(finaleOn ? buildFinaleLive(finaleUi()) : buildGameControl());
  document.getElementById('live-bottom').replaceChildren(buildFlow());
  document.getElementById('beamer-controls').replaceChildren(...buildBeamerControls());
  document.getElementById('live-right').replaceChildren(buildTeamsLive(), buildCoins());
  window.scrollTo(0, scroll);
}

function finaleUi() {
  return { S, card, act, confirmAct, autosave, rerender: () => renderAll(true) };
}

function buildFlow() {
  const active = S.live.activeGame;
  return card('Spiele (direkt aktivieren)',
    h('ul', { class: 'list' }, S.project.games.map((g, i) => {
      const pos = i + 1;
      const playable = S.types[g.type].playable;
      return h('li', { class: g.id === active ? 'active' : '' },
        h('b', {}, `${pos}.`),
        h('span', { class: 'grow' }, g.title, S.coinPositions.includes(pos) ? h('span', { class: 'muted' }, '  · danach Pause und Münze') : null),
        playable ? null : h('span', { class: 'badge' }, 'noch nicht spielbar'),
        g.id === active
          ? h('button', { class: 'btn small ghost', onclick: () => act('show.activate', { gameId: null }) }, 'Beenden')
          : h('button', { class: 'btn small', disabled: !playable, onclick: () => act('show.activate', { gameId: g.id }) }, 'Aktivieren'));
    })),
    S.project.games.length < S.showSize ? h('p', { class: 'muted' }, `Noch ${S.showSize - S.project.games.length} Plätze frei. Spiele setzt du im Show-Editor ein.`) : null);
}

// ---------- Showablauf wie eine Präsentation ----------

const RUN_ICON = { start: '★', video: '🎞', intro: '👥', pyramid: '▲', title: '🎬', game: '🎮', coin: '🪙', pause: '☕', ranking: '🏆', finale: '★', end: '🏁' };
const RUN_KIND_LABEL = { start: 'Startbild', video: 'Intro-Video', intro: 'Vorstellung der Teams', pyramid: 'Übersicht Kategorien', title: 'Spieltitel', game: 'Spiel spielen', coin: 'Münzvergabe', pause: 'Pause', ranking: 'Zwischenstand / Rangliste', finale: 'Finale gegen die Moderation', end: 'Abschluss' };

// Symbol eines Schritts; die Münzvergabe zeigt die Münze der Show.
const runIcon = (kind) => (kind === 'coin' ? coinImg('run-coin') : RUN_ICON[kind]);

function runNext() { return act('run.next'); }
function runPrev() { return act('run.prev'); }

function buildRun() {
  const steps = S.rundown || [];
  const cur = S.live.run ?? -1;
  const now = steps[cur];
  const next = steps[cur + 1];
  const started = cur >= 0;
  const head = h('div', { class: 'run-head' },
    h('div', { class: 'run-now' },
      h('span', { class: 'run-count' }, started ? `Schritt ${cur + 1} von ${steps.length}` : `${steps.length} Schritte`),
      h('div', { class: 'run-title' }, started ? [h('span', { class: 'run-ico' }, runIcon(now.kind)), now.text] : 'Show noch nicht gestartet'),
      h('div', { class: 'run-next muted' }, next ? ['Als Nächstes: ', h('b', {}, runIcon(next.kind), ' ', next.text)] : 'Letzter Schritt erreicht')),
    h('div', { class: 'run-buttons' },
      now && now.kind === 'video' && S.project.introVideo ? h('button', { class: 'btn ghost', onclick: () => act('run.goto', { index: cur }) }, '⟲ Video von vorn') : null,
      h('button', { class: 'btn ghost', disabled: cur <= 0, onclick: runPrev, title: 'Zurück (Pfeil links)' }, '◀ Zurück'),
      h('button', { class: 'btn pink run-go', disabled: cur >= steps.length - 1, onclick: runNext, title: 'Weiter (Pfeil rechts, Leertaste)' }, started ? 'Weiter ▶' : 'Show starten ▶')));
  const strip = h('ol', { class: 'run-strip', 'aria-label': 'Alle Schritte' }, steps.map((st, i) => h('li', {},
    h('button', {
      class: `run-step k-${st.kind} ${i === cur ? 'current' : ''} ${i < cur ? 'done' : ''}`,
      'aria-current': i === cur ? 'step' : null,
      title: `${i + 1}. ${st.text}`,
      onclick: () => act('run.goto', { index: i }),
    }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'i' }, runIcon(st.kind)), h('span', { class: 't' }, st.text)))));
  const panel = h('section', { class: 'card run-card' }, h('h3', {}, 'Showablauf'), head, strip,
    h('p', { class: 'muted run-hint' }, 'Tipp: Pfeil rechts, Leertaste oder ein Presenter-Klicker schalten weiter, Pfeil links zurück. Den Ablauf änderst du im Editor unter „Show-Editor“.'));
  // Aktuellen Schritt in der Leiste sichtbar halten.
  requestAnimationFrame(() => panel.querySelector('.run-step.current')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  return panel;
}

// Tastatur und Presenter-Klicker (senden meist Bild↓/Bild↑ oder Pfeiltasten).
document.addEventListener('keydown', (ev) => {
  if (tab !== 'live' || !S || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const t = ev.target;
  if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
  if (document.querySelector('.modal-backdrop, dialog[open]')) return;
  if (['ArrowRight', 'PageDown', ' '].includes(ev.key)) { ev.preventDefault(); runNext(); }
  else if (['ArrowLeft', 'PageUp'].includes(ev.key)) { ev.preventDefault(); runPrev(); }
});

// Intro-Video je Show: läuft im Showablauf direkt nach dem Startbild.
let introUpload = null; // { name, progress } während des Hochladens
function buildIntroVideo() {
  const v = S.project.introVideo;
  const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
  const input = h('input', {
    type: 'file', accept: 'video/mp4,video/webm,video/quicktime,video/x-m4v', class: 'visually-hidden', 'aria-label': 'Intro-Video wählen',
    onchange: async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      introUpload = { name: file.name, progress: 0 };
      renderAll(true);
      try {
        const m = await uploadMedia(file, token, (p) => {
          introUpload.progress = p;
          const bar = document.getElementById('intro-progress');
          if (bar) bar.value = p;
        });
        await act('intro.set', { media: { id: m.id, type: m.type, size: m.size, name: file.name } });
      } catch (err) {
        toast(err.message);
      } finally {
        introUpload = null;
        renderAll(true);
      }
    },
  });
  const preview = h('video', { class: 'intro-preview', controls: true, preload: 'metadata', playsinline: true });
  if (v) mediaUrl(v.id).then((url) => {
    if (url) preview.src = url;
    else preview.replaceWith(h('p', { class: 'notice warn' }, 'Das Video ist auf diesem Gerät nicht mehr vorhanden – bitte neu hochladen.'));
  });
  return card('Intro-Video',
    h('p', { class: 'muted' }, 'Läuft im Showablauf direkt nach dem Startbild. Jede Show hat ihr eigenes Video – einfach austauschen.'),
    introUpload
      ? h('div', {}, h('p', {}, `„${introUpload.name}“ wird hochgeladen …`), h('progress', { id: 'intro-progress', max: '1', value: String(introUpload.progress), style: { width: '100%' } }))
      : v
        ? h('div', { class: 'intro-box' }, preview, h('p', {}, h('b', {}, v.name), v.size ? h('span', { class: 'muted' }, ` · ${fmtSize(v.size)}`) : null))
        : h('p', { class: 'muted' }, 'Noch kein Video hinterlegt. Ohne Video zeigt der Beamer an dieser Stelle das Show-Logo.'),
    introUpload ? null : h('div', { class: 'row' },
      h('label', { class: 'btn' }, input, v ? 'Video austauschen' : '+ Video hochladen'),
      v ? h('button', { class: 'btn ghost', onclick: () => confirmAct('Intro-Video aus dieser Show entfernen?', 'intro.set', { media: null }) }, 'Entfernen') : null),
    h('p', { class: 'muted', style: { fontSize: '0.85rem' } }, 'Formate: MP4 (empfohlen), WebM oder MOV. Ton läuft auf dem Beamer, sobald dort „Ton aktivieren“ geklickt wurde.'));
}

// Intro-Lied je Spiel (Kategorie): läuft auf der Spieltitel-Folie dieses Spiels.
let gameIntroUpload = null; // { gameId, name, progress }
function buildGameIntro(g, pos) {
  const m = g.intro;
  const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
  const input = h('input', {
    type: 'file', accept: 'audio/*,video/mp4,video/webm,video/quicktime,video/x-m4v,.mp3,.m4a,.mp4', class: 'visually-hidden', 'aria-label': `Intro-Lied für Spiel ${pos} wählen`,
    onchange: async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      gameIntroUpload = { gameId: g.id, name: file.name, progress: 0 };
      renderAll(true);
      try {
        const up = await uploadMedia(file, token, (p) => {
          gameIntroUpload.progress = p;
          const bar = document.getElementById('game-intro-progress');
          if (bar) bar.value = p;
        });
        await act('game.setIntro', { gameId: g.id, media: { id: up.id, type: up.type, size: up.size, name: file.name } });
      } catch (err) {
        toast(err.message);
      } finally {
        gameIntroUpload = null;
        renderAll(true);
      }
    },
  });
  const busy = gameIntroUpload && gameIntroUpload.gameId === g.id;
  const player = m ? h(m.type.startsWith('video') ? 'video' : 'audio', { controls: true, preload: 'metadata', class: 'game-intro-preview' }) : null;
  if (m) mediaUrl(m.id).then((url) => {
    if (url) player.src = url;
    else player.replaceWith(h('p', { class: 'notice warn' }, 'Die Datei ist auf diesem Gerät nicht mehr vorhanden – bitte neu hochladen.'));
  });
  return h('div', { class: 'game-intro-box' },
    h('b', {}, '♪ Intro-Lied für die Spieltitel-Folie'),
    busy
      ? h('div', {}, h('p', {}, `„${gameIntroUpload.name}“ wird hochgeladen …`), h('progress', { id: 'game-intro-progress', max: '1', value: String(gameIntroUpload.progress), style: { width: '100%' } }))
      : m ? h('div', {}, h('p', { style: { margin: '6px 0' } }, m.name, m.size ? h('span', { class: 'muted' }, ` · ${fmtSize(m.size)}`) : null), player)
        : h('p', { class: 'muted', style: { margin: '6px 0' } }, 'Noch kein Intro-Lied. MP3 oder MP4 hochladen – es läuft, solange der Spieltitel auf dem Beamer steht.'),
    busy ? null : h('div', { class: 'row' },
      h('label', { class: 'btn small' }, input, m ? 'Austauschen' : '+ MP3/MP4 hochladen'),
      m ? h('button', { class: 'btn small ghost', onclick: () => act('game.setIntro', { gameId: g.id, media: null }) }, 'Entfernen') : null));
}

// Eigene Lieder je Pause: Playlist hochladen, sortieren, entfernen.
let openPause = null;
let songUpload = null; // { done, total, name }
function buildPauseSongs(st) {
  const songs = st.songs || [];
  const setSongs = (list) => act('rundown.setSongs', { stepId: st.id, songs: list });
  const move = (i, d) => { const l = [...songs]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); setSongs(l); };
  const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
  const input = h('input', {
    type: 'file', multiple: true, accept: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/flac,.mp3,.m4a,.wav,.ogg,.flac',
    class: 'visually-hidden', 'aria-label': 'Lieder hinzufügen',
    onchange: async (ev) => {
      const files = [...(ev.target.files || [])];
      ev.target.value = '';
      if (!files.length) return;
      const added = [];
      songUpload = { done: 0, total: files.length, name: files[0].name };
      renderAll(true);
      try {
        for (const file of files) {
          songUpload.name = file.name;
          const label = document.getElementById('song-progress');
          if (label) label.textContent = `Lied ${songUpload.done + 1} von ${songUpload.total}: „${file.name}“ wird hochgeladen …`;
          const type = file.type || (/\.mp3$/i.test(file.name) ? 'audio/mpeg' : /\.m4a$/i.test(file.name) ? 'audio/mp4' : '');
          const blob = type && type !== file.type ? new File([file], file.name, { type }) : file;
          const m = await uploadMedia(blob, token);
          added.push({ id: m.id, type: m.type, size: m.size, name: file.name });
          songUpload.done += 1;
        }
      } catch (err) {
        toast(err.message);
      } finally {
        songUpload = null;
        if (added.length) await act('rundown.setSongs', { stepId: st.id, songs: [...songs, ...added] });
        renderAll(true);
      }
    },
  });
  return h('div', { class: 'pause-songs' },
    h('p', { class: 'muted' }, songs.length
      ? 'Diese Lieder laufen in dieser Pause nacheinander (danach wieder von vorn). Die Band spielt im Takt der Musik.'
      : 'Noch keine eigenen Lieder – es läuft der eingebaute Pausensong.'),
    songs.length ? h('ol', { class: 'song-list' }, songs.map((m, i) => h('li', {},
      h('span', { class: 'grow' }, `♪ ${m.name}`, m.size ? h('span', { class: 'muted' }, ` · ${fmtSize(m.size)}`) : null),
      h('button', { class: 'btn small ghost', 'aria-label': 'Nach oben', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
      h('button', { class: 'btn small ghost', 'aria-label': 'Nach unten', disabled: i === songs.length - 1, onclick: () => move(i, 1) }, '↓'),
      h('button', { class: 'btn small bad', 'aria-label': `${m.name} entfernen`, onclick: () => setSongs(songs.filter((_, k) => k !== i)) }, '✕')))) : null,
    songUpload
      ? h('p', { id: 'song-progress' }, `Lied ${songUpload.done + 1} von ${songUpload.total}: „${songUpload.name}“ wird hochgeladen …`)
      : h('div', { class: 'row' },
        h('label', { class: 'btn small' }, input, '+ Lieder hinzufügen'),
        songs.length ? h('button', { class: 'btn small ghost', onclick: () => confirmAct('Alle eigenen Lieder dieser Pause entfernen? Dann läuft wieder der eingebaute Pausensong.', 'rundown.setSongs', { stepId: st.id, songs: [] }) }, 'Alle entfernen') : null),
    h('p', { class: 'muted', style: { fontSize: '0.85rem', margin: '6px 0 0' } }, 'Formate: MP3, M4A, WAV, OGG, FLAC. Mehrere Dateien auf einmal möglich.'));
}

// Bearbeiten im Show-Editor: Schritte verschieben, löschen, Pausen einfügen.
function buildRundownEditor() {
  const steps = (S.rundown || []).map(({ id, kind, pos, label, songs }) => ({ id, kind, pos, label, songs }));
  const save = (list) => act('rundown.set', { steps: list });
  const move = (i, d) => { const l = [...steps]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); save(l); };
  const insertAt = (i, st) => { const l = [...steps]; l.splice(i, 0, st); save(l); };
  const kindSel = h('select', { 'aria-label': 'Art des Schritts' },
    Object.entries(RUN_KIND_LABEL).map(([k, label]) => h('option', { value: k }, k === 'coin' ? label : `${RUN_ICON[k]} ${label}`)));
  const posSel = h('select', { 'aria-label': 'Spiel' }, S.project.games.map((g, i) => h('option', { value: String(i + 1) }, `Spiel ${i + 1} · ${g.title}`)));
  const afterSel = h('select', { 'aria-label': 'Einfügen nach' },
    h('option', { value: '0' }, 'ganz am Anfang'),
    steps.map((st, i) => h('option', { value: String(i + 1), selected: i === steps.length - 1 }, `nach ${i + 1}. ${S.rundown[i].text}`)));
  const updatePos = () => { posSel.hidden = !['title', 'game', 'coin', 'pyramid'].includes(kindSel.value); };
  kindSel.onchange = updatePos;
  kindSel.value = 'pause';
  updatePos();
  return card('Showablauf (Reihenfolge der Show)',
    h('p', { class: 'muted' }, 'So läuft die Show in der Live-Regie ab – Schritt für Schritt mit „Weiter“, wie eine Präsentation.',
      S.rundownCustom ? ' Du hast den Ablauf angepasst.' : ' Das ist der Standardablauf aus deinen Spielen.'),
    h('ol', { class: 'list rundown-list' }, S.rundown.map((st, i) => h('li', { class: `rd k-${st.kind}` },
      h('b', { class: 'rd-n' }, `${i + 1}.`),
      h('span', { class: 'rd-i', 'aria-hidden': 'true' }, runIcon(st.kind)),
      h('span', { class: 'grow' }, st.text),
      st.kind === 'pause' ? h('button', {
        class: `btn small ${openPause === st.id ? 'pink' : 'ghost'}`, 'aria-expanded': String(openPause === st.id),
        onclick: () => { openPause = openPause === st.id ? null : st.id; renderAll(true); },
      }, `♪ Lieder (${(st.songs || []).length})`) : null,
      h('button', { class: 'btn small ghost', title: 'Pause danach einfügen', onclick: () => insertAt(i + 1, { kind: 'pause' }) }, '+ ☕'),
      h('button', { class: 'btn small ghost', 'aria-label': 'Nach oben', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
      h('button', { class: 'btn small ghost', 'aria-label': 'Nach unten', disabled: i === steps.length - 1, onclick: () => move(i, 1) }, '↓'),
      h('button', { class: 'btn small bad', 'aria-label': 'Schritt entfernen', onclick: () => save(steps.filter((_, k) => k !== i)) }, '✕'),
      st.kind === 'pause' && openPause === st.id ? buildPauseSongs(st) : null))),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      kindSel, posSel, afterSel,
      h('button', { class: 'btn', onclick: () => {
        const st = { kind: kindSel.value };
        if (!posSel.hidden) st.pos = Number(posSel.value);
        if (st.kind === 'pyramid' && st.pos === undefined) delete st.pos;
        insertAt(Number(afterSel.value), st);
      } }, '+ Schritt einfügen'),
      S.rundownCustom ? h('button', { class: 'btn ghost', onclick: () => confirmAct('Eigene Änderungen am Ablauf verwerfen und den Standardablauf wiederherstellen?', 'rundown.reset') }, 'Standardablauf wiederherstellen') : null));
}

function activeGameOf() {
  return S.project.games.find((g) => g.id === S.live.activeGame) || null;
}

function buildGameControl() {
  const g = activeGameOf();
  if (!g) return card('Spielsteuerung', h('p', { class: 'muted' }, 'Kein Spiel aktiv. Der Showablauf aktiviert die Spiele; Ausnahmen ganz unten unter „Spiele (direkt aktivieren)“.'));
  const st = S.live.games[g.id] || {};
  const pos = S.project.games.indexOf(g) + 1;
  return buildPlay({ S, card, dot, act, confirmAct, teamName, teamColor }, g, st, pos);
}

// Beamer: Umschalten übernimmt der Showablauf – hier nur, was gerade läuft.
const BEAMER_VIEW_LABEL = { start: 'Startbild', video: 'Intro-Video', intro: 'Vorstellung der Teams', pyramid: 'Übersicht Kategorien', pause: 'Pause', title: 'Spieltitel', game: 'Spiel', ranking: 'Rangliste', coin: 'Münzvergabe', blank: 'Schwarz' };
function buildBeamerControls() {
  const current = S.live.beamer.view;
  const status = h('p', { class: 'muted' }, 'Zeigt jetzt: ', h('b', {}, BEAMER_VIEW_LABEL[current] || current),
    ` · ${S.connections.beamers || 0} Beamer verbunden`);
  // Adresse für das zweite Gerät an der Leinwand.
  const url = `${location.origin}${location.pathname.replace(/moderator\.html$/, '')}beamer.html`;
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const second = localServer
    ? h('p', { class: 'muted beamer-url' }, 'Im Prototyp läuft alles in diesem Browser: Vollbild über „⛶ Beamer im Vollbild“ oben auf der Seite. Für ein zweites Gerät an der Leinwand den Show-Server starten.')
    : h('div', { class: 'beamer-url' },
      h('p', { class: 'muted' }, 'Auf dem Gerät an der Leinwand öffnen, „⛶ Vollbild“ tippen:'),
      h('div', { class: 'row' }, h('code', {}, url),
        h('button', { class: 'btn small ghost', onclick: () => Promise.resolve(navigator.clipboard?.writeText(url)).then(() => toast('Adresse kopiert', 'info'), () => toast(`Adresse: ${url}`, 'info')) }, 'Kopieren')),
      local ? h('p', { class: 'notice warn' }, 'Diese Adresse zeigt auf diesen Rechner selbst. Auf dem zweiten Gerät statt „localhost“ die IP-Adresse dieses Rechners im WLAN verwenden, z. B. http://192.168.1.20:3000/beamer.html') : null);
  return [status, second];
}

// Rangliste in der Regie: Punkte nachträglich von Hand anpassen (wird protokolliert).
function buildTeamsLive() {
  const sorted = [...S.project.teams].sort((a, b) => S.totals[b.id] - S.totals[a.id]);
  const adjust = (t, points, reason = 'Manuell in der Regie') => act('points.adjust', { teamId: t.id, points, reason });
  const custom = async (t) => {
    const v = await ask(`Punkte für ${t.name} anpassen`, {
      confirmLabel: 'Buchen',
      fields: [{ name: 'points', label: 'Punkte (z. B. 3 oder -2)', type: 'number', value: '' }, { name: 'reason', label: 'Grund (optional)', value: '' }],
    });
    if (!v) return;
    const n = Number(v.points);
    if (!Number.isInteger(n) || n === 0) return toast('Bitte eine ganze Zahl ungleich 0 eingeben.');
    adjust(t, n, v.reason ? `Regie: ${v.reason}` : undefined);
  };
  return card('Rangliste (nur für dich sichtbar)',
    sorted.length ? h('ul', { class: 'list leader' }, sorted.map((t, i) => {
      const online = S.connections.teams?.[t.id];
      return h('li', {}, h('b', { class: 'rank-n' }, `${i + 1}.`), dot(t.color), h('span', { class: 'grow' }, t.name),
        h('span', { class: `badge ${online ? 'ok' : 'warn'}`, title: online ? 'iPad verbunden' : 'iPad nicht verbunden' }, online ? '●' : '○'),
        h('button', { class: 'btn small ghost pt-btn', 'aria-label': `${t.name}: 1 Punkt abziehen`, onclick: () => adjust(t, -1) }, '−1'),
        h('b', { class: 'pts' }, `${S.totals[t.id]} P.`),
        h('button', { class: 'btn small ghost pt-btn', 'aria-label': `${t.name}: 1 Punkt dazu`, onclick: () => adjust(t, 1) }, '+1'),
        h('button', { class: 'btn small ghost pt-btn', title: 'Andere Punktzahl', 'aria-label': `${t.name}: Punkte anpassen`, onclick: () => custom(t) }, '±'));
    })) : h('p', { class: 'muted' }, 'Noch keine Teams angelegt.'),
    lastManual());
}

// Letzte Handbuchung mit Rückgängig-Knopf (Gegenbuchung).
function lastManual() {
  const e = [...(S.ledger || [])].reverse().find((x) => x.ref && x.ref.startsWith('manual:') && !x.reversedBy && !x.reverses);
  if (!e) return null;
  return h('p', { class: 'muted', style: { fontSize: '0.85rem', marginTop: '8px' } }, `Zuletzt: ${teamName(e.teamId)} ${e.points > 0 ? '+' : ''}${e.points} `,
    h('button', { class: 'btn small ghost', onclick: () => act('points.undo', { entryId: e.id }) }, '↶ rückgängig'));
}

function buildCoins() {
  const w = S.live.warning;
  return card('Münzen',
    h('ul', { class: 'list' }, S.coinPositions.map((pos) => {
      const c = S.live.coins.find((x) => x.position === pos);
      if (c) return h('li', {}, coinImg(), h('span', { class: 'grow' }, `Nach Position ${pos}`), dot(teamColor(c.teamId)), h('b', {}, teamName(c.teamId)), h('span', { class: 'muted' }, `(${c.method})`));
      const tie = w?.kind === 'coinTie' && w.position === pos;
      return h('li', {}, coinImg('coin-open'), h('span', { class: 'grow' }, `Nach Position ${pos}`),
        tie
          ? w.teamIds.map((id) => h('button', { class: 'btn small', onclick: () => confirmAct(`${teamName(id)} hat die Schätzfrage gewonnen und bekommt die Münze?`, 'coin.awardTie', { teamId: id }) }, `${teamName(id)} gewinnt Schätzfrage`))
          : h('button', { class: 'btn small', onclick: () => confirmAct(`Münzgewinner nach Position ${pos} aus dem kumulierten Punktestand ermitteln?`, 'coin.determine', { position: pos }) }, 'Gewinner ermitteln'));
    })),
    h('p', { class: 'muted' }, 'Die Münze erscheint auf dem Beamer beim Schritt „Münzvergabe“ im Showablauf.'));
}

// ---------- Teams ----------

// 3D-Avatar eines Teams: steht auf dem Beamer im Bogen hinter dem Pult.
// Das Bild wird vor dem Speichern verkleinert (max. 480 px hoch).
async function shrinkImage(file) {
  if (!/^image\/(png|webp|jpeg)$/.test(file.type)) throw new Error('Bitte ein PNG-, WebP- oder JPEG-Bild wählen.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      i.src = url;
    });
    const scale = Math.min(1, 480 / img.naturalHeight, 480 / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    // WebP behält Transparenz und ist klein; Safari kann es nicht erzeugen → PNG.
    let data = c.toDataURL('image/webp', 0.86);
    if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/png');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function avatarCell(t, showId) {
  const input = h('input', {
    type: 'file', accept: 'image/png,image/webp,image/jpeg', class: 'visually-hidden', 'aria-label': `3D-Avatar für ${t.name} wählen`,
    onchange: async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        act('team.update', { showId, teamId: t.id, avatar: await shrinkImage(file) });
      } catch (err) {
        toast(err.message);
      }
    },
  });
  return h('div', { class: 'avatar-cell' },
    t.avatar ? h('img', { class: 'avatar-thumb', src: t.avatar, alt: `Avatar von ${t.name}` }) : t.hasAvatar ? h('span', { class: 'badge ok' }, '✓ Avatar') : h('span', { class: 'avatar-empty', title: 'Kein Avatar – das Pult bleibt leer' }, '–'),
    h('label', { class: 'btn small ghost' }, input, t.avatar || t.hasAvatar ? 'Ändern' : 'Avatar wählen'),
    t.avatar || t.hasAvatar ? h('button', { class: 'btn small ghost', onclick: () => act('team.update', { showId, teamId: t.id, avatar: null }) }, 'Entfernen') : null);
}

// 3D-Avatar für Moderation bzw. Co-Moderation (steht hinter dem Moderationspult; ohne Bild der Standard-Avatar)
function hostAvatarCell(label, key) {
  const cur = S.project[key];
  const input = h('input', {
    type: 'file', accept: 'image/png,image/webp,image/jpeg', class: 'visually-hidden', 'aria-label': `${label} wählen`,
    onchange: async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try { act('project.update', { [key]: await shrinkImage(file) }); } catch (err) { toast(err.message); }
    },
  });
  const def = key === 'hostAvatar' ? 'assets/img/avatar-host.webp' : 'assets/img/avatar-cohost.webp';
  return h('div', {}, h('label', {}, label), h('div', { class: 'avatar-cell' },
    h('img', { class: 'avatar-thumb', src: cur || def, alt: label }),
    h('label', { class: 'btn small ghost' }, input, cur ? 'Ändern' : 'Eigenes Bild wählen'),
    cur ? h('button', { class: 'btn small ghost', onclick: () => act('project.update', { [key]: null }) }, 'Standard-Avatar') : h('span', { class: 'muted' }, 'Standard-Avatar')));
}

// Teams je Show: Die Auswahl oben legt fest, für welche Show die Teams bearbeitet werden –
// so lassen sich mehrere Shows mit wechselnden Teams im Voraus vorbereiten.
let teamsShow = null;
function buildTeams() {
  const base = `${location.origin}${location.pathname.replace(/moderator\.html$/, '')}team.html?code=`;
  const others = S.showTeams || [];
  if (teamsShow && !others.some((x) => x.id === teamsShow)) teamsShow = null;
  const other = teamsShow ? others.find((x) => x.id === teamsShow) : null;
  const showId = other ? other.id : undefined;
  const teams = other ? other.teams : S.project.teams;
  const showName = other ? other.name : S.project.name;
  const sel = h('select', { id: 'teams-show', onchange: (ev) => { teamsShow = ev.target.value === 'current' ? null : ev.target.value; renderAll(true); } },
    h('option', { value: 'current', selected: !other }, `${S.project.name} (geöffnet)`),
    others.map((x) => h('option', { value: x.id, selected: other && other.id === x.id }, `${x.name}${x.date ? ` · ${fmtDate(x.date)}` : ''}`)));
  const allShows = [{ id: S.project.id, name: S.project.name }, ...others].filter((x) => x.id !== (other ? other.id : S.project.id));
  const copySel = h('select', { 'aria-label': 'Teams übernehmen aus' }, allShows.map((x) => h('option', { value: x.id }, x.name)));
  const hasPoints = other ? other.hasPoints : (S.ledger || []).length > 0;
  return [
    card('Teams für Show',
      h('div', { class: 'row' }, h('label', { for: 'teams-show', style: { margin: 0 } }, 'Show:'), sel),
      h('p', { class: 'muted' }, 'Jede Show hat ihre eigenen Teams mit eigenen Zugangscodes. Wähle eine Show, um ihre Teams schon vorab einzutragen – auch ohne sie zu öffnen.'),
      allShows.length ? h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Teams übernehmen aus:'), copySel,
        h('button', { class: 'btn small ghost', disabled: hasPoints, title: hasPoints ? 'Diese Show hat schon Punkte.' : '',
          onclick: () => confirmAct(`Die Teams von „${showName}“ durch die Teams der gewählten Show ersetzen? (neue Zugangscodes)`, 'teams.copyFrom', { showId: other ? other.id : S.project.id, fromShowId: copySel.value }) }, 'Übernehmen')) : null),
    card('Team anlegen',
      h('form', {
        class: 'row', onsubmit: (ev) => {
          ev.preventDefault();
          const name = ev.target.elements.name.value;
          act('team.add', { showId, name });
          ev.target.reset();
        },
      }, h('input', { name: 'name', placeholder: 'Teamname', maxlength: '40', style: { flex: '1 1 220px', width: 'auto' } }),
      h('button', { class: 'btn', type: 'submit' }, '+ Team hinzufügen')),
      h('p', { class: 'muted' }, 'Standard sind sechs Teams. Jedes Team bekommt einen kurzen Zugangscode (4 Ziffern) und einen persönlichen Link.'),
      h('p', { class: 'muted' }, '3D-Avatar: am besten ein freigestelltes PNG (transparenter Hintergrund), hochkant. Er steht auf dem Beamer im Bogen hinter dem Pult; ohne Avatar bleibt das Pult leer.')),
    card(`Teams von „${showName}“ (${teams.length})`,
      teams.length ? h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Farbe'), h('th', {}, 'Name'), h('th', {}, '3D-Avatar'), h('th', {}, 'Zugangscode / Link'), h('th', {}, ''))),
        h('tbody', {}, teams.map((t) => h('tr', {},
          h('td', {}, h('input', { type: 'color', value: t.color, 'aria-label': `Farbe ${t.name}`, style: { width: '56px', padding: '2px' }, onchange: (ev) => act('team.update', { showId, teamId: t.id, color: ev.target.value }) })),
          h('td', {}, h('input', { value: t.name, maxlength: '40', 'aria-label': 'Teamname', onchange: (ev) => act('team.update', { showId, teamId: t.id, name: ev.target.value }) })),
          h('td', {}, avatarCell(t, showId)),
          h('td', {}, h('div', { class: 'code' }, t.code),
            other ? h('span', { class: 'muted', style: { fontSize: '0.8rem' } }, 'gilt, sobald die Show geöffnet ist')
              : h('button', { class: 'btn small ghost', onclick: () => Promise.resolve(navigator.clipboard?.writeText(base + t.code)).then(() => toast('Link kopiert', 'info'), () => toast(`Kopieren nicht möglich. Link: ${base + t.code}`, 'info')) }, 'Link kopieren')),
          h('td', {}, h('div', { class: 'row' },
            h('button', { class: 'btn small ghost', onclick: () => confirmAct(`Neuen Code für ${t.name} erzeugen? Der alte Code und verbundene Geräte werden ungültig.`, 'team.regenCode', { showId, teamId: t.id }) }, 'Neuer Code'),
            h('button', { class: 'btn small bad', onclick: () => confirmAct(`Team ${t.name} löschen?`, 'team.remove', { showId, teamId: t.id }) }, 'Löschen'))))))) : h('p', { class: 'muted' }, 'Noch keine Teams.')),
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
  const field = (label, key, max) => h('div', {}, h('label', { for: `proj-${key}` }, label),
    h('input', { id: `proj-${key}`, value: p[key], maxlength: String(max), oninput: (ev) => autosave(`project.${key}`, () => act('project.update', { [key]: ev.target.value })) }));
  const check = (label, key) => h('label', { style: { fontWeight: 400 } },
    h('input', { type: 'checkbox', checked: p.settings[key], style: { width: 'auto', marginRight: '8px' }, onchange: (ev) => act('project.update', { settings: { [key]: ev.target.checked } }) }), label);

  if (!p.games.some((g) => g.id === selectedGame)) selectedGame = p.games[0]?.id || null;
  const sel = p.games.find((g) => g.id === selectedGame);

  return [
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px' } }, h('h2', { style: { margin: 0 } }, 'Show-Editor'), saveIndicator()),
    buildShows(),
    buildBoard(),
    buildIntroVideo(),
    buildRundownEditor(),
    buildFinaleEditor({ ...finaleUi(), reset: !saveState.dirty }),
    sel ? buildGameEditor('game', sel) : null,
    h('div', { class: 'grid two', style: { marginTop: '16px' } },
      card('Show', field('Showname', 'name', 80),
        h('div', {}, h('label', { for: 'show-date' }, 'Datum der Show'),
          h('input', { id: 'show-date', type: 'date', value: p.date || '', onchange: (ev) => act('project.update', { date: ev.target.value }) })),
        field('Untertitel', 'subtitle', 160), field('Moderation (Name)', 'host', 80), hostAvatarCell('Avatar Moderation', 'hostAvatar'),
        field('Co-Moderation (Name, leitet das Finale)', 'coHost', 80), hostAvatarCell('Avatar Co-Moderation', 'coHostAvatar')),
      card('Darstellung',
        check('Animationen reduzieren', 'reducedMotion'),
        check('Soundeffekte auf dem Beamer', 'sound'),
        check('Teams dürfen den Punktestand sehen (Standard: aus)', 'publicScores'),
        h('label', { for: 'show-title-dur' }, 'Dauer der Spieltitel-Animation (Sekunden)'),
        h('input', { id: 'show-title-dur', type: 'number', min: '3', max: '20', value: p.settings.titleDurationSec, onchange: (ev) => act('project.update', { settings: { titleDurationSec: Number(ev.target.value) } }) }))),
  ];
}

// Mehrere Shows: geöffnet ist immer eine, die anderen behalten Teams, Spiele und Punkte.
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

async function renameShow(s) {
  const v = await ask(`Show „${s.name}“ umbenennen`, {
    confirmLabel: 'Speichern',
    fields: [{ name: 'name', label: 'Name der Show', value: s.name, maxlength: 80 }, { name: 'date', label: 'Datum der Show (optional)', type: 'date', value: s.date }],
  });
  if (v) act('shows.rename', { showId: s.id, name: v.name, date: v.date });
}

async function createShow() {
  const v = await ask('Neue Show anlegen', {
    confirmLabel: 'Anlegen und öffnen',
    fields: [
      { name: 'name', label: 'Name der Show', value: '', maxlength: 80 },
      { name: 'date', label: 'Datum der Show (optional)', type: 'date', value: '' },
      { name: 'copyTeams', label: 'Teams aus der geöffneten Show übernehmen (gleiche Zugangscodes)', type: 'checkbox', value: true },
    ],
  });
  if (!v) return;
  act('shows.create', { name: v.name, date: v.date, copyTeams: v.copyTeams });
}

function buildShows() {
  const running = S.live.activeGame !== null;
  return card('Meine Shows',
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Jede Show hat eigene Spiele, Teams und Punkte. Bearbeitet und gespielt wird immer die geöffnete Show.'),
    h('ul', { class: 'list' }, S.shows.map((s) => h('li', { class: s.current ? 'active' : '' },
      h('span', { class: 'grow' }, h('b', {}, s.name), s.date ? h('span', { class: 'muted' }, ` · ${fmtDate(s.date)}`) : null,
        h('span', { class: 'muted' }, ` · ${s.games} Spiele · ${s.teams} Teams`)),
      s.current ? h('span', { class: 'badge ok' }, 'geöffnet')
        : h('button', { class: 'btn small', disabled: running, title: running ? 'Zuerst das laufende Spiel beenden.' : '', onclick: () => act('shows.switch', { showId: s.id }) }, 'Öffnen'),
      h('button', { class: 'btn small ghost', onclick: () => renameShow(s) }, 'Umbenennen'),
      h('button', { class: 'btn small ghost', onclick: () => act('shows.duplicate', { showId: s.id }).then((r) => r && toast(`„${s.name}“ dupliziert`, 'info')) }, 'Duplizieren'),
      s.current ? null : h('button', {
        class: 'btn small ghost icon', 'aria-label': `${s.name} löschen`,
        onclick: async () => { if (await ask(`Show „${s.name}“ mit allen Teams und Punkten löschen?`, { confirmLabel: 'Löschen', danger: true })) act('shows.remove', { showId: s.id }); },
      }, trashIcon())))),
    h('p', { style: { marginBottom: 0 } }, h('button', { class: 'btn', disabled: running, onclick: createShow }, '+ Neue Show')));
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
      S.coinPositions.includes(pos) ? h('span', { class: 'badge coin-badge' }, coinImg(), ' danach Münze') : null)),
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
      h('h3', { style: { margin: 0 } }, t.title),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '10px' } },
        t.playable ? h('span', { class: 'badge ok' }, 'spielbar') : h('span', { class: 'badge' }, 'Inhalte bearbeitbar, Spielablauf folgt'),
        h('button', { class: 'btn small', onclick: async () => { const r = await act('library.add', { type }); if (r) { selectedEntry = null; } } }, '+ Neu')),
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
    kind === 'game' ? buildGameIntro(item, pos) : null,
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
