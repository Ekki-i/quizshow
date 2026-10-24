// Pause: Moderationspult vorne, dahinter eine animierte Live-Band, die zu
// einem eigenen Pausen-Song spielt. Der Song wird mit WebAudio erzeugt
// (keine fremde Musik). Musik und Animation laufen über denselben Takt:
// jeder Schlag, Anschlag und jedes Kopfnicken sitzt auf dem Beat.
// Ohne Ton (Vorschau, Ton nicht aktiviert) läuft die Band im selben Takt stumm.

import { h } from './client.js';

const BPM = 104;
const STEP = 60 / BPM / 4; // Sechzehntel
const BAR = 16;
const BARS = 8;

// Akkorde je Takt (C – G – Am – F, zweimal), als MIDI-Grundton und Dreiklang.
const CHORDS = [
  [48, [60, 64, 67]], [43, [59, 62, 67]], [45, [60, 64, 69]], [41, [60, 65, 69]],
  [48, [60, 64, 67]], [43, [59, 62, 67]], [45, [60, 64, 69]], [41, [60, 65, 69]],
];
const KICK = [0, 7, 8, 10];
const SNARE = [4, 12];
const HAT = [0, 2, 4, 6, 8, 10, 12, 14];
const OPEN_HAT = [14];
const BASS = [[0, 0], [3, 0], [6, 7], [8, 12], [10, 0], [13, 7]]; // [Schritt, Halbtöne über Grundton]
const STAB = [2, 6, 10, 14];
// Melodie in den Takten 5–8 (Schritt, MIDI-Ton, Länge in Schritten)
const LEAD = {
  4: [[0, 76, 3], [4, 79, 2], [6, 76, 2], [8, 74, 4], [12, 72, 3]],
  5: [[0, 74, 3], [4, 71, 2], [6, 74, 2], [8, 79, 6]],
  6: [[0, 76, 2], [2, 72, 2], [4, 76, 2], [6, 79, 2], [8, 81, 4], [12, 79, 3]],
  7: [[0, 77, 3], [4, 76, 2], [6, 74, 2], [8, 72, 7]],
};

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// ---------------------------------------------------------------------------
// Musik

let engine = null;

function createEngine(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 1.2);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const env = (g, t, peak, a, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const voice = (type, freq, t, dur, peak, filterFreq) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    let node = o;
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(master);
    env(g, t, peak, 0.008, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  };
  const noiseHit = (t, dur, peak, hp) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(master);
    env(g, t, peak, 0.002, dur);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  };

  const play = {
    kick(t) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      o.connect(g).connect(master);
      env(g, t, 0.95, 0.003, 0.32);
      o.start(t);
      o.stop(t + 0.4);
    },
    snare(t) {
      noiseHit(t, 0.17, 0.42, 1400);
      voice('triangle', 190, t, 0.08, 0.25);
    },
    hat(t, open) { noiseHit(t, open ? 0.22 : 0.035, open ? 0.12 : 0.09, 7500); },
    bass(t, note) { voice('sawtooth', midi(note), t, STEP * 1.7, 0.3, 520); },
    stab(t, notes) { for (const n of notes) voice('square', midi(n), t, STEP * 1.1, 0.045, 1900); },
    lead(t, note, len) {
      const o = voice('triangle', midi(note), t, STEP * len, 0.13);
      o.detune.setValueAtTime(0, t);
      o.detune.linearRampToValueAtTime(12, t + STEP * len);
    },
  };

  let step = 0;
  let nextTime = ctx.currentTime + 0.12;
  const start = nextTime;
  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / BAR) % BARS;
      const s = step % BAR;
      const [root, triad] = CHORDS[bar];
      if (KICK.includes(s)) play.kick(nextTime);
      if (SNARE.includes(s)) play.snare(nextTime);
      if (HAT.includes(s)) play.hat(nextTime, OPEN_HAT.includes(s));
      for (const [bs, off] of BASS) if (bs === s) play.bass(nextTime, root + off - 12);
      if (STAB.includes(s)) play.stab(nextTime, triad);
      for (const [ls, note, len] of LEAD[bar] || []) if (ls === s) play.lead(nextTime, note, len);
      step += 1;
      nextTime += STEP;
    }
  }
  schedule();
  const timer = setInterval(schedule, 25);
  return {
    ctx,
    clock: () => ctx.currentTime - start,
    stop() {
      clearInterval(timer);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => master.disconnect(), 1000);
    },
  };
}

