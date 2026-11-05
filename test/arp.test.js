// The synth's arpeggiator (arp.js): the ways it plays (up, down, up and down, at random) over one to
// three octaves, the chord as keys go down and up, HOLD (a new chord with a key down and none held,
// a tap in or out), carrying on when the chord changes, each note as hard as its key went, its own
// clock (the first step at once, late steps skipped), at random on the room's clock alike for one
// band, and the words for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARP_GATE, ARP_LATE, ARP_MODES, ARP_RANGES, Arp, arpWords, isArpMode } from '../public/js/arp.js';

/** The next n notes it plays. */
const play = (arp, n) => Array.from({ length: n }, () => arp.next());

/** An arpeggiator on, its chord pressed. */
function chord(mode, notes, o = {}) {
  const arp = new Arp(o);
  arp.setMode(mode);
  for (const n of notes) arp.press(n);
  return arp;
}

/** Dice that go round the same numbers, for RAND. */
function dice(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test('four ways to play, one to three octaves, a gate under the step', () => {
  assert.deepEqual(ARP_MODES.map((m) => [m.id, m.label]), [['up', 'UP'], ['down', 'DOWN'], ['updown', 'UP+DN'], ['random', 'RAND']]);
  for (const m of ARP_MODES) assert.ok(m.name, m.id);
  assert.deepEqual(ARP_RANGES, [1, 2, 3]);
  assert.ok(ARP_GATE > 0.3 && ARP_GATE < 0.9 && ARP_LATE > 0);
  assert.deepEqual(['up', 'random', 'sideways', null, 3].map(isArpMode), [true, true, false, false, false]);
  const arp = new Arp();
  assert.deepEqual([arp.on, arp.mode, arp.hold, arp.range, arp.playing, arp.next()], [false, null, false, 1, false, -1], 'as it comes: off');
});

test('up, down, and up and down (the ends once), over one, two and three octaves', () => {
  assert.deepEqual(play(chord('up', [67, 60, 64]), 7), [60, 64, 67, 60, 64, 67, 60], 'lowest first, whatever order the keys went down');
  assert.deepEqual(play(chord('down', [60, 64, 67]), 4), [67, 64, 60, 67]);
  assert.deepEqual(play(chord('updown', [60, 64, 67]), 9), [60, 64, 67, 64, 60, 64, 67, 64, 60]);
  assert.deepEqual(play(chord('updown', [60, 64]), 4), [60, 64, 60, 64], 'two notes: each in turn');
  assert.deepEqual(play(chord('updown', [60]), 3), [60, 60, 60]);
  const two = chord('up', [60, 64]);
  two.setRange(2);
  assert.deepEqual(play(two, 5), [60, 64, 72, 76, 60], 'the chord, then the chord an octave up');
  const down = chord('down', [60, 64]);
  down.setRange(3);
  assert.deepEqual(play(down, 7), [88, 84, 76, 72, 64, 60, 88], 'down: from the top octave');
  const both = chord('updown', [60, 64]);
  both.setRange(2);
  assert.deepEqual(play(both, 7), [60, 64, 72, 76, 72, 64, 60]);
});

test('at random: every note in time, never the same twice running with another to play', () => {
  const arp = chord('random', [60, 64, 67, 71], { random: dice(7) });
  const notes = play(arp, 200);
  for (let i = 1; i < notes.length; i++) assert.notEqual(notes[i], notes[i - 1], `step ${i}`);
  assert.deepEqual([...new Set(notes)].sort(), [60, 64, 67, 71]);
  const one = chord('random', [62], { random: () => 0.99 });
  assert.deepEqual(play(one, 3), [62, 62, 62], 'one note: that one');
  const ends = chord('random', [60, 64], { random: () => 0.9999 });
  assert.deepEqual(play(ends, 4), [64, 60, 64, 60], 'dice at the top: still in the chord');
});

test("at random on the room's clock: each step's note drawn from the step's number and the run's seed, so one band's arpeggiators play alike, whatever their own dice", () => {
  const notes = [60, 64, 67, 71];
  const run = (seed, own) => {
    const arp = chord('random', notes, { random: own });
    arp.seed = seed;
    return Array.from({ length: 200 }, (_, k) => arp.next(k));
  };
  const a = run(2024, dice(3));
  assert.deepEqual(run(2024, dice(11)), a, 'alike');
  for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1], `step ${i}`);
  assert.deepEqual([...new Set(a)].sort(), notes);
  assert.notDeepEqual(run(2025, dice(3)), a, 'another run, another order');
  // One that joins the run at step 99: alike once it has played the same note at a step, at once or nearly.
  const later = chord('random', notes, { random: dice(5) });
  later.seed = 2024;
  const tail = Array.from({ length: 101 }, (_, k) => later.next(99 + k));
  const from = tail.findIndex((n, k) => n === a[99 + k]);
  assert.ok(from >= 0 && from < 4, `alike from step ${99 + from}`);
  assert.deepEqual(tail.slice(from), a.slice(99 + from), 'and from then on');
  // With no step's number (its own clock): its own dice.
  assert.deepEqual(play(chord('random', notes, { random: dice(7) }), 20), play(chord('random', notes, { random: dice(7) }), 20));
});

