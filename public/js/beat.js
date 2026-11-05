// The band's beat, in a shared session (band.js shares it): everyone playing one band runs the
// room's clock on one beat, as a band plays to one drummer. The clock is shared as one value,
// { on, bpm, n, at, of, seed }: whether it runs, its tempo, and while it runs that its pulse n is
// heard at `at`, in milliseconds on the clock of the visitor `of` who wrote it (their page's time
// origin and performance.now()), and the run's seed (clock.js dice). Each page measures how far each
// other page's clock is from its own as NTP does, a ping and its answer each way over a channel, the
// offset the one that came back soonest of the last few says, so that `at` is worked out on its own
// clock; and when what the audio clock plays is heard on it (getOutputTimestamp, its output's delay in
// it), so that each page's pulse n is heard at once, whatever its speakers' delay. Its clock is then
// placed on the beat and kept there (follow), eased a little at a time as the clocks under it drift,
// and moved straight onto it when it is far off (the page was asleep). When the one who wrote the
// beat leaves (or is gone from the room), one who had measured their clock writes it again on their
// own, the beat as it was; with none, the first by member id does, from the beat as it came.
import { STEPS_PER_BEAT, TEMPO } from './clock.js';

/** @typedef {import('./clock.js').Clock} Clock */

/**
 * The band's clock as shared: whether it runs, its tempo (whole beats per minute), and while it runs
 * its pulse n heard at `at` (ms on the clock of member `of`), and the run's seed; stopped, n, at and
 * seed 0 and `of` ''.
 * @typedef {{ on: boolean, bpm: number, n: number, at: number, of: string, seed: number }} ClockValue
 */

/**
 * The beat on this page's clock: pulse n heard at `at` (ms), at `bpm`. `set` false while it can't be
 * worked out yet; `sure` once it is from a clock measured (or this page's own); `value`, the shared
 * value it is from.
 * @typedef {{ set: boolean, sure: boolean, n: number, at: number, bpm: number, seed: number, value: ClockValue | null }} LocalBeat
 */

/** Another page in the room, as a session has it (layersharedsession's Peer). @typedef {{ peerId: string, memberId: string | null }} PeerLike */

/** Pings each other page this often (ms), once its first few (BURST, BURST_MS apart) are done. */
export const PING_MS = 1000;
export const BURST = 5;
export const BURST_MS = 120;
/** A ping whose answer comes back later than this (ms) is no measure. */
export const MAX_RTT = 5000;
/** The offset from another clock is the one of its last SAMPLES pings that came back soonest. */
export const SAMPLES = 10;
/** A pulse further than this (s) from the beat is moved straight onto it; a nearer one, eased. */
export const JUMP = 0.04;
/** Eased onto the beat by at most this much (s) a call: some 50 ms a second, inaudibly. */
export const NUDGE = 0.0005;
/** Nearer than this (s) to the beat, left be. */
export const DEADBAND = 0.0003;
/** How much of each new measure of when the audio clock is heard goes into it. */
export const EASE = 0.02;
/** A measure of when the audio clock is heard this far (ms) from the last is taken as it is: the sound woke, or its output changed. */
export const REMAP = 20;
/** Before writing the beat again for one gone, waits this long (ms) for each in line before it. */
export const REANCHOR_WAIT = 400;
/** A clock not measured by now (ms) is taken as this page's own: the beat as it came. */
export const MEASURE_WAIT = 2000;

/** The milliseconds between pulses at a tempo. @param {number} bpm */
export const stepMs = (bpm) => 60000 / bpm / STEPS_PER_BEAT;

/** When pulse k falls on a beat (ms, on its clock). @param {{ n: number, at: number, bpm: number }} b @param {number} k */
export const pulseAt = (b, k) => b.at + (k - b.n) * stepMs(b.bpm);

/**
 * The first pulse of a beat at or after time t (ms, on its clock), and none before the beat's own.
 * @param {{ n: number, at: number, bpm: number }} b
 * @param {number} t
 */
export function pulseAfter(b, t) {
  const d = (t - b.at) / stepMs(b.bpm);
  return b.n + (d > 0 ? Math.ceil(d - 1e-9) : 0);
}

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * A shared clock's value as this page takes it, else null: what another page wrote may be anything.
 * The tempo whole and within TEMPO's range.
 * @param {unknown} v
 * @returns {ClockValue | null}
 */
