// The rack's envelope (envelope.js): its knobs and how they read; its out, made once the sound has
// woken (a ConstantSource from nothing, through its depth); a pulse of the clock starting it to its
// top and letting it go half its step later; the sequencer's steps (a note starting it as high as it
// is played, a slide carrying it on, a rest or the end of the line letting go one held on); the
// keyboard's notes (each starting it, held while any is, let go with the last, or all at once);
// where it is for its light, from the shape heard then rather than one set ahead; its knobs (DEPTH at
// once, the rest from its next start); and the knobs kept for the next visit. On
// test/helpers/audio.js's fake Web Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Adsr, DEFAULT_ENVELOPE, ENVELOPE_KNOBS, ENV_GATE, envelopeText } from '../public/js/envelope.js';
import { attackSeconds, decaySeconds, velocityLevel } from '../public/js/synth.js';
import { depthGain } from '../public/js/lfo.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const A = attackSeconds(DEFAULT_ENVELOPE.attack), D = decaySeconds(DEFAULT_ENVELOPE.decay), R = decaySeconds(DEFAULT_ENVELOPE.release), S = DEFAULT_ENVELOPE.sustain;

/** An envelope on a woken fake context, its out made, and the offset its shape is set on. */
function made(o = {}) {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const env = new Adsr(sound, { storage: null, ...o });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const out = env.output(), [level] = ctx.all('constant');
  return { sound, env, ctx, out, level, offset: level.offset };
}
/** The events a start at t to `peak` sets, its knobs as they come. */
const started = (t, peak, from = 0) => [['cancel', 0, t], ['set', from, t], ['linear', peak, t + A], ['target', S * peak, t + A, D / 5]];
/** Where a start at t0 to `peak` is at t, held. */
const held = (t0, peak, t) => (t < t0 + A ? (peak * (t - t0)) / A : S * peak + (peak - S * peak) * Math.exp(-(t - t0 - A) / (D / 5)));

test('its knobs, as it comes, and in words: times for its attack, decay and release, its sustain and depth in percent', () => {
  assert.deepEqual(ENVELOPE_KNOBS, ['attack', 'decay', 'sustain', 'release', 'depth']);
  assert.deepEqual(DEFAULT_ENVELOPE, { attack: 0.1, decay: 0.45, sustain: 0.3, release: 0.4, depth: 1 });
  assert.equal(ENV_GATE, 0.5);
  assert.deepEqual(ENVELOPE_KNOBS.map((n) => envelopeText(n, DEFAULT_ENVELOPE[n])), ['2 ms', '155 ms', '30%', '106 ms', '100%']);
  assert.deepEqual([envelopeText('attack', 1), envelopeText('decay', 0), envelopeText('release', 1), envelopeText('sustain', 2)], ['8.2 s', '5 ms', '10.2 s', '100%']);
  assert.ok(Object.isFrozen(DEFAULT_ENVELOPE) && Object.isFrozen(ENVELOPE_KNOBS));
});

test('no out until the sound has woken; then one, made once: a ConstantSource from nothing, through its depth', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const env = new Adsr(sound, { storage: null });
  assert.equal(env.output(), null);
  env.setKnob('depth', 0.5);
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  ctx.currentTime = 0.3;
  const out = env.output(), [level] = ctx.all('constant');
  assert.ok(out && level);
  assert.deepEqual([level.outputs, out.outputs, level.started, level.offset.value], [[out], [], 0.3, 0], 'at nothing, started, into nothing yet');
  assert.equal(out.gain.value, depthGain(0.5), 'as deep as it was turned before');
  assert.deepEqual([env.output(), ctx.all('constant').length], [out, 1], 'made once');
  // Without Web Audio: none, and nothing breaks.
  const none = new Adsr(new Sound({ Context: null, storage: null }), { storage: null });
  assert.equal(none.output(), null);
  none.trigger(1, 0.1);
  none.seqStep(60, 1, 1, Infinity);
  none.seqEnd();
  none.noteOn(60, 1);
  none.noteOff(60);
  none.allOff();
  none.setKnob('depth', 0);
  none.reset();
  assert.equal(none.valueAt(1), 0);
});

