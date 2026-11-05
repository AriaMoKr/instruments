// Playing together, in a shared session (layersharedsession): what each visitor in this room plays
// live is sent to the others here as it is played, and played there as it arrives, behind the beat by
// the network's delay. A pad struck and how hard; a key of the synth's or the keyboard's down and up,
// or played a moment; the sustain pedal, the pitch bend and the mod wheel; the guitar's strings
// plucked, strummed, pressed at a fret, slid, bent, let go and muted, and a MIDI note on it. What
// follows from that (the NOTES cables, the arpeggiator, the envelope) is worked out on each page from
// the band they share (band.js), so nothing is sent twice and no sound is streamed. Each message is
// checked as it comes; so many notes a second are played from each visitor, and those beyond are not
// (what lets go of a note always is). A move (a bend, the mod wheel, a string bent) is sent at most
// every MOVE_MS, its latest, and before anything played after it. Holds keeps who holds which note,
// so that one visitor letting go of a note another holds too doesn't cut it short, and what a visitor
// holds is let go when they let go of it, leave this room or leave the session.
import { PADS } from './drums.js';
import { FRETS, MAX_BEND } from './guitar.js';
import { PICK } from './strings.js';

/** @typedef {import('layersharedsession/session.js').Session} Session */
/** @typedef {import('layersharedsession/session.js').Peer} Peer */

/** The synth's keys ('s') or the keyboard's ('k'). @typedef {'s' | 'k'} Keyed */

/**
 * What is played, as it is sent: a pad struck (its index, how hard 0…1); a key's note down, up, or
 * played a moment, on the synth or the keyboard, and its sustain pedal down or up; the synth's pitch
 * bend (−1…1) and mod wheel (0…1); a string of the guitar's plucked (how hard, where the pick meets
 * it, seconds from now), all strummed (down or up), pressed at a fret and plucked, pressed a moment,
 * slid to a fret, bent (semitones), let go, all muted; a MIDI note on the guitar down and up; and
 * everything this visitor holds let go (their page put away).
 * @typedef {['pad', number, number]
 *   | ['on', Keyed, number, number] | ['off', Keyed, number] | ['tap', Keyed, number, number] | ['sus', Keyed, boolean]
 *   | ['bend', number] | ['mod', number]
 *   | ['pluck', number, number, number, number] | ['strum', boolean, number]
 *   | ['fret', number, number, number] | ['ftap', number, number, number] | ['slide', number, number]
 *   | ['gbend', number, number] | ['lift', number] | ['mute']
 *   | ['gon', number, number] | ['goff', number]
 *   | ['all']} Play
 */

/** What a play does: starts a sound, moves one, or ends one. @typedef {'start' | 'move' | 'end'} PlayKind */

/** The channel's name, after the room's prefix. */
export const JAM_CHANNEL = 'play';
/** Notes started a second from each visitor at most, as many at once (a chord, a sweep, a burst). */
export const NOTE_RATE = 40, NOTE_BURST = 64;
/** Moves a second from each visitor at most, as many at once. */
export const MOVE_RATE = 240, MOVE_BURST = 120;
/** Notes a visitor holds on an instrument at most: the next aren't played (main.js). */
export const MAX_HELD = 16;
/** A move is sent at most this often (ms), its latest value. */
export const MOVE_MS = 30;
/** How far ahead a pluck can be (seconds): a sweep spread over its move. */
export const MAX_DELAY = 0.25;

/** An integer from lo to hi. @param {unknown} v @param {number} lo @param {number} hi @returns {v is number} */
const isInt = (v, lo, hi) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
/** A number, held within lo…hi; NaN if it isn't one. @param {unknown} v @param {number} lo @param {number} hi */
const within = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : NaN);
/** Whether every one of them is a number (within: not NaN). @param {number[]} vs */
const numbers = (...vs) => vs.every((v) => !Number.isNaN(v));
/** @param {unknown} v @returns {v is Keyed} */
const isKeyed = (v) => v === 's' || v === 'k';
/** A MIDI note. @param {unknown} v @returns {v is number} */
const isNote = (v) => isInt(v, 0, 127);
/** One of the guitar's six strings. @param {unknown} v @returns {v is number} */
const isString = (v) => isInt(v, 0, 5);

