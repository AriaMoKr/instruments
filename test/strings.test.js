// The guitar's strings (strings.js), run block by block as the worklet runs them: in tune at every
// fret (within a cent, at 44.1 and 48 kHz); ringing as long as its note does (its fundamental dying
// 60 dB in ringSeconds) and its highs sooner; the loop's low-pass as designed; a pluck heard from its
// sample on, nothing before; bent and slid, its pitch moving as it rings on; damped, quiet within its
// ring, then still (let be, exactly 0); a pluck while it rings ending what rang; the pickups (the
// bridge's thinner: less of the note for its highs), eased when switched; softer, quieter and
// darker; each pluck alike (the dice only in the pick's scrape), and one at the middle without its
// even harmonics; the same seed the same sound; and nothing done with what isn't a string or a
// number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIDGE_BOOST, HIGH_RING, PICK, PICKUP_PLACES, PLUCK, Strings, TUNING, loopFilter, pluckHz, ringSeconds } from '../public/js/strings.js';

const hz = (n) => 440 * 2 ** ((n - 69) / 12);

/** The strings' sound for `seconds`, told `events` (and the pickups), at `rate`, as the worklet renders it. */
function render(events, seconds, { rate = 48000, pickups = { neck: 0.7, bridge: 0.7 }, seed = 7 } = {}) {
  const strings = new Strings(rate, { seed });
  strings.post({ type: 'pickups', ...pickups });
  strings.post(events);
  const out = new Float32Array(Math.round(seconds * rate)), block = new Float32Array(128);
  for (let f = 0; f < out.length; f += 128) {
    strings.render(block, f);
    out.set(block.subarray(0, Math.min(128, out.length - f)), f);
  }
  return { out, strings, rate };
}

/** Its frequency between two times, near f0: where its autocorrelation peaks, between lags. */
function pitch({ out, rate }, from, to, f0) {
  const a = out.subarray(Math.round(from * rate), Math.round(to * rate)), P = rate / f0;
  const ac = (lag) => {
    let s = 0;
    for (let i = 0; i + lag < a.length; i++) s += a[i] * a[i + lag];
    return s;
  };
  let best = -Infinity, at = 0;
  for (let lag = Math.floor(P * 0.97); lag <= Math.ceil(P * 1.03); lag++) {
    const v = ac(lag);
    if (v > best) [best, at] = [v, lag];
  }
  const y0 = ac(at - 1), y1 = ac(at), y2 = ac(at + 1);
  return rate / (at + (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2));
}

