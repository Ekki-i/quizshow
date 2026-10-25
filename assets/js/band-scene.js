// Live-Band für die Pause: Big-Band auf drei Podeststufen (Anordnung nach
// Fabians Vorlage), gezeichnet im Cartoon-Stil der Show-Avatare – große Köpfe,
// große Augen, weiche 3D-Schattierung. Erfundene Musiker, keine echten Personen.
//
// Bewegung: Elemente mit data-a werden pro Bild aus den Pegeln (kick, snare,
// hat, stab, bass, lead, bob, beat) gedreht oder verschoben, siehe poseBand().

// ---------------------------------------------------------------------------
// Farben und Verläufe

const SKIN = {
  light: ['#ffe2cc', '#f2b48f'],
  fair: ['#f8d2b4', '#dda07c'],
  tan: ['#e3ad84', '#b9784e'],
  brown: ['#b97a52', '#8a5434'],
  dark: ['#8a5a3c', '#5e3a24'],
};
const CLOTH = {
  sand: ['#e4d3b5', '#b9a27c'],
  camel: ['#c99b63', '#93683a'],
  brown: ['#9c7552', '#6b4b30'],
  sky: ['#b9d3ea', '#7f9fbf'],
  cream: ['#f1ebe0', '#c9bfae'],
  white: ['#ffffff', '#d9dbe2'],
  olive: ['#a99b6c', '#76693f'],
  dark: ['#3a3a46', '#1d1d26'],
};

let gid = 0;
const defs = [];
function grad(c0, c1, kind = 'lin') {
  const id = `bg${++gid}`;
  defs.push(kind === 'rad'
    ? `<radialGradient id="${id}" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`);
  return `url(#${id})`;
}

// Animationsgruppe: a = rot | ty | sway | mouth, src = Pegel, amp/base in Grad oder Pixeln.
function anim(a, src, amp, extra = '', base = 0, px = 0, py = 0, ph = 0) {
  return `<g data-a="${a}" data-src="${src}" data-amp="${amp}" data-base="${base}" data-px="${px}" data-py="${py}" data-ph="${ph}" ${extra}>`;
}

// ---------------------------------------------------------------------------
// Kopf im Avatar-Stil

