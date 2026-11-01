// The synth's arpeggiator (synth.js plays it): the notes held, played one at a time in turn, a step
// of a clock each, as the poly synths of the early 1980s had it: up, down, up and down (the top and
// the bottom once each way round), or at random; over one, two or three octaves (RANGE), the chord
// and then the chord an octave up. With HOLD the notes stay when their keys are let go, until a key
// goes down with none held, which starts a new chord; a note tapped (a click, the TV's OK: no key
// held for it) comes into the chord, or leaves it if it was there. Each note is played as hard as its
// key went down. Its steps come from the room's clock when one is patched into the synth and running
// (main.js hands them to the synth), else from its own, 16ths at the room's tempo (run), the first
// at once.

/** @typedef {'up' | 'down' | 'updown' | 'random'} ArpMode */

/**
 * The ways it plays: what each is called on the synth's panel (short) and in words.
 * @type {readonly { id: ArpMode, label: string, name: string }[]}
 */
export const ARP_MODES = Object.freeze([
  { id: 'up', label: 'UP', name: 'Up' },
  { id: 'down', label: 'DOWN', name: 'Down' },
  { id: 'updown', label: 'UP+DN', name: 'Up and down' },
  { id: 'random', label: 'RAND', name: 'Random' },
]);

/** The octaves it can play the chord over (RANGE goes round them). */
export const ARP_RANGES = Object.freeze([1, 2, 3]);

/** How much of its step a note sounds. */
export const ARP_GATE = 0.55;

/** A step of its own clock more than this many seconds behind (the page stalled, or was put away) is skipped. */
export const ARP_LATE = 0.1;