/** How much of frequency f there is from a time for a length (a Hann window's Goertzel). */
function amount({ out, rate }, from, length, f) {
  const i0 = Math.round(from * rate), n = Math.round(length * rate), c = 2 * Math.cos((2 * Math.PI * f) / rate);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const s = out[i0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / n;
}

const rms = ({ out, rate }, from, to) => {
  let s = 0;
  const a = Math.round(from * rate), b = Math.round(to * rate);
  for (let i = a; i < b; i++) s += out[i] * out[i];
  return Math.sqrt(s / (b - a));
};
const cents = (f, f0) => 1200 * Math.log2(f / f0);
const pluck = (string, note, at = 0, velocity = 0.8, more = {}) => ({ type: 'pluck', string, note, at, velocity, ...more });

test('six strings in standard tuning, the pickups where a Stratocaster has its neck and bridge ones', () => {
  assert.deepEqual([...TUNING], [40, 45, 50, 55, 59, 64]);
  assert.deepEqual(PICKUP_PLACES, { neck: 0.25, bridge: 0.065 });
  assert.ok(BRIDGE_BOOST >= 1 && PLUCK > 0);
  assert.ok(PICK.min > 0 && PICK.usual > PICK.min && PICK.usual < PICK.max && PICK.max === 0.5);
  // The low strings ring longest, the highs at most HIGH_RING; a soft pluck is darker.
  assert.equal(ringSeconds(40), 7);
  assert.ok(Math.abs(ringSeconds(64) - 3.5) < 1e-9);
  assert.ok(ringSeconds(79) > HIGH_RING);
  assert.ok(pluckHz(0) < pluckHz(0.5) && pluckHz(0.5) < pluckHz(1));
});

test('in tune within a cent, every string open and at its 5th, 12th and 15th fret, at 44.1 and 48 kHz', () => {
  for (const rate of [44100, 48000]) {
    for (let s = 0; s < 6; s++) {
      for (const fret of [0, 5, 12, 15]) {
        const note = TUNING[s] + fret, r = render(pluck(s, note), 0.6, { rate });
        const off = cents(pitch(r, 0.2, 0.6, hz(note)), hz(note));
        assert.ok(Math.abs(off) < 1, `string ${s} fret ${fret} at ${rate}: ${off.toFixed(2)} cents`);
      }
    }
  }
});

test('it rings as long as its note does: its fundamental 60 dB down in ringSeconds; its highs sooner', () => {
  for (const [s, note] of [[0, 40], [2, 52], [5, 64], [5, 76]]) {
    const r = render(pluck(s, note), 2.2), f0 = hz(note);
    const t60 = 3 / Math.log10(amount(r, 0.5, 0.2, f0) / amount(r, 1.5, 0.2, f0));
    assert.ok(Math.abs(t60 / ringSeconds(note) - 1) < 0.05, `${note}: ${t60.toFixed(2)} s, not ${ringSeconds(note).toFixed(2)}`);
    // The harmonic nearest 3 kHz rings about HIGH_RING.
    const h = Math.round(3000 / f0) * f0;
    const high = 0.3 / Math.log10(amount(r, 0.1, 0.1, h) / amount(r, 0.4, 0.1, h)) * 3;
    assert.ok(high < t60 / 2 && Math.abs(high / HIGH_RING - 1) < 0.25, `${note} at ${h.toFixed(0)} Hz: ${high.toFixed(2)} s`);
  }
});

test("the loop's low-pass loses a period's worth of dying away at the note and at 3 kHz, and its delay is the note's phase delay", () => {
  const rate = 48000;
  for (const [f0, lo, hi] of [[82.41, 7, 0.9], [329.63, 3.5, 0.9], [783.99, 2.27, 0.9], [146.83, 0.08, 0.08]]) {
    const { g, a, delay } = loopFilter(f0, lo, hi, rate);
    const H = (f) => {
      const w = (2 * Math.PI * f) / rate;
      return { mag: (g * (1 - a)) / Math.hypot(1 - a * Math.cos(w), a * Math.sin(w)), phase: -Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w)) };
    };
    assert.ok(a >= 0 && a < 1 && g < 1, `${f0}: a ${a}, g ${g}`);
    assert.ok(Math.abs(H(f0).mag - 10 ** (-3 / (f0 * lo))) < 1e-9, `${f0}: at the note`);
    if (hi < lo) assert.ok(Math.abs(H(3000).mag - 10 ** (-3 / (f0 * hi))) < 1e-9, `${f0}: at 3 kHz`);
    assert.ok(Math.abs(delay - -H(f0).phase / ((2 * Math.PI * f0) / rate)) < 1e-9);
  }
});

test('a pluck sounds from its sample on, nothing before; one already late, at once', () => {
  const r = render(pluck(1, 45, 0.1), 0.2);
  assert.equal(r.out.findIndex((v) => v !== 0), 4800);
  // Told late (the worklet's block has passed its time): from the block's first sample.
  const strings = new Strings(48000, { seed: 3 }), block = new Float32Array(128);
  strings.render(block, 0);
  strings.post(pluck(2, 50, 0));
  strings.render(block, 128);
  assert.notEqual(block[0], 0);
});

test('bent and slid, its pitch moves as it rings on', () => {
  const bent = render([pluck(3, 57), { type: 'pitch', string: 3, note: 59, at: 0.3, glide: 0.02 }], 1);
  assert.ok(Math.abs(cents(pitch(bent, 0.5, 1, hz(59)), hz(57)) - 200) < 1, 'a tone up');
  const slid = render([pluck(1, 47), { type: 'pitch', string: 1, note: 50, at: 0.3, glide: 0.012 }], 1);
  assert.ok(Math.abs(cents(pitch(slid, 0.5, 1, hz(50)), hz(47)) - 300) < 1, 'three frets up');
  // Still ringing: no quieter than it would have been.
  const still = render(pluck(1, 47), 1);
  assert.ok(rms(slid, 0.5, 1) > 0.5 * rms(still, 0.5, 1));
});

test('damped, it is quiet within its ring, then still: let be, and exactly 0', () => {
  const r = render([pluck(2, 50), { type: 'damp', string: 2, at: 0.5, ring: 0.08 }], 1.5);
  const before = rms(r, 0.45, 0.5);
  assert.ok(rms(r, 0.58, 0.6) < before * 1e-3, 'down 60 dB within 0.08 s');
  assert.equal(r.strings.active, 0);
  assert.ok(r.out.subarray(Math.round(1.2 * 48000)).every((v) => v === 0));
  // Never plucked: nothing at all.
  const none = render([], 0.1);
  assert.ok(none.out.every((v) => v === 0));
  assert.equal(none.strings.active, 0);
});

test('a pluck while it rings ends what rang', () => {
  const r = render([pluck(2, 50), pluck(2, 57, 0.5)], 1.2);
  const old = amount(r, 0.7, 0.4, hz(50)), now = amount(r, 0.7, 0.4, hz(57));
  assert.ok(old < now * 0.01, `the old note ${old}, the new ${now}`);
});

