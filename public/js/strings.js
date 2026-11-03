// The electric guitar's six strings as they are plucked (guitar.js plays them; strings-worklet.js
// runs them on the audio thread). Each is a loop one period of its note long, as Karplus and Strong
// made theirs and Jaffe and Smith extended it: a pluck puts the pick's push into it, a period with a
// pulse in it as long as the pick is from the bridge, so that its harmonics fall away as a plucked
// string's do through a magnetic pickup (as sin(nπ·pick)/n: those with a node under the pick left
// out), with a little of the pick's scrape, darker the softer the pluck (Karplus and Strong's noise
// alone made each pluck's harmonics a throw of the dice, 12 dB apart from one to the next); each time
// round, a one-pole low-pass takes a little of it away, more of the highs (so a string rings on at
// its note, its brightness dying first, the low strings longest); and a fractional delay (Lagrange's,
// of four points) tunes the loop to its note exactly, and moves it smoothly (a slide, a bend). A
// string plucked while it rings stops ringing as the pick meets it. The two magnetic pickups hear the
// strings where they lie, each the difference between the loop now and a part of a period ago, so
// that the harmonics with a node there are left out: the neck's, a quarter of the way from the
// bridge, round and full; the bridge's, near it, thinner and brighter. A string that has died away is
// let be until it is plucked again. Web Audio's own delays can't be this short in a loop (a render
// quantum, 128 samples, where the high E at its 15th fret is 61), so this runs in an AudioWorklet;
// here it is pure (no Web Audio), and tested in Node.

/** The open strings' notes (MIDI), low E to high E: standard tuning. */
export const TUNING = Object.freeze([40, 45, 50, 55, 59, 64]);

/** Where the pickups lie along the strings from the bridge, of their length (a Stratocaster's neck and bridge pickups'). */
export const PICKUP_PLACES = Object.freeze({ neck: 0.25, bridge: 0.065 });

/** How much more of the bridge pickup is heard, wound hotter as the strings move less there (their note under a third as much): a strum as loud as through the neck's, within a dB. */
export const BRIDGE_BOOST = 1.6;

/** How long a string rings at its note, left to (seconds to die away 60 dB): the low E seven, an octave up √2 times less. @param {number} note */
export const ringSeconds = (note) => 7 * 2 ** (-(note - 40) / 24);

/** How long its highs ring (seconds to die away 60 dB at HIGH_HZ), at most. */
export const HIGH_RING = 0.9;
const HIGH_HZ = 3000;

/** A pluck's loudness going in (its RMS) at full velocity; softer by the velocity's power 1.5, to LEAST of it at none. */
export const PLUCK = 0.05;
const LEAST = 0.1;
/** How much of the pick's scrape goes in with its push: noise as high as this, the pulse's height 1. */
const SCRAPE = 0.2;

/** How bright a pluck is (its push's low-pass, in Hz): 1.2 kHz at no velocity, 6.3 kHz at full. @param {number} velocity */
export const pluckHz = (velocity) => 1200 * 2 ** (2.4 * clamp(velocity, 0, 1));

/** Where a pick may meet a string, of its length from the bridge (past half it leaves out the same harmonics again), and where it does unless told. */
export const PICK = Object.freeze({ min: 0.02, max: 0.5, usual: 0.13 });

/** How long a pluck takes to stop what rang before it (seconds), as the pick meets the string. */
const FADE = 0.001;
/** How quickly the pickups get where they are switched to (a time constant, seconds). */
const PICKUP_EASE = 0.01;
/** How quickly a string's level, as followed, falls (a time constant, seconds), and under which level it is still. */
const FOLLOW = 0.05, STILL = 3e-5;
/** How quickly a damped string's pitch settles where its quicker damping leaves it (a time constant, seconds). */
const SETTLE = 0.002;

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** A note's frequency, in Hz. @param {number} note */
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

/**
 * What the strings are told (guitar.js, through the worklet's port), at `at` (seconds, the audio
 * clock's; one late is done at once):
 * - pluck: `string` (0 the low E…5) plucked at `note` (MIDI, a fraction for a bend), `velocity` 0…1
 *   hard, the pick `pick` of its length from the bridge, ringing `ring` seconds at its note if given
 *   (a muted string's, short), else as long as it would;
 * - pitch: its note moved to `note` (a slide, a bend), over `glide` seconds (a time constant), still
 *   ringing;
 * - damp: its ringing cut to `ring` seconds (a finger lifted, a palm laid on it), if that is shorter;
 * - pickups: how much of each pickup is heard (both, half of each), eased there at once.
 * @typedef {{ type: 'pluck', string: number, note: number, at: number, velocity?: number, pick?: number, ring?: number }
 *   | { type: 'pitch', string: number, note: number, at: number, glide?: number }
 *   | { type: 'damp', string: number, at: number, ring: number }
 *   | { type: 'pickups', neck: number, bridge: number }} StringEvent
 */

