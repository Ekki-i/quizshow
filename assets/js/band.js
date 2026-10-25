// Pause: Moderationspult vorne, dahinter eine animierte Live-Band, die zu
// einem eigenen Pausen-Song spielt. Der Song wird mit WebAudio erzeugt
// (keine fremde Musik). Musik und Animation laufen über denselben Takt:
// jeder Schlag, Anschlag und jedes Kopfnicken sitzt auf dem Beat.
// Ohne Ton (Vorschau, Ton nicht aktiviert) läuft die Band im selben Takt stumm.

import { h, mediaUrl } from './client.js';
import { bandSceneSvg, poseBand } from './band-scene.js';

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

// ---------------------------------------------------------------------------
// Eigene Lieder: Playlist nacheinander, in Endlosschleife. Die Musik wird
// mitgehört (AnalyserNode), die Band reagiert auf Bass, Snare und Hi-Hat.

let player = null;

function createSongPlayer(ctx, songs) {
  const el = new Audio();
  el.preload = 'auto';
  const source = ctx.createMediaElementSource(el);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;
  source.connect(gain).connect(analyser).connect(ctx.destination);
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
  const bins = new Uint8Array(analyser.frequencyBinCount);
  const hz = ctx.sampleRate / analyser.fftSize;
  const band = (lo, hi) => {
    let sum = 0, n = 0;
    for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(bins.length - 1, Math.ceil(hi / hz)); i++) { sum += bins[i]; n++; }
    return n ? sum / n / 255 : 0;
  };
  // Einsatz-Erkennung: Pegel deutlich über dem gleitenden Mittel = Schlag.
  const env = { kick: 0, snare: 0, hat: 0, stab: 0, lead: 0, bass: 0 };
  const avg = { low: 0, mid: 0, high: 0, hmid: 0 };
  let lastT = performance.now() / 1000;
  let beatPhase = 0, lastBeat = 0, beatLen = 0.55;
  let index = 0, stopped = false;

  async function playAt(i) {
    if (stopped || !songs.length) return;
    index = ((i % songs.length) + songs.length) % songs.length;
    const song = songs[index];
    const url = await mediaUrl(song.id);
    if (stopped) return;
    if (!url) return playAt(index + 1);
    el.src = url;
    document.querySelectorAll('.band-scene .bd-pause-sub').forEach((n) => (n.textContent = `♪ ${song.name.replace(/\.[a-z0-9]{2,4}$/i, '')}`));
    el.play().catch(() => {});
  }
  el.addEventListener('ended', () => playAt(index + 1));
  el.addEventListener('error', () => setTimeout(() => playAt(index + 1), 300));
  playAt(0);

  return {
    ctx, songs, key: songs.map((m) => m.id).join(','),
    levels() {
      analyser.getByteFrequencyData(bins);
      const now = performance.now() / 1000;
      const dt = Math.min(0.1, now - lastT);
      lastT = now;
      const low = band(35, 140), mid = band(180, 900), hmid = band(1500, 4500), high = band(6000, 14000);
      const k = Math.exp(-dt * 1.5);
      avg.low = avg.low * k + low * (1 - k);
      avg.mid = avg.mid * k + mid * (1 - k);
      avg.hmid = avg.hmid * k + hmid * (1 - k);
      avg.high = avg.high * k + high * (1 - k);
      const decay = (v, rate) => v * Math.exp(-dt * rate);
      for (const key of Object.keys(env)) env[key] = decay(env[key], key === 'hat' ? 16 : key === 'lead' ? 4 : 9);
      if (low > avg.low * 1.18 + 0.03 && now - lastBeat > 0.22) {
        env.kick = 1;
        const gap = now - lastBeat;
        if (gap > 0.3 && gap < 1.2) beatLen = beatLen * 0.8 + gap * 0.2;
        lastBeat = now;
        beatPhase = 0;
      }
      if (hmid > avg.hmid * 1.2 + 0.02) env.snare = Math.max(env.snare, Math.min(1, (hmid - avg.hmid) * 6));
      if (high > avg.high * 1.15 + 0.01) env.hat = Math.max(env.hat, Math.min(1, (high - avg.high) * 8));
      env.bass = Math.max(env.bass, Math.min(1, low * 1.2));
      env.stab = Math.max(env.stab, Math.min(1, (mid - avg.mid) * 5));
      env.lead = Math.max(env.lead, Math.min(1, mid * 1.1));
      beatPhase += dt / beatLen;
      const beat = (now - lastBeat) / beatLen;
      return { ...env, beat: beatPhase, pos: now / STEP, bar: 0, bob: Math.abs(Math.cos(Math.PI * Math.min(beat, 1) / 2)) * (0.6 + 0.4 * env.kick) };
    },
    stop() {
      stopped = true;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => { el.pause(); el.removeAttribute('src'); el.load(); source.disconnect(); }, 900);
    },
  };
}

// ctx: AudioContext oder null (stumm). songs: eigene Lieder der Pause (oder leer
// = eingebauter Song). Mehrfachaufruf mit denselben Liedern ist harmlos.
export function startPause(ctx, songs = []) {
  const key = (songs || []).map((m) => m.id).join(',');
  if (ctx && songs && songs.length) {
    if (!player || player.ctx !== ctx || player.key !== key) {
      if (player) player.stop();
      if (engine) { engine.stop(); engine = null; }
      if (ctx.state === 'suspended') ctx.resume();
      player = createSongPlayer(ctx, songs);
    }
  } else if (ctx) {
    if (player) { player.stop(); player = null; }
    if (!engine || engine.ctx !== ctx) {
      if (engine) engine.stop();
      if (ctx.state === 'suspended') ctx.resume();
      engine = createEngine(ctx);
    }
  }
  startLoop();
}

export function stopPause() {
  if (engine) engine.stop();
  engine = null;
  if (player) player.stop();
  player = null;
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
    if (player) applyPose(root, player.levels());
    else animate(root, clock() / STEP);
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
  const leadSteps = (LEAD[bar] || []).map((l) => l[0]);
  applyPose(root, {
    pos, beat, bar,
    kick: hit(KICK, pos, 9),
    snare: hit(SNARE, pos, 9),
    hat: hit(HAT, pos, 18),
    stab: hit(STAB, pos, 11),
    bass: hit(BASS.map((b) => b[0]), pos, 8),
    lead: leadSteps.length ? hit(leadSteps, pos, 5) : 0,
    bob: Math.abs(Math.sin(Math.PI * beat)),
  });
}

// Pose der Band aus Pegeln (eingebauter Song oder Analyse eigener Lieder).
function applyPose(root, lv) {
  poseBand(root, lv);
}

// ---------------------------------------------------------------------------
// Szene (Bühne und Musiker in band-scene.js)

// coins: Münzen, die noch auf dem Moderationspult stehen (3 minus vergebene).
export function bandScene(coins = 3) {
  const root = h('div', { class: 'band-scene' });
  root.innerHTML = bandSceneSvg(coins);
  return root;
}