test("the pickups: the bridge's thinner (less of the note for its highs); switched, eased there", () => {
  const strum = TUNING.map((note, s) => pluck(s, note, 0.01 * s));
  const neck = render(strum, 0.6, { pickups: { neck: 1, bridge: 0 } });
  const bridge = render(strum, 0.6, { pickups: { neck: 0, bridge: 1 } });
  const share = (r) => amount(r, 0.2, 0.3, hz(40)) / rms(r, 0.2, 0.5);
  assert.ok(share(bridge) < share(neck) * 0.6, `the low E's share: bridge ${share(bridge)}, neck ${share(neck)}`);
  // Switched to the bridge alone at a block's start, about 0.3 s: on its way within a millisecond,
  // there within 60.
  const strings = new Strings(48000, { seed: 7 }), block = new Float32Array(128), out = new Float32Array(Math.round(0.6 * 48000));
  const at = 112 * 128, t = at / 48000;
  strings.post({ type: 'pickups', neck: 1, bridge: 0 });
  strings.post(strum);
  for (let f = 0; f < out.length; f += 128) {
    if (f === at) strings.post({ type: 'pickups', neck: 0, bridge: 1 });
    strings.render(block, f);
    out.set(block.subarray(0, Math.min(128, out.length - f)), f);
  }
  const diff = (a, b, from, to) => {
    let s = 0;
    for (let i = Math.round(from * 48000); i < Math.round(to * 48000); i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s / ((to - from) * 48000));
  };
  // In its first millisecond still nearly the neck's: about as far from the bridge's as the neck's is.
  assert.ok(diff(out, bridge.out, t, t + 0.001) > 0.5 * diff(neck.out, bridge.out, t, t + 0.001), 'not at once');
  assert.ok(diff(out, bridge.out, t + 0.06, t + 0.1) < 0.01 * rms(bridge, t + 0.06, t + 0.1), 'there');
});

test('softer, quieter and darker', () => {
  const soft = render(pluck(2, 50, 0, 0.3), 0.5), hard = render(pluck(2, 50, 0, 0.9), 0.5);
  assert.ok(rms(soft, 0, 0.5) < rms(hard, 0, 0.5) * 0.6);
  const bright = (r) => amount(r, 0.02, 0.2, 30 * hz(50)) / amount(r, 0.02, 0.2, hz(50));
  assert.ok(bright(soft) < bright(hard) * 0.7, `the 30th harmonic's share: soft ${bright(soft)}, hard ${bright(hard)}`);
});

test("each pluck alike, the dice only in the pick's scrape; plucked at the middle, without its even harmonics", () => {
  // The open A through the neck pickup, a dozen seeds: its first three harmonics within 2 dB (the
  // noise alone put them 12 dB apart).
  const dB = (r, n) => 20 * Math.log10(amount(r, 0.1, 0.3, n * hz(45)));
  const plucks = Array.from({ length: 12 }, (_, i) => render(pluck(1, 45), 0.45, { seed: i + 1, pickups: { neck: 1, bridge: 0 } }));
  for (const n of [1, 2, 3]) {
    const levels = plucks.map((r) => dB(r, n)), spread = Math.max(...levels) - Math.min(...levels);
    assert.ok(spread < 2, `harmonic ${n}: ${spread.toFixed(2)} dB apart`);
  }
  // At the middle the pulse is half the period: its octave 20 dB and more under its note; near the
  // bridge (as it comes), not.
  const middle = render(pluck(1, 45, 0, 0.8, { pick: 0.5 }), 0.45, { pickups: { neck: 1, bridge: 0 } });
  assert.ok(dB(middle, 2) < dB(middle, 1) - 20, `at the middle: ${(dB(middle, 2) - dB(middle, 1)).toFixed(1)} dB`);
  assert.ok(dB(plucks[0], 2) > dB(plucks[0], 1) - 6);
});

test('the same seed, the same sound; another, another', () => {
  const a = render(pluck(0, 40), 0.1, { seed: 5 }), b = render(pluck(0, 40), 0.1, { seed: 5 }), c = render(pluck(0, 40), 0.1, { seed: 6 });
  assert.deepEqual(a.out, b.out);
  assert.notDeepEqual(a.out, c.out);
});

test("nothing is done with what isn't a string or a number", () => {
  const r = render([
    null, 'pluck', { type: 'pluck', string: 9, note: 50, at: 0 }, { type: 'pluck', string: 1, note: NaN, at: 0 },
    { type: 'pitch', string: -1, note: 50, at: 0 }, { type: 'damp', string: 7, at: 0, ring: 0.1 }, { type: 'what', string: 0, at: 0 },
  ], 0.1);
  assert.equal(r.strings.active, 0);
  assert.ok(r.out.every((v) => v === 0));
});