/**
 * The loop's low-pass for a note of frequency `f0` ringing `lo` seconds at it and `hi` at HIGH_HZ
 * (seconds to die away 60 dB), at the sample rate `rate`: y = g(1 − a)·x + a·y₁, its gain each time
 * round at f0 and at HIGH_HZ what a period's worth of each's dying away is; and how long it delays f0
 * (its phase delay, in samples), which the loop's delay leaves out.
 * @param {number} f0
 * @param {number} lo
 * @param {number} hi
 * @param {number} rate
 */
export function loopFilter(f0, lo, hi, rate) {
  const g0 = 10 ** (-3 / (f0 * lo)), g1 = 10 ** (-3 / (f0 * Math.min(hi, lo)));
  const w0 = (2 * Math.PI * f0) / rate, w1 = Math.min(Math.PI, (2 * Math.PI * Math.max(HIGH_HZ, 2 * f0)) / rate);
  const c0 = Math.cos(w0), c1 = Math.cos(w1);
  // |H(w1)| / |H(w0)| = g1 / g0, for a: a quadratic, its root under 1.
  const r2 = (g1 / g0) ** 2, A = 1 - r2, B = c0 - r2 * c1, disc = B * B - A * A;
  const a = A > 1e-12 && disc > 0 ? clamp((B - Math.sqrt(disc)) / A, 0, 0.95) : 0;
  const g = Math.min(0.99999, (g0 * Math.sqrt(1 - 2 * a * c0 + a * a)) / (1 - a));
  return { g, a, delay: Math.atan2(a * Math.sin(w0), 1 - a * c0) / w0 };
}

/**
 * A string's loop: what went round (`buf`, a power of two long), where it is written next (`w`), its
 * delay now and where it is going (`d`, `dT`, samples) and how fast (`k`, a share a sample), its
 * low-pass (`b`, `a`, and `z` what came out of it last), its note and how long it is told to ring
 * (0: as long as it would); a pluck going in (`exc`, `len` long, at `at`, -1 none); its level (`env`)
 * and whether it sounds; the pickups' delays, neck and bridge (samples).
 */
class Loop {
  /**
   * @param {number} size
   * @param {number} neck
   * @param {number} bridge
   */
  constructor(size, neck, bridge) {
    this.buf = new Float32Array(size);
    this.exc = new Float32Array(size);
    this.mask = size - 1;
    this.w = 0;
    this.d = size / 2;
    this.dT = this.d;
    this.k = 1;
    this.b = 0;
    this.a = 0;
    this.z = 0;
    this.note = 0;
    this.ring = 0;
    this.len = 0;
    this.at = -1;
    this.env = 0;
    this.active = false;
    this.neck = neck;
    this.bridge = bridge;
  }
}

export class Strings {
  /**
   * @param {number} rate the sample rate
   * @param {{ tuning?: readonly number[], seed?: number }} [o] the open strings' notes (the pickups' places along them), and the dice's seed
   */
  constructor(rate, { tuning = TUNING, seed = 1 } = {}) {
    this.rate = rate;
    // Long enough for a loop down to 60 Hz (the low E is 82), and the four points read round it.
    const size = 2 ** Math.ceil(Math.log2(rate / 60 + 16));
    /** @private */
    this._loops = tuning.map((note) => {
      const period = rate / hz(note);
      return new Loop(size, Math.max(1, Math.round(PICKUP_PLACES.neck * period)), Math.max(1, Math.round(PICKUP_PLACES.bridge * period)));
    });
    /** @private a pluck's push as it is made */
    this._scratch = new Float32Array(size);
    /** @private what is to be done, in time's order @type {{ frame: number, event: StringEvent }[]} */
    this._queue = [];
    /** @private */
    this._seed = seed >>> 0 || 1;
    /** @private the pickups' gains now, and where they are going */
    this._neck = 0.75;
    /** @private */
    this._bridge = 0.75 * BRIDGE_BOOST;
    /** @private */
    this._neckTo = this._neck;
    /** @private */
    this._bridgeTo = this._bridge;
    /** @private the pickups' gains each sample of a block @type {Float32Array} */
    this._gn = new Float32Array(128);
    /** @private @type {Float32Array} */
    this._gb = new Float32Array(128);
    /** @private */
    this._ease = 1 - Math.exp(-1 / (PICKUP_EASE * rate));
    /** @private */
    this._fall = Math.exp(-1 / (FOLLOW * rate));
    /** @private */
    this._fade = Math.max(1, Math.round(FADE * rate));
  }