export function readClock(v) {
  if (!v || typeof v !== 'object') return null;
  const { on, bpm, n, at, of, seed } = /** @type {Record<string, unknown>} */ (v);
  if (typeof on !== 'boolean' || typeof bpm !== 'number' || !Number.isFinite(bpm)) return null;
  const tempo = clamp(Math.round(bpm), TEMPO.min, TEMPO.max);
  if (!on) return { on, bpm: tempo, n: 0, at: 0, of: '', seed: 0 };
  if (!Number.isSafeInteger(n) || typeof n !== 'number' || n < 0 || typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (typeof of !== 'string' || !of || typeof seed !== 'number' || !Number.isInteger(seed)) return null;
  return { on, bpm: tempo, n, at, of, seed: seed >>> 0 };
}

/** Whether two clock values say the same. @param {ClockValue | null} a @param {ClockValue | null} b */
export const sameClock = (a, b) =>
  a === b || (!!a && !!b && a.on === b.on && a.bpm === b.bpm && a.n === b.n && a.at === b.at && a.of === b.of && a.seed === b.seed);

/** How far another page's clock is from this one's: what its last pings measured. */
export class Offsets {
  constructor(size = SAMPLES) {
    /** @private */
    this._rtt = new Float64Array(size);
    /** @private */
    this._off = new Float64Array(size);
    /** @private where the next goes */
    this._i = 0;
    /** How many it has, up to SAMPLES. */
    this.count = 0;
  }

  /**
   * A ping's measure: how long its answer took to come back (ms), and how far the other clock was
   * ahead of this one when it answered, taking the way there and back to be as long.
   * @param {number} rtt
   * @param {number} offset
   */
  add(rtt, offset) {
    if (!(rtt >= 0) || !Number.isFinite(offset)) return;
    this._rtt[this._i] = rtt;
    this._off[this._i] = offset;
    this._i = (this._i + 1) % this._rtt.length;
    this.count = Math.min(this.count + 1, this._rtt.length);
  }

  /** The other clock's lead on this one (ms): the ping that came back soonest says it best. NaN with none. */
  get offset() {
    let best = -1;
    for (let i = 0; i < this.count; i++) if (best < 0 || this._rtt[i] < this._rtt[best]) best = i;
    return best < 0 ? NaN : this._off[best];
  }

  /** The soonest a ping came back (ms), NaN with none. */
  get rtt() {
    let best = Infinity;
    for (let i = 0; i < this.count; i++) best = Math.min(best, this._rtt[i]);
    return this.count ? best : NaN;
  }
}

/**
 * A page here, by its member id: its peer id now, how far its clock is, whether it says it is on the
 * beat, and when it is to be pinged next.
 * @typedef {{ peerId: string, offsets: Offsets, locked: boolean, next: number, burst: number }} Other
 */

/** The beat: the band's clock as shared, worked out on this page's clock and its audio clock. */
export class Beat {
  /**
   * @param {{ origin?: number, clock?: () => number }} [o] this page's time origin (ms) and its time since (performance.now())
   */
  constructor({ origin = performance.timeOrigin, clock = () => performance.now() } = {}) {
    /** This page's time origin (ms): its clock is this and clock() (a test moves it, as another computer's would be). */
    this.origin = origin;
    /** @private */
    this._clock = clock;
    /** The band's clock as last shared, else null. @type {ClockValue | null} */
    this.value = null;
    /** The beat on this page's clock (_place). @type {LocalBeat} */
    this.local = { set: false, sure: false, n: 0, at: 0, bpm: TEMPO.value, seed: 0, value: null };
    /** @private @type {((data: object, peerId: string) => void) | null} */
    this._send = null;
    /** @private this page's member id */
    this._self = () => '';
    /** @private the others here, by member id @type {Map<string, Other>} */
    this._peers = new Map();
    /** @private when the audio clock's time is heard on this page's clock: heard (ms) = time × 1000 + this */
    this._delta = NaN;
    /** @private when the writer of the value was first not measured (ms) */
    this._since = 0;
    /** @private when its writer was first seen gone (ms), NaN while not */
    this._gone = NaN;
  }

  /** This page's clock now (ms). */
  now() {
    return this.origin + this._clock();
  }

  /** This page's member id in the session, '' out of one. */
  get me() {
    return this._self();
  }

  /** Whether it knows when the audio clock is heard. */
  get mapped() {
    return Number.isFinite(this._delta);
  }

  /** Whether it is on the beat surely: from a clock measured, or its own. */
  get locked() {
    this._place(this.now());
    return this.local.set && this.local.sure;
  }

  /**
   * In a session: how it sends a message on its channel (to one page), and its member id there.
   * @param {(data: object, peerId: string) => void} send
   * @param {() => string} self
   */
  attach(send, self) {
    this._send = send;
    this._self = self;
  }

  /** Out of the session: the others and the shared clock forgotten (the clock runs on by itself). */
  detach() {
    this._send = null;
    this._self = () => '';
    this._peers.clear();
    this.value = null;
    this.local.set = false;
    this.local.value = null;
    this._gone = NaN;
  }

  /**
   * Another page said who it is, or moved: here, it is measured; elsewhere, no longer.
   * @param {PeerLike} p
   * @param {boolean} here
   */
  peer(p, here) {
    if (!p.memberId) return;
    const q = this._peers.get(p.memberId);
    if (!here) {
      if (q?.peerId === p.peerId) this._peers.delete(p.memberId);
      return;
    }
    if (q?.peerId === p.peerId) return;
    this._peers.set(p.memberId, { peerId: p.peerId, offsets: new Offsets(), locked: false, next: -Infinity, burst: BURST });
  }

  /** Another page left the session. @param {PeerLike} p */
  gone(p) {
    if (p.memberId && this._peers.get(p.memberId)?.peerId === p.peerId) this._peers.delete(p.memberId);
  }

  /**
   * A message on its channel from another page: a ping, answered at once with this clock's time; or
   * an answer, measuring how far that page's clock is. Each says whether its sender is on the beat.
   * @param {unknown} data
   * @param {PeerLike} p
   */
  hear(data, p) {
    if (!data || typeof data !== 'object') return;
    const d = /** @type {Record<string, unknown>} */ (data), t = this.now();
    if (typeof d.p === 'number' && Number.isFinite(d.p)) this._send?.({ q: d.p, r: t, l: this.locked }, p.peerId);
    const q = p.memberId ? this._peers.get(p.memberId) : undefined;
    if (!q || q.peerId !== p.peerId) return;
    if (typeof d.l === 'boolean') q.locked = d.l;
    if (typeof d.q === 'number' && typeof d.r === 'number' && Number.isFinite(d.q) && Number.isFinite(d.r)) {
      const rtt = t - d.q;
      if (rtt >= 0 && rtt <= MAX_RTT) q.offsets.add(rtt, d.r - (d.q + t) / 2);
    }
  }

  /** How far member `id`'s clock is ahead of this one's (ms), NaN unmeasured. @param {string} id */
  offsetOf(id) {
    return id === this.me ? 0 : this._peers.get(id)?.offsets.offset ?? NaN;
  }

  /** The band's clock as shared now (this page's own write too), or none. @param {ClockValue | null} v */
  receive(v) {
    const was = this.value;
    this.value = v;
    if (!v || !v.on) {
      this.local.set = false;
      return;
    }
    if (!was || !was.on || was.of !== v.of) this._since = this.now();
    this._gone = NaN;
  }

  /**
   * Every few milliseconds: the pings due sent; and, the beat's writer gone from here, the beat to
   * write again on this page's clock when its turn has come (else null).
   * @returns {ClockValue | null}
   */
  tick() {
    const t = this.now(), send = this._send;
    if (send && this._peers.size) {
      const l = this.locked;
      for (const q of this._peers.values()) {
        if (t < q.next) continue;
        q.next = t + (q.burst > 0 ? BURST_MS : PING_MS);
        if (q.burst > 0) q.burst--;
        send({ p: t, l }, q.peerId);
      }
    }
    return this._again(t);
  }

  /**
   * How the clock differs from the band's: 0 not at all; 1 its tempo; 2 started, stopped or started
   * again (a run of its own), or no band's clock yet.
   * @param {Clock} clock
   */
  differs(clock) {
    const v = this.value;
    if (!v || v.on !== clock.running || (clock.running && v.seed !== clock.seed)) return 2;
    return v.bpm !== clock.tempo ? 1 : 0;
  }

  /**
   * The clock as it is here, to share, else null while it can't be yet: stopped; or running, its next
   * pulse and when it will be heard (once that is known), or, standing by for the band's beat, the
   * band's next pulse.
   * @param {Clock} clock
   * @returns {ClockValue | null}
   */
  write(clock) {
    const bpm = clock.tempo, me = this.me;
    if (!clock.running) return { on: false, bpm, n: 0, at: 0, of: '', seed: 0 };
    if (!me) return null;
    if (Number.isFinite(clock.nextAt)) {
      return this.mapped ? { on: true, bpm, n: clock.nextPulse, at: this.heardAt(clock.nextAt), of: me, seed: clock.seed } : null;
    }
    const v = this.value, t = this.now();
    if (!v?.on || v.seed !== clock.seed) return null;
    this._place(t);
    const b = this.local;
    if (!b.set) return null;
    const n = pulseAfter(b, t);
    return { on: true, bpm, n, at: pulseAt(b, n), of: me, seed: clock.seed };
  }

  /**
   * Keeps the clock on the band's beat, from schedule() before it hands out pulses: placed on it
   * (standing by, or far off), else eased toward it. Nothing while the clock isn't running the band's
   * run at its tempo (a change here not yet shared), or the sound is asleep.
   * @param {Clock} clock
   * @param {AudioContext} ctx
   */
  follow(clock, ctx) {
    this._map(ctx);
    const v = this.value;
    if (!v || !v.on || !clock.running || clock.seed !== v.seed || clock.tempo !== v.bpm || ctx.state !== 'running' || !this.mapped) return;
    this._place(this.now());
    const b = this.local;
    if (!b.set) return;
    const k = clock.nextPulse, at = clock.nextAt;
    if (Number.isFinite(at)) {
      const err = this.audioAt(pulseAt(b, k)) - at;
      if (Math.abs(err) <= DEADBAND) return;
      if (Math.abs(err) <= JUMP) {
        clock.follow(k, at + clamp(err, -NUDGE, NUDGE));
        return;
      }
    }
    // Onto the first pulse not yet heard, and (it was running) none of the few just handed out again:
    // a beat further back, written again on a clock far from this one, is taken as it is.
    let n = pulseAfter(b, this.heardAt(ctx.currentTime));
    if (Number.isFinite(at) && n < k && k - n <= STEPS_PER_BEAT) n = k;
    clock.follow(n, this.audioAt(pulseAt(b, n)));
  }

  /** When the audio clock's time t (s) is heard, on this page's clock (ms). @param {number} t */
  heardAt(t) {
    return t * 1000 + this._delta;
  }

  /** The audio clock's time (s) heard at T on this page's clock (ms). @param {number} T */
  audioAt(T) {
    return (T - this._delta) / 1000;
  }

  /**
   * When the audio clock is heard, measured again (only while it runs: asleep, it stands still):
   * what is heard when, with its output's delay (getOutputTimestamp), else its time now and its
   * delay as the context says it; eased in, or taken as it is after a jump.
   * @private
   * @param {AudioContext} ctx
   */
  _map(ctx) {
    if (ctx.state !== 'running') return;
    const ts = ctx.getOutputTimestamp?.();
    const d = ts && ts.contextTime && ts.performanceTime && ts.contextTime > 0 && ts.performanceTime > 0
      ? this.origin + ts.performanceTime - ts.contextTime * 1000
      : this.now() + ((ctx.outputLatency || ctx.baseLatency || 0) - ctx.currentTime) * 1000;
    if (!Number.isFinite(d)) return;
    this._delta = Number.isFinite(this._delta) && Math.abs(d - this._delta) <= REMAP ? this._delta + (d - this._delta) * EASE : d;
  }

  /**
   * The beat on this page's clock, from the value as shared: its writer's clock measured, or this
   * page's own; measured once and gone since, as it was; never measured, after MEASURE_WAIT as it
   * came (the clocks taken as one).
   * @private
   * @param {number} t now (ms)
   */
  _place(t) {
    const v = this.value, b = this.local;
    if (!v || !v.on) {
      b.set = false;
      return;
    }
    let off = NaN, sure = false;
    if (v.of === this.me) {
      off = 0;
      sure = true;
    } else {
      const q = this._peers.get(v.of);
      if (q && q.offsets.count) {
        off = q.offsets.offset;
        sure = true;
      } else if (b.set && b.sure && b.value === v) return;
      else if (t - this._since >= MEASURE_WAIT) off = 0;
    }
    if (Number.isNaN(off)) {
      b.set = false;
      return;
    }
    b.set = true;
    b.sure = sure;
    b.value = v;
    b.n = v.n;
    b.at = v.at - off;
    b.bpm = v.bpm;
    b.seed = v.seed;
  }

  /**
   * The beat's writer gone from here: whether it is this page's turn to write it again, on its own
   * clock (the value to share), else null. In line, those on the beat surely first, then by member
   * id, each waiting REANCHOR_WAIT longer than the one before; one not surely on it leaves it to one
   * who is.
   * @private
   * @param {number} t now (ms)
   * @returns {ClockValue | null}
   */
  _again(t) {
    const v = this.value, me = this.me;
    if (!v || !v.on || !me || v.of === me || this._peers.has(v.of)) {
      this._gone = NaN;
      return null;
    }
    this._place(t);
    const b = this.local;
    if (!b.set) return null;
    if (Number.isNaN(this._gone)) this._gone = t;
    let ahead = 0;
    for (const [id, q] of this._peers) {
      if (q.locked && !b.sure) return null;
      if (q.locked === b.sure && id < me) ahead++;
    }
    if (t - this._gone < REANCHOR_WAIT * (ahead + 1)) return null;
    this._gone = NaN;
    const n = pulseAfter(b, t);
    return { on: true, bpm: v.bpm, n, at: pulseAt(b, n), of: me, seed: v.seed };
  }
}
