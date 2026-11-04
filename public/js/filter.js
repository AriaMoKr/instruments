// The rack's filter: a resonant filter any sound can be patched through (patch.js `filter.in`), as a
// state-variable filter's outputs are, low-pass, band-pass or high-pass (MODE), at CUTOFF, peaked
// there as far as RES says (a low-pass's or a high-pass's peak, a band-pass's narrowness). What goes
// into it no longer goes straight out (into its own channel: the synth's, the keyboard's, the drums'):
// it comes out of the filter's OUT instead, into the filter's channel (sound.js, 'filter') and
// wherever OUT is patched (main.js route). Its CUTOFF in (`filter.cutoff`) moves the cutoff on from its knob: an
// LFO's wave (the rack's, the synth's) or the synth's filter envelope, as many octaves as MOD says for
// a wave of 1. One BiquadFilterNode, 12 dB an octave, as the classic multimode filters are; turned
// up, its peak is let down a little, so that it doesn't jump out. The knobs are kept for the next
// visit (localStorage).
import { pageStorage } from './sound.js';
import { cutoffHz, hertz } from './synth.js';
import { knobPlace } from './lfo.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */
/** @typedef {{ mode: number, cutoff: number, resonance: number, mod: number }} FilterKnobs */
/** @typedef {keyof FilterKnobs} FilterKnob */
/** @typedef {'lowpass' | 'bandpass' | 'highpass'} FilterMode */

/** The knobs, in the order the rack and the card show them. @type {readonly FilterKnob[]} */
export const FILTER_KNOBS = Object.freeze(/** @type {FilterKnob[]} */ (['mode', 'cutoff', 'resonance', 'mod']));

/** Its modes, as its MODE knob turns: what each is called on the rack, and in words. @type {readonly { id: FilterMode, label: string, name: string }[]} */
export const FILTER_MODES = Object.freeze([
  { id: 'lowpass', label: 'LP', name: 'Low-pass' },
  { id: 'bandpass', label: 'BP', name: 'Band-pass' },
  { id: 'highpass', label: 'HP', name: 'High-pass' },
]);

/** As it comes: a low-pass at about 1.4 kHz, a little peaked, its CUTOFF in moving it two octaves. @type {Readonly<FilterKnobs>} */
export const DEFAULT_FILTER = Object.freeze({ mode: 0, cutoff: 0.6, resonance: 0.3, mod: 0.5 });

/** How far MOD lets the CUTOFF in move the cutoff at most, in octaves (for a wave of 1). */
export const MOD_OCTAVES = 4;

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The MODE knob's mode. @param {number} k */
export const filterMode = (k) => FILTER_MODES[knobPlace(k, FILTER_MODES.length)];

/**
 * The resonance as the filter's Q: a low-pass's or a high-pass's in dB (as Web Audio takes them), from
 * flat (a Butterworth's, -3 dB) to a peak of 24 dB; a band-pass's as it is, from a wide band to a
 * narrow one.
 * @param {FilterMode} mode
 * @param {number} k
 */
export const filterQ = (mode, k) => (mode === 'bandpass' ? 0.7 * 2 ** (5 * clamp(k, 0, 1)) : -3 + 27 * clamp(k, 0, 1));

/**
 * How loud what comes out is let be for the resonance: a low-pass or a high-pass let down as its peak
 * grows (6 dB at the most), a band-pass made up as its band narrows (less gets through it: 12 dB at
 * the most, about as loud as a chord through it was with none).
 * @param {FilterMode} mode
 * @param {number} k
 */
export const filterTrim = (mode, k) => (mode === 'bandpass' ? 4 ** clamp(k, 0, 1) : 10 ** (-0.3 * clamp(k, 0, 1) ** 2));

/** MOD as cents of cutoff for a wave of 1 at the CUTOFF in. @param {number} k */
export const modCents = (k) => 1200 * MOD_OCTAVES * clamp(k, 0, 1);

/**
 * How a knob of the filter reads, in words: its mode, its cutoff in Hz, its resonance in percent, how
 * far its CUTOFF in moves it in octaves.
 * @param {FilterKnob} name
 * @param {number} k
 */