  /** How many strings sound now. */
  get active() {
    return this._loops.filter((s) => s.active).length;
  }

  /**
   * Takes what the strings are told (one, or several at once): the pickups at once, the rest kept
   * for their time.
   * @param {StringEvent | StringEvent[]} data
   */
  post(data) {
    for (const event of Array.isArray(data) ? data : [data]) {
      if (!event || typeof event !== 'object') continue;
      if (event.type === 'pickups') {
        this._neckTo = Number.isFinite(event.neck) ? clamp(event.neck, 0, 2) : this._neckTo;
        this._bridgeTo = Number.isFinite(event.bridge) ? clamp(event.bridge, 0, 2) * BRIDGE_BOOST : this._bridgeTo;
        continue;
      }
      const frame = Number.isFinite(event.at) ? Math.round(event.at * this.rate) : 0;
      let i = this._queue.length;
      while (i > 0 && this._queue[i - 1].frame > frame) i--;
      this._queue.splice(i, 0, { frame, event });
    }
  }

  /**
   * The strings' sound for a block, from `frame` (the audio clock's, in samples) as long as `out`:
   * what is told done at its sample.
   * @param {Float32Array} out
   * @param {number} frame
   */
  render(out, frame) {
    const n = out.length;
    out.fill(0);
    if (this._gn.length !== n) {
      this._gn = new Float32Array(n);
      this._gb = new Float32Array(n);
    }
    let gn = this._neck, gb = this._bridge;
    const e = this._ease, tn = this._neckTo, tb = this._bridgeTo;
    for (let j = 0; j < n; j++) {
      gn += (tn - gn) * e;
      gb += (tb - gb) * e;
      this._gn[j] = gn;
      this._gb[j] = gb;
    }
    this._neck = gn;
    this._bridge = gb;
    const q = this._queue;
    let j = 0;
    while (j < n) {
      while (q.length && q[0].frame <= frame + j) this._do(/** @type {{ event: StringEvent }} */ (q.shift()).event);
      const end = q.length ? Math.min(n, q[0].frame - frame) : n;
      for (const s of this._loops) if (s.active) this._run(s, out, j, end);
      j = end;
    }
  }

  /**
   * What a string is told, done now.
   * @private
   * @param {StringEvent} event
   */
  _do(event) {
    if (event.type === 'pickups') return;
    const s = this._loops[event.string];
    if (!s) return;
    if (event.type === 'damp') {
      if (!(event.ring > 0)) return;
      // Only ever shorter: a damped string, or a muted one's thud, rings no longer for it.
      s.ring = Math.min(event.ring, s.ring > 0 ? s.ring : ringSeconds(s.note));
      this._tune(s, SETTLE);
      return;
    }
    if (!Number.isFinite(event.note)) return;
    s.note = event.note;
    if (event.type === 'pitch') {
      this._tune(s, Number.isFinite(event.glide) ? Math.max(0, event.glide ?? 0) : 0);
      return;
    }
    s.ring = (event.ring ?? 0) > 0 ? event.ring ?? 0 : 0;
    this._tune(s, 0);
    const len = clamp(Math.round(this.rate / hz(s.note)), 4, s.mask - 4);
    const velocity = Number.isFinite(event.velocity) ? clamp(event.velocity ?? 0, 0, 1) : 0.8;
    const pick = Number.isFinite(event.pick) ? clamp(event.pick ?? 0, PICK.min, PICK.max) : PICK.usual;
    this._excite(s, len, velocity, pick);
    s.len = len;
    s.at = 0;
    s.active = true;
    s.env = Math.max(s.env, STILL * 10);
  }

