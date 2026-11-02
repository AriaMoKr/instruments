// The rack's mixer (mixer.js): its four knobs, an in's each, as gains (as loud as it came at UNITY,
// its square either side, about 5 dB over at the top) and in words; the mixer it makes once the sound
// has woken (its four ins, each through its level, into its out, into its channel), eased to its
// knobs; and the knobs kept for the next visit. On test/helpers/audio.js's fake Web Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MIXER, MIXER_KNOBS, Mixer, UNITY, mixGain, mixerText } from '../public/js/mixer.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** A mixer on a woken fake context, and its ins and its out. */
function made(o = {}) {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const mixer = new Mixer(sound, { storage: null, ...o });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  return { sound, mixer, ctx, ins: MIXER_KNOBS.map((n) => mixer.input(n)), out: mixer.output() };
}

test("its four knobs, an in's each; as gains, as loud as it came at UNITY and its square either side; in words, in decibels", () => {
  assert.deepEqual(MIXER_KNOBS, ['in1', 'in2', 'in3', 'in4']);
  assert.deepEqual(DEFAULT_MIXER, { in1: UNITY, in2: UNITY, in3: UNITY, in4: UNITY });
  assert.ok(UNITY > 0.5 && UNITY < 1, 'room to turn it up');
  assert.deepEqual([mixGain(0), mixGain(UNITY), mixGain(-1)], [0, 1, 0]);
  assert.ok(near(mixGain(UNITY / 2), 0.25) && near(mixGain(2), mixGain(1)));
  assert.ok(near(20 * Math.log10(mixGain(1)), 5, 0.01), 'about 5 dB over at the top');
  assert.deepEqual([0, 0.05, UNITY / 2, UNITY, 0.8, 1].map((k) => mixerText('in1', k)), ['off', '−47 dB', '−12 dB', '0 dB', '+1 dB', '+5 dB']);
  assert.ok(Object.isFrozen(DEFAULT_MIXER) && Object.isFrozen(MIXER_KNOBS));
});

test('no mixer until the sound has woken; then one, made once: its four ins, each through its level, into its out, into its channel', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const mixer = new Mixer(sound, { storage: null });
  assert.deepEqual([mixer.input('in1'), mixer.output(), mixer.channel], [null, null, 'mixer']);
  mixer.setKnob('in2', 0);
  sound.wake();
  const ins = MIXER_KNOBS.map((n) => mixer.input(n)), out = mixer.output();
  assert.ok(ins.every(Boolean) && out);
  assert.equal(new Set(ins).size, 4, 'an in each');
  for (const g of ins) assert.deepEqual(g.outputs, [out]);
  assert.deepEqual(out.outputs, [sound.channel('mixer')]);
  assert.deepEqual(ins.map((g) => g.gain.value), [1, 0, 1, 1], 'the second as it was turned before');
  assert.deepEqual(ins.map((g) => g.gain.events), [[], [], [], []], 'set as it is made, not eased');
  assert.deepEqual([mixer.input('in1'), mixer.output()], [ins[0], out], 'made once');
  assert.deepEqual([mixer.input('in5'), mixer.input('toString'), mixer.input('')], [null, null, null], 'no such in');
  // Another channel; and without Web Audio: none, and nothing breaks.
  const other = made({ channel: 'mix2' });
  assert.deepEqual(other.out.outputs, [other.sound.channel('mix2')]);
  const none = new Mixer(new Sound({ Context: null, storage: null }), { storage: null });
  assert.deepEqual([none.input('in1'), none.output()], [null, null]);
  none.setKnob('in1', 1);
  none.reset();
});

test('its knobs eased in; nonsense ignored; reset as it comes', () => {
  const { mixer, ctx, ins } = made();
  ctx.currentTime = 2;
  mixer.setKnob('in3', 1);
  assert.deepEqual(ins[2].gain.events.at(-1), ['target', mixGain(1), 2, 0.02]);
  mixer.setKnob('in1', 0);
  assert.deepEqual(ins[0].gain.events.at(-1), ['target', 0, 2, 0.02]);
  mixer.setKnob('in4', NaN);
  mixer.setKnob(/** @type {any} */ ('toString'), 0.5);
  mixer.setKnob('in2', -3);
  assert.deepEqual(mixer.knobs, { in1: 0, in2: 0, in3: 1, in4: UNITY });
  mixer.reset();
  assert.deepEqual(mixer.knobs, DEFAULT_MIXER);
  assert.notEqual(mixer.knobs, DEFAULT_MIXER, 'a copy, to turn');
  assert.deepEqual(ins.map((g) => g.gain.events.at(-1)?.[1]), [1, 1, 1, 1]);
});

test('the knobs kept a moment later for the next visit and read back; what is not knobs left out', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const mixer = new Mixer(sound, { storage, key: 'room.mixer' });
  mixer.setKnob('in4', 0.2);
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.mixer')), { ...DEFAULT_MIXER, in4: 0.2 });
  assert.deepEqual(new Mixer(sound, { storage, key: 'room.mixer' }).knobs, { ...DEFAULT_MIXER, in4: 0.2 });
  const odd = new Mixer(sound, { storage: memoryStorage({ 'room.mixer': '{"in1":"loud","in2":7,"in9":1}' }), key: 'room.mixer' });
  assert.deepEqual(odd.knobs, { ...DEFAULT_MIXER, in2: 1 });
  assert.deepEqual(new Mixer(sound, { storage: memoryStorage({ 'room.mixer': '{' }), key: 'room.mixer' }).knobs, DEFAULT_MIXER);
  // Storage that refuses: they last this visit.
  const full = memoryStorage();
  full.refuse = true;
  const kept = new Mixer(sound, { storage: full });
  kept.setKnob('in1', 0);
  kept.save();
  assert.equal(kept.knobs.in1, 0);
});
