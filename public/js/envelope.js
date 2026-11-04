// The rack's envelope: a shape that rises from nothing to its top over ATTACK, falls over DECAY to
// SUSTAIN (of its top), stays there until it is let go, then falls back to nothing over RELEASE, as a
// synth's envelope does; out of its OUT (patch.js `env.out`) as a modulation, as the LFOs' are, into
// any modulation in (the synth's pitch, cutoff or amp, the keyboard's ROTARY, the filter's CUTOFF, the
// guitar's WAH), as much of it as DEPTH says (its square, as the LFO's depth). What is patched into
// its ins starts it: the clock's pulses into CLOCK (`env.clock`), each starting it and letting it go
// half its step later (ENV_GATE); or notes into NOTES (`env.notes`), the sequencer's, the keyboard's or
// the guitar's, each starting it as it begins, as high as it is played hard (an accented step higher),
// and letting it go as it ends. A step slid on into the next carries it on there without starting it
// again, as the synth's notes are; a key held (a string ringing) keeps it held while another is let
// go. Started again before it has fallen, it rises
// from where it is. Its shape is set ahead on the audio clock, as the clock's pulses and the
// sequencer's notes are, as the synth's envelopes are (synth.js Envelope), on a ConstantSource's
// offset, out through its depth. Its ATTACK, DECAY and SUSTAIN are heard from its next start, RELEASE
// from its next letting go, DEPTH at once. The knobs are kept for the next visit (localStorage).
import { pageStorage } from './sound.js';
import { Envelope, attackSeconds, decaySeconds, seconds, velocityLevel } from './synth.js';
import { depthGain } from './lfo.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */
/** @typedef {{ attack: number, decay: number, sustain: number, release: number, depth: number }} EnvelopeKnobs */
/** @typedef {keyof EnvelopeKnobs} EnvelopeKnob */

/** The knobs, in the order the card shows them (on the rack, DEPTH over the other four). @type {readonly EnvelopeKnob[]} */
export const ENVELOPE_KNOBS = Object.freeze(/** @type {EnvelopeKnob[]} */ (['attack', 'decay', 'sustain', 'release', 'depth']));

/**
 * As it comes: a pluck, at once to its top, down to a third of it over a sixth of a second, gone a
 * tenth of a second after it is let go; all of it out.
 * @type {Readonly<EnvelopeKnobs>}
 */
export const DEFAULT_ENVELOPE = Object.freeze({ attack: 0.1, decay: 0.45, sustain: 0.3, release: 0.4, depth: 1 });

/** How much of its step a pulse of the clock holds it for, as the sequencer's notes sound. */
export const ENV_GATE = 0.5;

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * How a knob of the envelope reads, in words: its attack, decay or release as a time, its sustain and
 * its depth in percent.
 * @param {EnvelopeKnob} name
 * @param {number} k
 */
export function envelopeText(name, k) {
  if (name === 'attack') return seconds(attackSeconds(k));
  if (name === 'decay' || name === 'release') return seconds(decaySeconds(k));
  return `${Math.round(clamp(k, 0, 1) * 100)}%`;
}

/** How many of its shapes set last it remembers, for valueAt: those set ahead, and the one heard. */
const RING = 4;

