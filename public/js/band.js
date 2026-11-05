// The band, in a shared session (layersharedsession): everyone in this room plays one band, as a
// band in one room does. Its settings, every instrument's and module's (bandparts.js lists them), are
// the session's shared values, one a knob, a switch, a step or a cable, and its clock is one beat
// (beat.js). The first here in a session brings their band into it as it is; one who comes after
// takes the session's in place of their own, and keeps it when they leave. Anyone changes anything,
// and the last change is everyone's. A band's values are named for it in the session
// (instruments:<band>:<setting>), and its mark (…:band, when it was begun) is written after them, so
// two begun at once never mix: everyone plays the one begun first. What changes here is found by
// looking, a few times a second, at each setting as it is now against what was last shared; what
// changes elsewhere is set here a moment later, each part shown once all of it has been.
import { Beat, readClock, sameClock } from './beat.js';

/** @typedef {import('./clock.js').Clock} Clock */
/** @typedef {import('./beat.js').ClockValue} ClockValue */
/** @typedef {import('layersharedsession/session.js').Session} Session */
/** @typedef {import('layersharedsession/session.js').Peer} Peer */
/** @typedef {import('layersharedsession/session.js').SharedChange} SharedChange */

/** A setting's value as shared: plain, so that one read now is compared with the last without making anything. @typedef {string | number | boolean | null} Plain */

/**
 * One of the band's settings: its name in the session, the part it belongs to (its index), how it
 * is read now and set, and whether a value shared for it is one this page can take.
 * @typedef {{ name: string, part: number, read: () => Plain, write: (v: Plain) => void, valid: (v: unknown) => boolean }} Setting
 */

/**
 * A part of the band (an instrument, a module, the patch): what it does once its settings shared
 * elsewhere have been set here, all at once (shown, and what can only be set together).
 * @typedef {{ id: string, done: (get: (name: string) => unknown) => void }} Part
 */

/** Where it is: out of a session, finding the session's band, or playing it. @typedef {'off' | 'waiting' | 'playing'} BandState */

/** What is changed here is shared at most this often (ms): a knob turned is a value every 70 ms. */
export const POLL_MS = 70;
/** With others in the session, and no band in it this long (ms) after the first said who they are: this page's band is the session's. */
export const SEED_AFTER = 1500;
/**
 * Alone this long (ms) in a session come into by a link, or back in after a reload: likewise. The
 * others take a few seconds to reach (WebRTC, over relays), sometimes ten.
 */
export const SEED_ALONE = 15000;
/** Others still coming, at the latest (ms). */
export const SEED_LATEST = 20000;

/** A band's name: six of a–z and 0–9. */
const BAND_ID = /^[a-z0-9]{6}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** The band's clock's name among its values, and its mark's. */
const CLOCK = 'clock', MARK = 'band';

