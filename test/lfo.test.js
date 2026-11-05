// The rack's LFO (lfo.js): its knobs (a rate in note values, a shape, a depth) and in words; its
// shapes over a cycle; its wave written ahead a step at a time with the clock's pulses, in time with
// them (a cycle starting again with the clock, a rate turned to falling on the beat at once, a jump
// set as one, random alike for one band), and on by itself while the clock is stopped; what it reads
// at a time, for its light;
// its output once the sound has woken, its depth eased; and the knobs kept for the next visit. On
// test/helpers/audio.js's fake Web Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LFO, LFO_KNOBS, LFO_RATES, LFO_SHAPES, Lfo, depthGain, knobPlace, lfoRate, lfoShape, lfoText, shapeAt,
} from '../public/js/lfo.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** An event on a param as [kind, value, time], rounded to read. */
const read = (e) => [e[0], +e[1].toFixed(6), +e[2].toFixed(6)];

/** An LFO on the fake Web Audio, woken, with these knobs; its dice from `rolls` in turn. */
function make({ knobs = {}, rolls = [0.5] } = {}) {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  let r = 0;
  const lfo = new Lfo(sound, { storage: null, random: () => rolls[r++ % rolls.length] });
  Object.assign(lfo.knobs, knobs);
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const out = lfo.output();
  return { sound, ctx, lfo, out, offset: ctx.all('constant')[0].offset };
}

test('its knobs: a rate from four bars to a 16th, five shapes, a depth heard as its square; and in words', () => {
  assert.deepEqual(LFO_KNOBS, ['rate', 'shape', 'depth']);
  assert.deepEqual(LFO_RATES.map((r) => r.steps), [64, 32, 16, 8, 4, 2, 1], 'the slowest first, each half the one before');
  assert.deepEqual(LFO_SHAPES.map((s) => s.id), ['sine', 'triangle', 'saw', 'square', 'random']);
  assert.deepEqual([lfoRate(0).steps, lfoRate(DEFAULT_LFO.rate).steps, lfoRate(1).steps], [64, 16, 1]);
  assert.deepEqual([lfoRate(-3).steps, lfoRate(7).steps], [64, 1], 'kept to the knob');
  assert.deepEqual([0, 0.2, 0.25, 0.4, 0.5, 0.75, 1].map((k) => lfoShape(k).id), ['sine', 'triangle', 'triangle', 'saw', 'saw', 'square', 'random'], 'the nearest place');
  assert.deepEqual(LFO_RATES.map((_, i) => knobPlace(i / (LFO_RATES.length - 1), LFO_RATES.length)), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual([depthGain(0), depthGain(0.5), depthGain(1), depthGain(2)], [0, 0.25, 1, 1]);
  assert.deepEqual(LFO_RATES.map((_, i) => lfoText('rate', i / 6)), ['4 bars', '2 bars', '1 bar', 'a half note', 'a quarter note', 'an 8th', 'a 16th']);
  assert.deepEqual(LFO_SHAPES.map((_, i) => lfoText('shape', i / 4)), ['Sine', 'Triangle', 'Saw', 'Square', 'Random']);
  assert.deepEqual([lfoText('depth', 0.5), lfoText('depth', 0.333), lfoText('depth', 3)], ['50%', '33%', '100%']);
  assert.deepEqual([lfoRate(DEFAULT_LFO.rate).name, lfoShape(DEFAULT_LFO.shape).id, DEFAULT_LFO.depth], ['1 bar', 'sine', 0.5], 'as it comes');
});

test('its shapes over a cycle: a sine and a triangle up first, a saw falling, a square high for the first half, random its held value; at a jump the value after it, or before it coming to it', () => {
  for (let p = 0; p <= 1; p += 1 / 64) assert.ok(Math.abs(shapeAt('sine', p) - Math.sin(2 * Math.PI * p)) < 0.02, `a sine, near enough, at ${p}`);
  for (const [p, v] of [[0, 0], [0.25, 1], [0.5, 0], [0.75, -1]]) assert.ok(near(shapeAt('sine', p), v), `sine ${p}`);
  const at = (shape, ...phases) => phases.map((p) => shapeAt(shape, p));
  assert.deepEqual(at('triangle', 0, 0.125, 0.25, 0.5, 0.75, 1), [0, 0.5, 1, 0, -1, 0]);
  assert.deepEqual(at('saw', 0, 0.25, 0.5), [1, 0.5, 0]);
  assert.deepEqual(at('square', 0, 0.25, 0.5, 0.75), [1, 1, -1, -1]);
  assert.deepEqual(at('random', 0, 0.3, 0.99), [1, 1, 1]);
  assert.deepEqual([shapeAt('square', 0.5, true), shapeAt('square', 1, true), shapeAt('saw', 1, true), shapeAt('triangle', 0.25, true)], [1, -1, -1, 1]);
});

test('before the sound has woken: no output and nothing breaks, and it keeps its place, for its light', () => {
  const lfo = new Lfo(new Sound({ Context: null, storage: null }), { storage: null });
  assert.equal(lfo.output(), null);
  assert.ok(Number.isNaN(lfo.valueAt(5)), 'nothing written: nothing to read');
  lfo.step(0, 1, 0.125);
  lfo.run(1.1, 1.2, 0.125);
  assert.ok(near(lfo.valueAt(1), 0) && near(lfo.valueAt(1.125), Math.sin(Math.PI / 8)) && near(lfo.valueAt(1.25), Math.sin(Math.PI / 4)));
  assert.ok(near(lfo.valueAt(9), Math.sin(Math.PI / 4)), 'after them, the last held');
  assert.ok(Number.isNaN(lfo.valueAt(0.5)), 'before them, nothing');
  lfo.setKnob('depth', 0.9);
  lfo.reset();
});

test('its output once the sound has woken: a constant source started at once, through its depth (the knob\'s square), made once; its depth eased', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const lfo = new Lfo(sound, { storage: null });
  lfo.knobs.depth = 0.8;
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  ctx.currentTime = 2;
  const out = lfo.output();
  assert.ok(out);
  assert.equal(lfo.output(), out, 'made once');
  const [wave] = ctx.all('constant');
  assert.deepEqual([wave.outputs, wave.started, wave.offset.value, out.outputs], [[out], 2, 0, []], 'into nothing until it is patched');
  assert.ok(near(out.gain.value, 0.64));
  ctx.currentTime = 3;
  lfo.setKnob('depth', 0.5);
  assert.deepEqual(out.gain.events.at(-1), ['target', 0.25, 3, 0.02], 'eased: no click');
  assert.deepEqual(wave.offset.events, [], 'nothing written yet');
});

