// Feste Audio-/Video-Elemente für den Beamer, die beim Klick auf „Ton aktivieren“
// freigeschaltet werden.
//
// Safari erlaubt Ton nur für Medien-Elemente, die einmal während eines Klicks
// gestartet wurden. Neu erzeugte Elemente (z. B. für jedes Intro-Lied) bleiben dort
// stumm – deshalb lief der Ton nur beim ersten Mal. Wir schalten beim Klick einen
// festen Satz Elemente frei und verwenden immer wieder dieselben.

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

// Muss direkt im Klick-Handler aufgerufen werden (ohne vorheriges await).
export function unlockMedia() {
  SILENT = SILENT || silentWav();
  for (const key of Object.keys(KINDS)) {
    const el = pooled(key);
    if (el.getAttribute('src') && !el.paused) continue; // läuft schon (z. B. Intro gerade gestartet)
    const hadSrc = el.getAttribute('src');
    el.muted = false;
    if (hadSrc) {
      // Schon geladen, aber angehalten: im Klick kurz starten und sofort wieder anhalten.
      const t = el.currentTime;
      el.play().catch(() => {});
      el.pause();
      el.currentTime = t;
      continue;
    }
    el.src = SILENT;
    const p = el.play();
    const done = () => {
      if (el.getAttribute('src') === SILENT) { el.pause(); el.removeAttribute('src'); el.load(); }
    };
    if (p && p.then) p.then(done, done); else done();
  }
}