export class Band {
  /**
   * @param {object} o
   * @param {string} o.prefix what its values' names start with ('instruments:')
   * @param {readonly Setting[]} o.settings
   * @param {readonly Part[]} o.parts
   * @param {Clock} o.clock the room's clock
   * @param {Beat} [o.beat]
   * @param {(v: ClockValue, was: ClockValue | null, who: string, initial: boolean) => void} [o.onClock] the band's clock as another set it (who: their name), to set here
   * @param {(changed: number, joining: boolean) => void} [o.onAdopt] the session's band taken in place of this page's (how many settings changed; whether on joining)
   * @param {(state: BandState) => void} [o.onState]
   * @param {() => number} [o.now] ms, for its timers
   * @param {() => number} [o.wall] ms since 1970, for when a band was begun
   * @param {() => number} [o.random] 0…1, for a band's name
   */
  constructor({ prefix, settings, parts, clock, beat = new Beat(), onClock = () => {}, onAdopt = () => {}, onState = () => {}, now = () => performance.now(), wall = () => Date.now(), random = Math.random }) {
    /** Its beat (beat.js). */
    this.beat = beat;
    /** Where it is. @type {BandState} */
    this.state = 'off';
    /** The band played, '' while none is. */
    this.id = '';
    /** @private */
    this._prefix = prefix;
    /** @private */
    this._settings = settings;
    /** @private */
    this._parts = parts;
    /** @private */
    this._clock = clock;
    /** @private */
    this._onClock = onClock;
    /** @private */
    this._onAdopt = onAdopt;
    /** @private */
    this._onState = onState;
    /** @private */
    this._now = now;
    /** @private */
    this._wall = wall;
    /** @private */
    this._random = random;
    /** @private each setting's index by name @type {Map<string, number>} */
    this._index = new Map(settings.map((s, i) => [s.name, i]));
    /** @private each setting's value in the session's band, by index @type {string[]} */
    this._keys = settings.map(() => '');
    /** @private the band's clock's value's name */
    this._clockKey = '';
    /** @private what each setting was when last shared (undefined: not yet) @type {(Plain | undefined)[]} */
    this._known = settings.map(() => undefined);
    /** @private which settings another changed since they were last set here */
    this._dirty = new Uint8Array(settings.length);
    /** @private how many */
    this._dirtyCount = 0;
    /** @private the parts a change touched */
    this._touched = new Uint8Array(parts.length);
    /** @private whether another changed the band's clock: by whom, and on arriving */
    this._clockDirty = false;
    this._clockBy = '';
    this._clockInitial = false;
    /** @private whether a band's mark came */
    this._marks = false;
    /** @private @type {Session | null} */
    this._session = null;
    /** @private which of the others are in this room @type {(p: Peer) => boolean} */
    this._here = () => false;
    /** @private @type {(() => void)[]} */
    this._offs = [];
    /** @private when it joined, and when the first other said who they are (NaN: none yet) */
    this._joinedAt = 0;
    this._helloAt = NaN;
    /** @private whether this page began the session (attach) */
    this._began = false;
    /** @private when it looks again at what changed here */
    this._nextPoll = 0;
    /** @private a setting's value in the session's band, by name */
    this._get = (/** @type {string} */ name) => this._session?.get(`${this._prefix}${this.id}:${name}`);
  }

  /** Whether it plays a session's band. */
  get playing() {
    return this.state === 'playing';
  }

  /**
   * In a session: its band found, or this page's brought in (tick). `here`: whether another is in
   * this room (only they share its clock's beat). `first`: this page began the session, in a new
   * room no one else can be in yet, so its band is the session's at once.
   * @param {Session} session
   * @param {(p: Peer) => boolean} here
   * @param {{ first?: boolean }} [o]
   */
  attach(session, here, { first = false } = {}) {
    this.detach();
    this._session = session;
    this._here = here;
    this._joinedAt = this._now();
    this._helloAt = NaN;
    this._began = first;
    this._marks = true;
    const time = session.channel(`${this._prefix}time`);
    this.beat.attach((data, peerId) => void time.send(data, peerId), () => session.self.memberId);
    this._offs.push(
      session.on('shared', (e) => this._shared(e)),
      session.on('join', (p) => this._peer(p)),
      session.on('update', (p) => this._peer(p)),
      session.on('leave', (p) => this.beat.gone(p)),
      time.on((data, p) => this.beat.hear(data, p)),
    );
    for (const p of session.peers.values()) this._peer(p);
    this._setState('waiting');
  }

  /** Out of the session: what it plays stays as it is, its own now. */
  detach() {
    for (const off of this._offs) off();
    this._offs.length = 0;
    this.beat.detach();
    this._session = null;
    this.id = '';
    this._dirty.fill(0);
    this._dirtyCount = 0;
    this._clockDirty = false;
    this._marks = false;
    this._setState('off');
  }

