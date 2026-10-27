// Kartenansicht für „Ich sehe ein Land, das du nicht siehst“: Länderumrisse als
// SVG, Teampunkte und Zielort als Markierungen. Mit onPick wird die Karte
// antippbar und liefert Breiten- und Längengrad zurück.

import { MAPS } from './map-data.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

export function project(m, lat, lng) {
  let lon = lng;
  if (lon < m.lonMin) lon += 360;
  return [((lon - m.lonMin) / (m.lonMax - m.lonMin)) * m.width, ((m.latMax - lat) / (m.latMax - m.latMin)) * m.height];
}

export function unproject(m, x, y) {
  let lng = m.lonMin + (x / m.width) * (m.lonMax - m.lonMin);
  if (lng > 180) lng -= 360;
  const lat = m.latMax - (y / m.height) * (m.latMax - m.latMin);
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}

// markers: [{ lat, lng, color, label, kind: 'team' | 'target' | 'pending' }]
// area: Umriss eines gesuchten Landes, Ringe aus [lng, lat] – wird hervorgehoben.
export function mapView(name, { markers = [], onPick = null, label = 'Karte', area = null } = {}) {
  const m = MAPS[name] || MAPS.Welt;
  const r = m.width / 90;
  const svg = el('svg', { viewBox: `0 0 ${m.width} ${m.height}`, class: `map${onPick ? ' pickable' : ''}`, role: 'img', 'aria-label': label });
  svg.append(el('rect', { x: 0, y: 0, width: m.width, height: m.height, class: 'sea' }));
  svg.append(el('g', { class: `land${m.highlight !== undefined ? ' has-hl' : ''}` }, ...m.paths.map((d, i) => el('path', { d, class: i === m.highlight ? 'hl' : null }))));
  if (area && area.length) {
    const d = area.map((ring) => ring.map(([lng, lat], i) => { const [x, y] = project(m, lat, lng); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join('') + 'Z').join('');
    svg.append(el('path', { d, class: 'target-area' }));
  }
  for (const mk of markers) {
    const [x, y] = project(m, mk.lat, mk.lng);
    const title = mk.label ? el('title') : null;
    if (title) title.textContent = mk.label;
    if (mk.kind === 'target') {
      svg.append(el('g', { class: 'target', transform: `translate(${x} ${y})` },
        el('circle', { r: r * 2.2, class: 'ring' }),
        el('path', { d: `M${-r} ${-r}L${r} ${r}M${-r} ${r}L${r} ${-r}`, class: 'cross' }), title));
      continue;
    }
    const g = el('g', { class: `pin ${mk.kind || 'team'}`, transform: `translate(${x} ${y})` },
      el('circle', { r, fill: mk.color || '#fff' }), title);
    if (mk.label && mk.showLabel) {
      const t = el('text', { x: r * 1.4, y: r * 0.45, class: 'pin-label' });
      t.textContent = mk.label;
      g.append(t);
    }
    svg.append(g);
  }
  if (onPick) {
    svg.addEventListener('click', (ev) => {
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (p.x < 0 || p.y < 0 || p.x > m.width || p.y > m.height) return;
      onPick(unproject(m, p.x, p.y));
    });
  }
  return svg;
}
