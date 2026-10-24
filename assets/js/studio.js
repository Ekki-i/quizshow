// Teampulte für den Beamer, gezeichnet im Stil der Show-Vorlage:
// dunkler Bogen mit Neonringen in Teamfarbe, gestreiftes Pult mit
// Farbpaneel und schwarzem Punktefeld. Der 3D-Avatar des Teams steht im
// Bogen hinter dem Pult; ohne Avatar bleibt das Pult leer.

import { h } from './client.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function el(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

const UNIT = 200; // Breite je Pult im SVG
const VIEW_H = 330;

// opts: { points: bool, winnerId, banner: Node }
export function podiumRow(teams, opts = {}) {
  const id = `pod${++uid}`;
  const n = Math.max(1, teams.length);
  const svg = el('svg', { class: 'podiums', viewBox: `0 -6 ${n * UNIT} ${VIEW_H}`, role: 'img', 'aria-label': `Teampulte: ${teams.map((t) => t.name).join(', ')}` });
  const defs = el('defs');
  defs.append(
    Object.assign(el('linearGradient', { id: `${id}-frame`, x1: 0, y1: 0, x2: 0, y2: 1 }), {}),
    el('pattern', { id: `${id}-ribs`, width: 7, height: 10, patternUnits: 'userSpaceOnUse' }),
    el('filter', { id: `${id}-glow`, x: '-30%', y: '-30%', width: '160%', height: '160%' }),
  );
  const frame = defs.children[0];
  frame.append(el('stop', { offset: 0, 'stop-color': '#3a3644' }), el('stop', { offset: 1, 'stop-color': '#0f0d15' }));
  const ribs = defs.children[1];
  ribs.append(el('rect', { width: 7, height: 10, fill: '#a3a8b3' }), el('rect', { x: 4.5, width: 2.5, height: 10, fill: '#6f7480' }));
  const glow = defs.children[2];
  glow.append(el('feGaussianBlur', { stdDeviation: 3, result: 'b' }));
  const merge = el('feMerge');
  merge.append(el('feMergeNode', { in: 'b' }), el('feMergeNode', { in: 'SourceGraphic' }));
  glow.append(merge);
  const shade = el('linearGradient', { id: `${id}-shade`, x1: 0, y1: 0, x2: 0, y2: 1 });
  shade.append(el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.38 }), el('stop', { offset: 0.55, 'stop-color': '#fff', 'stop-opacity': 0 }), el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.45 }));
  const panel = el('linearGradient', { id: `${id}-panel`, x1: 0, y1: 0, x2: 1, y2: 1 });
  panel.append(el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.35 }), el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.35 }));
  defs.append(shade, panel);
  svg.append(defs);

  teams.forEach((t, i) => {
    const cx = i * UNIT + UNIT / 2;
    const g = el('g', { class: 'podium', style: `--team:${t.color};animation-delay:${0.15 + i * 0.12}s` });
    const archPath = (r) => `M ${cx - r} 272 V 132 A ${r} ${r} 0 0 1 ${cx + r} 132 V 272 Z`;
    const clipId = `${id}-clip-${i}`;
    const clip = el('clipPath', { id: clipId });
    clip.append(el('path', { d: archPath(70) }));
    defs.append(clip);

    // Lichtschein auf dem Boden
    g.append(el('ellipse', { cx, cy: 316, rx: 92, ry: 9, fill: t.color, opacity: 0.45, filter: `url(#${id}-glow)` }));
    // Bogen: Rahmen, Farbfläche, Neonringe
    g.append(el('path', { d: archPath(84), fill: `url(#${id}-frame)`, stroke: '#000', 'stroke-width': 2 }));
    g.append(el('path', { d: archPath(70), fill: t.color }));
    g.append(el('path', { d: archPath(70), fill: `url(#${id}-shade)` }));
    const rings = el('g', { 'clip-path': `url(#${clipId})`, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.6, 'stroke-width': 3, filter: `url(#${id}-glow)` });
    for (const r of [44, 70, 96, 122]) rings.append(el('circle', { cx: cx + 34, cy: 214, r }));
    g.append(rings);
    // 3D-Avatar hinter dem Pult (unten vom Pult verdeckt)
    if (t.avatar) {
      g.append(el('image', { href: t.avatar, x: cx - 70, y: 70, width: 140, height: 205, preserveAspectRatio: 'xMidYMax meet', 'clip-path': `url(#${clipId})`, class: 'podium-avatar' }));
    }
    // Pult: gestreifter Teil, Farbpaneel mit dunklem Diagonalstreifen, Seitenfläche
    g.append(el('polygon', { points: `${cx - 90},206 ${cx + 72},206 ${cx + 94},220 ${cx + 94},312 ${cx - 90},312`, fill: '#1b1823', stroke: '#000', 'stroke-width': 2 }));
    g.append(el('rect', { x: cx - 88, y: 208, width: 70, height: 102, fill: `url(#${id}-ribs)` }));
    g.append(el('polygon', { points: `${cx - 18},208 ${cx + 72},208 ${cx + 72},310 ${cx - 18},310`, fill: t.color }));
    g.append(el('polygon', { points: `${cx - 18},208 ${cx + 72},208 ${cx + 72},310 ${cx - 18},310`, fill: `url(#${id}-panel)` }));
    g.append(el('polygon', { points: `${cx + 8},310 ${cx + 34},310 ${cx + 72},230 ${cx + 72},208 ${cx + 62},208`, fill: '#14111b', opacity: 0.85 }));
    g.append(el('polygon', { points: `${cx + 72},208 ${cx + 92},221 ${cx + 92},310 ${cx + 72},310`, fill: '#000', opacity: 0.35 }));
    g.append(el('line', { x1: cx - 90, y1: 206, x2: cx + 72, y2: 206, stroke: '#fff', 'stroke-opacity': 0.5, 'stroke-width': 2 }));
    // Punktefeld
    const winner = opts.winnerId === t.id;
    g.append(el('rect', { x: cx - 15, y: 224, width: 30, height: 50, rx: 2, fill: '#000', stroke: winner ? '#ffc23d' : '#fff', 'stroke-width': winner ? 3 : 1.5, class: winner ? 'podium-score winner' : 'podium-score' }));
    if (opts.points) {
      const pts = String(t.points ?? 0);
      const fs = pts.length > 2 ? 17 : 26;
      g.append(el('text', { x: cx, y: 249 + fs * 0.36, 'text-anchor': 'middle', class: `podium-points${winner ? ' winner' : ''}`, 'font-size': fs }, pts));
    }
    // Teamname gebogen über dem Bogen
    const r = 98, a0 = (205 * Math.PI) / 180, a1 = (335 * Math.PI) / 180;
    const pathId = `${id}-name-${i}`;
    defs.append(el('path', { id: pathId, d: `M ${cx + r * Math.cos(a0)} ${132 + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${132 + r * Math.sin(a1)}` }));
    const label = t.name.toUpperCase();
    const budget = 190;
    const fs = Math.min(22, budget / Math.max(4, label.length * 0.66));
    const text = el('text', { class: `podium-name${winner ? ' winner' : ''}`, 'font-size': fs.toFixed(1) });
    const tp = el('textPath', { href: `#${pathId}`, startOffset: '50%', 'text-anchor': 'middle' }, label);
    if (label.length * fs * 0.66 > budget) { tp.setAttribute('textLength', budget); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    text.append(tp);
    g.append(text);
    svg.append(g);
  });

  // Breite so wählen, dass die Reihe höchstens etwa 56 % der Bildschirmhöhe einnimmt.
  const width = `min(94vw, ${((n * UNIT) / VIEW_H) * 56}vh)`;
  return h('div', { class: 'scene scene-teams', style: { width } }, svg, opts.banner || '');
}