test('keys down make the chord and keys let go leave it; the first note pressed into an empty chord is to play at once', () => {
  const arp = new Arp();
  arp.setMode('up');
  assert.equal(arp.press(64, 0.5), true, 'the first: at once');
  assert.equal(arp.press(60), false);
  assert.deepEqual(arp.notes, [60, 64]);
  assert.deepEqual(play(arp, 3), [60, 64, 60]);
  arp.release(60);
  assert.deepEqual(arp.notes, [64]);
  arp.release(64);
  assert.equal(arp.playing, false);
  assert.equal(arp.next(), -1);
  assert.equal(arp.press(67), true, 'empty again: at once again');
  assert.deepEqual(play(arp, 2), [67, 67]);
  arp.release(99);
  assert.deepEqual(arp.notes, [67], 'a key that was not down');
});

test('HOLD: the chord stays when the keys are let go; a key down with none held starts a new one; a tap comes in or goes', () => {
  const arp = new Arp();
  arp.setMode('up');
  arp.setHold(true);
  arp.press(60);
  arp.press(64);
  arp.release(60);
  arp.release(64);
  assert.deepEqual(arp.notes, [60, 64], 'held');
  assert.deepEqual(play(arp, 2), [60, 64]);
  assert.equal(arp.press(62), false, 'a new chord, not at once: the clock keeps its time');
  assert.deepEqual(arp.notes, [62]);
  assert.equal(arp.next(), 62, "from the new chord's first note");
  arp.press(65);
  assert.deepEqual(arp.notes, [62, 65], 'with a key held: added');
  arp.release(62);
  arp.release(65);
  // Taps: in, and out again.
  assert.equal(arp.toggle(69, 0.4), false);
  assert.deepEqual(arp.notes, [62, 65, 69]);
  arp.toggle(62);
  assert.deepEqual(arp.notes, [65, 69]);
  arp.toggle(65);
  arp.toggle(69);
  assert.equal(arp.playing, false);
  assert.equal(arp.toggle(70), true, 'into an empty chord: at once');
  // HOLD off: the notes whose keys are up go, those held stay.
  arp.press(72);
  arp.setHold(false);
  assert.deepEqual(arp.notes, [72]);
  arp.release(72);
  assert.equal(arp.playing, false);
});

