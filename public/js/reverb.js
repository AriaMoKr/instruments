// The rack's reverb: a plate's, any sound patched into it (patch.js `reverb.in`), the reverb into its
// channel (sound.js, 'reverb') after what went in, which is still heard as it was (a sound patched
// into it, as into a delay, goes on into its own channel too). A plate rings densely from the first
// moment and dies away evenly, its highs sooner than its lows: so its sound here is a ConvolverNode
// playing a response made of noise (a different noise each side, so that it is wide), dying away to a
// thousandth (60 dB down) over its SIZE, from a third of a second to nearly five, through a low-pass
// that closes as it dies, as far as DAMP says; a longer one rings a little louder, as a larger plate's
// would. LEVEL is how loud the reverb is. Turning SIZE or DAMP makes a new response once the knob
// rests a moment, faded over from the one before. The knobs are kept for the next visit
// (localStorage).
import { pageStorage } from './sound.js';
import { levelGain } from './delay.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */
/** @typedef {{ size: number, damp: number, level: number }} ReverbKnobs */
/** @typedef {keyof ReverbKnobs} ReverbKnob */

/** The knobs, in the order the rack and the card show them. @type {readonly ReverbKnob[]} */
export const REVERB_KNOBS = Object.freeze(/** @type {ReverbKnob[]} */ (['size', 'damp', 'level']));

/** As it comes: a plate ringing a little over a second, its highs dying sooner, under what went in. @type {Readonly<ReverbKnobs>} */
export const DEFAULT_REVERB = Object.freeze({ size: 0.5, damp: 0.5, level: 0.5 });

/** Its response's low-pass where it starts (Hz): as open as a plate is bright. */
export const BRIGHT = 14000;

/** How long a knob rests before its response is made (seconds), and how long the old fades out over. */
const REST = 0.15, FADE = 0.05;

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** SIZE as how long it rings, in seconds, until 60 dB down: a third of a second to nearly five. @param {number} k */
export const reverbSeconds = (k) => 0.3 * 2 ** (4 * clamp(k, 0, 1));

/** DAMP as where the low-pass has closed to by its end (Hz): from as open as it starts to 110 Hz. @param {number} k */
export const dampHz = (k) => BRIGHT * 2 ** (-7 * clamp(k, 0, 1));

/**
 * How a knob of the reverb reads, in words: its size as how long it rings, the rest in percent.
 * @param {ReverbKnob} name
 * @param {number} k
 */
export function reverbText(name, k) {
  if (name === 'size') return `${reverbSeconds(k).toFixed(1)} s`;
  return `${Math.round(clamp(k, 0, 1) * 100)}%`;
}

/**
 * A plate's response for a context: two channels of noise `seconds` long, each its own, dying away
 * to 60 dB down at its end through a one-pole low-pass that closes from BRIGHT to dampHz(damp) as it
 * goes; faded in over its first moment and out over its last, and as much in it (the sum of its
 * squares, each side) as the square root of its length in seconds over 1.2 (a longer plate rings a
 * little louder).
 * @param {Pick<BaseAudioContext, 'sampleRate' | 'createBuffer'>} ctx
 * @param {number} seconds
 * @param {number} damp DAMP's knob, 0…1
 * @param {() => number} [random] 0…1
 */
export function impulse(ctx, seconds, damp, random = Math.random) {
  const rate = ctx.sampleRate, n = Math.max(2, Math.round(seconds * rate)), buffer = ctx.createBuffer(2, n, rate);
  const fall = Math.exp(-Math.log(1000) / n), close = (dampHz(damp) / BRIGHT) ** (1 / n);
  const fadeIn = Math.max(1, Math.round(0.0015 * rate)), fadeOut = Math.max(1, Math.min(Math.round(0.05 * rate), n >> 1));
  const energy = Math.sqrt(seconds / 1.2);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let y = 0, level = 1, hz = BRIGHT, a = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      if ((i & 63) === 0) a = 1 - Math.exp((-2 * Math.PI * hz) / rate);
      y += a * (random() * 2 - 1 - y);
      let v = y * level;
      if (i < fadeIn) v *= i / fadeIn;
      if (i >= n - fadeOut) v *= (n - 1 - i) / fadeOut;
      data[i] = v;
      sum += v * v;
      level *= fall;
      hz *= close;
    }
    const scale = sum > 0 ? Math.sqrt(energy / sum) : 0;
    for (let i = 0; i < n; i++) data[i] *= scale;
  }
  return buffer;
}

