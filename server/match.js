'use strict';

// Gemeinsame Hilfen für die neuen Spielmodule: tolerante Textvergleiche
// (Top-100-Listen, „Host du das Zeug dafür?“) und eine stabile Mischfunktion.

// Groß-/Kleinschreibung, Akzente, Satzzeichen, Bindestriche und ß egal.
function norm(s) {
  return String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/&/g, ' und ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Zusätzlich führende Artikel weglassen („Die Ärzte“ = „Ärzte“, „The Beatles“ = „Beatles“).
const ARTICLES = /^(der|die|das|den|dem|des|ein|eine|einen|the|a|an|le|la|les|l|el|il|lo|los|las)\s+/;
function core(s) {
  const n = norm(s);
  const stripped = n.replace(ARTICLES, '');
  return stripped || n;
}

// Levenshtein-Abstand (abgebrochen bei großen Längenunterschieden).
function lev(a, b, cap = 4) {
  if (Math.abs(a.length - b.length) > cap) return 99;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

// Erlaubte Tippfehler je nach Länge: kurze Wörter müssen exakt sein.
const tolerance = (len) => (len >= 10 ? 2 : len >= 5 ? 1 : 0);

// Vergleicht eine Eingabe mit Kandidaten [{ key, variants: [...] }].
// Ergebnis: { sure: key } bei eindeutigem Treffer (exakt oder ein eindeutiger
// kleiner Tippfehler), { suggest: key } bei unsicherem Treffer (z. B. Teil des
// Namens oder größerer Abstand) – den entscheidet die Moderation – sonst {}.
function matchEntry(input, candidates) {
  const n = core(input);
  if (!n) return {};
  const exact = candidates.filter((c) => c.variants.some((v) => core(v) === n));
  if (exact.length === 1) return { sure: exact[0].key };
  if (exact.length > 1) return { suggest: exact[0].key, ambiguous: exact.map((c) => c.key) };
  const scored = candidates.map((c) => ({ key: c.key, d: Math.min(...c.variants.map((v) => lev(core(v), n))) }))
    .filter((x) => x.d < 99).sort((a, b) => a.d - b.d);
  const best = scored[0];
  const second = scored[1];
  if (best && best.d <= tolerance(n.length) && (!second || second.d > best.d)) return { sure: best.key };
  if (best && best.d <= tolerance(n.length) + 2 && n.length >= 4) return { suggest: best.key };
  // Teilwort-Treffer („Bayern“ ↔ „FC Bayern München“) nur als Vorschlag.
  if (n.length >= 4) {
    const part = candidates.find((c) => c.variants.some((v) => { const cv = core(v); return cv.includes(n) || (cv.length >= 4 && n.includes(cv)); }));
    if (part) return { suggest: part.key };
  }
  return {};
}

// Stabile Zufallsreihenfolge (gleiche Reihenfolge nach Neuladen), aus einem Text-Schlüssel.
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function shuffled(arr, seed) {
  const rnd = seeded(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sortierwert aus „1999“, „2001-09-11“, „09/2001“, „11.09.2001“ oder einer Zahl.
function sortValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(-?\d{1,4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3] || 0);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(-?\d{1,4})$/);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = s.match(/^(\d{1,2})[./](-?\d{1,4})$/);
  if (m) return Number(m[2]) * 10000 + Number(m[1]) * 100;
  m = s.match(/^-?\d{1,4}$/);
  if (m) return Number(s) * 10000;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

module.exports = { norm, core, lev, matchEntry, shuffled, sortValue };
