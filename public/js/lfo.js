// The rack's LFO: a slow wave in time with the room's clock, patched (patch.js `lfo.out`) into the
// synth's pitch, its cutoff or its amp. Its RATE is a note value, from four bars to a 16th, so that a
// cycle is so many of the clock's steps; its SHAPE a sine, a triangle, a saw (falling: at its top as
// a cycle starts), a square (high for the cycle's first half) or random (a new value each cycle, held:
// a sample and hold); its DEPTH how far it moves what it is patched into (the knob's square, as a
// level's). It keeps its place by the clock's steps, not by its own: while the clock runs, each of its
// steps is set ahead on the audio clock with the clock's pulse (step), its cycles starting again when
// the clock does, so they fall on the beat at any tempo, and a rate turned to falls on it at once;
// while the clock is stopped it keeps on at the tempo by itself (run). Its wave is written ahead as
// the corners of its shape, the param ramping straight between them (a sine's sixteen to a cycle,
// near enough), into a ConstantSource's offset, out through its depth. The knobs are kept for the
// next visit (localStorage). Random's value for a cycle is drawn from the clock's run (its seed)
// and the cycle's number (clock.js dice), so that everyone playing one band hears the same.
import { dice } from './clock.js';
import { pageStorage } from './sound.js';

/** What random's draws are told apart from the arpeggiator's by, from the same seed. */
const SALT = 0x6c666f;

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */
/** @typedef {{ rate: number, shape: number, depth: number }} LfoKnobs */
/** @typedef {keyof LfoKnobs} LfoKnob */
/** @typedef {'sine' | 'triangle' | 'saw' | 'square' | 'random'} LfoShape */

/** The knobs, in the order the rack and the card show them. @type {readonly LfoKnob[]} */
export const LFO_KNOBS = Object.freeze(/** @type {LfoKnob[]} */ (['rate', 'shape', 'depth']));

/**
 * Its rates, the slowest first, as its knob turns: how many of the clock's steps a cycle takes, what
 * it is called on the rack, and in words.
 * @type {readonly { steps: number, label: string, name: string }[]}
 */
export const LFO_RATES = Object.freeze([
  { steps: 64, label: '4 BARS', name: '4 bars' },
  { steps: 32, label: '2 BARS', name: '2 bars' },
  { steps: 16, label: '1 BAR', name: '1 bar' },
  { steps: 8, label: '1/2', name: 'a half note' },
  { steps: 4, label: '1/4', name: 'a quarter note' },
  { steps: 2, label: '1/8', name: 'an 8th' },
  { steps: 1, label: '1/16', name: 'a 16th' },
]);

/** Its shapes, as its knob turns: what each is called on the rack, and in words. @type {readonly { id: LfoShape, label: string, name: string }[]} */
export const LFO_SHAPES = Object.freeze([
  { id: 'sine', label: 'SINE', name: 'Sine' },
  { id: 'triangle', label: 'TRIANGLE', name: 'Triangle' },
  { id: 'saw', label: 'SAW', name: 'Saw' },
  { id: 'square', label: 'SQUARE', name: 'Square' },
  { id: 'random', label: 'RANDOM', name: 'Random' },
]);

/** As it comes: a sine a bar long, halfway down. @type {Readonly<LfoKnobs>} */
export const DEFAULT_LFO = Object.freeze({ rate: 2 / 6, shape: 0, depth: 0.5 });

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Which of `count` places a stepped knob (0…1) is at. @param {number} k @param {number} count */
export const knobPlace = (k, count) => Math.round(clamp(k, 0, 1) * (count - 1));

/** The rate knob's rate. @param {number} k */
export const lfoRate = (k) => LFO_RATES[knobPlace(k, LFO_RATES.length)];

/** The shape knob's shape. @param {number} k */
export const lfoShape = (k) => LFO_SHAPES[knobPlace(k, LFO_SHAPES.length)];

/** The depth knob as the wave's gain: its square. @param {number} k */
export const depthGain = (k) => clamp(k, 0, 1) ** 2;

/**
 * How a knob of the LFO reads, in words: its rate's note value, its shape, its depth in percent.
 * @param {LfoKnob} name
 * @param {number} k
 */
export function lfoText(name, k) {
  if (name === 'rate') return lfoRate(k).name;
  if (name === 'shape') return lfoShape(k).name;
  return `${Math.round(clamp(k, 0, 1) * 100)}%`;
}

/**
 * Each shape's corners over a cycle (its phase, 0…1): [phase, value] in order, a straight line
 * between one and the next, two at one phase a jump. Random's are its held value's (times it).
 * @type {Readonly<Record<LfoShape, readonly (readonly number[])[]>>}
 */
