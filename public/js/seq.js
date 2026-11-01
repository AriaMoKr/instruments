// The rack's sequencer (rackboard.js lays it out on the rack, rackkit.js draws it): sixteen steps, a
// bar of 16th notes as the drums' pattern is (pattern.js), as the bass sequencers of the early 1980s
// had them: each step a note to play or a rest, its note set by its knob (two octaves up from the
// line's lowest note, C2 with its octave at 0), an accent (played harder: louder, its filter opened
// more) and a slide (held on into the next step, gliding to its note without starting again). It
// moves on a step for each pulse through the cable into its clock in (main.js, as the drums' pattern
// does; pattern.js stepOf says which), and its notes go out of its NOTES out into the synth's NOTES in
// (synth.js seqStep). It comes with a line (DEFAULT_LINE), and is kept for the next visit
// (localStorage): each step's note, and the steps played, accented and slid as drum machines write a
// pattern, x for yes and . for no.
import { STEPS } from './pattern.js';
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Store} Store */

/** How far up from the line's lowest note a step's knob reaches, in semitones: two octaves. */
export const SEQ_RANGE = 24;
/** The line's lowest note (MIDI) with its octave at 0: C2, a bass's. */
export const SEQ_LOWEST = 36;
/** How far its octave buttons move the line, down and up. */
export const SEQ_OCTAVES = Object.freeze({ min: -1, max: 2 });
/** How much of its step a note sounds, unless it slides on into the next. */
export const SEQ_GATE = 0.5;
/** How hard a step plays (synth.js velocity: louder, and its filter opened more), and an accented one. */
export const SEQ_VELOCITY = Object.freeze({ normal: 0.62, accent: 1 });

/**
 * A step: whether it plays (else a rest), its note (semitones up from the line's lowest, 0…SEQ_RANGE),
 * an accent, a slide on into the next step.
 * @typedef {{ on: boolean, note: number, accent: boolean, slide: boolean }} SeqStep
 */

/**
 * What a step plays: its note (MIDI), how hard, and whether it slides on into the next step.
 * @typedef {{ note: number, velocity: number, slide: boolean }} SeqNote
 */

/**
 * The line it comes with, in C minor: each step's note, then the steps played, accented and slid (x
 * yes, . no), a slide gliding into the note after it.
 * @type {Readonly<{ notes: readonly number[], on: string, accent: string, slide: string }>}
 */
export const DEFAULT_LINE = Object.freeze({
  notes: Object.freeze([0, 0, 12, 10, 0, 0, 3, 5, 0, 0, 7, 12, 10, 7, 3, 0]),
  on: 'xxxx.xxxx.xxx.xx',
  accent: 'x....x..x...x...',
  slide: '..x...x...x...x.',
});

/** Steps written out: exactly STEPS of x and ., nothing else. */
const WRITTEN = new RegExp(`^[x.]{${STEPS}}$`);

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Whether s is one of the steps. @param {number} s */
const isStep = (s) => Number.isInteger(s) && s >= 0 && s < STEPS;

/** A step's note as it is kept: a whole number of semitones within the knob's reach. @param {number} n */
const wholeNote = (n) => clamp(Math.round(n), 0, SEQ_RANGE);

/**
 * Text as steps (x yes, . no), or null unless it is exactly STEPS of x and . (what was kept may be
 * anything).
 * @param {unknown} text
 * @returns {boolean[] | null}
 */
const parseFlags = (text) => (typeof text === 'string' && WRITTEN.test(text) ? [...text].map((c) => c === 'x') : null);

/** Steps as text, x yes and . no. @param {readonly boolean[]} flags */
const flagsText = (flags) => flags.map((f) => (f ? 'x' : '.')).join('');

/** The steps as the line comes (DEFAULT_LINE). @returns {SeqStep[]} */
function defaultSteps() {
  const on = parseFlags(DEFAULT_LINE.on), accent = parseFlags(DEFAULT_LINE.accent), slide = parseFlags(DEFAULT_LINE.slide);
  return Array.from({ length: STEPS }, (_, s) => ({ on: !!on?.[s], note: wholeNote(DEFAULT_LINE.notes[s] ?? 0), accent: !!accent?.[s], slide: !!slide?.[s] }));
}