/**
 * A message as another sent it, checked: a Play made anew from it (each number held within its
 * range; what comes after what this page knows of it left out), else null (not one, or a kind this
 * page doesn't know: a newer page's).
 * @param {unknown} data
 * @returns {Play | null}
 */
export function readPlay(data) {
  if (!Array.isArray(data)) return null;
  const n = data.length, [kind, a, b, c, d] = /** @type {unknown[]} */ (data);
  switch (kind) {
    case 'pad': {
      const v = within(b, 0, 1);
      return n >= 3 && isInt(a, 0, PADS.length - 1) && numbers(v) ? ['pad', a, v] : null;
    }
    case 'on':
    case 'tap': {
      const v = within(c, 0, 1);
      return n >= 4 && isKeyed(a) && isNote(b) && numbers(v) ? [kind, a, b, v] : null;
    }
    case 'off':
      return n >= 3 && isKeyed(a) && isNote(b) ? ['off', a, b] : null;
    case 'sus':
      return n >= 3 && isKeyed(a) && typeof b === 'boolean' ? ['sus', a, b] : null;
    case 'bend': {
      const v = within(a, -1, 1);
      return n >= 2 && numbers(v) ? ['bend', v] : null;
    }
    case 'mod': {
      const v = within(a, 0, 1);
      return n >= 2 && numbers(v) ? ['mod', v] : null;
    }
    case 'pluck': {
      const v = within(b, 0, 1), pick = within(c, PICK.min, PICK.max), delay = within(d, 0, MAX_DELAY);
      return n >= 5 && isString(a) && numbers(v, pick, delay) ? ['pluck', a, v, pick, delay] : null;
    }
    case 'strum': {
      const v = within(b, 0, 1);
      return n >= 3 && typeof a === 'boolean' && numbers(v) ? ['strum', a, v] : null;
    }
    case 'fret':
    case 'ftap': {
      const v = within(c, 0, 1);
      return n >= 4 && isString(a) && isInt(b, 0, FRETS) && numbers(v) ? [kind, a, b, v] : null;
    }
    case 'slide':
      return n >= 3 && isString(a) && isInt(b, 0, FRETS) ? ['slide', a, b] : null;
    case 'gbend': {
      const v = within(b, 0, MAX_BEND);
      return n >= 3 && isString(a) && numbers(v) ? ['gbend', a, v] : null;
    }
    case 'lift':
      return n >= 2 && isString(a) ? ['lift', a] : null;
    case 'gon': {
      const v = within(b, 0, 1);
      return n >= 3 && isNote(a) && numbers(v) ? ['gon', a, v] : null;
    }
    case 'goff':
      return n >= 2 && isNote(a) ? ['goff', a] : null;
    case 'mute':
    case 'all':
      return [kind];
    default:
      return null;
  }
}

/**
 * Whether a play starts a sound (capped, NOTE_RATE), moves one (a pedal, a wheel, a slide, a bend,
 * a palm: MOVE_RATE) or lets go of what its player holds (never capped: a note is always let go).
 * @param {Play} play
 * @returns {PlayKind}
 */
export function kindOf(play) {
  switch (play[0]) {
    case 'pad':
    case 'on':
    case 'tap':
    case 'pluck':
    case 'strum':
    case 'fret':
    case 'ftap':
    case 'gon':
      return 'start';
    case 'off':
    case 'lift':
    case 'goff':
    case 'all':
      return 'end';
    default:
      return 'move';
  }
}

/**
 * The instrument a play is on, else null (everything let go).
 * @param {Play} play
 * @returns {'drums' | 'synth' | 'keys' | 'guitar' | null}
 */
export function instrumentOf(play) {
  switch (play[0]) {
    case 'pad':
      return 'drums';
    case 'on':
    case 'off':
    case 'tap':
    case 'sus':
      return play[1] === 's' ? 'synth' : 'keys';
    case 'bend':
    case 'mod':
      return 'synth';
    case 'all':
      return null;
    default:
      return 'guitar';
  }
}

/**
 * What a move moves, so that only its latest is sent (a bend, the mod wheel, a string bent); null
 * for the rest, sent as they come.
 * @param {Play} play
 */
