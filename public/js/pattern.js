// The drums' pattern, as a drum machine's: sixteen steps for each pad, a bar of 16th notes, each
// one played or a rest. It moves on a step for each pulse that comes through the cable into the
// drums' clock input (clock.js, patch.js), and stepOf says which step a pulse plays from how many
// the pattern has had. It comes with a beat (DEFAULT_PATTERN), and is kept for the next visit
// (localStorage) as drum machines write one, a line for each pad: x a step played, . a rest.
import { PADS } from './drums.js';
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Store} Store */

/** Steps in the pattern: a bar of 16th notes. */
export const STEPS = 16;

/**
 * The beat it comes with, written as drum machines write one: x a step played, . a rest. Pads not
 * named have no steps.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_PATTERN = Object.freeze({
  kick: 'x...x...x...x...',
  snare: '....x.......x...',
  'closed-hat': 'x.x.x.x.x.x.x.x.',
});

/** A pad's steps written out: exactly STEPS of x and ., nothing else. */
const WRITTEN = new RegExp(`^[x.]{${STEPS}}$`);

/** Whether s is one of the pattern's steps. @param {number} s */
const isStep = (s) => Number.isInteger(s) && s >= 0 && s < STEPS;

/**
 * The step a pulse plays: its count (the pulses the pattern has had), round the pattern; never
 * negative, and 0 for a count that isn't a number.
 * @param {number} count
 */
export const stepOf = (count) => (Number.isFinite(count) ? ((Math.floor(count) % STEPS) + STEPS) % STEPS : 0);

/**
 * A pad's steps as text, x a step played and . a rest: always STEPS long, a step missing a rest.
 * @param {readonly boolean[]} steps
 */
export const stepsText = (steps) => Array.from({ length: STEPS }, (_, s) => (steps[s] ? 'x' : '.')).join('');

/**
 * Text as a pad's steps, or null unless it is exactly STEPS of x and . (what was kept may be
 * anything).
 * @param {unknown} text
 * @returns {boolean[] | null}
 */
export const parseSteps = (text) => (typeof text === 'string' && WRITTEN.test(text) ? [...text].map((c) => c === 'x') : null);

/** Pad `id`'s steps as the pattern comes: DEFAULT_PATTERN's, else none. @param {string} id */
const defaultSteps = (id) => parseSteps(DEFAULT_PATTERN[id]) ?? Array.from({ length: STEPS }, () => false);

/** The drums' pattern: whether each pad plays on each step, kept for the next visit. */
export class Pattern {
  /**
   * @param {{ storage?: Store | null, key?: string }} [o] where the pattern is kept (localStorage)
   */
  constructor({ storage = pageStorage(), key = 'pattern' } = {}) {
    /**
     * Whether pad i (PADS's order) plays on step s: steps[i][s]. A pad's array stays the same one
     * (reset and what was kept fill it), so the page may hold on to it.
     * @type {boolean[][]}
     */
    this.steps = PADS.map((p) => defaultSteps(p.id));
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /**
   * Whether pad i plays on step s.
   * @param {number} i
   * @param {number} s
   */
  has(i, s) {
    return this.steps[i]?.[s] === true;
  }

  /**
   * Sets whether pad i plays on step s, kept a moment later (steps are set a few at a time). A pad
   * or a step that isn't there is ignored.
   * @param {number} i
   * @param {number} s
   * @param {boolean} on
   */
  set(i, s, on) {
    const row = this.steps[i];
    if (!row || !isStep(s) || row[s] === !!on) return;
    row[s] = !!on;
    this._saveSoon();
  }

  /**
   * Pad i plays on step s if it didn't, and not if it did: whether it plays there now.
   * @param {number} i
   * @param {number} s
   */
  toggle(i, s) {
    this.set(i, s, !this.has(i, s));
    return this.has(i, s);
  }

  /** Pad i: no steps. @param {number} i */
  clear(i) {
    if (!this.steps[i]) return;
    this._fill(i, []);
    this._saveSoon();
  }

  /** Every pad as the pattern comes (DEFAULT_PATTERN). */
  reset() {
    PADS.forEach((p, i) => this._fill(i, defaultSteps(p.id)));
    this._saveSoon();
  }

  /**
   * The pads that play on step s (their indices in PADS), in PADS's order.
   * @param {number} s
   */
  padsAt(s) {
    /** @type {number[]} */
    const pads = [];
    for (let i = 0; i < this.steps.length; i++) if (this.has(i, s)) pads.push(i);
    return pads;
  }

  /**
   * Pad i's steps as `steps` (a step missing a rest), in the array it has.
   * @private
   * @param {number} i
   * @param {readonly boolean[]} steps
   */
  _fill(i, steps) {
    const row = this.steps[i];
    for (let s = 0; s < STEPS; s++) row[s] = steps[s] === true;
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      PADS.forEach((p, i) => {
        // A pad not kept, or kept as something else: as it comes.
        const steps = parseSteps(s?.[p.id]);
        if (steps) this._fill(i, steps);
      });
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the pattern now (localStorage): each pad's steps as text, a cleared one as rests. */
  save() {
    clearTimeout(this._saving);
    /** @type {Record<string, string>} */
    const out = {};
    PADS.forEach((p, i) => {
      out[p.id] = stepsText(this.steps[i]);
    });
    try {
      this._storage?.setItem(this._key, JSON.stringify(out));
    } catch {
      // storage full or blocked: it lasts this visit
    }
  }
}