/** The sequencer: its sixteen steps and its octave, kept for the next visit. */
export class Seq {
  /**
   * @param {{ storage?: Store | null, key?: string }} [o] where the line is kept (localStorage)
   */
  constructor({ storage = pageStorage(), key = 'seq' } = {}) {
    /** The steps, in order; each stays the same object (reset and what was kept fill it), so the page may hold on to them. */
    this.steps = defaultSteps();
    /** How many octaves from SEQ_LOWEST the line plays (SEQ_OCTAVES). */
    this.octave = 0;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** The note (MIDI) of a step's knob turned all the way down, with the octave as set. */
  get lowest() {
    return SEQ_LOWEST + 12 * this.octave;
  }

  /** The note (MIDI) step s plays when it plays, else -1 for a step that isn't there. @param {number} s */
  noteOf(s) {
    return isStep(s) ? this.lowest + this.steps[s].note : -1;
  }

  /**
   * What step s plays: its note, how hard (an accent harder), and whether it slides on into the next
   * step; null for a rest, or a step that isn't there.
   * @param {number} s
   * @returns {SeqNote | null}
   */
  play(s) {
    if (!isStep(s) || !this.steps[s].on) return null;
    const step = this.steps[s];
    return { note: this.lowest + step.note, velocity: step.accent ? SEQ_VELOCITY.accent : SEQ_VELOCITY.normal, slide: step.slide };
  }

  /** Step s plays if it was a rest, and is a rest if it played: whether it plays now. @param {number} s */
  toggle(s) {
    if (!isStep(s)) return false;
    this.steps[s].on = !this.steps[s].on;
    this._saveSoon();
    return this.steps[s].on;
  }

  /**
   * Step s's note, semitones up from the line's lowest (0…SEQ_RANGE, whole: the nearest); a number
   * that isn't finite, or a step that isn't there, is ignored. Whether it changed.
   * @param {number} s
   * @param {number} n
   */
  setNote(s, n) {
    if (!isStep(s) || !Number.isFinite(n)) return false;
    const note = wholeNote(n);
    if (note === this.steps[s].note) return false;
    this.steps[s].note = note;
    this._saveSoon();
    return true;
  }

  /** Step s accented if it wasn't, and not if it was: whether it is now. @param {number} s */
  toggleAccent(s) {
    if (!isStep(s)) return false;
    this.steps[s].accent = !this.steps[s].accent;
    this._saveSoon();
    return this.steps[s].accent;
  }

  /** Step s sliding on into the next if it wasn't, and not if it was: whether it does now. @param {number} s */
  toggleSlide(s) {
    if (!isStep(s)) return false;
    this.steps[s].slide = !this.steps[s].slide;
    this._saveSoon();
    return this.steps[s].slide;
  }

  /** The octave the line plays in (SEQ_OCTAVES: the nearest within them). @param {number} octave */
  setOctave(octave) {
    if (!Number.isFinite(octave)) return;
    this.octave = clamp(Math.round(octave), SEQ_OCTAVES.min, SEQ_OCTAVES.max);
    this._saveSoon();
  }

  /** Every step a rest on the line's lowest note, none accented or sliding (the octave stays). */
  clear() {
    for (const step of this.steps) {
      step.on = step.accent = step.slide = false;
      step.note = 0;
    }
    this._saveSoon();
  }

  /** The line as it comes (DEFAULT_LINE), in its octave. */
  reset() {
    this._fill(defaultSteps());
    this.octave = 0;
    this._saveSoon();
  }

  /**
   * The steps as `steps`, in the objects there are.
   * @private
   * @param {readonly SeqStep[]} steps
   */
  _fill(steps) {
    this.steps.forEach((step, s) => Object.assign(step, steps[s]));
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (!s || typeof s !== 'object') return;
      // Each part on its own: one kept as something else stays as it comes.
      const on = parseFlags(s.on), accent = parseFlags(s.accent), slide = parseFlags(s.slide);
      const notes = Array.isArray(s.notes) && s.notes.length === STEPS && s.notes.every(Number.isFinite) ? s.notes : null;
      this.steps.forEach((step, i) => {
        if (on) step.on = on[i];
        if (accent) step.accent = accent[i];
        if (slide) step.slide = slide[i];
        if (notes) step.note = wholeNote(notes[i]);
      });
      if (Number.isFinite(s.octave)) this.octave = clamp(Math.round(s.octave), SEQ_OCTAVES.min, SEQ_OCTAVES.max);
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the line now (localStorage): each step's note, the steps played, accented and slid, and the octave. */
  save() {
    clearTimeout(this._saving);
    const steps = this.steps;
    const line = {
      notes: steps.map((step) => step.note),
      on: flagsText(steps.map((step) => step.on)),
      accent: flagsText(steps.map((step) => step.accent)),
      slide: flagsText(steps.map((step) => step.slide)),
      octave: this.octave,
    };
    try {
      this._storage?.setItem(this._key, JSON.stringify(line));
    } catch {
      // storage full or blocked: it lasts this visit
    }
  }
}
