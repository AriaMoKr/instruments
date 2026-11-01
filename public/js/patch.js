// The patch, as on a modular synth: the jacks on the room's modules (the clock's outputs, the
// drums' clock input and an output for each pad's sound, the delay's input; the synth's patch bay,
// its sound out, its arpeggiator's clock in, its LFO and filter envelope out, its pitch, cutoff and
// amp in and its notes in; and in the rack beside it the clock's outputs again and the sequencer's
// clock in and notes out) and the cables between them. A cable runs from an output to an input of
// its kind, a clock's pulses, sound, a modulation (a voltage that moves something, as an LFO's does)
// or notes (a sequencer's, to play); an input takes one cable at most, so plugging in another pulls
// the first out, and an output may feed any number. The page draws the cables and connects the sound
// as they change (onChange). The patch is kept for the next visit (localStorage) at every change, an
// input left empty on purpose too; an input added since comes as the patch comes.
import { PADS } from './drums.js';
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Store} Store */

/**
 * A jack: its id, the module it is on ('clock', 'drums', 'delay', 'synth', and the rack's
 * 'rackclock' and 'seq'), its name in words (the page's list of cables, screen readers), its label
 * (short, printed by it on the board, the synth or the rack), whether signals come out of it or go
 * in, and what kind they are.
 * @typedef {{ id: string, module: string, name: string, label: string, dir: 'in' | 'out', kind: JackKind }} Jack
 */

/** What a jack carries: a clock's pulses, sound, a modulation, or notes. @typedef {'clock' | 'audio' | 'mod' | 'notes'} JackKind */

/**
 * A cable: the output it comes from and the input it goes into.
 * @typedef {{ from: string, to: string }} Cable
 */

/**
 * A pad's output: its sound.
 * @param {import('./drums.js').Pad} p
 * @returns {Jack}
 */
const padJack = (p) => ({ id: `pad.${p.id}`, module: 'drums', name: `${p.name} out`, label: p.name, dir: 'out', kind: 'audio' });

/**
 * Every jack in the room: the clock's outputs, the drums' clock input and pads' outputs, the delay's
 * input; then the synth's patch bay, its sound out, its arpeggiator's clock in, its two modulations
 * out (the LFO, and each voice's filter envelope), the three places they can go in (the pitch, the
 * filter's cutoff, the amp) and its notes in; then the rack's, the clock's outputs (the room's clock
 * again, nearer the synth) and the sequencer's clock in and notes out.
 * @type {readonly Jack[]}
 */
export const JACKS = Object.freeze([
  { id: 'clock.x1', module: 'clock', name: 'Clock out, every step', label: '×1', dir: 'out', kind: 'clock' },
  { id: 'clock.d2', module: 'clock', name: 'Clock out, every 2nd step', label: '÷2', dir: 'out', kind: 'clock' },
  { id: 'clock.d4', module: 'clock', name: 'Clock out, every 4th step', label: '÷4', dir: 'out', kind: 'clock' },
  { id: 'drums.clock', module: 'drums', name: 'Drums clock in', label: 'CLOCK', dir: 'in', kind: 'clock' },
  ...PADS.map(padJack),
  { id: 'delay.in', module: 'delay', name: 'Delay in', label: 'IN', dir: 'in', kind: 'audio' },
  { id: 'synth.out', module: 'synth', name: 'Synth out', label: 'OUT', dir: 'out', kind: 'audio' },
  { id: 'synth.clock', module: 'synth', name: 'Arpeggiator clock in', label: 'CLOCK', dir: 'in', kind: 'clock' },
  { id: 'synth.lfo', module: 'synth', name: 'LFO out', label: 'LFO', dir: 'out', kind: 'mod' },
  { id: 'synth.env', module: 'synth', name: 'Filter envelope out', label: 'ENV', dir: 'out', kind: 'mod' },
  { id: 'synth.pitch', module: 'synth', name: 'Pitch in', label: 'PITCH', dir: 'in', kind: 'mod' },
  { id: 'synth.cutoff', module: 'synth', name: 'Cutoff in', label: 'CUTOFF', dir: 'in', kind: 'mod' },
  { id: 'synth.amp', module: 'synth', name: 'Amp in', label: 'AMP', dir: 'in', kind: 'mod' },
  { id: 'synth.notes', module: 'synth', name: 'Notes in', label: 'NOTES', dir: 'in', kind: 'notes' },
  { id: 'rack.x1', module: 'rackclock', name: 'Rack clock out, every step', label: '×1', dir: 'out', kind: 'clock' },
  { id: 'rack.d2', module: 'rackclock', name: 'Rack clock out, every 2nd step', label: '÷2', dir: 'out', kind: 'clock' },
  { id: 'rack.d4', module: 'rackclock', name: 'Rack clock out, every 4th step', label: '÷4', dir: 'out', kind: 'clock' },
  { id: 'seq.clock', module: 'seq', name: 'Sequencer clock in', label: 'CLOCK', dir: 'in', kind: 'clock' },
  { id: 'seq.notes', module: 'seq', name: 'Sequencer notes out', label: 'NOTES', dir: 'out', kind: 'notes' },
]);

/**
 * The patch the room comes with: input id → the output plugged into it. The clock into the drums
 * and into the synth's arpeggiator; in the rack, its clock into the sequencer, and the sequencer's
 * notes into the synth.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_PATCH = Object.freeze({ 'drums.clock': 'clock.x1', 'synth.clock': 'clock.x1', 'seq.clock': 'rack.x1', 'synth.notes': 'seq.notes' });

/**
 * The pad (its index in PADS) whose sound comes out of jack `id`, else -1.
 * @param {string | null} id
 */