  /**
   * Every few milliseconds (main.js's timer): the session's band found or brought in; then what
   * changed here shared, and what changed elsewhere set here; the beat's pings, and its clock
   * written again when its writer has gone and it is this page's turn.
   */
  tick() {
    const s = this._session;
    if (!s) return;
    const t = this._now();
    if (this.state === 'waiting') this._settle(t);
    if (!this.playing) return;
    if (this._marks) {
      this._marks = false;
      const id = this._first();
      if (id && id !== this.id) this._adopt(id);
    }
    const due = t >= this._nextPoll;
    if (due) {
      this._nextPoll = t + POLL_MS;
      this._poll(s);
    }
    // The clock: started or stopped here shared at once, its tempo with the rest.
    const d = this.beat.differs(this._clock);
    if (d === 2 || (d === 1 && due)) {
      const v = this.beat.write(this._clock);
      if (v) this._setClock(s, v);
    }
    this._reconcile(s);
    const again = this.beat.tick();
    if (again) this._setClock(s, again);
  }

  /** @private @param {BandState} state */
  _setState(state) {
    if (state === this.state) return;
    this.state = state;
    this._onState(state);
  }

  /** @private another said who they are, or moved @param {Peer} p */
  _peer(p) {
    if (!p.memberId) return;
    if (Number.isNaN(this._helloAt)) this._helloAt = this._now();
    this.beat.peer(p, this._here(p));
  }

  /** @private a shared value changed: elsewhere, it is set here on the next tick @param {SharedChange} e */
  _shared(e) {
    if (e.from === null || !e.key.startsWith(this._prefix)) return;
    const rest = e.key.slice(this._prefix.length);
    if (rest.length < 8 || rest[6] !== ':') return;
    const id = rest.slice(0, 6), name = rest.slice(7);
    if (name === MARK) {
      this._marks = true;
      return;
    }
    if (id !== this.id) return;
    if (name === CLOCK) {
      this._clockDirty = true;
      this._clockBy = e.by;
      this._clockInitial = e.initial;
      return;
    }
    const i = this._index.get(name);
    if (i === undefined || this._dirty[i]) return;
    this._dirty[i] = 1;
    this._dirtyCount++;
  }

  /**
   * The band begun first in the session (by when, then by name), else ''.
   * @private
   */
  _first() {
    const s = this._session;
    if (!s) return '';
    let best = '', since = Infinity;
    const end = `:${MARK}`;
    for (const [key, entry] of s.shared.entries) {
      if (!key.startsWith(this._prefix) || !key.endsWith(end)) continue;
      const id = key.slice(this._prefix.length, -end.length), v = entry.value;
      const t = v && typeof v === 'object' ? /** @type {{ since?: unknown }} */ (v).since : undefined;
      if (!BAND_ID.test(id) || typeof t !== 'number' || !Number.isFinite(t)) continue;
      if (t < since || (t === since && id < best)) {
        best = id;
        since = t;
      }
    }
    return best;
  }

  /**
   * Finding the session's band: taken once one is there; else, once the others have had time to
   * say what they play (or there are none, or they never come), this page's brought in; at once if
   * this page began the session.
   * @private
   * @param {number} t
   */
  _settle(t) {
    const id = this._first();
    if (id) {
      this._adopt(id);
      return;
    }
    const s = this._session;
    if (!s) return;
    const since = t - this._joinedAt, heard = t - this._helloAt;
    if (this._began || heard >= SEED_AFTER || (!s.peers.size && since >= SEED_ALONE) || since >= SEED_LATEST) this._seed(s);
  }

  /** @private its values' names in band `id` @param {string} id */
  _use(id) {
    this.id = id;
    this._settings.forEach((st, i) => (this._keys[i] = `${this._prefix}${id}:${st.name}`));
    this._clockKey = `${this._prefix}${id}:${CLOCK}`;
  }

