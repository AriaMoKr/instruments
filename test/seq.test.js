// The rack's sequencer (seq.js): the line it comes with, what a step plays (its note, how hard,
// whether it slides on), steps played or rested, accented and slid, their notes and the line's
// octave set, cleared and reset, and the line kept for the next visit (what was kept but isn't a
// line's, as it comes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LINE, SEQ_GATE, SEQ_LOWEST, SEQ_OCTAVES, SEQ_RANGE, SEQ_VELOCITY, Seq } from '../public/js/seq.js';
import { STEPS } from '../public/js/pattern.js';
import { memoryStorage } from './helpers/audio.js';

/** A line kept nowhere. */
const fresh = () => new Seq({ storage: null });
/** The steps as text: each played, accented and slid (x yes, . no), and the notes. */
const written = (seq) => ({
  on: seq.steps.map((s) => (s.on ? 'x' : '.')).join(''),
  accent: seq.steps.map((s) => (s.accent ? 'x' : '.')).join(''),
  slide: seq.steps.map((s) => (s.slide ? 'x' : '.')).join(''),
  notes: seq.steps.map((s) => s.note),
});
const AS_IT_COMES = { on: DEFAULT_LINE.on, accent: DEFAULT_LINE.accent, slide: DEFAULT_LINE.slide, notes: [...DEFAULT_LINE.notes] };

test('the line it comes with: sixteen steps in C minor from C2, some played, accented or slid; a step plays its note, harder accented, and may slide on', () => {
  assert.deepEqual([SEQ_RANGE, SEQ_LOWEST, SEQ_OCTAVES.min, SEQ_OCTAVES.max], [24, 36, -1, 2]);
  assert.ok(SEQ_GATE > 0 && SEQ_GATE < 1, 'a note shorter than its step');
  assert.ok(SEQ_VELOCITY.accent > SEQ_VELOCITY.normal && SEQ_VELOCITY.accent <= 1);
  assert.ok(Object.isFrozen(DEFAULT_LINE) && Object.isFrozen(DEFAULT_LINE.notes) && Object.isFrozen(SEQ_OCTAVES) && Object.isFrozen(SEQ_VELOCITY));
  for (const text of [DEFAULT_LINE.on, DEFAULT_LINE.accent, DEFAULT_LINE.slide]) assert.match(text, new RegExp(`^[x.]{${STEPS}}$`));
  assert.equal(DEFAULT_LINE.notes.length, STEPS);
  // In C minor: C, D, E flat, F, G, A flat, B flat.
  for (const n of DEFAULT_LINE.notes) assert.ok([0, 2, 3, 5, 7, 8, 10].includes(n % 12) && n >= 0 && n <= SEQ_RANGE, `${n}`);
  const seq = fresh();
  assert.equal(seq.steps.length, STEPS);
  assert.deepEqual(written(seq), AS_IT_COMES);
  assert.deepEqual([seq.octave, seq.lowest], [0, SEQ_LOWEST]);
  // What a step plays: its note from C2, accented harder, sliding on; a rest, nothing.
  assert.deepEqual(seq.play(0), { note: 36, velocity: SEQ_VELOCITY.accent, slide: false });
  assert.deepEqual(seq.play(2), { note: 48, velocity: SEQ_VELOCITY.normal, slide: true });
  assert.equal(seq.play(4), null, 'a rest');
  assert.equal(seq.noteOf(4), 36, 'its note all the same');
  for (const s of [-1, STEPS, 1.5, NaN]) {
    assert.equal(seq.play(s), null, `${s}`);
    assert.equal(seq.noteOf(s), -1, `${s}`);
  }
});

test('steps played or rested, accented and slid, each toggled; their notes set whole within the knob\'s reach; a step that is not there is ignored', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const seq = fresh();
  const step4 = seq.steps[4];
  assert.equal(seq.toggle(4), true, 'a rest plays');
  assert.equal(seq.toggle(0), false, 'a step played rests');
  assert.equal(seq.toggleAccent(4), true);
  assert.equal(seq.toggleSlide(4), true);
  assert.equal(seq.toggleSlide(4), false);
  assert.deepEqual(seq.play(4), { note: 36, velocity: SEQ_VELOCITY.accent, slide: false });
  assert.equal(seq.steps[4], step4, 'the same object, changed');
  // Notes: whole semitones, the nearest, within two octaves; changed or not.
  assert.equal(seq.setNote(4, 7), true);
  assert.equal(seq.setNote(4, 7), false, 'already');
  assert.equal(seq.setNote(4, 6.6), false, '7, the nearest');
  assert.equal(seq.setNote(4, 30), true);
  assert.equal(seq.steps[4].note, SEQ_RANGE, 'as far as the knob goes');
  assert.equal(seq.setNote(4, -3), true);
  assert.equal(seq.steps[4].note, 0);
  for (const n of [NaN, Infinity, -Infinity]) assert.equal(seq.setNote(4, n), false, `${n}`);
  // Nothing there: ignored, and nothing grows.
  const before = written(seq);
  for (const s of [-1, STEPS, 2.5, NaN]) {
    assert.deepEqual([seq.toggle(s), seq.toggleAccent(s), seq.toggleSlide(s), seq.setNote(s, 3)], [false, false, false, false], `${s}`);
  }
  assert.deepEqual(written(seq), before);
  assert.equal(seq.steps.length, STEPS);
});

