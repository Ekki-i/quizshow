// Handschrift-Eingabe für die Team-iPads (Apple Pencil) und Anzeige der
// handschriftlichen Antworten in Moderation und Beamer.
//
// Striche werden normiert (0–1) gespeichert und bei jeder Größenänderung neu
// gezeichnet. Sobald ein Stift erkannt wurde, werden Fingerberührungen
// ignoriert (Handballen-Erkennung). Abgegeben wird ein PNG als data:-URI.

import { h } from './client.js';

// Entwürfe überleben das Neuzeichnen der Seite bei jedem Statusupdate.
const drafts = new Map();

function loadDraft(key) {
  if (drafts.has(key)) return drafts.get(key);
  let strokes = [];
  try {
    const raw = sessionStorage.getItem(`quiz.ink.${key}`);
    if (raw) strokes = JSON.parse(raw);
  } catch {
    // Kein Speicher verfügbar: Entwurf lebt nur im Speicher.
  }
  drafts.set(key, strokes);
  return strokes;
}

function saveDraft(key) {
  try {
    sessionStorage.setItem(`quiz.ink.${key}`, JSON.stringify(drafts.get(key) || []));
  } catch {
    // ignorieren
  }
}

export function clearInkDraft(key) {
  drafts.delete(key);
  try {
    sessionStorage.removeItem(`quiz.ink.${key}`);
  } catch {
    // ignorieren
  }
}

// Breite eines Strichs relativ zur Feldbreite; Druck des Stifts macht ihn dicker.
function strokeWidth(w, pressure) {
  const p = pressure > 0 ? pressure : 0.5;
  return w * (0.0045 + 0.0065 * p);
}

function drawStrokes(ctx, strokes, w, hgt, color = '#111', weight = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const s of strokes) {
    if (s.length === 1) {
      const [x, y, p] = s[0];
      ctx.beginPath();
      ctx.arc(x * w, y * hgt, (strokeWidth(w, p) * weight) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    for (let i = 1; i < s.length; i++) {
      const [x0, y0, p0] = s[i - 1];
      const [x1, y1, p1] = s[i];
      ctx.lineWidth = strokeWidth(w, (p0 + p1) / 2) * weight;
      ctx.beginPath();
      ctx.moveTo(x0 * w, y0 * hgt);
      ctx.lineTo(x1 * w, y1 * hgt);
      ctx.stroke();
    }
  }
}

// Großes Schreibfeld. onSubmit(dataUrl) wird nach Bestätigung aufgerufen und
// gibt true zurück, wenn die Abgabe geklappt hat.
export function inkPad({ draftKey, label, button, confirm, onSubmit, ask, toast }) {
  const strokes = loadDraft(draftKey);
  const canvas = h('canvas', { class: 'ink-canvas', 'aria-label': `${label} – mit dem Stift hineinschreiben`, role: 'img' });
  const hint = h('p', { class: 'ink-hint' }, 'Mit dem Apple Pencil in das weiße Feld schreiben');
  let penSeen = false;
  let current = null;
  let activeId = null;

  function size() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    redraw();
  }

  function redraw() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStrokes(ctx, strokes, canvas.width, canvas.height);
    hint.style.visibility = strokes.length ? 'hidden' : 'visible';
  }

  function point(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
    const p = ev.pointerType === 'mouse' ? 0.5 : ev.pressure || 0.5;
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000, Math.round(p * 100) / 100];
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'pen') penSeen = true;
    if (penSeen && ev.pointerType === 'touch') return; // Handballen ignorieren
    if (activeId !== null) return;
    ev.preventDefault();
    activeId = ev.pointerId;
    canvas.setPointerCapture?.(ev.pointerId);
    current = [point(ev)];
    strokes.push(current);
    redraw();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== activeId || !current) return;
    ev.preventDefault();
    const events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    for (const e of events.length ? events : [ev]) current.push(point(e));
    redraw();
  });
  const end = (ev) => {
    if (ev.pointerId !== activeId) return;
    activeId = null;
    current = null;
    saveDraft(draftKey);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  // iOS: kein Scrollen oder Zoomen beim Schreiben.
  canvas.addEventListener('touchstart', (ev) => ev.preventDefault(), { passive: false });

  new ResizeObserver(size).observe(canvas);

  function exportPng() {
    // Schwarze Schrift auf Weiß, auf den beschriebenen Bereich zugeschnitten:
    // so füllt die Handschrift auf Beamer und Laptop die Fläche.
    const W = 1200, H = 600, pad = 36;
    const full = document.createElement('canvas');
    full.width = W;
    full.height = H;
    const fctx = full.getContext('2d');
    fctx.fillStyle = '#fff';
    fctx.fillRect(0, 0, W, H);
    // Kräftiger als auf dem iPad, damit die Schrift verkleinert gut lesbar bleibt.
    drawStrokes(fctx, strokes, W, H, '#111', 1.9);
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const st of strokes) for (const [x, y] of st) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const sx = Math.max(0, Math.floor(x0 * W - pad)), sy = Math.max(0, Math.floor(y0 * H - pad));
    let sw = Math.min(W, Math.ceil(x1 * W + pad)) - sx, sh = Math.min(H, Math.ceil(y1 * H + pad)) - sy;
    // Nicht zu schmal oder zu flach werden lassen (Seitenverhältnis höchstens 4:1).
    sw = Math.max(sw, 160); sh = Math.max(sh, Math.round(sw / 4), 120);
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(full, sx, sy, Math.min(sw, W - sx), Math.min(sh, H - sy), 0, 0, Math.min(sw, W - sx), Math.min(sh, H - sy));
    return out.toDataURL('image/png');
  }

  const tools = h('div', { class: 'ink-tools' },
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { strokes.pop(); saveDraft(draftKey); redraw(); } }, '↶ Rückgängig'),
    h('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (!strokes.length) return;
      if (await ask('Alles im Schreibfeld löschen?', { confirmLabel: 'Löschen', danger: true })) { strokes.length = 0; saveDraft(draftKey); redraw(); }
    } }, '✕ Löschen'));

  const submit = h('button', { type: 'button', class: 'btn pink huge', style: { width: '100%' }, onclick: async () => {
    if (!strokes.length) return toast('Bitte zuerst eure Antwort in das Feld schreiben.');
    if (!(await ask(confirm, { confirmLabel: 'Ja, abgeben' }))) return;
    if (await onSubmit(exportPng())) clearInkDraft(draftKey);
  } }, button);

  return h('div', { class: 'ink' },
    h('div', { class: 'ink-head' }, h('span', { class: 'ink-label' }, label), tools),
    h('div', { class: 'ink-frame' }, canvas, hint),
    h('p', {}, submit));
}

// Antwort anzeigen: Handschrift als Bild, sonst Text.
export function answerContent(a, cls = '') {
  if (a && a.ink) return h('img', { class: `ink-answer ${cls}`.trim(), src: a.ink, alt: 'Handschriftliche Antwort' });
  return a ? a.text : '';
}
