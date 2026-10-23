// Gemeinsame Client-Funktionen: WebSocket mit automatischer Wiederverbindung,
// Aktionen mit eindeutiger ID (Idempotenz) und kleine DOM-Helfer.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k.startsWith('--')) el.style.setProperty(k, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function toast(message, kind = 'error') {
  const el = h('div', { class: `toast ${kind === 'info' ? 'info' : ''}`, role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
}

// Verbindet sich mit dem Server und hält die Verbindung. hello liefert die
// Anmeldedaten; onState wird bei jedem neuen Zustand aufgerufen.
export function connect({ hello, onState, onAuthFailed, onKicked, quiet = false }) {
  const pending = new Map();
  let ws;
  let retry = 0;
  let stopped = false;
  const badge = h('span', { class: 'badge conn', 'aria-live': 'polite' }, 'Verbinde …');
  if (!quiet) document.body.append(badge);

  function setStatus(ok, text) {
    badge.className = `badge conn ${ok ? 'ok' : 'warn'}`;
    badge.textContent = `${ok ? '●' : '○'} ${text}`;
  }

  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ type: 'hello', ...hello() }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'welcome') setStatus(true, 'Verbunden');
      if (msg.type === 'state') onState(msg.state, msg.serverTime);
      if (msg.type === 'ack') {
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          msg.ok ? p.resolve(msg) : p.reject(new Error(msg.error));
        }
      }
      if (msg.type === 'auth-failed') {
        stopped = true;
        setStatus(false, 'Nicht angemeldet');
        onAuthFailed?.(msg.message);
      }
      if (msg.type === 'kicked') {
        stopped = true;
        setStatus(false, 'Getrennt');
        onKicked?.(msg.message);
      }
    };
    ws.onclose = () => {
      if (stopped) return;
      setStatus(false, 'Verbindung unterbrochen – verbinde neu …');
      // Offene Aktionen werden mit derselben ID erneut gesendet; der Server
      // verarbeitet jede ID nur einmal.
      setTimeout(open, Math.min(5000, 500 * 2 ** retry++));
    };
  }

  function send(id, name, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'action', id, name, payload }));
  }

  // Aktion senden; wiederholt sich bei Verbindungsabbruch, bis eine Antwort kommt.
  function action(name, payload = {}) {
    const id = uuid();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      send(id, name, payload);
      const timer = setInterval(() => {
        if (!pending.has(id)) return clearInterval(timer);
        send(id, name, payload);
      }, 3000);
    });
  }

  open();
  return { action };
}

// Aktion ausführen und Fehler verständlich anzeigen.
export async function run(conn, name, payload) {
  try {
    return await conn.action(name, payload);
  } catch (err) {
    toast(err.message || 'Aktion fehlgeschlagen.');
    return null;
  }
}
