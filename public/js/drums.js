// The drum board's kit (board.js lays the board out, kit.js builds it): twelve analog drums,
// synthesized as the drum machines of the early 1980s made theirs, with nothing to download: a sine
// whose pitch falls for the kick and the toms, noise through filters for the snare's rattle and the
// clap, six square waves at clashing pitches through filters for the hi-hats and the cymbals (the
// 808's), two for the cowbell. Each has three knobs, as the machines had: pitch, decay and tone, 0…1,
// 0.5 the drum as it comes. A drum played again cuts its last note short, as a machine's one circuit
// per drum does, and the two hi-hats share one, so the closed one stops the open one ringing.
//
// PADS: where each sits on the board (its row, 0 nearest the player, and its column), its key on a
// computer's keyboard (by where the key is, whatever the layout: KeyboardEvent.code; the rows as the
// board's, 1–4 farthest, A–F nearest), the General MIDI drum notes that play it (a pad controller's
// first bank, 36–51, plays all but the cowbell, 56), how long it rings at decay 0.5, and the colour
// it lights up in.
// Drums keeps each pad's knobs (localStorage) and plays a pad into the sound's 'drums' channel.
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Note} Note */

/**
 * A pad's three knobs, each 0…1: 0.5 is the drum as it comes.
 * @typedef {{ pitch: number, decay: number, tone: number }} Knobs
 */
/** @typedef {keyof Knobs} Knob */

/** The knobs, in the order the board and the card show them. @type {readonly Knob[]} */
export const KNOBS = Object.freeze(/** @type {Knob[]} */ (['pitch', 'decay', 'tone']));

/** @type {Readonly<Knobs>} */
export const DEFAULT_KNOBS = Object.freeze({ pitch: 0.5, decay: 0.5, tone: 0.5 });

/** The pads on the board: four columns and three rows. */
export const COLUMNS = 4;
export const ROWS = 3;

/**
 * @typedef {object} Pad
 * @property {string} id
 * @property {string} name
 * @property {number} row 0 nearest the player
 * @property {number} col 0 on the left
 * @property {string} key KeyboardEvent.code
 * @property {number[]} notes General MIDI drum notes, the usual one first
 * @property {number} decay seconds it rings, at decay 0.5
 * @property {string} color '#rrggbb', lit up
 * @property {string} [choke] the circuit it shares (the hi-hats'), else its own
 */

/** @type {readonly Pad[]} */
export const PADS = Object.freeze([
  { id: 'kick', name: 'Kick', row: 0, col: 0, key: 'KeyA', notes: [36, 35], decay: 0.5, color: '#ff7a45' },
  { id: 'snare', name: 'Snare', row: 0, col: 1, key: 'KeyS', notes: [38, 40], decay: 0.22, color: '#ffb04a' },
  { id: 'closed-hat', name: 'Closed hat', row: 0, col: 2, key: 'KeyD', notes: [42, 44], decay: 0.07, color: '#ffe27a', choke: 'hat' },
  { id: 'open-hat', name: 'Open hat', row: 0, col: 3, key: 'KeyF', notes: [46], decay: 0.5, color: '#ffe27a', choke: 'hat' },
  { id: 'low-tom', name: 'Low tom', row: 1, col: 0, key: 'KeyQ', notes: [41, 43], decay: 0.5, color: '#5cc8a8' },
  { id: 'mid-tom', name: 'Mid tom', row: 1, col: 1, key: 'KeyW', notes: [45, 47], decay: 0.42, color: '#5cc8a8' },
  { id: 'high-tom', name: 'High tom', row: 1, col: 2, key: 'KeyE', notes: [48, 50], decay: 0.36, color: '#5cc8a8' },
  { id: 'clap', name: 'Clap', row: 1, col: 3, key: 'KeyR', notes: [39], decay: 0.25, color: '#c99cff' },
  { id: 'rim', name: 'Rim', row: 2, col: 0, key: 'Digit1', notes: [37], decay: 0.06, color: '#c99cff' },
  { id: 'cowbell', name: 'Cowbell', row: 2, col: 1, key: 'Digit2', notes: [56], decay: 0.35, color: '#ffd27a' },
  { id: 'crash', name: 'Crash', row: 2, col: 2, key: 'Digit3', notes: [49, 57, 55, 52], decay: 1.8, color: '#fff0b0' },
  { id: 'ride', name: 'Ride', row: 2, col: 3, key: 'Digit4', notes: [51, 59, 53], decay: 2.2, color: '#fff0b0' },
]);

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A key's name on its cap: 'KeyA' is A, 'Digit1' is 1. @param {string} code */
export const keyLabel = (code) => code.replace(/^(Key|Digit)/, '');