test("a pulse of the clock starts it to its top, from where it is, and lets it go half its step later, over its release; set late, now", () => {
  const { env, ctx, offset } = made();
  ctx.currentTime = 0.9;
  env.trigger(1, 0.2);
  const end = 1 + ENV_GATE * 0.2, v = held(1, 1, end);
  assert.deepEqual(offset.events, [...started(1, 1), ['cancel', 0, end], ['set', v, end], ['target', 0, end, R / 5]]);
  assert.ok(near(env.valueAt(1 + A), 1, 1e-6) && near(env.valueAt(end), v) && env.valueAt(end + R) < 0.01 * v);
  // Started again while it falls: from where it is then.
  const from = env.valueAt(1.15);
  env.trigger(1.15, 0.2);
  assert.ok(from > 0 && from < v);
  assert.deepEqual(offset.events.slice(-7, -3), started(1.15, 1, from));
  // A pulse whose time has gone: now.
  ctx.currentTime = 2;
  env.trigger(1.5, 0.2);
  assert.equal(offset.events.at(-6)[2], 2);
  // Nonsense: nothing.
  const n = offset.events.length;
  env.trigger(NaN, 0.2);
  env.trigger(3, 0);
  assert.equal(offset.events.length, n);
});

test('the sequencer\'s steps: a note starts it as high as it is played; slid on into the next it carries on; a rest, or the end of the line, lets it go', () => {
  const { env, ctx, offset } = made();
  ctx.currentTime = 1;
  // A note, let go when its step says.
  env.seqStep(48, 1, 1, 1.06);
  assert.deepEqual(offset.events.slice(0, 4), started(1, 1));
  assert.deepEqual(offset.events.at(-1), ['target', 0, 1.06, R / 5]);
  // An accent higher than a step played as the line comes.
  env.seqStep(50, 0.62, 1.125, Infinity);
  const peak = velocityLevel(0.62);
  assert.ok(peak < 1 && peak > 0.62);
  assert.deepEqual(offset.events.slice(-4).map((e) => e[0]), ['cancel', 'set', 'linear', 'target']);
  assert.ok(near(offset.events.at(-2)[1], peak), 'as high as it was played');
  // Slid into: carried on, not started again; then let go at its step's end.
  let n = offset.events.length;
  env.seqStep(53, 1, 1.25, 1.31);
  assert.deepEqual(offset.events.slice(n).map((e) => [e[0], e[2]]), [['cancel', 1.31], ['set', 1.31], ['target', 1.31]]);
  assert.ok(near(offset.events.at(-2)[1], held(1.125, peak, 1.31), 1e-9), 'from where it was, at its sustain');
  // Held on into a rest: let go there.
  env.seqStep(55, 1, 1.375, Infinity);
  n = offset.events.length;
  env.seqStep(-1, 0, 1.5, 1.5);
  assert.deepEqual(offset.events.slice(n).map((e) => [e[0], e[2]]), [['cancel', 1.5], ['set', 1.5], ['target', 1.5]]);
  // A rest with nothing held on: nothing.
  n = offset.events.length;
  env.seqStep(-1, 0, 1.625, 1.625);
  assert.equal(offset.events.length, n);
  // Held on, and the clock stopped: let go now; and again, nothing.
  env.seqStep(55, 1, 1.75, Infinity);
  ctx.currentTime = 1.8;
  n = offset.events.length;
  env.seqEnd();
  assert.deepEqual(offset.events.slice(n).map((e) => [e[0], e[2]]), [['cancel', 1.8], ['set', 1.8], ['target', 1.8]]);
  n = offset.events.length;
  env.seqEnd();
  assert.equal(offset.events.length, n);
  // Slid into, but let go meanwhile (a pulse of the clock let it go): started again.
  env.seqStep(55, 1, 2, Infinity);
  env.trigger(2.05, 0.1);
  n = offset.events.length;
  env.seqStep(57, 1, 2.25, 2.3);
  assert.deepEqual(offset.events.slice(n, n + 4).map((e) => [e[0], e[2]]), [['cancel', 2.25], ['set', 2.25], ['linear', 2.25 + A], ['target', 2.25 + A]]);
});