export class Adsr {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string }} [o] where the knobs are kept (localStorage)
   */
  constructor(sound, { storage = pageStorage(), key = 'envelope' } = {}) {
    this.sound = sound;
    /** @type {EnvelopeKnobs} */
    this.knobs = { ...DEFAULT_ENVELOPE };
    /** @private @type {{ level: ConstantSourceNode, out: GainNode } | null} */
    this._graph = null;
    /** @private what its shape is set on: its level's offset, once made @type {AudioParam[]} */
    this._params = [];
    /** @private its shape as set last, where each start and letting go carries on from */
    this._env = new Envelope();
    /** @private the shapes set last (each start a new one, letting go its own), for valueAt */
    this._ring = Array.from({ length: RING }, () => new Envelope());
    /** @private */
    this._latest = 0;
    /** @private the keyboard's notes holding it @type {Set<number>} */
    this._keys = new Set();
    /** @private whether the sequencer's note holds it on into its next step (a slide) */
    this._tie = false;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** Its OUT (the `env.out` jack's), made the first time it is asked for once the sound has woken; else null. */
  output() {
    if (this._graph) return this._graph.out;
    const ctx = this.sound.ctx;
    if (!ctx) return null;
    const level = ctx.createConstantSource(), out = ctx.createGain();
    level.offset.value = this._env.valueAt(ctx.currentTime);
    out.gain.value = depthGain(this.knobs.depth);
    level.connect(out);
    level.start(ctx.currentTime);
    this._graph = { level, out };
    this._params = [level.offset];
    return out;
  }

  /**
   * Where it is at `t` on the audio clock (0…its top), before its depth: from the shape heard then,
   * not one set ahead of it.
   * @param {number} t
   */
  valueAt(t) {
    let best = -1;
    for (let i = 0; i < RING; i++) if (this._ring[i].t0 <= t && (best < 0 || this._ring[i].t0 > this._ring[best].t0)) best = i;
    return best < 0 ? 0 : this._ring[best].valueAt(t);
  }

  /**
   * A pulse of the clock into its CLOCK in, falling at `t` on the audio clock (or now, if that has
   * gone), its step `step` seconds long: started, to its top, and let go ENV_GATE of the step later.
   * @param {number} t
   * @param {number} step
   */
  trigger(t, step) {
    const ctx = this.sound.ctx;
    if (!ctx || !Number.isFinite(t) || !(step > 0)) return;
    const at = Math.max(t, ctx.currentTime);
    this._start(at, 1);
    this._stop(at + ENV_GATE * step);
  }

  /**
   * A step of the sequencer through its NOTES in, at `t` on the audio clock (or now, if that has
   * gone): a note (MIDI; which, it doesn't mind) starts it, as high as `velocity`, unless the step
   * before slid on into it and it still holds, when it carries on as it was. Let go at `until`, or
   * held on into the next step (Infinity). A rest (note -1) lets go one held on into it.
   * @param {number} note
   * @param {number} velocity 0…1
   * @param {number} t
   * @param {number} until
   */
  seqStep(note, velocity, t, until) {
    const ctx = this.sound.ctx;
    if (!ctx || !Number.isFinite(t)) return;
    const at = Math.max(t, ctx.currentTime), tie = this._tie;
    this._tie = false;
    if (!Number.isFinite(note) || note < 0) {
      if (tie) this._stop(at);
      return;
    }
    if (!tie || this._env.released(at)) this._start(at, velocityLevel(velocity));
    if (until < Infinity) this._stop(Math.max(until, at));
    else this._tie = true;
  }

  /** The sequencer's note held on into a step that won't come (its clock stopped, a cable pulled): let go now. */
  seqEnd() {
    const ctx = this.sound.ctx, tie = this._tie;
    this._tie = false;
    if (tie && ctx) this._stop(ctx.currentTime);
  }

  /**
   * A note through its NOTES in (the keyboard's, its key just gone down; a string of the guitar's,
   * plucked): started at `at` on the audio clock (now if sooner), as high as `velocity`, held while
   * it or another is. Which note, it doesn't mind: what holds it.
   * @param {number} note
   * @param {number} velocity 0…1
   * @param {number} [at]
   */
  noteOn(note, velocity, at = 0) {
    const ctx = this.sound.ctx;
    if (!ctx || !Number.isFinite(note)) return;
    this._keys.add(note);
    this._start(Math.max(Number.isFinite(at) ? at : 0, ctx.currentTime), velocityLevel(velocity));
  }

  /**
   * That note ended (its key up, the keyboard's sustain let go, the string damped or died away): let
   * go at `at` (now if sooner), unless another holds it.
   * @param {number} note
   * @param {number} [at]
   */
  noteOff(note, at = 0) {
    const ctx = this.sound.ctx;
    if (!this._keys.delete(note) || this._keys.size > 0 || !ctx) return;
    this._stop(Math.max(Number.isFinite(at) ? at : 0, ctx.currentTime));
  }

  /** The keyboard's notes, or the guitar's, no longer come (its cable pulled out): let go now, if they held it. */
  allOff() {
    const ctx = this.sound.ctx, held = this._keys.size > 0;
    this._keys.clear();
    if (held && ctx) this._stop(ctx.currentTime);
  }

  /**
   * Sets a knob (0…1), kept a moment later (a knob turned keeps changing): DEPTH eased, at once; the
   * rest from its next start (RELEASE, letting go).
   * @param {EnvelopeKnob} name
   * @param {number} value
   */
  setKnob(name, value) {
    if (!ENVELOPE_KNOBS.includes(name) || !Number.isFinite(value)) return;
    this.knobs[name] = clamp(value, 0, 1);
    this._apply();
    this._saveSoon();
  }

  /** The knobs as it comes. */
  reset() {
    this.knobs = { ...DEFAULT_ENVELOPE };
    this._apply();
    this._saveSoon();
  }

  /**
   * Starts it at t, to `peak`, from where it is, its shape as its knobs are now; remembered as a shape
   * of its own.
   * @private
   * @param {number} t
   * @param {number} peak
   */
  _start(t, peak) {
    const k = this.knobs;
    this._env.start(this._params, t, peak, attackSeconds(k.attack), decaySeconds(k.decay), k.sustain);
    this._latest = (this._latest + 1) % RING;
    Object.assign(this._ring[this._latest], this._env);
  }

  /**
   * Lets it go at t, over RELEASE as it is now; the shape remembered last let go there too.
   * @private
   * @param {number} t
   */
  _stop(t) {
    this._env.stop(this._params, t, decaySeconds(this.knobs.release));
    Object.assign(this._ring[this._latest], this._env);
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
      for (const name of ENVELOPE_KNOBS) if (Number.isFinite(s?.[name])) this.knobs[name] = clamp(s[name], 0, 1);
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