export function filterText(name, k) {
  if (name === 'mode') return filterMode(k).name;
  if (name === 'cutoff') return hertz(cutoffHz(k));
  if (name === 'mod') return k <= 0 ? 'none' : `${(MOD_OCTAVES * clamp(k, 0, 1)).toFixed(1)} octaves`;
  return `${Math.round(clamp(k, 0, 1) * 100)}%`;
}

export class Filter {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, channel?: string }} [o] where the knobs are kept (localStorage), and the channel (sound.js) it goes into
   */
  constructor(sound, { storage = pageStorage(), key = 'filter', channel = 'filter' } = {}) {
    this.sound = sound;
    /** The channel (sound.js) its OUT goes into. */
    this.channel = channel;
    /** @type {FilterKnobs} */
    this.knobs = { ...DEFAULT_FILTER };
    /** What is plugged into its CUTOFF in (a node in the sound's context), else null. @type {AudioNode | null} */
    this.cutoffIn = null;
    /** @private @type {{ input: GainNode, filter: BiquadFilterNode, cv: GainNode, out: GainNode } | null} */
    this._graph = null;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** Its mode now. */
  get mode() {
    return filterMode(this.knobs.mode).id;
  }

  /** Its IN (the `filter.in` jack's), made the first time it is asked for once the sound has woken; else null. */
  input() {
    return this._build()?.input ?? null;
  }

  /** Its OUT (the `filter.out` jack's, into its channel too), likewise. */
  output() {
    return this._build()?.out ?? null;
  }

  /**
   * What is plugged into its CUTOFF in: a modulation (a node in the sound's context: the rack's LFO's
   * out, the synth's LFO or its filter envelope), moving the cutoff on from its knob, or nothing.
   * @param {AudioNode | null} source
   */
  setCutoffIn(source) {
    const to = source ?? null, was = this.cutoffIn;
    if (to === was) return;
    this.cutoffIn = to;
    const g = this._graph;
    if (!g) return;
    was?.disconnect(g.cv);
    to?.connect(g.cv);
  }

  /**
   * Sets a knob (0…1), kept a moment later (a knob turned keeps changing): its mode at once, the rest
   * eased.
   * @param {FilterKnob} name
   * @param {number} value
   */
  setKnob(name, value) {
    if (!FILTER_KNOBS.includes(name) || !Number.isFinite(value)) return;
    this.knobs[name] = clamp(value, 0, 1);
    this._apply();
    this._saveSoon();
  }

  /** The knobs as it comes. */
  reset() {
    this.knobs = { ...DEFAULT_FILTER };
    this._apply();
    this._saveSoon();
  }

  /**
   * The filter, made the first time it is asked for once the sound has woken: what comes in through
   * it and its trim out into its channel, and the CUTOFF in through MOD into its detune (cents).
   * @private
   */
  _build() {
    if (this._graph) return this._graph;
    const ctx = this.sound.ctx, channel = this.sound.channel(this.channel);
    if (!ctx || !channel) return null;
    const input = ctx.createGain(), filter = ctx.createBiquadFilter(), cv = ctx.createGain(), out = ctx.createGain();
    input.connect(filter).connect(out).connect(channel);
    cv.connect(filter.detune);
    this.cutoffIn?.connect(cv);
    this._graph = { input, filter, cv, out };
    this._apply(false);
    return this._graph;
  }

  /**
   * The filter to the knobs: its mode, and its Q in that mode's terms, at once (a turn to another
   * mode); its cutoff, MOD and trim eased (no click), or set (`ease` false: as it is made).
   * @private
   */
  _apply(ease = true) {
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    const now = ctx.currentTime, k = this.knobs, mode = this.mode;
    const hz = Math.min(cutoffHz(k.cutoff), ctx.sampleRate * 0.45);
    /** @param {AudioParam} p @param {number} v */
    const to = (p, v) => (ease ? p.setTargetAtTime(v, now, 0.02) : (p.value = v));
    if (g.filter.type !== mode) {
      g.filter.type = mode;
      g.filter.Q.cancelScheduledValues(now);
      g.filter.Q.setValueAtTime(filterQ(mode, k.resonance), now);
    } else to(g.filter.Q, filterQ(mode, k.resonance));
    to(g.filter.frequency, hz);
    to(g.cv.gain, modCents(k.mod));
    to(g.out.gain, filterTrim(mode, k.resonance));
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      for (const name of FILTER_KNOBS) if (Number.isFinite(s?.[name])) this.knobs[name] = clamp(s[name], 0, 1);
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