// Stummer Takt, falls kein Ton läuft.
let silentStart = null;
function silentClock() {
  if (silentStart === null) silentStart = performance.now() / 1000;
  return performance.now() / 1000 - silentStart;
}

export function audioReady(ctx) {
  return !!ctx && ctx.state !== 'closed';
}

// ctx: AudioContext oder null (stumm). Mehrfachaufruf ist harmlos.
export function startPause(ctx) {
  if (ctx && (!engine || engine.ctx !== ctx)) {
    if (engine) engine.stop();
    if (ctx.state === 'suspended') ctx.resume();
    engine = createEngine(ctx);
  }
  startLoop();
}

export function stopPause() {
  if (engine) engine.stop();
  engine = null;
  silentStart = null;
  stopLoop();
}

const clock = () => (engine ? engine.clock() : silentClock());

// ---------------------------------------------------------------------------
// Animation

// Hüllkurve: wie lange ist der letzte Treffer aus `steps` her (0 = gerade jetzt)?
function hit(steps, pos, decay = 10) {
  const s = pos % BAR;
  let last = -1;
  for (const x of steps) if (x <= s && x > last) last = x;
  if (last < 0) last = Math.max(...steps) - BAR;
  const dt = (s - last) * STEP;
  return Math.exp(-dt * decay);
}

let raf = 0;
function startLoop() {
  if (raf) return;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const root = document.querySelector('.band-scene');
    if (!root) return;
    animate(root, clock() / STEP);
  };
  raf = requestAnimationFrame(frame);
}
function stopLoop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

function animate(root, pos) {
  if (pos < 0) pos = 0;
  const beat = pos / 4;
  const bar = Math.floor(pos / BAR) % BARS;
  const kick = hit(KICK, pos, 9);
  const snare = hit(SNARE, pos, 9);
  const hat = hit(HAT, pos, 18);
  const stab = hit(STAB, pos, 11);
  const bass = hit(BASS.map((b) => b[0]), pos, 8);
  const leadSteps = (LEAD[bar] || []).map((l) => l[0]);
  const lead = leadSteps.length ? hit(leadSteps, pos, 5) : 0;
  const bob = Math.abs(Math.sin(Math.PI * beat)); // Kopfnicken auf jeden Schlag
  const sway = Math.sin((Math.PI * beat) / 2); // langsames Wiegen über zwei Schläge
  const set = (sel, tf) => { const n = root.querySelector(sel); if (n) n.setAttribute('transform', tf); };

  // Schlagzeug
  set('.dr-head', `translate(0 ${bob * 6})`);
  set('.dr-arm-l', `rotate(${-38 * hat + 10} 0 0)`);
  set('.dr-arm-r', `rotate(${40 * snare - 12} 0 0)`);
  set('.dr-kick', `translate(860 640) scale(${1 + kick * 0.05}) translate(-860 -640)`);
  set('.dr-crash', `rotate(${Math.sin(pos * 1.3) * 6 * (bar % 4 === 0 ? kick : 0.25)} 1010 470)`);
  set('.dr-hat', `translate(0 ${hat * 4})`);
  // Gitarre
  set('.gt-body', `rotate(${sway * 3} 400 620)`);
  set('.gt-head', `translate(${sway * 3} ${bob * 7})`);
  set('.gt-arm', `rotate(${-30 + stab * 34} 0 0)`);
  // Keyboard
  set('.kb-head', `translate(0 ${bob * 5})`);
  set('.kb-hand-l', `translate(0 ${stab * 8})`);
  set('.kb-hand-r', `translate(0 ${lead * 9})`);
  // Bass
  set('.bs-body', `rotate(${-sway * 3} 1240 620)`);
  set('.bs-head', `translate(${-sway * 3} ${bob * 7})`);
  set('.bs-arm', `rotate(${-14 + bass * 22} 0 0)`);
  // Licht und Bildschirm
  root.style.setProperty('--kick', kick.toFixed(3));
  root.style.setProperty('--beat', bob.toFixed(3));
  const bars = root.querySelectorAll('.eq rect');
  bars.forEach((r, i) => {
    const v = [kick, snare, hat, bass, stab, lead][i % 6] * (0.55 + 0.45 * Math.abs(Math.sin(pos * 0.7 + i)));
    r.setAttribute('height', (6 + v * 46).toFixed(1));
    r.setAttribute('y', (606 - v * 46).toFixed(1));
  });
}