test("with the clock: each step set ahead at its pulse's time, a cycle as many steps as its rate, a line from step to step", () => {
  const { lfo, offset } = make(); // a sine a bar long: sixteen steps
  const d = 0.125;
  for (let n = 0; n < 16; n++) lfo.step(n, 1 + n * d, d);
  // From 0 at the first step's time, set there (anything set from then on taken back first), then a
  // line to each step's end, nothing set between.
  assert.deepEqual(offset.events.slice(0, 2), [['cancel', 0, 1], ['set', 0, 1]]);
  const lines = offset.events.slice(2);
  assert.equal(lines.length, 16);
  for (const [n, e] of lines.entries()) assert.ok(e[0] === 'linear' && near(e[2], 1 + (n + 1) * d) && near(e[1], Math.sin(((n + 1) / 8) * Math.PI)), `step ${n}: ${e}`);
  // The next cycle on from it; a quarter note's four corners within each step.
  lfo.knobs.rate = 4 / 6;
  lfo.step(16, 3, d);
  assert.deepEqual(offset.events.slice(18).map(read), [0.25, 0.5, 0.75, 1].map((f) => ['linear', +Math.sin(f * (Math.PI / 2)).toFixed(6), 3 + f * d]));
  // Nonsense: nothing.
  const was = offset.events.length;
  for (const [n, t, s] of [[NaN, 4, d], [17, Infinity, d], [17, 3.125, 0], [17, 3.125, -1]]) lfo.step(n, t, s);
  lfo.run(NaN, 5, d);
  lfo.run(3, 5, 0);
  assert.equal(offset.events.length, was);
});