/** The pad a key plays (keyOf's name for it: its code), else -1. @param {string} code */
export const padForKey = (code) => PADS.findIndex((p) => p.key === code);

/** The pad a General MIDI drum note plays, else -1. @param {number} note */
export const padForNote = (note) => PADS.findIndex((p) => p.notes.includes(note));

/**
 * The pad `dc` columns right and `dr` rows farther from pad i (a TV's arrows), staying on the board.
 * @param {number} i
 * @param {number} dc
 * @param {number} dr
 */
export function movePad(i, dc, dr) {
  const p = PADS[i] ?? PADS[0];
  const col = clamp(p.col + dc, 0, COLUMNS - 1), row = clamp(p.row + dr, 0, ROWS - 1);
  return PADS.findIndex((q) => q.col === col && q.row === row);
}

/** The pitch knob as a ratio of the drum's own: an octave down at 0, an octave up at 1. @param {number} k */
export const pitchRatio = (k) => 2 ** ((k - 0.5) * 2);

/** The decay knob as a ratio of the drum's own: about a third at 0, nearly three times at 1. @param {number} k */
export const decayRatio = (k) => 2 ** ((k - 0.5) * 3);

/**
 * How a knob of pad i reads, in words: its pitch in semitones from the drum's own, how long it
 * rings, how bright it is.
 * @param {number} i
 * @param {Knob} name
 * @param {number} k
 */