export function moveKey(play) {
  if (play[0] === 'bend' || play[0] === 'mod') return play[0];
  if (play[0] === 'gbend') return `gbend:${play[1]}`;
  return null;
}

/**
 * Who holds which note of an instrument (or which of its strings, or MIDI notes): '' this page's
 * visitor, else another's page (its peerId). A note sounds while anyone holds it: let go when the
 * last of them lets go.
 */
export class Holds {
  constructor() {
    /** @private each note held, and who hold it, the latest last @type {Map<number, string[]>} */
    this._by = new Map();
  }

  /** `who` holds `note`, as the latest to. @param {string} who @param {number} note */
  on(who, note) {
    const a = this._by.get(note);
    if (!a) {
      this._by.set(note, [who]);
      return;
    }
    const i = a.indexOf(who);
    if (i >= 0) a.splice(i, 1);
    a.push(who);
  }

  /**
   * `who` lets go of `note`: whether no one holds it now, so that it is let go (also when no one held
   * it: as it was let go before anyone else held it).
   * @param {string} who
   * @param {number} note
   */
  off(who, note) {
    const a = this._by.get(note);
    if (!a) return true;
    const i = a.indexOf(who);
    if (i >= 0) a.splice(i, 1);
    if (a.length) return false;
    this._by.delete(note);
    return true;
  }

  /** Whether `who` holds `note`. @param {string} who @param {number} note */
  has(who, note) {
    return this._by.get(note)?.includes(who) ?? false;
  }

  /** The notes `who` holds. @param {string} who */
  of(who) {
    /** @type {number[]} */
    const notes = [];
    for (const [note, a] of this._by) if (a.includes(who)) notes.push(note);
    return notes;
  }

  /** How many notes `who` holds. @param {string} who */
  count(who) {
    let n = 0;
    for (const a of this._by.values()) if (a.includes(who)) n++;
    return n;
  }

  /** Who holds `note` latest, else undefined. @param {number} note */
  last(note) {
    const a = this._by.get(note);
    return a ? a[a.length - 1] : undefined;
  }

  /** Whether anyone holds anything. */
  get size() {
    return this._by.size;
  }

  /** None held (every note let go some other way: the page put away). */
  clear() {
    this._by.clear();
  }
}

/** A visitor's allowance of notes, or of moves: how many are left, and when that was. @typedef {{ notes: number, notesAt: number, moves: number, movesAt: number }} Allowance */

/**
 * One of a visitor's allowance spent, if it has one left: refilled at `rate` a second up to `burst`.
 * @param {Allowance} w
 * @param {'notes' | 'moves'} what
 * @param {number} t ms
 * @param {number} rate
 * @param {number} burst
 */
function spend(w, what, t, rate, burst) {
  const at = what === 'notes' ? 'notesAt' : 'movesAt';
  const left = Math.min(burst, w[what] + (Math.max(0, t - w[at]) * rate) / 1000);
  w[at] = t;
  if (left < 1) {
    w[what] = left;
    return false;
  }
  w[what] = left - 1;
  return true;
}

export class Jam {
  /**
   * @param {object} o
   * @param {string} o.prefix what its channel's name starts with ('instruments:')
   * @param {(play: Play, p: Peer) => void} o.onPlay another's playing, checked, as it arrives
   * @param {(peerId: string) => void} o.onGone another who played here gone (left the session or this room, or this page left it): what they hold to let go
   * @param {() => boolean} [o.ready] whether playing goes either way now (main.js: while the band is the session's); what lets go always does
   * @param {() => number} [o.now] ms, for its allowances and its moves
   */
  constructor({ prefix, onPlay, onGone, ready = () => true, now = () => performance.now() }) {
    /** @private */
    this._prefix = prefix;
    /** @private */
    this._onPlay = onPlay;
    /** @private */
    this._onGone = onGone;
    /** @private */
    this._ready = ready;
    /** @private */
    this._now = now;
    /** @private @type {Session | null} */
    this._session = null;
    /** @private which of the others are in this room @type {(p: Peer) => boolean} */
    this._here = () => false;
    /** @private sends a play to everyone, or to one @type {(play: Play, peerId?: string) => void} */
    this._send = () => {};
    /** @private @type {(() => void)[]} */
    this._offs = [];
    /** @private those who have played here, and what each has left to play @type {Map<string, Allowance>} */
    this._players = new Map();
    /** @private the moves waiting to be sent, by what they move @type {Map<string, Play>} */
    this._waiting = new Map();
    /** @private when each move was last sent @type {Map<string, number>} */
    this._movedAt = new Map();
  }

