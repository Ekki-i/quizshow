// Feste Audio-/Video-Elemente für den Beamer, die beim Klick auf „Ton aktivieren“
// freigeschaltet werden, plus eine Notbremse, falls der Browser Ton trotzdem blockiert.
//
// Safari erlaubt Ton nur für Medien-Elemente, die einmal während eines Klicks
// gestartet bzw. geladen wurden. Deshalb verwenden wir immer wieder dieselben
// Elemente. Blockiert der Browser dennoch, erscheint „🔊 Ton fortsetzen“ – ein
// Klick darauf startet alles Wartende mit Ton.

const pool = new Map();
const KINDS = { intro: 'video', video: 'video', film: 'video', audio: 'audio', pause: 'audio' };

// Kurze, stille WAV-Datei (0,05 s) zum Freischalten.
function silentWav() {
  const rate = 8000, n = 400;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}
let SILENT = null;

export function pooled(key) {
  let el = pool.get(key);
  if (!el) {
    el = document.createElement(KINDS[key] || 'audio');
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.playsInline = true;
    pool.set(key, el);
  }
  return el;
}

// Direkt im Klick-Handler aufrufen. Elemente, die gerade etwas geladen haben oder
// spielen, bleiben unangetastet (sonst würde z. B. das Intro-Video anhalten).
export function unlockMedia() {
  try { SILENT = SILENT || silentWav(); } catch { SILENT = null; }
  for (const key of Object.keys(KINDS)) {
    try {
      const el = pooled(key);
      if (el.getAttribute('src')) continue;
      el.muted = false;
      if (!SILENT) continue;
      el.src = SILENT;
      const done = () => {
        if (el.getAttribute('src') === SILENT) { el.pause(); el.removeAttribute('src'); }
      };
      const p = el.play();
      if (p && p.then) p.then(done, done); else done();
    } catch { /* Freischalten ist nur ein Versuch */ }
  }
  resumePending();
}

// ---------- Notbremse: Ton blockiert → Knopf „Ton fortsetzen“ ----------
const pending = new Set();
let resumeBtn = null;

function showResume() {
  if (resumeBtn) return;
  resumeBtn = document.createElement('button');
  resumeBtn.className = 'sound-resume';
  resumeBtn.type = 'button';
  resumeBtn.textContent = '🔊 Ton fortsetzen';
  resumeBtn.onclick = () => { unlockMedia(); resumePending(); };
  document.body.append(resumeBtn);
}
function resumePending() {
  for (const el of pending) {
    el.muted = false;
    el.play().catch(() => {});
  }
  pending.clear();
  if (resumeBtn) { resumeBtn.remove(); resumeBtn = null; }
}

// Mit Ton abspielen. Lehnt der Browser ab, läuft es stumm weiter (bei Videos) und
// der Knopf „Ton fortsetzen“ erscheint.
export function playWithSound(el, { mutedFallback = false } = {}) {
  const p = el.play();
  if (!p || !p.catch) return Promise.resolve();
  return p.catch((err) => {
    if (!err || err.name !== 'NotAllowedError') return;
    pending.add(el);
    showResume();
    if (mutedFallback) { el.muted = true; el.play().catch(() => {}); }
  });
}
