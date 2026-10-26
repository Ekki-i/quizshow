// Studio mit Moderationspult als gestochen scharfe Vektorgrafik (938 × 530),
// nachgezeichnet nach Fabians Studiobild. Gleiche Koordinaten wie das alte
// Bild, damit Bildschirm, Pultfront und Münzen weiter genau passen.

let uid = 0;

// Neon-Dreiecke einer Seite: [x-Mitte, y-Grundlinie, Größe]
const TRI = [
  [58, 112, 36], [116, 112, 36], [170, 116, 34], [219, 118, 33], [264, 120, 32], [306, 122, 30],
  [97, 193, 36], [151, 194, 35], [203, 196, 33], [252, 198, 32], [300, 199, 30],
  [125, 262, 35], [180, 262, 34], [229, 263, 32], [276, 263, 30],
  [207, 326, 32],
];

function tri([cx, by, s], i, mirror) {
  const x = mirror ? 938 - cx : cx;
  const hgt = s * 0.9;
  const col = i % 3 === 1 ? '#ff7a62' : '#ff3d8b';
  return `<polygon points="${x - s / 2},${by} ${x + s / 2},${by} ${x},${by - hgt}" stroke="${col}"/>`;
}

function side(mirror) {
  const m = (pts) => (mirror ? pts.map(([x, y]) => [938 - x, y]) : pts).map((p) => p.join(',')).join(' ');
  return `
    <polygon points="${m([[0, 150], [34, 150], [126, 336], [92, 336]])}" fill="#16c4dc" opacity=".55" filter="url(#G-soft)"/>
    <polygon points="${m([[0, 150], [30, 150], [122, 336], [92, 336]])}" fill="url(#G-cyanbar)"/>
    <polygon points="${m([[0, 40], [24, 40], [172, 336], [148, 336]])}" fill="#ff2d8a" opacity=".6" filter="url(#G-soft)"/>
    <polygon points="${m([[0, 40], [20, 40], [168, 336], [148, 336]])}" fill="url(#G-pinkbar)"/>
    <polygon points="${m([[0, 226], [12, 226], [66, 336], [54, 336]])}" fill="#ff4f9a" opacity=".85"/>
    <g fill="none" stroke-width="2.6" stroke-linejoin="round" filter="url(#G-neon)">${TRI.map((t, i) => tri(t, i, mirror)).join('')}</g>
    <polyline points="${m([[0, 322], [205, 322]])}" stroke="#2ee6ff" stroke-width="2.4" filter="url(#G-neon)"/>
    <polyline points="${m([[0, 338], [175, 338]])}" stroke="#ff2d8a" stroke-width="2" opacity=".8" filter="url(#G-neon)"/>`;
}

function reflections() {
  // Spiegelungen der Neonelemente im glänzenden Boden
  const xs = [[40, '#ff2d8a'], [95, '#16c4dc'], [150, '#ff3d8b'], [215, '#ff7a62'], [270, '#ff3d8b']];
  const bars = [];
  for (const [x, c] of xs) {
    for (const xx of [x, 938 - x]) bars.push(`<rect x="${xx - 9}" y="352" width="18" height="120" fill="${c}" opacity=".32"/>`);
  }
  return `<g filter="url(#G-blur)">${bars.join('')}</g>`;
}