/** Whether `m` is one of the ways it plays. @param {unknown} m @returns {m is ArpMode} */
export const isArpMode = (m) => ARP_MODES.some((x) => x.id === m);

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Arp {
  /** @param {{ random?: () => number }} [o] the dice, for RAND */
  constructor({ random = Math.random } = {}) {
    /** Which way it plays, else null: off, the keys played as they are. @type {ArpMode | null} */
    this.mode = null;
    /** The notes stay when their keys are let go. */
    this.hold = false;
    /** How many octaves it plays the chord over (ARP_RANGES). */
    this.range = 1;
    /** @private the chord: each note in it and how hard it went down (0…1) @type {Map<number, number>} */
    this._chord = new Map();
    /** @private the keys down now @type {Set<number>} */
    this._down = new Set();
    /** @private the notes in the order played, worked out again when the chord or the settings change @type {number[] | null} */
    this._order = null;
    /** @private where it is in them: the last note played's place, -1 before the first */
    this._at = -1;
    /** @private the last note played, -1 before the first */
    this._last = -1;
    /** @private when its own clock's next step falls (the audio clock's time): -Infinity, at once */
    this._next = -Infinity;
    /** @private */
    this._random = random;
  }

  /** Whether it is on. */
  get on() {
    return this.mode !== null;
  }

  /** Whether it has notes to play. */
  get playing() {
    return this._chord.size > 0;
  }

  /** The notes in the chord, lowest first. */
  get notes() {
    return [...this._chord.keys()].sort((a, b) => a - b);
  }

  /** Which way it plays, or off (null); the chord stays from one way to another, and goes when it is off. @param {ArpMode | null} mode */
  setMode(mode) {
    const m = isArpMode(mode) ? mode : null;
    if (m === this.mode) return;
    this.mode = m;
    if (m) this._order = null;
    else this.clear();
  }

  /** HOLD on, or off: then the notes whose keys are up leave the chord. @param {boolean} on */
  setHold(on) {
    this.hold = !!on;
    if (this.hold) return;
    for (const n of [...this._chord.keys()]) if (!this._down.has(n)) this._chord.delete(n);
    this._changed();
  }

  /** The octaves it plays over, one of ARP_RANGES (another number: the nearest). @param {number} n */
  setRange(n) {
    if (!Number.isFinite(n)) return;
    this.range = clamp(Math.round(n), ARP_RANGES[0], ARP_RANGES[ARP_RANGES.length - 1]);
    this._order = null;
  }

  /** RANGE pressed: the next of ARP_RANGES, round to the first. */
  nextRange() {
    const at = ARP_RANGES.indexOf(this.range);
    this.setRange(ARP_RANGES[(at + 1) % ARP_RANGES.length]);
  }

  /**
   * A key down: its note into the chord (with HOLD and no other key down, a new chord). Whether the
   * chord was empty, so its first note is to play now.
   * @param {number} note
   * @param {number} [velocity] 0…1
   */
  press(note, velocity = 0.8) {
    const empty = this._chord.size === 0;
    if (this.hold && this._down.size === 0 && !empty) {
      this._chord.clear();
      this._restart();
    }
    this._down.add(note);
    this._chord.set(note, clamp(velocity, 0, 1));
    this._changed();
    return empty;
  }

  /** A key let go: its note out of the chord, unless HOLD keeps it. @param {number} note */
  release(note) {
    this._down.delete(note);
    if (!this.hold && this._chord.delete(note)) this._changed();
  }

  /**
   * A note tapped (no key held for it): into the chord, or out if it was there. Whether the chord
   * was empty, so its first note is to play now.
   * @param {number} note
   * @param {number} [velocity] 0…1
   */
  toggle(note, velocity = 0.8) {
    const empty = this._chord.size === 0;
    if (!this._chord.delete(note)) this._chord.set(note, clamp(velocity, 0, 1));
    this._changed();
    return empty && this._chord.size > 0;
  }

  /** Every note out of the chord, every key up. */
  clear() {
    this._chord.clear();
    this._down.clear();
    this._changed();
  }

  /** The note to play next, the order moved on to it; -1 with nothing in the chord. */
  next() {
    const order = this._sequence(), n = order.length;
    if (!n) return -1;
    if (this.mode === 'random') {
      // Anywhere in the order but the note just played (with another to play).
      const was = order.indexOf(this._last), others = was >= 0 && n > 1;
      let i = Math.floor(this._random() * (others ? n - 1 : n)) % n;
      if (others && i >= was) i++;
      this._at = i;
    } else this._at = (this._at + 1) % n;
    this._last = order[this._at];
    return this._last;
  }

  /** How hard a note it plays (one an octave or two up, its own in the chord's) went down, 0…1. @param {number} note */
  velocity(note) {
    for (let o = 0; o < this.range; o++) {
      const v = this._chord.get(note - 12 * o);
      if (v !== undefined) return v;
    }
    return 0.8;
  }

  /**
   * On its own clock (none patched in, or the room's stopped): hands out each step due before
   * `until` (the audio clock's time), `step` seconds apart, onStep(time, step): with the chord just
   * started, the first at `now`; steps more than ARP_LATE behind skipped. How many it handed out;
   * none with nothing to play.
   * @param {number} now
   * @param {number} until
   * @param {number} step seconds
   * @param {(time: number, step: number) => void} onStep
   */
  run(now, until, step, onStep) {
    if (!this.on || !this._chord.size || !(step > 0)) {
      this._next = -Infinity;
      return 0;
    }
    if (this._next < now - ARP_LATE) this._next = now;
    let handed = 0;
    while (this._next < until) {
      const t = this._next;
      this._next = t + step;
      handed++;
      onStep(t, step);
    }
    return handed;
  }

  /** A step played at time t (on any clock), `step` seconds long: its own clock's next falls after it. @param {number} t @param {number} step */
  played(t, step) {
    this._next = t + step;
  }

  /** @private from the chord's first note again (a new chord keeps the clock's time) */
  _restart() {
    this._at = -1;
    this._last = -1;
  }

  /** @private the chord changed: the order worked out again; with nothing left, the next chord's first note at once */
  _changed() {
    this._order = null;
    if (this._chord.size) return;
    this._restart();
    this._next = -Infinity;
  }

  /**
   * The notes in the order played: the chord lowest first, then an octave up, over the range; down,
   * the other way; up and down, the top and the bottom once. Worked out again once something
   * changed, carrying on after the last note played (or, if it left the chord, where it was).
   * @private
   */
  _sequence() {
    if (this._order) return this._order;
    const chord = this.notes;
    /** @type {number[]} */
    const up = [];
    for (let o = 0; o < this.range; o++) for (const n of chord) up.push(n + 12 * o);
    const order = this.mode === 'down' ? up.reverse() : this.mode === 'updown' && up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
    this._order = order;
    const last = this._last;
    if (last >= 0) {
      const i = order.indexOf(last);
      // Gone from the chord: just before where it would be, so the next is the one after it.
      this._at = i >= 0 ? i : order.filter((n) => (this.mode === 'down' ? n > last : n < last)).length - 1;
    }
    return order;
  }
}

/**
 * The arpeggiator in words: off, or which way, over how many octaves, and HOLD ('Up, 2 octaves,
 * hold').
 * @param {{ mode: ArpMode | null, range: number, hold: boolean }} arp
 */
export function arpWords({ mode, range, hold }) {
  const m = ARP_MODES.find((x) => x.id === mode);
  if (!m) return 'Off';
  return `${m.name}, ${range} octave${range === 1 ? '' : 's'}${hold ? ', hold' : ''}`;
}
