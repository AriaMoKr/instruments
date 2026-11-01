// The drums' pattern (pattern.js): the beat it comes with, the pads that play on a step, steps set,
// toggled, cleared and reset, the step a pulse plays, a pad's steps as text and back, and the
// pattern kept for the next visit (what was kept but isn't a pad's steps, as it comes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATTERN, Pattern, STEPS, parseSteps, stepOf, stepsText } from '../public/js/pattern.js';
import { PADS } from '../public/js/drums.js';
import { memoryStorage } from './helpers/audio.js';

/** Pad `id`'s index in PADS. */
const pad = (id) => PADS.findIndex((p) => p.id === id);
const RESTS = '.'.repeat(16);
/** Each pad's steps as text, by its id. */
const written = (pattern) => Object.fromEntries(PADS.map((p, i) => [p.id, stepsText(pattern.steps[i])]));
/** The pattern as it comes, kept nowhere. */
const fresh = () => new Pattern({ storage: null });

test('the beat it comes with: the kick on every beat, the snare on two and four, the closed hat on every 8th; the other pads silent', () => {
  assert.equal(STEPS, 16);
  const pattern = fresh();
  assert.equal(pattern.steps.length, PADS.length);
  for (const row of pattern.steps) assert.equal(row.length, STEPS);
  assert.deepEqual(written(pattern), {
    kick: 'x...x...x...x...', snare: '....x.......x...', 'closed-hat': 'x.x.x.x.x.x.x.x.', 'open-hat': RESTS,
    'low-tom': RESTS, 'mid-tom': RESTS, 'high-tom': RESTS, clap: RESTS, rim: RESTS, cowbell: RESTS, crash: RESTS, ride: RESTS,
  });
  assert.equal(pattern.has(pad('kick'), 0), true);
  assert.equal(pattern.has(pad('kick'), 1), false);
  assert.equal(pattern.has(pad('snare'), 12), true);
  for (const [id, text] of Object.entries(DEFAULT_PATTERN)) assert.ok(pad(id) >= 0 && parseSteps(text), id);
  assert.ok(Object.isFrozen(DEFAULT_PATTERN));
});

test("the pads that play on a step, in PADS's order; none on a step that isn't there", (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pattern = fresh();
  const ids = (s) => pattern.padsAt(s).map((i) => PADS[i].id);
  assert.deepEqual(ids(0), ['kick', 'closed-hat']);
  assert.deepEqual(ids(1), []);
  assert.deepEqual(ids(2), ['closed-hat']);
  assert.deepEqual(ids(4), ['kick', 'snare', 'closed-hat']);
  assert.deepEqual(ids(12), ['kick', 'snare', 'closed-hat']);
  // Set out of order, still in PADS's.
  pattern.set(pad('ride'), 1, true);
  pattern.set(pad('kick'), 1, true);
  pattern.set(pad('clap'), 1, true);
  assert.deepEqual(ids(1), ['kick', 'clap', 'ride']);
  for (const s of [-1, 16, 1.5, NaN]) assert.deepEqual(pattern.padsAt(s), [], `${s}`);
});

test('steps set, toggled and cleared, a pad at a time, and reset to the beat it comes with; a pad or a step that is not there is ignored', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pattern = fresh();
  const kick = pad('kick'), ride = pad('ride');
  pattern.set(ride, 3, true);
  assert.equal(pattern.has(ride, 3), true);
  assert.equal(pattern.toggle(ride, 3), false, 'toggled off');
  assert.equal(pattern.toggle(ride, 15), true, 'toggled on');
  assert.equal(stepsText(pattern.steps[ride]), '...............x');
  pattern.set(kick, 0, false);
  assert.equal(stepsText(pattern.steps[kick]), '....x...x...x...');
  pattern.clear(kick);
  assert.equal(stepsText(pattern.steps[kick]), RESTS);
  // Nothing there: ignored, and nothing grows.
  for (const [i, s] of [[-1, 0], [PADS.length, 0], [kick, -1], [kick, STEPS], [kick, 2.5], [NaN, 0], [kick, NaN]]) {
    pattern.set(i, s, true);
    assert.equal(pattern.has(i, s), false, `${i}, ${s}`);
    assert.equal(pattern.toggle(i, s), false, `${i}, ${s}`);
  }
  pattern.clear(99);
  assert.equal(pattern.steps.length, PADS.length);
  for (const row of pattern.steps) assert.equal(Object.keys(row).length, STEPS);
  // Reset: the beat it comes with, in the arrays the pads had (a page holding one sees it).
  const rideSteps = pattern.steps[ride];
  pattern.reset();
  assert.deepEqual(written(pattern), written(fresh()));
  assert.equal(pattern.steps[ride], rideSteps);
});