  /**
   * A loop set to its note and how long it rings: its low-pass, and its delay (the period, less what
   * the low-pass delays the note), got to at once (`glide` 0) or by `glide` seconds (a time constant).
   * @private
   * @param {Loop} s
   * @param {number} glide
   */
  _tune(s, glide) {
    const f0 = hz(s.note), lo = s.ring > 0 ? s.ring : ringSeconds(s.note);
    const { g, a, delay } = loopFilter(f0, lo, Math.min(lo, HIGH_RING), this.rate);
    s.a = a;
    s.b = g * (1 - a);
    s.dT = clamp(this.rate / f0 - delay, 3, s.mask - 4);
    if (glide > 0) {
      s.k = 1 - Math.exp(-1 / (glide * this.rate));
    } else {
      s.d = s.dT;
      s.k = 1;
    }
  }

  /**
   * A pluck's period into `exc`: the pick's push, a pulse `pick` of the period long (its harmonics
   * sin(nπ·pick)/n, a string plucked there as a magnetic pickup hears it), and SCRAPE of noise;
   * darker the softer (a one-pole low-pass at pluckHz, run round the period twice, so that its start
   * is as soft as the rest), nothing standing still in it (its mean taken out), as loud as the
   * velocity.
   * @private
   * @param {Loop} s
   * @param {number} len
   * @param {number} velocity
   * @param {number} pick
   */
  _excite(s, len, velocity, pick) {
    const e = s.exc, tmp = this._scratch, r = Math.exp((-2 * Math.PI * pluckHz(velocity)) / this.rate);
    const p = Math.max(1, Math.round(pick * len));
    for (let i = 0; i < len; i++) tmp[i] = (i < p ? 1 : 0) + SCRAPE * (this._random() * 2 - 1);
    let y = 0, mean = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < len; i++) {
        y += (1 - r) * (tmp[i] - y);
        if (pass) {
          e[i] = y;
          mean += y;
        }
      }
    }
    mean /= len;
    let sq = 0;
    for (let i = 0; i < len; i++) {
      e[i] -= mean;
      sq += e[i] * e[i];
    }
    const scale = (PLUCK * (LEAST + (1 - LEAST) * velocity ** 1.5)) / Math.sqrt(sq / len || 1);
    for (let i = 0; i < len; i++) e[i] *= scale;
  }

  /**
   * A string's loop from sample `from` of the block to `to`, its pickups' sound added into `out`.
   * @private
   * @param {Loop} s
   * @param {Float32Array} out
   * @param {number} from
   * @param {number} to
   */
  _run(s, out, from, to) {
    const buf = s.buf, M = s.mask, exc = s.exc, gn = this._gn, gb = this._gb, fall = this._fall, fade = this._fade;
    const dT = s.dT, k = s.k, b = s.b, a = s.a, dn = s.neck, db = s.bridge, len = s.len;
    let w = s.w, d = s.d, z = s.z, env = s.env, at = s.at;
    for (let j = from; j < to; j++) {
      if (d !== dT) d = Math.abs(dT - d) < 1e-6 ? dT : d + (dT - d) * k;
      // What went round a delay of d ago, between samples: Lagrange's four points.
      const p = w - d, i = Math.floor(p), t = p - i, t1 = t - 1, t2 = t - 2, t0 = t + 1;
      const r = (-t * t1 * t2 * buf[(i - 1) & M]) / 6 + (t0 * t1 * t2 * buf[i & M]) / 2
        - (t0 * t * t2 * buf[(i + 1) & M]) / 2 + (t0 * t * t1 * buf[(i + 2) & M]) / 6;
      z = b * r + a * z;
      let y = z;
      if (at >= 0) {
        // A pluck going in, what rang before it stopped within FADE.
        y = (at < fade ? 1 - at / fade : 0) * z + exc[at];
        at = at + 1 < len ? at + 1 : -1;
      }
      buf[w] = y;
      out[j] += gn[j] * (y - buf[(w - dn) & M]) + gb[j] * (y - buf[(w - db) & M]);
      const m = y < 0 ? -y : y;
      env = m > env ? m : env * fall;
      w = (w + 1) & M;
    }
    s.w = w;
    s.d = d;
    s.z = z;
    s.env = env;
    s.at = at;
    if (env < STILL && at < 0) {
      s.active = false;
      s.buf.fill(0);
      s.z = 0;
      s.env = 0;
    }
  }

  /** @private the dice: a linear congruential generator's next, 0…1 */
  _random() {
    this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
}