test("the keyboard's notes: each starts it now, as high as it is played; held while any is; let go with the last, or all at once", () => {
  const { env, ctx, offset } = made();
  ctx.currentTime = 3;
  env.noteOn(60, 0.85);
  assert.deepEqual(offset.events.slice(0, 4), started(3, velocityLevel(0.85)));
  ctx.currentTime = 3.2;
  const from = env.valueAt(3.2);
  env.noteOn(64, 1);
  assert.deepEqual(offset.events.slice(-4), started(3.2, 1, from), 'again, from where it was');
  ctx.currentTime = 3.3;
  let n = offset.events.length;
  env.noteOff(60);
  assert.equal(offset.events.length, n, 'the other still holds it');
  ctx.currentTime = 3.4;
  env.noteOff(64);
  assert.deepEqual(offset.events.slice(n).map((e) => [e[0], e[2]]), [['cancel', 3.4], ['set', 3.4], ['target', 3.4]]);
  n = offset.events.length;
  env.noteOff(64);
  env.noteOff(70);
  env.allOff();
  assert.equal(offset.events.length, n, 'none held: nothing');
  // Its cable pulled out while two are held: let go now.
  env.noteOn(60, 1);
  env.noteOn(62, 1);
  ctx.currentTime = 3.6;
  n = offset.events.length;
  env.allOff();
  assert.deepEqual(offset.events.slice(n).map((e) => [e[0], e[2]]), [['cancel', 3.6], ['set', 3.6], ['target', 3.6]]);
  env.noteOff(60);
  assert.equal(offset.events.length, n + 3, 'they hold it no longer');
});

test("the guitar's notes, set ahead (a strum's): each starts it when it is plucked, held while any rings, let go when the last ends; a time gone, now", () => {
  const { env, ctx, offset } = made();
  ctx.currentTime = 1;
  env.noteOn(1000, 0.9, 1.02);
  assert.deepEqual(offset.events.slice(0, 4), started(1.02, velocityLevel(0.9)));
  env.noteOn(1005, 0.9, 1.05);
  assert.deepEqual(offset.events.slice(-4).map((e) => [e[0], e[2]]), [['cancel', 1.05], ['set', 1.05], ['linear', 1.05 + A], ['target', 1.05 + A]]);
  let n = offset.events.length;
  env.noteOff(1000, 1.5);
  assert.equal(offset.events.length, n, 'the other still rings');
  env.noteOff(1005, 1.6);
  assert.deepEqual(offset.events.slice(n).map((e) => [e[0], e[2]]), [['cancel', 1.6], ['set', 1.6], ['target', 1.6]]);
  // A time gone: now.
  ctx.currentTime = 2;
  env.noteOn(1001, 1, 1.9);
  assert.equal(offset.events.at(-4)[2], 2);
  ctx.currentTime = 2.1;
  env.noteOff(1001, NaN);
  assert.deepEqual(offset.events.slice(-3).map((e) => [e[0], e[2]]), [['cancel', 2.1], ['set', 2.1], ['target', 2.1]]);
});