test('a rate turned to: its cycles counted from the clock\'s start, so that it falls on the beat at once; the clock started again, its cycle too', () => {
  const { lfo, offset } = make();
  const d = 0.1;
  for (let n = 0; n < 6; n++) lfo.step(n, n * d, d);
  // A quarter note from the clock's seventh step: halfway through a cycle there, at once.
  lfo.knobs.rate = 4 / 6;
  lfo.step(6, 6 * d, d);
  assert.deepEqual(offset.events.slice(8).map(read), [['set', 0, 0.6], ['linear', -0.382683, 0.625], ['linear', -0.707107, 0.65], ['linear', -0.92388, 0.675], ['linear', -1, 0.7]]);
  // The clock stopped, and started again: its first step at its time starts a cycle, from 0.
  const from = offset.events.length;
  lfo.step(0, 5, d);
  assert.deepEqual(offset.events.slice(from).map(read), [['cancel', 0, 5], ['set', 0, 5], ['linear', 0.382683, 5.025], ['linear', 0.707107, 5.05], ['linear', 0.92388, 5.075], ['linear', 1, 5.1]]);
});

test('a jump in the wave set as one, at a step\'s edge or within it; random a new value each cycle, held through it', () => {
  // A square a bar long: high for eight steps, then low; its jump at the ninth's start.
  const square = make({ knobs: { shape: 0.75 } });
  for (let n = 0; n < 16; n++) square.lfo.step(n, n * 0.1, 0.1);
  assert.deepEqual(square.offset.events.filter((e) => e[0] === 'set').map(read), [['set', 1, 0], ['set', -1, 0.8]]);
  assert.ok(square.offset.events.filter((e) => e[0] === 'linear').every((e) => e[1] === (e[2] < 0.85 ? 1 : -1)), 'flat between');
  // A square a 16th: a cycle a step, its jump halfway through each, and back at the next.
  const fast = make({ knobs: { shape: 0.75, rate: 1 } });
  fast.lfo.step(0, 2, 0.1);
  fast.lfo.step(1, 2.1, 0.1);
  assert.deepEqual(fast.offset.events.map(read), [
    ['cancel', 0, 2], ['set', 1, 2], ['linear', 1, 2.05], ['set', -1, 2.05], ['linear', -1, 2.1],
    ['set', 1, 2.1], ['linear', 1, 2.15], ['set', -1, 2.15], ['linear', -1, 2.2],
  ]);
  assert.deepEqual([fast.lfo.valueAt(2.04), fast.lfo.valueAt(2.06), fast.lfo.valueAt(2.11)], [1, -1, 1]);
  // Random, a quarter note: a value from its dice for each cycle (-1…1), held; the next at its start.
  const random = make({ knobs: { shape: 1, rate: 4 / 6 }, rolls: [0.75, 0.1] });
  for (let n = 0; n < 8; n++) random.lfo.step(n, n * 0.1, 0.1);
  assert.deepEqual(random.offset.events.filter((e) => e[0] === 'set').map(read), [['set', 0.5, 0], ['set', -0.8, 0.4]]);
  assert.ok(near(random.lfo.valueAt(0.25), 0.5) && near(random.lfo.valueAt(0.65), -0.8));
});

test("random on the clock's run: each cycle's value drawn from its number and the run's seed, so one band's LFOs move alike, whatever their own dice", () => {
  const sets = (seed, rolls) => {
    const m = make({ knobs: { shape: 1, rate: 4 / 6 }, rolls });
    m.lfo.seed = seed;
    for (let n = 0; n < 32; n++) m.lfo.step(n, n * 0.1, 0.1);
    return m.offset.events.filter((e) => e[0] === 'set').map(read);
  };
  const a = sets(4242, [0.75, 0.1]);
  assert.deepEqual(a.map((e) => e[2]), [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8], 'a value a cycle, held through it');
  assert.ok(a.every((e) => e[1] >= -1 && e[1] <= 1) && new Set(a.map((e) => e[1])).size === 8, `${a.map((e) => e[1])}`);
  assert.deepEqual(sets(4242, [0.2]), a, 'alike');
  assert.notDeepEqual(sets(4243, [0.75, 0.1]), a, 'another run, other values');
  assert.deepEqual(sets(NaN, [0.75, 0.1]).slice(0, 2).map((e) => e[1]), [0.5, -0.8], 'no run: its own dice');
});

