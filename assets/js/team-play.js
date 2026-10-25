// Team-iPad: Darstellung und Eingaben für alle acht Spiele. Die Sicht kommt
// bereits gefiltert vom Server; hier wird nichts Geheimes ausgeblendet.

import { h, run, ask, toast } from './client.js';
import { inkPad, answerContent } from './ink.js';
import { mapView } from './map.js';

const ABCD = ['A', 'B', 'C', 'D'];
const pts = (n) => `${n} ${Math.abs(n) === 1 ? 'Punkt' : 'Punkte'}`;

export function stateBox(kind, sym, text) {
  return h('div', { class: `state ${kind}`, role: 'status' }, h('span', { class: 'sym', 'aria-hidden': 'true' }, sym), text);
}

const wait = (big, small) => [h('div', { class: 'wait' }, h('p', { class: 'big' }, big), small ? h('p', { class: 'muted' }, small) : null)];
const countdown = (deadline) => h('b', { 'data-deadline': deadline }, '');

// ui: { conn, team, setDraft(key) }
export function renderPlay(p, ui) {
  const fn = { leichte5, dummes, land, kassenschlager, trumpf5, musik, jauch, nerd }[p.type];
  return fn ? fn(p, ui) : wait('Gleich geht’s los!');
}

function textForm(ui, { draftKey, label, placeholder, max, button, confirm, action, payload = (text) => ({ text }) }) {
  ui.setDraft(draftKey);
  return h('form', {
    onsubmit: async (ev) => {
      ev.preventDefault();
      const text = document.getElementById('answer').value.trim();
      if (!text) return;
      if (await run(ui.conn, action, payload(text))) ui.clearDraft();
    },
  },
  h('label', { for: 'answer' }, label),
  h('textarea', { id: 'answer', class: 'answer-box', maxlength: String(max), autocomplete: 'off', placeholder }),
  h('p', {}, h('button', { class: 'btn pink huge', type: 'submit', style: { width: '100%' } }, button)));
}

// Großes Schreibfeld für den Apple Pencil statt Tastatur.
function inkForm(ui, { draftKey, label, button, action }) {
  return inkPad({
    draftKey, label, button, ask, toast,
    onSubmit: (ink) => run(ui.conn, action, { ink }),
  });
}

function choiceButtons(options, { selected = null, correct = null, removed = [], onPick = null, disabled = false }) {
  return h('div', { class: 'abcd' }, ABCD.map((l) => {
    const cls = ['abcd-opt', l === selected ? 'selected' : '', correct && l === correct ? 'correct' : '', correct && l === selected && l !== correct ? 'wrong' : '', removed.includes(l) ? 'removed' : ''].join(' ');
    return h('button', { class: cls, disabled: disabled || removed.includes(l) || !onPick, onclick: onPick ? () => onPick(l) : null },
      h('b', {}, l), h('span', {}, removed.includes(l) ? '' : options[l]));
  }));
}

function buzzer(ui, enabled) {
  return h('button', { class: 'buzzer', disabled: !enabled, 'aria-label': 'Buzzer', onclick: () => run(ui.conn, 'play.buzz') }, 'BUZZ');
}

function buzzState(b, { correct = 'Richtig!', locked = 'Falsch – für diese Aufgabe gesperrt', resolved = 'Aufgabe beendet' } = {}) {
  if (b.ownStatus === 'correct') return stateBox('ok', '✓', correct);
  if (b.locked) return stateBox('bad', '✗', locked);
  if (b.answering) return stateBox('', '🎤', 'Ihr seid dran – antwortet laut!');
  if (b.buzzed) return stateBox('', '⏳', 'Gebuzzert – ihr seid in der Warteschlange');
  if (b.resolved) return stateBox('', '■', resolved);
  return null;
}

// ---------- 1 · Die leichten 5 ----------