function head(o) {
  const skin = SKIN[o.skin];
  const sk = grad(skin[0], skin[1], 'rad');
  const hair = o.hairColor || '#3b2416';
  const hr = grad(lighten(hair), hair, 'rad');
  let back = '', front = '';
  switch (o.hair) {
    case 'long':
      back = `<path d="M-40 -6 Q-46 -54 0 -56 Q46 -54 40 -6 L44 64 Q20 74 0 70 Q-20 74 -44 64 Z" fill="${hr}"/>`;
      front = `<path d="M-37 -10 Q-34 -50 0 -50 Q30 -50 37 -14 Q22 -36 -2 -34 Q-22 -32 -37 -10 Z" fill="${hr}"/>`;
      break;
    case 'short':
      front = `<path d="M-36 -8 Q-38 -50 0 -50 Q38 -50 36 -8 Q30 -30 6 -32 Q-10 -26 -24 -30 Q-32 -24 -36 -8 Z" fill="${hr}"/>`;
      break;
    case 'pixie':
      front = `<path d="M-37 -4 Q-40 -52 2 -52 Q40 -50 37 -10 Q28 -34 8 -30 Q-12 -42 -28 -26 Q-34 -18 -37 -4 Z" fill="${hr}"/>`;
      break;
    case 'curly':
      back = [[-30, -30], [-14, -44], [6, -46], [24, -38], [36, -22], [-38, -10], [40, -4], [-36, 10], [38, 12]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="${hr}"/>`).join('');
      break;
    case 'braids':
      back = `<path d="M-38 -8 Q-40 -52 0 -52 Q40 -52 38 -8 Z" fill="${hr}"/>` +
        [-30, -22, 22, 30].map((x) => `<path d="M${x} -4 Q${x * 1.15} 40 ${x * 1.05} 74" stroke="${hair}" stroke-width="8" stroke-linecap="round" fill="none"/>`).join('');
      front = `<path d="M-36 -12 Q-30 -48 0 -48 Q30 -48 36 -12 Q24 -30 0 -32 Q-24 -30 -36 -12 Z" fill="${hr}"/>`;
      break;
    case 'bald':
    default:
      break;
  }
  let hat = '';
  if (o.hat === 'bucket') {
    const c = grad('#d7ecff', '#9cc0dd');
    hat = `<path d="M-48 -22 Q0 -34 48 -22 L40 -14 Q0 -24 -40 -14 Z" fill="${c}"/><path d="M-32 -20 Q-30 -56 0 -58 Q30 -56 32 -20 Z" fill="${c}"/>`;
  } else if (o.hat === 'cap') {
    const c = grad('#7c8a6a', '#4f5b42');
    hat = `<path d="M-37 -18 Q-36 -58 0 -58 Q36 -58 37 -18 Z" fill="${c}"/><path d="M-6 -22 Q30 -26 54 -16 Q30 -10 -6 -14 Z" fill="${c}"/>`;
  } else if (o.hat === 'beanie') {
    const c = grad('#f2ece2', '#c9bfae');
    hat = `<path d="M-38 -16 Q-38 -64 0 -64 Q38 -64 38 -16 Z" fill="${c}"/><rect x="-40" y="-24" width="80" height="14" rx="6" fill="${c}"/>`;
  }
  const glasses = o.glasses === 'sun'
    ? `<g><rect x="-30" y="-6" width="24" height="16" rx="6" fill="#1b1b22"/><rect x="6" y="-6" width="24" height="16" rx="6" fill="#1b1b22"/><path d="M-6 0 L6 0" stroke="#1b1b22" stroke-width="3"/><path d="M-26 -2 L-16 -2" stroke="#fff" stroke-opacity=".5" stroke-width="2"/></g>`
    : o.glasses === 'round'
      ? `<g fill="none" stroke="#2a2a30" stroke-width="2.5"><circle cx="-15" cy="2" r="10"/><circle cx="15" cy="2" r="10"/><path d="M-5 1 L5 1"/></g>`
      : '';
  const beard = o.beard ? `<path d="M-30 12 Q-28 46 0 50 Q28 46 30 12 Q20 30 0 30 Q-20 30 -30 12 Z" fill="${hair}" opacity="0.92"/>` : '';
  const eyes = o.glasses === 'sun' ? '' : `
    <ellipse cx="-14" cy="2" rx="8" ry="10" fill="#fff"/><ellipse cx="14" cy="2" rx="8" ry="10" fill="#fff"/>
    <circle cx="-13" cy="4" r="5.5" fill="${o.eyes || '#4a3220'}"/><circle cx="15" cy="4" r="5.5" fill="${o.eyes || '#4a3220'}"/>
    <circle cx="-11" cy="1.5" r="2" fill="#fff"/><circle cx="17" cy="1.5" r="2" fill="#fff"/>
    <path d="M-22 -12 Q-14 -17 -6 -12" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M6 -12 Q14 -17 22 -12" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const mouth = o.singer
    ? `${anim('mouth', 'lead', 7)}<ellipse cx="0" cy="25" rx="7" ry="3" fill="#7a2a2a"/></g>`
    : `<path d="M-10 22 Q0 30 10 22" stroke="#7a3a2a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `${back}
    <circle cx="-37" cy="6" r="8" fill="${sk}"/><circle cx="37" cy="6" r="8" fill="${sk}"/>
    <ellipse cx="0" cy="4" rx="37" ry="40" fill="${sk}"/>
    <ellipse cx="-22" cy="16" rx="7" ry="4" fill="#ff8a8a" opacity=".35"/><ellipse cx="22" cy="16" rx="7" ry="4" fill="#ff8a8a" opacity=".35"/>
    ${eyes}
    <path d="M0 6 Q-4 14 1 16" stroke="${skin[1]}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    ${beard}${mouth}${glasses}${front}${hat}`;
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v + (255 - v) * 0.35)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------
// Figur: lokale Koordinaten, Füße bei y=0, Kopfmitte bei y=-208 (stehend).

function figure(m) {
  const sit = m.pose === 'sit';
  const dy = sit ? 46 : 0; // sitzend sitzt der Oberkörper tiefer
  const top = CLOTH[m.top];
  const bot = CLOTH[m.bottom || m.top];
  const tg = grad(top[0], top[1]);
  const bg = grad(bot[0], bot[1]);
  const sk = grad(SKIN[m.skin][0], SKIN[m.skin][1], 'rad');
  let legs = '';
  if (m.dress) {
    legs = `<path d="M-34 ${-96 + dy} L34 ${-96 + dy} L48 -4 Q0 6 -48 -4 Z" fill="${tg}"/>
      <path d="M0 ${-96 + dy} L0 -4" stroke="${top[1]}" stroke-width="2" opacity=".5"/>
      <ellipse cx="-14" cy="-2" rx="12" ry="6" fill="#2a2a30"/><ellipse cx="14" cy="-2" rx="12" ry="6" fill="#2a2a30"/>`;
  } else if (!sit) {
    legs = `<rect x="-30" y="-100" width="26" height="96" rx="11" fill="${bg}"/><rect x="4" y="-100" width="26" height="96" rx="11" fill="${bg}"/>
      <ellipse cx="-17" cy="-3" rx="17" ry="7" fill="#1f1d24"/><ellipse cx="17" cy="-3" rx="17" ry="7" fill="#1f1d24"/>`;
  } else {
    legs = `<rect x="-32" y="${-60}" width="64" height="22" rx="10" fill="${bg}"/>`;
  }
  const torso = `<path d="M-38 ${-168 + dy} Q-40 ${-176 + dy} -26 ${-178 + dy} L26 ${-178 + dy} Q40 ${-176 + dy} 38 ${-168 + dy} L36 ${-92 + dy} Q0 ${-84 + dy} -36 ${-92 + dy} Z" fill="${tg}"/>
    ${m.dress ? `<path d="M-14 ${-178 + dy} L0 ${-150 + dy} L14 ${-178 + dy}" stroke="${top[1]}" stroke-width="3" fill="none"/>`
    : `<path d="M-14 ${-178 + dy} L0 ${-138 + dy} L14 ${-178 + dy} Z" fill="${m.shirt || '#ffffff'}"/>
       <path d="M-14 ${-178 + dy} L0 ${-138 + dy} L-22 ${-150 + dy} Z" fill="${top[1]}" opacity=".55"/><path d="M14 ${-178 + dy} L0 ${-138 + dy} L22 ${-150 + dy} Z" fill="${top[1]}" opacity=".55"/>`}
    <rect x="-9" y="${-188 + dy}" width="18" height="14" rx="5" fill="${sk}"/>`;
  return { legs, torso, dy, tg, sk };
}

// Arm von der Schulter (sx, sy) über den Ellbogen zur Hand (hx, hy).
function arm(f, sx, sy, ex, ey, hx, hy) {
  return `<path d="M${sx} ${sy} Q${ex} ${ey} ${hx} ${hy}" stroke="${f.tg}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <circle cx="${hx}" cy="${hy}" r="9" fill="${f.sk}"/>`;
}

// ---------------------------------------------------------------------------
// Instrumente

const GOLD = () => grad('#ffe7a3', '#b8811f');
const CHROME = () => grad('#f2f4f8', '#8b919e');

function drumKit(big = 1) {
  const shell = grad('#6fd3e6', '#2a7f93');
  const head_ = grad('#ffffff', '#cfd6e2', 'rad');
  const cym = GOLD();
  return `
    <g data-a="ty" data-src="hat" data-amp="3" data-base="0" data-px="0" data-py="0" data-ph="0"><ellipse cx="-92" cy="-150" rx="34" ry="6" fill="${cym}"/><ellipse cx="-92" cy="-144" rx="34" ry="6" fill="${cym}" opacity=".85"/></g>
    <line x1="-92" y1="-144" x2="-92" y2="-30" stroke="#777" stroke-width="4"/>
    ${anim('rot', 'kick', 6, '', -10, 96, -186)}<ellipse cx="96" cy="-186" rx="44" ry="7" fill="${cym}" transform="rotate(-10 96 -186)"/></g>
    <line x1="96" y1="-186" x2="96" y2="-30" stroke="#777" stroke-width="4"/>
    <rect x="-62" y="-128" width="44" height="30" rx="7" fill="${shell}"/><ellipse cx="-40" cy="-128" rx="22" ry="6" fill="${head_}"/>
    <rect x="18" y="-128" width="44" height="30" rx="7" fill="${shell}"/><ellipse cx="40" cy="-128" rx="22" ry="6" fill="${head_}"/>
    ${anim('kickscale', 'kick', 0.05, '', 0, 0, -50)}
      <circle cx="0" cy="-58" r="${54 * big}" fill="${shell}"/><circle cx="0" cy="-58" r="${45 * big}" fill="${head_}"/>
      <circle cx="0" cy="-58" r="${18 * big}" fill="none" stroke="#2a7f93" stroke-width="3" opacity=".5"/>
    </g>
    <rect x="62" y="-74" width="50" height="48" rx="8" fill="${shell}"/><ellipse cx="87" cy="-74" rx="25" ry="7" fill="${head_}"/>`;
}

function micStand(x, top) {
  return `<line x1="${x}" y1="${top}" x2="${x}" y2="0" stroke="#2b2b33" stroke-width="4"/>
    <path d="M${x - 22} 0 L${x} -8 L${x + 22} 0" stroke="#2b2b33" stroke-width="4" fill="none"/>
    <rect x="${x - 6}" y="${top - 22}" width="12" height="26" rx="6" fill="#2b2b33"/><circle cx="${x}" cy="${top - 24}" r="9" fill="#9aa0ad"/>`;
}

function musicStand(x, y, w = 90) {
  return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 120}" stroke="#1e1e24" stroke-width="4"/>
    <path d="M${x - w / 2} ${y - 46} L${x + w / 2} ${y - 46} L${x + w / 2 - 6} ${y} L${x - w / 2 + 6} ${y} Z" fill="#141419"/>
    <path d="M${x - w / 2 + 8} ${y - 40} L${x + w / 2 - 8} ${y - 40}" stroke="#ffffff" stroke-opacity=".12" stroke-width="2"/>`;
}

function sax() {
  const g = GOLD();
  return `<path d="M6 -150 Q10 -120 6 -90 Q2 -60 18 -54 Q38 -50 40 -72 L40 -84 Q48 -88 52 -80 L50 -62 Q46 -34 16 -38 Q-12 -42 -8 -84 Q-6 -118 -6 -150 Z" fill="${g}" stroke="#7a5212" stroke-width="2"/>
    <path d="M0 -150 L-10 -168 Q-14 -176 -6 -178" stroke="#3a3a40" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${[-130, -112, -94, -76].map((y) => `<circle cx="2" cy="${y}" r="4" fill="#fff3c4"/>`).join('')}`;
}

function trumpet() {
  const g = GOLD();
  return `<path d="M-6 -6 L80 -6 L80 6 L-6 6 Z" fill="${g}"/><path d="M80 -6 L118 -24 L118 24 L80 6 Z" fill="${g}" stroke="#7a5212" stroke-width="2"/>
    <rect x="22" y="-18" width="28" height="12" rx="4" fill="${g}"/>${[28, 36, 44].map((x) => `<rect x="${x - 2}" y="-28" width="4" height="12" fill="#b8811f"/>`).join('')}`;
}

function trombone() {
  const g = GOLD();
  return `<path d="M-4 -4 L120 -4 L120 4 L-4 4 Z" fill="${g}"/><path d="M-4 -24 L80 -24 L80 -18 L-4 -18 Z" fill="${g}"/>
    <path d="M80 -24 L112 -42 L112 0 L80 -18 Z" fill="${g}" stroke="#7a5212" stroke-width="2"/>
    <path d="M120 -4 Q132 0 120 4" stroke="${g}" stroke-width="6" fill="none"/>`;
}

function guitar(color0, color1, bass = false) {
  const body = grad(color0, color1);
  const len = bass ? 190 : 150;
  return `<rect x="10" y="-6" width="${len}" height="10" rx="3" fill="#5a3a1a"/>
    <rect x="${len + 4}" y="-11" width="22" height="20" rx="4" fill="#2a1a0a"/>
    <path d="M24 -28 C0 -46 -40 -36 -38 -6 C-58 0 -56 30 -34 34 C-30 56 6 58 20 36 C40 40 44 18 30 4 C42 -6 40 -24 24 -28 Z" fill="${body}" stroke="#3a240e" stroke-width="2.5"/>
    <rect x="-18" y="-8" width="14" height="20" rx="3" fill="#2a2a2a"/><circle cx="10" cy="22" r="5" fill="#2a2a2a"/>`;
}

function keyboard(w = 170) {
  const keys = Array.from({ length: Math.floor((w - 12) / 12) }, (_, i) => `<rect x="${-w / 2 + 6 + i * 12}" y="-12" width="10" height="14" rx="1.5" fill="#fff"/>`).join('');
  const pads = ['#ff4fb0', '#ffd23d', '#3fd3ea', '#7cff4f'].map((c, i) => `<rect x="${-w / 2 + 10 + i * 16}" y="-30" width="12" height="10" rx="2" fill="${c}"/>`).join('');
  return `<rect x="${-w / 2}" y="-34" width="${w}" height="40" rx="6" fill="#1a1a20"/>${pads}${keys}
    <line x1="${-w / 2 + 20}" y1="6" x2="${-w / 2 + 10}" y2="110" stroke="#555" stroke-width="5"/><line x1="${w / 2 - 20}" y1="6" x2="${w / 2 - 10}" y2="110" stroke="#555" stroke-width="5"/>`;
}

function marimba() {
  const wood = grad('#e2a35a', '#9a5f22');
  const bars = Array.from({ length: 12 }, (_, i) => `<rect x="${-92 + i * 15.5}" y="${-10 - (11 - i) * 1.2}" width="13" height="${22 + (11 - i) * 2.4}" rx="3" fill="${wood}"/>`).join('');
  return `<rect x="-98" y="10" width="196" height="10" rx="4" fill="#3a2a1a"/>${bars}
    <line x1="-84" y1="20" x2="-84" y2="112" stroke="#3a2a1a" stroke-width="6"/><line x1="84" y1="20" x2="84" y2="112" stroke="#3a2a1a" stroke-width="6"/>`;
}

function amp(x, y) {
  return `<rect x="${x}" y="${y - 80}" width="110" height="80" rx="8" fill="#e9e4da"/><rect x="${x + 8}" y="${y - 70}" width="94" height="48" rx="4" fill="#2a2a30"/>
    <rect x="${x + 8}" y="${y - 18}" width="94" height="10" rx="3" fill="#cfc8ba"/>`;
}

// ---------------------------------------------------------------------------
// Musiker mit Rolle (Instrument, Arme, Bewegung)

function musician(m) {
  const f = figure(m);
  const H = -208 + f.dy; // Kopfmitte
  const S = -170 + f.dy; // Schulterhöhe
  const headG = `${anim('ty', 'bob', m.bob ?? 6, '', 0, 0, 0, m.ph || 0)}<g transform="translate(0 ${H})">${head(m)}</g></g>`;
  let behind = '', front = '', arms = '';
  switch (m.role) {
    case 'drums':
      front = drumKit();
      arms = `${anim('rot', 'hat', -34, '', 10, -30, S)}${arm(f, -30, S, -64, S + 20, -84, S + 30)}<line x1="-84" y1="${S + 30}" x2="-118" y2="${S + 42}" stroke="#e8d2a6" stroke-width="5" stroke-linecap="round"/></g>
        ${anim('rot', 'snare', 38, '', -12, 30, S)}${arm(f, 30, S, 62, S + 26, 52, S + 44)}<line x1="52" y1="${S + 44}" x2="22" y2="${S + 62}" stroke="#e8d2a6" stroke-width="5" stroke-linecap="round"/></g>`;
      break;
    case 'marimba':
      front = `<g transform="translate(0 ${S + 82})">${marimba()}</g>`;
      arms = `${anim('rot', 'hat', -22, '', 4, -30, S)}${arm(f, -30, S, -58, S + 34, -50, S + 58)}<line x1="-50" y1="${S + 58}" x2="-66" y2="${S + 80}" stroke="#e8d2a6" stroke-width="4"/><circle cx="-66" cy="${S + 80}" r="6" fill="#ff4fb0"/></g>
        ${anim('rot', 'snare', 22, '', -4, 30, S)}${arm(f, 30, S, 58, S + 34, 50, S + 58)}<line x1="50" y1="${S + 58}" x2="66" y2="${S + 80}" stroke="#e8d2a6" stroke-width="4"/><circle cx="66" cy="${S + 80}" r="6" fill="#ff4fb0"/></g>`;
      break;
    case 'sax':
      // Mundstück am Mund, Schallbecher auf Hüfthöhe.
      arms = `${anim('sway', 'beat', 5, '', 0, 0, H + 24, m.ph || 0)}<g transform="translate(6 ${H + 24 + 178})">${sax()}</g>
        ${arm(f, -30, S, -34, S + 26, 4, H + 96)}${arm(f, 30, S, 44, S + 44, 16, H + 146)}</g>`;
      break;
    case 'trumpet':
      arms = `${anim('rot', 'lead', -10, '', 0, 0, H + 26)}<g transform="translate(6 ${H + 30})">${trumpet()}</g>
        ${arm(f, -30, S, -10, S - 10, 14, H + 34)}${arm(f, 30, S, 46, S, 44, H + 28)}</g>`;
      break;
    case 'trombone':
      arms = `${anim('rot', 'lead', -8, '', 0, 0, H + 26)}<g transform="translate(4 ${H + 34})">${trombone()}</g>
        ${anim('slide', 'lead', 26, '')}${arm(f, 30, S, 70, S + 6, 96, H + 38)}</g>${arm(f, -30, S, -10, S - 6, 10, H + 34)}</g>`;
      break;
    case 'guitar':
    case 'bass': {
      const bass = m.role === 'bass';
      const inst = bass ? guitar('#ffb54d', '#c26a12', true) : guitar('#f2f4f8', '#9aa3b4');
      arms = `${anim('sway', 'beat', 4, '', 0, 0, -60, m.ph || 0)}<g transform="translate(-6 ${S + 70}) rotate(${bass ? -22 : -24})">${inst}</g>
        ${arm(f, 30, S, 74, S + 30, bass ? 120 : 100, S + 6)}
        ${anim('rot', bass ? 'bass' : 'stab', 30, '', -10, -30, S)}${arm(f, -30, S, -50, S + 40, -24, S + 74)}</g></g>`;
      break;
    }
    case 'keys':
      front = `<g transform="translate(0 ${S + 64})">${keyboard(m.kw || 180)}</g>`;
      arms = `${anim('ty', 'stab', 9)}${arm(f, -30, S, -50, S + 34, -46, S + 58)}</g>${anim('ty', 'lead', 9)}${arm(f, 30, S, 50, S + 34, 46, S + 58)}</g>`;
      break;
    case 'singer':
      front = micStand(0, H + 30);
      arms = `${arm(f, -30, S, -42, S + 46, -30, S + 88)}${anim('rot', 'lead', -22, '', 0, 30, S)}${arm(f, 30, S, 46, S + 40, 34, S + 74)}</g>`;
      break;
  }
  const body = `${anim('sway', 'beat', m.sway ?? 2, '', 0, 0, 0, m.ph || 0)}${behind}${f.legs}${f.torso}${headG}${arms}</g>`;
  return `<g transform="translate(${m.x} ${m.y}) scale(${m.s})">
    <ellipse cx="0" cy="2" rx="62" ry="10" fill="#000" opacity=".35"/>
    ${m.pose === 'sit' ? '<rect x="-26" y="-60" width="52" height="60" rx="6" fill="#2b2b33"/>' : ''}
    ${body}${front}</g>`;
}

// ---------------------------------------------------------------------------
// Bühne

const BAND = [
  // Hinterste Stufe: Bläser und Keyboard
  { x: 600, y: 318, s: 0.62, role: 'sax', skin: 'light', hair: 'short', hairColor: '#e2c27a', top: 'sky', shirt: '#eef3f8', ph: 0.2 },
  { x: 840, y: 318, s: 0.62, role: 'trumpet', skin: 'fair', hair: 'short', hairColor: '#6b4a32', hat: 'cap', glasses: 'round', top: 'camel', beard: true, ph: 0.7 },
  { x: 1080, y: 318, s: 0.62, role: 'trombone', skin: 'tan', hair: 'curly', hairColor: '#2a1a12', top: 'sky', ph: 1.1 },
  { x: 1300, y: 318, s: 0.62, role: 'keys', pose: 'sit', skin: 'tan', hair: 'short', hairColor: '#1e140e', top: 'brown', shirt: '#f3efe6', kw: 160, ph: 0.4 },
  // Mittlere Stufe: Percussion, Saxofon, Gitarre
  { x: 400, y: 470, s: 0.76, role: 'marimba', skin: 'dark', hair: 'braids', hairColor: '#1a120c', top: 'sky', shirt: '#ffffff', ph: 0.5 },
  { x: 720, y: 470, s: 0.76, role: 'sax', pose: 'sit', skin: 'fair', hair: 'curly', hairColor: '#7a4a2a', top: 'camel', shirt: '#f3efe6', ph: 0.9 },
  { x: 970, y: 470, s: 0.76, role: 'guitar', skin: 'light', hair: 'short', hairColor: '#2a1a12', beard: true, top: 'sky', shirt: '#ffffff', ph: 0.1 },
  // Vorne: Schlagzeug, zwei Sängerinnen, Bass
  { x: 190, y: 742, s: 0.92, role: 'drums', pose: 'sit', skin: 'tan', hair: 'short', hairColor: '#2a1a12', hat: 'bucket', glasses: 'sun', top: 'camel', shirt: '#ffffff', beard: true },
  { x: 500, y: 742, s: 0.92, role: 'singer', singer: true, skin: 'light', hair: 'long', hairColor: '#24160e', top: 'cream', dress: true, sway: 4, ph: 0.3 },
  { x: 1100, y: 742, s: 0.92, role: 'singer', singer: true, skin: 'fair', hair: 'pixie', hairColor: '#e8c98c', top: 'cream', dress: true, sway: 4, ph: 1.4 },
  { x: 1420, y: 742, s: 0.92, role: 'bass', skin: 'light', hair: 'short', hairColor: '#6b4a32', hat: 'beanie', glasses: 'round', beard: true, top: 'olive', ph: 0.6 },
];

function stage() {
  const wall = grad('#e88b7e', '#b85c58');
  const riser = grad('#3a3a44', '#16161c');
  const lip = grad('#5a5a66', '#2a2a32');
  const teal = grad('#2f8f8a', '#14524f');
  return `
    <rect x="0" y="0" width="1600" height="900" fill="${wall}"/>
    <polygon points="250,40 300,250 330,40" fill="${teal}" opacity=".9"/>
    <polygon points="560,0 620,0 600,120" fill="${teal}"/>
    <polygon points="1180,0 1600,0 1600,340 1420,260" fill="${teal}" opacity=".95"/>
    <polygon points="1460,40 1560,40 1510,140" fill="#0f3f3d" opacity=".8"/>
    <polygon points="0,120 120,0 0,0" fill="${teal}" opacity=".6"/>
    <g class="bd-lights" opacity="0.22">
      <polygon points="520,0 560,0 760,700 360,700" fill="#ff2d8a"/>
      <polygon points="1040,0 1080,0 1240,700 840,700" fill="#1fd6f2"/>
      <polygon points="790,0 810,0 960,600 640,600" fill="#ffffff"/>
    </g>
    <!-- Stufen -->
    <rect x="360" y="318" width="1100" height="36" fill="${riser}"/><rect x="360" y="318" width="1100" height="6" fill="${lip}"/>
    <rect x="200" y="470" width="1340" height="40" fill="${riser}"/><rect x="200" y="470" width="1340" height="6" fill="${lip}"/>
    <rect x="0" y="742" width="1600" height="158" fill="${grad('#2a2a32', '#0c0c10')}"/>
    <rect x="0" y="742" width="1600" height="5" fill="#ff8aa0" opacity=".55"/>
    <rect x="0" y="868" width="1600" height="6" fill="#ffd0d8" opacity=".35"/>`;
}

function desk() {
  return `<g class="bd-desk">
    <ellipse cx="800" cy="884" rx="250" ry="14" fill="#000" opacity=".55"/>
    <polygon points="610,700 820,700 820,880 610,880" fill="${grad('#ffb3b0', '#e87e86')}"/>
    <polygon points="820,700 990,700 990,880 820,880" fill="${grad('#1f5560', '#0f2f37')}"/>
    <polygon points="990,700 1008,712 1008,872 990,880" fill="#0a1f25"/>
    <polygon points="664,728 800,716 954,728 926,830 776,846 690,818" fill="${grad('#ffe2a0', '#7a4d12')}"/>
    <polygon points="684,740 800,730 936,740 910,822 782,836 706,812" fill="#08080b"/>
    <polygon points="610,696 990,696 1008,708 610,708" fill="#ffe1df" opacity=".6"/>
  </g>`;
}

function screen() {
  return `<g class="bd-screen">
    <rect x="660" y="0" width="280" height="16" fill="#1a1a22"/>
    <path d="M650 16 L950 16 L950 176 L650 176 Z" fill="${grad('#f7f2f2', '#c9c2c6')}"/>
    <polygon points="650,16 694,16 650,84" fill="#ff8a7a"/><polygon points="950,16 906,16 950,84" fill="#ff8a7a"/>
    <rect x="672" y="30" width="256" height="134" fill="#050507"/>
    <text x="800" y="104" text-anchor="middle" class="bd-pause">PAUSE</text>
    <text x="800" y="140" text-anchor="middle" class="bd-pause-sub">Gleich geht’s weiter</text>
  </g>`;
}

export function bandSceneSvg() {
  gid = 0;
  defs.length = 0;
  const back = BAND.filter((m) => m.y < 400);
  const mid = BAND.filter((m) => m.y >= 400 && m.y < 600);
  const frontRow = BAND.filter((m) => m.y >= 600);
  const body = `${stage()}${screen()}
    ${musicStand(560, 300, 70)}${musicStand(1040, 300, 70)}
    ${back.map(musician).join('')}
    ${amp(820, 470)}
    ${musicStand(680, 450, 84)}
    ${mid.map(musician).join('')}
    ${frontRow.map(musician).join('')}
    ${desk()}`;
  return `<svg class="band-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>${defs.join('')}</defs>${body}</svg>`;
}

// ---------------------------------------------------------------------------
// Bewegung pro Bild

export function poseBand(root, lv) {
  const beat = lv.beat || 0;
  for (const g of root.querySelectorAll('[data-a]')) {
    const a = g.dataset.a;
    const v = lv[g.dataset.src] ?? 0;
    const amp = Number(g.dataset.amp);
    const base = Number(g.dataset.base);
    const px = Number(g.dataset.px);
    const py = Number(g.dataset.py);
    const ph = Number(g.dataset.ph);
    if (a === 'rot') g.setAttribute('transform', `rotate(${(base + amp * v).toFixed(2)} ${px} ${py})`);
    else if (a === 'ty') g.setAttribute('transform', `translate(0 ${(amp * (g.dataset.src === 'bob' ? Math.abs(Math.sin(Math.PI * (beat + ph))) : v)).toFixed(2)})`);
    else if (a === 'sway') g.setAttribute('transform', `rotate(${(amp * Math.sin((Math.PI * beat) / 2 + ph * Math.PI)).toFixed(2)} ${px} ${py})`);
    else if (a === 'slide') g.setAttribute('transform', `translate(${(amp * v).toFixed(2)} 0)`);
    else if (a === 'kickscale') g.setAttribute('transform', `translate(0 ${py}) scale(${(1 + amp * v).toFixed(3)}) translate(0 ${-py})`);
    else if (a === 'mouth') {
      const e = g.firstElementChild;
      if (e) e.setAttribute('ry', (2 + amp * v).toFixed(2));
    }
  }
  root.style.setProperty('--kick', (lv.kick || 0).toFixed(3));
  root.style.setProperty('--beat', (lv.bob || 0).toFixed(3));
}
