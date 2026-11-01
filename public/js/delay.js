// The delay: an echo any pad's sound can be patched into (patch.js `delay.in`), its echoes into the
// mixer's 'delay' channel, made as a tape echo makes them. What comes in goes round a loop, late by
// `time` (in steps of the clock, so that the echoes fall on the beat and follow its tempo), a little
// darker each time round (a low-pass in the loop) and turned down by `feedback`; `level` is how loud
// the echoes are. What goes in is still heard as it was: its pad's out feeds the drums' channel too.
// The knobs are kept for the next visit (localStorage).
import { pageStorage } from './sound.js';
import { TEMPO, stepSeconds } from './clock.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {{ time: number, feedback: number, level: number }} DelayKnobs */
/** @typedef {keyof DelayKnobs} DelayKnob */

/** The knobs, in the order the board and the card show them. @type {readonly DelayKnob[]} */
export const DELAY_KNOBS = Object.freeze(/** @type {DelayKnob[]} */ (['time', 'feedback', 'level']));

/** As it comes: echoes three steps apart (a dotted 8th), dying away over a few. @type {Readonly<DelayKnobs>} */
export const DEFAULT_DELAY = Object.freeze({ time: 2 / 7, feedback: 0.45, level: 0.6 });

/** The longest echo, in steps: a half note. */
export const MAX_STEPS = 8;

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The time knob as steps of the clock: 1 (a 16th) to MAX_STEPS (a half note). @param {number} k */
export const delaySteps = (k) => 1 + Math.round(clamp(k, 0, 1) * (MAX_STEPS - 1));

/** The feedback knob as the loop's gain: never so much that the echoes grow. @param {number} k */
export const feedbackGain = (k) => 0.82 * clamp(k, 0, 1);

/** The level knob as the echoes' gain: its square, as the volume's. @param {number} k */
export const levelGain = (k) => clamp(k, 0, 1) ** 2;

/** What some numbers of steps are called. @type {Readonly<Record<number, string>>} */
const NOTE_NAMES = Object.freeze({ 1: 'a 16th', 2: 'an 8th', 3: 'a dotted 8th', 4: 'a quarter note', 6: 'a dotted quarter', 8: 'a half note' });

/**
 * How a knob of the delay reads, in words: its time in steps (and what a musician calls that), the
 * feedback and the level in percent.
 * @param {DelayKnob} name
 * @param {number} k
 */
export function delayText(name, k) {
  if (name !== 'time') return `${Math.round(clamp(k, 0, 1) * 100)}%`;
  const n = delaySteps(k);
  return `${n} step${n === 1 ? '' : 's'}${NOTE_NAMES[n] ? `, ${NOTE_NAMES[n]}` : ''}`;
}

export class Delay {
  /**
   * @param {Sound} sound
   * @param {{ storage?: import('./sound.js').Store | null, key?: string }} [o] where the knobs are kept (localStorage)
   */
  constructor(sound, { storage = pageStorage(), key = 'delay' } = {}) {
    this.sound = sound;
    /** @type {DelayKnobs} */
    this.knobs = { ...DEFAULT_DELAY };
    /** The clock's tempo, which its time follows. */
    this.tempo = TEMPO.value;
    /** @private @type {{ input: GainNode, delay: DelayNode, feedback: GainNode, level: GainNode } | null} */
    this._graph = null;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** How long its echoes are apart now, in seconds. */
  get seconds() {
    return delaySteps(this.knobs.time) * stepSeconds(this.tempo);
  }

  /**
   * Its input (the `delay.in` jack's), made with its loop the first time it is asked for once the
   * sound has woken; else null.
   */
  input() {
    if (this._graph) return this._graph.input;
    const ctx = this.sound.ctx, channel = this.sound.channel('delay');
    if (!ctx || !channel) return null;
    const input = ctx.createGain();
    const delay = ctx.createDelay(MAX_STEPS * stepSeconds(TEMPO.min) + 0.05);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    const feedback = ctx.createGain();
    const level = ctx.createGain();
    delay.delayTime.value = this.seconds;
    feedback.gain.value = feedbackGain(this.knobs.feedback);
    level.gain.value = levelGain(this.knobs.level);
    input.connect(delay).connect(tone).connect(feedback).connect(delay);
    tone.connect(level).connect(channel);
    this._graph = { input, delay, feedback, level };
    return input;
  }

  /**
   * Sets a knob (0…1), kept a moment later (a knob turned keeps changing).
   * @param {DelayKnob} name
   * @param {number} value
   */
  setKnob(name, value) {
    if (!DELAY_KNOBS.includes(name) || !Number.isFinite(value)) return;
    this.knobs[name] = clamp(value, 0, 1);
    this._apply();
    this._saveSoon();
  }

  /** Its time follows the clock's tempo (beats per minute). @param {number} tempo */
  setTempo(tempo) {
    if (!Number.isFinite(tempo) || tempo <= 0) return;
    this.tempo = tempo;
    this._apply();
  }

  /** The knobs as it comes. */
  reset() {
    this.knobs = { ...DEFAULT_DELAY };
    this._apply();
    this._saveSoon();
  }

  /**
   * The loop to the knobs, eased: a change of time bends the echoes' pitch a little, as a tape's
   * speed would.
   * @private
   */
  _apply() {
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    const now = ctx.currentTime;
    g.delay.delayTime.setTargetAtTime(this.seconds, now, 0.05);
    g.feedback.gain.setTargetAtTime(feedbackGain(this.knobs.feedback), now, 0.02);
    g.level.gain.setTargetAtTime(levelGain(this.knobs.level), now, 0.02);
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      for (const name of DELAY_KNOBS) if (Number.isFinite(s?.[name])) this.knobs[name] = clamp(s[name], 0, 1);
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