function leichte5(g, ui) {
  if (!g.question) return wait(`Frage ${g.qIndex + 1} kommt gleich …`);
  const out = [h('p', { class: 'muted' }, `Frage ${g.qIndex + 1} von ${g.count}`), h('p', { class: 'question' }, g.question)];
  if (g.answer) {
    out.push(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Eure Antwort'), h('div', { style: { fontSize: '1.6rem', margin: 0 } }, answerContent(g.answer))));
    if (g.answer.grade === true) out.push(stateBox('ok', '✓', 'Richtig! +1 Punkt'));
    else if (g.answer.grade === false) out.push(stateBox('bad', '✗', 'Leider falsch'));
    else out.push(stateBox('', '🔒', 'Abgegeben und gesperrt – wartet auf die Bewertung'));
    return out;
  }
  if (!g.open) return [...out, stateBox('', '🔒', 'Gesperrt – keine Abgabe mehr möglich')];
  out.push(inkForm(ui, {
    draftKey: `g1.${g.qIndex}`, label: 'Eure Antwort', button: 'Abgeben', action: 'play.submit',
  }));
  return out;
}

// ---------- 2 · Dumm ist der, der Dummes kriegt ----------

function dummes(g, ui) {
  const out = [h('p', { class: 'muted' }, `Frage ${g.qIndex + 1} von ${g.count}`), h('p', { class: 'question' }, g.question)];
  if (g.evaluated) {
    out.push(choiceButtons(g.options, { selected: g.final, correct: g.correct }));
    if (g.swappedWith) out.push(stateBox('', '🔁', `Getauscht mit ${g.swappedWith}: eure Antwort war ${g.choice}, jetzt zählt ${g.final}.`));
    if (!g.final) out.push(stateBox('', '–', 'Keine Antwort abgegeben'));
    else out.push(g.final === g.correct ? stateBox('ok', '✓', 'Richtig! +1 Punkt') : stateBox('bad', '✗', `Leider falsch – richtig ist ${g.correct}`));
    return out;
  }
  const canAnswer = g.open && !g.choice && !g.tooLate;
  out.push(choiceButtons(g.options, {
    selected: g.choice,
    disabled: !canAnswer,
    onPick: canAnswer ? async (l) => {
      run(ui.conn, 'play.answer', { choice: l }); // sofort absenden, ohne Rückfrage
    } : null,
  }));
  if (!g.choice) {
    if (g.tooLate) out.push(stateBox('bad', '⏱', 'Die 10 Sekunden sind vorbei. Die Moderation kann euch noch einmal freigeben.'));
    else if (g.buzzTaken && g.windowEnds) out.push(stateBox('', '⏱', h('span', {}, 'Ein Team hat gebuzzert – noch ', countdown(g.windowEnds), ' zum Abgeben!')));
    else if (!g.open) out.push(stateBox('', '🔒', 'Abgabe geschlossen'));
    return out;
  }
  if (g.swapTargets) {
    out.push(stateBox('ok', '🔔', 'Ihr wart am schnellsten! Mit wem tauscht ihr eure Antwort?'));
    out.push(h('div', { class: 'row' }, g.swapTargets.map((t) => h('button', {
      class: 'btn huge', onclick: async () => {
        run(ui.conn, 'play.swap', { teamId: t.id }); // sofort, ohne Rückfrage
      },
    }, t.name))));
    return out;
  }
  if (g.swapDone) return [...out, stateBox('ok', '🔁', 'Tausch erledigt – gleich wird aufgelöst.')];
  if (g.swapWaiting) return [...out, stateBox('ok', '🔔', h('span', {}, 'Ihr wart am schnellsten! Gleich dürft ihr tauschen … ', g.windowEnds ? countdown(g.windowEnds) : null))];
  out.push(stateBox('', '🔒', `Antwort ${g.choice} gesperrt`));
  if (!g.buzzTaken) out.push(h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Wer zuerst buzzert, darf seine Antwort mit einem anderen Team tauschen.'), buzzer(ui, g.canBuzz));
  else if (g.buzzTaken && !g.isBuzzer) out.push(h('p', { class: 'muted' }, 'Ein anderes Team war schneller am Buzzer.'));
  return out;
}

// ---------- 3 · Ich sehe ein Land, das du nicht siehst ----------

let landPending = null;

function land(g, ui) {
  if (g.taskIndex < 0) return wait('Gleich geht’s los!', `Karte: ${g.map}`);
  const out = [h('p', { class: 'muted' }, `Aufgabe ${g.taskIndex + 1} von ${g.count} · Karte: ${g.map}`), h('p', { class: 'question' }, g.question)];
  const key = `${g.taskIndex}`;
  if (landPending?.key !== key || g.own) landPending = null;
  const markers = [];
  if (g.guesses) {
    for (const x of g.guesses) markers.push({ lat: x.lat, lng: x.lng, color: ui.teamColor(x.teamId), label: ui.teamName(x.teamId), showLabel: true });
  } else if (g.own) {
    markers.push({ lat: g.own.lat, lng: g.own.lng, color: ui.team.color, label: 'Euer Punkt' });
  }
  if (g.target) markers.push({ lat: g.target.lat, lng: g.target.lng, kind: 'target', label: g.target.name });
  const canPick = g.open && !g.own;
  const box = h('div', { class: 'map-box' });
  const draw = () => box.replaceChildren(mapView(g.map, {
    markers: [...markers, ...(landPending ? [{ ...landPending, color: ui.team.color, kind: 'pending', label: 'Euer Tipp' }] : [])],
    onPick: canPick ? (pt) => {
      landPending = { ...pt, key };
      draw();
      send.disabled = false;
    } : null,
    label: `Karte ${g.map}`,
  }));
  const send = h('button', {
    class: 'btn pink huge', style: { width: '100%' }, disabled: !landPending,
    onclick: async () => {
      if (!landPending) return;
      if (await run(ui.conn, 'play.guess', { lat: landPending.lat, lng: landPending.lng })) landPending = null;
    },
  }, 'Punkt sperren');
  draw();
  out.push(box);
  if (canPick) out.push(h('p', { class: 'muted' }, 'Tippt auf die Karte, um euren Punkt zu setzen. Ihr könnt ihn verschieben, bis ihr sperrt.'), send);
  else if (g.target) {
    const own = g.guesses?.find((x) => x.teamId === ui.team.id);
    out.push(g.winners.includes(ui.team.id) ? stateBox('ok', '✓', `Am nächsten dran! +1 Punkt${own ? ` (${own.km.toLocaleString('de-DE')} km)` : ''}`)
      : stateBox('', '📍', `${g.target.name}${own ? ` – ihr wart ${own.km.toLocaleString('de-DE')} km entfernt` : ''}`));
  } else if (g.own) out.push(stateBox('', '🔒', 'Punkt gesperrt – wartet auf die Auflösung'));
  else out.push(stateBox('', '🔒', 'Abgabe geschlossen'));
  return out;
}

// ---------- 4 · Das ist ein echter Kassenschlager ----------

function kassenschlager(g, ui) {
  const money = h('span', { class: 'wallet' }, `${g.wallet} $`);
  const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'muted' }, g.movieIndex >= 0 ? `Film ${g.movieIndex + 1} von ${g.movieCount} · Zyklus ${g.cycle} von 4` : 'Kassenschlager'), h('span', {}, 'Guthaben ', money));
  if (g.converted) return [head, stateBox('ok', '💰', `${g.converted.money} $ wurden zu ${pts(g.converted.points)}.`)];
  if (g.out) return [head, stateBox('bad', '✗', 'Ihr habt 0 $ und seid für die restlichen Filme ausgeschieden.')];
  if (g.movieIndex < 0) return [head, ...wait('Gleich geht’s los!', 'Ihr startet mit 20 $. Pro Film könnt ihr bis zu 4 Hinweise kaufen.')];
  if (!g.playing) return [head, ...wait('Dieser Film läuft ohne euch.')];
  const out = [head];
  if (g.finished) out.push(h('p', { class: 'question' }, `Der Film war: ${g.title}`));
  if (g.solved) out.push(stateBox('ok', '✓', 'Richtig! +5 $ – für diesen Film seid ihr fertig.'));
  else if (g.lastAnswer?.grade === false) {
    out.push(stateBox('bad', '✗', g.lastAnswer.ink ? 'Eure Antwort war leider falsch.' : `„${g.lastAnswer.text}“ war leider falsch.`));
    if (g.lastAnswer.ink) out.push(answerContent(g.lastAnswer, 'small'));
  }
  const buying = g.myTurn && g.phase === 'buy';
  const left = g.maxBuys - g.boughtCount;
  out.push(h('p', { class: 'muted' }, `Paywall · ${g.boughtCount} von ${g.maxBuys} Hinweisen gekauft`));
  out.push(h('div', { class: 'paywall' }, g.hints.map((x, i) => {
    const affordable = x.price <= g.wallet && left > 0;
    return h('button', {
      class: `hint ${x.bought ? 'bought' : ''}`,
      disabled: x.bought || !buying || !affordable,
      onclick: async () => {
        const msg = `Möchtest du diesen Hinweis kaufen?\n${x.label} kostet ${x.price} $. Danach habt ihr noch ${g.wallet - x.price} $.`;
        if (await ask(msg, { confirmLabel: 'Ja, kaufen', cancelLabel: 'Abbrechen' })) run(ui.conn, 'play.buy', { hint: i });
      },
    }, h('span', { class: 'price' }, `${x.price} $`), h('span', { class: 'label' }, `${i + 1}. ${x.label}`), x.bought ? h('span', { class: 'text' }, x.text || '–') : null);
  })));
  if (g.finished || g.solved) return out;
  if (!g.myTurn) out.push(stateBox('', '⏳', g.turnTeam ? `${g.turnTeam} ist am Zug.` : 'Gleich geht’s weiter.'));
  else if (g.phase === 'buy') out.push(stateBox('ok', '👉', 'Ihr seid dran: Kauft einen Hinweis.'));
  else if (g.phase === 'grading') out.push(stateBox('', '🔒', 'Antwort abgegeben – die Moderation prüft.'));
  else {
    out.push(stateBox('ok', '✍', 'Ihr seid dran: Schreibt den Filmtitel.'));
    out.push(inkForm(ui, {
      draftKey: `kassen.${g.movieIndex}.${g.cycle}`, label: 'Filmtitel', button: 'Antwort abgeben', action: 'play.answer',
    }));
  }
  return out;
}