const CORNERS = Object.freeze({
  sine: Array.from({ length: 17 }, (_, k) => [k / 16, k % 8 ? Math.sin((k / 8) * Math.PI) : 0]),
  triangle: [[0, 0], [0.25, 1], [0.75, -1], [1, 0]],
  saw: [[0, 1], [1, -1]],
  square: [[0, 1], [0.5, 1], [0.5, -1], [1, -1]],
  random: [[0, 1], [1, 1]],
});

/** A phase this near another is the same one. */
const EPS = 1e-9;

/**
 * A shape's value at a phase (0…1): on its line there, or at a jump the value after it (`before`:
 * the one before it, as the line coming to it from the left ends).
 * @param {LfoShape} shape
 * @param {number} phase
 * @param {boolean} [before]
 */
export function shapeAt(shape, phase, before = false) {
  const c = CORNERS[shape];
  if (before) {
    for (let i = 1; i < c.length; i++) {
      const [q, v] = c[i], [p, u] = c[i - 1];
      if (phase <= q + EPS && phase > p + EPS) return q - p < EPS ? v : u + ((v - u) * (phase - p)) / (q - p);
    }
    return c[0][1];
  }
  for (let i = c.length - 1; i > 0; i--) {
    const [q, v] = c[i - 1], [p, u] = c[i];
    if (phase >= q - EPS && phase < p - EPS) return p - q < EPS ? u : v + ((u - v) * (phase - q)) / (p - q);
  }
  return c[c.length - 1][1];
}

/** How many of its steps' places it remembers, for valueAt: those set ahead, and the one sounding. */
const RING = 8;

