// Live-Band für die Pause: Big-Band auf drei Podeststufen (Anordnung nach
// Fabians Vorlage), gezeichnet im Cartoon-Stil der Show-Avatare – große Köpfe,
// natürliche Proportionen, weiche Schattierung. Erfundene Musiker, keine echten Personen.
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
// Kopf: natürliche Gesichtszüge (Augenlider, Nase, Lippen), weiches Licht von links oben.
// Gezeichnet im Maßstab „Radius 40“, im Körper auf Kopfgröße verkleinert.

function head(o) {
  const skin = SKIN[o.skin];
  const sk = grad(skin[0], skin[1], 'rad');
  const hair = o.hairColor || '#3b2416';
  const hr = grad(lighten(hair, 0.28), hair, 'rad');
  const strands = (d) => `<path d="${d}" stroke="${lighten(hair, 0.45)}" stroke-width="1.6" fill="none" opacity=".55"/>`;
  let back = '', front = '';
  switch (o.hair) {
    case 'long':
      back = `<path d="M-38 -14 Q-46 -58 0 -60 Q46 -58 38 -14 Q50 30 46 78 Q30 92 14 84 L14 30 L-14 30 L-14 84 Q-30 92 -46 78 Q-50 30 -38 -14 Z" fill="${hr}"/>`;
      front = `<path d="M-35 -8 Q-36 -54 2 -54 Q36 -52 36 -12 Q30 -34 8 -40 Q-16 -36 -35 -8 Z" fill="${hr}"/>${strands('M-26 -30 Q-10 -46 10 -46')}${strands('M30 -20 Q36 10 34 40')}`;
      break;
    case 'short':
      front = `<path d="M-36 -6 Q-40 -52 0 -54 Q40 -52 36 -8 Q34 -26 22 -34 Q2 -26 -16 -34 Q-30 -26 -36 -6 Z" fill="${hr}"/>${strands('M-20 -40 Q0 -48 22 -40')}`;
      break;
    case 'pixie':
      front = `<path d="M-37 -2 Q-42 -54 4 -56 Q40 -52 37 -8 Q30 -32 10 -30 Q-8 -46 -26 -28 Q-34 -18 -37 -2 Z" fill="${hr}"/>${strands('M-22 -40 Q2 -52 26 -36')}${strands('M-8 -44 Q8 -36 18 -26')}`;
      break;
    case 'curly':
      back = [[-30, -32], [-14, -46], [6, -48], [24, -40], [36, -24], [-38, -12], [40, -6], [-38, 8], [40, 10]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" fill="${hr}"/><path d="M${x - 7} ${y - 3} Q${x} ${y - 10} ${x + 7} ${y - 3}" stroke="${lighten(hair, 0.45)}" stroke-width="1.5" fill="none" opacity=".6"/>`).join('');
      break;
    case 'braids':
      back = `<path d="M-38 -10 Q-40 -54 0 -54 Q40 -54 38 -10 Z" fill="${hr}"/>` +
        [-30, -22, -14, 14, 22, 30].map((x) => `<path d="M${x} -6 Q${x * 1.2} 40 ${x * 1.1} 80" stroke="${hair}" stroke-width="6" stroke-linecap="round" fill="none"/>`).join('');
      front = `<path d="M-36 -14 Q-30 -50 0 -50 Q30 -50 36 -14 Q24 -32 0 -34 Q-24 -32 -36 -14 Z" fill="${hr}"/>`;
      break;
    default:
      break;
  }
  let hat = '';
  if (o.hat === 'bucket') {
    const c = grad('#e2f0ff', '#93b6d4');
    hat = `<path d="M-50 -22 Q0 -36 50 -22 L44 -12 Q0 -24 -44 -12 Z" fill="${c}"/><path d="M-32 -22 Q-30 -60 0 -62 Q30 -60 32 -22 Z" fill="${c}"/><path d="M-30 -30 Q0 -38 30 -30" stroke="#7d9cb8" stroke-width="2" fill="none"/>`;
  } else if (o.hat === 'cap') {
    const c = grad('#86946f', '#4b563f');
    hat = `<path d="M-37 -20 Q-36 -60 0 -60 Q36 -60 37 -20 Z" fill="${c}"/><path d="M-8 -24 Q30 -28 56 -18 Q30 -12 -8 -16 Z" fill="${c}"/><circle cx="0" cy="-58" r="3" fill="#3c4532"/>`;
  } else if (o.hat === 'beanie') {
    const c = grad('#f6f1e8', '#c4baa8');
    hat = `<path d="M-38 -18 Q-38 -68 0 -68 Q38 -68 38 -18 Z" fill="${c}"/><rect x="-40" y="-26" width="80" height="14" rx="6" fill="${c}"/>` +
      [-24, -12, 0, 12, 24].map((x) => `<path d="M${x} -26 L${x} -12" stroke="#b5ab98" stroke-width="2"/>`).join('');
  }
  const glasses = o.glasses === 'sun'
    ? `<g><path d="M-30 -8 L-6 -8 Q-4 8 -18 10 Q-30 8 -30 -8 Z" fill="#141418"/><path d="M6 -8 L30 -8 Q30 8 18 10 Q4 8 6 -8 Z" fill="#141418"/><path d="M-6 -6 L6 -6" stroke="#141418" stroke-width="3"/><path d="M-26 -4 L-16 -4" stroke="#fff" stroke-opacity=".45" stroke-width="2"/></g>`
    : o.glasses === 'round'
      ? `<g fill="none" stroke="#2a2a30" stroke-width="2.2"><circle cx="-15" cy="0" r="10"/><circle cx="15" cy="0" r="10"/><path d="M-5 -1 L5 -1"/></g>`
      : '';
  const beard = o.beard ? `<path d="M-31 6 Q-30 44 0 50 Q30 44 31 6 Q24 26 12 26 Q0 22 -12 26 Q-24 26 -31 6 Z" fill="${hair}" opacity=".9"/>
    <path d="M-12 20 Q0 15 12 20" stroke="${hair}" stroke-width="5" stroke-linecap="round" fill="none"/>` : '';
  const iris = o.eyes || '#5a3a24';
  const eyes = o.glasses === 'sun' ? '' : `
    <path d="M-22 0 Q-14 -7 -6 0 Q-14 4 -22 0 Z" fill="#fff"/><path d="M6 0 Q14 -7 22 0 Q14 4 6 0 Z" fill="#fff"/>
    <circle cx="-14" cy="-0.5" r="3.6" fill="${iris}"/><circle cx="14" cy="-0.5" r="3.6" fill="${iris}"/>
    <circle cx="-14" cy="-0.5" r="1.6" fill="#120c08"/><circle cx="14" cy="-0.5" r="1.6" fill="#120c08"/>
    <circle cx="-12.8" cy="-1.8" r="1" fill="#fff"/><circle cx="15.2" cy="-1.8" r="1" fill="#fff"/>
    <path d="M-23 0 Q-14 -9 -5 -1" stroke="#2a1a12" stroke-width="1.8" fill="none"/><path d="M5 -1 Q14 -9 23 0" stroke="#2a1a12" stroke-width="1.8" fill="none"/>
    ${o.lashes ? '<path d="M-23 0 L-26 -3 M23 0 L26 -3" stroke="#1a100a" stroke-width="1.5"/>' : ''}
    <path d="M-24 -11 Q-14 -16 -5 -12" stroke="${hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M5 -12 Q14 -16 24 -11" stroke="${hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  const lips = o.lipColor || (o.lashes ? '#b8545a' : '#a8605a');
  const mouth = o.singer
    ? `<path d="M-9 22 Q0 19 9 22" stroke="${lips}" stroke-width="3" fill="none" stroke-linecap="round"/>${anim('mouth', 'lead', 6)}<ellipse cx="0" cy="25" rx="6.5" ry="2.5" fill="#5a1e22"/></g>`
    : `<path d="M-9 22 Q0 19 9 22 Q0 27 -9 22 Z" fill="${lips}"/><path d="M-9 22 Q0 24 9 22" stroke="#6a3030" stroke-width="1.2" fill="none"/>`;
  // Gesichtsform: schmaler zum Kinn, Wangen- und Kieferschatten.
  return `${back}
    <ellipse cx="-34" cy="4" rx="6" ry="10" fill="${sk}"/><ellipse cx="34" cy="4" rx="6" ry="10" fill="${sk}"/>
    <path d="M-33 -16 Q-34 -46 0 -46 Q34 -46 33 -16 Q34 18 22 34 Q10 44 0 44 Q-10 44 -22 34 Q-34 18 -33 -16 Z" fill="${sk}"/>
    <path d="M22 34 Q10 44 0 44 Q-10 44 -22 34 Q-8 40 0 40 Q8 40 22 34 Z" fill="${skin[1]}" opacity=".45"/>
    <path d="M33 -10 Q34 18 22 34 Q28 12 26 -10 Z" fill="${skin[1]}" opacity=".35"/>
    <ellipse cx="-20" cy="13" rx="6" ry="3.5" fill="#e07a6a" opacity=".22"/><ellipse cx="20" cy="13" rx="6" ry="3.5" fill="#e07a6a" opacity=".22"/>
    ${eyes}
    <path d="M1 0 Q-2 10 -4 13 Q0 16 5 13" stroke="${skin[1]}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="-2" cy="14" rx="2" ry="1.2" fill="${skin[1]}" opacity=".7"/><ellipse cx="4" cy="14" rx="2" ry="1.2" fill="${skin[1]}" opacity=".7"/>
    ${beard}${mouth}${glasses}${front}${hat}`;
}

function lighten(hex, k = 0.35) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v + (255 - v) * k)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------
// Körper mit natürlichen Proportionen (~6 Kopfhöhen). Füße bei y=0.
// Wichtige Höhen (stehend): Kopfmitte -276, Mund -264, Schultern -232, Taille -160, Hüfte -150.

const HEAD_SCALE = 0.66;
const Y = { head: -276, mouth: -263, shoulder: -232, chest: -205, waist: -160, hip: -150 };
const SIT_DY = 58;

function figure(m) {
  const sit = m.pose === 'sit';
  const dy = sit ? SIT_DY : 0;
  const top = CLOTH[m.top];
  const bot = CLOTH[m.bottom || m.top];
  const tg = grad(top[0], top[1]);
  const bg = grad(bot[0], bot[1]);
  const sk = grad(SKIN[m.skin][0], SKIN[m.skin][1], 'rad');
  const sh = (y) => y + dy;
  let legs = '';
  if (m.dress) {
    // Langes, tailliertes Kleid mit leichtem Glanz.
    const sheen = grad(lighten(top[0], 0.3), top[1]);
    legs = `<path d="M-24 ${sh(-206)} Q-30 ${sh(-170)} -22 ${sh(-150)} Q-34 -80 -40 -6 Q0 4 40 -6 Q34 -80 22 ${sh(-150)} Q30 ${sh(-170)} 24 ${sh(-206)} Z" fill="${sheen}"/>
      <path d="M-6 ${sh(-150)} Q-10 -80 -14 -6" stroke="${top[1]}" stroke-width="2" opacity=".45" fill="none"/>
      <path d="M10 ${sh(-150)} Q16 -80 22 -6" stroke="#fff" stroke-width="3" opacity=".25" fill="none"/>
      <path d="M-16 -2 L-6 -2 L-4 -10 L-16 -10 Z" fill="#7a1a24"/><path d="M6 -2 L16 -2 L16 -10 L4 -10 Z" fill="#7a1a24"/>`;
  } else if (!sit) {
    const leg = (x) => `<path d="M${x - 16} -152 L${x + 16} -152 L${x + 11} -10 L${x - 11} -10 Z" fill="${bg}"/>
      <path d="M${x + 4} -150 L${x + 2} -12" stroke="${bot[1]}" stroke-width="1.6" opacity=".6"/>`;
    const shoe = (x) => `<path d="M${x - 11} -12 L${x + 9} -12 Q${x + 24} -10 ${x + 24} -2 L${x - 12} -2 Z" fill="${grad('#5a3a26', '#24160e')}"/><path d="M${x - 6} -10 Q${x + 6} -12 ${x + 16} -8" stroke="#fff" stroke-opacity=".25" stroke-width="1.5" fill="none"/>`;
    legs = `${leg(-16)}${leg(16)}${shoe(-16)}${shoe(16)}`;
  } else {
    legs = `<path d="M-28 -96 L28 -96 L30 -70 L-30 -70 Z" fill="${bg}"/>`;
  }
  const shirt = m.shirt || '#ffffff';
  const torso = m.dress
    ? `<path d="M-26 ${sh(-232)} Q-4 ${sh(-226)} -6 ${sh(-200)} L6 ${sh(-200)} Q4 ${sh(-226)} 26 ${sh(-232)} Q30 ${sh(-214)} 24 ${sh(-206)} L-24 ${sh(-206)} Q-30 ${sh(-214)} -26 ${sh(-232)} Z" fill="${tg}"/>`
    : `<path d="M-39 ${sh(-224)} Q-41 ${sh(-236)} -24 ${sh(-239)} L24 ${sh(-239)} Q41 ${sh(-236)} 39 ${sh(-224)} L34 ${sh(-170)} Q36 ${sh(-148)} 34 ${sh(-134)} L-34 ${sh(-134)} Q-36 ${sh(-148)} -34 ${sh(-170)} Z" fill="${tg}"/>
       <path d="M-10 ${sh(-238)} L0 ${sh(-196)} L10 ${sh(-238)} Z" fill="${shirt}"/>
       <path d="M-10 ${sh(-238)} L0 ${sh(-196)} L-4 ${sh(-176)} L-18 ${sh(-214)} Z" fill="${top[1]}" opacity=".7"/>
       <path d="M10 ${sh(-238)} L0 ${sh(-196)} L4 ${sh(-176)} L18 ${sh(-214)} Z" fill="${top[1]}" opacity=".7"/>
       <circle cx="2" cy="${sh(-168)}" r="2.2" fill="${top[1]}"/><circle cx="2" cy="${sh(-152)}" r="2.2" fill="${top[1]}"/>
       <path d="M-30 ${sh(-170)} Q-20 ${sh(-160)} -2 ${sh(-160)}" stroke="${top[1]}" stroke-width="1.5" opacity=".6" fill="none"/>
       <path d="M-30 ${sh(-226)} Q-34 ${sh(-190)} -30 ${sh(-140)}" stroke="#fff" stroke-opacity=".18" stroke-width="4" fill="none"/>`;
  const neck = `<path d="M-8 ${sh(-256)} L8 ${sh(-256)} L9 ${sh(-236)} L-9 ${sh(-236)} Z" fill="${sk}"/><path d="M-8 ${sh(-244)} Q0 ${sh(-240)} 8 ${sh(-244)}" stroke="${SKIN[m.skin][1]}" stroke-width="2" opacity=".5" fill="none"/>`;
  return { legs, torso: neck + torso, dy, tg, sk, top };
}

// Arm: Oberarm und Unterarm (sich verjüngend) mit Hand und Daumen.
function arm(f, sx, sy, ex, ey, hx, hy) {
  return `<path d="M${sx} ${sy} L${ex} ${ey}" stroke="${f.tg}" stroke-width="17" stroke-linecap="round"/>
    <path d="M${ex} ${ey} L${hx} ${hy}" stroke="${f.tg}" stroke-width="14" stroke-linecap="round"/>
    <path d="M${sx} ${sy} L${ex} ${ey}" stroke="#fff" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="${hx}" cy="${hy}" rx="6.5" ry="7.5" fill="${f.sk}"/><ellipse cx="${hx - 5}" cy="${hy - 3}" rx="2.6" ry="4" fill="${f.sk}" transform="rotate(-30 ${hx - 5} ${hy - 3})"/>`;
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
  const H = Y.head + f.dy; // Kopfmitte
  const M = Y.mouth + f.dy; // Mund
  const S = Y.shoulder + f.dy + 4; // Schultergelenk
  const W = Y.waist + f.dy; // Taille
  const lx = -32, rx = 32; // Schultern links/rechts
  const headG = `${anim('ty', 'bob', m.bob ?? 4, '', 0, 0, 0, m.ph || 0)}<g transform="translate(0 ${H}) scale(${HEAD_SCALE})">${head(m)}</g></g>`;
  let front = '', arms = '';
  const stick = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e8d2a6" stroke-width="4" stroke-linecap="round"/>`;
  switch (m.role) {
    case 'drums':
      front = `<g transform="scale(0.8)">${drumKit()}</g>`;
      arms = `${anim('rot', 'hat', -30, '', 8, lx, S)}${arm(f, lx, S, -50, S + 30, -62, S + 52)}${stick(-62, S + 52, -88, S + 44)}</g>
        ${anim('rot', 'snare', 34, '', -10, rx, S)}${arm(f, rx, S, 50, S + 32, 44, S + 58)}${stick(44, S + 58, 24, S + 76)}</g>`;
      break;
    case 'marimba':
      front = `<g transform="translate(0 ${W + 2}) scale(0.82)">${marimba()}</g>`;
      arms = `${anim('rot', 'hat', -20, '', 4, lx, S)}${arm(f, lx, S, -44, S + 36, -46, S + 66)}${stick(-46, S + 66, -60, S + 82)}<circle cx="-60" cy="${S + 84}" r="5" fill="#ff4fb0"/></g>
        ${anim('rot', 'snare', 20, '', -4, rx, S)}${arm(f, rx, S, 44, S + 36, 46, S + 66)}${stick(46, S + 66, 60, S + 82)}<circle cx="60" cy="${S + 84}" r="5" fill="#ff4fb0"/></g>`;
      break;
    case 'sax':
      // Mundstück am Mund, Schallbecher auf Hüfthöhe.
      arms = `${anim('sway', 'beat', 5, '', 0, 0, M, m.ph || 0)}<g transform="translate(4 ${M + 178}) scale(0.92)">${sax()}</g>
        ${arm(f, lx, S, -34, S + 34, 2, S + 52)}${arm(f, rx, S, 38, S + 44, 18, S + 92)}</g>`;
      break;
    case 'trumpet':
      arms = `${anim('rot', 'lead', -10, '', 0, 0, M)}<g transform="translate(6 ${M}) scale(0.8)">${trumpet()}</g>
        ${arm(f, lx, S, -18, S + 22, 18, M + 6)}${arm(f, rx, S, 50, S + 14, 40, M + 4)}</g>`;
      break;
    case 'trombone':
      arms = `${anim('rot', 'lead', -8, '', 0, 0, M)}<g transform="translate(4 ${M + 4}) scale(0.82)">${trombone()}</g>
        ${anim('slide', 'lead', 20, '')}${arm(f, rx, S, 60, S + 12, 80, M + 10)}</g>${arm(f, lx, S, -16, S + 20, 12, M + 6)}</g>`;
      break;
    case 'guitar':
    case 'bass': {
      const bass = m.role === 'bass';
      const inst = bass ? guitar('#ffb54d', '#c26a12', true) : guitar('#f2f4f8', '#9aa3b4');
      arms = `${anim('sway', 'beat', 4, '', 0, 0, -60, m.ph || 0)}<g transform="translate(-4 ${W + 6}) rotate(${bass ? -24 : -26}) scale(0.85)">${inst}</g>
        ${arm(f, rx, S, 58, S + 40, bass ? 96 : 84, W - 22)}
        ${anim('rot', bass ? 'bass' : 'stab', 26, '', -8, lx, S)}${arm(f, lx, S, -40, S + 44, -18, W + 8)}</g></g>`;
      break;
    }
    case 'keys':
      front = `<g transform="translate(0 ${W + 24}) scale(0.9)">${keyboard(m.kw || 180)}</g>`;
      arms = `${anim('ty', 'stab', 7)}${arm(f, lx, S, -42, S + 36, -40, W + 6)}</g>${anim('ty', 'lead', 7)}${arm(f, rx, S, 42, S + 36, 40, W + 6)}</g>`;
      break;
    case 'singer':
      front = micStand(0, M + 36);
      arms = `${arm(f, lx, S, -36, S + 40, -24, S + 78)}${anim('rot', 'lead', -24, '', 0, rx, S)}${arm(f, rx, S, 40, S + 34, 10, M + 34)}</g>`;
      break;
  }
  const body = `${anim('sway', 'beat', m.sway ?? 2, '', 0, 0, 0, m.ph || 0)}${f.legs}${f.torso}${headG}${arms}</g>`;
  return `<g transform="translate(${m.x} ${m.y}) scale(${m.s})">
    <ellipse cx="0" cy="2" rx="52" ry="8" fill="#000" opacity=".4"/>
    ${m.pose === 'sit' ? '<rect x="-22" y="-74" width="44" height="74" rx="5" fill="#26262e"/>' : ''}
    ${body}${front}</g>`;
}

// ---------------------------------------------------------------------------
// Bühne: Anordnung nach Fabians Band-Foto, Optik angelehnt (helle Anzüge, Beige/Braun, Hüte, helle Kleider).

const BAND = [
  // Hinterste Stufe: Bläser und Keyboard
  { x: 660, y: 318, s: 0.54, role: 'sax', skin: 'light', hair: 'short', hairColor: '#d9b46a', top: 'sky', shirt: '#eef3f8', ph: 0.2 },
  { x: 830, y: 318, s: 0.54, role: 'trumpet', skin: 'fair', hair: 'short', hairColor: '#6b4a32', hat: 'cap', glasses: 'round', top: 'camel', bottom: 'brown', beard: true, ph: 0.7 },
  { x: 990, y: 318, s: 0.54, role: 'trombone', skin: 'tan', hair: 'curly', hairColor: '#2a1a12', top: 'sky', lashes: true, ph: 1.1 },
  { x: 1150, y: 318, s: 0.54, role: 'keys', pose: 'sit', skin: 'tan', hair: 'short', hairColor: '#1e140e', top: 'brown', shirt: '#f3efe6', kw: 160, ph: 0.4 },
  // Mittlere Stufe: Percussion, Saxofon, Gitarre
  { x: 520, y: 470, s: 0.66, role: 'marimba', skin: 'dark', hair: 'braids', hairColor: '#1a120c', top: 'sky', shirt: '#ffffff', ph: 0.5 },
  { x: 730, y: 470, s: 0.66, role: 'sax', pose: 'sit', skin: 'fair', hair: 'curly', hairColor: '#7a4a2a', top: 'camel', shirt: '#f3efe6', ph: 0.9 },
  { x: 930, y: 470, s: 0.66, role: 'guitar', skin: 'light', hair: 'short', hairColor: '#2a1a12', beard: true, top: 'sky', shirt: '#ffffff', ph: 0.1 },
  // Vorne: Schlagzeug, zwei Sängerinnen, Bass
  { x: 360, y: 742, s: 0.8, role: 'drums', pose: 'sit', skin: 'tan', hair: 'short', hairColor: '#2a1a12', hat: 'bucket', glasses: 'sun', top: 'camel', shirt: '#ffffff', beard: true },
  { x: 575, y: 742, s: 0.8, role: 'singer', singer: true, lashes: true, skin: 'light', hair: 'long', hairColor: '#24160e', top: 'cream', dress: true, sway: 3, ph: 0.3 },
  { x: 1025, y: 742, s: 0.8, role: 'singer', singer: true, lashes: true, skin: 'fair', hair: 'pixie', hairColor: '#e8c98c', top: 'cream', dress: true, sway: 3, ph: 1.4 },
  { x: 1245, y: 742, s: 0.8, role: 'bass', skin: 'light', hair: 'short', hairColor: '#6b4a32', hat: 'beanie', glasses: 'round', beard: true, top: 'olive', ph: 0.6 },
];

function stage() {
  // Kein eigener Hintergrund: dahinter liegt das Show-Studio (Neon-Bühne) des Beamers.
  const riser = grad('#2a2c3c', '#0d0e16');
  return `
    <g class="bd-lights" opacity="0.18">
      <polygon points="600,0 630,0 760,700 470,700" fill="#ff2d8a"/>
      <polygon points="970,0 1000,0 1130,700 840,700" fill="#1fd6f2"/>
    </g>
    <!-- Podeststufen mit Neonkanten wie im Studio -->
    <rect x="560" y="318" width="680" height="34" rx="4" fill="${riser}"/>
    <rect x="560" y="318" width="680" height="4" fill="#ff2d8a" opacity=".85"/>
    <rect x="420" y="470" width="960" height="38" rx="4" fill="${riser}"/>
    <rect x="420" y="470" width="960" height="4" fill="#1fd6f2" opacity=".85"/>
    <path d="M220 742 L1380 742 L1470 800 L130 800 Z" fill="${riser}" opacity=".92"/>
    <path d="M220 742 L1380 742" stroke="#ff2d8a" stroke-width="4" opacity=".8"/>`;
}

function desk() {
  return `<g class="bd-desk" transform="translate(800 884) scale(0.8) translate(-800 -884)">
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
    <g transform="translate(745 300) scale(0.75) translate(-745 -300)">${musicStand(745, 300, 60)}</g><g transform="translate(1072 300) scale(0.75) translate(-1072 -300)">${musicStand(1072, 300, 60)}</g>
    ${back.map(musician).join('')}
    ${amp(1040, 470)}
    <g transform="translate(628 452) scale(0.8) translate(-628 -452)">${musicStand(628, 452, 64)}</g>
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