// ---------- 5 · 5 ist Trümpf ----------

function trumpf5(g, ui) {
  const out = [
    h('p', { class: 'muted' }, `Begriff ${g.termIndex + 1} von 5 · Kategorie`),
    h('p', { class: 'question' }, g.category),
    g.hints.length ? h('ol', { class: 'hint-list' }, g.hints.map((t, i) => h('li', {}, h('b', {}, `${i + 1}. `), t))) : h('p', { class: 'muted' }, 'Noch kein Hinweis freigegeben.'),
    buzzer(ui, g.canBuzz),
  ];
  const s = buzzState(g, { locked: 'Falsch – für diesen Begriff gesperrt', resolved: 'Begriff beendet' });
  if (s) out.push(s);
  return out;
}

// ---------- 6 · Musikquiz ----------

function board(b, ui, current) {
  return h('div', { class: 'jeopardy small' }, b.map((cat, c) => h('div', { class: 'col' },
    h('div', { class: 'cat' }, cat.name || `Kategorie ${c + 1}`),
    cat.fields.map((f, i) => h('div', { class: `cell ${f.played ? 'played' : ''} ${current === `${c}-${i}` ? 'current' : ''}`, style: f.winner ? { borderColor: ui.teamColor(f.winner) } : null }, f.played ? '' : String(f.value))))));
}