// ---------------------------------------------------------------------------
// Szene

const SCENE = `
<svg class="band-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="bd-riser" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2e44"/><stop offset="1" stop-color="#0c0d18"/></linearGradient>
    <linearGradient id="bd-desk-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3b0"/><stop offset="1" stop-color="#e87e86"/></linearGradient>
    <linearGradient id="bd-desk-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f5560"/><stop offset="1" stop-color="#0f2f37"/></linearGradient>
    <linearGradient id="bd-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2a0"/><stop offset="0.5" stop-color="#c88b2c"/><stop offset="1" stop-color="#7a4d12"/></linearGradient>
    <linearGradient id="bd-screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f2f2"/><stop offset="1" stop-color="#c9c2c6"/></linearGradient>
    <radialGradient id="bd-drum" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#f3f0ff"/><stop offset="1" stop-color="#b9b4d6"/></radialGradient>
    <linearGradient id="bd-cymbal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6417"/><stop offset="0.5" stop-color="#ffd877"/><stop offset="1" stop-color="#8a6417"/></linearGradient>
    <filter id="bd-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>

  <!-- Lichtkegel im Takt -->
  <g class="bd-lights">
    <polygon points="520,0 560,0 760,640 360,640" fill="#ff2d8a"/>
    <polygon points="1040,0 1080,0 1240,640 840,640" fill="#1fd6f2"/>
    <polygon points="790,0 810,0 960,560 640,560" fill="#ffffff"/>
  </g>

  <!-- Podest -->
  <path d="M 230 600 L 1370 600 L 1430 680 L 170 680 Z" fill="url(#bd-riser)"/>
  <path d="M 230 600 L 1370 600" stroke="#1fd6f2" stroke-width="4" opacity="0.8"/>
  <path d="M 640 470 L 1080 470 L 1110 520 L 610 520 Z" fill="url(#bd-riser)"/>
  <path d="M 640 470 L 1080 470" stroke="#ff2d8a" stroke-width="4" opacity="0.8"/>

  <!-- Schlagzeuger (hinten, erhöht) -->
  <g class="drummer">
    <rect x="828" y="332" width="64" height="96" rx="24" fill="#6b3bd6"/>
    <g class="dr-head"><circle cx="860" cy="300" r="30" fill="#f1c7a3"/><path d="M 830 296 Q 832 262 860 264 Q 890 262 892 294 Q 878 280 860 282 Q 842 280 830 296 Z" fill="#2a1a12"/><circle cx="850" cy="302" r="3" fill="#2a1a12"/><circle cx="870" cy="302" r="3" fill="#2a1a12"/><path d="M 851 314 Q 860 320 869 314" stroke="#7a3b2a" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <g transform="translate(836 352)"><g class="dr-arm-l"><path d="M 0 0 L -46 40" stroke="#6b3bd6" stroke-width="18" stroke-linecap="round"/><path d="M -46 40 L -88 46" stroke="#e9d3a6" stroke-width="5" stroke-linecap="round"/></g></g>
    <g transform="translate(884 352)"><g class="dr-arm-r"><path d="M 0 0 L 40 44" stroke="#6b3bd6" stroke-width="18" stroke-linecap="round"/><path d="M 40 44 L 70 62" stroke="#e9d3a6" stroke-width="5" stroke-linecap="round"/></g></g>
    <!-- Becken -->
    <g class="dr-hat"><ellipse cx="740" cy="398" rx="42" ry="8" fill="url(#bd-cymbal)"/><ellipse cx="740" cy="406" rx="42" ry="8" fill="url(#bd-cymbal)" opacity="0.8"/></g>
    <line x1="740" y1="406" x2="740" y2="520" stroke="#888" stroke-width="4"/>
    <g class="dr-crash"><ellipse cx="1010" cy="470" rx="58" ry="10" fill="url(#bd-cymbal)" transform="rotate(-10 1010 470)"/></g>
    <line x1="1010" y1="470" x2="1010" y2="560" stroke="#888" stroke-width="4"/>
    <!-- Trommeln -->
    <rect x="792" y="420" width="44" height="30" rx="6" fill="#ff2d8a"/><ellipse cx="814" cy="420" rx="22" ry="6" fill="url(#bd-drum)"/>
    <rect x="884" y="420" width="44" height="30" rx="6" fill="#ff2d8a"/><ellipse cx="906" cy="420" rx="22" ry="6" fill="url(#bd-drum)"/>
    <rect x="930" y="470" width="50" height="38" rx="6" fill="#ff2d8a"/><ellipse cx="955" cy="470" rx="25" ry="7" fill="url(#bd-drum)"/>
    <g class="dr-kick"><circle cx="860" cy="470" r="62" fill="#ff2d8a"/><circle cx="860" cy="470" r="52" fill="url(#bd-drum)"/><polygon points="860,438 890,492 830,492" fill="#ff2d8a"/><circle cx="886" cy="442" r="9" fill="#ffc23d"/></g>
  </g>

  <!-- Gitarrist (links) -->
  <g class="guitarist">
    <g class="gt-body">
      <rect x="374" y="470" width="20" height="130" rx="8" fill="#1d1d2b"/><rect x="408" y="470" width="20" height="130" rx="8" fill="#1d1d2b"/>
      <rect x="364" y="380" width="74" height="104" rx="26" fill="#e23b6f"/>
      <g class="gt-head"><circle cx="400" cy="346" r="32" fill="#c99272"/><path d="M 366 344 Q 364 304 400 306 Q 440 304 434 352 L 428 336 Q 412 322 392 326 Q 376 330 372 360 Z" fill="#f2d16b"/><circle cx="392" cy="348" r="3" fill="#2a1a12"/><circle cx="412" cy="348" r="3" fill="#2a1a12"/><path d="M 392 362 Q 402 368 412 362" stroke="#6a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <!-- Gitarre -->
      <g transform="rotate(-24 400 470)"><rect x="300" y="462" width="150" height="10" rx="3" fill="#5a3a1a"/><rect x="292" y="458" width="20" height="18" rx="3" fill="#2a1a0a"/><path d="M 440 445 C 470 430 500 440 498 462 C 520 466 522 492 500 498 C 500 520 468 524 446 506 C 426 520 410 500 420 482 C 406 470 420 450 440 445 Z" fill="#1fd6f2" stroke="#0a3c46" stroke-width="3"/><circle cx="462" cy="474" r="8" fill="#0a3c46"/></g>
      <path d="M 380 404 L 352 450 L 318 444" stroke="#c99272" stroke-width="14" stroke-linecap="round" fill="none"/>
      <g transform="translate(424 404)"><g class="gt-arm"><path d="M 0 0 L 36 44" stroke="#e23b6f" stroke-width="16" stroke-linecap="round"/><path d="M 36 44 L 46 70" stroke="#c99272" stroke-width="13" stroke-linecap="round"/></g></g>
    </g>
  </g>

  <!-- Keyboarderin -->
  <g class="keys">
    <rect x="566" y="384" width="68" height="96" rx="24" fill="#16a3b8"/>
    <g class="kb-head"><circle cx="600" cy="350" r="30" fill="#8d5a3c"/><path d="M 568 352 Q 560 300 600 304 Q 642 300 634 352 Q 640 392 620 396 L 622 340 Q 600 326 580 340 L 582 396 Q 560 392 568 352 Z" fill="#1a1010"/><circle cx="591" cy="352" r="3" fill="#fff"/><circle cx="609" cy="352" r="3" fill="#fff"/><path d="M 592 366 Q 600 372 608 366" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <g class="kb-hand-l"><path d="M 576 410 L 548 462" stroke="#16a3b8" stroke-width="14" stroke-linecap="round"/><circle cx="548" cy="464" r="8" fill="#8d5a3c"/></g>
    <g class="kb-hand-r"><path d="M 624 410 L 648 462" stroke="#16a3b8" stroke-width="14" stroke-linecap="round"/><circle cx="648" cy="464" r="8" fill="#8d5a3c"/></g>
    <rect x="500" y="466" width="200" height="22" rx="4" fill="#111"/>
    <g fill="#fff">${Array.from({ length: 14 }, (_, i) => `<rect x="${504 + i * 14}" y="470" width="12" height="14" rx="1.5"/>`).join('')}</g>
    <line x1="530" y1="488" x2="520" y2="600" stroke="#666" stroke-width="5"/><line x1="670" y1="488" x2="680" y2="600" stroke="#666" stroke-width="5"/>
  </g>

  <!-- Bassist (rechts) -->
  <g class="bassist">
    <g class="bs-body">
      <rect x="1212" y="470" width="20" height="130" rx="8" fill="#22243a"/><rect x="1246" y="470" width="20" height="130" rx="8" fill="#22243a"/>
      <rect x="1202" y="380" width="74" height="104" rx="26" fill="#f39b2b"/>
      <g class="bs-head"><circle cx="1240" cy="346" r="32" fill="#e8b48f"/><path d="M 1208 340 Q 1214 306 1240 308 Q 1268 306 1272 340 Q 1258 326 1240 328 Q 1222 326 1208 340 Z" fill="#7a2f14"/><rect x="1222" y="340" width="36" height="10" rx="5" fill="#111"/><path d="M 1230 362 Q 1240 368 1250 362" stroke="#6a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g transform="rotate(24 1240 470)"><rect x="1250" y="462" width="170" height="10" rx="3" fill="#3a2410"/><rect x="1410" y="456" width="22" height="22" rx="3" fill="#1a1008"/><path d="M 1258 445 C 1228 428 1196 440 1200 464 C 1178 470 1178 496 1200 500 C 1200 524 1234 528 1254 508 C 1276 522 1292 500 1280 482 C 1294 470 1280 448 1258 445 Z" fill="#ff2d8a" stroke="#5a0a2e" stroke-width="3"/></g>
      <path d="M 1262 404 L 1300 452 L 1340 470" stroke="#e8b48f" stroke-width="14" stroke-linecap="round" fill="none"/>
      <g transform="translate(1216 404)"><g class="bs-arm"><path d="M 0 0 L -18 52" stroke="#f39b2b" stroke-width="16" stroke-linecap="round"/><path d="M -18 52 L -4 78" stroke="#e8b48f" stroke-width="13" stroke-linecap="round"/></g></g>
    </g>
  </g>

  <!-- Hängender Bildschirm -->
  <g class="bd-screen">
    <rect x="610" y="0" width="380" height="24" fill="#1a1a22"/>
    <path d="M 600 24 L 1000 24 L 1000 262 L 600 262 Z" fill="url(#bd-screen)"/>
    <polygon points="600,24 660,24 600,120" fill="#ff8a7a"/><polygon points="1000,24 940,24 1000,120" fill="#ff8a7a"/>
    <rect x="630" y="44" width="340" height="196" fill="#050507"/>
    <text x="800" y="156" text-anchor="middle" class="bd-pause">PAUSE</text>
    <text x="800" y="196" text-anchor="middle" class="bd-pause-sub">Gleich geht’s weiter</text>
    <rect x="620" y="262" width="360" height="26" rx="4" fill="#17161e"/>
    <g fill="#ffd7e8">${Array.from({ length: 6 }, (_, i) => `<rect x="${660 + i * 50}" y="270" width="30" height="8" rx="3"/>`).join('')}</g>
  </g>

  <!-- Equalizer am Podest -->
  <g class="eq" fill="#1fd6f2" opacity="0.85">${Array.from({ length: 24 }, (_, i) => `<rect x="${236 + i * 48}" y="600" width="30" height="6" rx="3" fill="${i % 2 ? '#ff2d8a' : '#1fd6f2'}"/>`).join('')}</g>

  <!-- Moderationspult vorne -->
  <g class="bd-desk">
    <ellipse cx="800" cy="872" rx="360" ry="22" fill="#000" opacity="0.6"/>
    <polygon points="520,640 820,640 820,860 520,860" fill="url(#bd-desk-l)"/>
    <polygon points="820,640 1080,640 1080,860 820,860" fill="url(#bd-desk-r)"/>
    <polygon points="1080,640 1104,656 1104,852 1080,860" fill="#0a1f25"/>
    <polygon points="600,676 800,660 1020,676 980,800 760,820 640,780" fill="url(#bd-gold)"/>
    <polygon points="628,690 800,676 990,690 956,786 768,804 660,770" fill="#08080b"/>
    <polygon points="520,636 1080,636 1104,650 520,650" fill="#ffe1df" opacity="0.6"/>
  </g>
</svg>`;

export function bandScene() {
  const root = h('div', { class: 'band-scene' });
  root.innerHTML = SCENE;
  return root;
}