export class Reverb {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, channel?: string, random?: () => number }} [o] where the knobs are kept (localStorage), the channel (sound.js) it goes into; random's 0…1
   */
  constructor(sound, { storage = pageStorage(), key = 'reverb', channel = 'reverb', random = Math.random } = {}) {
    this.sound = sound;
    /** The channel (sound.js) the reverb goes into. */
    this.channel = channel;
    /** @type {ReverbKnobs} */
    this.knobs = { ...DEFAULT_REVERB };
    /** @private @type {{ input: GainNode, level: GainNode, wet: { convolver: ConvolverNode, fade: GainNode } } | null} */
    this._graph = null;
    /** @private the size and damping its response was made for */
    this._made = { size: NaN, damp: NaN };
    /** @private */
    this._random = random;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._resting = undefined;
    this._load();
  }

  /** How long it rings now, in seconds. */
  get seconds() {
    return reverbSeconds(this.knobs.size);
  }

  /**
   * Its IN (the `reverb.in` jack's), made with its response the first time it is asked for once the
   * sound has woken; else null.
   */
  input() {
    if (this._graph) return this._graph.input;
    const ctx = this.sound.ctx, channel = this.sound.channel(this.channel);
    if (!ctx || !channel) return null;
    const input = ctx.createGain(), level = ctx.createGain();
    level.gain.value = levelGain(this.knobs.level);
    level.connect(channel);
    const wet = this._wet(ctx, input, level);
    wet.fade.gain.value = 1;
    this._graph = { input, level, wet };
    return input;
  }

  /**
   * Sets a knob (0…1), kept a moment later (a knob turned keeps changing): its level at once, eased;
   * its size and damping once it rests (respond).
   * @param {ReverbKnob} name
   * @param {number} value
   */
  setKnob(name, value) {
    if (!REVERB_KNOBS.includes(name) || !Number.isFinite(value)) return;
    this.knobs[name] = clamp(value, 0, 1);
    this._apply();
    this._saveSoon();
  }

  /** The knobs as it comes. */
  reset() {
    this.knobs = { ...DEFAULT_REVERB };
    this._apply();
    this._saveSoon();
  }

  /**
   * Its response made for the size and damping now, if it was made for others: a new convolver
   * playing it faded in, the one before faded out and let go (what a knob turned does once it rests).
   */
  respond() {
    clearTimeout(this._resting);
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx || (this._made.size === this.knobs.size && this._made.damp === this.knobs.damp)) return;
    const now = ctx.currentTime, old = g.wet;
    g.wet = this._wet(ctx, g.input, g.level);
    g.wet.fade.gain.setValueAtTime(0, now);
    g.wet.fade.gain.setTargetAtTime(1, now, FADE);
    old.fade.gain.cancelScheduledValues(now);
    old.fade.gain.setTargetAtTime(0, now, FADE);
    setTimeout(() => {
      g.input.disconnect(old.convolver);
      old.fade.disconnect(g.level);
    }, FADE * 8 * 1000);
  }

  /**
   * A convolver playing its response for the knobs, from `input` through a fade (at 0) into `level`.
   * @private
   * @param {BaseAudioContext} ctx
   * @param {GainNode} input
   * @param {GainNode} level
   */
  _wet(ctx, input, level) {
    const convolver = ctx.createConvolver(), fade = ctx.createGain();
    convolver.normalize = false; // as loud as made (impulse), whatever its size
    convolver.buffer = impulse(ctx, this.seconds, this.knobs.damp, this._random);
    this._made = { size: this.knobs.size, damp: this.knobs.damp };
    fade.gain.value = 0;
    input.connect(convolver).connect(fade).connect(level);
    return { convolver, fade };
  }

  /** The level to its knob, eased (no click); the response made again once the knobs rest. @private */
  _apply() {
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    g.level.gain.setTargetAtTime(levelGain(this.knobs.level), ctx.currentTime, 0.02);
    if (this._made.size !== this.knobs.size || this._made.damp !== this.knobs.damp) {
      clearTimeout(this._resting);
      this._resting = setTimeout(() => this.respond(), REST * 1000);
    }
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      for (const name of REVERB_KNOBS) if (Number.isFinite(s?.[name])) this.knobs[name] = clamp(s[name], 0, 1);
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