function musik(g, ui) {
  const c = g.current;
  if (!c || c.resolved) {
    return [h('p', { class: 'muted' }, 'Musikquiz · Das nächste Team wählt ein Feld'), board(g.board, ui, null), c?.ownStatus === 'correct' ? stateBox('ok', '✓', 'Richtig!') : null];
  }
  const out = [h('p', { class: 'muted' }, `${c.category} · ${pts(c.value)}`)];
  if (c.mashup) out.push(h('p', {}, h('span', { class: 'badge warn' }, 'Song Song Song: beide Titel nennen')));
  if (c.task) out.push(h('p', { class: 'question' }, c.task));
  out.push(buzzer(ui, c.canBuzz));
  if (!c.started) out.push(stateBox('', '⏳', 'Gleich startet die Aufgabe …'));
  const s = buzzState(c);
  if (s) out.push(s);
  return out;
}

// ---------- 7 · Ein Hauch von Günther Jauch ----------

function ladder(g) {
  return h('div', { class: 'ladder' }, g.ladder.map((v, i) => h('span', { class: `step ${i === g.qIndex ? 'current' : ''} ${i === 3 ? 'safe' : ''}` }, `${i + 1}: ${v} P`)));
}

function jauch(g, ui) {
  const status = `Gesichert: ${pts(g.secured)}`;
  if (g.status === 'out') return [ladder(g), stateBox('bad', '✗', `Ausgeschieden bei Frage ${g.outAt}. Ihr behaltet ${pts(g.secured)}.`)];
  if (g.status === 'quit') return [ladder(g), stateBox('ok', '🏁', `Ausgestiegen nach Frage ${g.outAt}. ${status}.`)];
  if (g.status === 'done') return [ladder(g), stateBox('ok', '🏆', `Alle acht Fragen geschafft! ${pts(g.secured)}.`)];
  if (g.qIndex < 0) return [ladder(g), ...wait('Gleich geht’s los!', 'Ihr habt einen 50:50-Joker und einen Telefonjoker.')];
  const out = [ladder(g), h('p', { class: 'muted' }, `Frage ${g.qIndex + 1} · ${pts(g.value)} · ${status}`), h('p', { class: 'question' }, g.question)];
  const phoneWait = g.phone?.waiting;
  const canAnswer = g.open && !g.choice && !phoneWait;
  out.push(choiceButtons(g.options, {
    selected: g.choice, correct: g.correct, removed: g.removed, disabled: !canAnswer,
    onPick: canAnswer ? async (l) => {
      run(ui.conn, 'play.answer', { choice: l }); // sofort absenden, ohne Rückfrage
    } : null,
  }));
  if (g.revealed) {
    out.push(g.choice === g.correct ? stateBox('ok', '✓', `Richtig! ${status}.`) : stateBox('bad', '✗', `Falsch – richtig ist ${g.correct}.`));
    if (g.canQuit) {
      out.push(h('button', {
        class: 'btn ghost huge', style: { width: '100%' },
        onclick: async () => {
          run(ui.conn, 'play.quit'); // sofort, ohne Rückfrage
        },
      }, `Aussteigen und ${pts(g.secured)} sichern`));
    }
    return out;
  }
  if (phoneWait) out.push(stateBox('', '📞', 'Telefonjoker: Wartet, bis alle anderen Teams gesperrt haben. Dann telefoniert ihr und gebt eure Antwort ab.'));
  else if (g.phone) out.push(stateBox('ok', '📞', 'Alle anderen haben gesperrt – jetzt telefonieren und dann antworten!'));
  else if (g.choice) out.push(stateBox('', '🔒', `Antwort ${g.choice} gesperrt – wartet auf die Auflösung.`));
  if (g.open && !g.choice && !g.phone) {
    const jokerBtn = (kind, label) => h('button', {
      class: 'btn', disabled: !g.jokers[kind] || g.jokerBlocked || g.removed.length > 0,
      onclick: async () => {
        run(ui.conn, 'play.joker', { kind }); // sofort, ohne Rückfrage
      },
    }, label);
    out.push(h('div', { class: 'row', style: { marginTop: '12px' } }, jokerBtn('fifty', '50:50-Joker'), jokerBtn('phone', '📞 Telefonjoker'),
      g.jokerBlocked ? h('span', { class: 'muted' }, 'In dieser Frage hat schon ein Team einen Joker genommen.') : null));
  }
  return out;
}

