// Teampulte für den Beamer: Fabians Show-Bild mit den sechs Pulten in
// Originaloptik und -anordnung, die Bögen leer (scripts/build-podiums.py).
// Der 3D-Avatar eines Teams steht im Bogen und verschwindet an der Pultkante
// hinter dem Pult; ohne Avatar bleibt das Pult leer.

import { h } from './client.js';
import { PODIUM_DATA } from './podium-data.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function el(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

// opts: { points: bool, winnerId, banner: Node }
export function podiumRow(teams, opts = {}) {
  const id = `pod${++uid}`;
  const { width: W, height: H, podiums } = PODIUM_DATA;
  const shown = teams.slice(0, podiums.length);
  const svg = el('svg', { class: 'podiums', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Teampulte: ${shown.map((t) => t.name).join(', ')}` });
  const defs = el('defs');
  svg.append(defs, el('image', { href: 'assets/img/studio-teams-empty.webp', x: 0, y: 0, width: W, height: H }));

  podiums.forEach((p, i) => {
    const t = shown[i];
    const [l, top, r, desk] = p.box;
    const g = el('g', { class: 'podium-slot', style: t ? `--team:${t.color};animation-delay:${0.2 + i * 0.15}s` : '' });
    // Avatar: im Bogen, unten an der Pultkante abgeschnitten (steht dahinter).
    if (t && t.avatar) {
      const clipId = `${id}-clip-${i}`;
      const clip = el('clipPath', { id: clipId });
      clip.append(el('polygon', { points: p.clip }));
      defs.append(clip);
      const w = r - l, hgt = desk - top;
      g.append(el('image', {
        href: t.avatar, class: 'podium-avatar', 'clip-path': `url(#${clipId})`,
        x: l - w * 0.04, y: top + hgt * 0.08, width: w * 1.08, height: hgt * 1.3,
        preserveAspectRatio: 'xMidYMin meet',
      }));
    }
    // Punktefeld: im Bild steht „0“ – immer überdecken, Punkte nur bei der Münzvergabe.
    const [sx0, sy0, sx1, sy1] = p.score;
    const winner = t && opts.winnerId === t.id;
    g.append(el('rect', { x: sx0, y: sy0, width: sx1 - sx0 + 1, height: sy1 - sy0 + 1, fill: '#000', class: winner ? 'podium-score winner' : 'podium-score' }));
    if (t && opts.points) {
      const pts = String(t.points ?? 0);
      const fs = pts.length > 2 ? 11 : pts.length > 1 ? 15 : 19;
      g.append(el('text', { x: (sx0 + sx1 + 1) / 2, y: (sy0 + sy1) / 2 + fs * 0.36, 'text-anchor': 'middle', class: `podium-points${winner ? ' winner' : ''}`, 'font-size': fs }, pts));
    }
    // Teamname gebogen über dem Bogen.
    if (t) {
      const cx = (l + r) / 2;
      const rad = 86, cy = top - 7 + rad - 6, a = Math.PI / 2 - (42 * Math.PI) / 180;
      const pathId = `${id}-name-${i}`;
      defs.append(el('path', { id: pathId, d: `M ${cx - rad * Math.cos(a)} ${cy - rad * Math.sin(a)} A ${rad} ${rad} 0 0 1 ${cx + rad * Math.cos(a)} ${cy - rad * Math.sin(a)}` }));
      const label = t.name.toUpperCase();
      const budget = 112;
      const fs = Math.min(17, budget / Math.max(4, label.length * 0.68));
      const text = el('text', { class: `podium-name${winner ? ' winner' : ''}`, 'font-size': fs.toFixed(1) });
      const tp = el('textPath', { href: `#${pathId}`, startOffset: '50%', 'text-anchor': 'middle' }, label);
      if (label.length * fs * 0.68 > budget) { tp.setAttribute('textLength', budget); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
      text.append(tp);
      g.append(text);
    }
    svg.append(g);
  });

  const rest = teams.slice(podiums.length);
  return h('div', { class: 'scene scene-teams' }, svg,
    rest.length ? h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '1.5vh', gap: '1vw' } },
      rest.map((t) => h('span', { class: 'chip', style: { borderBottom: `6px solid ${t.color}` } }, opts.points ? `${t.name} · ${t.points ?? 0}` : t.name))) : '',
    opts.banner || '');
}
