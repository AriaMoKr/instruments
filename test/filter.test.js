// The rack's filter (filter.js): its MODE knob's three modes, its resonance as a Q in each mode's
// terms and the trim that keeps it as loud, MOD in cents, its knobs in words; the filter it makes once
// the sound has woken (in, through it and its trim, out into its channel; its CUTOFF in through MOD
// into its detune), eased to its knobs, its mode at once; what is plugged into its CUTOFF in, before
// it is made and after; and the knobs kept for the next visit. On test/helpers/audio.js's fake Web
// Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FILTER, FILTER_KNOBS, FILTER_MODES, Filter, MOD_OCTAVES, filterMode, filterQ, filterText, filterTrim, modCents,
} from '../public/js/filter.js';
import { cutoffHz } from '../public/js/synth.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** A filter on a woken fake context, and its nodes: the biquad, the CUTOFF in's gain (MOD), its out. */
function made(o = {}) {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const filter = new Filter(sound, { storage: null, ...o });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  return { sound, filter, ctx };
}
/** The nodes a filter made. */
function nodes(filter, ctx) {
  const input = filter.input(), [f] = ctx.all('filter'), out = filter.output();
  const cv = ctx.all('gain').find((g) => g.outputs.includes(f.detune));
  return { input, f, out, cv };
}

test("its MODE knob's three modes; the resonance as a Q in each mode's terms and the trim that keeps it as loud; MOD in cents; each in words", () => {
  assert.deepEqual(FILTER_KNOBS, ['mode', 'cutoff', 'resonance', 'mod']);
  assert.deepEqual(FILTER_MODES.map((m) => [m.id, m.label, m.name]), [['lowpass', 'LP', 'Low-pass'], ['bandpass', 'BP', 'Band-pass'], ['highpass', 'HP', 'High-pass']]);
  assert.deepEqual([0, 0.2, 0.5, 0.8, 1, -1, 2].map((k) => filterMode(k).id), ['lowpass', 'lowpass', 'bandpass', 'highpass', 'highpass', 'lowpass', 'highpass']);
  // A low-pass's and a high-pass's Q in dB, from flat to a 24 dB peak; a band-pass's as it is, a wide
  // band to a narrow one.
  assert.deepEqual([filterQ('lowpass', 0), filterQ('lowpass', 1), filterQ('highpass', 0.5), filterQ('highpass', 3)], [-3, 24, 10.5, 24]);
  assert.ok(near(filterQ('bandpass', 0), 0.7) && near(filterQ('bandpass', 1), 22.4) && filterQ('bandpass', 0.5) > filterQ('bandpass', 0.4));
  // Let down as the peak grows, 6 dB at the most; a narrowing band made up.
  assert.deepEqual([filterTrim('lowpass', 0), filterTrim('highpass', 0), filterTrim('bandpass', 0)], [1, 1, 1]);
  assert.ok(near(20 * Math.log10(filterTrim('lowpass', 1)), -6) && filterTrim('highpass', 0.5) > filterTrim('highpass', 1));
  assert.ok(near(20 * Math.log10(filterTrim('bandpass', 1)), 12, 0.05) && filterTrim('bandpass', 0.5) < filterTrim('bandpass', 1));
  assert.deepEqual([modCents(0), modCents(0.5), modCents(1), modCents(-1)], [0, 2400, 1200 * MOD_OCTAVES, 0]);
  // In words.
  assert.deepEqual([0, 0.5, 1].map((k) => filterText('mode', k)), ['Low-pass', 'Band-pass', 'High-pass']);
  assert.deepEqual([filterText('cutoff', 0), filterText('cutoff', DEFAULT_FILTER.cutoff), filterText('cutoff', 1)], ['30 Hz', '1.4 kHz', '17.6 kHz']);
  assert.deepEqual([filterText('resonance', 0.3), filterText('resonance', 2)], ['30%', '100%']);
  assert.deepEqual([filterText('mod', 0), filterText('mod', 0.25), filterText('mod', 1)], ['none', '1.0 octaves', '4.0 octaves']);
  assert.ok(Object.isFrozen(DEFAULT_FILTER) && Object.isFrozen(FILTER_MODES));
});

test('no filter until the sound has woken; then one, made once: in, through it and its trim, out into its channel; its CUTOFF in through MOD into its detune', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const filter = new Filter(sound, { storage: null });
  assert.deepEqual([filter.input(), filter.output(), filter.channel], [null, null, 'filter']);
  filter.setKnob('resonance', 1);
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const { input, f, out, cv } = nodes(filter, ctx);
  assert.ok(input && out && cv);
  assert.deepEqual([filter.input(), filter.output(), ctx.all('filter').length], [input, out, 1], 'made once');
  assert.deepEqual([input.outputs, f.outputs, out.outputs], [[f], [out], [sound.channel('filter')]]);
  assert.deepEqual(cv.outputs, [f.detune]);
  assert.deepEqual([f.type, filter.mode], ['lowpass', 'lowpass']);
  assert.equal(f.Q.value, filterQ('lowpass', 1), 'as the knob was turned before');
  assert.equal(out.gain.value, filterTrim('lowpass', 1));
  assert.equal(f.frequency.value, cutoffHz(DEFAULT_FILTER.cutoff));
  assert.equal(cv.gain.value, modCents(DEFAULT_FILTER.mod));
  assert.deepEqual([f.Q.events, f.frequency.events, out.gain.events], [[], [], []], 'set as it is made, not eased');
  // A mode turned before: that mode, its Q in its terms.
  const high = made();
  high.filter.setKnob('mode', 1);
  const h = nodes(high.filter, high.ctx);
  assert.deepEqual([h.f.type, h.f.Q.events.at(-1)], ['highpass', ['set', filterQ('highpass', DEFAULT_FILTER.resonance), 0]]);
  // Without Web Audio: none, and nothing breaks.
  const none = new Filter(new Sound({ Context: null, storage: null }), { storage: null });
  assert.deepEqual([none.input(), none.output()], [null, null]);
  none.setKnob('mode', 1);
  none.setCutoffIn(null);
  none.reset();
});