// ---------- 8 · Wer nix werd, werd Nerd ----------

function nerd(g, ui) {
  const out = [h('p', { class: 'muted' }, `${g.finale ? '★ Große Finalkategorie' : `Kategorie ${g.catIndex + 1} von ${g.count}`}`), h('p', { class: 'question' }, g.category)];
  if (g.phase === 'bidding') {
    if (!g.canBid) return [...out, stateBox('', '🔒', `Euer Gebot: ${g.ownBid} – wartet, bis alle Gebote aufgedeckt werden.`)];
    const input = h('input', { id: 'bid', type: 'number', min: '1', max: String(g.maxBid), inputmode: 'numeric', class: 'bid-input', 'aria-label': 'Gebot' });
    out.push(h('p', {}, 'Wie viele richtige Antworten traut ihr euch zu? Das Gebot bleibt geheim, bis alle aufgedeckt werden.'));
    out.push(h('form', {
      class: 'row',
      onsubmit: async (ev) => {
        ev.preventDefault();
        const bid = Number(input.value);
        if (!Number.isInteger(bid) || bid < 1) return;
        run(ui.conn, 'play.bid', { bid }); // sofort absenden, ohne Rückfrage
      },
    }, input, h('button', { class: 'btn pink huge', type: 'submit' }, 'Gebot abgeben')));
    return out;
  }
  if (g.bids) out.push(h('ul', { class: 'list' }, g.bids.map((b) => h('li', {}, h('span', { class: 'dot', style: { background: ui.teamColor(b.teamId) } }), h('span', { class: 'grow' }, ui.teamName(b.teamId)), h('b', {}, b.bid)))));
  if (g.phase === 'choose') out.push(stateBox('', '⚖', 'Gleichstand – die Moderation entscheidet, wer beginnt.'));
  const a = g.attempt;
  if (a) {
    const mine = a.teamId === ui.team.id;
    const who = ui.teamName(a.teamId);
    let text;
    if (a.done === 'success') text = mine ? 'Geschafft!' : `${who} hat es geschafft.`;
    else if (a.done === 'fail') text = mine ? 'Leider gescheitert.' : `${who} ist gescheitert.`;
    else text = `${mine ? 'Ihr seid dran' : `${who} ist dran`} – Ziel ${a.target}: ${a.correct} richtig, ${a.errors} von ${a.maxErrors} Fehlern`;
    out.push(stateBox(mine && !a.done ? 'ok' : '', mine ? '🎤' : '👀', text));
    if (a.named.length) out.push(h('p', { class: 'muted' }, `Genannt: ${a.named.join(', ')}`));
  }
  const res = g.results.find((r) => r.teamId === ui.team.id);
  if (res) out.push(stateBox(res.success ? 'ok' : 'bad', res.success ? '✓' : '✗', `${res.points > 0 ? '+' : ''}${pts(res.points)}`));
  return out;
}