export function studioRoomSvg(cls = 'pult-bg') {
  const p = `sr${++uid}`;
  const svg = `
<svg class="${cls}" viewBox="0 0 938 530" preserveAspectRatio="xMidYMid meet" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="G-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04050d"/><stop offset=".45" stop-color="#0a1024"/><stop offset=".66" stop-color="#0b1328"/><stop offset="1" stop-color="#04050c"/>
    </linearGradient>
    <radialGradient id="G-haze" cx=".5" cy=".42" r=".55">
      <stop offset="0" stop-color="#1b5c78" stop-opacity=".45"/><stop offset=".6" stop-color="#132a4a" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="G-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1a30"/><stop offset=".25" stop-color="#070b1a"/><stop offset="1" stop-color="#03040a"/>
    </linearGradient>
    <linearGradient id="G-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6ff3ff" stop-opacity=".75"/><stop offset=".55" stop-color="#2bc6e6" stop-opacity=".18"/><stop offset="1" stop-color="#2bc6e6" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="G-pinkbar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff7ab8"/><stop offset=".5" stop-color="#ff2d8a"/><stop offset="1" stop-color="#c3126a"/>
    </linearGradient>
    <linearGradient id="G-cyanbar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7ff1ff"/><stop offset=".5" stop-color="#20bcd6"/><stop offset="1" stop-color="#0f7f99"/>
    </linearGradient>
    <linearGradient id="G-frame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6f6f9"/><stop offset="1" stop-color="#c9cad3"/>
    </linearGradient>
    <linearGradient id="G-salmon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffa087"/><stop offset="1" stop-color="#ee6b55"/>
    </linearGradient>
    <linearGradient id="G-pink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f59aab"/><stop offset="1" stop-color="#df7d92"/>
    </linearGradient>
    <linearGradient id="G-teal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#245a63"/><stop offset="1" stop-color="#173f48"/>
    </linearGradient>
    <linearGradient id="G-hole" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050b0f"/><stop offset="1" stop-color="#14282f"/>
    </linearGradient>
    <linearGradient id="G-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd884"/><stop offset=".35" stop-color="#d79a3a"/><stop offset=".7" stop-color="#9a6420"/><stop offset="1" stop-color="#f0b860"/>
    </linearGradient>
    <linearGradient id="G-shelf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffcf7a"/><stop offset=".5" stop-color="#c98a35"/><stop offset="1" stop-color="#7d4f17"/>
    </linearGradient>
    <filter id="G-neon" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="G-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="G-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="G-beamblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>

  <rect width="938" height="530" fill="url(#G-wall)"/>
  <rect width="938" height="530" fill="url(#G-haze)"/>

  <!-- Lichtkegel von der Decke -->
  <g filter="url(#G-beamblur)" opacity=".85">
    <polygon points="222,12 232,12 150,330 40,330" fill="url(#G-beam)"/>
    <polygon points="226,12 234,12 330,330 250,330" fill="url(#G-beam)" opacity=".55"/>
    <polygon points="716,12 706,12 788,330 898,330" fill="url(#G-beam)"/>
    <polygon points="712,12 704,12 608,330 688,330" fill="url(#G-beam)" opacity=".55"/>
    <polygon points="62,0 74,0 10,200 -40,200" fill="url(#G-beam)" opacity=".6"/>
    <polygon points="876,0 864,0 928,200 978,200" fill="url(#G-beam)" opacity=".6"/>
  </g>

  <!-- Bogen mit Lampen oben -->
  <path d="M 90 0 Q 469 52 848 0" fill="none" stroke="#ff2d8a" stroke-width="3" filter="url(#G-neon)"/>
  <path d="M 150 0 Q 469 36 788 0" fill="none" stroke="#ff5fa6" stroke-width="1.6" opacity=".8" filter="url(#G-neon)"/>
  <g fill="#bff6ff" filter="url(#G-neon)">
    <circle cx="226" cy="14" r="4.5"/><circle cx="712" cy="14" r="4.5"/>
    <circle cx="300" cy="22" r="2.2"/><circle cx="340" cy="25" r="2.2"/><circle cx="598" cy="25" r="2.2"/><circle cx="638" cy="22" r="2.2"/>
  </g>

  ${side(false)}
  ${side(true)}

  <!-- Boden -->
  <rect x="0" y="340" width="938" height="190" fill="url(#G-floor)"/>
  <line x1="0" y1="341" x2="938" y2="341" stroke="#2ee6ff" stroke-width="1.4" opacity=".55" filter="url(#G-neon)"/>
  ${reflections()}
  <path d="M -40 482 Q 469 404 978 482" fill="none" stroke="#ff2d8a" stroke-width="3" filter="url(#G-neon)"/>
  <path d="M -40 515 Q 469 446 978 515" fill="none" stroke="#2ee6ff" stroke-width="3" filter="url(#G-neon)"/>
  <path d="M -40 470 Q 469 392 978 470" fill="none" stroke="#ff2d8a" stroke-width="1.2" opacity=".5" filter="url(#G-neon)"/>

  <!-- Bildschirm über dem Pult -->
  <g>
    <rect x="368" y="17" width="204" height="162" rx="4" fill="url(#G-frame)"/>
    <polygon points="368,34 389,34 389,157 368,157" fill="url(#G-salmon)"/>
    <polygon points="572,74 572,170 548,170 548,128" fill="url(#G-salmon)"/>
    <rect x="386" y="31" width="166" height="130" fill="#1b1c22"/>
    <rect x="389" y="34" width="159" height="124" fill="#030304"/>
    <rect x="368" y="157" width="204" height="22" fill="#2a2d38"/>
    <line x1="469" y1="158" x2="469" y2="178" stroke="#1b1d26" stroke-width="1.2"/>
    <path d="M 368 178 H 572 V 188 Q 572 201 559 201 H 381 Q 368 201 368 188 Z" fill="#14151c"/>
    <g fill="#ffe1ec" filter="url(#G-neon)">
      ${[402, 435, 469, 503, 536].map((x) => [182.5, 188, 193.5].map((y) => `<rect x="${x - 9}" y="${y}" width="18" height="2.4" rx="1"/>`).join('')).join('')}
    </g>
  </g>

  <!-- Moderationspult -->
  <g>
    <ellipse cx="462" cy="438" rx="170" ry="10" fill="#000" opacity=".55" filter="url(#G-soft)"/>
    <polygon points="333,416 590,416 590,436 333,436" fill="#0f2a31"/>
    <polygon points="318,299 567,299 567,418 318,418" fill="url(#G-teal)"/>
    <polygon points="318,299 389,299 354,386 448,422 318,418" fill="url(#G-pink)"/>
    <polygon points="389,299 442,299 541,345 520,397 510,424 448,422 354,386" fill="url(#G-gold)"/>
    <polygon points="395,306 440,306 534,348 518,390 372,384" fill="url(#G-hole)"/>
    <polygon points="372,384 518,390 510,424 448,422" fill="url(#G-shelf)"/>
    <line x1="318" y1="299.6" x2="567" y2="299.6" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2"/>
    <rect x="566" y="300" width="3.2" height="118" fill="url(#G-gold)"/>
    <polygon points="569,300 607,303 607,414 569,418" fill="#12323a"/>
    <g stroke="#0a2228" stroke-width="1.3">
      ${Array.from({ length: 9 }, (_, i) => { const x = 573 + i * 4; return `<line x1="${x}" y1="${300.5 + i * 0.33}" x2="${x}" y2="${417.5 - i * 0.44}"/>`; }).join('')}
    </g>
  </g>
</svg>`;
  return svg.replaceAll('G-', `${p}-`);
}

export function studioRoom(cls) {
  const t = document.createElement('template');
  t.innerHTML = studioRoomSvg(cls).trim();
  return t.content.firstChild;
}