export function knobText(i, name, k) {
  if (name === 'pitch') {
    const s = Math.round((k - 0.5) * 24);
    return s === 0 ? 'as it comes' : `${s > 0 ? '+' : '−'}${Math.abs(s)} semitone${Math.abs(s) === 1 ? '' : 's'}`;
  }
  if (name === 'decay') {
    const s = (PADS[i]?.decay ?? 0.5) * decayRatio(k);
    return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`;
  }
  return `${Math.round(k * 100)}% bright`;
}

/** A note's loudness for a velocity 0…1: never quite silent, and most of its range in the harder hits. @param {number} v */
export const velocityGain = (v) => 0.08 + 0.92 * clamp(v, 0, 1) ** 1.5;

/**
 * Each drum's level at full velocity, so the kit sounds even: the kick and the toms carry the most,
 * the metal the least (it has more of the high frequencies the ear hears best).
 * @type {Readonly<Record<string, number>>}
 */
export const LEVELS = Object.freeze({
  kick: 0.95, snare: 0.62, 'closed-hat': 0.42, 'open-hat': 0.36, 'low-tom': 0.8, 'mid-tom': 0.78, 'high-tom': 0.74,
  clap: 0.7, rim: 0.55, cowbell: 0.42, crash: 0.36, ride: 0.3,
});

/**
 * What a drum's recipe makes its note with, all starting at t (maker()).
 * @typedef {object} Maker
 * @property {BaseAudioContext} ctx
 * @property {number} t when the note starts
 * @property {(type: OscillatorType, freq: number) => OscillatorNode} osc an oscillator at freq Hz
 * @property {() => AudioBufferSourceNode} noise white noise, from somewhere in the buffer
 * @property {(type: BiquadFilterType, freq: number, q?: number) => BiquadFilterNode} filter
 * @property {(peak: number, attack: number, decay: number) => GainNode} env a gain up to peak in
 *   `attack` seconds, then down to a thousandth of it (-60 dB) over `decay`
 * @property {() => GainNode} gain a gain at 0, for a recipe's own envelope (then until())
 * @property {(time: number) => void} until the note sounds at least until then
 */

/**
 * The knobs as a recipe takes them: the pitch as a ratio (p), the decay in seconds (d), the tone 0…1.
 * @typedef {{ p: number, d: number, tone: number }} Shape
 */

/** @typedef {(m: Maker, out: AudioNode, s: Shape) => void} Recipe */

/** The 808's six square waves for the metal, in Hz: pitches that clash into a shimmer. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

/**
 * The six square waves at `scale` times their pitches, mixed.
 * @param {Maker} m
 * @param {number} scale
 */
function metal(m, scale) {
  const mix = m.ctx.createGain();
  mix.gain.value = 1 / METAL.length;
  for (const f of METAL) m.osc('square', f * scale).connect(mix);
  return mix;
}

/**
 * A tom tuned to f0: a sine falling to its pitch, and the stick on its head.
 * @param {number} f0
 * @returns {Recipe}
 */
const tom = (f0) => (m, out, { p, d, tone }) => {
  const f = f0 * p;
  const body = m.osc('sine', f * 1.75);
  body.frequency.exponentialRampToValueAtTime(f, m.t + 0.08);
  body.connect(m.env(1, 0.002, d)).connect(out);
  m.noise().connect(m.filter('lowpass', 1500 + 3500 * tone)).connect(m.env(0.12 + 0.25 * tone, 0.0005, 0.03)).connect(out);
};

/** @type {(m: Maker, out: AudioNode, s: Shape) => void} */
const hat = (m, out, { p, d, tone }) => {
  metal(m, p).connect(m.filter('bandpass', 9000 + 2000 * tone, 1.2)).connect(m.filter('highpass', 5500 + 3500 * tone)).connect(m.env(1, 0.001, d)).connect(out);
};

/** How each drum is made. @type {Readonly<Record<string, Recipe>>} */
export const RECIPES = Object.freeze({
  // A sine falling fast from high to its pitch (the knob), and the beater's click (more with tone).
  kick: (m, out, { p, d, tone }) => {
    const f = 50 * p;
    const body = m.osc('sine', f * (2.5 + 2.5 * tone));
    body.frequency.exponentialRampToValueAtTime(f, m.t + 0.05);
    body.connect(m.env(1, 0.002, d)).connect(out);
    m.noise().connect(m.filter('highpass', 2000 + 3000 * tone)).connect(m.env(0.06 + 0.3 * tone, 0.0005, 0.015)).connect(out);
  },
  // Two triangles for the drum, and the wires' rattle: noise, brighter with tone.
  snare: (m, out, { p, d, tone }) => {
    const f = 185 * p;
    for (const [ratio, peak] of [[1, 0.6], [1.6, 0.32]]) {
      const o = m.osc('triangle', f * ratio * 1.3);
      o.frequency.exponentialRampToValueAtTime(f * ratio, m.t + 0.025);
      o.connect(m.env(peak * (1.1 - 0.5 * tone), 0.001, d * 0.5)).connect(out);
    }
    m.noise().connect(m.filter('highpass', 1000 + 2500 * tone)).connect(m.filter('lowpass', 6000 + 6000 * tone)).connect(m.env(0.55 + 0.35 * tone, 0.001, d)).connect(out);
  },
  'closed-hat': hat,
  'open-hat': hat,
  'low-tom': tom(85),
  'mid-tom': tom(125),
  'high-tom': tom(170),
  // Noise through a band-pass: three hands a hundredth of a second apart, then the room's tail.
  clap: (m, out, { p, d, tone }) => {
    const g = m.gain(), gain = g.gain, t = m.t;
    for (const [at, peak] of [[0, 1], [0.011, 0.85], [0.022, 0.7]]) {
      gain.setValueAtTime(peak, t + at);
      gain.setTargetAtTime(0, t + at, 0.0035);
    }
    gain.setValueAtTime(0.75, t + 0.032);
    gain.setTargetAtTime(0, t + 0.032, d / 6.9);
    m.until(t + 0.032 + d);
    m.noise().connect(m.filter('bandpass', (850 + 900 * tone) * p, 1.6)).connect(m.filter('highpass', 500)).connect(g).connect(out);
  },
  // A sharp high tick and a lower knock, very short, and a snap of noise.
  rim: (m, out, { p, d, tone }) => {
    m.osc('triangle', 1700 * p).connect(m.filter('highpass', 600)).connect(m.env(0.8, 0.0005, d)).connect(out);
    m.osc('sine', 455 * p).connect(m.env(0.45, 0.0005, d * 1.3)).connect(out);
    m.noise().connect(m.filter('bandpass', 2500 + 3500 * tone, 1.4)).connect(m.env(0.3 + 0.3 * tone, 0.0005, 0.012)).connect(out);
  },
  // Two square waves through a band-pass: struck loud for a moment, then a ringing tail.
  cowbell: (m, out, { p, d, tone }) => {
    const mix = m.ctx.createGain();
    mix.gain.value = 0.5;
    m.osc('square', 540 * p).connect(mix);
    m.osc('square', 800 * p).connect(mix);
    const g = m.gain(), t = m.t;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.001);
    g.gain.setTargetAtTime(0.32, t + 0.001, 0.012);
    g.gain.setTargetAtTime(0, t + 0.04, d / 6.9);
    m.until(t + 0.04 + d);
    mix.connect(m.filter('bandpass', 1800 + 1800 * tone, 1.8)).connect(g).connect(out);
  },
  // The metal higher, and noise, both through a high-pass, long.
  crash: (m, out, { p, d, tone }) => {
    metal(m, 1.45 * p).connect(m.filter('highpass', 5000 + 3000 * tone)).connect(m.env(0.7, 0.002, d)).connect(out);
    m.noise().connect(m.filter('highpass', 5500 + 3000 * tone)).connect(m.env(0.5, 0.002, d * 0.75)).connect(out);
  },
  // The metal through a narrow band-pass, the ping, with a little wash of noise.
  ride: (m, out, { p, d, tone }) => {
    metal(m, 1.2 * p).connect(m.filter('bandpass', 3500 + 3500 * tone, 2.5)).connect(m.env(0.9, 0.001, d)).connect(out);
    m.noise().connect(m.filter('highpass', 8000)).connect(m.env(0.15, 0.001, d * 0.4)).connect(out);
  },
});

/**
 * What a recipe makes its note with: each source started at t, all kept to be stopped together.
 * @param {BaseAudioContext} ctx
 * @param {AudioBuffer} noise
 * @param {number} t
 */
function maker(ctx, noise, t) {
  /** @type {AudioScheduledSourceNode[]} */
  const sources = [];
  let end = t;
  /** @type {Maker} */
  const m = {
    ctx,
    t,
    osc(type, freq) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.start(t);
      sources.push(o);
      return o;
    },
    noise() {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(t, Math.random() * noise.duration);
      sources.push(s);
      return s;
    },
    filter(type, freq, q = Math.SQRT1_2) {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = Math.min(freq, ctx.sampleRate * 0.45);
      f.Q.value = q;
      return f;
    },
    env(peak, attack, decay) {
      const g = m.gain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setTargetAtTime(0, t + attack, decay / 6.9);
      m.until(t + attack + decay);
      return g;
    },
    gain() {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    },
    until(time) {
      end = Math.max(end, time);
    },
  };
  return { m, sources, end: () => end };
}

/**
 * Plays pad i into `out` at `when`, `velocity` 0…1 loud (harder is a little brighter too), as its
 * knobs set it: its recipe's sources through a gain of its own, stopped once it has died away, and
 * out of the graph then. Returns the note, for the sound to keep (Sound.add).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} out
 * @param {AudioBuffer} noise a second or so of white noise
 * @param {number} i
 * @param {number} velocity
 * @param {Knobs} knobs
 * @param {number} when
 * @returns {Note}
 */
export function playDrum(ctx, out, noise, i, velocity, knobs, when) {
  const pad = PADS[i];
  const v = clamp(velocity, 0, 1);
  const level = (LEVELS[pad.id] ?? 0.5) * velocityGain(v);
  const gain = ctx.createGain();
  gain.gain.value = level;
  gain.connect(out);
  const { m, sources, end } = maker(ctx, noise, when);
  RECIPES[pad.id](m, gain, { p: pitchRatio(knobs.pitch), d: pad.decay * decayRatio(knobs.decay), tone: clamp(knobs.tone + (v - 0.75) * 0.3, 0, 1) });
  const stop = end() + 0.02;
  for (const s of sources) s.stop(stop);
  if (sources[0]) sources[0].onended = () => gain.disconnect();
  return { end: stop, out: gain, level, sources };
}

/** The drums: each pad's knobs, kept for the next visit, the pad they turn, and playing a pad. */
export class Drums {
  /**
   * @param {Sound} sound
   * @param {{ storage?: import('./sound.js').Store | null, key?: string }} [o] where the knobs are kept (localStorage)
   */
  constructor(sound, { storage = pageStorage(), key = 'drums' } = {}) {
    this.sound = sound;
    /** Each pad's knobs, in PADS's order. @type {Knobs[]} */
    this.knobs = PADS.map(() => ({ ...DEFAULT_KNOBS }));
    /** The pad the knobs turn: the last one played, or chosen. */
    this.selected = 0;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /**
   * Plays pad i now, `velocity` 0…1 loud: the note, or null where there is no sound (no Web Audio).
   * @param {number} i
   * @param {number} [velocity]
   */
  hit(i, velocity = 0.8) {
    const ctx = this.sound.wake();
    const out = this.sound.channel('drums');
    const pad = PADS[i];
    if (!ctx || !out || !this.sound.noise || !pad) return null;
    const note = playDrum(ctx, out, this.sound.noise, i, velocity, this.knobs[i], ctx.currentTime);
    this.sound.add(note, pad.choke ?? pad.id);
    return note;
  }

  /**
   * Sets a knob of pad i (0…1), kept a moment later (a knob turned keeps changing).
   * @param {number} i
   * @param {Knob} name
   * @param {number} value
   */
  setKnob(i, name, value) {
    const k = this.knobs[i];
    if (!k || !Number.isFinite(value)) return;
    k[name] = clamp(value, 0, 1);
    this._saveSoon();
  }

  /** Pad i's knobs back as the drum comes. @param {number} i */
  reset(i) {
    if (!this.knobs[i]) return;
    this.knobs[i] = { ...DEFAULT_KNOBS };
    this._saveSoon();
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      PADS.forEach((p, i) => {
        for (const name of KNOBS) {
          const v = s?.[p.id]?.[name];
          if (Number.isFinite(v)) this.knobs[i][name] = clamp(v, 0, 1);
        }
      });
    } catch {
      // none kept, or not readable: as they come
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the knobs now (localStorage). */
  save() {
    clearTimeout(this._saving);
    /** @type {Record<string, Knobs>} */
    const out = {};
    PADS.forEach((p, i) => {
      out[p.id] = this.knobs[i];
    });
    try {
      this._storage?.setItem(this._key, JSON.stringify(out));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
