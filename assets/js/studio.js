// Teampulte für den Beamer: Fabians Show-Bild mit den sechs Pulten in
// Originaloptik und -anordnung, die Bögen leer (scripts/build-podiums.py).
// Der 3D-Avatar eines Teams steht im Bogen und verschwindet an der Pultkante
// hinter dem Pult; ohne Avatar bleibt das Pult leer.

import { h } from './client.js';
import { PODIUM_DATA } from './podium-data.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
// Ablauf der Team-Vorstellung (Sekunden, mal --speed in den Animationen)
export const INTRO_START = 1.2;
export const INTRO_STEP = 2.2;

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
  const flights = [];
  if (opts.intro) {
    svg.classList.add('intro');
    const lg = el('linearGradient', { id: `${id}-spot`, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.append(el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.75 }), el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }));
    defs.append(lg);
  }

  podiums.forEach((p, i) => {
    const t = shown[i];
    const [l, top, r, desk] = p.box;
    // Vorstellung (opts.intro): ein Team nach dem anderen, je INTRO_STEP Sekunden.
    const style = !t ? '' : opts.intro ? `--team:${t.color};--d:${INTRO_START + i * INTRO_STEP}s` : `--team:${t.color};animation-delay:${0.2 + i * 0.15}s`;
    const g = el('g', { class: 'podium-slot', style });
    if (t && opts.intro) {
      // Lichtkegel von oben auf das Pult und ein Aufleuchten in Teamfarbe.
      const cx = (l + r) / 2;
      g.append(
        el('polygon', { class: 'podium-spot', points: `${cx - 14},-40 ${cx + 14},-40 ${r + 18},${desk + 30} ${l - 18},${desk + 30}`, fill: `url(#${id}-spot)` }),
        el('rect', { class: 'podium-flash', x: l - 6, y: top - 6, width: r - l + 12, height: desk - top + 60, rx: 40, fill: t.color }));
    }
    // Avatar: im Bogen, unten an der Pultkante abgeschnitten (steht dahinter).
    // Die Maske sitzt auf einer Gruppe, damit der Avatar darin hochfahren kann.
    if (t && t.avatar) {
      const clipId = `${id}-clip-${i}`;
      const clip = el('clipPath', { id: clipId });
      clip.append(el('polygon', { points: p.clip }));
      defs.append(clip);
      const w = r - l, hgt = desk - top;
      const holder = el('g', { 'clip-path': `url(#${clipId})` });
      holder.append(el('image', {
        href: t.avatar, class: 'podium-avatar',
        x: l - w * 0.04, y: top + hgt * 0.08, width: w * 1.08, height: hgt * 1.3,
        preserveAspectRatio: 'xMidYMin meet',
      }));
      g.append(holder);
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
    // Gewonnene Münzen stehen vorn auf der Pultkante; die gerade vergebene fliegt ein.
    const won = t ? (opts.coins || []).filter((c) => c.teamId === t.id).sort((a, b) => a.position - b.position) : [];
    won.forEach((c, j) => {
      const cw = 28, ch = cw * 208 / 240, gap = 25;
      const x = (l + r) / 2 + (j - (won.length - 1) / 2) * gap - cw / 2;
      const img = el('image', { href: 'assets/img/muenze.webp', class: 'podium-coin', x, y: desk + 4 - ch, width: cw, height: ch });
      if (opts.flyPosition === c.position) {
        img.classList.add('fly');
        flights.push({ img, dx: W / 2 - (x + cw / 2), dy: -60 - (desk + 4 - ch / 2) });
      }
      g.append(img);
    });
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

  // Flug der neuen Münze: von oben Mitte groß und drehend auf das Pult, mit Aufprall.
  const speed = Number(getComputedStyle(document.documentElement).getPropertyValue('--speed')) || 1;
  const still = document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const { img, dx, dy } of flights) {
    if (still || !img.animate) continue;
    img.parentNode.parentNode.append(img.parentNode); // Gewinnerpult nach vorn, damit die Münze über allem fliegt
    img.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(3.2) rotateY(0deg)`, opacity: 0, offset: 0 },
      { transform: `translate(${dx}px, ${dy + 90}px) scale(3.2) rotateY(360deg)`, opacity: 1, offset: 0.2 },
      { transform: 'translate(0, -6px) scale(1.15) rotateY(1080deg)', opacity: 1, offset: 0.8, easing: 'ease-in' },
      { transform: 'translate(0, 0) scale(0.9, 1.08) rotateY(1080deg)', offset: 0.88 },
      { transform: 'translate(0, -5px) scale(1.04) rotateY(1080deg)', offset: 0.94 },
      { transform: 'translate(0, 0) scale(1) rotateY(1080deg)', opacity: 1, offset: 1 },
    ], { duration: 3200 * speed, delay: 900 * speed, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
  }

  const rest = teams.slice(podiums.length);
  return h('div', { class: 'scene scene-teams' }, svg,
    rest.length ? h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '1.5vh', gap: '1vw' } },
      rest.map((t) => h('span', { class: 'chip', style: { borderBottom: `6px solid ${t.color}` } }, opts.points ? `${t.name} · ${t.points ?? 0}` : t.name))) : '',
    opts.banner || '');
}

// ---------- Moderationspult mit austauschbaren 3D-Avataren ----------
// Grundlage ist das Pultbild ohne Personen (938 × 530). Hinter dem Pult stehen
// Moderation und Co-Moderation; ohne eigenen Avatar die Standardfiguren.
const PW = 938, PH = 530, DESK_Y = 299;
const pc = (v, t) => `${(v / t) * 100}%`;
const DEFAULT_AV = {
  host: { src: 'assets/img/avatar-host.webp', box: [334, 215, 430, DESK_Y] },
  cohost: { src: 'assets/img/avatar-cohost.webp', box: [461, 210, 525, DESK_Y] },
};

function avatarSlot(src, cx, own, def, dx = 0) {
  // Eigener Avatar: 110 px breit, oben ausgerichtet, an der Pultkante abgeschnitten.
  const [x0, y0, x1, y1] = own ? [cx - 55, 192, cx + 55, DESK_Y] : [def.box[0] + dx, def.box[1], def.box[2] + dx, def.box[3]];
  return h('div', { class: 'pult-av', style: { left: pc(x0, PW), top: pc(y0, PH), width: pc(x1 - x0, PW), height: pc(y1 - y0, PH) } },
    h('img', { src, alt: '' }));
}

// who: 'both' (Moderation + Co-Moderation) oder 'cohost' (nur Co-Moderation in der Mitte, Finale)
export function pultLayers(show, who = 'both') {
  const out = [h('img', { class: 'pult-bg', src: 'assets/img/studio-pult-empty.webp', alt: '' })];
  if (who === 'both') {
    out.push(avatarSlot(show.hostAvatar || DEFAULT_AV.host.src, 382, !!show.hostAvatar, DEFAULT_AV.host));
    out.push(avatarSlot(show.coHostAvatar || DEFAULT_AV.cohost.src, 493, !!show.coHostAvatar, DEFAULT_AV.cohost));
  } else {
    out.push(avatarSlot(show.coHostAvatar || DEFAULT_AV.cohost.src, 470, !!show.coHostAvatar, DEFAULT_AV.cohost, -23));
  }
  return out;
}
export const PULT = { W: PW, H: PH, DESK_Y, pc };

// ---------- Einzelnes Finalpult (Vorlage: Fabians Finalbild) ----------
// Das Pult ist ein freigestelltes Bild; rechts wird es gespiegelt. Der Avatar steht
// dahinter, extra (z. B. die Münzen des Teams) liegt oben auf dem Pult.
export function singlePodium({ avatar, color, label, mirror = false, extra = null }) {
  const VW = 394, VH = 560, PY = VH - 342;
  const svg = el('svg', { class: 'single-podium', viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': label || '' });
  const cx = mirror ? 104 : 290;
  // Avatar so breit wie die Pultoberseite, unten bündig hinter der Pultkante (Oberkörper hinter dem Pult).
  if (avatar) svg.append(el('image', { href: avatar, x: cx - 100, y: PY - 175, width: 200, height: 222, preserveAspectRatio: 'xMidYMax meet' }));
  svg.append(el('ellipse', { cx: VW / 2, cy: VH - 8, rx: 180, ry: 12, fill: '#000', opacity: 0.45 }));
  svg.append(el('image', { href: 'assets/img/finale-pult.webp', x: 0, y: PY, width: VW, height: 342, transform: mirror ? `translate(${VW} 0) scale(-1 1)` : null }));
  const top = h('div', { class: 'sp-top', style: { left: `${((mirror ? 6 : 200) / VW) * 100}%`, width: `${(188 / VW) * 100}%`, top: `${((PY - 34) / VH) * 100}%`, height: `${(44 / VH) * 100}%` } }, extra);
  return h('div', { class: 'single-podium-wrap', '--team': color || '#fff' }, svg, extra ? top : null);
}