test('the step a pulse plays: its count round the sixteen, however large, and never negative', () => {
  assert.deepEqual([0, 1, 15, 16, 17, 31, 32].map((n) => stepOf(n)), [0, 1, 15, 0, 1, 15, 0]);
  assert.equal(stepOf(16 * 1e9 + 5), 5);
  assert.equal(stepOf(2 ** 53 - 1), 15);
  assert.deepEqual([-1, -15, -16, -17, -33].map((n) => stepOf(n)), [15, 1, 0, 15, 15]);
  assert.equal(stepOf(2.9), 2, 'part way to the next');
  assert.deepEqual([NaN, Infinity, -Infinity].map((n) => stepOf(n)), [0, 0, 0], 'not a count');
});

test("a pad's steps as text and back, x a step played and . a rest; text that isn't sixteen of them is not a pad's steps", () => {
  for (const text of [...Object.values(DEFAULT_PATTERN), RESTS, 'x'.repeat(16), 'x..x..x..x..x..x']) {
    const steps = parseSteps(text);
    assert.equal(steps?.length, STEPS, text);
    assert.equal(stepsText(steps), text);
  }
  assert.deepEqual(parseSteps('x.x.............'), [true, false, true, ...Array(13).fill(false)]);
  // Written out, a pad's steps are always sixteen: one missing is a rest, any more are left out.
  assert.equal(stepsText([true]), `x${'.'.repeat(15)}`);
  assert.equal(stepsText(Array(20).fill(true)), 'x'.repeat(16));
  const bad = ['x...x...', 'x...x...x...x...x', 'X...x...x...x...', 'x-..x...x...x...', ' x..x...x...x...', 'x...x...x...x...\n', '', null, undefined, 16, true, {}, Array(16).fill(true)];
  for (const b of bad) assert.equal(parseSteps(b), null, JSON.stringify(b));
});

test('the pattern: kept a moment later for the next visit, every pad (a cleared one as sixteen rests), and read back', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const pattern = new Pattern({ storage, key: 'room.pattern' });
  pattern.toggle(pad('ride'), 2);
  pattern.toggle(pad('ride'), 10);
  pattern.clear(pad('snare'));
  assert.equal(storage.map.size, 0, 'not at once, while steps are being set');
  t.mock.timers.tick(400);
  const kept = JSON.parse(storage.map.get('room.pattern'));
  assert.deepEqual(Object.keys(kept), PADS.map((p) => p.id));
  assert.deepEqual([kept.ride, kept.snare, kept.kick, kept.rim], ['..x.......x.....', RESTS, DEFAULT_PATTERN.kick, RESTS]);
  const next = new Pattern({ storage, key: 'room.pattern' });
  assert.deepEqual(next.steps, pattern.steps);
  // Reset, and kept at once by save().
  next.reset();
  next.save();
  assert.deepEqual(JSON.parse(storage.map.get('room.pattern')), written(fresh()));
});

test("what was kept but isn't a pad's steps takes the beat it comes with, pads it doesn't know are left out, and storage that refuses or is blocked breaks nothing", (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const kept = JSON.stringify({ kick: 'x.x.', snare: RESTS, rim: 42, ride: 'x...............', 'open-hat': null, nope: 'xxxxxxxxxxxxxxxx' });
  const pattern = new Pattern({ storage: memoryStorage({ pattern: kept }) });
  assert.deepEqual(written(pattern), { ...written(fresh()), snare: RESTS, ride: 'x...............' }, 'the kick as it comes, the snare cleared');
  assert.equal(pattern.steps.length, PADS.length, 'no pad it does not know');
  for (const text of ['not json', '[1,2]', 'null', '"x...x...x...x..."', '{"kick":["x"]}']) {
    assert.deepEqual(written(new Pattern({ storage: memoryStorage({ pattern: text }) })), written(fresh()), text);
  }
  const full = memoryStorage();
  full.refuse = true;
  const refused = new Pattern({ storage: full });
  refused.toggle(pad('cowbell'), 6);
  t.mock.timers.tick(400);
  refused.save();
  assert.equal(refused.has(pad('cowbell'), 6), true, 'it lasts this visit');
  const blocked = fresh();
  blocked.toggle(pad('crash'), 0);
  blocked.save();
  assert.equal(blocked.has(pad('crash'), 0), true);
});