test('where it is, for its light: the shape heard then, not the one set ahead of it; nothing before any', () => {
  const { env } = made();
  assert.equal(env.valueAt(0.5), 0);
  env.trigger(1, 0.25);
  env.trigger(1.25, 0.25); // set ahead, before the first is heard
  assert.ok(near(env.valueAt(1.05), held(1, 1, 1.05)), 'the first, held');
  assert.ok(near(env.valueAt(0.9), 0), 'before it');
  const end = 1 + ENV_GATE * 0.25, v = held(1, 1, end);
  assert.ok(near(env.valueAt(1.2), v * Math.exp(-(1.2 - end) / (R / 5))), 'the first, let go');
  assert.ok(near(env.valueAt(1.25 + A), 1, 1e-6), 'the second at its top');
  // Many set since: the latest few remembered.
  for (let i = 0; i < 6; i++) env.trigger(2 + i * 0.25, 0.25);
  assert.ok(near(env.valueAt(3.3), held(3.25, 1, 3.3)));
});

test('its knobs: DEPTH at once, eased; the rest from its next start, RELEASE its next letting go; nonsense ignored; reset as it comes', () => {
  const { env, ctx, out, offset } = made();
  ctx.currentTime = 2;
  env.setKnob('depth', 0.5);
  assert.deepEqual(out.gain.events.at(-1), ['target', depthGain(0.5), 2, 0.02]);
  const n = offset.events.length;
  env.setKnob('attack', 1);
  env.setKnob('sustain', 0.8);
  env.setKnob('release', 0);
  assert.equal(offset.events.length, n, 'nothing set till it starts');
  env.trigger(3, 40);
  assert.deepEqual(offset.events.slice(0, 4), [['cancel', 0, 3], ['set', 0, 3], ['linear', 1, 3 + attackSeconds(1)], ['target', 0.8, 3 + attackSeconds(1), D / 5]]);
  assert.deepEqual(offset.events.at(-1), ['target', 0, 23, decaySeconds(0) / 5]);
  // Let go during its attack: from where it got to, at once.
  env.trigger(30, 1);
  assert.deepEqual(offset.events.slice(-5), [['cancel', 0, 30], ['set', 0, 30], ['cancel', 0, 30.5], ['linear', 0.5 / attackSeconds(1), 30.5], ['target', 0, 30.5, decaySeconds(0) / 5]]);
  env.setKnob('decay', NaN);
  env.setKnob(/** @type {any} */ ('toString'), 0.5);
  env.setKnob('sustain', 4);
  assert.deepEqual(env.knobs, { ...DEFAULT_ENVELOPE, attack: 1, sustain: 1, release: 0, depth: 0.5 });
  env.reset();
  assert.deepEqual(env.knobs, DEFAULT_ENVELOPE);
  assert.notEqual(env.knobs, DEFAULT_ENVELOPE, 'a copy, to turn');
  assert.deepEqual(out.gain.events.at(-1), ['target', depthGain(1), 2, 0.02]);
});

test('the knobs kept a moment later for the next visit and read back; what is not knobs left out', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const env = new Adsr(sound, { storage, key: 'room.envelope' });
  env.setKnob('release', 0.9);
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.envelope')), { ...DEFAULT_ENVELOPE, release: 0.9 });
  assert.deepEqual(new Adsr(sound, { storage, key: 'room.envelope' }).knobs, { ...DEFAULT_ENVELOPE, release: 0.9 });
  const odd = new Adsr(sound, { storage: memoryStorage({ 'room.envelope': '{"attack":"slow","depth":-2,"hold":1}' }), key: 'room.envelope' });
  assert.deepEqual(odd.knobs, { ...DEFAULT_ENVELOPE, depth: 0 });
  assert.deepEqual(new Adsr(sound, { storage: memoryStorage({ 'room.envelope': '{' }), key: 'room.envelope' }).knobs, DEFAULT_ENVELOPE);
  // Storage that refuses: they last this visit.
  const full = memoryStorage();
  full.refuse = true;
  const kept = new Adsr(sound, { storage: full });
  kept.setKnob('sustain', 0);
  kept.save();
  assert.equal(kept.knobs.sustain, 0);
});
