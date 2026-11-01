// The room's clock (clock.js): a pulse a 16th note at the tempo, and which pulses each output
// sends; the pulses handed out ahead of the audio clock, in order and each once, never further
// ahead than the lookahead, however the frames come; stopping and starting again; the tempo changed
// while running; the pulses missed in a stall skipped but counted; and the tempo kept for the next
// visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOCK_OUTS, Clock, LATE, LOOKAHEAD, RACK_CLOCK_OUTS, START_LEAD, STEPS_PER_BEAT, TEMPO, clockEvery, clockSends, stepSeconds,
} from '../public/js/clock.js';
import { memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** A clock at a tempo, as if kept from the last visit. */
const clockAt = (tempo) => new Clock({ storage: memoryStorage({ clock: JSON.stringify({ tempo }) }) });

/** The pulses `clock` hands out at `now`, as [n, time]; it says how many. */
function pulses(clock, now) {
  const got = [];
  const count = clock.advance(now, (n, time) => got.push([n, time]));
  assert.equal(count, got.length, 'how many it handed out');
  return got;
}

/** The pulses `clock` hands out in frames 1/60 s apart, from `from` until `to`. */
function frames(clock, from, to) {
  const got = [];
  for (let now = from; now <= to; now += 1 / 60) got.push(...pulses(clock, now));
  return got;
}

test('a pulse is a 16th note at the tempo, from 60 to 180 beats a minute; the outputs send every pulse, every 2nd and every 4th', () => {
  assert.deepEqual(TEMPO, { min: 60, max: 180, value: 110 });
  assert.equal(STEPS_PER_BEAT, 4);
  assert.equal(stepSeconds(60), 0.25);
  assert.equal(stepSeconds(120), 0.125);
  assert.ok(near(16 * stepSeconds(110), (4 * 60) / 110), 'sixteen pulses: a bar of four beats');
  assert.deepEqual(CLOCK_OUTS.map((o) => [o.id, o.every]), [['clock.x1', 1], ['clock.d2', 2], ['clock.d4', 4]]);
  const sent = (id) => Array.from({ length: 9 }, (_, n) => n).filter((n) => clockSends(id, n));
  assert.deepEqual(sent('clock.x1'), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(sent('clock.d2'), [0, 2, 4, 6, 8]);
  assert.deepEqual(sent('clock.d4'), [0, 4, 8]);
  assert.deepEqual(sent('pad.kick'), [], 'not an output of the clock');
  assert.deepEqual(sent(null), [], 'nothing plugged in');
  assert.ok(Object.isFrozen(TEMPO) && Object.isFrozen(CLOCK_OUTS));
  // The rack's outs: the same clock's, sent alike.
  assert.deepEqual(RACK_CLOCK_OUTS.map((o) => [o.id, o.every]), [['rack.x1', 1], ['rack.d2', 2], ['rack.d4', 4]]);
  assert.deepEqual([sent('rack.x1'), sent('rack.d2'), sent('rack.d4')], [sent('clock.x1'), sent('clock.d2'), sent('clock.d4')]);
  assert.deepEqual(['clock.x1', 'clock.d2', 'clock.d4', 'rack.x1', 'rack.d2', 'rack.d4', 'seq.notes', 'nope', null].map((id) => clockEvery(id)), [1, 2, 4, 1, 2, 4, 0, 0, 0], 'how often each sends; 0 for none');
  assert.ok(Object.isFrozen(RACK_CLOCK_OUTS));
});

test('pulses come in order at the tempo, each handed out once, before it falls but never further ahead than the lookahead, however the frames come', () => {
  // Frames as a page has them: at 90, 72, 60 and 30 Hz, a slow one, and two close together.
  const gaps = [1 / 90, 1 / 72, 1 / 60, 0.05, 1 / 30, 0.1, 0.002];
  for (const tempo of [TEMPO.min, TEMPO.value, TEMPO.max]) {
    const clock = clockAt(tempo), step = stepSeconds(tempo), t0 = 12.5;
    clock.start(t0);
    const all = [];
    for (let f = 0, now = t0; now < t0 + 10; now += gaps[f++ % gaps.length]) {
      const got = pulses(clock, now);
      for (const [n, time] of got) assert.ok(time < now + LOOKAHEAD && time >= now - LATE, `${tempo}: pulse ${n} at ${time}, handed out at ${now}`);
      all.push(...got);
      // Every pulse due by now + LOOKAHEAD is out, and the next isn't due yet.
      assert.ok(t0 + START_LEAD + all.length * step >= now + LOOKAHEAD - 1e-9, `${tempo}: pulse ${all.length} held back at ${now}`);
      // Again at the same time, or an earlier one: nothing new.
      assert.equal(clock.advance(now, () => assert.fail('handed out again')), 0);
      assert.equal(clock.advance(now - 1, () => assert.fail('handed out again')), 0);
    }
    assert.deepEqual(all.map(([n]) => n), all.map((_, i) => i), `${tempo}: every pulse from 0, once`);
    for (const [n, time] of all) assert.ok(near(time, t0 + START_LEAD + n * step), `${tempo}: pulse ${n} at ${time}`);
  }
});

test('not started, there are no pulses; stopped, none more; started again, from pulse 0 a moment after then', () => {
  const clock = clockAt(120);
  assert.equal(clock.running, false);
  assert.deepEqual(pulses(clock, 5), [], 'not started');
  clock.start(1);
  assert.equal(clock.running, true);
  assert.deepEqual(pulses(clock, 1), [[0, 1 + START_LEAD]], 'the first at once, START_LEAD after');
  const next = pulses(clock, 1.25);
  assert.deepEqual(next.map(([n]) => n), [1, 2]);
  assert.ok(near(next[0][1], 1.175) && near(next[1][1], 1.3));
  clock.stop();
  assert.equal(clock.running, false);
  assert.deepEqual(pulses(clock, 1.3), [], 'stopped');
  assert.deepEqual(pulses(clock, 5), []);
  clock.start(6);
  assert.deepEqual(pulses(clock, 6), [[0, 6 + START_LEAD]], 'from 0 again');
  // Started again while running: from 0 again, from then.
  pulses(clock, 6.5);
  clock.start(6.6);
  assert.deepEqual(pulses(clock, 6.6), [[0, 6.6 + START_LEAD]]);
  // A time that isn't a number changes nothing.
  clock.start(NaN);
  assert.deepEqual(pulses(clock, NaN), []);
  assert.deepEqual(pulses(clock, 6.7).map(([n]) => n), [1]);
  clock.stop();
  clock.start(Infinity);
  assert.equal(clock.running, false);
});

test('the tempo changed while running: the pulse due next keeps its time, and the ones after it come at the new tempo', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = clockAt(120);
  clock.start(0);
  const got = frames(clock, 0, 0.2);
  assert.equal(got.length, 3, 'up to 0.3; the next due at 0.425');
  clock.setTempo(60);
  got.push(...frames(clock, 0.2 + 1 / 60, 1));
  assert.equal(got.length, 6, 'up to 0.925; the next due at 1.175');
  clock.setTempo(180);
  got.push(...frames(clock, 1 + 1 / 60, 2));
  assert.deepEqual(got.map(([n]) => n), got.map((_, i) => i), 'none skipped, none twice');
  // Pulses 1–3 a step at 120 after the one before, 4–6 at 60, the rest at 180.
  got.slice(1).forEach(([n, time], i) => {
    const gap = time - got[i][1];
    assert.ok(near(gap, n <= 3 ? 0.125 : n <= 6 ? 0.25 : 60 / 180 / 4), `pulse ${n}: ${gap} after the one before`);
  });
});

test('a pulse a little behind is still handed out; one more than LATE behind is skipped but counted, and after a long stall at once', () => {
  const clock = clockAt(120);
  clock.start(0);
  // The first frame late: pulse 0 (at 0.05) is 0.07 behind, near enough.
  assert.deepEqual(pulses(clock, 0.12).map(([n]) => n), [0, 1]);
  // A frame very late: pulse 2 (0.3) is more than LATE behind 0.45, so skipped; 3 and 4 come.
  const late = pulses(clock, 0.45);
  assert.deepEqual(late.map(([n]) => n), [3, 4]);
  assert.ok(near(late[0][1], 0.425) && near(late[1][1], 0.55));
  // An hour later: the pulses missed counted, the ones due now handed out at their times.
  const hour = pulses(clock, 3600);
  assert.deepEqual(hour.map(([n]) => n), [28799, 28800]);
  for (const [n, time] of hour) assert.ok(near(time, 0.05 + n * 0.125, 1e-6), `pulse ${n} at ${time}`);
  // Thirty years later, at once: the pulses missed aren't gone through one at a time.
  const started = performance.now();
  const years = pulses(clock, 1e9);
  assert.ok(performance.now() - started < 1000, `${performance.now() - started} ms`);
  assert.deepEqual(years.map(([n]) => n), [7999999999, 8000000000]);
  for (const [n, time] of years) assert.ok(near(time, 0.05 + n * 0.125, 1e-6), `pulse ${n} at ${time}`);
  // And on in step from there.
  assert.deepEqual(pulses(clock, 1e9 + 0.1).map(([n]) => n), [8000000001]);
});

test('the tempo: whole beats a minute from 60 to 180, nonsense ignored; kept a moment later for the next visit and read back, not running', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const clock = new Clock({ storage, key: 'room.clock' });
  assert.deepEqual([clock.tempo, clock.running], [TEMPO.value, false]);
  for (const [bpm, tempo] of [[123.4, 123], [97.5, 98], [500, 180], [10, 60], [NaN, 60], [Infinity, 60], [-Infinity, 60], [140, 140]]) {
    clock.setTempo(bpm);
    assert.equal(clock.tempo, tempo, `${bpm}`);
  }
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.clock')), { tempo: 140 });
  clock.start(0);
  clock.setTempo(90);
  clock.save();
  assert.deepEqual(JSON.parse(storage.map.get('room.clock')), { tempo: 90 }, 'save(): at once');
  const next = new Clock({ storage, key: 'room.clock' });
  assert.deepEqual([next.tempo, next.running], [90, false], 'the tempo kept; it runs only when started');
});

test('what was kept but is not a tempo is as it comes, one out of range within it; storage that refuses or is blocked breaks nothing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const kept = [
    ['{"tempo":"fast"}', 110], ['{"tempo":"120"}', 110], ['{"tempo":null}', 110], ['not json', 110], ['[]', 110], ['null', 110],
    ['{"tempo":250}', 180], ['{"tempo":-5}', 60], ['{"tempo":99.6}', 100], ['{"tempo":120,"running":true}', 120],
  ];
  for (const [text, tempo] of kept) {
    const c = new Clock({ storage: memoryStorage({ clock: text }) });
    assert.deepEqual([c.tempo, c.running], [tempo, false], text);
  }
  const full = memoryStorage();
  full.refuse = true;
  const refused = new Clock({ storage: full });
  refused.setTempo(75);
  t.mock.timers.tick(400);
  refused.save();
  assert.equal(refused.tempo, 75, 'it lasts this visit');
  const blocked = new Clock({ storage: null });
  blocked.setTempo(150);
  blocked.save();
  assert.equal(blocked.tempo, 150);
});