test('the octave: the line moved by whole octaves, within its reach; every note goes with it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const seq = fresh();
  seq.setOctave(1);
  assert.deepEqual([seq.octave, seq.lowest, seq.noteOf(2)], [1, 48, 60]);
  assert.equal(seq.play(0).note, 48);
  seq.setOctave(7);
  assert.equal(seq.octave, SEQ_OCTAVES.max);
  seq.setOctave(-1.4);
  assert.deepEqual([seq.octave, seq.lowest], [-1, 24]);
  seq.setOctave(-5);
  assert.equal(seq.octave, SEQ_OCTAVES.min);
  seq.setOctave(NaN);
  assert.equal(seq.octave, SEQ_OCTAVES.min, 'not a number: as it was');
});

test('cleared, every step a rest on the lowest note, the octave kept; reset, the line as it comes in its octave, in the same steps', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const seq = fresh();
  const steps = [...seq.steps];
  seq.setOctave(2);
  seq.clear();
  assert.deepEqual(written(seq), { on: '.'.repeat(STEPS), accent: '.'.repeat(STEPS), slide: '.'.repeat(STEPS), notes: Array(STEPS).fill(0) });
  assert.equal(seq.octave, 2);
  assert.ok(seq.steps.every((s) => seq.play(seq.steps.indexOf(s)) === null));
  seq.reset();
  assert.deepEqual(written(seq), AS_IT_COMES);
  assert.equal(seq.octave, 0);
  assert.ok(seq.steps.every((s, i) => s === steps[i]), 'the objects the page holds');
});

test('the line: kept a moment later for the next visit (each step played, accented and slid as x and ., its note, the octave), and read back', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const seq = new Seq({ storage, key: 'room.seq' });
  seq.toggle(4);
  seq.toggleAccent(1);
  seq.toggleSlide(15);
  seq.setNote(1, 19);
  seq.setOctave(-1);
  assert.equal(storage.map.size, 0, 'not at once, while steps are being set');
  t.mock.timers.tick(400);
  const kept = JSON.parse(storage.map.get('room.seq'));
  assert.deepEqual(kept, {
    notes: DEFAULT_LINE.notes.map((n, s) => (s === 1 ? 19 : n)),
    on: 'xxxxxxxxx.xxx.xx',
    accent: 'xx...x..x...x...',
    slide: '..x...x...x...xx',
    octave: -1,
  });
  const next = new Seq({ storage, key: 'room.seq' });
  assert.deepEqual([written(next), next.octave], [written(seq), -1]);
  // Reset, and kept at once by save().
  next.reset();
  next.save();
  assert.deepEqual(JSON.parse(storage.map.get('room.seq')), { ...AS_IT_COMES, octave: 0 });
});

test("what was kept but isn't a line's comes as it comes, a part at a time; storage that refuses or is blocked breaks nothing", (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const read = (value) => new Seq({ storage: memoryStorage({ seq: typeof value === 'string' ? value : JSON.stringify(value) }) });
  // Each part on its own: a good one kept, a bad one as it comes.
  const part = read({ on: 'x'.repeat(STEPS), accent: 'x.x', slide: 42, notes: Array(STEPS).fill(30), octave: 9 });
  assert.deepEqual(written(part), { ...AS_IT_COMES, on: 'x'.repeat(STEPS), notes: Array(STEPS).fill(SEQ_RANGE) }, 'notes kept within reach');
  assert.equal(part.octave, SEQ_OCTAVES.max);
  assert.deepEqual(written(read({ notes: [1, 2, 3], octave: 'up' })), AS_IT_COMES, 'too few notes; not an octave');
  assert.deepEqual(written(read({ notes: Array(STEPS).fill('C') })), AS_IT_COMES, 'notes that are not numbers');
  assert.equal(read({ octave: 1 }).octave, 1);
  for (const text of ['not json', '[1,2]', 'null', '"xxxx"', '7', '{"on":"X...............","slide":"x............... "}']) {
    const seq = read(text);
    assert.deepEqual([written(seq), seq.octave], [AS_IT_COMES, 0], text);
  }
  const full = memoryStorage();
  full.refuse = true;
  const refused = new Seq({ storage: full });
  refused.toggle(4);
  t.mock.timers.tick(400);
  refused.save();
  assert.equal(refused.steps[4].on, true, 'it lasts this visit');
  const blocked = fresh();
  blocked.toggleSlide(0);
  blocked.save();
  assert.equal(blocked.steps[0].slide, true);
});