  /**
   * This page's band brought into the session: every setting shared as it is here, its clock, and
   * then its mark.
   * @private
   * @param {Session} s
   */
  _seed(s) {
    let id = '';
    for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(this._random() * ALPHABET.length) % ALPHABET.length];
    this._use(id);
    this._settings.forEach((st, i) => {
      const v = st.read();
      s.set(this._keys[i], v);
      this._known[i] = v;
    });
    this.beat.receive(null);
    const v = this.beat.write(this._clock);
    if (v) this._setClock(s, v); // else once it can be (tick)
    s.set(`${this._prefix}${id}:${MARK}`, { since: this._wall() });
    this._nextPoll = this._now() + POLL_MS;
    this._setState('playing');
  }

  /**
   * Band `id` taken in place of what is played here: each of its settings set here (one not there,
   * from a page that has fewer, shared from here; one this page can't take, left as it is), each part
   * done, and its clock.
   * @private
   * @param {string} id
   */
  _adopt(id) {
    const s = this._session;
    if (!s) return;
    const joining = this.state === 'waiting';
    this._use(id);
    const touched = this._touched;
    touched.fill(0);
    let changed = 0;
    this._settings.forEach((st, i) => {
      const entry = s.shared.entries.get(this._keys[i]);
      if (!entry) return;
      const v = entry.value;
      if (st.valid(v) && v !== st.read()) {
        st.write(/** @type {Plain} */ (v));
        touched[st.part] = 1;
        changed++;
      }
    });
    this._finish(touched);
    this._settings.forEach((st, i) => (this._known[i] = s.shared.entries.has(this._keys[i]) ? st.read() : undefined));
    this._dirty.fill(0);
    this._dirtyCount = 0;
    this._clockDirty = false;
    const v = readClock(s.get(this._clockKey)), was = this.beat.value;
    if (v && !sameClock(v, was)) {
      if (this._clock.running !== v.on || this._clock.tempo !== v.bpm) changed++;
      this.beat.receive(v);
      this._onClock(v, was, '', true);
    } else if (!v) this.beat.receive(null); // shared from here (tick)
    this._nextPoll = 0;
    this._setState('playing');
    this._onAdopt(changed, joining);
  }

  /**
   * What changed here since it was last shared, shared: each setting read as it is now.
   * @private
   * @param {Session} s
   */
  _poll(s) {
    const settings = this._settings, known = this._known;
    for (let i = 0; i < settings.length; i++) {
      const v = settings[i].read();
      if (v === known[i]) continue;
      known[i] = v;
      s.set(this._keys[i], v);
    }
  }

  /**
   * What another changed, set here: each setting (one this page can't take left as it is), then
   * each part touched done; and its clock.
   * @private
   * @param {Session} s
   */
  _reconcile(s) {
    if (this._clockDirty) {
      this._clockDirty = false;
      const v = readClock(s.get(this._clockKey)), was = this.beat.value;
      if (v && !sameClock(v, was)) {
        this.beat.receive(v);
        this._onClock(v, was, this._who(this._clockBy), this._clockInitial);
      }
    }
    if (!this._dirtyCount) return;
    const settings = this._settings, dirty = this._dirty, touched = this._touched;
    touched.fill(0);
    for (let i = 0; i < settings.length; i++) {
      if (!dirty[i]) continue;
      const st = settings[i], v = s.get(this._keys[i]);
      if (st.valid(v) && v !== st.read()) {
        st.write(/** @type {Plain} */ (v));
        touched[st.part] = 1;
      }
    }
    this._finish(touched);
    for (let i = 0; i < settings.length; i++) {
      if (!dirty[i]) continue;
      this._known[i] = settings[i].read();
      dirty[i] = 0;
    }
    this._dirtyCount = 0;
  }

  /** @private each part touched, done @param {Uint8Array} touched */
  _finish(touched) {
    for (let p = 0; p < this._parts.length; p++) if (touched[p]) this._parts[p].done(this._get);
  }

  /** @private the band's clock written here, for everyone @param {Session} s @param {ClockValue} v */
  _setClock(s, v) {
    s.set(this._clockKey, v);
    this.beat.receive(v);
  }

  /** @private who member `by` is, in words @param {string} by */
  _who(by) {
    for (const p of this._session?.peers.values() ?? []) if (p.memberId === by && p.name) return p.name;
    return 'Someone';
  }
}
