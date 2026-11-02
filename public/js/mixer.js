// The rack's mixer: four sounds patched into its ins (patch.js `mixer.in1` to `mixer.in4`), each
// turned up or down by its knob, into one out (`mixer.out`), into its own channel (sound.js, 'mixer')
// and wherever OUT is patched (main.js route). What goes into it no longer goes straight out (into
// its own channel: the drums', the synth's, the keyboard's), as with the filter: it comes out of OUT
// instead. So several sounds go on together through one cable, into the filter, a delay or the
// reverb, each as loud as its knob says: as loud as it came three quarters of the way round (UNITY),
// 5 dB louder at the top, nothing at the bottom, the knob's square between, as a fader's. The knobs
// are kept for the next visit (localStorage).
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */
/** @typedef {{ in1: number, in2: number, in3: number, in4: number }} MixerKnobs */
/** @typedef {keyof MixerKnobs} MixerKnob */

/** Its knobs, an in's each (its jack `mixer.<knob>`), in the order the rack and the card show them. @type {readonly MixerKnob[]} */
export const MIXER_KNOBS = Object.freeze(/** @type {MixerKnob[]} */ (['in1', 'in2', 'in3', 'in4']));

/** Where a knob lets its in through as loud as it came (0 dB). */
export const UNITY = 0.75;

/** As it comes: each in as loud as it came. @type {Readonly<MixerKnobs>} */
export const DEFAULT_MIXER = Object.freeze({ in1: UNITY, in2: UNITY, in3: UNITY, in4: UNITY });

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A knob as its in's gain: 1 at UNITY, its square either side (about 5 dB more at the top). @param {number} k */
export const mixGain = (k) => (clamp(k, 0, 1) / UNITY) ** 2;

/**
 * How a knob of the mixer reads, in words: its in's level in decibels from as loud as it came, to the
 * nearest one, or off.
 * @param {MixerKnob} name
 * @param {number} k
 */
export function mixerText(name, k) {
  const gain = mixGain(k);
  if (!(gain > 0)) return 'off';
  const db = Math.round(20 * Math.log10(gain));
  return db === 0 ? '0 dB' : `${db > 0 ? '+' : '−'}${Math.abs(db)} dB`;
}

export class Mixer {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, channel?: string }} [o] where the knobs are kept (localStorage), and the channel (sound.js) its OUT goes into
   */
  constructor(sound, { storage = pageStorage(), key = 'mixer', channel = 'mixer' } = {}) {
    this.sound = sound;
    /** The channel (sound.js) its OUT goes into. */
    this.channel = channel;
    /** @type {MixerKnobs} */
    this.knobs = { ...DEFAULT_MIXER };
    /** @private @type {{ ins: GainNode[], out: GainNode } | null} */
    this._graph = null;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /**
   * The in a knob turns (`in1`…`in4`, its jack `mixer.<name>`), made the first time one is asked for
   * once the sound has woken; else null.
   * @param {string} name
   */
  input(name) {
    const i = MIXER_KNOBS.indexOf(/** @type {MixerKnob} */ (name));
    return i < 0 ? null : this._build()?.ins[i] ?? null;
  }

  /** Its OUT (the `mixer.out` jack's, into its channel too), likewise. */
  output() {
    return this._build()?.out ?? null;
  }

  /**
   * Sets a knob (0…1), eased (no click), kept a moment later (a knob turned keeps changing).
   * @param {MixerKnob} name
   * @param {number} value
   */
  setKnob(name, value) {
    if (!MIXER_KNOBS.includes(name) || !Number.isFinite(value)) return;
    this.knobs[name] = clamp(value, 0, 1);
    this._apply();
    this._saveSoon();
  }

  /** The knobs as it comes. */
  reset() {
    this.knobs = { ...DEFAULT_MIXER };
    this._apply();
    this._saveSoon();
  }

  /** Its ins, each through its level, together into its out, into its channel. @private */
  _build() {
    if (this._graph) return this._graph;
    const ctx = this.sound.ctx, channel = this.sound.channel(this.channel);
    if (!ctx || !channel) return null;
    const out = ctx.createGain();
    const ins = MIXER_KNOBS.map(() => {
      const level = ctx.createGain();
      level.connect(out);
      return level;
    });
    out.connect(channel);
    this._graph = { ins, out };
    this._apply(false);
    return this._graph;
  }

  /** The levels to the knobs, eased, or set (`ease` false: as it is made). @private */
  _apply(ease = true) {
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    MIXER_KNOBS.forEach((name, i) => {
      const p = g.ins[i].gain, v = mixGain(this.knobs[name]);
      if (ease) p.setTargetAtTime(v, ctx.currentTime, 0.02);
      else p.value = v;
    });
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      for (const name of MIXER_KNOBS) if (Number.isFinite(s?.[name])) this.knobs[name] = clamp(s[name], 0, 1);
    } catch {
      // none kept, or not readable: as it comes
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
    try {
      this._storage?.setItem(this._key, JSON.stringify(this.knobs));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