export const padForJack = (id) => PADS.findIndex((p) => `pad.${p.id}` === id);

/** The cables between the jacks: where each input's comes from, kept for the next visit. */
export class Patch {
  /**
   * @param {object} [o]
   * @param {readonly Jack[]} [o.jacks] the jacks there are
   * @param {Readonly<Record<string, string>>} [o.defaults] the patch it comes with (input id → output id)
   * @param {Store | null} [o.storage] where the patch is kept (the page's localStorage)
   * @param {string} [o.key] the key it is kept under
   */
  constructor({ jacks = JACKS, defaults = DEFAULT_PATCH, storage = pageStorage(), key = 'patch' } = {}) {
    /** The jacks, outputs and inputs. */
    this.jacks = jacks;
    /**
     * After the cable into input `to` changed: it comes from output `from` now, and came from `was`
     * before (each null for none). Once for each input that changed.
     * @type {(to: string, from: string | null, was: string | null) => void}
     */
    this.onChange = () => {};
    /** @private @type {Map<string, Jack>} */
    this._byId = new Map(jacks.map((j) => [j.id, j]));
    /** @private */
    this._defaults = defaults;
    /** Each input's cable: the output it comes from, else null; every input, in the jacks' order. @private */
    this._from = this._defaultCables();
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    this._load();
  }

  /** The jack with this id, else undefined. @param {string} id */
  jack(id) {
    return this._byId.get(id);
  }

  /** The output plugged into input `id`, else null. @param {string} id */
  source(id) {
    return this._from.get(id) ?? null;
  }

  /** The inputs output `id` feeds, in the jacks' order. @param {string} id */
  targets(id) {
    /** @type {string[]} */
    const to = [];
    for (const [input, from] of this._from) if (from === id) to.push(input);
    return to;
  }

  /**
   * Every cable, in the inputs' order.
   * @returns {Cable[]}
   */
  cables() {
    /** @type {Cable[]} */
    const all = [];
    for (const [to, from] of this._from) if (from !== null) all.push({ from, to });
    return all;
  }

  /**
   * Whether a cable can join jacks a and b, in either order: one an output, the other an input,
   * of one kind.
   * @param {string} a
   * @param {string} b
   */
  canPlug(a, b) {
    return this._ends(a, b) !== null;
  }

  /**
   * Joins jacks a and b (in either order) with a cable, the input's old cable coming out first:
   * whether it did (not if no cable can join them, or this one already does).
   * @param {string} a
   * @param {string} b
   */
  plug(a, b) {
    const ends = this._ends(a, b);
    return ends !== null && this._set([[ends.to, ends.from]]);
  }

  /**
   * Pulls out the cable into input `id`, or every cable from output `id`: whether any came out.
   * @param {string} id
   */
  unplug(id) {
    const j = this._byId.get(id);
    if (!j) return false;
    return this._set(j.dir === 'in' ? [[id, null]] : this.targets(id).map((to) => [to, null]));
  }

  /** Back to the patch it comes with. */
  reset() {
    this._set([...this._defaultCables()]);
  }

  /** Keeps the patch now (localStorage): every input's cable, null for none. */
  save() {
    try {
      this._storage?.setItem(this._key, JSON.stringify(Object.fromEntries(this._from)));
    } catch {
      // storage full or blocked: it lasts this visit
    }
  }

  /**
   * Jacks a and b as a cable would join them, the output first; null where none can.
   * @private
   * @param {string} a
   * @param {string} b
   * @returns {Cable | null}
   */
  _ends(a, b) {
    const ja = this._byId.get(a), jb = this._byId.get(b);
    if (!ja || !jb || ja.kind !== jb.kind) return null;
    if (ja.dir === 'out' && jb.dir === 'in') return { from: a, to: b };
    if (ja.dir === 'in' && jb.dir === 'out') return { from: b, to: a };
    return null;
  }

  /**
   * Every input's cable as the patch comes: its default where that can be plugged, else none.
   * @private
   */
  _defaultCables() {
    /** @type {Map<string, string | null>} */
    const from = new Map();
    for (const j of this.jacks) {
      if (j.dir !== 'in') continue;
      const out = this._defaults[j.id];
      from.set(j.id, typeof out === 'string' && this.canPlug(out, j.id) ? out : null);
    }
    return from;
  }

  /**
   * Plugs each input's cable as given (an output, or null for none), keeps the patch, then tells
   * onChange of each input that changed, in the order given: whether any did.
   * @private
   * @param {[string, string | null][]} cables input id, and the output into it
   */
  _set(cables) {
    /** @type {[string, string | null, string | null][]} */
    const changed = [];
    for (const [to, from] of cables) {
      const was = this._from.get(to) ?? null;
      if (was === from) continue;
      this._from.set(to, from);
      changed.push([to, from, was]);
    }
    if (!changed.length) return false;
    this.save();
    for (const [to, from, was] of changed) this.onChange(to, from, was);
    return true;
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (!s || typeof s !== 'object') return;
      for (const to of [...this._from.keys()]) {
        // An input not kept, or kept with a jack that isn't there or can't be plugged into it: as it comes.
        if (!Object.hasOwn(s, to)) continue;
        const from = s[to];
        if (from === null) this._from.set(to, null); // left empty on purpose
        else if (typeof from === 'string' && this.canPlug(from, to)) this._from.set(to, from);
      }
    } catch {
      // none kept, or not readable: as it comes
    }
  }
}
