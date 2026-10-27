// Erzeugt server/countries.js: Ländergrenzen (Natural Earth 1:50 Mio., gemeinfrei)
// mit deutschen Namen, für „Ich sehe ein Land“ im Modus „Ganzes Land“.
// Aufruf: node scripts/build-countries.mjs <pfad>/ne_50m_admin_0_countries.geojson
// (Datei aus github.com/nvkelso/natural-earth-vector, Ordner geojson)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) { console.error('Pfad zur GeoJSON-Datei fehlt.'); process.exit(1); }
const geo = JSON.parse(fs.readFileSync(src, 'utf8'));

const TOL = 0.03; // Grad (≈ 3 km): reicht für faire Treffer, hält die Datei klein
const r3 = (v) => Math.round(v * 100) / 100; // 0,01° ≈ 1 km

// Douglas-Peucker für einen Ring. Geschlossene Ringe (erster = letzter Punkt) werden am
// weitesten entfernten Punkt geteilt, sonst bliebe nur der Startpunkt übrig.
function simplify(pts, tol) {
  const n = pts.length;
  if (n >= 5 && pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1]) {
    let far = 1, fd = -1;
    for (let i = 1; i < n - 1; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
    const a = dp(pts.slice(0, far + 1), tol), b = dp(pts.slice(far), tol);
    return a.concat(b.slice(1));
  }
  return dp(pts, tol);
}
function dp(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const out = [];
for (const f of geo.features) {
  const p = f.properties;
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const cleaned = polys.map((poly) => poly.map((ring) => {
    const s = simplify(ring, TOL).map(([x, y]) => [r3(x), r3(y)]);
    if (s.length >= 4) return s;
    const step = Math.max(1, Math.floor(ring.length / 8));
    return ring.filter((_, i) => i % step === 0 || i === ring.length - 1).map(([x, y]) => [r3(x), r3(y)]);
  }));
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const poly of cleaned) for (const [x, y] of poly[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  // Grober Umriss nur zum Einzeichnen (äußere Ringe, ≈ 10 km genau) und Beschriftungspunkt
  // in der Mitte des größten Teils.
  const draw = polys.map((poly) => simplify(poly[0], 0.08).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])).filter((r) => r.length >= 4);
  let big = cleaned[0][0], bigA = -1;
  for (const poly of cleaned) {
    const xs = poly[0].map((q) => q[0]), ys = poly[0].map((q) => q[1]);
    const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (a > bigA) { bigA = a; big = poly[0]; }
  }
  const bx = big.map((q) => q[0]), by = big.map((q) => q[1]);
  const label = [r3((Math.min(...bx) + Math.max(...bx)) / 2), r3((Math.min(...by) + Math.max(...by)) / 2)];
  out.push({ code: p.ADM0_A3, name: p.NAME_DE || p.NAME, bbox: [minX, minY, maxX, maxY], label, polys: cleaned, draw: draw.length ? draw : cleaned.map((poly) => poly[0]) });
}
out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
const file = path.join(ROOT, 'server', 'countries.js');
fs.writeFileSync(file, `'use strict';\n// Automatisch erzeugt von scripts/build-countries.mjs – nicht von Hand ändern.\n// Ländergrenzen: Natural Earth 1:50 Mio. (gemeinfrei), deutsche Namen aus NAME_DE.\nmodule.exports = ${JSON.stringify(out)};\n`);
console.log(out.length, 'Länder,', Math.round(fs.statSync(file).size / 1024), 'KB');