export class Lfo {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, random?: () => number }} [o] where the knobs are kept (localStorage); random's 0…1
   */
  constructor(sound, { storage = pageStorage(), key = 'lfo', random = Math.random } = {}) {
    this.sound = sound;
    /** @type {LfoKnobs} */
    this.knobs = { ...DEFAULT_LFO };
    /** @private @type {{ wave: ConstantSourceNode, out: GainNode } | null} */
    this._graph = null;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private */
    this._random = random;
    /**
     * The clock's run's seed (main.js sets it with each pulse): random's value for a cycle drawn
     * from it and the cycle's number (clock.js dice); NaN, from `random` instead.
     */
    this.seed = NaN;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    /** The step after the last one written, counting as the clock does (from its start), or on by itself. @private */
    this._pos = 0;
    /** When the last step written ends, on the audio clock: NaN before one, and after a jump. @private */
    this._at = NaN;
    /** The value written last, there. @private */
    this._last = 0;
    /** The cycle the held value is for (random's), NaN for none yet. @private */
    this._cycle = NaN;
    /** Random's value this cycle, -1…1. @private */
    this._held = 0;
    // The steps written, the latest RING: when each starts, how long it is, the phases it goes from
    // and to, its shape (an index in LFO_SHAPES) and random's value through it.
    /** @private */
    this._t = new Float64Array(RING).fill(Infinity);
    /** @private */
    this._d = new Float64Array(RING);
    /** @private */
    this._p0 = new Float64Array(RING);
    /** @private */
    this._p1 = new Float64Array(RING);
    /** @private */
    this._k = new Float64Array(RING);
    /** @private */
    this._s = new Uint8Array(RING);
    /** @private */
    this._ring = 0;
    this._load();
  }

  /** How many of the clock's steps a cycle takes now. */
  get steps() {
    return lfoRate(this.knobs.rate).steps;
  }

  /** Its shape now. */
  get shape() {
    return lfoShape(this.knobs.shape).id;
  }

  /**
   * Its output (the `lfo.out` jack's), made the first time it is asked for once the sound has woken;
   * else null.
   */
  output() {
    if (this._graph) return this._graph.out;
    const ctx = this.sound.ctx;
    if (!ctx) return null;
    const wave = ctx.createConstantSource();
    wave.offset.value = 0;
    const out = ctx.createGain();
    out.gain.value = depthGain(this.knobs.depth);
    wave.connect(out);
    wave.start(ctx.currentTime);
    this._graph = { wave, out };
    this._at = NaN; // nothing written on it yet
    return out;
  }

  /**
   * The clock's step n (counting from its start), falling at `t` on the audio clock and `d` seconds
   * long: that step of the wave, set ahead. Step 0 starts its cycle again.
   * @param {number} n
   * @param {number} t
   * @param {number} d
   */
  step(n, t, d) {
    if (!Number.isFinite(n) || !Number.isFinite(t) || !(d > 0)) return;
    this._write(Math.max(0, Math.floor(n)), t, d);
  }

  /**
   * While the clock is stopped: its steps on by itself, `d` seconds each (the clock's tempo), set
   * ahead from where it got to (or from now, if that has passed) until `until`.
   * @param {number} now
   * @param {number} until
   * @param {number} d
   */
  run(now, until, d) {
    if (!Number.isFinite(now) || !Number.isFinite(until) || !(d > 0)) return;
    let t = this._at >= now ? this._at : now;
    while (t < until) {
      this._write(this._pos, t, d);
      t = this._at;
    }
  }

  /**
   * Its value (-1…1, before its depth) at `t` on the audio clock, from the steps written: NaN before
   * there are any. The last one's end, held, after them.
   * @param {number} t
   */
  valueAt(t) {
    let best = -1;
    for (let i = 0; i < RING; i++) if (this._t[i] <= t && (best < 0 || this._t[i] > this._t[best])) best = i;
    if (best < 0) return NaN;
    const shape = LFO_SHAPES[this._s[best]].id, d = this._d[best], p0 = this._p0[best], p1 = this._p1[best];
    const f = Math.min(1, (t - this._t[best]) / d);
    return this._k[best] * shapeAt(shape, p0 + f * (p1 - p0), f >= 1);
  }

  /**
   * Sets a knob (0…1), kept a moment later (a knob turned keeps changing): its rate and shape from
   * the next step written, its depth at once.
   * @param {LfoKnob} name
   * @param {number} value
   */
  setKnob(name, value) {
    if (!LFO_KNOBS.includes(name) || !Number.isFinite(value)) return;
    this.knobs[name] = clamp(value, 0, 1);
    this._apply();
    this._saveSoon();
  }

  /** The knobs as it comes. */
  reset() {
    this.knobs = { ...DEFAULT_LFO };
    this._apply();
    this._saveSoon();
  }

  /**
   * Writes step n of the wave from `t` for `d` seconds: from where the last one ended if it ends at
   * t (a jump in the wave there set as one), else afresh (anything set from t on taken back first).
   * @private
   * @param {number} n
   * @param {number} t
   * @param {number} d
   */
  _write(n, t, d) {
    const s = knobPlace(this.knobs.shape, LFO_SHAPES.length), shape = LFO_SHAPES[s].id;
    const N = this.steps, i = n % N, cycle = (n - i) / N, offset = this._graph?.wave.offset;
    const fresh = !(Math.abs(t - this._at) < 1e-6);
    if (fresh) {
      offset?.cancelScheduledValues(t);
      this._cycle = NaN;
      // The steps set from t on are no more.
      for (let r = 0; r < RING; r++) if (this._t[r] >= t - 1e-9) this._t[r] = Infinity;
    }
    if (cycle !== this._cycle) {
      this._cycle = cycle;
      this._held = (Number.isFinite(this.seed) ? dice(this.seed + SALT, cycle) : this._random()) * 2 - 1;
    }
    const k = shape === 'random' ? this._held : 1, p0 = i / N, p1 = (i + 1) / N;
    const start = k * shapeAt(shape, p0);
    if (fresh || start !== this._last) offset?.setValueAtTime(start, t);
    // Its corners within the step, each at its time: a line to it, or a jump there.
    const corners = CORNERS[shape];
    for (let c = 1; c < corners.length - 1; c++) {
      const [q, v] = corners[c];
      if (q <= p0 + EPS || q >= p1 - EPS) continue;
      const at = t + (q - p0) * N * d;
      if (Math.abs(q - corners[c - 1][0]) < EPS) offset?.setValueAtTime(k * v, at);
      else offset?.linearRampToValueAtTime(k * v, at);
    }
    const end = k * shapeAt(shape, p1, true);
    offset?.linearRampToValueAtTime(end, t + d);
    const r = this._ring;
    this._t[r] = t;
    this._d[r] = d;
    this._p0[r] = p0;
    this._p1[r] = p1;
    this._k[r] = k;
    this._s[r] = s;
    this._ring = (r + 1) % RING;
    this._pos = n + 1;
    this._at = t + d;
    this._last = end;
  }

  /** The depth to its knob, eased (no click). @private */
  _apply() {
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    g.out.gain.setTargetAtTime(depthGain(this.knobs.depth), ctx.currentTime, 0.02);
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      for (const name of LFO_KNOBS) if (Number.isFinite(s?.[name])) this.knobs[name] = clamp(s[name], 0, 1);
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps now what was to be kept a moment later, if anything was (the page put away). */
  flush() {
    if (this._saving !== undefined) this.save();
  }

  /** Keeps the knobs now (localStorage). */
  save() {
    clearTimeout(this._saving);
    this._saving = undefined;
    try {
      this._storage?.setItem(this._key, JSON.stringify(this.knobs));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