test('the chord changed while it plays: on after the note it played last, or from where that note was', () => {
  const arp = chord('up', [60, 64, 67, 71]);
  assert.deepEqual(play(arp, 2), [60, 64]);
  arp.press(65);
  assert.equal(arp.next(), 65, 'after 64, the new 65');
  arp.release(67);
  assert.equal(arp.next(), 71, '67 gone: on to 71');
  arp.release(71);
  assert.equal(arp.next(), 60, 'round again');
  const down = chord('down', [60, 64, 67]);
  assert.deepEqual(play(down, 2), [67, 64]);
  down.release(64);
  assert.equal(down.next(), 60, 'down, 64 gone: on to 60');
  // Another way round, or another range: on from the note played last.
  const ways = chord('up', [60, 64, 67]);
  assert.deepEqual(play(ways, 2), [60, 64]);
  ways.setMode('down');
  assert.equal(ways.next(), 60);
  ways.setRange(2);
  assert.deepEqual(play(ways, 2), [79, 76]);
});

test('each note as hard as its key went down, an octave up as its own; off, the chord goes; RANGE round its three', () => {
  const arp = chord('up', [], {});
  arp.press(60, 0.3);
  arp.press(64, 0.9);
  arp.setRange(2);
  assert.deepEqual([60, 64, 72, 76, 61].map((n) => arp.velocity(n)), [0.3, 0.9, 0.3, 0.9, 0.8]);
  arp.press(67, 7);
  assert.equal(arp.velocity(67), 1, 'within 0…1');
  arp.setMode('random');
  assert.deepEqual(arp.notes, [60, 64, 67], 'another way: the chord stays');
  arp.setMode(null);
  assert.deepEqual([arp.on, arp.playing], [false, false]);
  arp.setMode('sideways');
  assert.equal(arp.on, false);
  arp.setRange(9);
  assert.equal(arp.range, 3);
  arp.nextRange();
  assert.equal(arp.range, 1);
  arp.nextRange();
  assert.equal(arp.range, 2);
  arp.setRange(NaN);
  arp.setRange(0);
  assert.equal(arp.range, 1);
});

test('its own clock: the first step at once, then a step apart up to the time asked; late ones skipped; none with nothing to play', () => {
  const arp = new Arp();
  const times = [];
  const at = (t) => times.push(t);
  assert.equal(arp.run(0, 0.12, 0.1, at), 0, 'off');
  arp.setMode('up');
  assert.equal(arp.run(0, 0.12, 0.1, at), 0, 'nothing held');
  arp.press(60);
  assert.equal(arp.run(1, 1.12, 0.1, at), 2);
  assert.deepEqual(times.map((t) => Math.round(t * 100) / 100), [1, 1.1]);
  assert.equal(arp.run(1.01, 1.13, 0.1, at), 0, 'nothing new');
  arp.run(1.1, 1.22, 0.1, at);
  assert.deepEqual(times.map((t) => Math.round(t * 100) / 100), [1, 1.1, 1.2]);
  // Put away for a while: on from now, not every step missed.
  times.length = 0;
  arp.run(5, 5.12, 0.1, at);
  assert.deepEqual(times.map((t) => Math.round(t * 100) / 100), [5, 5.1]);
  // A step played on another clock: its own carries on a step after it.
  arp.played(5.3, 0.2);
  times.length = 0;
  arp.run(5.31, 5.6, 0.1, at);
  assert.deepEqual(times.map((t) => Math.round(t * 100) / 100), [5.5]);
  // Let go of everything, then a new chord: at once again.
  arp.release(60);
  arp.run(6, 6.12, 0.1, at);
  arp.press(62);
  times.length = 0;
  arp.run(6.05, 6.17, 0.1, at);
  assert.equal(times[0], 6.05);
  assert.equal(arp.run(7, 8, 0, at), 0, 'no step length: nothing');
});

test('in words: off, or which way over how many octaves, and HOLD', () => {
  assert.equal(arpWords({ mode: null, range: 2, hold: true }), 'Off');
  assert.equal(arpWords({ mode: 'up', range: 1, hold: false }), 'Up, 1 octave');
  assert.equal(arpWords({ mode: 'updown', range: 3, hold: true }), 'Up and down, 3 octaves, hold');
});
