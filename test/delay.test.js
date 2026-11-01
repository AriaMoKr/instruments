// The delay (delay.js): its time in steps of the clock, and in words; the loop it makes once the
// sound has woken (in, round the delay and its darkening filter, turned down each time, and out
// through its level into the mixer's 'delay' channel, the rack's into its own), eased to its knobs
// and to the clock's tempo; and the knobs kept for the next visit. On test/helpers/audio.js's fake
// Web Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DELAY, DELAY_KNOBS, Delay, MAX_STEPS, delaySteps, delayText, feedbackGain, levelGain,
} from '../public/js/delay.js';
import { TEMPO, stepSeconds } from '../public/js/clock.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('the time knob: a 16th to a half note, in whole steps of the clock, and in words', () => {
  assert.deepEqual([delaySteps(0), delaySteps(DEFAULT_DELAY.time), delaySteps(1)], [1, 3, MAX_STEPS]);
  assert.deepEqual([delaySteps(-1), delaySteps(2)], [1, MAX_STEPS], 'kept to the knob');
  assert.equal(delayText('time', 0), '1 step, a 16th');
  assert.equal(delayText('time', DEFAULT_DELAY.time), '3 steps, a dotted 8th');
  assert.equal(delayText('time', 4 / 7), '5 steps', 'no name for five');
  assert.equal(delayText('time', 1), '8 steps, a half note');
  assert.equal(delayText('feedback', 0.45), '45%');
  assert.equal(delayText('level', 2), '100%');
  assert.deepEqual(DELAY_KNOBS, ['time', 'feedback', 'level']);
});

test('the feedback never so much that the echoes grow; the level heard as its square', () => {
  assert.equal(feedbackGain(0), 0);
  assert.ok(feedbackGain(1) < 0.9);
  assert.equal(feedbackGain(5), feedbackGain(1));
  assert.deepEqual([levelGain(0), levelGain(0.5), levelGain(1)], [0, 0.25, 1]);
});

test('no loop until the sound has woken; then one, made once: in, round and darker each time, out into the delay channel', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const delay = new Delay(sound, { storage: null });
  assert.equal(delay.input(), null);
  delay.setKnob('feedback', 0.2);
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const input = delay.input();
  assert.ok(input);
  assert.equal(delay.input(), input, 'made once');
  const [d] = ctx.all('delay'), [tone] = ctx.all('filter');
  assert.deepEqual([input.outputs, d.outputs], [[d], [tone]]);
  const [feedback, level] = tone.outputs;
  const channel = sound.channel('delay');
  assert.deepEqual([feedback.outputs, level.outputs], [[d], [channel]], 'round the loop, and out');
  assert.deepEqual(channel.outputs, [ctx.all('gain')[0]], 'its channel into the master');
  assert.equal(tone.type, 'lowpass');
  assert.ok(near(d.delayTime.value, 3 * stepSeconds(TEMPO.value)), `${d.delayTime.value}`);
  assert.ok(d.maxDelayTime >= MAX_STEPS * stepSeconds(TEMPO.min), 'room for the longest echo at the slowest tempo');
  assert.equal(feedback.gain.value, feedbackGain(0.2), 'as the knob was turned before');
  assert.equal(level.gain.value, levelGain(DEFAULT_DELAY.level));
  // Without Web Audio: none, and nothing breaks.
  const none = new Delay(new Sound({ Context: null, storage: null }), { storage: null });
  assert.equal(none.input(), null);
  none.setTempo(90);
  none.reset();
});

test("the rack's delay another, its own loop and knobs, out into its own channel", () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const board = new Delay(sound, { storage: null });
  const rack = new Delay(sound, { storage: null, key: 'rackdelay', channel: 'rackdelay' });
  assert.deepEqual([board.channel, rack.channel], ['delay', 'rackdelay']);
  sound.wake();
  const a = board.input(), b = rack.input();
  assert.ok(a && b && a !== b, 'a loop each');
  const [, level] = b.outputs[0].outputs[0].outputs;
  assert.deepEqual(level.outputs, [sound.channel('rackdelay')]);
  assert.notEqual(sound.channel('rackdelay'), sound.channel('delay'));
  rack.setKnob('time', 1);
  assert.equal(board.knobs.time, DEFAULT_DELAY.time, 'its own knobs');
});

test('the knobs eased in, the time following the tempo; nonsense ignored; reset as it comes', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const delay = new Delay(sound, { storage: null });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const d = delay.input()?.outputs[0];
  ctx.currentTime = 3;
  delay.setKnob('time', 1);
  assert.deepEqual(d.delayTime.events.at(-1), ['target', MAX_STEPS * stepSeconds(TEMPO.value), 3, 0.05], 'eased, as a tape slows');
  delay.setTempo(60);
  assert.equal(delay.seconds, MAX_STEPS * stepSeconds(60));
  assert.deepEqual(d.delayTime.events.at(-1), ['target', delay.seconds, 3, 0.05]);
  for (const tempo of [NaN, 0, -5]) delay.setTempo(tempo);
  assert.equal(delay.tempo, 60);
  delay.setKnob('time', NaN);
  delay.setKnob(/** @type {any} */ ('toString'), 0.5);
  delay.setKnob('level', 3);
  assert.deepEqual(delay.knobs, { ...DEFAULT_DELAY, time: 1, level: 1 });
  delay.reset();
  assert.deepEqual(delay.knobs, DEFAULT_DELAY);
  assert.notEqual(delay.knobs, DEFAULT_DELAY, 'a copy, to turn');
});

test('the knobs kept a moment later for the next visit and read back; what is not knobs left out', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const delay = new Delay(sound, { storage, key: 'room.delay' });
  delay.setKnob('feedback', 0.7);
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.delay')), { ...DEFAULT_DELAY, feedback: 0.7 });
  assert.deepEqual(new Delay(sound, { storage, key: 'room.delay' }).knobs, { ...DEFAULT_DELAY, feedback: 0.7 });
  const odd = new Delay(sound, { storage: memoryStorage({ 'room.delay': '{"time":"long","level":7,"nope":1}' }), key: 'room.delay' });
  assert.deepEqual(odd.knobs, { ...DEFAULT_DELAY, level: 1 });
  assert.deepEqual(new Delay(sound, { storage: memoryStorage({ 'room.delay': '{' }), key: 'room.delay' }).knobs, DEFAULT_DELAY);
  // Storage that refuses: they last this visit.
  const full = memoryStorage();
  full.refuse = true;
  const kept = new Delay(sound, { storage: full });
  kept.setKnob('time', 0);
  kept.save();
  assert.equal(kept.knobs.time, 0);
});