test('its knobs eased in, its mode at once with its Q in the new terms; the cutoff no higher than the context makes; nonsense ignored; reset as it comes', () => {
  const { filter, ctx } = made();
  const { f, out, cv } = nodes(filter, ctx);
  ctx.currentTime = 2;
  filter.setKnob('cutoff', 1);
  assert.deepEqual(f.frequency.events.at(-1), ['target', cutoffHz(1), 2, 0.02]);
  filter.setKnob('mod', 0.25);
  assert.deepEqual(cv.gain.events.at(-1), ['target', 1200, 2, 0.02]);
  filter.setKnob('resonance', 0.5);
  assert.deepEqual([f.Q.events.at(-1), out.gain.events.at(-1)], [['target', filterQ('lowpass', 0.5), 2, 0.02], ['target', filterTrim('lowpass', 0.5), 2, 0.02]]);
  // To band-pass: its type and Q at once (a Q in dB is no band-pass's), its trim eased.
  ctx.currentTime = 3;
  filter.setKnob('mode', 0.5);
  assert.deepEqual([filter.mode, f.type], ['bandpass', 'bandpass']);
  assert.deepEqual(f.Q.events.slice(-2), [['cancel', 0, 3], ['set', filterQ('bandpass', 0.5), 3]]);
  assert.deepEqual(out.gain.events.at(-1), ['target', filterTrim('bandpass', 0.5), 3, 0.02]);
  filter.setKnob('mode', 0.6);
  assert.deepEqual(f.Q.events.at(-1), ['target', filterQ('bandpass', 0.5), 3, 0.02], 'still band-pass: eased');
  filter.setKnob('mode', 1);
  assert.deepEqual([f.type, f.Q.events.at(-1)], ['highpass', ['set', filterQ('highpass', 0.5), 3]]);
  // Nonsense.
  filter.setKnob('cutoff', NaN);
  filter.setKnob(/** @type {any} */ ('toString'), 0.5);
  filter.setKnob('resonance', 3);
  assert.deepEqual(filter.knobs, { mode: 1, cutoff: 1, resonance: 1, mod: 0.25 });
  filter.reset();
  assert.deepEqual([filter.knobs, f.type], [DEFAULT_FILTER, 'lowpass']);
  assert.notEqual(filter.knobs, DEFAULT_FILTER, 'a copy, to turn');
  // At a low sample rate, under its Nyquist.
  const slow = made();
  slow.ctx.sampleRate = 22050;
  slow.filter.setKnob('cutoff', 1);
  assert.equal(nodes(slow.filter, slow.ctx).f.frequency.value, 22050 * 0.45);
});

test('its CUTOFF in: what is plugged in before the filter is made connected once it is; then swapped, let go, or the same left as it is', () => {
  const { filter, ctx } = made();
  const lfo = ctx.createConstantSource(), env = ctx.createGain();
  filter.setCutoffIn(lfo);
  assert.deepEqual([filter.cutoffIn, lfo.outputs], [lfo, []], 'nothing made yet');
  const { cv } = nodes(filter, ctx);
  assert.deepEqual(lfo.outputs, [cv]);
  filter.setCutoffIn(env);
  assert.deepEqual([lfo.outputs, env.outputs], [[], [cv]]);
  filter.setCutoffIn(env);
  assert.deepEqual(env.outputs, [cv], 'not twice');
  filter.setCutoffIn(null);
  assert.deepEqual([env.outputs, filter.cutoffIn], [[], null]);
  filter.setCutoffIn(null);
  assert.deepEqual(cv.outputs, [nodes(filter, ctx).f.detune], 'into its detune still');
});

test('the knobs kept a moment later for the next visit and read back; what is not knobs left out', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const filter = new Filter(sound, { storage, key: 'room.filter' });
  filter.setKnob('mode', 1);
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.filter')), { ...DEFAULT_FILTER, mode: 1 });
  assert.deepEqual(new Filter(sound, { storage, key: 'room.filter' }).knobs, { ...DEFAULT_FILTER, mode: 1 });
  const odd = new Filter(sound, { storage: memoryStorage({ 'room.filter': '{"mode":"high","mod":7,"nope":1}' }), key: 'room.filter' });
  assert.deepEqual(odd.knobs, { ...DEFAULT_FILTER, mod: 1 });
  assert.deepEqual(new Filter(sound, { storage: memoryStorage({ 'room.filter': '{' }), key: 'room.filter' }).knobs, DEFAULT_FILTER);
  // Storage that refuses: they last this visit.
  const full = memoryStorage();
  full.refuse = true;
  const kept = new Filter(sound, { storage: full });
  kept.setKnob('cutoff', 0);
  kept.save();
  assert.equal(kept.knobs.cutoff, 0);
});
