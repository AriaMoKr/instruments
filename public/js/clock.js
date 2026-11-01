// The room's clock: the pulse the drums' pattern steps to, four to a beat, so that a pulse is a
// 16th note and the pattern's sixteen steps are a bar of 4/4, at a tempo the visitor sets, which is
// kept for the next visit (localStorage); the clock itself runs only once started, never on load.
// It keeps time by the audio clock, not by a timer: the page calls advance() with the audio clock's
// time every frame, and it hands out each pulse a little before it falls (LOOKAHEAD) with the time
// it falls on, for its notes to start at exactly then, so that a frame early or late moves no note.
// A pulse that fell too far behind to be heard in time (the page stalled, or was put away) is
// skipped rather than played late, but counted, so that what follows the count stays in step. Its
// outputs are jacks for the patch's cables (patch.js): one sends every pulse, one every 2nd and one
// every 4th, on the drum board and again in the rack beside the synth.
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Store} Store */

/**
 * The tempo, in beats per minute: from `min` to `max`, and `value` as it comes.
 * @type {Readonly<{ min: number, max: number, value: number }>}
 */
export const TEMPO = Object.freeze({ min: 60, max: 180, value: 110 });

/** Pulses to a beat: a pulse is a 16th note, a step of the pattern. */
export const STEPS_PER_BEAT = 4;

/**
 * How far ahead of the audio clock pulses are handed out, in seconds: more than a slow frame, so
 * that one leaves no gap, and little enough that a change (the tempo, a step) is soon heard.
 */
export const LOOKAHEAD = 0.12;

/**
 * A pulse more than this many seconds behind the audio clock was missed (the page stalled, or was
 * put away): played now, it would be out of time, so it is skipped.
 */
export const LATE = 0.1;

/** The first pulse comes this long after start(now), in seconds: time to start its notes before it falls. */
export const START_LEAD = 0.05;

/**
 * One of the clock's outputs: its jack's id (patch.js), and every how many pulses it sends one,
 * counting from pulse 0.
 * @typedef {{ id: string, every: number }} ClockOut
 */

/** The clock's outputs on the drum board (jacks in patch.js): every pulse, every 2nd, every 4th. @type {readonly ClockOut[]} */
export const CLOCK_OUTS = Object.freeze([
  { id: 'clock.x1', every: 1 },
  { id: 'clock.d2', every: 2 },
  { id: 'clock.d4', every: 4 },
]);

/** Its outputs again in the rack, beside the synth (rackboard.js), likewise. @type {readonly ClockOut[]} */
export const RACK_CLOCK_OUTS = Object.freeze([
  { id: 'rack.x1', every: 1 },
  { id: 'rack.d2', every: 2 },
  { id: 'rack.d4', every: 4 },
]);

/** Seconds between pulses at a tempo (beats per minute). @param {number} tempo */
export const stepSeconds = (tempo) => 60 / tempo / STEPS_PER_BEAT;

/**
 * Every how many pulses the clock's output `id` sends one (on the board or in the rack), else 0: an
 * id that isn't one of them, or null (nothing plugged in).
 * @param {string | null} id
 */
export const clockEvery = (id) => (CLOCK_OUTS.find((o) => o.id === id) ?? RACK_CLOCK_OUTS.find((o) => o.id === id))?.every ?? 0;

/**
 * Whether the clock's output `id` sends pulse n (every one, every 2nd or every 4th, counting from
 * pulse 0); never for an id that isn't one of them, nor null (nothing plugged in).
 * @param {string | null} id
 * @param {number} n
 */
export function clockSends(id, n) {
  const every = clockEvery(id);
  return every > 0 && n % every === 0;
}

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A tempo as the clock keeps it: whole beats per minute, within TEMPO's range. @param {number} bpm */
const wholeTempo = (bpm) => clamp(Math.round(bpm), TEMPO.min, TEMPO.max);

/** The clock: its tempo, kept for the next visit, and its pulses, handed out ahead of the audio clock. */
export class Clock {
  /**
   * @param {{ storage?: Store | null, key?: string }} [o] where the tempo is kept (localStorage)
   */
  constructor({ storage = pageStorage(), key = 'clock' } = {}) {
    /** The tempo, in whole beats per minute (setTempo). */
    this.tempo = TEMPO.value;
    /** Whether it is handing out pulses: only once started, whatever it did on the last visit. */
    this.running = false;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** The next pulse to hand out: its number, counting from 0 at start(). @private */
    this._next = 0;
    /** When that pulse falls, on the audio clock. @private */
    this._at = 0;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /**
   * Sets the tempo: whole beats per minute within TEMPO's range (a number that isn't finite is
   * ignored), kept a moment later (a knob turned keeps changing). Running, the pulse due next keeps
   * the time it was given when the one before it was handed out, and the ones after it come at the
   * new tempo.
   * @param {number} bpm
   */
  setTempo(bpm) {
    if (!Number.isFinite(bpm)) return;
    const tempo = wholeTempo(bpm);
    if (tempo === this.tempo) return;
    this.tempo = tempo;
    this._saveSoon();
  }

  /**
   * Runs from `now` (the audio clock's time): pulse 0 START_LEAD after it, the count from 0 again
   * if it was running. A time that isn't finite is ignored.
   * @param {number} now
   */
  start(now) {
    if (!Number.isFinite(now)) return;
    this.running = true;
    this._next = 0;
    this._at = now + START_LEAD;
  }

  /** No more pulses, until it is started again. */
  stop() {
    this.running = false;
  }

  /**
   * Hands out, in order, every pulse due before now + LOOKAHEAD that it hasn't yet: onPulse(n,
   * time), n counting from 0 since start(), time when the pulse falls on the audio clock. A pulse
   * more than LATE behind `now` is skipped, not handed out, but still counted, so that the ones after
   * it keep their numbers. Called again with the same `now`, or an earlier one, it has nothing new.
   * How many it handed out; none when it isn't running.
   * @param {number} now the audio clock's time
   * @param {(n: number, time: number) => void} onPulse
   */
  advance(now, onPulse) {
    if (!this.running || !Number.isFinite(now)) return 0;
    const missed = now - LATE;
    if (this._at < missed) {
      // Straight to the first pulse not too far behind, counting those before it: a stall of an
      // hour is tens of thousands of pulses, not to be gone through one at a time.
      const step = stepSeconds(this.tempo);
      let skip = Math.ceil((missed - this._at) / step);
      if (this._at + skip * step < missed) skip++; // rounding
      this._next += skip;
      this._at += skip * step;
    }
    let handed = 0;
    // Each pulse's time is the last one's and a step at the tempo then, so a tempo changed while
    // running moves no pulse already given its time. Stopped by onPulse: no more.
    while (this.running && this._at < now + LOOKAHEAD) {
      const n = this._next, time = this._at;
      this._next = n + 1;
      this._at = time + stepSeconds(this.tempo);
      handed++;
      onPulse(n, time);
    }
    return handed;
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (Number.isFinite(s?.tempo)) this.tempo = wholeTempo(s.tempo);
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the tempo now (localStorage). */
  save() {
    clearTimeout(this._saving);
    try {
      this._storage?.setItem(this._key, JSON.stringify({ tempo: this.tempo }));
    } catch {
      // storage full or blocked: it lasts this visit
    }
  }
}
