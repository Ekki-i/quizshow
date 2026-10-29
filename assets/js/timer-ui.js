// 10-Sekunden-Timer: Anzeige auf Beamer und Team-iPads.
//
// Der Server schickt { phase, startsIn, remainingMs, id }. Daraus werden einmal
// lokale Zeitpunkte berechnet (unabhängig von der Uhr des Servers); danach zählt
// die Anzeige selbst weiter. Die Ebene liegt über der aktuellen Folie, damit sie
// beim Neuzeichnen der Seite nicht verschwindet.

import { h } from './client.js';

let layer = null;
let cur = null;
let iv = null;

// kind: 'beamer' | 'team'. hooks: onLock() beim Ablauf, onSecond(s) je Sekunde, onAnnounce().
export function syncTimer(info, kind, hooks = {}) {
  if (!layer) {
    layer = h('div', { class: `qtimer-layer ${kind}`, 'aria-live': 'assertive' });
    document.body.append(layer);
  }
  if (!info) {
    cur = null;
    layer.replaceChildren();
    document.body.classList.remove('timer-locked');
    clearInterval(iv);
    iv = null;
    return;
  }
  const now = Date.now();
  if (!cur || cur.id !== info.id) {
    cur = { id: info.id, runAt: now + info.startsIn, endAt: now + info.remainingMs, duration: info.durationMs || 10000, phase: null, sec: null, locked: false, overAt: null, hooks };
    // Schon vorbei beim ersten Empfang (z. B. Seite neu geladen): nicht nochmal ankündigen.
    if (info.phase === 'over') { cur.locked = true; cur.overAt = now - 10000; }
  } else {
    cur.hooks = hooks;
  }
  if (!iv) iv = setInterval(tick, 100);
  tick();
}

function tick() {
  if (!cur) return;
  const now = Date.now();
  const phase = now < cur.runAt ? 'announce' : now < cur.endAt ? 'run' : 'over';
  if (phase !== cur.phase) {
    cur.phase = phase;
    draw(phase);
    if (phase === 'announce') cur.hooks.onAnnounce?.();
    if (phase === 'over') {
      if (!cur.overAt) cur.overAt = now;
      document.body.classList.add('timer-locked');
      if (!cur.locked) { cur.locked = true; cur.hooks.onLock?.(); }
    } else document.body.classList.remove('timer-locked');
  }
  if (phase === 'run') {
    const left = cur.endAt - now;
    const sec = Math.ceil(left / 1000);
    const num = layer.querySelector('.qt-num');
    if (num && cur.sec !== sec) { num.textContent = String(sec); cur.sec = sec; cur.hooks.onSecond?.(sec); }
    const ring = layer.querySelector('.qt-ring');
    if (ring) ring.style.setProperty('--p', String(Math.max(0, left / cur.duration)));
    layer.querySelector('.qt-run')?.classList.toggle('hurry', sec <= 3);
  }
  if (phase === 'over') {
    // Groß „Zeit abgelaufen“, nach kurzer Zeit nur noch klein in der Ecke.
    const big = now - cur.overAt < 2600;
    const el = layer.querySelector('.qt-over');
    if (el) el.classList.toggle('small', !big);
  }
}

function draw(phase) {
  if (phase === 'announce') {
    layer.replaceChildren(h('div', { class: 'qt-announce' },
      h('div', { class: 'qt-icon' }, '⏱'),
      h('div', { class: 'qt-big' }, '10 Sekunden'),
      h('div', { class: 'qt-sub' }, 'Jetzt antworten – danach wird gesperrt!')));
  } else if (phase === 'run') {
    cur.sec = null;
    layer.replaceChildren(h('div', { class: 'qt-run' },
      h('div', { class: 'qt-ring' }, h('span', { class: 'qt-num' }, '10'))));
  } else {
    layer.replaceChildren(h('div', { class: 'qt-over' },
      h('div', { class: 'qt-big' }, '⏱ Zeit abgelaufen'),
      h('div', { class: 'qt-sub' }, 'Antworten sind gesperrt')));
  }
}