test('while the clock is stopped: on by itself at the tempo, set ahead from where it got to, or from now if that has passed; the clock started, set afresh from its first step', () => {
  const { lfo, offset } = make();
  const d = 0.125;
  lfo.run(10, 10.3, d);
  assert.deepEqual(offset.events.map(read), [['cancel', 0, 10], ['set', 0, 10], ...[1, 2, 3].map((k) => ['linear', +Math.sin((k / 8) * Math.PI).toFixed(6), 10 + k * d])]);
  lfo.run(10.2, 10.3, d);
  assert.equal(offset.events.length, 5, 'set ahead already: nothing more');
  lfo.run(10.3, 10.42, d);
  assert.deepEqual(offset.events.slice(5).map(read), [['linear', 1, 10.5]], 'on from where it got to');
  assert.ok(near(lfo.valueAt(10.5), 1) && near(lfo.valueAt(10.3125), (Math.sin((3 / 8) * Math.PI) + Math.sin(Math.PI / 4)) / 2));
  // Away a while (the page hidden): afresh from now, on in its cycle.
  lfo.run(20, 20.1, d);
  assert.deepEqual(offset.events.slice(6).map(read), [['cancel', 0, 20], ['set', 1, 20], ['linear', 0.92388, 20.125]]);
  // The clock started: from its first step's time, the cycle from its start; what was set ahead from
  // then on taken back, and the light from the new step.
  lfo.step(0, 20.05, d);
  assert.deepEqual(offset.events.slice(-3).map(read), [['cancel', 0, 20.05], ['set', 0, 20.05], ['linear', 0.382683, 20.175]]);
  assert.ok(!offset.events.some((e) => e[2] > 20.05 + 1e-9 && e[2] < 20.175 - 1e-9), 'nothing left between');
  assert.ok(near(lfo.valueAt(20.04), 1 - 0.32 * (1 - Math.sin((5 / 8) * Math.PI))), 'before it, the step it had set');
  assert.ok(near(lfo.valueAt(20.11), 0.48 * Math.sin(Math.PI / 8)));
});

test('the knobs kept a moment later for the next visit and read back; nonsense ignored; reset as it comes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const lfo = new Lfo(sound, { storage, key: 'room.lfo' });
  assert.deepEqual(lfo.knobs, DEFAULT_LFO);
  lfo.setKnob('shape', 0.75);
  lfo.setKnob('depth', 2);
  lfo.setKnob('rate', NaN);
  lfo.setKnob(/** @type {any} */ ('toString'), 0.5);
  assert.deepEqual(lfo.knobs, { ...DEFAULT_LFO, shape: 0.75, depth: 1 });
  assert.deepEqual([lfo.shape, lfo.steps], ['square', 16]);
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.lfo')), { ...DEFAULT_LFO, shape: 0.75, depth: 1 });
  assert.deepEqual(new Lfo(sound, { storage, key: 'room.lfo' }).knobs, { ...DEFAULT_LFO, shape: 0.75, depth: 1 });
  const odd = new Lfo(sound, { storage: memoryStorage({ 'room.lfo': '{"rate":"fast","depth":-1,"nope":1}' }), key: 'room.lfo' });
  assert.deepEqual(odd.knobs, { ...DEFAULT_LFO, depth: 0 });
  assert.deepEqual(new Lfo(sound, { storage: memoryStorage({ 'room.lfo': '{' }), key: 'room.lfo' }).knobs, DEFAULT_LFO);
  lfo.reset();
  assert.deepEqual(lfo.knobs, DEFAULT_LFO);
  assert.notEqual(lfo.knobs, DEFAULT_LFO, 'a copy, to turn');
  // Storage that refuses: they last this visit.
  const full = memoryStorage();
  full.refuse = true;
  const kept = new Lfo(sound, { storage: full });
  kept.setKnob('rate', 0);
  kept.save();
  assert.equal(kept.knobs.rate, 0);
});