  /** Whether it is in a session. */
  get attached() {
    return this._session !== null;
  }

  /**
   * In a session: playing sent to the others in this room (`here`), and theirs heard.
   * @param {Session} session
   * @param {(p: Peer) => boolean} here
   */
  attach(session, here) {
    this.detach();
    this._session = session;
    this._here = here;
    const channel = session.channel(`${this._prefix}${JAM_CHANNEL}`);
    this._send = (play, peerId) => void channel.send(play, peerId);
    this._offs.push(
      channel.on((data, p) => this._hear(data, p)),
      session.on('leave', (p) => this._gone(p.peerId)),
      session.on('update', (p) => {
        if (!this._here(p)) this._gone(p.peerId);
      }),
    );
  }

  /** Out of the session: what the others hold here let go. */
  detach() {
    for (const off of this._offs) off();
    this._offs.length = 0;
    this._session = null;
    this._waiting.clear();
    this._movedAt.clear();
    for (const peerId of [...this._players.keys()]) this._gone(peerId);
  }

  /**
   * This page's playing, for the others in this room, while it goes (ready; what lets go goes anyway,
   * for what they hold of this visitor's from before): at once; a move at most every MOVE_MS (its
   * latest, the rest by tick), and any waiting before what is played after it.
   * @param {Play} play
   */
  send(play) {
    if (!this._session || (!this._ready() && kindOf(play) !== 'end')) return;
    const key = moveKey(play);
    if (key === null) {
      this._flush();
      this._out(play);
      return;
    }
    const t = this._now();
    if (t - (this._movedAt.get(key) ?? -Infinity) >= MOVE_MS) {
      this._waiting.delete(key);
      this._movedAt.set(key, t);
      this._out(play);
    } else this._waiting.set(key, play);
  }

  /** Every few milliseconds (main.js's timer): the moves waiting, sent once it is their time. */
  tick() {
    if (!this._waiting.size) return;
    const t = this._now();
    for (const [key, play] of this._waiting) {
      if (t - (this._movedAt.get(key) ?? -Infinity) < MOVE_MS) continue;
      this._waiting.delete(key);
      this._movedAt.set(key, t);
      this._out(play);
    }
  }

  /** @private every move waiting, sent now */
  _flush() {
    if (!this._waiting.size) return;
    const t = this._now();
    for (const [key, play] of this._waiting) {
      this._movedAt.set(key, t);
      this._out(play);
    }
    this._waiting.clear();
  }

  /** @private a play to everyone in this room: to all at once when all are @param {Play} play */
  _out(play) {
    const s = this._session;
    if (!s) return;
    let all = true, any = false;
    for (const p of s.peers.values()) {
      if (this._here(p)) any = true;
      else all = false;
    }
    if (!any) return;
    if (all) this._send(play);
    else for (const p of s.peers.values()) if (this._here(p)) this._send(play, p.peerId);
  }

  /**
   * @private another's message: from one in this room, checked, within their allowance (a note or a
   * move; what lets go always), while playing goes
   * @param {unknown} data
   * @param {Peer} p
   */
  _hear(data, p) {
    if (!this._session || !this._here(p)) return;
    const play = readPlay(data);
    if (!play) return;
    const kind = kindOf(play);
    let w = this._players.get(p.peerId);
    if (kind !== 'end') {
      if (!this._ready()) return;
      const t = this._now();
      if (!w) {
        w = { notes: NOTE_BURST, notesAt: t, moves: MOVE_BURST, movesAt: t };
        this._players.set(p.peerId, w);
      }
      if (kind === 'start' ? !spend(w, 'notes', t, NOTE_RATE, NOTE_BURST) : !spend(w, 'moves', t, MOVE_RATE, MOVE_BURST)) return;
    } else if (!w) return; // nothing of theirs to let go
    this._onPlay(play, p);
  }

  /** @private one who played here gone: what they hold let go @param {string} peerId */
  _gone(peerId) {
    if (this._players.delete(peerId)) this._onGone(peerId);
  }
}
